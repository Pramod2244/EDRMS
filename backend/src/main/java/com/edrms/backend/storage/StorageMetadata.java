package com.edrms.backend.storage;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageMetadata {
    private String contentType;
    private long contentLength;
    private String checksumSha256;
    private Map<String, String> userMetadata;
}
