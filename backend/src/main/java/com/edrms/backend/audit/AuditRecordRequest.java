package com.edrms.backend.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditRecordRequest {
    private String action;          // "VIEW", "DOWNLOAD", "PRINT", etc.
    private String documentId;
    private String documentName;
    private String actorUsername;
    private String actorRole;
    private String entityType;      // defaults to "DOCUMENT"
    private String clientIp;
    private String detailsJson;
}
