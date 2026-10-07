package com.edrms.backend.temporaryaccess;

import com.edrms.backend.documents.Document;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/temporary-access")
public class TemporaryAccessController {

    private final TemporaryAccessService temporaryAccessService;

    public TemporaryAccessController(TemporaryAccessService temporaryAccessService) {
        this.temporaryAccessService = temporaryAccessService;
    }

    @PostMapping("/create")
    public ResponseEntity<GrantResponse> createGrant(@RequestBody CreateGrantRequest request) {
        GrantResponse response = temporaryAccessService.createGrant(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/info/{token}")
    public ResponseEntity<ShareInfoResponse> getShareInfo(@PathVariable String token) {
        ShareInfoResponse info = temporaryAccessService.getShareInfo(token);
        if (!info.isValid() && info.getDocumentName() == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(info);
        }
        return ResponseEntity.ok(info);
    }

    @PostMapping("/unlock/{token}")
    public ResponseEntity<?> unlockShare(
        @PathVariable String token,
        @RequestBody(required = false) UnlockShareRequest request
    ) {
        String password = request != null ? request.getPassword() : null;
        try {
            SharedDocumentViewResponse response = temporaryAccessService.unlockShare(token, password);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/preview/{token}")
    public ResponseEntity<InputStreamResource> getSharedPreview(
        @PathVariable String token,
        @RequestParam(required = false) String password
    ) {
        try {
            InputStream is = temporaryAccessService.getSharedPreviewStream(token, password);
            Document doc = temporaryAccessService.getSharedDocument(token);
            String mimeType = doc != null && doc.getMimeType() != null ? doc.getMimeType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
            String filename = doc != null ? doc.getName() : "document";

            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(mimeType))
                .body(new InputStreamResource(is));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @GetMapping("/download/{token}")
    public ResponseEntity<InputStreamResource> getSharedDownload(
        @PathVariable String token,
        @RequestParam(required = false) String password
    ) {
        try {
            InputStream is = temporaryAccessService.getSharedDownloadStream(token, password);
            Document doc = temporaryAccessService.getSharedDocument(token);
            String mimeType = doc != null && doc.getMimeType() != null ? doc.getMimeType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
            String filename = doc != null ? doc.getName() : "document";

            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(mimeType))
                .body(new InputStreamResource(is));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @GetMapping("/verify/{token}")
    public ResponseEntity<ShareInfoResponse> verifyToken(@PathVariable String token) {
        ShareInfoResponse info = temporaryAccessService.getShareInfo(token);
        if (!info.isValid()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(info);
    }
}
