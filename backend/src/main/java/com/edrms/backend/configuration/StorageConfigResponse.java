package com.edrms.backend.configuration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageConfigResponse {
    private String providerType;
    private String localRootPath;
    private String nasRootPath;
    private String s3BucketName;
    private String s3Region;
    private String s3AccessKey;
    private boolean s3SecretConfigured;
    private String s3Endpoint;
}
