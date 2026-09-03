package com.edrms.backend.documents;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {
    Page<Document> findByFolderIdAndIsDeletedFalse(UUID folderId, Pageable pageable);
    List<Document> findByFolderIdAndIsDeletedFalse(UUID folderId);
    List<Document> findByStatus(String status);
}
