package com.edrms.backend.search;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentSearchHit {
    private UUID documentId;
    private String documentName;
    private UUID folderId;
    private String folderPath;
    private long fileSizeBytes;
    private List<PageSearchHit> pageHits;
}
