package com.edrms.backend.configuration;

import com.edrms.backend.storage.StorageProviderType;
import com.edrms.backend.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class ConfigurationService {

    private final ConfigurationRepository repository;
    private final StorageService storageService;

    public ConfigurationService(ConfigurationRepository repository, StorageService storageService) {
        this.repository = repository;
        this.storageService = storageService;
    }

    public Optional<String> getConfig(String key) {
        return repository.findByConfigKey(key).map(SystemConfiguration::getConfigValue);
    }

    @Transactional
    public void switchStorageProvider(StorageProviderType newProvider) {
        // 1. Update runtime active provider in StorageService
        storageService.setActiveProviderType(newProvider);

        // 2. Persist in database
        SystemConfiguration config = repository.findByConfigKey("STORAGE_ACTIVE_PROVIDER")
            .orElseGet(() -> SystemConfiguration.builder()
                .configKey("STORAGE_ACTIVE_PROVIDER")
                .category("STORAGE")
                .build());

        config.setConfigValue(newProvider.name());
        repository.save(config);
    }
}
