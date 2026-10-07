package com.edrms.backend.documents;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CaptureSessionRepository extends JpaRepository<CaptureSession, UUID> {
    Optional<CaptureSession> findByIdAndStatus(UUID id, String status);
}
