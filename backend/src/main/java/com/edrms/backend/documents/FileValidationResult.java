package com.edrms.backend.documents;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileValidationResult {
    private String sanitizedFilename;
    private String extension;
    private String detectedMimeType;
    private long sizeBytes;
    private String checksumSha256;
    private boolean isDuplicate;
}
