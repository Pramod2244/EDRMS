package com.edrms.backend.processing;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.UUID;

@Getter
@AllArgsConstructor
public class DocumentIngestedEvent {
    private final UUID documentId;
    private final UUID userId;
}
