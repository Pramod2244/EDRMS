package com.edrms.backend.ocr;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.List;

@Service
public class OcrService {

    private final List<OcrEngine> engines;
    private final String preferredEngine;

    public OcrService(
        List<OcrEngine> engines,
        @Value("${edrms.ocr.active-engine:LOCAL_TESSERACT}") String preferredEngine
    ) {
        this.engines = engines;
        this.preferredEngine = preferredEngine;
    }

    public OcrResult extractText(InputStream documentStream) {
        // First match preferred engine
        for (OcrEngine engine : engines) {
            String engineName = engine.getEngineType().name();
            if ((engineName.equalsIgnoreCase(preferredEngine) || 
                (preferredEngine.contains("TESSERACT") && engineName.contains("TESSERACT"))) 
                && engine.isAvailable()) {
                return engine.process(documentStream);
            }
        }
        // Fallback to any available engine
        for (OcrEngine engine : engines) {
            if (engine.isAvailable()) {
                return engine.process(documentStream);
            }
        }
        throw new IllegalStateException("No OCR engine available to process document");
    }
}
