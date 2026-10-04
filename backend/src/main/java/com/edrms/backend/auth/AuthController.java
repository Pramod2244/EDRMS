package com.edrms.backend.auth;

import com.edrms.backend.audit.AuditAction;
import com.edrms.backend.audit.AuditService;
import com.edrms.backend.users.User;
import com.edrms.backend.users.UserRepository;
import com.nimbusds.jwt.JWTClaimsSet;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping({"/api/v1/auth", "/api/auth"})
public class AuthController {

    private final JwtTokenService jwtTokenService;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:http://localhost:8080/realms/edrms}")
    private String keycloakIssuerUri;

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

    private List<String> defaultPermissionsForRole(String role) {
        if (role == null) return List.of("VIEW");
        return switch (role.toUpperCase()) {
            case "SUPER_ADMIN" -> List.of("VIEW", "UPLOAD", "DOWNLOAD", "DELETE", "SHARE", "PRINT", "MANAGE_PERMISSIONS", "AUDIT_READ");
            case "DEPARTMENT_MANAGER" -> List.of("VIEW", "UPLOAD", "DOWNLOAD", "DELETE", "SHARE", "PRINT", "MANAGE_PERMISSIONS");
            case "CONTRIBUTOR" -> List.of("VIEW", "UPLOAD", "DOWNLOAD", "PRINT");
            case "AUDITOR" -> List.of("VIEW", "AUDIT_READ");
            default -> List.of("VIEW");
        };
    }

    private List<String> defaultMenusForRole(String role) {
        if (role == null) return List.of("/documents", "/search");
        return switch (role.toUpperCase()) {
            case "SUPER_ADMIN" -> List.of("/documents", "/search", "/audit", "/admin");
            case "DEPARTMENT_MANAGER", "AUDITOR" -> List.of("/documents", "/search", "/audit");
            default -> List.of("/documents", "/search");
        };
    }

    private List<String> parseCsvList(String val, List<String> fallback) {
        if (val == null || val.isBlank()) return fallback;
        return Arrays.stream(val.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toList());
    }

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<?> login(@RequestBody AuthLoginRequest req, HttpServletRequest httpRequest) {
        if (req.getUsername() == null || req.getPassword() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Username and password are required"));
        }

        String username = req.getUsername().trim();
        String password = req.getPassword();

        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(username);
        if (userOpt.isEmpty()) {
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
                "{\"reason\":\"User account not found in database\"}"
            );
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid username or password"));
        }

        User user = userOpt.get();

        // Check password
        String storedPassword = user.getPasswordHash();
        if (storedPassword == null || storedPassword.isBlank()) {
            if ("admin".equalsIgnoreCase(user.getUsername())) {
                storedPassword = "Admin123!";
            }
        }

        if (storedPassword == null || !storedPassword.equals(password)) {
            auditService.recordAction(
                UUID.randomUUID().toString(),
                null,
                username,
                resolveIp(httpRequest),
                httpRequest.getHeader("User-Agent"),
                AuditAction.ACCESS_DENIED,
                "USER",
                user.getId().toString(),
                "FAILED",
                "{\"reason\":\"Invalid user password\"}"
            );
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid username or password"));
        }

