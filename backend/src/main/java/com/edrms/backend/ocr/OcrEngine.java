package com.edrms.backend.ocr;

import java.io.InputStream;

public interface OcrEngine {
    OcrResult process(InputStream documentStream);
    OcrEngineType getEngineType();
    boolean isAvailable();
}
