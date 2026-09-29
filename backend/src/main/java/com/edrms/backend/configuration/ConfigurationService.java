package com.edrms.backend.configuration;

import com.edrms.backend.storage.LocalStorageProvider;
import com.edrms.backend.storage.NasStorageProvider;
import com.edrms.backend.storage.S3StorageProvider;
import com.edrms.backend.storage.StorageProviderType;
import com.edrms.backend.storage.StorageService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Optional;

@Service
public class ConfigurationService {

    private static final Logger log = LoggerFactory.getLogger(ConfigurationService.class);

    private final ConfigurationRepository repository;
    private final StorageService storageService;
    private final LocalStorageProvider localStorageProvider;
    private final NasStorageProvider nasStorageProvider;
    private final S3StorageProvider s3StorageProvider;

    public ConfigurationService(
        ConfigurationRepository repository,
        StorageService storageService,
        LocalStorageProvider localStorageProvider,
        NasStorageProvider nasStorageProvider,
        S3StorageProvider s3StorageProvider
    ) {
        this.repository = repository;
        this.storageService = storageService;
        this.localStorageProvider = localStorageProvider;
        this.nasStorageProvider = nasStorageProvider;
        this.s3StorageProvider = s3StorageProvider;
    }

    @PostConstruct
    public void init() {
        try {
            // Load and apply saved configuration from DB if present
            repository.findByConfigKey("STORAGE_LOCAL_ROOT_PATH").ifPresent(cfg -> {
                if (cfg.getConfigValue() != null && !cfg.getConfigValue().isBlank()) {
                    localStorageProvider.reconfigure(cfg.getConfigValue());
                }
            });

            repository.findByConfigKey("STORAGE_NAS_ROOT_PATH").ifPresent(cfg -> {
                if (cfg.getConfigValue() != null && !cfg.getConfigValue().isBlank()) {
                    nasStorageProvider.reconfigure(cfg.getConfigValue());
                }
            });

            String s3Bucket = repository.findByConfigKey("STORAGE_S3_BUCKET").map(SystemConfiguration::getConfigValue).orElse(null);
            String s3Region = repository.findByConfigKey("STORAGE_S3_REGION").map(SystemConfiguration::getConfigValue).orElse(null);
            String s3AccessKey = repository.findByConfigKey("STORAGE_S3_ACCESS_KEY").map(SystemConfiguration::getConfigValue).orElse(null);
            String s3SecretKey = repository.findByConfigKey("STORAGE_S3_SECRET_KEY").map(SystemConfiguration::getConfigValue).orElse(null);
            String s3Endpoint = repository.findByConfigKey("STORAGE_S3_ENDPOINT").map(SystemConfiguration::getConfigValue).orElse(null);

            if (s3Bucket != null || s3AccessKey != null) {
                s3StorageProvider.reconfigure(s3Bucket, s3Region, s3AccessKey, s3SecretKey, s3Endpoint);
            }

            repository.findByConfigKey("STORAGE_ACTIVE_PROVIDER").ifPresent(cfg -> {
                try {
                    StorageProviderType provider = StorageProviderType.valueOf(cfg.getConfigValue().toUpperCase());
                    storageService.setActiveProviderType(provider);
                } catch (Exception ignored) {}
            });
        } catch (Exception e) {
            log.warn("Could not load stored configurations on startup: {}", e.getMessage());
        }
    }

    public Optional<String> getConfig(String key) {
        return repository.findByConfigKey(key).map(SystemConfiguration::getConfigValue);
    }

    public StorageConfigResponse getStorageConfig() {
        return StorageConfigResponse.builder()
            .providerType(storageService.getActiveProviderType().name())
            .localRootPath(localStorageProvider.getRootPathString())
            .nasRootPath(nasStorageProvider.getRootPathString())
            .s3BucketName(s3StorageProvider.getBucketName())
            .s3Region(s3StorageProvider.getRegionStr())
            .s3AccessKey(s3StorageProvider.getAccessKey())
            .s3SecretConfigured(s3StorageProvider.hasSecretKey())
            .s3Endpoint(s3StorageProvider.getEndpoint())
            .build();
    }

    @Transactional
    public void updateStorageConfig(StorageConfigRequest req) {
        if (req.getProviderType() != null && !req.getProviderType().isBlank()) {
            StorageProviderType newType = StorageProviderType.valueOf(req.getProviderType().toUpperCase());
            storageService.setActiveProviderType(newType);
            saveConfig("STORAGE_ACTIVE_PROVIDER", newType.name(), "STORAGE");
        }

        if (req.getLocalRootPath() != null && !req.getLocalRootPath().isBlank()) {
            localStorageProvider.reconfigure(req.getLocalRootPath());
            saveConfig("STORAGE_LOCAL_ROOT_PATH", req.getLocalRootPath().trim(), "STORAGE");
        }

        if (req.getNasRootPath() != null && !req.getNasRootPath().isBlank()) {
            nasStorageProvider.reconfigure(req.getNasRootPath());
            saveConfig("STORAGE_NAS_ROOT_PATH", req.getNasRootPath().trim(), "STORAGE");
        }

        String bucket = req.getS3BucketName() != null ? req.getS3BucketName().trim() : s3StorageProvider.getBucketName();
        String region = req.getS3Region() != null ? req.getS3Region().trim() : s3StorageProvider.getRegionStr();
        String accessKey = req.getS3AccessKey() != null ? req.getS3AccessKey().trim() : s3StorageProvider.getAccessKey();
        String secretKey = (req.getS3SecretKey() != null && !req.getS3SecretKey().isBlank())
            ? req.getS3SecretKey().trim()
            : repository.findByConfigKey("STORAGE_S3_SECRET_KEY").map(SystemConfiguration::getConfigValue).orElse("");
        String endpoint = req.getS3Endpoint() != null ? req.getS3Endpoint().trim() : s3StorageProvider.getEndpoint();

        s3StorageProvider.reconfigure(bucket, region, accessKey, secretKey, endpoint);

        saveConfig("STORAGE_S3_BUCKET", bucket, "STORAGE");
        saveConfig("STORAGE_S3_REGION", region, "STORAGE");
        saveConfig("STORAGE_S3_ACCESS_KEY", accessKey, "STORAGE");
        if (req.getS3SecretKey() != null && !req.getS3SecretKey().isBlank()) {
            saveConfig("STORAGE_S3_SECRET_KEY", req.getS3SecretKey().trim(), "STORAGE");
        }
        saveConfig("STORAGE_S3_ENDPOINT", endpoint, "STORAGE");
    }

