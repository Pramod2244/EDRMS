package com.edrms.backend.audit;

import com.edrms.backend.auth.CurrentUserContext;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping({"/api/v1/audit", "/api/audit"})
public class AuditController {

    private final AuditService auditService;
    private final CurrentUserContext currentUserContext;

    public AuditController(AuditService auditService, CurrentUserContext currentUserContext) {
        this.auditService = auditService;
        this.currentUserContext = currentUserContext;
    }

    @GetMapping("/logs")
    public ResponseEntity<Page<AuditLog>> getAllLogs(Pageable pageable) {
        return ResponseEntity.ok(auditService.getAllLogs(pageable));
    }

    @GetMapping("/logs/{entityType}/{entityId}")
    public ResponseEntity<Page<AuditLog>> getLogsForEntity(
        @PathVariable String entityType,
        @PathVariable String entityId,
        Pageable pageable
    ) {
        return ResponseEntity.ok(auditService.getLogsForEntity(entityType, entityId, pageable));
    }

    @PostMapping("/record")
    public ResponseEntity<?> recordAction(
        @RequestBody AuditRecordRequest request,
        HttpServletRequest httpRequest
    ) {
        String username = request.getActorUsername();
        if (username == null || username.isBlank()) {
            username = currentUserContext.getCurrentUsername().orElse("anonymous");
        }

        String ip = request.getClientIp();
        if (ip == null || ip.isBlank() || ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1")) {
            String forwarded = httpRequest.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                ip = forwarded.split(",")[0].trim();
            } else {
                String realIp = httpRequest.getHeader("X-Real-IP");
                if (realIp != null && !realIp.isBlank()) {
                    ip = realIp.trim();
                } else if (httpRequest.getRemoteAddr() != null) {
                    ip = httpRequest.getRemoteAddr();
                }
            }
        }
        if (ip == null || ip.isBlank() || ip.equals("0:0:0:0:0:0:0:1")) {
            ip = "127.0.0.1";
        }

        String userAgent = httpRequest.getHeader("User-Agent");

        AuditAction action;
        try {
            action = AuditAction.valueOf(request.getAction().toUpperCase().trim());
        } catch (Exception e) {
            action = AuditAction.VIEW;
        }

        String details = request.getDetailsJson();
        if (details == null || details.isBlank()) {
            String docName = request.getDocumentName() != null ? request.getDocumentName() : "";
            details = String.format("{\"documentName\":\"%s\",\"role\":\"%s\"}",
                docName.replace("\"", "\\\""),
                request.getActorRole() != null ? request.getActorRole() : "");
        }

        auditService.recordAction(
            UUID.randomUUID().toString(),
            null,
            username,
            ip,
            userAgent,
            action,
            request.getEntityType() != null ? request.getEntityType() : "DOCUMENT",
            request.getDocumentId() != null ? request.getDocumentId() : "system",
            "SUCCESS",
            details
        );

        return ResponseEntity.ok(Map.of("success", true));
    }
}

