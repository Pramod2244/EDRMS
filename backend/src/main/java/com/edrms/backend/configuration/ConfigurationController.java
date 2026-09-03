package com.edrms.backend.configuration;

import com.edrms.backend.storage.StorageProviderType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/config")
public class ConfigurationController {

    private final ConfigurationService configurationService;

    public ConfigurationController(ConfigurationService configurationService) {
        this.configurationService = configurationService;
    }

    @PutMapping("/storage")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<String> setStorageProvider(@RequestParam StorageProviderType provider) {
        configurationService.switchStorageProvider(provider);
        return ResponseEntity.ok("Storage provider switched to " + provider);
    }
}
