package com.edrms.backend.auth;

import com.edrms.backend.audit.AuditAction;
import com.edrms.backend.audit.AuditService;
import com.edrms.backend.users.UserRepository;
import com.nimbusds.jwt.JWTClaimsSet;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@RestController
@RequestMapping({"/api/v1/auth", "/api/auth"})
public class AuthController {

    private final JwtTokenService jwtTokenService;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:http://localhost:8080/realms/edrms}")
    private String keycloakIssuerUri;

    // Store for dynamically created and granted users
    private static final Map<String, GrantedUserRecord> GRANTED_USERS = new ConcurrentHashMap<>();
    // Store for deleted preset user accounts
    private static final java.util.Set<String> DELETED_PRESET_USERS = ConcurrentHashMap.newKeySet();

    public record GrantedUserRecord(
        String username,
        String password,
        String fullName,
        String email,
        String role,
        List<String> permissions,
        List<String> assignedFolderIds,
        List<String> accessibleMenus,
        boolean isTemporary,
        Long durationSeconds,
        OffsetDateTime expiresAt,
        OffsetDateTime createdAt
    ) {}

    private static final Map<String, UserCredentials> PRESET_USERS = new LinkedHashMap<>();

    static {
        PRESET_USERS.put("admin", new UserCredentials(
            "usr-admin-01", "admin", "Admin123!", "Alexander Davis", "admin@arkaa-digital.local",
            "SUPER_ADMIN",
            List.of("VIEW", "UPLOAD", "DOWNLOAD", "DELETE", "SHARE", "PRINT", "MANAGE_PERMISSIONS", "AUDIT_READ"),
            Collections.emptyList(),
            List.of("/documents", "/search", "/audit", "/admin")
        ));
        PRESET_USERS.put("manager", new UserCredentials(
            "usr-mgr-02", "manager", "Manager123!", "Sarah Jenkins", "manager@arkaa-digital.local",
            "DEPARTMENT_MANAGER",
            List.of("VIEW", "UPLOAD", "DOWNLOAD", "DELETE", "SHARE", "PRINT", "MANAGE_PERMISSIONS"),
            Collections.emptyList(),
            List.of("/documents", "/search", "/audit")
        ));
        PRESET_USERS.put("contributor", new UserCredentials(
            "usr-contrib-03", "contributor", "Contributor123!", "David Miller", "contributor@arkaa-digital.local",
            "CONTRIBUTOR",
            List.of("VIEW", "UPLOAD", "DOWNLOAD", "PRINT"),
            Collections.emptyList(),
            List.of("/documents", "/search")
        ));
        PRESET_USERS.put("auditor", new UserCredentials(
            "usr-audit-04", "auditor", "Auditor123!", "Elena Rostova", "auditor@arkaa-digital.local",
            "AUDITOR",
            List.of("VIEW", "AUDIT_READ"),
            Collections.emptyList(),
            List.of("/documents", "/search", "/audit")
        ));
        PRESET_USERS.put("viewer", new UserCredentials(
            "usr-view-05", "viewer", "Viewer123!", "Guest Viewer", "viewer@arkaa-digital.local",
            "VIEWER",
            List.of("VIEW"),
            Collections.emptyList(),
            List.of("/documents", "/search")
        ));
    }

    private record UserCredentials(
        String id,
        String username,
        String password,
        String fullName,
        String email,
        String role,
        List<String> permissions,
        List<String> assignedFolderIds,
        List<String> accessibleMenus
    ) {}

