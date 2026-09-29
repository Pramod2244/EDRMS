package com.edrms.backend.documents;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileValidationServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    private MalwareScanner malwareScanner;
    private FileValidationService fileValidationService;

    @BeforeEach
    void setUp() {
        malwareScanner = new LocalDevMalwareScanner();
        fileValidationService = new FileValidationService(documentRepository, malwareScanner);
    }

    @Test
    void testSanitizeFilename() {
        String unsafe = "../../secret/invoice#1.pdf";
        String sanitized = fileValidationService.sanitizeFilename(unsafe);
        assertEquals("invoice#1.pdf", sanitized);
        assertFalse(sanitized.contains(".."));
        assertFalse(sanitized.contains("/"));
    }

    @Test
    void testDisallowedExtensionRejected() {
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "malicious.sh",
            "application/x-sh",
            "#!/bin/bash\necho hello".getBytes()
        );

        assertThrows(IllegalArgumentException.class, () -> {
            fileValidationService.validateAndInspect(file);
        });
    }

    @Test
    void testValidTextFileInspection() throws IOException {
        when(documentRepository.existsByChecksumSha256AndIsDeletedFalse(anyString())).thenReturn(false);

        byte[] content = "Hello EDRMS Document Management System!".getBytes();
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "test_document.txt",
            "text/plain",
            content
        );

        FileValidationResult result = fileValidationService.validateAndInspect(file);

        assertNotNull(result);
        assertEquals("test_document.txt", result.getSanitizedFilename());
        assertEquals("txt", result.getExtension());
        assertNotNull(result.getChecksumSha256());
        assertEquals(64, result.getChecksumSha256().length());
        assertFalse(result.isDuplicate());
    }
}
