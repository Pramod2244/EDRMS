package com.edrms.backend.auth;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

@Slf4j
@Service
public class JwtTokenService {

    private final byte[] secretKey;

    public JwtTokenService(
        @Value("${edrms.security.jwt-secret:edrms-production-secret-token-key-for-arkaa-digital-enterprise-edrms-2026!}") String secret
    ) {
        // Ensure secret is at least 256 bits (32 bytes)
        byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
        if (raw.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(raw, 0, padded, 0, raw.length);
            this.secretKey = padded;
        } else {
            this.secretKey = raw;
        }
    }

    public String generateToken(
        String userId,
        String username,
        String fullName,
        String email,
        String role,
        List<String> permissions,
        Duration duration,
        boolean isTemporary
    ) {
        return generateToken(userId, username, fullName, email, role, permissions, Collections.emptyList(), duration, isTemporary);
    }

    public String generateToken(
        String userId,
        String username,
        String fullName,
        String email,
        String role,
        List<String> permissions,
        List<String> assignedFolderIds,
        Duration duration,
        boolean isTemporary
    ) {
        try {
            Date now = new Date();
            Date expiry = new Date(now.getTime() + duration.toMillis());

            JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(userId)
                .claim("preferred_username", username)
                .claim("name", fullName)
                .claim("email", email)
                .claim("role", role)
                .claim("permissions", permissions)
                .claim("assignedFolderIds", assignedFolderIds != null ? assignedFolderIds : Collections.emptyList())
                .claim("isTemporary", isTemporary)
                .issueTime(now)
                .expirationTime(expiry)
                .build();

            SignedJWT signedJWT = new SignedJWT(
                new JWSHeader(JWSAlgorithm.HS256),
                claimsSet
            );

            JWSSigner signer = new MACSigner(secretKey);
            signedJWT.sign(signer);

            return signedJWT.serialize();
        } catch (Exception e) {
            log.error("Failed to generate JWT token for user {}", username, e);
            throw new RuntimeException("Could not generate authentication token", e);
        }
    }

    public Optional<JWTClaimsSet> validateToken(String token) {
        try {
            if (token == null || token.isBlank()) return Optional.empty();

            if (token.startsWith("Bearer ") || token.startsWith("bearer ")) {
                token = token.substring(7).trim();
            }

            SignedJWT signedJWT = SignedJWT.parse(token);
            JWSVerifier verifier = new MACVerifier(secretKey);

            if (!signedJWT.verify(verifier)) {
                log.warn("Invalid JWT signature");
                return Optional.empty();
            }

            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
            Date expiry = claims.getExpirationTime();
            if (expiry != null && new Date().after(expiry)) {
                log.warn("JWT token has expired");
                return Optional.empty();
            }

            return Optional.of(claims);
        } catch (Exception e) {
            log.debug("JWT token validation failed: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
