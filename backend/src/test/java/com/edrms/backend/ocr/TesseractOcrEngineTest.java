package com.edrms.backend.ocr;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class TesseractOcrEngineTest {
    @Test
    void scannedPdfIncludesPagesBeyondTwentyFive() throws Exception {
        TesseractOcrEngine engine = new TesseractOcrEngine();
        ReflectionTestUtils.setField(engine, "configuredBinaryPath", "tesseract");
        ReflectionTestUtils.setField(engine, "language", "eng");
        org.junit.jupiter.api.Assumptions.assumeTrue(engine.isAvailable(), "Native OCR required");
        BufferedImage image = new BufferedImage(500, 100, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(Color.WHITE);
        graphics.fillRect(0, 0, 500, 100);
        graphics.setColor(Color.BLACK);
        graphics.setFont(new Font("Arial", Font.BOLD, 28));
        graphics.drawString("EDRMS SCANNED DOCUMENT", 10, 60);
        graphics.dispose();
        byte[] pdfBytes;
        try (var pdf = new org.apache.pdfbox.pdmodel.PDDocument(); var output = new ByteArrayOutputStream()) {
            var picture = org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory.createFromImage(pdf, image);
            for (int index = 0; index < 26; index++) {
                var page = new org.apache.pdfbox.pdmodel.PDPage(new org.apache.pdfbox.pdmodel.common.PDRectangle(500, 100));
                pdf.addPage(page);
                try (var canvas = new org.apache.pdfbox.pdmodel.PDPageContentStream(pdf, page)) {
                    canvas.drawImage(picture, 0, 0, 500, 100);
                }
            }
            pdf.save(output);
            pdfBytes = output.toByteArray();
        }
        OcrResult result = engine.process(new ByteArrayInputStream(pdfBytes));
        assertEquals(26, result.getTotalPages());
        assertEquals(26, result.getPages().get(25).getPageNumber());
        assertTrue(result.getPages().get(25).getTextContent().contains("EDRMS"));
    }

    @Test
    void missingLanguageIsReportedAsFailure() throws Exception {
        TesseractOcrEngine engine = new TesseractOcrEngine();
        ReflectionTestUtils.setField(engine, "configuredBinaryPath", "tesseract");
        ReflectionTestUtils.setField(engine, "language", "edrms_missing_language");
        org.junit.jupiter.api.Assumptions.assumeTrue(engine.isAvailable(), "Native OCR required");
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB), "PNG", output);
        assertThrows(IllegalStateException.class, () -> engine.process(new ByteArrayInputStream(output.toByteArray())));
    }

    @Test
    void testEngineAvailability() {
        TesseractOcrEngine engine = new TesseractOcrEngine();
        ReflectionTestUtils.setField(engine, "configuredBinaryPath", "/usr/local/bin/tesseract");
        ReflectionTestUtils.setField(engine, "language", "eng");

        assertTrue(engine.isAvailable(), "Tesseract OCR binary should be detected and executable");
        assertEquals(OcrEngineType.LOCAL_TESSERACT, engine.getEngineType());
    }

    @Test
    void testOcrOnGeneratedImage() throws IOException {
        TesseractOcrEngine engine = new TesseractOcrEngine();
        ReflectionTestUtils.setField(engine, "configuredBinaryPath", "/usr/local/bin/tesseract");
        ReflectionTestUtils.setField(engine, "language", "eng");

        // Generate a crisp synthetic text image
        BufferedImage image = new BufferedImage(500, 100, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 500, 100);
        g.setColor(Color.BLACK);
        g.setFont(new Font("Arial", Font.BOLD, 28));
        g.drawString("ARKAA DIGITAL EDRMS", 30, 60);
        g.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, "PNG", baos);

        OcrResult result = engine.process(new ByteArrayInputStream(baos.toByteArray()));

        assertNotNull(result);
        assertEquals(OcrEngineType.LOCAL_TESSERACT, result.getEngineType());
        assertFalse(result.getPages().isEmpty());
        String detected = result.getPages().get(0).getTextContent().toUpperCase();
        // Should detect either ARKAA, DIGITAL, or EDRMS
        assertTrue(detected.contains("ARKAA") || detected.contains("DIGITAL") || detected.contains("EDRMS"),
            "OCR result should contain words from generated image, got: " + detected);
    }
}