        // Check if temporary access account is expired
        if (Boolean.TRUE.equals(user.getIsTemporary())) {
            if (user.getExpiresAt() != null && OffsetDateTime.now(ZoneOffset.UTC).isAfter(user.getExpiresAt())) {
                auditService.recordAction(
                    UUID.randomUUID().toString(),
                    null,
                    username,
                    resolveIp(httpRequest),
                    httpRequest.getHeader("User-Agent"),
                    AuditAction.ACCESS_DENIED,
                    "USER",
                    user.getId().toString(),
                    "FAILED",
                    "{\"reason\":\"Temporary user account has expired\"}"
                );
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "This temporary access session has expired. Please contact an administrator."));
            }

            // If first login and durationSeconds is set, activate expiresAt
            if (user.getExpiresAt() == null && user.getDurationSeconds() != null && user.getDurationSeconds() > 0) {
                user.setExpiresAt(OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(user.getDurationSeconds()));
                userRepository.save(user);
            }
        }

        // Determine session duration
        Duration sessionDuration = (user.getDurationSeconds() != null && user.getDurationSeconds() > 0)
            ? Duration.ofSeconds(user.getDurationSeconds())
            : Duration.ofHours(8);

        OffsetDateTime sessionExpiresAt = user.getExpiresAt() != null
            ? user.getExpiresAt()
            : OffsetDateTime.now(ZoneOffset.UTC).plus(sessionDuration);

        List<String> perms = parseCsvList(user.getPermissions(), defaultPermissionsForRole(user.getRole()));
        List<String> folders = parseCsvList(user.getAssignedFolderIds(), Collections.emptyList());
        List<String> menus = parseCsvList(user.getAccessibleMenus(), defaultMenusForRole(user.getRole()));

        String token = jwtTokenService.generateToken(
            user.getId().toString(),
            user.getUsername(),
            user.getFullName() != null ? user.getFullName() : user.getUsername(),
            user.getEmail(),
            user.getRole() != null ? user.getRole() : "VIEWER",
            perms,
            folders,
            sessionDuration,
            Boolean.TRUE.equals(user.getIsTemporary())
        );

        auditService.recordAction(
            UUID.randomUUID().toString(),
            null,
            user.getUsername(),
            resolveIp(httpRequest),
            httpRequest.getHeader("User-Agent"),
            AuditAction.LOGIN,
            "USER",
            user.getId().toString(),
            "SUCCESS",
            String.format("{\"username\":\"%s\",\"role\":\"%s\",\"sessionType\":\"%s\",\"lifetimeSeconds\":%d}",
                user.getUsername(), user.getRole(),
                Boolean.TRUE.equals(user.getIsTemporary()) ? "Temporary" : "Standard",
                sessionDuration.getSeconds())
        );

        return ResponseEntity.ok(AuthResponse.builder()
            .token(token)
            .tokenType("Bearer")
            .expiresInSeconds(sessionDuration.getSeconds())
            .expiresAt(sessionExpiresAt)
            .isTemporaryAccess(Boolean.TRUE.equals(user.getIsTemporary()))
            .user(AuthResponse.UserProfile.builder()
                .id(user.getId().toString())
                .username(user.getUsername())
                .fullName(user.getFullName() != null ? user.getFullName() : user.getUsername())
                .email(user.getEmail())
                .role(user.getRole() != null ? user.getRole() : "VIEWER")
                .permissions(perms)
                .assignedFolderIds(folders)
                .accessibleMenus(menus)
                .build())
            .build());
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> listUsers() {
        List<User> dbUsers = userRepository.findAll();

        // Sort: admin first, then alphabetical
        dbUsers.sort((a, b) -> {
            if ("admin".equalsIgnoreCase(a.getUsername())) return -1;
            if ("admin".equalsIgnoreCase(b.getUsername())) return 1;
            return a.getUsername().compareToIgnoreCase(b.getUsername());
        });

        List<Map<String, Object>> result = new ArrayList<>();
        for (User u : dbUsers) {
            String role = u.getRole() != null ? u.getRole() : "VIEWER";
            List<String> perms = parseCsvList(u.getPermissions(), defaultPermissionsForRole(role));
            List<String> folders = parseCsvList(u.getAssignedFolderIds(), Collections.emptyList());
            List<String> menus = parseCsvList(u.getAccessibleMenus(), defaultMenusForRole(role));

            boolean expired = Boolean.TRUE.equals(u.getIsTemporary()) && u.getExpiresAt() != null
                && OffsetDateTime.now(ZoneOffset.UTC).isAfter(u.getExpiresAt());

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", u.getId().toString());
            map.put("username", u.getUsername());
            map.put("fullName", u.getFullName() != null && !u.getFullName().isBlank() ? u.getFullName() : u.getUsername());
            map.put("email", u.getEmail());
            map.put("role", role);
            map.put("permissions", perms);
            map.put("assignedFolderIds", folders);
            map.put("accessibleMenus", menus);
            map.put("isTemporary", Boolean.TRUE.equals(u.getIsTemporary()));
            map.put("durationSeconds", u.getDurationSeconds() != null ? u.getDurationSeconds() : 0);
            map.put("expiresAt", u.getExpiresAt());
            map.put("status", expired ? "EXPIRED" : (u.getStatus() != null ? u.getStatus() : "ACTIVE"));
            map.put("isPreset", false);
            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    @PostMapping("/users")
    @Transactional
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest req) {
        if (req.getUsername() == null || req.getUsername().isBlank() ||
            req.getPassword() == null || req.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }

        String username = req.getUsername().trim();
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Username '" + username + "' is already registered in the database. Please choose another."));
        }

        String fullName = req.getFullName() != null && !req.getFullName().isBlank()
            ? req.getFullName().trim()
            : username;

        String email = req.getEmail() != null && !req.getEmail().isBlank()
            ? req.getEmail().trim()
            : username.toLowerCase() + "@arkaa-digital.local";

        String role = req.getRole() != null ? req.getRole().toUpperCase() : "VIEWER";

        List<String> perms = (req.getPermissions() != null && !req.getPermissions().isEmpty())
            ? req.getPermissions()
            : defaultPermissionsForRole(role);

        List<String> folders = req.getAssignedFolderIds() != null
            ? req.getAssignedFolderIds()
            : Collections.emptyList();

        List<String> menus = (req.getAccessibleMenus() != null && !req.getAccessibleMenus().isEmpty())
            ? req.getAccessibleMenus()
            : defaultMenusForRole(role);

        boolean isTemp = req.isTemporary() || (req.getDurationSeconds() != null && req.getDurationSeconds() > 0);

        User newUser = User.builder()
            .keycloakId(UUID.randomUUID().toString())
            .username(username)
            .fullName(fullName)
            .email(email)
            .passwordHash(req.getPassword())
            .role(role)
            .permissions(String.join(",", perms))
            .assignedFolderIds(String.join(",", folders))
            .accessibleMenus(String.join(",", menus))
            .isTemporary(isTemp)
            .durationSeconds(req.getDurationSeconds())
            .status("ACTIVE")
            .build();

        User saved = userRepository.save(newUser);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", "User created successfully in database");
        resp.put("id", saved.getId().toString());
        resp.put("username", saved.getUsername());
        resp.put("role", saved.getRole());
        resp.put("fullName", saved.getFullName());
        resp.put("email", saved.getEmail());
        resp.put("assignedFolderIds", folders);
        resp.put("accessibleMenus", menus);
        resp.put("permissions", perms);
        resp.put("isTemporary", isTemp);
        resp.put("durationSeconds", saved.getDurationSeconds() != null ? saved.getDurationSeconds() : 0);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @PutMapping("/users/{username}")
    @Transactional
    public ResponseEntity<?> updateUser(@PathVariable String username, @RequestBody CreateUserRequest req) {
        String cleanUsername = username.trim();
        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(cleanUsername);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User '" + username + "' not found in database."));
        }

        User user = userOpt.get();
        boolean isRoot = "admin".equalsIgnoreCase(user.getUsername());

        if (req.getFullName() != null && !req.getFullName().isBlank()) {
            user.setFullName(req.getFullName().trim());
        }

        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            user.setEmail(req.getEmail().trim());
        }

        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            user.setPasswordHash(req.getPassword().trim());
        }

        if (!isRoot && req.getRole() != null && !req.getRole().isBlank()) {
            user.setRole(req.getRole().toUpperCase());
        } else if (isRoot) {
            user.setRole("SUPER_ADMIN");
        }

        if (req.getPermissions() != null && !req.getPermissions().isEmpty()) {
            user.setPermissions(String.join(",", req.getPermissions()));
        }

        if (req.getAssignedFolderIds() != null) {
            user.setAssignedFolderIds(String.join(",", req.getAssignedFolderIds()));
        }

        if (req.getAccessibleMenus() != null && !req.getAccessibleMenus().isEmpty()) {
            List<String> menus = new ArrayList<>(req.getAccessibleMenus());
            if (isRoot && !menus.contains("/admin")) menus.add("/admin");
            user.setAccessibleMenus(String.join(",", menus));
        }

        if (!isRoot) {
            boolean isTemp = req.isTemporary() || (req.getDurationSeconds() != null && req.getDurationSeconds() > 0);
            user.setIsTemporary(isTemp);
            user.setDurationSeconds(req.getDurationSeconds());
            user.setExpiresAt(null);
        }

        User saved = userRepository.save(user);

        List<String> perms = parseCsvList(saved.getPermissions(), defaultPermissionsForRole(saved.getRole()));
        List<String> folders = parseCsvList(saved.getAssignedFolderIds(), Collections.emptyList());
        List<String> menus = parseCsvList(saved.getAccessibleMenus(), defaultMenusForRole(saved.getRole()));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", "User " + saved.getUsername() + " updated successfully");
        resp.put("id", saved.getId().toString());
        resp.put("username", saved.getUsername());
        resp.put("fullName", saved.getFullName());
        resp.put("email", saved.getEmail());
        resp.put("role", saved.getRole());
        resp.put("assignedFolderIds", folders);
        resp.put("accessibleMenus", menus);
        resp.put("permissions", perms);
        resp.put("isTemporary", Boolean.TRUE.equals(saved.getIsTemporary()));
        resp.put("durationSeconds", saved.getDurationSeconds() != null ? saved.getDurationSeconds() : 0);
        return ResponseEntity.ok(resp);
    }

    @DeleteMapping("/users/{username}")
    @Transactional
    public ResponseEntity<?> deleteUser(@PathVariable String username) {
        String cleanUsername = username.trim();
        if ("admin".equalsIgnoreCase(cleanUsername)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Root administrator account 'admin' cannot be deleted."));
        }

        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(cleanUsername);
        if (userOpt.isPresent()) {
            userRepository.delete(userOpt.get());
            return ResponseEntity.ok(Map.of("message", "User " + username + " successfully removed from database"));
        }

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found in database"));
    }

    @PostMapping("/grant-user")
    @Transactional
    public ResponseEntity<?> grantTemporaryUser(@RequestBody GrantUserAccessRequest req) {
        if (req.getUsername() == null || req.getPassword() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Username and password are required for temporary grant"));
        }

        long durationSec = req.getDurationSeconds() != null && req.getDurationSeconds() > 0
            ? req.getDurationSeconds()
            : 900L;

        OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(durationSec);

        String role = req.getRole() != null ? req.getRole().toUpperCase() : "VIEWER";
        List<String> perms = req.getPermissions() != null && !req.getPermissions().isEmpty()
            ? req.getPermissions()
            : defaultPermissionsForRole(role);

        String username = req.getUsername().trim();
        String fullName = req.getFullName() != null && !req.getFullName().isBlank()
            ? req.getFullName().trim()
            : "Granted User (" + username + ")";

        User user = userRepository.findByUsernameIgnoreCase(username)
            .orElseGet(() -> User.builder()
                .keycloakId(UUID.randomUUID().toString())
                .username(username)
                .email(username.toLowerCase() + "@temporary-access.local")
                .status("ACTIVE")
                .build());

        user.setFullName(fullName);
        user.setPasswordHash(req.getPassword());
        user.setRole(role);
        user.setPermissions(String.join(",", perms));
        user.setAccessibleMenus("/documents,/search");
        user.setAssignedFolderIds("");
        user.setIsTemporary(true);
        user.setDurationSeconds(durationSec);
        user.setExpiresAt(expiresAt);

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
            "message", "Temporary user access granted successfully",
            "username", username,
            "role", role,
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

        String username = claims.getClaim("preferred_username") != null
            ? claims.getClaim("preferred_username").toString()
            : "admin";

        List<String> menus = List.of("/documents", "/search");
        Optional<User> dbUser = userRepository.findByUsernameIgnoreCase(username);
        if (dbUser.isPresent()) {
            menus = parseCsvList(dbUser.get().getAccessibleMenus(), defaultMenusForRole(dbUser.get().getRole()));
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("id", claims.getSubject() != null ? claims.getSubject() : "usr-unknown");
        resp.put("username", username);
        resp.put("fullName", claims.getClaim("name") != null ? claims.getClaim("name") : "User");
        resp.put("email", claims.getClaim("email") != null ? claims.getClaim("email") : "");
        resp.put("role", claims.getClaim("role") != null ? claims.getClaim("role") : "VIEWER");
        resp.put("permissions", permissions);
        resp.put("assignedFolderIds", folders);
        resp.put("accessibleMenus", menus);
        resp.put("isTemporaryAccess", Boolean.TRUE.equals(isTemporary));
        resp.put("remainingSeconds", remainingSec);
        resp.put("expiresAt", expiry != null ? expiry.toInstant().atOffset(ZoneOffset.UTC) : null);
        return ResponseEntity.ok(resp);
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
