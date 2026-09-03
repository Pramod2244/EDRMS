package com.edrms.backend.search;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageSearchHit {
    private int pageNumber;
    private String highlightSnippet;
    private double score;
}
