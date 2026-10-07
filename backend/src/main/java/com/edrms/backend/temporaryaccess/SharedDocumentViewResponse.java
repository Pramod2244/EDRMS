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
public class SharedDocumentViewResponse {
    private UUID documentId;
    private String name;
    private String mimeType;
    private String extension;
    private Long fileSizeBytes;
    private Integer pageCount;
    private String previewUrl;
    private String downloadUrl;
    private Integer remainingViews;
    private boolean canDownload;
    private boolean canPrint;
}
