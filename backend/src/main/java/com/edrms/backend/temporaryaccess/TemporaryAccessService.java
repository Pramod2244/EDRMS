package com.edrms.backend.temporaryaccess;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

@Service
public class TemporaryAccessService {

    private final TemporaryAccessRepository repository;

    public TemporaryAccessService(TemporaryAccessRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public String createGrant(
        String targetType,
        UUID targetId,
        UUID userId,
        String permissionsMask,
        OffsetDateTime validFrom,
        OffsetDateTime validUntil,
        Integer maxViews,
        UUID createdBy
    ) {
        String rawToken = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        String tokenHash = hashToken(rawToken);

        TemporaryAccessGrant grant = TemporaryAccessGrant.builder()
            .tokenHash(tokenHash)
            .targetType(targetType)
            .targetId(targetId)
            .userId(userId)
            .permissionsMask(permissionsMask != null ? permissionsMask : "VIEW")
            .validFrom(validFrom != null ? validFrom : OffsetDateTime.now())
            .validUntil(validUntil)
            .maxViews(maxViews)
            .createdBy(createdBy)
            .build();

        repository.save(grant);
        return rawToken;
    }

    @Transactional
    public Optional<TemporaryAccessGrant> validateAndConsume(String rawToken) {
        String tokenHash = hashToken(rawToken);
        Optional<TemporaryAccessGrant> grantOpt = repository.findByTokenHashAndIsRevokedFalse(tokenHash);

        if (grantOpt.isEmpty()) return Optional.empty();

        TemporaryAccessGrant grant = grantOpt.get();
        OffsetDateTime now = OffsetDateTime.now();

        if (now.isBefore(grant.getValidFrom()) || now.isAfter(grant.getValidUntil())) {
            return Optional.empty();
        }

        if (grant.getMaxViews() != null && grant.getViewCount() >= grant.getMaxViews()) {
            return Optional.empty();
        }

        grant.setViewCount(grant.getViewCount() + 1);
        repository.save(grant);

        return Optional.of(grant);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
