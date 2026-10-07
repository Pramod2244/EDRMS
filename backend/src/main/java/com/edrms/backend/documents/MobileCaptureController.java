package com.edrms.backend.documents;

import com.edrms.backend.folders.FolderRepository;
import com.edrms.backend.roles.RoleCatalogService;
import com.edrms.backend.users.User;
import com.edrms.backend.users.UserRepository;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.io.*;
import java.security.*;
import java.time.OffsetDateTime;
import java.util.*;

@RestController @RequestMapping("/api/v1/mobile-capture")
public class MobileCaptureController {
    private final MobileCaptureLinkRepository links;
    private final FolderRepository folders;
    private final UserRepository users;
    private final RoleCatalogService access;
    private final DocumentService documents;
    private final CaptureQualityService quality;
    private final com.edrms.backend.folders.FolderNumberingService numbering;
    public MobileCaptureController(MobileCaptureLinkRepository links,FolderRepository folders,UserRepository users,RoleCatalogService access,DocumentService documents,CaptureQualityService quality,com.edrms.backend.folders.FolderNumberingService numbering) {
        this.links=links; this.folders=folders; this.users=users; this.access=access; this.documents=documents;
        this.quality=quality;
        this.numbering=numbering;
    }
    public record CreateRequest(UUID folderId) {}
    @PostMapping @Transactional
    public Map<String,Object> create(@RequestBody CreateRequest request) {
        User user=access.requireUser(); checkUpload(user,request.folderId());
        var folder=folders.findById(request.folderId()).filter(f -> !Boolean.TRUE.equals(f.getIsDeleted()))
            .orElseThrow(() -> new IllegalArgumentException("Choose an existing destination folder"));
        byte[] random=new byte[32]; new SecureRandom().nextBytes(random);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        var link=new MobileCaptureLink(); link.setId(UUID.randomUUID()); link.setTokenHash(hash(token));
        link.setFolderId(folder.getId()); link.setOwnerId(user.getId()); link.setStatus("OPEN");
        link.setExpiresAt(OffsetDateTime.now().plusMinutes(15)); links.save(link);
        return Map.of("token",token,"expiresAt",link.getExpiresAt(),"folderName",folder.getName());
    }
    private void checkUpload(User user, UUID folderId) {
        if (folderId==null) throw new IllegalArgumentException("Select a destination folder first");
        if (!"ACTIVE".equals(user.getStatus()) || (user.getExpiresAt()!=null && user.getExpiresAt().isBefore(OffsetDateTime.now())))
            throw new SecurityException("Account is inactive or expired");
        var permissions=RoleCatalogService.split(user.getPermissions());
        if (!"SUPER_ADMIN".equals(user.getRole()) && !permissions.contains("UPLOAD")) throw new SecurityException("Upload permission is required");
        var assigned=RoleCatalogService.split(user.getAssignedFolderIds());
        if (!"SUPER_ADMIN".equals(user.getRole()) && !assigned.isEmpty() && !assigned.contains(folderId.toString()))
            throw new SecurityException("This folder is not assigned to your account");
    }
    @GetMapping("/{token}")
    public Map<String,Object> status(@PathVariable String token) {
        var link=links.findByTokenHash(hash(token)).orElseThrow(() -> new IllegalArgumentException("Capture link is invalid"));
        String status="OPEN".equals(link.getStatus()) && link.getExpiresAt().isBefore(OffsetDateTime.now()) ? "EXPIRED" : link.getStatus();
        Map<String,Object> result=new HashMap<>(); result.put("status",status); result.put("expiresAt",link.getExpiresAt());
        result.put("folderName",folders.findById(link.getFolderId()).map(f -> f.getName()).orElse("Unavailable folder"));
        if("OPEN".equals(status)) result.put("referencePreview",numbering.get(link.getFolderId()).preview());
        if (link.getDocumentId()!=null) result.put("documentId",link.getDocumentId());
        return result;
    }
    @PostMapping(value="/{token}/validate",consumes="multipart/form-data")
    public CaptureQualityService.Check validate(@PathVariable String token,@RequestParam("page") MultipartFile page) throws IOException {
        var link=links.findByTokenHash(hash(token)).orElseThrow(() -> new IllegalArgumentException("Capture link is invalid"));
        if (!"OPEN".equals(link.getStatus()) || link.getExpiresAt().isBefore(OffsetDateTime.now())) throw new SecurityException("Capture link has expired or completed. Generate a new QR code.");
        checkUpload(users.findById(link.getOwnerId()).orElseThrow(() -> new SecurityException("Account unavailable")),link.getFolderId());
        if(page.getSize()>10L*1024*1024) throw new IllegalArgumentException("Photo must be smaller than 10 MB. Choose a smaller photo.");
        return quality.check(hash(token),page.getBytes());
    }
    @PostMapping(value="/{token}/upload",consumes="multipart/form-data") @Transactional
    public Map<String,Object> upload(@PathVariable String token,@RequestParam("pages") List<MultipartFile> pages) throws IOException {
        var link=links.lockByHash(hash(token)).orElseThrow(() -> new IllegalArgumentException("Capture link is invalid"));
        if ("COMPLETED".equals(link.getStatus())) return Map.of("documentId",link.getDocumentId(),"status","COMPLETED");
        if (link.getExpiresAt().isBefore(OffsetDateTime.now())) throw new SecurityException("Capture link has expired. Generate a new QR code.");
        User user=users.findById(link.getOwnerId()).orElseThrow(() -> new SecurityException("Account unavailable"));
        checkUpload(user,link.getFolderId());
        if (folders.findById(link.getFolderId()).filter(f -> !Boolean.TRUE.equals(f.getIsDeleted())).isEmpty())
            throw new IllegalArgumentException("Destination folder is unavailable");
        if (pages.isEmpty() || pages.size()>30) throw new IllegalArgumentException("Capture between 1 and 30 pages per document");
        long total=pages.stream().mapToLong(MultipartFile::getSize).sum();
        if (total>100L*1024*1024) throw new IllegalArgumentException("Captured pages must be smaller than 100 MB in total");
        try (PDDocument pdf=new PDDocument(); ByteArrayOutputStream output=new ByteArrayOutputStream()) {
            int pageNumber=0;
            for (MultipartFile file:pages) {
                pageNumber++;
                if (file.isEmpty() || file.getSize()>10L*1024*1024) throw new IllegalArgumentException("Each page must be smaller than 10 MB");
                byte[] bytes=file.getBytes();
                var check=quality.check(hash(token),bytes);
                if(!check.eligible()) throw new IllegalArgumentException("Page "+pageNumber+": "+String.join(" ",check.issues()));
                // Inspect dimensions before decoding, to reject image decompression bombs.
                try (var imageInput=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                    var readers=ImageIO.getImageReaders(imageInput);
                    if (!readers.hasNext()) throw new IllegalArgumentException("Only JPEG or PNG captured pages are supported");
                    var reader=readers.next();
                    try {
                        reader.setInput(imageInput); String format=reader.getFormatName();
                        if (!(format.equalsIgnoreCase("JPEG") || format.equalsIgnoreCase("PNG"))) throw new IllegalArgumentException("Only JPEG or PNG captured pages are supported");
                        if ((long)reader.getWidth(0)*reader.getHeight(0)>20_000_000) throw new IllegalArgumentException("Page resolution is too large");
                        var image=reader.read(0);
                        var embedded=JPEGFactory.createFromImage(pdf,image,0.9f);
                        float width=595, height=width*image.getHeight()/image.getWidth();
                        var page=new PDPage(new PDRectangle(width,height)); pdf.addPage(page);
                        try (var canvas=new PDPageContentStream(pdf,page)) { canvas.drawImage(embedded,0,0,width,height); }
                        image.flush();
                    } finally { reader.dispose(); }
                }
            }
            pdf.save(output);
            String name="Phone_scan_"+OffsetDateTime.now().toLocalDate()+".pdf";
            var document=documents.uploadDocument(new CapturedPdf(name,output.toByteArray()),link.getFolderId(),user);
            link.setDocumentId(document.getId()); link.setStatus("COMPLETED"); links.save(link);
            return Map.of("documentId",document.getId(),"status","COMPLETED","pdfBytes",output.size(),"referenceId",Objects.toString(document.getReferenceId(),""));
        }
    }
    private String hash(String token) {
        if (token==null || token.length()!=43) throw new IllegalArgumentException("Capture link is invalid");
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private record CapturedPdf(String filename,byte[] bytes) implements MultipartFile {
        public String getName(){return "file";} public String getOriginalFilename(){return filename;}
        public String getContentType(){return "application/pdf";} public boolean isEmpty(){return bytes.length==0;}
        public long getSize(){return bytes.length;} public byte[] getBytes(){return bytes;}
        public InputStream getInputStream(){return new ByteArrayInputStream(bytes);}
        public void transferTo(File destination) throws IOException { java.nio.file.Files.write(destination.toPath(),bytes); }
    }
}
