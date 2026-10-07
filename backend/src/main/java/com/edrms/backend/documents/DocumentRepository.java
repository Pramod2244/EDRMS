package com.edrms.backend.documents;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select d from Document d where d.id=:id")
    java.util.Optional<Document> lockById(@org.springframework.data.repository.query.Param("id") UUID id);
    @org.springframework.data.jpa.repository.Query("select d from Document d where d.isDeleted=true and d.purgedAt is null and (:allFolders=true or d.folderId in :folders) and (lower(d.name) like lower(concat('%',:term,'%')) or lower(coalesce(d.referenceId,'')) like lower(concat('%',:term,'%'))) order by d.deletedAt desc")
    Page<Document> recyclePage(@org.springframework.data.repository.query.Param("allFolders") boolean allFolders,@org.springframework.data.repository.query.Param("folders") List<UUID> folders,@org.springframework.data.repository.query.Param("term") String term,Pageable pageable);
    Page<Document> findByFolderIdAndIsDeletedFalse(UUID folderId, Pageable pageable);
    List<Document> findByFolderIdAndIsDeletedFalse(UUID folderId);
    List<Document> findByNameContainingIgnoreCaseAndIsDeletedFalse(String name);
    List<Document> findByStatus(String status);
    boolean existsByChecksumSha256AndIsDeletedFalse(String checksumSha256);
    List<Document> findByChecksumSha256AndIsDeletedFalse(String checksumSha256);
}
