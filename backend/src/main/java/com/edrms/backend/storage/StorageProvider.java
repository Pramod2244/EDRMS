package com.edrms.backend.storage;

import java.io.InputStream;
import java.time.Duration;

public interface StorageProvider {

    StorageResult store(String key, InputStream inputStream, StorageMetadata metadata);

    InputStream load(String key);

    void delete(String key);

    boolean exists(String key);

    StorageMetadata getMetadata(String key);

    String generatePresignedUploadUrl(String key, Duration ttl, String contentType);

    String generatePresignedDownloadUrl(String key, Duration ttl, String downloadFilename);

    StorageProviderType getProviderType();
}
