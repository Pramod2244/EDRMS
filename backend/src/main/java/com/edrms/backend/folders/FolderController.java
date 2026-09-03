package com.edrms.backend.folders;

import com.edrms.backend.folders.dto.CreateFolderRequest;
import com.edrms.backend.users.User;
import com.edrms.backend.users.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/folders")
public class FolderController {

    private final FolderService folderService;
    private final UserService userService;

    public FolderController(FolderService folderService, UserService userService) {
        this.folderService = folderService;
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<Folder>> getRootFolders() {
        return ResponseEntity.ok(folderService.getRootFolders());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Folder> getFolderById(@PathVariable UUID id) {
        return folderService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/children")
    public ResponseEntity<List<Folder>> getSubFolders(@PathVariable UUID id) {
        return ResponseEntity.ok(folderService.getSubFolders(id));
    }

    @PostMapping
    public ResponseEntity<Folder> createFolder(@Valid @RequestBody CreateFolderRequest request) {
        User currentUser = userService.syncCurrentUser();
        Folder folder = folderService.createFolder(request.getName(), request.getParentId(), currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(folder);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable UUID id) {
        folderService.deleteFolder(id);
        return ResponseEntity.noContent().build();
    }
}
