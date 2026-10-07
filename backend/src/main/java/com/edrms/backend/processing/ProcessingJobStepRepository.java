package com.edrms.backend.processing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProcessingJobStepRepository extends JpaRepository<ProcessingJobStep, UUID> {
    List<ProcessingJobStep> findByProcessingJobIdOrderByStartedAtAsc(UUID processingJobId);
}
