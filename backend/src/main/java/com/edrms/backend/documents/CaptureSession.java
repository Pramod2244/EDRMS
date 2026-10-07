package com.edrms.backend.documents;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "capture_sessions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaptureSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    @Builder.Default
    private UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "capture_type", nullable = false, length = 50)
    private String captureType; // WEB_UPLOAD, BULK_UPLOAD, SCANNER_AGENT, MOBILE_WEB, API

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "CREATED";

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(name = "expected_item_count")
    @Builder.Default
    private Integer expectedItemCount = 1;

    @Column(name = "received_item_count")
    @Builder.Default
    private Integer receivedItemCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
