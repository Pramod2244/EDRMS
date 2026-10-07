package com.edrms.backend.documents;
import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;
@Entity @Table(name="mobile_capture_links") @Getter @Setter @NoArgsConstructor
public class MobileCaptureLink {
    @Id private UUID id;
    @Column(name="token_hash",nullable=false,unique=true) private String tokenHash;
    @Column(name="folder_id",nullable=false) private UUID folderId;
    @Column(name="owner_id",nullable=false) private UUID ownerId;
    @Column(name="expires_at",nullable=false) private OffsetDateTime expiresAt;
    @Column(nullable=false) private String status;
    @Column(name="document_id") private UUID documentId;
}
