package com.edrms.backend.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.*;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;

@Component
public class NasStorageProvider implements StorageProvider {

    private static final Logger log = LoggerFactory.getLogger(NasStorageProvider.class);

    private volatile Path rootPath;

    public NasStorageProvider(@Value("${edrms.storage.nas.root-path:/Volumes/NAS/edms_storage}") String rootDir) {
        reconfigure(rootDir);
    }

    public synchronized void reconfigure(String rootDir) {
        if (rootDir == null || rootDir.isBlank()) {
            rootDir = "./data/nas_storage";
        }
        this.rootPath = Paths.get(rootDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootPath);
            log.info("NAS Storage Provider initialized at path: {}", this.rootPath);
        } catch (IOException e) {
            log.warn("Could not create NAS storage directory at {} (will retry when mounted): {}", this.rootPath, e.getMessage());
        }
    }

    public String getRootPathString() {
        return this.rootPath != null ? this.rootPath.toString() : "./data/nas_storage";
    }

    @Override
    public StorageResult store(String key, InputStream inputStream, StorageMetadata metadata) {
        Path targetPath = resolveAndValidate(key);
        try {
            if (targetPath.getParent() != null) {
                Files.createDirectories(targetPath.getParent());
            }

            Path tempPath = Files.createTempFile(targetPath.getParent(), "nas-upload-", ".tmp");
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            long bytesWritten;

            try (DigestInputStream dis = new DigestInputStream(inputStream, md);
                 OutputStream os = Files.newOutputStream(tempPath)) {
                bytesWritten = dis.transferTo(os);
            }

            String calculatedChecksum = HexFormat.of().formatHex(md.digest());
            Files.move(tempPath, targetPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);

            log.info("Saved file to External NAS Box at: {}", targetPath);

            return StorageResult.builder()
                .storageKey(key)
                .providerType(StorageProviderType.NAS)
                .sizeBytes(bytesWritten)
                .checksumSha256(calculatedChecksum)
                .locationUri(targetPath.toUri().toString())
                .build();
        } catch (Exception e) {
            throw new RuntimeException("Failed to store file in NAS storage key: " + key + " (path: " + targetPath + ")", e);
        }
    }

    @Override
    public InputStream load(String key) {
        Path targetPath = resolveAndValidate(key);
        if (!Files.exists(targetPath)) {
            throw new RuntimeException("File not found in External NAS Box storage: " + key + " at path " + targetPath);
        }
        try {
            return new BufferedInputStream(Files.newInputStream(targetPath));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read file from NAS box: " + key, e);
        }
    }

    @Override
    public void delete(String key) {
        Path targetPath = resolveAndValidate(key);
        try {
            Files.deleteIfExists(targetPath);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to delete file from NAS box: " + key, e);
        }
    }

    @Override
    public boolean exists(String key) {
        return Files.exists(resolveAndValidate(key));
    }

    @Override
    public StorageMetadata getMetadata(String key) {
        Path targetPath = resolveAndValidate(key);
        try {
            long size = Files.size(targetPath);
            String contentType = Files.probeContentType(targetPath);
            return StorageMetadata.builder()
                .contentLength(size)
                .contentType(contentType != null ? contentType : "application/octet-stream")
                .build();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public String generatePresignedUploadUrl(String key, Duration ttl, String contentType) {
        return "/api/v1/documents/upload";
    }

    @Override
    public String generatePresignedDownloadUrl(String key, Duration ttl, String downloadFilename) {
        return "/api/v1/documents/stream?key=" + key;
    }

    @Override
    public StorageProviderType getProviderType() {
        return StorageProviderType.NAS;
    }

    private Path resolveAndValidate(String key) {
        Path target = this.rootPath.resolve(key).normalize();
        if (!target.startsWith(this.rootPath)) {
            throw new SecurityException("Path Traversal detected for NAS storage key: " + key);
        }
        return target;
    }
}
