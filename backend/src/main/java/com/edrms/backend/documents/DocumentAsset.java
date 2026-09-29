package com.edrms.backend.documents;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_assets")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    @Builder.Default
    private UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "document_version_id", nullable = false)
    private UUID documentVersionId;

    @Column(name = "document_page_id")
    private UUID documentPageId;

    @Column(name = "asset_type", nullable = false, length = 50)
    private String assetType; // ORIGINAL, CANONICAL_PDF, PREVIEW_PDF, THUMBNAIL, PAGE_IMAGE, OCR_TEXT, EXTRACTED_TEXT

    @Column(name = "storage_provider", nullable = false, length = 50)
    private String storageProvider;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "mime_type", length = 150)
    private String mimeType;

    @Column(name = "extension", length = 20)
    private String extension;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "checksum_sha256", length = 64)
    private String checksumSha256;

    @Column(name = "created_by")
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
