package com.edrms.backend.documents;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface MobileCaptureLinkRepository extends JpaRepository<MobileCaptureLink,UUID> {
    Optional<MobileCaptureLink> findByTokenHash(String hash);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from MobileCaptureLink s where s.tokenHash = :hash")
    Optional<MobileCaptureLink> lockByHash(@Param("hash") String hash);
}
