package com.edrms.backend.documents;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ingestion_batches")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IngestionBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    @Builder.Default
    private UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Column(name = "batch_number", nullable = false, unique = true, length = 100)
    private String batchNumber;

    @Column(name = "department_id")
    private UUID departmentId;

    @Column(name = "category_id")
    private UUID categoryId;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "expected_documents")
    @Builder.Default
    private Integer expectedDocuments = 0;

    @Column(name = "received_documents")
    @Builder.Default
    private Integer receivedDocuments = 0;

    @Column(name = "processed_documents")
    @Builder.Default
    private Integer processedDocuments = 0;

    @Column(name = "failed_documents")
    @Builder.Default
    private Integer failedDocuments = 0;

    @Column(name = "duplicate_documents")
    @Builder.Default
    private Integer duplicateDocuments = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
