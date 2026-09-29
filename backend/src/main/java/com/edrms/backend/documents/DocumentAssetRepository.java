package com.edrms.backend.documents;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentAssetRepository extends JpaRepository<DocumentAsset, UUID> {
    List<DocumentAsset> findByDocumentId(UUID documentId);
    List<DocumentAsset> findByDocumentVersionId(UUID documentVersionId);
    Optional<DocumentAsset> findByDocumentIdAndAssetType(UUID documentId, String assetType);
    Optional<DocumentAsset> findByDocumentVersionIdAndAssetType(UUID documentVersionId, String assetType);
    Optional<DocumentAsset> findByDocumentPageIdAndAssetType(UUID documentPageId, String assetType);
}
