package com.edrms.backend.folders;

import com.edrms.backend.users.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class FolderService {

    private final FolderRepository folderRepository;
    private final FolderNumberingService numbering;

    public FolderService(FolderRepository folderRepository, FolderNumberingService numbering) {
        this.folderRepository = folderRepository;
        this.numbering = numbering;
    }

    public List<Folder> getAllFolders() {
        return folderRepository.findByIsDeletedFalse();
    }

    public List<Folder> getRootFolders() {
        return folderRepository.findByParentIdIsNullAndIsDeletedFalse();
    }

    public List<Folder> getSubFolders(UUID parentId) {
        return folderRepository.findByParentIdAndIsDeletedFalse(parentId);
    }

    public Optional<Folder> findById(UUID id) {
        return folderRepository.findById(id).filter(f -> !f.getIsDeleted());
    }

    @Transactional
    public Folder createFolder(String name, UUID parentId, User owner) {
        String materializedPath = "/";
        int depth = 0;

        if (parentId != null) {
            Folder parent = folderRepository.findById(parentId)
                .orElseThrow(() -> new IllegalArgumentException("Parent folder not found: " + parentId));
            materializedPath = parent.getMaterializedPath() + parent.getId() + "/";
            depth = parent.getDepth() + 1;
        }

        Folder folder = Folder.builder()
            .name(name)
            .parentId(parentId)
            .materializedPath(materializedPath)
            .depth(depth)
            .ownerId(owner.getId())
            .isDeleted(false)
            .build();

        Folder saved=folderRepository.saveAndFlush(folder);
        numbering.initialize(saved.getId());
        return saved;
    }

    @Transactional
    public void deleteFolder(UUID id) {
        folderRepository.findById(id).ifPresent(f -> {
            f.setIsDeleted(true);
            folderRepository.save(f);
            // Cascade soft delete to all descendants in materialized path
            List<Folder> descendants = folderRepository.findByMaterializedPathStartingWithAndIsDeletedFalse(
                f.getMaterializedPath() + f.getId() + "/"
            );
            descendants.forEach(d -> d.setIsDeleted(true));
            folderRepository.saveAll(descendants);
        });
    }

    public String getFolderHierarchyPath(UUID folderId) {
        if (folderId == null) {
            return "Repository";
        }

        java.util.List<String> segments = new java.util.ArrayList<>();
        UUID currentId = folderId;
        int maxGuard = 50;

        while (currentId != null && maxGuard-- > 0) {
            java.util.Optional<Folder> folderOpt = folderRepository.findById(currentId);
            if (folderOpt.isEmpty()) break;
            Folder f = folderOpt.get();
            String safeName = sanitizeFolderName(f.getName());
            if (!safeName.isBlank()) {
                segments.add(0, safeName);
            }
            currentId = f.getParentId();
        }

        if (segments.isEmpty()) {
            return "Repository";
        }

        if (segments.get(0).equalsIgnoreCase("Repository")) {
            return String.join("/", segments);
        }

        return "Repository/" + String.join("/", segments);
    }

    private String sanitizeFolderName(String name) {
        if (name == null || name.isBlank()) return "Folder";
        return name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    }
}
