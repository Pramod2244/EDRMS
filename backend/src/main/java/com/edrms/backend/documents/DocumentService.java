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
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import com.edrms.backend.storage.StorageMetadata;
import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.HexFormat;

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
    private final com.edrms.backend.folders.FolderNumberingService numbering;
    private final RecycleBinService recycleBin;

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
        FolderService folderService,
        com.edrms.backend.folders.FolderNumberingService numbering,
        RecycleBinService recycleBin
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
        this.numbering = numbering;
        this.recycleBin = recycleBin;
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

        // Determine initial page count if PDF
        int initialPageCount = 1;
        if ("pdf".equalsIgnoreCase(valResult.getExtension())) {
            try (InputStream is = file.getInputStream();
                 PDDocument pdDoc = PDDocument.load(is)) {
                initialPageCount = pdDoc.getNumberOfPages();
            } catch (Exception e) {
                log.warn("Could not determine PDF page count during upload: {}", e.getMessage());
            }
        }

        // 3. Save Document Entity
        Document doc = Document.builder()
            .pageCount(initialPageCount)
            .folderId(folderId)
            .name(valResult.getSanitizedFilename())
            .referenceId(numbering.allocate(folderId))
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
        StorageProviderType providerType = StorageProviderType.valueOf(doc.getStorageProvider());

        if (page.isPresent() && page.get().getThumbnailStorageKey() != null) {
            try {
                return storageService.load(providerType, page.get().getThumbnailStorageKey());
            } catch (Exception ignored) {}
        }

        boolean isPdf = "pdf".equalsIgnoreCase(doc.getExtension()) ||
            (doc.getMimeType() != null && doc.getMimeType().contains("pdf")) ||
            (doc.getName() != null && doc.getName().toLowerCase().endsWith(".pdf"));

        if (isPdf) {
            try (InputStream is = storageService.load(providerType, doc.getStorageKey());
                 PDDocument pdDoc = PDDocument.load(is)) {
                if (pageNumber >= 1 && pageNumber <= pdDoc.getNumberOfPages()) {
                    PDFRenderer renderer = new PDFRenderer(pdDoc);
                    BufferedImage thumbImage = renderer.renderImageWithDPI(pageNumber - 1, 96, ImageType.RGB);
                    BufferedImage scaled = resizeImage(thumbImage, 240, 320);
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    ImageIO.write(scaled, "PNG", baos);
                    byte[] thumbBytes = baos.toByteArray();

                    String thumbKey = "thumbnails/" + doc.getId() + "_p" + pageNumber + ".png";
                    StorageMetadata meta = StorageMetadata.builder()
                        .contentLength((long) thumbBytes.length)
                        .contentType("image/png")
                        .build();
                    storageService.getProvider(providerType).store(thumbKey, new ByteArrayInputStream(thumbBytes), meta);

                    if (page.isPresent()) {
                        DocumentPage p = page.get();
                        p.setThumbnailStorageKey(thumbKey);
                        pageRepository.save(p);
                    }
                    return new ByteArrayInputStream(thumbBytes);
                }
            } catch (Exception e) {
                log.warn("On-demand thumbnail generation error for doc {} page {}: {}", doc.getId(), pageNumber, e.getMessage());
            }
        }

        Optional<DocumentAsset> thumbAsset = assetRepository.findByDocumentIdAndAssetType(doc.getId(), "THUMBNAIL");
        if (thumbAsset.isPresent()) {
            return storageService.load(providerType, thumbAsset.get().getStorageKey());
        }
        return null;
    }

    private String calculateSha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return UUID.randomUUID().toString().replace("-", "");
        }
    }

    private BufferedImage resizeImage(BufferedImage originalImage, int targetWidth, int targetHeight) {
        int originalWidth = originalImage.getWidth();
        int originalHeight = originalImage.getHeight();
        double ratio = Math.min((double) targetWidth / originalWidth, (double) targetHeight / originalHeight);
        int width = Math.max(1, (int) (originalWidth * ratio));
        int height = Math.max(1, (int) (originalHeight * ratio));

        BufferedImage resized = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = resized.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(originalImage, 0, 0, width, height, null);
        g.dispose();
        return resized;
    }

    @Transactional
    public List<DocumentPage> deleteDocumentPage(UUID documentId, int pageNumber, String actor) throws IOException {
        Document doc = documentRepository.findById(documentId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));

        if (Boolean.TRUE.equals(doc.getIsDeleted())) {
            throw new IllegalStateException("Document is deleted");
        }

        boolean isPdf = "pdf".equalsIgnoreCase(doc.getExtension()) ||
            (doc.getMimeType() != null && doc.getMimeType().contains("pdf")) ||
            (doc.getName() != null && doc.getName().toLowerCase().endsWith(".pdf"));

        if (!isPdf) {
            throw new UnsupportedOperationException("Page deletion is currently only supported for PDF documents.");
        }

        StorageProviderType providerType = StorageProviderType.valueOf(doc.getStorageProvider());

        // Load existing PDF bytes
        byte[] pdfBytes;
        try (InputStream is = storageService.load(providerType, doc.getStorageKey())) {
            pdfBytes = is.readAllBytes();
        }

        try (PDDocument pdDoc = PDDocument.load(pdfBytes)) {
            int totalPages = pdDoc.getNumberOfPages();
            if (totalPages <= 1) {
                throw new IllegalStateException("Cannot delete the only page of a document. Delete the document instead.");
            }
            if (pageNumber < 1 || pageNumber > totalPages) {
                throw new IllegalArgumentException("Invalid page number " + pageNumber + ". Document has " + totalPages + " pages.");
            }

            // Remove page from PDF (PDFBox is 0-indexed)
            pdDoc.removePage(pageNumber - 1);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            pdDoc.save(baos);
            byte[] updatedPdfBytes = baos.toByteArray();

            String newHash = calculateSha256(updatedPdfBytes);
            StorageMetadata metadata = StorageMetadata.builder()
                .contentLength((long) updatedPdfBytes.length)
                .contentType("application/pdf")
                .build();
            storageService.getProvider(providerType).store(doc.getStorageKey(), new ByteArrayInputStream(updatedPdfBytes), metadata);

            // Update document metadata
            doc.setFileSizeBytes((long) updatedPdfBytes.length);
            doc.setChecksumSha256(newHash);
            doc.setPageCount(totalPages - 1);
            documentRepository.saveAndFlush(doc);

            // Update PREVIEW_PDF asset if present
            Optional<DocumentAsset> previewAsset = assetRepository.findByDocumentIdAndAssetType(doc.getId(), "PREVIEW_PDF");
            if (previewAsset.isPresent()) {
                storageService.getProvider(providerType).store(previewAsset.get().getStorageKey(), new ByteArrayInputStream(updatedPdfBytes), metadata);
            }

            // Delete target page record from database
            Optional<DocumentPage> targetPage = pageRepository.findByDocumentIdAndPageNumber(documentId, pageNumber);
            targetPage.ifPresent(pageRepository::delete);
            pageRepository.flush();

            // Renumber remaining pages
            List<DocumentPage> remainingPages = pageRepository.findByDocumentIdOrderByPageNumberAsc(documentId);
            int seq = 1;
            for (DocumentPage p : remainingPages) {
                p.setPageNumber(seq);
                p.setSequenceNumber(seq);
                p.setThumbnailStorageKey(null);
                pageRepository.save(p);
                seq++;
            }
            pageRepository.flush();

            // Regenerate thumbnail for page 1
            try {
                PDFRenderer renderer = new PDFRenderer(pdDoc);
                BufferedImage thumbImage = renderer.renderImageWithDPI(0, 100, ImageType.RGB);
                BufferedImage scaled = resizeImage(thumbImage, 300, 400);
                ByteArrayOutputStream thumbBaos = new ByteArrayOutputStream();
                ImageIO.write(scaled, "PNG", thumbBaos);
                byte[] thumbBytes = thumbBaos.toByteArray();

                String thumbKey = "thumbnails/" + doc.getId() + "_p1.png";
                StorageMetadata thumbMeta = StorageMetadata.builder()
                    .contentLength((long) thumbBytes.length)
                    .contentType("image/png")
                    .build();
                storageService.getProvider(providerType).store(thumbKey, new ByteArrayInputStream(thumbBytes), thumbMeta);

                if (!remainingPages.isEmpty()) {
                    DocumentPage p1 = remainingPages.get(0);
                    p1.setThumbnailStorageKey(thumbKey);
                    pageRepository.save(p1);
                }
            } catch (Exception ex) {
                log.warn("Could not regenerate thumbnail after page deletion: {}", ex.getMessage());
            }

            return pageRepository.findByDocumentIdOrderByPageNumberAsc(documentId);
        }
    }

    public String getPresignedDownloadUrl(Document doc, Duration ttl) {
        StorageProviderType providerType = StorageProviderType.valueOf(doc.getStorageProvider());
        return storageService.generateDownloadUrl(providerType, doc.getStorageKey(), ttl, doc.getName());
    }

    @Transactional
    public void deleteDocument(UUID id) {
        recycleBin.move(id);
    }
}
