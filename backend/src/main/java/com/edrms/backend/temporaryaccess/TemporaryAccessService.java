package com.edrms.backend.temporaryaccess;

import com.edrms.backend.documents.Document;
import com.edrms.backend.documents.DocumentRepository;
import com.edrms.backend.documents.DocumentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class TemporaryAccessService {

    private static final Logger log = LoggerFactory.getLogger(TemporaryAccessService.class);
    private static final UUID SYSTEM_USER_ID = UUID.fromString("be9f4073-f622-46ec-854e-e422e30ddbeb");

    private final TemporaryAccessRepository repository;
    private final DocumentRepository documentRepository;
    private final DocumentService documentService;

    public TemporaryAccessService(
        TemporaryAccessRepository repository,
        DocumentRepository documentRepository,
        DocumentService documentService
    ) {
        this.repository = repository;
        this.documentRepository = documentRepository;
        this.documentService = documentService;
    }

    @Transactional
    public GrantResponse createGrant(CreateGrantRequest req) {
        Document doc = documentRepository.findById(req.getDocumentId())
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + req.getDocumentId()));

        if (Boolean.TRUE.equals(doc.getIsDeleted())) {
            throw new IllegalArgumentException("Cannot share deleted document");
        }

        // Calculate validUntil
        OffsetDateTime validUntil = OffsetDateTime.now().plusHours(24);
        if ("1h".equalsIgnoreCase(req.getDuration())) {
            validUntil = OffsetDateTime.now().plusHours(1);
        } else if ("24h".equalsIgnoreCase(req.getDuration())) {
            validUntil = OffsetDateTime.now().plusHours(24);
        } else if ("7d".equalsIgnoreCase(req.getDuration())) {
            validUntil = OffsetDateTime.now().plusDays(7);
        } else if ("30d".equalsIgnoreCase(req.getDuration())) {
            validUntil = OffsetDateTime.now().plusDays(30);
        }

        // Parse maxViews
        Integer maxViews = 5;
        if (req.getMaxViews() != null) {
            if ("unlimited".equalsIgnoreCase(req.getMaxViews())) {
                maxViews = null;
            } else {
                try {
                    maxViews = Integer.parseInt(req.getMaxViews());
                } catch (NumberFormatException ignored) {
                    maxViews = 5;
                }
            }
        }

        // Build permissionsMask based on sharer configuration
        List<String> perms = new ArrayList<>();
        perms.add("VIEW");
        if (Boolean.TRUE.equals(req.getAllowDownload())) {
            perms.add("DOWNLOAD");
        }
        if (Boolean.TRUE.equals(req.getAllowPrint())) {
            perms.add("PRINT");
        }
        String permissionsMask = String.join(",", perms);

        String passwordHash = hashPassword(req.getPassword());
        String rawToken = "tok_" + UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String tokenHash = hashToken(rawToken);

        TemporaryAccessGrant grant = TemporaryAccessGrant.builder()
            .tokenHash(tokenHash)
            .targetType("DOCUMENT")
            .targetId(doc.getId())
            .permissionsMask(permissionsMask)
            .validFrom(OffsetDateTime.now())
            .validUntil(validUntil)
            .maxViews(maxViews)
            .viewCount(0)
            .isRevoked(false)
            .passwordHash(passwordHash)
            .createdBy(SYSTEM_USER_ID)
            .build();

        repository.save(grant);

        return GrantResponse.builder()
            .token(rawToken)
            .documentId(doc.getId())
            .documentName(doc.getName())
            .validUntil(validUntil)
            .maxViews(maxViews)
            .requiresPassword(passwordHash != null)
            .canDownload(perms.contains("DOWNLOAD"))
            .canPrint(perms.contains("PRINT"))
            .build();
    }

    public ShareInfoResponse getShareInfo(String rawToken) {
        ResolvedGrant resolved = resolveGrant(rawToken);
        if (resolved == null) {
            return ShareInfoResponse.builder()
                .valid(false)
                .errorMessage("Invalid or non-existent share link")
                .build();
        }

        if (resolved.isExpired()) {
            return ShareInfoResponse.builder()
                .valid(false)
                .documentName(resolved.getDocument().getName())
                .errorMessage("This temporary share link has expired")
                .build();
        }

        if (resolved.isExhausted()) {
            return ShareInfoResponse.builder()
                .valid(false)
                .documentName(resolved.getDocument().getName())
                .errorMessage("The maximum view limit for this share link has been reached")
                .build();
        }

        Document doc = resolved.getDocument();
        Integer remaining = resolved.getGrant() != null && resolved.getGrant().getMaxViews() != null
            ? Math.max(0, resolved.getGrant().getMaxViews() - resolved.getGrant().getViewCount())
            : null;

        return ShareInfoResponse.builder()
            .valid(true)
            .requiresPassword(resolved.requiresPassword())
            .canDownload(resolved.canDownload())
            .canPrint(resolved.canPrint())
            .documentId(doc.getId())
            .documentName(doc.getName())
            .mimeType(doc.getMimeType())
            .fileSizeBytes(doc.getFileSizeBytes())
            .validUntil(resolved.getValidUntil())
            .remainingViews(remaining)
            .build();
    }

    @Transactional
    public SharedDocumentViewResponse unlockShare(String rawToken, String password) {
        ResolvedGrant resolved = resolveGrant(rawToken);
        if (resolved == null) {
            throw new IllegalArgumentException("Invalid or non-existent share link");
        }

        if (resolved.isExpired()) {
            throw new IllegalArgumentException("This temporary share link has expired");
        }

        if (resolved.isExhausted()) {
            throw new IllegalArgumentException("Maximum view limit reached for this document link");
        }

        if (resolved.requiresPassword()) {
            if (!resolved.verifyPassword(password)) {
                throw new IllegalArgumentException("Invalid passcode. Please enter the correct passcode.");
            }
        }

        // Consume view
        if (resolved.getGrant() != null) {
            TemporaryAccessGrant grant = resolved.getGrant();
            grant.setViewCount(grant.getViewCount() + 1);
            repository.save(grant);
        }

        Document doc = resolved.getDocument();
        Integer remaining = resolved.getGrant() != null && resolved.getGrant().getMaxViews() != null
            ? Math.max(0, resolved.getGrant().getMaxViews() - (resolved.getGrant().getViewCount()))
            : null;

        String pwdParam = password != null && !password.isBlank() ? "?password=" + password.trim() : "";

        return SharedDocumentViewResponse.builder()
            .documentId(doc.getId())
            .name(doc.getName())
            .mimeType(doc.getMimeType())
            .extension(doc.getExtension())
            .fileSizeBytes(doc.getFileSizeBytes())
            .pageCount(doc.getPageCount() != null ? doc.getPageCount() : 1)
            .previewUrl("/api/temporary-access/preview/" + rawToken + pwdParam)
            .downloadUrl("/api/temporary-access/download/" + rawToken + pwdParam)
            .remainingViews(remaining)
            .canDownload(resolved.canDownload())
            .canPrint(resolved.canPrint())
            .build();
    }

    public InputStream getSharedPreviewStream(String rawToken, String password) {
        ResolvedGrant resolved = resolveGrant(rawToken);
        if (resolved == null || resolved.isExpired() || resolved.isExhausted()) {
            throw new IllegalArgumentException("Unauthorized or expired share token");
        }
        if (resolved.requiresPassword() && !resolved.verifyPassword(password)) {
            throw new IllegalArgumentException("Passcode required for preview access");
        }
        return documentService.getDocumentPreviewStream(resolved.getDocument());
    }

    public InputStream getSharedDownloadStream(String rawToken, String password) {
        ResolvedGrant resolved = resolveGrant(rawToken);
        if (resolved == null || resolved.isExpired() || resolved.isExhausted()) {
            throw new IllegalArgumentException("Unauthorized or expired share token");
        }
        if (resolved.requiresPassword() && !resolved.verifyPassword(password)) {
            throw new IllegalArgumentException("Passcode required for download access");
        }
        if (!resolved.canDownload()) {
            throw new IllegalArgumentException("Download permission was not authorized by the document sender");
        }
        return documentService.getDocumentBinaryStream(resolved.getDocument());
    }

    public Document getSharedDocument(String rawToken) {
        ResolvedGrant resolved = resolveGrant(rawToken);
        return resolved != null ? resolved.getDocument() : null;
    }

    private ResolvedGrant resolveGrant(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return null;

        // 1. Standard Token Hash lookup in database
        String tokenHash = hashToken(rawToken);
        Optional<TemporaryAccessGrant> grantOpt = repository.findByTokenHashAndIsRevokedFalse(tokenHash);
        if (grantOpt.isPresent()) {
            TemporaryAccessGrant g = grantOpt.get();
            Document doc = documentRepository.findById(g.getTargetId()).orElse(null);
            if (doc != null && !Boolean.TRUE.equals(doc.getIsDeleted())) {
                return new ResolvedGrant(g, doc, false);
            }
        }

        // 2. Legacy/Client formatted token: token_<uuidHex>_<expiry>
        if (rawToken.startsWith("token_")) {
            try {
                String payload = rawToken.substring(6);
                String hex = payload;
                if (payload.contains("_")) {
                    hex = payload.substring(0, payload.indexOf('_'));
                }
                if (hex.length() == 32) {
                    String uuidStr = hex.substring(0, 8) + "-" +
                        hex.substring(8, 12) + "-" +
                        hex.substring(12, 16) + "-" +
                        hex.substring(16, 20) + "-" +
                        hex.substring(20, 32);
                    UUID docId = UUID.fromString(uuidStr);
                    Document doc = documentRepository.findById(docId).orElse(null);
                    if (doc != null && !Boolean.TRUE.equals(doc.getIsDeleted())) {
                        return new ResolvedGrant(null, doc, true);
                    }
                }
            } catch (Exception e) {
                log.debug("Could not parse legacy token: {}", e.getMessage());
            }
        }

        return null;
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    private String hashPassword(String password) {
        if (password == null || password.isBlank()) return null;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(password.trim().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    private static class ResolvedGrant {
        private final TemporaryAccessGrant grant;
        private final Document document;
        private final boolean isLegacy;

        public ResolvedGrant(TemporaryAccessGrant grant, Document document, boolean isLegacy) {
            this.grant = grant;
            this.document = document;
            this.isLegacy = isLegacy;
        }

        public TemporaryAccessGrant getGrant() { return grant; }
        public Document getDocument() { return document; }

        public boolean isExpired() {
            if (isLegacy) return false;
            return OffsetDateTime.now().isAfter(grant.getValidUntil());
        }

        public boolean isExhausted() {
            if (isLegacy || grant.getMaxViews() == null) return false;
            return grant.getViewCount() >= grant.getMaxViews();
        }

        public boolean requiresPassword() {
            if (isLegacy) return false;
            return grant.getPasswordHash() != null && !grant.getPasswordHash().isBlank();
        }

        public boolean verifyPassword(String rawPassword) {
            if (isLegacy) return true;
            if (grant.getPasswordHash() == null) return true;
            if (rawPassword == null) return false;
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] digest = md.digest(rawPassword.trim().getBytes(StandardCharsets.UTF_8));
                String hash = HexFormat.of().formatHex(digest);
                return hash.equalsIgnoreCase(grant.getPasswordHash());
            } catch (Exception e) {
                return false;
            }
        }

        public boolean canDownload() {
            if (isLegacy) return true;
            if (grant == null || grant.getPermissionsMask() == null) return false;
            return grant.getPermissionsMask().contains("DOWNLOAD");
        }

        public boolean canPrint() {
            if (isLegacy) return true;
            if (grant == null || grant.getPermissionsMask() == null) return false;
            return grant.getPermissionsMask().contains("PRINT");
        }

        public OffsetDateTime getValidUntil() {
            return grant != null ? grant.getValidUntil() : OffsetDateTime.now().plusHours(24);
        }
    }
}
