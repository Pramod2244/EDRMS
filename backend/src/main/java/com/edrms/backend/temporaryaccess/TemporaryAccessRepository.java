package com.edrms.backend.temporaryaccess;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TemporaryAccessRepository extends JpaRepository<TemporaryAccessGrant, UUID> {
    Optional<TemporaryAccessGrant> findByTokenHashAndIsRevokedFalse(String tokenHash);
}
