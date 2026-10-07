package com.edrms.backend.folders;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class FolderNumberingFormatTest {
    private final LocalDate date = LocalDate.of(2025, 10, 7);
    private FolderNumberingService.Settings settings(String mode, int padding, long next) {
        return new FolderNumberingService.Settings("ADMISSION", mode, padding, next, 0);
    }

    @Test void formatsEverySupportedDateModeExactly() {
        assertEquals("ADMISSION-1001", FolderNumberingService.format(settings("NONE", 4, 1001), date));
        assertEquals("ADMISSION-2025-1001", FolderNumberingService.format(settings("YEAR", 4, 1001), date));
        assertEquals("ADMISSION-2025-10-1001", FolderNumberingService.format(settings("YEAR_MONTH", 4, 1001), date));
        assertEquals("ADMISSION-2025-10-07-1001", FolderNumberingService.format(settings("YEAR_MONTH_DAY", 4, 1001), date));
    }

    @Test void padsSmallNumbersWithoutTruncatingLargeNumbers() {
        assertEquals("ADMISSION-0000001001", FolderNumberingService.format(settings("NONE", 10, 1001), date));
        assertEquals("ADMISSION-10000", FolderNumberingService.format(settings("NONE", 4, 10000), date));
        assertEquals("ADMISSION-1", FolderNumberingService.format(settings("NONE", 1, 1), date));
    }

    @Test void rejectsMalformedOrUnsafePrefixes() {
        for (String prefix : List.of("a", "admission", "1ADMISSION", "ADMISSION/TEST", "ADMISSION-TEST", " ", "A".repeat(41))) {
            assertThrows(IllegalArgumentException.class, () -> FolderNumberingService.validate(
                new FolderNumberingService.Settings(prefix, "NONE", 4, 1001, 0)), prefix);
        }
        assertThrows(IllegalArgumentException.class, () -> FolderNumberingService.validate(null));
    }

    @Test void rejectsInvalidDateModesAndPadding() {
        assertThrows(IllegalArgumentException.class, () -> FolderNumberingService.validate(settings("CUSTOM", 4, 1001)));
        assertThrows(IllegalArgumentException.class, () -> FolderNumberingService.validate(settings(null, 4, 1001)));
        assertThrows(IllegalArgumentException.class, () -> FolderNumberingService.validate(settings("NONE", 0, 1001)));
        assertThrows(IllegalArgumentException.class, () -> FolderNumberingService.validate(settings("NONE", 11, 1001)));
    }

    @Test void rejectsInvalidSequenceRange() {
        assertThrows(IllegalArgumentException.class, () -> FolderNumberingService.validate(settings("NONE", 4, 0)));
        assertThrows(IllegalArgumentException.class, () -> FolderNumberingService.validate(settings("NONE", 4, -1)));
        assertThrows(IllegalArgumentException.class, () -> FolderNumberingService.validate(settings("NONE", 4, FolderNumberingService.LIMIT + 1)));
    }

    @Test void dateBoundaryKeepsDistinctFormattedReferences() {
        var old = FolderNumberingService.format(settings("YEAR_MONTH_DAY", 4, 1001), LocalDate.of(2025, 12, 31));
        var next = FolderNumberingService.format(settings("YEAR_MONTH_DAY", 4, 1002), LocalDate.of(2026, 1, 1));
        assertEquals("ADMISSION-2025-12-31-1001", old);
        assertEquals("ADMISSION-2026-01-01-1002", next);
    }
}
