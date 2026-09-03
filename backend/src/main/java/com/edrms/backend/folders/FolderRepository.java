package com.edrms.backend.folders;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FolderRepository extends JpaRepository<Folder, UUID> {
    List<Folder> findByParentIdAndIsDeletedFalse(UUID parentId);
    List<Folder> findByParentIdIsNullAndIsDeletedFalse();
    List<Folder> findByMaterializedPathStartingWithAndIsDeletedFalse(String pathPrefix);
}