    public AuthController(
        JwtTokenService jwtTokenService,
        UserRepository userRepository,
        AuditService auditService
    ) {
        this.jwtTokenService = jwtTokenService;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    private String resolveIp(HttpServletRequest req) {
        if (req == null) return "127.0.0.1";
        String ip = req.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank()) {
            return ip.split(",")[0].trim();
        }
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        String remote = req.getRemoteAddr();
        if (remote == null || remote.isBlank() || remote.equals("0:0:0:0:0:0:0:1")) {
            return "127.0.0.1";
        }
        return remote;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthLoginRequest req, HttpServletRequest httpRequest) {
        if (req.getUsername() == null || req.getPassword() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Username and password are required"));
        }

        String username = req.getUsername().trim();
        String password = req.getPassword();

        // 1. Check dynamically granted/created users first
        GrantedUserRecord granted = GRANTED_USERS.get(username.toLowerCase());
        if (granted != null) {
            if (!granted.password().equals(password)) {
                auditService.recordAction(
                    UUID.randomUUID().toString(),
                    null,
                    username,
                    resolveIp(httpRequest),
                    httpRequest.getHeader("User-Agent"),
                    AuditAction.ACCESS_DENIED,
                    "USER",
                    username,
                    "FAILED",
                    "{\"reason\":\"Invalid password attempt\"}"
                );
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid username or password"));
            }

            // Check if temporary access has expired
            if (granted.isTemporary() && granted.expiresAt() != null && OffsetDateTime.now().isAfter(granted.expiresAt())) {
                auditService.recordAction(
                    UUID.randomUUID().toString(),
                    null,
                    username,
                    resolveIp(httpRequest),
                    httpRequest.getHeader("User-Agent"),
                    AuditAction.ACCESS_DENIED,
                    "USER",
                    username,
                    "EXPIRED",
                    "{\"reason\":\"Temporary access session expired\"}"
                );
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Access expired. Your temporary access grant has ended. Please contact your administrator."));
            }

            long remainingSeconds;
            Duration tokenDuration;
            OffsetDateTime expiresAt;

            if (granted.isTemporary()) {
                if (granted.expiresAt() == null) {
                    // Activate session on login for the exact duration specified by the administrator
                    long grantSec = (granted.durationSeconds() != null && granted.durationSeconds() > 0)
                        ? granted.durationSeconds()
                        : 300L;
                    expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(grantSec);
                    remainingSeconds = grantSec;

                    GrantedUserRecord activated = new GrantedUserRecord(
                        granted.username(),
                        granted.password(),
                        granted.fullName(),
                        granted.email(),
                        granted.role(),
                        granted.permissions(),
                        granted.assignedFolderIds(),
                        granted.accessibleMenus(),
                        true,
                        granted.durationSeconds(),
                        expiresAt,
                        granted.createdAt()
                    );
                    GRANTED_USERS.put(username.toLowerCase(), activated);
                } else {
                    remainingSeconds = Math.max(1, Duration.between(OffsetDateTime.now(), granted.expiresAt()).getSeconds());
                    expiresAt = granted.expiresAt();
                }
                tokenDuration = Duration.ofSeconds(remainingSeconds);
            } else {
                remainingSeconds = 28800L; // 8 hours permanent session
                tokenDuration = Duration.ofSeconds(remainingSeconds);
                expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plus(tokenDuration);
            }

            String token = jwtTokenService.generateToken(
                "usr-" + username.toLowerCase(),
                granted.username(),
                granted.fullName(),
                granted.email() != null ? granted.email() : (granted.username() + "@arkaa-digital.local"),
                granted.role(),
                granted.permissions(),
                granted.assignedFolderIds() != null ? granted.assignedFolderIds() : Collections.emptyList(),
                tokenDuration,
                granted.isTemporary()
            );

            auditService.recordAction(
                UUID.randomUUID().toString(),
                null,
                granted.username(),
                resolveIp(httpRequest),
                httpRequest.getHeader("User-Agent"),
                AuditAction.LOGIN,
                "USER",
                "usr-" + username.toLowerCase(),
                "SUCCESS",
                String.format("{\"username\":\"%s\",\"role\":\"%s\",\"sessionType\":\"%s\",\"lifetimeSeconds\":%d}",
                    granted.username(), granted.role(), granted.isTemporary() ? "Temporary Access" : "Permanent Session", remainingSeconds)
            );

            return ResponseEntity.ok(AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresInSeconds(remainingSeconds)
                .expiresAt(expiresAt)
                .isTemporaryAccess(granted.isTemporary())
                .user(AuthResponse.UserProfile.builder()
                    .id("usr-" + username.toLowerCase())
                    .username(granted.username())
                    .fullName(granted.fullName())
                    .email(granted.email() != null ? granted.email() : (granted.username() + "@arkaa-digital.local"))
                    .role(granted.role())
                    .permissions(granted.permissions())
                    .assignedFolderIds(granted.assignedFolderIds() != null ? granted.assignedFolderIds() : Collections.emptyList())
                    .accessibleMenus(granted.accessibleMenus() != null ? granted.accessibleMenus() : List.of("/documents", "/search"))
                    .build())
                .build());
        }

        // 2. Check preset users
        if (DELETED_PRESET_USERS.contains(username.toLowerCase())) {
            auditService.recordAction(
                UUID.randomUUID().toString(),
                null,
                username,
                resolveIp(httpRequest),
                httpRequest.getHeader("User-Agent"),
                AuditAction.ACCESS_DENIED,
                "USER",
                username,
                "FAILED",
                "{\"reason\":\"Attempted login to deleted user account\"}"
            );
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "This user account has been deleted."));
        }

        UserCredentials preset = PRESET_USERS.get(username.toLowerCase());
        if (preset != null) {
            if (!preset.password().equals(password)) {
                auditService.recordAction(
                    UUID.randomUUID().toString(),
                    null,
                    username,
                    resolveIp(httpRequest),
                    httpRequest.getHeader("User-Agent"),
                    AuditAction.ACCESS_DENIED,
                    "USER",
                    username,
                    "FAILED",
                    "{\"reason\":\"Invalid preset user password\"}"
                );
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid username or password"));
            }

            Duration sessionDuration = Duration.ofHours(8); // Standard 8-hour admin session
            OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plus(sessionDuration);

            String token = jwtTokenService.generateToken(
                preset.id(),
                preset.username(),
                preset.fullName(),
                preset.email(),
                preset.role(),
                preset.permissions(),
                preset.assignedFolderIds(),
                sessionDuration,
                false
            );

            auditService.recordAction(
                UUID.randomUUID().toString(),
                null,
                preset.username(),
                resolveIp(httpRequest),
                httpRequest.getHeader("User-Agent"),
                AuditAction.LOGIN,
                "USER",
                preset.id(),
                "SUCCESS",
                String.format("{\"username\":\"%s\",\"role\":\"%s\",\"sessionType\":\"Permanent Session\",\"lifetimeSeconds\":%d}",
                    preset.username(), preset.role(), sessionDuration.getSeconds())
            );

            return ResponseEntity.ok(AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresInSeconds(sessionDuration.getSeconds())
                .expiresAt(expiresAt)
                .isTemporaryAccess(false)
                .user(AuthResponse.UserProfile.builder()
                    .id(preset.id())
                    .username(preset.username())
                    .fullName(preset.fullName())
                    .email(preset.email())
                    .role(preset.role())
                    .permissions(preset.permissions())
                    .assignedFolderIds(preset.assignedFolderIds())
                    .accessibleMenus(preset.accessibleMenus())
                    .build())
                .build());
        }

        auditService.recordAction(
            UUID.randomUUID().toString(),
            null,
            username,
            resolveIp(httpRequest),
            httpRequest.getHeader("User-Agent"),
            AuditAction.ACCESS_DENIED,
            "USER",
            username,
            "FAILED",
            "{\"reason\":\"User account not found\"}"
        );

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("error", "Invalid username or password"));
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> listUsers() {
        List<Map<String, Object>> result = new ArrayList<>();

        // Add preset users (unless deleted or customized in GRANTED_USERS)
        for (UserCredentials u : PRESET_USERS.values()) {
            String key = u.username().toLowerCase();
            if (DELETED_PRESET_USERS.contains(key) || GRANTED_USERS.containsKey(key)) {
                continue;
            }
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", u.id());
            map.put("username", u.username());
            map.put("fullName", u.fullName());
            map.put("email", u.email());
            map.put("role", u.role());
            map.put("permissions", u.permissions());
            map.put("assignedFolderIds", u.assignedFolderIds());
            map.put("accessibleMenus", u.accessibleMenus());
            map.put("isTemporary", false);
            map.put("isPreset", true);
            map.put("status", "ACTIVE");
            result.add(map);
        }

        // Add created and granted users
        for (GrantedUserRecord g : GRANTED_USERS.values()) {
            boolean expired = g.isTemporary() && g.expiresAt() != null && OffsetDateTime.now().isAfter(g.expiresAt());
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", "usr-" + g.username().toLowerCase());
            map.put("username", g.username());
            map.put("fullName", g.fullName());
            map.put("email", g.email() != null ? g.email() : (g.username() + "@arkaa-digital.local"));
            map.put("role", g.role());
            map.put("permissions", g.permissions());
            map.put("assignedFolderIds", g.assignedFolderIds() != null ? g.assignedFolderIds() : Collections.emptyList());
            map.put("accessibleMenus", g.accessibleMenus() != null ? g.accessibleMenus() : Collections.emptyList());
            map.put("isTemporary", g.isTemporary());
            map.put("durationSeconds", g.durationSeconds());
            map.put("isPreset", false);
            map.put("expiresAt", g.expiresAt());
            map.put("status", expired ? "EXPIRED" : "ACTIVE");
            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest req) {
        if (req.getUsername() == null || req.getUsername().isBlank() ||
            req.getPassword() == null || req.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }

        String username = req.getUsername().trim().toLowerCase();
        if ((PRESET_USERS.containsKey(username) && !DELETED_PRESET_USERS.contains(username)) || GRANTED_USERS.containsKey(username)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Username '" + username + "' is already registered. Please choose another."));
        }
        DELETED_PRESET_USERS.remove(username);

        String fullName = req.getFullName() != null && !req.getFullName().isBlank()
            ? req.getFullName().trim()
            : req.getUsername().trim();

        String email = req.getEmail() != null && !req.getEmail().isBlank()
            ? req.getEmail().trim()
            : username + "@arkaa-digital.local";

        String role = req.getRole() != null ? req.getRole().toUpperCase() : "VIEWER";

        List<String> perms = req.getPermissions();
        if (perms == null || perms.isEmpty()) {
            perms = switch (role) {
                case "SUPER_ADMIN" -> List.of("VIEW", "UPLOAD", "DOWNLOAD", "DELETE", "SHARE", "PRINT", "MANAGE_PERMISSIONS", "AUDIT_READ");
                case "DEPARTMENT_MANAGER" -> List.of("VIEW", "UPLOAD", "DOWNLOAD", "DELETE", "SHARE", "PRINT", "MANAGE_PERMISSIONS");
                case "CONTRIBUTOR" -> List.of("VIEW", "UPLOAD", "DOWNLOAD", "PRINT");
                case "AUDITOR" -> List.of("VIEW", "AUDIT_READ");
                default -> List.of("VIEW");
            };
        }

        List<String> folders = req.getAssignedFolderIds() != null ? req.getAssignedFolderIds() : Collections.emptyList();

        List<String> menus = req.getAccessibleMenus();
        if (menus == null || menus.isEmpty()) {
            menus = switch (role) {
                case "SUPER_ADMIN" -> List.of("/documents", "/search", "/audit", "/admin");
                case "DEPARTMENT_MANAGER", "AUDITOR" -> List.of("/documents", "/search", "/audit");
                default -> List.of("/documents", "/search");
            };
        }

        boolean isTemp = req.isTemporary() || (req.getDurationSeconds() != null && req.getDurationSeconds() > 0);

        GrantedUserRecord record = new GrantedUserRecord(
            req.getUsername().trim(),
            req.getPassword(),
            fullName,
            email,
            role,
            perms,
            folders,
            menus,
            isTemp,
            req.getDurationSeconds(),
            null, // expiresAt will be activated on user's first login
            OffsetDateTime.now(ZoneOffset.UTC)
        );

        GRANTED_USERS.put(username, record);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", "User created successfully with assigned folder access and role permissions");
        resp.put("username", record.username());
        resp.put("role", record.role());
        resp.put("assignedFolderIds", record.assignedFolderIds());
        resp.put("accessibleMenus", record.accessibleMenus());
        resp.put("permissions", record.permissions());
        resp.put("isTemporary", record.isTemporary());
        resp.put("durationSeconds", record.durationSeconds() != null ? record.durationSeconds() : 0);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @PutMapping("/users/{username}")
    public ResponseEntity<?> updateUser(@PathVariable String username, @RequestBody CreateUserRequest req) {
        String key = username.trim().toLowerCase();

        // 1. Check if user is in GRANTED_USERS
        GrantedUserRecord existing = GRANTED_USERS.get(key);
        String finalPassword = (req.getPassword() != null && !req.getPassword().isBlank())
            ? req.getPassword()
            : (existing != null ? existing.password() : "Admin123!");

        // If preset user, allow customizing permissions, folder access, full name, email
        UserCredentials preset = PRESET_USERS.get(key);
        if (preset != null && existing == null) {
            finalPassword = (req.getPassword() != null && !req.getPassword().isBlank())
                ? req.getPassword()
                : preset.password();
        }

        if (existing == null && (preset == null || DELETED_PRESET_USERS.contains(key))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }

        String fullName = req.getFullName() != null && !req.getFullName().isBlank()
            ? req.getFullName().trim()
            : (existing != null ? existing.fullName() : preset.fullName());

        String email = req.getEmail() != null && !req.getEmail().isBlank()
            ? req.getEmail().trim()
            : (existing != null ? existing.email() : preset.email());

        String role = req.getRole() != null ? req.getRole().toUpperCase() : (existing != null ? existing.role() : preset.role());

        List<String> perms = req.getPermissions();
        if (perms == null || perms.isEmpty()) {
            perms = existing != null ? existing.permissions() : preset.permissions();
        }

        List<String> folders = req.getAssignedFolderIds() != null
            ? req.getAssignedFolderIds()
            : (existing != null ? existing.assignedFolderIds() : Collections.emptyList());

        boolean isTemp = req.isTemporary();
        Long duration = req.getDurationSeconds();

        // Root administrator protections
        if ("admin".equals(key)) {
            role = "SUPER_ADMIN";
            isTemp = false;
            duration = null;
        }

        List<String> menus = req.getAccessibleMenus();
        if (menus == null || menus.isEmpty()) {
            menus = existing != null && existing.accessibleMenus() != null
                ? existing.accessibleMenus()
                : (preset != null ? preset.accessibleMenus() : List.of("/documents", "/search"));
        }
        if ("admin".equals(key)) {
            List<String> mList = new ArrayList<>(menus);
            if (!mList.contains("/admin")) mList.add("/admin");
            menus = mList;
        }

        GrantedUserRecord updatedRecord = new GrantedUserRecord(
            key,
            finalPassword,
            fullName,
            email,
            role,
            perms,
            folders,
            menus,
            isTemp,
            duration,
            null, // Reset expiresAt so new duration takes effect upon user login
            OffsetDateTime.now(ZoneOffset.UTC)
        );

        GRANTED_USERS.put(key, updatedRecord);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", "User " + username + " updated successfully");
        resp.put("username", key);
        resp.put("role", updatedRecord.role());
        resp.put("fullName", updatedRecord.fullName());
        resp.put("email", updatedRecord.email());
        resp.put("assignedFolderIds", updatedRecord.assignedFolderIds());
        resp.put("accessibleMenus", updatedRecord.accessibleMenus());
        resp.put("permissions", updatedRecord.permissions());
        resp.put("isTemporary", updatedRecord.isTemporary());
        resp.put("durationSeconds", updatedRecord.durationSeconds() != null ? updatedRecord.durationSeconds() : 0);
        resp.put("expiresAt", updatedRecord.expiresAt() != null ? updatedRecord.expiresAt() : "");
        return ResponseEntity.ok(resp);
    }

    @DeleteMapping("/users/{username}")
    public ResponseEntity<?> deleteUser(@PathVariable String username) {
        String key = username.trim().toLowerCase();
        if ("admin".equals(key)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Root administrator account 'admin' cannot be deleted."));
        }

        boolean removed = false;
        if (GRANTED_USERS.remove(key) != null) {
            removed = true;
        }
        if (PRESET_USERS.containsKey(key)) {
            DELETED_PRESET_USERS.add(key);
            removed = true;
        }

        try {
            userRepository.findByUsername(key).ifPresent(userRepository::delete);
        } catch (Exception ignored) {}

        if (removed) {
            return ResponseEntity.ok(Map.of("message", "User " + username + " successfully removed"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
    }

    @PostMapping("/grant-user")
    public ResponseEntity<?> grantTemporaryUser(@RequestBody GrantUserAccessRequest req) {
        if (req.getUsername() == null || req.getPassword() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Username and password are required for temporary grant"));
        }

        long durationSec = req.getDurationSeconds() != null && req.getDurationSeconds() > 0
            ? req.getDurationSeconds()
            : 900L; // default 15 minutes

        OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(durationSec);

        List<String> perms = req.getPermissions();
        if (perms == null || perms.isEmpty()) {
            perms = "CONTRIBUTOR".equalsIgnoreCase(req.getRole())
                ? List.of("VIEW", "UPLOAD", "DOWNLOAD", "PRINT")
                : List.of("VIEW");
        }

        String username = req.getUsername().trim();
        String fullName = req.getFullName() != null && !req.getFullName().isBlank()
            ? req.getFullName().trim()
            : "Granted User (" + username + ")";

        GrantedUserRecord record = new GrantedUserRecord(
            username,
            req.getPassword(),
            fullName,
            username.toLowerCase() + "@temporary-access.local",
            req.getRole() != null ? req.getRole().toUpperCase() : "VIEWER",
            perms,
            Collections.emptyList(),
            List.of("/documents", "/search"),
            true,
            durationSec,
            expiresAt,
            OffsetDateTime.now(ZoneOffset.UTC)
        );

        GRANTED_USERS.put(username.toLowerCase(), record);

        return ResponseEntity.ok(Map.of(
            "message", "Temporary user access granted successfully",
            "username", username,
            "role", record.role(),
            "durationSeconds", durationSec,
            "expiresAt", expiresAt
        ));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || authHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Missing Authorization header"));
        }

        Optional<JWTClaimsSet> claimsOpt = jwtTokenService.validateToken(authHeader);
        if (claimsOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid or expired authentication token"));
        }

        JWTClaimsSet claims = claimsOpt.get();
        Date expiry = claims.getExpirationTime();
        long remainingSec = expiry != null
            ? Math.max(0, (expiry.getTime() - System.currentTimeMillis()) / 1000)
            : 0;

        Boolean isTemporary = (Boolean) claims.getClaim("isTemporary");
        List<String> permissions = new ArrayList<>();
        Object rawPerms = claims.getClaim("permissions");
        if (rawPerms instanceof List<?> list) {
            for (Object o : list) {
                if (o != null) permissions.add(o.toString());
            }
        }

        List<String> folders = new ArrayList<>();
        Object rawFolders = claims.getClaim("assignedFolderIds");
        if (rawFolders instanceof List<?> list) {
            for (Object o : list) {
                if (o != null) folders.add(o.toString());
            }
        }

        return ResponseEntity.ok(Map.of(
            "id", claims.getSubject() != null ? claims.getSubject() : "usr-unknown",
            "username", claims.getClaim("preferred_username") != null ? claims.getClaim("preferred_username") : "user",
            "fullName", claims.getClaim("name") != null ? claims.getClaim("name") : "User",
            "email", claims.getClaim("email") != null ? claims.getClaim("email") : "",
            "role", claims.getClaim("role") != null ? claims.getClaim("role") : "VIEWER",
            "permissions", permissions,
            "assignedFolderIds", folders,
            "isTemporaryAccess", Boolean.TRUE.equals(isTemporary),
            "remainingSeconds", remainingSec,
            "expiresAt", expiry != null ? expiry.toInstant().atOffset(ZoneOffset.UTC) : null
        ));
    }

    @GetMapping("/keycloak-config")
    public ResponseEntity<?> getKeycloakConfig() {
        return ResponseEntity.ok(Map.of(
            "enabled", true,
            "issuerUri", keycloakIssuerUri,
            "realm", "edrms",
            "clientId", "edrms-frontend",
            "authUrl", keycloakIssuerUri + "/protocol/openid-connect/auth"
        ));
    }
}
