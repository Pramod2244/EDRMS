package com.edrms.backend.documents;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentStatusResponse {
    private UUID documentId;
    private String documentName;
    private String status;
    private Integer progressPercentage;
    private String errorMessage;
    private UUID jobId;
    private List<StepStatusDto> steps;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StepStatusDto {
        private String stepName;
        private String status;
        private OffsetDateTime startedAt;
        private OffsetDateTime completedAt;
        private Long durationMs;
        private String metadataJson;
    }
}
