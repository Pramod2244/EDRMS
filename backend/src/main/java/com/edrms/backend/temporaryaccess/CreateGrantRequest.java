package com.edrms.backend.temporaryaccess;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateGrantRequest {
    private UUID documentId;
    private String duration; // "1h", "24h", "7d", "30d"
    private String maxViews; // "1", "5", "20", "unlimited"
    private String password;
    private String permissionsMask;
    @Builder.Default
    private Boolean allowDownload = false;
    @Builder.Default
    private Boolean allowPrint = false;
}
