package com.edrms.backend.documents;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_pages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentPage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    @Builder.Default
    private UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "document_version_id")
    private UUID documentVersionId;

    @Column(name = "page_number", nullable = false)
    private Integer pageNumber;

    @Column(name = "sequence_number")
    @Builder.Default
    private Integer sequenceNumber = 1;

    @Column(name = "text_source", length = 50)
    @Builder.Default
    private String textSource = "DIGITAL"; // DIGITAL, OCR, MIXED, EMPTY

    @Column(name = "ocr_status", length = 30)
    @Builder.Default
    private String ocrStatus = "NOT_REQUIRED"; // NOT_REQUIRED, PENDING, COMPLETED, FAILED

    @Column(name = "rotation")
    @Builder.Default
    private Integer rotation = 0;

    @Column(name = "text_content", columnDefinition = "TEXT")
    private String textContent;

    @Column(name = "ocr_confidence")
    private Double ocrConfidence;

    @Column(name = "thumbnail_storage_key", length = 500)
    private String thumbnailStorageKey;

    @Column(name = "page_width")
    private Integer pageWidth;

    @Column(name = "page_height")
    private Integer pageHeight;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
