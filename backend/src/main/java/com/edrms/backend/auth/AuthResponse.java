package com.edrms.backend.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    @Builder.Default
    private String tokenType = "Bearer";
    private Long expiresInSeconds;
    private OffsetDateTime expiresAt;
    private boolean isTemporaryAccess;
    private UserProfile user;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserProfile {
        private String id;
        private String username;
        private String fullName;
        private String email;
        private String role;
        private List<String> permissions;
        @Builder.Default
        private List<String> assignedFolderIds = new java.util.ArrayList<>();
        @Builder.Default
        private List<String> accessibleMenus = new java.util.ArrayList<>();
    }
}
