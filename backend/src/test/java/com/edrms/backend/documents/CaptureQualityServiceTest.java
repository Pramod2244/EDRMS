package com.edrms.backend.documents;
import com.edrms.backend.ocr.*;
import org.junit.jupiter.api.Test;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.List;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CaptureQualityServiceTest {
    final TesseractOcrEngine ocr=mock(TesseractOcrEngine.class);
    final CaptureQualityService quality=new CaptureQualityService(ocr);
    byte[] encode(BufferedImage image) throws Exception { var output=new ByteArrayOutputStream(); ImageIO.write(image,"PNG",output); return output.toByteArray(); }
    BufferedImage document() {
        var image=new BufferedImage(900,1200,BufferedImage.TYPE_INT_RGB); var graphics=image.createGraphics();
        graphics.setColor(Color.WHITE); graphics.fillRect(0,0,900,1200); graphics.setColor(Color.BLACK);
        graphics.setFont(new Font("SansSerif",Font.PLAIN,40));
        for(int row=0;row<12;row++) graphics.drawString("Readable document text 1234",35,100+row*70);
        graphics.dispose(); return image;
    }
    @Test void rejectsTinyDarkPageBeforeOcr() throws Exception {
        var check=quality.check("token",encode(new BufferedImage(100,200,BufferedImage.TYPE_INT_RGB)));
        assertFalse(check.eligible()); assertTrue(check.issues().stream().anyMatch(issue -> issue.contains("thumbnail"))); verifyNoInteractions(ocr);
    }
    @Test void rejectsBlankPage() throws Exception {
        var image=new BufferedImage(900,1200,BufferedImage.TYPE_INT_RGB); var graphics=image.createGraphics();
        graphics.setColor(Color.WHITE); graphics.fillRect(0,0,900,1200); graphics.dispose();
        var check=quality.check("token",encode(image)); assertFalse(check.eligible()); verifyNoInteractions(ocr);
    }
    @Test void rejectsBlurredGradient() throws Exception {
        var image=new BufferedImage(900,1200,BufferedImage.TYPE_INT_RGB);
        for(int y=0;y<1200;y++) for(int x=0;x<900;x++) { int value=x*255/899; image.setRGB(x,y,new Color(value,value,value).getRGB()); }
        var check=quality.check("token",encode(image)); assertFalse(check.eligible()); assertTrue(check.issues().stream().anyMatch(issue -> issue.contains("blurred"))); verifyNoInteractions(ocr);
    }
    @Test void requiresActualRecognizedText() throws Exception {
        when(ocr.measureImage(any())).thenReturn(new TesseractOcrEngine.ScanTextQuality(0,0,0));
        var check=quality.check("token",encode(document())); assertFalse(check.eligible()); assertTrue(check.issues().get(0).contains("OCR")); verify(ocr).measureImage(any());
    }
    @Test void reusesChecksOnlyForSameTokenAndBytes() throws Exception {
        when(ocr.measureImage(any())).thenReturn(new TesseractOcrEngine.ScanTextQuality(30,95,30));
        var bytes=encode(document()); assertTrue(quality.check("token",bytes).eligible()); assertTrue(quality.check("token",bytes).eligible());
        verify(ocr,times(1)).measureImage(any()); quality.check("other-token",bytes); verify(ocr,times(2)).measureImage(any());
    }
    @Test void unavailableOcrCannotPassValidation() throws Exception {
        when(ocr.measureImage(any())).thenThrow(new IllegalStateException("Unavailable"));
        assertThrows(IllegalArgumentException.class, () -> quality.check("token",encode(document())));
    }
    @Test void rejectsLowConfidenceEvenWhenTextWasDetected() throws Exception {
        when(ocr.measureImage(any())).thenReturn(new TesseractOcrEngine.ScanTextQuality(30,35,4));
        var check=quality.check("token",encode(document())); assertFalse(check.eligible()); assertTrue(check.issues().get(0).contains("uncertain"));
    }
    byte[] smallerDocument() throws Exception {
        var image=new BufferedImage(803,916,BufferedImage.TYPE_INT_RGB);
        var graphics=image.createGraphics(); graphics.drawImage(document(),0,0,803,916,null); graphics.dispose();
        return encode(image);
    }
    @Test void readableScreenshotBelowFullPageSizeCanPass() throws Exception {
        when(ocr.measureImage(any())).thenReturn(new TesseractOcrEngine.ScanTextQuality(120,94,110));
        var check=quality.check("small-readable",smallerDocument());
        assertTrue(check.eligible()); assertEquals(803,check.width()); assertEquals(916,check.height());
        verify(ocr).measureImage(any());
    }
    @Test void smallerScreenshotStillRequiresConfidentOcr() throws Exception {
        when(ocr.measureImage(any())).thenReturn(new TesseractOcrEngine.ScanTextQuality(120,35,30));
        var check=quality.check("small-unreadable",smallerDocument());
        assertFalse(check.eligible()); assertTrue(check.issues().get(0).contains("uncertain"));
        verify(ocr).measureImage(any());
    }
}
