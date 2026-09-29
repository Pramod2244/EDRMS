package com.edrms.backend.documents;

import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class FileValidationService {

    private static final Logger log = LoggerFactory.getLogger(FileValidationService.class);

    private final Tika tika = new Tika();
    private final DocumentRepository documentRepository;
    private final MalwareScanner malwareScanner;

    @Value("${edrms.pipeline.max-file-size-bytes:104857600}")
    private long maxFileSizeBytes = 104857600L;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
        "pdf", "txt", "csv", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        "jpg", "jpeg", "png", "tiff", "tif"
    );

    private static final Pattern SUSPICIOUS_FILENAME_PATTERN = Pattern.compile(".*[/\\\\:*?\"<>|\\x00-\\x1F].*");

    public FileValidationService(DocumentRepository documentRepository, MalwareScanner malwareScanner) {
        this.documentRepository = documentRepository;
        this.malwareScanner = malwareScanner;
    }

    public FileValidationResult validateAndInspect(MultipartFile file) throws IOException {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            throw new IllegalArgumentException("Filename cannot be empty");
        }

        // 1. Path traversal & filename sanitization
        String sanitizedFilename = sanitizeFilename(originalFilename);

        // 2. Extension validation
        String extension = extractExtension(sanitizedFilename);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("File extension ." + extension + " is not permitted in repository");
        }

        // 3. Maximum size check
        if (file.getSize() > maxFileSizeBytes) {
            throw new IllegalArgumentException("File size (" + file.getSize() + " bytes) exceeds maximum limit of " + maxFileSizeBytes + " bytes");
        }

        // 4. MIME validation & signature detection via Apache Tika
        String detectedMimeType;
        try (InputStream is = file.getInputStream()) {
            detectedMimeType = tika.detect(is, sanitizedFilename);
        }

        validateMimeMatchesExtension(extension, detectedMimeType);

        // 5. Compute SHA-256 checksum
        String checksumSha256 = calculateSha256(file);

        // 6. Duplicate hash check
        boolean isDuplicate = documentRepository.existsByChecksumSha256AndIsDeletedFalse(checksumSha256);
        if (isDuplicate) {
            log.info("Duplicate document detected with SHA-256 checksum: {}", checksumSha256);
        }

        // 7. Malware scanning
        boolean isClean;
        try (InputStream is = file.getInputStream()) {
            isClean = malwareScanner.scan(is, sanitizedFilename);
        }

        if (!isClean) {
            throw new SecurityException("Security check failed: malware or disallowed executable signature detected in " + sanitizedFilename);
        }

        return FileValidationResult.builder()
            .sanitizedFilename(sanitizedFilename)
            .extension(extension)
            .detectedMimeType(detectedMimeType)
            .sizeBytes(file.getSize())
            .checksumSha256(checksumSha256)
            .isDuplicate(isDuplicate)
            .build();
    }

    public String sanitizeFilename(String filename) {
        // Strip path traversal attempts
        String baseName = Paths.get(filename).getFileName().toString();
        // Remove null bytes and control chars
        String cleaned = baseName.replaceAll("[\\x00-\\x1F]", "").trim();
        if (cleaned.isBlank() || cleaned.equals(".") || cleaned.equals("..")) {
            return "unnamed_document_" + System.currentTimeMillis();
        }
        return cleaned;
    }

    private String extractExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex <= 0 || dotIndex == filename.length() - 1) {
            return "";
        }
        return filename.substring(dotIndex + 1).toLowerCase();
    }

    private void validateMimeMatchesExtension(String extension, String detectedMime) {
        log.debug("Validating extension: {} against detected MIME: {}", extension, detectedMime);

        // Rejection for dangerous executable formats disguised as documents
        if (detectedMime.startsWith("application/x-dosexec") ||
            detectedMime.startsWith("application/x-executable") ||
            detectedMime.startsWith("application/x-sharedlib")) {
            throw new SecurityException("Disallowed executable binary detected");
        }

        // Logical compatibility checks
        if (extension.equals("pdf") && !detectedMime.contains("pdf")) {
            throw new IllegalArgumentException("File content does not match standard PDF specification");
        }
    }

    private String calculateSha256(MultipartFile file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream is = file.getInputStream();
                 DigestInputStream dis = new DigestInputStream(is, digest)) {
                byte[] buffer = new byte[8192];
                while (dis.read(buffer) != -1) {
                    // read to end
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
