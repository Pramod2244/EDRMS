package com.edrms.backend.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.*;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;

@Component
public class LocalStorageProvider implements StorageProvider {

    private volatile Path rootPath;

    public LocalStorageProvider(@Value("${edrms.storage.local.root-path:/var/data/edrms/storage}") String rootDir) {
        reconfigure(rootDir);
    }

    public synchronized void reconfigure(String rootDir) {
        if (rootDir == null || rootDir.isBlank()) {
            rootDir = "./data/storage";
        }
        this.rootPath = Paths.get(rootDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootPath);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to create local storage root: " + this.rootPath, e);
        }
    }

    public String getRootPathString() {
        return this.rootPath != null ? this.rootPath.toString() : "./data/storage";
    }

    @Override
    public StorageResult store(String key, InputStream inputStream, StorageMetadata metadata) {
        Path targetPath = resolveAndValidate(key);
        try {
            Files.createDirectories(targetPath.getParent());
            Path tempPath = Files.createTempFile(targetPath.getParent(), "upload-", ".tmp");

            MessageDigest md = MessageDigest.getInstance("SHA-256");
            long bytesWritten;
            try (DigestInputStream dis = new DigestInputStream(inputStream, md);
                 OutputStream os = Files.newOutputStream(tempPath)) {
                bytesWritten = dis.transferTo(os);
            }

            String calculatedChecksum = HexFormat.of().formatHex(md.digest());
            Files.move(tempPath, targetPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);

            return StorageResult.builder()
                .storageKey(key)
                .providerType(StorageProviderType.LOCAL)
                .sizeBytes(bytesWritten)
                .checksumSha256(calculatedChecksum)
                .locationUri(targetPath.toUri().toString())
                .build();
        } catch (Exception e) {
            throw new RuntimeException("Failed to store file in local storage key: " + key, e);
        }
    }

    @Override
    public InputStream load(String key) {
        Path targetPath = resolveAndValidate(key);
        if (!Files.exists(targetPath)) {
            throw new RuntimeException("File not found in local storage: " + key);
        }
        try {
            return Files.newInputStream(targetPath);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void delete(String key) {
        Path targetPath = resolveAndValidate(key);
        try {
            Files.deleteIfExists(targetPath);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
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
        // Local server falls back to direct API upload endpoint
        return "/api/v1/documents/upload";
    }

    @Override
    public String generatePresignedDownloadUrl(String key, Duration ttl, String downloadFilename) {
        return "/api/v1/documents/stream?key=" + key;
    }

    @Override
    public StorageProviderType getProviderType() {
        return StorageProviderType.LOCAL;
    }

    private Path resolveAndValidate(String key) {
        Path target = this.rootPath.resolve(key).normalize();
        if (!target.startsWith(this.rootPath)) {
            throw new SecurityException("Path Traversal detected for key: " + key);
        }
        return target;
    }
}
