package com.edrms.backend.documents;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    @Builder.Default
    private UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Column(name = "folder_id", nullable = false)
    private UUID folderId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "mime_type", nullable = false, length = 150)
    private String mimeType;

    @Column(nullable = false, length = 20)
    private String extension;

    @Column(name = "file_size_bytes", nullable = false)
    private Long fileSizeBytes;

    @Column(name = "checksum_sha256", nullable = false, length = 64)
    private String checksumSha256;

    @Column(name = "current_version", nullable = false)
    @Builder.Default
    private Integer currentVersion = 1;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "storage_provider", nullable = false, length = 50)
    private String storageProvider;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "page_count")
    private Integer pageCount;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
