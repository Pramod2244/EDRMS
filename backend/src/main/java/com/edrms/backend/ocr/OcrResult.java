package com.edrms.backend.ocr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OcrResult {
    private OcrEngineType engineType;
    private int totalPages;
    private List<OcrPageData> pages;
    private long processingDurationMs;
}
