package com.edrms.backend.search;

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
public class DocumentSearchQuery {
    private String query;
    private UUID folderId;
    private Boolean includeSubfolders;
    private List<String> extensions;
    private OffsetDateTime dateFrom;
    private OffsetDateTime dateTo;
    @Builder.Default
    private int page = 0;
    @Builder.Default
    private int size = 10;
}