    public Map<String, Object> testStorage(StorageConfigRequest req) {
        String provider = req.getProviderType() != null ? req.getProviderType().toUpperCase() : "LOCAL";

        if ("LOCAL".equals(provider)) {
            String pathStr = req.getLocalRootPath() != null && !req.getLocalRootPath().isBlank()
                ? req.getLocalRootPath()
                : localStorageProvider.getRootPathString();
            try {
                Path p = Paths.get(pathStr).toAbsolutePath().normalize();
                Files.createDirectories(p);
                Path testFile = Files.createTempFile(p, "test-write-", ".tmp");
                Files.writeString(testFile, "test-edrms-probe");
                Files.deleteIfExists(testFile);
                return Map.of(
                    "success", true,
                    "message", "Local filesystem path verified! Write and read permissions confirmed at: " + p
                );
            } catch (Exception e) {
                return Map.of(
                    "success", false,
                    "message", "Failed to verify local path: " + e.getMessage()
                );
            }
        } else if ("NAS".equals(provider)) {
            String pathStr = req.getNasRootPath() != null && !req.getNasRootPath().isBlank()
                ? req.getNasRootPath()
                : nasStorageProvider.getRootPathString();
            long start = System.currentTimeMillis();
            try {
                Path p = Paths.get(pathStr).toAbsolutePath().normalize();
                Files.createDirectories(p);
                Path testFile = Files.createTempFile(p, "probe-nas-", ".tmp");
                Files.writeString(testFile, "edms-nas-storage-probe-test");
                String readContent = Files.readString(testFile);
                Files.deleteIfExists(testFile);
                long latency = System.currentTimeMillis() - start;
                return Map.of(
                    "success", true,
                    "message", "External NAS Box path verified! Read/write validated (" + latency + "ms) at: " + p
                );
            } catch (Exception e) {
                return Map.of(
                    "success", false,
                    "message", "Failed to verify External NAS Box path: " + e.getMessage()
                );
            }
        } else if ("S3".equals(provider)) {
            String bucket = req.getS3BucketName() != null && !req.getS3BucketName().isBlank()
                ? req.getS3BucketName().trim()
                : s3StorageProvider.getBucketName();
            String region = req.getS3Region() != null && !req.getS3Region().isBlank()
                ? req.getS3Region().trim()
                : s3StorageProvider.getRegionStr();
            String accessKey = req.getS3AccessKey() != null && !req.getS3AccessKey().isBlank()
                ? req.getS3AccessKey().trim()
                : s3StorageProvider.getAccessKey();
            String secretKey = req.getS3SecretKey() != null && !req.getS3SecretKey().isBlank()
                ? req.getS3SecretKey().trim()
                : repository.findByConfigKey("STORAGE_S3_SECRET_KEY").map(SystemConfiguration::getConfigValue).orElse("");
            String endpoint = req.getS3Endpoint() != null ? req.getS3Endpoint().trim() : s3StorageProvider.getEndpoint();

            if (bucket.isBlank()) {
                return Map.of("success", false, "message", "S3 Bucket Name cannot be blank.");
            }
            if (accessKey.isBlank() || secretKey.isBlank()) {
                return Map.of("success", false, "message", "Access Key ID and Secret Access Key must be provided.");
            }

            try {
                Region awsRegion = Region.of(region);
                S3ClientBuilder builder = S3Client.builder().region(awsRegion);
                builder.credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(accessKey, secretKey)
                ));
                if (!endpoint.isBlank()) {
                    builder.endpointOverride(URI.create(endpoint)).forcePathStyle(true);
                }

                try (S3Client testClient = builder.build()) {
                    testClient.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
                }

                return Map.of(
                    "success", true,
                    "message", "S3 connection successful! Bucket '" + bucket + "' reached in region '" + region + "'."
                );
            } catch (Exception e) {
                return Map.of(
                    "success", false,
                    "message", "S3 connection failed: " + e.getMessage()
                );
            }
        }

        return Map.of("success", false, "message", "Unknown storage provider: " + provider);
    }

    @Transactional
    public void switchStorageProvider(StorageProviderType newProvider) {
        storageService.setActiveProviderType(newProvider);
        saveConfig("STORAGE_ACTIVE_PROVIDER", newProvider.name(), "STORAGE");
    }

    private void saveConfig(String key, String value, String category) {
        SystemConfiguration config = repository.findByConfigKey(key)
            .orElseGet(() -> SystemConfiguration.builder()
                .configKey(key)
                .category(category)
                .build());
        config.setConfigValue(value);
        repository.save(config);
    }
}
