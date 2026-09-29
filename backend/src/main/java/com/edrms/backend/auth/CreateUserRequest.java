package com.edrms.backend.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateUserRequest {
    private String username;
    private String password;
    private String fullName;
    private String email;
    @Builder.Default
    private String role = "VIEWER";
    @Builder.Default
    private List<String> assignedFolderIds = new ArrayList<>();
    @Builder.Default
    private List<String> permissions = new ArrayList<>();
    @JsonProperty("isTemporary")
    private boolean isTemporary;
    private Long durationSeconds;
    @Builder.Default
    private List<String> accessibleMenus = new ArrayList<>();

    @JsonProperty("temporary")
    public void setTemporary(boolean temporary) {
        this.isTemporary = temporary;
    }
}
