package com.edrms.backend.documents;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentPageRepository extends JpaRepository<DocumentPage, UUID> {
    List<DocumentPage> findByDocumentIdOrderByPageNumberAsc(UUID documentId);
    List<DocumentPage> findByDocumentIdInOrderByDocumentIdAscPageNumberAsc(List<UUID> documentIds);
    Optional<DocumentPage> findByDocumentIdAndPageNumber(UUID documentId, Integer pageNumber);
    List<DocumentPage> findByTextContentContainingIgnoreCase(String query);
}
