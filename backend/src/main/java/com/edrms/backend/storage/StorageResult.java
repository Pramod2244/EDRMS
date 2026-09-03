package com.edrms.backend.storage;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageResult {
    private String storageKey;
    private StorageProviderType providerType;
    private long sizeBytes;
    private String checksumSha256;
    private String locationUri;
}
