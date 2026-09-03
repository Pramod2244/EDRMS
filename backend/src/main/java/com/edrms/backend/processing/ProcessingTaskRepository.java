package com.edrms.backend.processing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProcessingTaskRepository extends JpaRepository<ProcessingTask, UUID> {
    List<ProcessingTask> findByDocumentId(UUID documentId);
    List<ProcessingTask> findByStatus(String status);
}
