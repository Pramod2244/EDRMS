package com.edrms.backend.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.InputStream;
import java.net.URI;
import java.time.Duration;

@Component
public class S3StorageProvider implements StorageProvider {

    private volatile String bucketName;
    private volatile String regionStr;
    private volatile String accessKey;
    private volatile String secretKey;
    private volatile String endpoint;
    private volatile S3Client s3Client;
    private volatile S3Presigner s3Presigner;

    public S3StorageProvider(
        @Value("${edrms.storage.s3.bucket-name:edrms-documents-bucket}") String bucketName,
        @Value("${edrms.storage.s3.region:us-east-1}") String regionStr,
        @Value("${edrms.storage.s3.access-key:}") String accessKey,
        @Value("${edrms.storage.s3.secret-key:}") String secretKey,
        @Value("${edrms.storage.s3.endpoint:}") String endpoint
    ) {
        reconfigure(bucketName, regionStr, accessKey, secretKey, endpoint);
    }

    public synchronized void reconfigure(
        String bucketName,
        String regionStr,
        String accessKey,
        String secretKey,
        String endpoint
    ) {
        this.bucketName = (bucketName != null && !bucketName.isBlank()) ? bucketName.trim() : "edrms-documents-bucket";
        this.regionStr = (regionStr != null && !regionStr.isBlank()) ? regionStr.trim() : "us-east-1";
        this.accessKey = accessKey != null ? accessKey.trim() : "";
        this.secretKey = secretKey != null ? secretKey.trim() : "";
        this.endpoint = endpoint != null ? endpoint.trim() : "";

        Region region = Region.of(this.regionStr);
        S3ClientBuilder clientBuilder = S3Client.builder().region(region);
        software.amazon.awssdk.services.s3.presigner.S3Presigner.Builder presignerBuilder =
            S3Presigner.builder().region(region);

        if (!this.accessKey.isBlank() && !this.secretKey.isBlank()) {
            StaticCredentialsProvider creds = StaticCredentialsProvider.create(
                AwsBasicCredentials.create(this.accessKey, this.secretKey)
            );
            clientBuilder.credentialsProvider(creds);
            presignerBuilder.credentialsProvider(creds);
        }

        if (!this.endpoint.isBlank()) {
            URI endpointUri = URI.create(this.endpoint);
            clientBuilder.endpointOverride(endpointUri).forcePathStyle(true);
            presignerBuilder.endpointOverride(endpointUri);
        }

        S3Client builtClient = null;
        S3Presigner builtPresigner = null;
        try {
            builtClient = clientBuilder.build();
            builtPresigner = presignerBuilder.build();
        } catch (Exception ignored) {
            // Permits graceful startup when credentials are incomplete
        }
        this.s3Client = builtClient;
        this.s3Presigner = builtPresigner;
    }

    public String getBucketName() { return this.bucketName; }
    public String getRegionStr() { return this.regionStr; }
    public String getAccessKey() { return this.accessKey; }
    public String getEndpoint() { return this.endpoint; }
    public boolean hasSecretKey() { return this.secretKey != null && !this.secretKey.isBlank(); }
    public S3Client getS3Client() { return this.s3Client; }

    @Override
    public StorageResult store(String key, InputStream inputStream, StorageMetadata metadata) {
        checkClient();
        PutObjectRequest putReq = PutObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .contentType(metadata.getContentType())
            .build();

        s3Client.putObject(putReq, RequestBody.fromInputStream(inputStream, metadata.getContentLength()));

        return StorageResult.builder()
            .storageKey(key)
            .providerType(StorageProviderType.S3)
            .sizeBytes(metadata.getContentLength())
            .checksumSha256(metadata.getChecksumSha256())
            .locationUri("s3://" + bucketName + "/" + key)
            .build();
    }

    @Override
    public InputStream load(String key) {
        checkClient();
        GetObjectRequest getReq = GetObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .build();
        return s3Client.getObject(getReq);
    }

    @Override
    public void delete(String key) {
        checkClient();
        DeleteObjectRequest delReq = DeleteObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .build();
        s3Client.deleteObject(delReq);
    }

    @Override
    public boolean exists(String key) {
        checkClient();
        try {
            HeadObjectRequest headReq = HeadObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();
            s3Client.headObject(headReq);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        }
    }

    @Override
    public StorageMetadata getMetadata(String key) {
        checkClient();
        HeadObjectRequest headReq = HeadObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .build();
        HeadObjectResponse res = s3Client.headObject(headReq);
        return StorageMetadata.builder()
            .contentLength(res.contentLength())
            .contentType(res.contentType())
            .build();
    }

    @Override
    public String generatePresignedUploadUrl(String key, Duration ttl, String contentType) {
        if (s3Presigner == null) return "";
        PutObjectRequest putReq = PutObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .contentType(contentType)
            .build();
        PutObjectPresignRequest presignReq = PutObjectPresignRequest.builder()
            .signatureDuration(ttl)
            .putObjectRequest(putReq)
            .build();
        return s3Presigner.presignPutObject(presignReq).url().toString();
    }

    @Override
    public String generatePresignedDownloadUrl(String key, Duration ttl, String downloadFilename) {
        if (s3Presigner == null) return "";
        GetObjectRequest getReq = GetObjectRequest.builder()
            .bucket(bucketName)
            .key(key)
            .responseContentDisposition("attachment; filename=\"" + downloadFilename + "\"")
            .build();
        GetObjectPresignRequest presignReq = GetObjectPresignRequest.builder()
            .signatureDuration(ttl)
            .getObjectRequest(getReq)
            .build();
        return s3Presigner.presignGetObject(presignReq).url().toString();
    }

    @Override
    public StorageProviderType getProviderType() {
        return StorageProviderType.S3;
    }

    private void checkClient() {
        if (this.s3Client == null) {
            throw new IllegalStateException("AWS S3 client is not configured. Provide AWS credentials in .env");
        }
    }
}
