package com.edrms.backend.configuration;

import com.edrms.backend.audit.AuditAction;
import com.edrms.backend.audit.AuditService;
import com.edrms.backend.auth.CurrentUserContext;
import com.edrms.backend.storage.StorageProviderType;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping({"/api/v1/admin/config", "/api/admin/config"})
public class ConfigurationController {

    private final ConfigurationService configurationService;
    private final AuditService auditService;
    private final CurrentUserContext currentUserContext;

    public ConfigurationController(
        ConfigurationService configurationService,
        AuditService auditService,
        CurrentUserContext currentUserContext
    ) {
        this.configurationService = configurationService;
        this.auditService = auditService;
        this.currentUserContext = currentUserContext;
    }

    @GetMapping("/storage")
    public ResponseEntity<StorageConfigResponse> getStorageConfig() {
        return ResponseEntity.ok(configurationService.getStorageConfig());
    }

    @PutMapping("/storage")
    public ResponseEntity<?> updateStorageConfig(@RequestBody StorageConfigRequest req, HttpServletRequest httpRequest) {
        configurationService.updateStorageConfig(req);

        String actor = currentUserContext.getCurrentUsername().orElse("admin");
        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank()) {
            ip = ip.split(",")[0].trim();
        } else {
            ip = httpRequest.getRemoteAddr();
        }
        if (ip == null || ip.isBlank() || ip.equals("0:0:0:0:0:0:0:1")) ip = "127.0.0.1";

        auditService.recordAction(
            UUID.randomUUID().toString(),
            null,
            actor,
            ip,
            httpRequest.getHeader("User-Agent"),
            AuditAction.SYSTEM_CONFIG_CHANGE,
            "STORAGE_CONFIG",
            req.getProviderType() != null ? req.getProviderType() : "STORAGE",
            "SUCCESS",
            String.format("{\"provider\":\"%s\",\"nasPath\":\"%s\",\"localPath\":\"%s\"}",
                req.getProviderType(),
                req.getNasRootPath() != null ? req.getNasRootPath() : "",
                req.getLocalRootPath() != null ? req.getLocalRootPath() : "")
        );

        return ResponseEntity.ok(Map.of(
            "message", "Storage configuration updated and applied successfully",
            "provider", req.getProviderType()
        ));
    }

    @PostMapping("/storage/test")
    public ResponseEntity<?> testStorage(@RequestBody StorageConfigRequest req) {
        Map<String, Object> result = configurationService.testStorage(req);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/storage/provider")
    public ResponseEntity<String> setStorageProvider(@RequestParam StorageProviderType provider) {
        configurationService.switchStorageProvider(provider);
        return ResponseEntity.ok("Storage provider switched to " + provider);
    }
}
