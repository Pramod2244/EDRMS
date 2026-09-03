package com.edrms.backend.ocr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OcrPageData {
    private int pageNumber;
    private String textContent;
    private double confidence;
    private int width;
    private int height;
    private String boundingBoxesJson;
}
