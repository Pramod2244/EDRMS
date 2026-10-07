package com.edrms.backend.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.Duration;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class StorageService {

    private final Map<StorageProviderType, StorageProvider> providerMap = new EnumMap<>(StorageProviderType.class);
    private volatile StorageProviderType activeProviderType;

    public StorageService(
        List<StorageProvider> providers,
        @Value("${edrms.storage.active-provider:LOCAL}") String initialProvider
    ) {
        for (StorageProvider p : providers) {
            providerMap.put(p.getProviderType(), p);
        }
        this.activeProviderType = StorageProviderType.valueOf(initialProvider.toUpperCase());
    }

    public StorageProvider getActiveProvider() {
        StorageProvider provider = providerMap.get(activeProviderType);
        if (provider == null) {
            throw new IllegalStateException("No storage provider registered for type: " + activeProviderType);
        }
        return provider;
    }

    public StorageProvider getProvider(StorageProviderType type) {
        StorageProvider provider = providerMap.get(type);
        if (provider == null) {
            throw new IllegalStateException("Storage provider not available: " + type);
        }
        return provider;
    }

    public void setActiveProviderType(StorageProviderType newType) {
        if (!providerMap.containsKey(newType)) {
            throw new IllegalArgumentException("Unsupported storage provider: " + newType);
        }
        this.activeProviderType = newType;
    }

    public StorageProviderType getActiveProviderType() {
        return this.activeProviderType;
    }

    public StorageResult store(InputStream inputStream, String originalFilename, long sizeBytes, String contentType, String folderPath) {
        String cleanFolderPath = (folderPath != null && !folderPath.isBlank()) ? folderPath.trim() : "Repository";
        while (cleanFolderPath.startsWith("/")) cleanFolderPath = cleanFolderPath.substring(1);
        while (cleanFolderPath.endsWith("/")) cleanFolderPath = cleanFolderPath.substring(0, cleanFolderPath.length() - 1);

        String fileKey = String.format("%s/%s_%s",
            cleanFolderPath, UUID.randomUUID(), sanitizeFilename(originalFilename));

        StorageMetadata metadata = StorageMetadata.builder()
            .contentLength(sizeBytes)
            .contentType(contentType)
            .build();

        return getActiveProvider().store(fileKey, inputStream, metadata);
    }

    public StorageResult store(InputStream inputStream, String originalFilename, long sizeBytes, String contentType) {
        return store(inputStream, originalFilename, sizeBytes, contentType, "Repository");
    }

    public InputStream load(StorageProviderType providerType, String key) {
        return getProvider(providerType).load(key);
    }

    public String generateDownloadUrl(StorageProviderType providerType, String key, Duration ttl, String filename) {
        return getProvider(providerType).generatePresignedDownloadUrl(key, ttl, filename);
    }

    private String sanitizeFilename(String filename) {
        if (filename == null) return "document";
        return filename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
