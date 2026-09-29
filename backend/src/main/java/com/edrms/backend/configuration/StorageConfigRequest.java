package com.edrms.backend.configuration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageConfigRequest {
    private String providerType; // "LOCAL", "NAS", or "S3"
    private String localRootPath;
    private String nasRootPath;
    private String s3BucketName;
    private String s3Region;
    private String s3AccessKey;
    private String s3SecretKey;
    private String s3Endpoint;
}
