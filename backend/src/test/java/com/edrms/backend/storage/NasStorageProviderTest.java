package com.edrms.backend.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class NasStorageProviderTest {
    @TempDir Path directory;

    @Test void storesAndReadsOnlyConfiguredShare() throws Exception {
        NasStorageProvider provider = new NasStorageProvider(directory.toString());
        byte[] content = "NAS document".getBytes();
        StorageResult result = provider.store("Repository/test.pdf", new ByteArrayInputStream(content),
            StorageMetadata.builder().contentLength((long) content.length).contentType("application/pdf").build());
        assertEquals(StorageProviderType.NAS, result.getProviderType());
        try (var stream = provider.load(result.getStorageKey())) { assertArrayEquals(content, stream.readAllBytes()); }
        assertThrows(SecurityException.class, () -> provider.store("../outside.pdf", new ByteArrayInputStream(content), null));
    }

    @Test void unavailableShareIsNotCreatedOrReplacedWithLocalStorage() {
        Path missing = directory.resolve("unmounted-share");
        NasStorageProvider provider = new NasStorageProvider(missing.toString());
        assertFalse(Files.exists(missing));
        assertThrows(IllegalStateException.class, () -> provider.store("document.pdf", new ByteArrayInputStream(new byte[1]), null));
        assertThrows(IllegalStateException.class, () -> provider.load("document.pdf"));
        assertFalse(Files.exists(missing));
    }
}
