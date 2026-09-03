package com.edrms.backend.documents;

import com.edrms.backend.users.User;
import com.edrms.backend.users.UserService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final UserService userService;

    public DocumentController(DocumentService documentService, UserService userService) {
        this.documentService = documentService;
        this.userService = userService;
    }

    @GetMapping("/folder/{folderId}")
    public ResponseEntity<Page<Document>> getDocumentsByFolder(
        @PathVariable UUID folderId,
        Pageable pageable
    ) {
        return ResponseEntity.ok(documentService.getDocumentsInFolder(folderId, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Document> getDocumentById(@PathVariable UUID id) {
        return documentService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Document> uploadDocument(
        @RequestParam("file") MultipartFile file,
        @RequestParam("folderId") UUID folderId
    ) throws IOException {
        User user = userService.syncCurrentUser();
        Document document = documentService.uploadDocument(file, folderId, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(document);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<InputStreamResource> downloadDocument(@PathVariable UUID id) {
        Document doc = documentService.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));

        InputStream is = documentService.getDocumentBinaryStream(doc);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getName() + "\"")
            .contentType(MediaType.parseMediaType(doc.getMimeType()))
            .body(new InputStreamResource(is));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable UUID id) {
        documentService.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }
}
