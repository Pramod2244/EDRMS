package com.edrms.backend.documents;

import com.edrms.backend.ocr.TesseractOcrEngine;
import org.springframework.stereotype.Service;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;

@Service
public class CaptureQualityService {
    public record Check(boolean eligible, List<String> issues, int width, int height, long bytes, long recognizedCharacters) {}
    private record Cached(Check check, long expires) {}
    private final Map<String,Cached> cache = new ConcurrentHashMap<>();
    private final Semaphore slots = new Semaphore(2);
    private final TesseractOcrEngine ocr;
    public CaptureQualityService(TesseractOcrEngine ocr) { this.ocr = ocr; }
    private static double gray(BufferedImage image,int x,int y) {
        int rgb=image.getRGB(x,y);
        return ((rgb>>16)&255)*0.299 + ((rgb>>8)&255)*0.587 + (rgb&255)*0.114;
    }

    public Check check(String scope, byte[] bytes) throws IOException {
        if (bytes.length == 0 || bytes.length > 10 * 1024 * 1024)
            return new Check(false,List.of("Each photo must be between 1 byte and 10 MB. Choose a smaller JPEG or PNG."),0,0,bytes.length,0);
        String key;
        try { key=scope+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
        Cached saved=cache.get(key);
        if (saved!=null && saved.expires()>System.currentTimeMillis()) return saved.check();
        if (!slots.tryAcquire()) throw new IllegalArgumentException("Scan checks are busy. Wait a few seconds and check this page again.");
        try {
            List<String> issues=new ArrayList<>(); int width=0,height=0; long characters=0;
            try (var input=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers=ImageIO.getImageReaders(input);
                if (!readers.hasNext()) return new Check(false,List.of("This photo cannot be opened. Retake it or choose a JPEG or PNG."),0,0,bytes.length,0);
                var reader=readers.next();
                try {
                    reader.setInput(input); String format=reader.getFormatName();
                    if (!format.equalsIgnoreCase("JPEG") && !format.equalsIgnoreCase("PNG"))
                        return new Check(false,List.of("Choose a JPEG or PNG photo."),0,0,bytes.length,0);
                    width=reader.getWidth(0); height=reader.getHeight(0);
                    if ((long)width*height>20_000_000) return new Check(false,List.of("Photo resolution is too large. Choose a photo below 20 megapixels."),width,height,bytes.length,0);
                    // Dimensions alone do not establish readability: screenshots and cropped
                    // pages can contain sharp text below a conventional full-page scan size.
                    // Reject only thumbnails here; actual OCR confidence decides the rest.
                    if (Math.min(width,height)<300 || Math.max(width,height)<400) issues.add("This image is thumbnail-sized. Choose the original photo or a larger screenshot; use Retake only if you need a new photo.");
                    var parameters=reader.getDefaultReadParam();
                    int step=Math.max(1,Math.max(width,height)/800); parameters.setSourceSubsampling(step,step,0,0);
                    BufferedImage image=reader.read(0,parameters);
                    int w=image.getWidth(),h=image.getHeight(); double sum=0,squared=0,lapSum=0,lapSquared=0; long count=0;
                    for(int y=1;y<h-1;y++) for(int x=1;x<w-1;x++) {
                        double value=gray(image,x,y); sum+=value; squared+=value*value;
                        double lap=gray(image,x-1,y)+gray(image,x+1,y)+gray(image,x,y-1)+gray(image,x,y+1)-4*value;
                        lapSum+=lap; lapSquared+=lap*lap; count++;
                    }
                    image.flush();
                    if(count>0) {
                        double mean=sum/count,contrast=Math.sqrt(Math.max(0,squared/count-mean*mean));
                        double sharpness=lapSquared/count-Math.pow(lapSum/count,2);
                        if(mean<45) issues.add("Photo is too dark. Turn on a light and retake the page without shadows.");
                        if(contrast<12) issues.add("The page is blank or has very faint text. Increase contrast and retake it.");
                        else if(sharpness<15) issues.add("Photo appears blurred. Hold the phone steady, tap to focus on the text, and retake it.");
                    }
                } finally { reader.dispose(); }
            }
            if(issues.isEmpty()) {
                try {
                    var result=ocr.measureImage(bytes); characters=result.characters();
                    if(characters<8) issues.add("OCR could not read enough text. Retake closer, keep all edges visible, remove glare, and make sure the text is in a supported language.");
                    else if(result.meanConfidence()<60 || result.confidentCharacters()<characters*0.6)
                        issues.add("OCR is uncertain about the text. Retake with sharper focus, no glare, and straight page edges; check that the document language is supported.");
                } catch (RuntimeException failure) {
                    throw new IllegalArgumentException("OCR validation is unavailable. Keep this page and check again shortly; contact your administrator if it continues.");
                }
            }
            Check result=new Check(issues.isEmpty(),List.copyOf(issues),width,height,bytes.length,characters);
            long now=System.currentTimeMillis(); cache.entrySet().removeIf(entry -> entry.getValue().expires()<now);
            if(cache.size()>=512) cache.clear();
            cache.put(key,new Cached(result,now+5*60*1000));
            return result;
        } catch(IOException invalidImage) {
            throw new IllegalArgumentException("This photo is damaged or cannot be decoded. Retake it or choose a different JPEG or PNG.");
        } finally { slots.release(); }
    }
}
