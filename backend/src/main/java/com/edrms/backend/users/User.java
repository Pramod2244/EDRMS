package com.edrms.backend.users;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "keycloak_id", nullable = false, unique = true, length = 64)
    private String keycloakId;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(nullable = false)
    private String email;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "role", length = 50)
    @Builder.Default
    private String role = "CONTRIBUTOR";

    @Column(name = "assigned_folder_ids", columnDefinition = "TEXT")
    @Builder.Default
    private String assignedFolderIds = "";

    @Column(name = "accessible_menus", columnDefinition = "TEXT")
    @Builder.Default
    private String accessibleMenus = "/documents,/search";

    @Column(name = "permissions", columnDefinition = "TEXT")
    @Builder.Default
    private String permissions = "";

    @Column(name = "is_temporary")
    @Builder.Default
    private Boolean isTemporary = false;

    @Column(name = "duration_seconds")
    private Long durationSeconds;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "ACTIVE";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
