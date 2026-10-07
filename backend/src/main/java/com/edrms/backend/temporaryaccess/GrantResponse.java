package com.edrms.backend.temporaryaccess;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GrantResponse {
    private String token;
    private String shareUrl;
    private UUID documentId;
    private String documentName;
    private OffsetDateTime validUntil;
    private Integer maxViews;
    private boolean requiresPassword;
    private boolean canDownload;
    private boolean canPrint;
}
