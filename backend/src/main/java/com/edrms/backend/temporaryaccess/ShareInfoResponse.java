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
public class ShareInfoResponse {
    private boolean valid;
    private boolean requiresPassword;
    private boolean canDownload;
    private boolean canPrint;
    private UUID documentId;
    private String documentName;
    private String mimeType;
    private Long fileSizeBytes;
    private OffsetDateTime validUntil;
    private Integer remainingViews;
    private String errorMessage;
}
