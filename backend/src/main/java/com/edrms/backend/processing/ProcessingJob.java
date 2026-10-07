package com.edrms.backend.processing;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "processing_jobs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessingJob {

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

    @Column(name = "job_type", nullable = false, length = 50)
    private String jobType;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "PENDING"; // PENDING, RUNNING, COMPLETED, FAILED, PARTIAL, RETRY_PENDING

    @Column(name = "progress_percentage", nullable = false)
    @Builder.Default
    private Integer progressPercentage = 0;

    @Column(name = "attempt_count", nullable = false)
    @Builder.Default
    private Integer attemptCount = 0;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "error_code", length = 100)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
