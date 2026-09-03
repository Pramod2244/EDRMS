package com.edrms.backend.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/logs")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('AUDITOR')")
    public ResponseEntity<Page<AuditLog>> getAllLogs(Pageable pageable) {
        return ResponseEntity.ok(auditService.getAllLogs(pageable));
    }

    @GetMapping("/logs/{entityType}/{entityId}")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('AUDITOR')")
    public ResponseEntity<Page<AuditLog>> getLogsForEntity(
        @PathVariable String entityType,
        @PathVariable String entityId,
        Pageable pageable
    ) {
        return ResponseEntity.ok(auditService.getLogsForEntity(entityType, entityId, pageable));
    }
}
