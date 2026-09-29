package com.edrms.backend.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Async
    @Transactional
    public void recordAction(
        String traceId,
        UUID actorUserId,
        String actorUsername,
        String clientIp,
        String userAgent,
        AuditAction action,
        String entityType,
        String entityId,
        String status,
        String detailsJson
    ) {
        String validJson = detailsJson;
        if (validJson != null && !validJson.isBlank()) {
            String trimmed = validJson.trim();
            if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
                validJson = "{\"message\":\"" + trimmed.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"}";
            }
        }

        AuditLog log = AuditLog.builder()
            .traceId(traceId != null ? traceId : UUID.randomUUID().toString())
            .actorUserId(actorUserId)
            .actorUsername(actorUsername)
            .clientIp(clientIp != null ? clientIp : "127.0.0.1")
            .userAgent(userAgent)
            .action(action.name())
            .entityType(entityType)
            .entityId(entityId)
            .status(status)
            .detailsJson(validJson)
            .build();

        auditLogRepository.save(log);
    }

    public Page<AuditLog> getLogsForEntity(String entityType, String entityId, Pageable pageable) {
        return auditLogRepository.findByEntityTypeAndEntityId(entityType, entityId, pageable);
    }

    public Page<AuditLog> getAllLogs(Pageable pageable) {
        return auditLogRepository.findAll(pageable);
    }
}
