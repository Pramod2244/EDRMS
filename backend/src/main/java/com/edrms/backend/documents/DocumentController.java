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
import java.util.List;
import java.util.UUID;

import com.edrms.backend.audit.AuditAction;
import com.edrms.backend.audit.AuditService;
import com.edrms.backend.auth.CurrentUserContext;
import com.edrms.backend.folders.Folder;
import com.edrms.backend.folders.FolderRepository;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final UserService userService;
    private final FolderRepository folderRepository;
    private final AuditService auditService;
    private final CurrentUserContext currentUserContext;

    public DocumentController(
        DocumentService documentService,
        UserService userService,
        FolderRepository folderRepository,
        AuditService auditService,
        CurrentUserContext currentUserContext
    ) {
        this.documentService = documentService;
        this.userService = userService;
        this.folderRepository = folderRepository;
        this.auditService = auditService;
        this.currentUserContext = currentUserContext;
    }

    @GetMapping
    public ResponseEntity<List<Document>> getAllDocuments() {
        return ResponseEntity.ok(documentService.getAllDocuments());
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

    @GetMapping("/{id}/status")
    public ResponseEntity<DocumentStatusResponse> getDocumentStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(documentService.getDocumentStatus(id));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Document> uploadDocument(
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "folderId", required = false) String folderId,
        @RequestParam(value = "actor", required = false) String actorParam,
        @RequestHeader(value = "X-Actor-Username", required = false) String actorHeader,
        HttpServletRequest httpRequest
    ) throws IOException {
        UUID resolvedFolderId = resolveFolderId(folderId);

        String actor = (actorParam != null && !actorParam.isBlank())
            ? actorParam.trim()
            : (actorHeader != null && !actorHeader.isBlank())
                ? actorHeader.trim()
                : currentUserContext.getCurrentUsername().orElse("admin");

        if (actor.contains(",")) {
            actor = actor.split(",")[0].trim();
        }

        User user = userService.syncUserByUsername(actor);
        Document document = documentService.uploadDocument(file, resolvedFolderId, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(document);
    }

    private UUID resolveFolderId(String folderIdStr) {
        if (folderIdStr != null && !folderIdStr.isBlank() && !folderIdStr.equalsIgnoreCase("root") && !folderIdStr.equalsIgnoreCase("null")) {
            try {
                UUID parsed = UUID.fromString(folderIdStr.trim());
                if (folderRepository.existsById(parsed)) {
                    return parsed;
                }
            } catch (IllegalArgumentException ignored) {
                // Ignore non-UUID strings (e.g. legacy numeric ids from browser cache)
            }
        }
        return folderRepository.findByParentIdIsNullAndIsDeletedFalse().stream()
            .findFirst()
            .map(Folder::getId)
            .orElseGet(() -> folderRepository.findByIsDeletedFalse().stream()
                .findFirst()
                .map(Folder::getId)
                .orElseGet(() -> {
                    User user = userService.syncUserByUsername("admin");
                    Folder defaultFolder = folderRepository.save(Folder.builder()
                        .name("General Documents")
                        .parentId(null)
                        .materializedPath("/")
                        .depth(0)
                        .ownerId(user.getId())
                        .isDeleted(false)
                        .build());
                    return defaultFolder.getId();
                }));
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<InputStreamResource> previewDocument(
        @PathVariable UUID id,
        @RequestParam(value = "actor", required = false) String actorParam,
        HttpServletRequest httpRequest
    ) {
        Document doc = documentService.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));

        String actor = (actorParam != null && !actorParam.isBlank()) ? actorParam : currentUserContext.getCurrentUsername().orElse("viewer");
        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) ip = httpRequest.getRemoteAddr();
        if (ip == null || ip.isBlank()) ip = "127.0.0.1";

        auditService.recordAction(
            UUID.randomUUID().toString(),
            null,
            actor,
            ip,
            httpRequest.getHeader("User-Agent"),
            AuditAction.VIEW,
            "DOCUMENT",
            doc.getId().toString(),
            "SUCCESS",
            String.format("{\"documentName\":\"%s\",\"action\":\"PREVIEW\"}", doc.getName().replace("\"", "\\\""))
        );

        InputStream is = documentService.getDocumentPreviewStream(doc);
        String contentType = doc.getMimeType();
        String ext = (doc.getExtension() != null ? doc.getExtension() : "").toLowerCase();
        if (ext.equals("pdf") || (doc.getName() != null && doc.getName().toLowerCase().endsWith(".pdf"))) {
            contentType = MediaType.APPLICATION_PDF_VALUE;
        } else if (ext.equals("png")) {
            contentType = MediaType.IMAGE_PNG_VALUE;
        } else if (ext.equals("jpg") || ext.equals("jpeg")) {
            contentType = MediaType.IMAGE_JPEG_VALUE;
        } else if (ext.equals("docx")) {
            contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if (ext.equals("txt") || ext.equals("csv") || ext.equals("log") || ext.equals("json") || ext.equals("md")) {
            contentType = MediaType.TEXT_PLAIN_VALUE;
        } else if (contentType == null || (!contentType.contains("pdf") && !contentType.startsWith("image/"))) {
            contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + doc.getName() + "\"")
            .contentType(MediaType.parseMediaType(contentType))
            .body(new InputStreamResource(is));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<InputStreamResource> downloadDocument(
        @PathVariable UUID id,
        @RequestParam(value = "actor", required = false) String actorParam,
        HttpServletRequest httpRequest
    ) {
        Document doc = documentService.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));

        String actor = (actorParam != null && !actorParam.isBlank()) ? actorParam : currentUserContext.getCurrentUsername().orElse("downloader");
        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) ip = httpRequest.getRemoteAddr();
        if (ip == null || ip.isBlank()) ip = "127.0.0.1";

        auditService.recordAction(
            UUID.randomUUID().toString(),
            null,
            actor,
            ip,
            httpRequest.getHeader("User-Agent"),
            AuditAction.DOWNLOAD,
            "DOCUMENT",
            doc.getId().toString(),
            "SUCCESS",
            String.format("{\"documentName\":\"%s\",\"action\":\"DOWNLOAD\"}", doc.getName().replace("\"", "\\\""))
        );

        InputStream is = documentService.getDocumentBinaryStream(doc);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + doc.getName() + "\"")
            .contentType(MediaType.parseMediaType(doc.getMimeType()))
            .body(new InputStreamResource(is));
    }

    @GetMapping("/{id}/pages")
    public ResponseEntity<List<DocumentPage>> getDocumentPages(@PathVariable UUID id) {
        return ResponseEntity.ok(documentService.getDocumentPages(id));
    }

    @GetMapping("/{id}/pages/{pageNumber}/thumbnail")
    public ResponseEntity<InputStreamResource> getPageThumbnail(
        @PathVariable UUID id,
        @PathVariable int pageNumber
    ) {
        Document doc = documentService.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));

        InputStream is = documentService.getPageThumbnailStream(doc, pageNumber);
        if (is == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"thumbnail_" + id + "_p" + pageNumber + ".png\"")
            .contentType(MediaType.IMAGE_PNG)
            .body(new InputStreamResource(is));
    }

    @GetMapping("/{id}/assets")
    public ResponseEntity<List<DocumentAsset>> getDocumentAssets(@PathVariable UUID id) {
        return ResponseEntity.ok(documentService.getDocumentAssets(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(
        @PathVariable UUID id,
        @RequestParam(value = "actor", required = false) String actorParam,
        HttpServletRequest httpRequest
    ) {
        Document doc = documentService.findById(id).orElse(null);
        String docName = doc != null ? doc.getName() : id.toString();
        String actor = (actorParam != null && !actorParam.isBlank()) ? actorParam : currentUserContext.getCurrentUsername().orElse("admin");
        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank()) {
            ip = ip.split(",")[0].trim();
        } else {
            ip = httpRequest.getRemoteAddr();
        }
        if (ip == null || ip.isBlank() || ip.equals("0:0:0:0:0:0:0:1")) ip = "127.0.0.1";

        auditService.recordAction(
            UUID.randomUUID().toString(),
            null,
            actor,
            ip,
            httpRequest.getHeader("User-Agent"),
            AuditAction.DELETE,
            "DOCUMENT",
            id.toString(),
            "SUCCESS",
            String.format("{\"documentName\":\"%s\",\"action\":\"DELETE\"}", docName.replace("\"", "\\\""))
        );

        documentService.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/pages/{pageNumber}")
    public ResponseEntity<List<DocumentPage>> deleteDocumentPage(
        @PathVariable UUID id,
        @PathVariable int pageNumber,
        @RequestParam(value = "actor", required = false) String actorParam,
        HttpServletRequest httpRequest
    ) throws IOException {
        Document doc = documentService.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + id));

        String actor = (actorParam != null && !actorParam.isBlank())
            ? actorParam
            : currentUserContext.getCurrentUsername().orElse("admin");

        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank()) {
            ip = ip.split(",")[0].trim();
        } else {
            ip = httpRequest.getRemoteAddr();
        }
        if (ip == null || ip.isBlank() || ip.equals("0:0:0:0:0:0:0:1")) ip = "127.0.0.1";

        List<DocumentPage> updatedPages = documentService.deleteDocumentPage(id, pageNumber, actor);

        auditService.recordAction(
            UUID.randomUUID().toString(),
            null,
            actor,
            ip,
            httpRequest.getHeader("User-Agent"),
            AuditAction.DELETE,
            "DOCUMENT_PAGE",
            id + "#p" + pageNumber,
            "SUCCESS",
            String.format("{\"documentName\":\"%s\",\"action\":\"DELETE_PAGE\",\"pageNumber\":%d,\"remainingPages\":%d}",
                doc.getName().replace("\"", "\\\""), pageNumber, updatedPages.size())
        );

        return ResponseEntity.ok(updatedPages);
    }

}
