package com.edrms.backend.processing;

import jakarta.persistence.*;
import lombok.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "processing_job_steps")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessingJobStep {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "processing_job_id", nullable = false)
    private UUID processingJobId;

    @Column(name = "step_name", nullable = false, length = 100)
    private String stepName; // VALIDATE_FILE, MALWARE_SCAN, HASH_FILE, STORE_ORIGINAL, EXTRACT_TEXT, DETECT_PAGES, OCR, GENERATE_THUMBNAILS, GENERATE_PREVIEW, INDEX_SEARCH, FINALIZE

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata_json", columnDefinition = "jsonb")
    private String metadataJson;
}
