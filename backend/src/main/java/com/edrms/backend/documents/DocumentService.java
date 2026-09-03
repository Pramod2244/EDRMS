package com.edrms.backend.documents;

import com.edrms.backend.processing.DocumentEventBus;
import com.edrms.backend.processing.DocumentIngestedEvent;
import com.edrms.backend.storage.StorageProviderType;
import com.edrms.backend.storage.StorageResult;
import com.edrms.backend.storage.StorageService;
import com.edrms.backend.users.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final StorageService storageService;
    private final DocumentEventBus documentEventBus;

    public DocumentService(
        DocumentRepository documentRepository,
        StorageService storageService,
        DocumentEventBus documentEventBus
    ) {
        this.documentRepository = documentRepository;
        this.storageService = storageService;
        this.documentEventBus = documentEventBus;
    }

    public Page<Document> getDocumentsInFolder(UUID folderId, Pageable pageable) {
        return documentRepository.findByFolderIdAndIsDeletedFalse(folderId, pageable);
    }

    public Optional<Document> findById(UUID id) {
        return documentRepository.findById(id).filter(d -> !d.getIsDeleted());
    }

    @Transactional
    public Document uploadDocument(MultipartFile file, UUID folderId, User user) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unnamed_document";
        String extension = getFileExtension(filename);
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";

        StorageResult storageResult = storageService.store(
            file.getInputStream(),
            filename,
            file.getSize(),
            contentType
        );

        Document doc = Document.builder()
            .folderId(folderId)
            .name(filename)
            .mimeType(contentType)
            .extension(extension)
            .fileSizeBytes(file.getSize())
            .checksumSha256(storageResult.getChecksumSha256())
            .currentVersion(1)
            .status("PROCESSING")
            .storageProvider(storageResult.getProviderType().name())
            .storageKey(storageResult.getStorageKey())
            .ownerId(user.getId())
            .isDeleted(false)
            .build();

        Document savedDoc = documentRepository.save(doc);

        // Publish to processing pipeline queue
        documentEventBus.publish(new DocumentIngestedEvent(savedDoc.getId(), user.getId()));

        return savedDoc;
    }

    public InputStream getDocumentBinaryStream(Document doc) {
        StorageProviderType providerType = StorageProviderType.valueOf(doc.getStorageProvider());
        return storageService.load(providerType, doc.getStorageKey());
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
        });
    }

    private String getFileExtension(String filename) {
        int idx = filename.lastIndexOf('.');
        return idx > 0 ? filename.substring(idx + 1).toLowerCase() : "bin";
    }
}
