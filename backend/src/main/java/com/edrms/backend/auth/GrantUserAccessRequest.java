package com.edrms.backend.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GrantUserAccessRequest {
    private String username;
    private String password;
    private String fullName;
    @Builder.Default
    private String role = "VIEWER";
    @Builder.Default
    private Long durationSeconds = 900L; // default 15 minutes
    private List<String> permissions;
}
