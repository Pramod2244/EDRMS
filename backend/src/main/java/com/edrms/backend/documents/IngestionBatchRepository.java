package com.edrms.backend.documents;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface IngestionBatchRepository extends JpaRepository<IngestionBatch, UUID> {
    Optional<IngestionBatch> findByBatchNumber(String batchNumber);
}
