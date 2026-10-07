package com.edrms.backend.documents;

import com.edrms.backend.folders.FolderService;
import com.edrms.backend.processing.*;
import com.edrms.backend.search.SearchService;
import com.edrms.backend.storage.StorageProviderType;
import com.edrms.backend.storage.StorageResult;
import com.edrms.backend.storage.StorageService;
import com.edrms.backend.users.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentAssetRepository assetRepository;
    private final DocumentPageRepository pageRepository;
    private final ProcessingJobRepository jobRepository;
    private final ProcessingJobStepRepository stepRepository;
    private final FileValidationService fileValidationService;
    private final StorageService storageService;
    private final DocumentEventBus documentEventBus;
    private final SearchService searchService;
    private final FolderService folderService;

    public DocumentService(
        DocumentRepository documentRepository,
        DocumentVersionRepository versionRepository,
        DocumentAssetRepository assetRepository,
        DocumentPageRepository pageRepository,
        ProcessingJobRepository jobRepository,
        ProcessingJobStepRepository stepRepository,
        FileValidationService fileValidationService,
        StorageService storageService,
        DocumentEventBus documentEventBus,
        SearchService searchService,
        FolderService folderService
    ) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.assetRepository = assetRepository;
        this.pageRepository = pageRepository;
        this.jobRepository = jobRepository;
        this.stepRepository = stepRepository;
        this.fileValidationService = fileValidationService;
        this.storageService = storageService;
        this.documentEventBus = documentEventBus;
        this.searchService = searchService;
        this.folderService = folderService;
    }

    public Page<Document> getDocumentsInFolder(UUID folderId, Pageable pageable) {
        return documentRepository.findByFolderIdAndIsDeletedFalse(folderId, pageable);
    }

    public List<Document> getAllDocuments() {
        return documentRepository.findAll().stream()
            .filter(d -> !Boolean.TRUE.equals(d.getIsDeleted()))
            .collect(Collectors.toList());
    }

    public Optional<Document> findById(UUID id) {
        return documentRepository.findById(id).filter(d -> !Boolean.TRUE.equals(d.getIsDeleted()));
    }

    @Transactional
    public Document uploadDocument(MultipartFile file, UUID folderId, User user) throws IOException {
        // 1. Rigorous File Validation & Security Inspection
        FileValidationResult valResult = fileValidationService.validateAndInspect(file);

        if (valResult.isDuplicate()) {
            log.info("Uploaded document with hash {} already exists in repository", valResult.getChecksumSha256());
        }

        // 2. Persist in active storage using repository folder hierarchy
        String folderHierarchyPath = folderService.getFolderHierarchyPath(folderId);
        StorageResult storageResult = storageService.store(
            file.getInputStream(),
            valResult.getSanitizedFilename(),
            valResult.getSizeBytes(),
            valResult.getDetectedMimeType(),
            folderHierarchyPath
        );

        // 3. Save Document Entity
        Document doc = Document.builder()
            .folderId(folderId)
            .name(valResult.getSanitizedFilename())
            .mimeType(valResult.getDetectedMimeType())
            .extension(valResult.getExtension())
            .fileSizeBytes(valResult.getSizeBytes())
            .checksumSha256(valResult.getChecksumSha256())
            .currentVersion(1)
            .status("PROCESSING")
            .storageProvider(storageResult.getProviderType().name())
            .storageKey(storageResult.getStorageKey())
            .ownerId(user.getId())
            .isDeleted(false)
            .build();

        Document savedDoc = documentRepository.saveAndFlush(doc);

        // 4. Save Version 1
        DocumentVersion v1 = versionRepository.saveAndFlush(DocumentVersion.builder()
            .tenantId(savedDoc.getTenantId())
            .documentId(savedDoc.getId())
            .versionNumber(1)
            .storageProvider(savedDoc.getStorageProvider())
            .storageKey(savedDoc.getStorageKey())
            .fileSizeBytes(savedDoc.getFileSizeBytes())
            .checksumSha256(savedDoc.getChecksumSha256())
            .createdBy(user.getId())
            .build());

        // 5. Save Initial Original Asset
        assetRepository.saveAndFlush(DocumentAsset.builder()
            .tenantId(savedDoc.getTenantId())
            .documentId(savedDoc.getId())
            .documentVersionId(v1.getId())
            .assetType("ORIGINAL")
            .storageProvider(savedDoc.getStorageProvider())
            .storageKey(savedDoc.getStorageKey())
            .mimeType(savedDoc.getMimeType())
            .extension(savedDoc.getExtension())
            .sizeBytes(savedDoc.getFileSizeBytes())
            .checksumSha256(savedDoc.getChecksumSha256())
            .createdBy(user.getId())
            .build());

        // 6. Initialize Processing Job in DB
        jobRepository.saveAndFlush(ProcessingJob.builder()
            .tenantId(savedDoc.getTenantId())
            .documentId(savedDoc.getId())
            .documentVersionId(v1.getId())
            .jobType("INGESTION_PIPELINE")
            .status("PENDING")
            .progressPercentage(0)
            .attemptCount(1)
            .build());

        // 7. Publish to async processing pipeline queue
        documentEventBus.publish(new DocumentIngestedEvent(savedDoc.getId(), user.getId()));

        return savedDoc;
    }

    public DocumentStatusResponse getDocumentStatus(UUID documentId) {
        Document doc = findById(documentId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));

        Optional<ProcessingJob> optJob = jobRepository.findTopByDocumentIdOrderByCreatedAtDesc(documentId);

        List<DocumentStatusResponse.StepStatusDto> stepDtos = new ArrayList<>();
        int progress = "READY".equals(doc.getStatus()) ? 100 : 0;
        String jobStatus = doc.getStatus();
        String error = null;
        UUID jobId = null;

        if (optJob.isPresent()) {
            ProcessingJob job = optJob.get();
            jobId = job.getId();
            jobStatus = job.getStatus();
            progress = job.getProgressPercentage() != null ? job.getProgressPercentage() : 0;
            error = job.getErrorMessage();

            List<ProcessingJobStep> steps = stepRepository.findByProcessingJobIdOrderByStartedAtAsc(job.getId());
            stepDtos = steps.stream().map(s -> DocumentStatusResponse.StepStatusDto.builder()
                .stepName(s.getStepName())
                .status(s.getStatus())
                .startedAt(s.getStartedAt())
                .completedAt(s.getCompletedAt())
                .durationMs(s.getDurationMs())
                .metadataJson(s.getMetadataJson())
                .build()).collect(Collectors.toList());
        }

        return DocumentStatusResponse.builder()
            .documentId(doc.getId())
            .documentName(doc.getName())
            .status(jobStatus)
            .progressPercentage(progress)
            .errorMessage(error)
            .jobId(jobId)
            .steps(stepDtos)
            .build();
    }

    public List<DocumentPage> getDocumentPages(UUID documentId) {
        return pageRepository.findByDocumentIdOrderByPageNumberAsc(documentId);
    }

    public List<DocumentAsset> getDocumentAssets(UUID documentId) {
        return assetRepository.findByDocumentId(documentId);
    }

    public InputStream getDocumentBinaryStream(Document doc) {
        StorageProviderType providerType = StorageProviderType.valueOf(doc.getStorageProvider());
        return storageService.load(providerType, doc.getStorageKey());
    }

    public InputStream getDocumentPreviewStream(Document doc) {
        Optional<DocumentAsset> previewAsset = assetRepository.findByDocumentIdAndAssetType(doc.getId(), "PREVIEW_PDF");
        if (previewAsset.isPresent()) {
            StorageProviderType providerType = StorageProviderType.valueOf(previewAsset.get().getStorageProvider());
            return storageService.load(providerType, previewAsset.get().getStorageKey());
        }
        return getDocumentBinaryStream(doc);
    }

    public InputStream getPageThumbnailStream(Document doc, int pageNumber) {
        Optional<DocumentPage> page = pageRepository.findByDocumentIdAndPageNumber(doc.getId(), pageNumber);
        if (page.isPresent() && page.get().getThumbnailStorageKey() != null) {
            StorageProviderType providerType = StorageProviderType.valueOf(doc.getStorageProvider());
            return storageService.load(providerType, page.get().getThumbnailStorageKey());
        }
        Optional<DocumentAsset> thumbAsset = assetRepository.findByDocumentIdAndAssetType(doc.getId(), "THUMBNAIL");
        if (thumbAsset.isPresent()) {
            StorageProviderType providerType = StorageProviderType.valueOf(thumbAsset.get().getStorageProvider());
            return storageService.load(providerType, thumbAsset.get().getStorageKey());
        }
        return null;
    }

    public String getPresignedDownloadUrl(Document doc, Duration ttl) {
        StorageProviderType providerType = StorageProviderType.valueOf(doc.getStorageProvider());
        return storageService.generateDownloadUrl(providerType, doc.getStorageKey(), ttl, doc.getName());
    }

    @Transactional
    public void deleteDocument(UUID id) {
        documentRepository.findById(id).ifPresent(d -> {
            d.setIsDeleted(true);
            documentRepository.save(d);
            searchService.deleteDocumentIndex(id);
        });
    }
}
