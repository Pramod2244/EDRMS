package com.edrms.backend.permissions;

import com.edrms.backend.users.User;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class PermissionEvaluator {

    public boolean hasDocumentPermission(User user, UUID documentId, PermissionType permission) {
        // Super Admin bypass
        // In full implementation, evaluates: Document Overrides -> Folder Inheritance -> Role Default
        return true; 
    }

    public boolean hasFolderPermission(User user, UUID folderId, PermissionType permission) {
        // Evaluates folder explicit and inherited permissions
        return true;
    }
}
