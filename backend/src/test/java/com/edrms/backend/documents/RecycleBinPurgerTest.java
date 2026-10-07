package com.edrms.backend.documents;
import com.edrms.backend.storage.*;
import org.springframework.jdbc.core.*;
import org.junit.jupiter.api.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class RecycleBinPurgerTest {
    final DocumentRepository documents=mock(DocumentRepository.class);final JdbcTemplate db=mock(JdbcTemplate.class);final StorageService storage=mock(StorageService.class);final StorageProvider provider=mock(StorageProvider.class);final RecycleBinPurger purger=new RecycleBinPurger(documents,db,storage);Document doc;
    @BeforeEach void setup(){doc=Document.builder().id(UUID.randomUUID()).isDeleted(true).purgeAfter(OffsetDateTime.now().minusDays(1)).storageProvider("NAS").storageKey("Repository/test.pdf").build();when(documents.lockById(doc.getId())).thenReturn(Optional.of(doc));when(storage.getProvider(StorageProviderType.NAS)).thenReturn(provider);when(db.queryForObject(anyString(),eq(Long.class),eq(doc.getId()))).thenReturn(0L);}
    @Test void skipsRecoverableDocument(){doc.setPurgeAfter(OffsetDateTime.now().plusDays(1));purger.purge(doc.getId());verifyNoInteractions(db,storage);}
    @Test void failedStorageDeletionKeepsMetadataForRetry(){doThrow(new IllegalStateException("NAS unavailable")).when(provider).delete(doc.getStorageKey());assertThrows(IllegalStateException.class,()->purger.purge(doc.getId()));verify(db,never()).update(anyString(),any(UUID.class));}
    @Test void expiredFilesAreDeletedFromRecordedProvider(){purger.purge(doc.getId());verify(provider).delete(doc.getStorageKey());verify(db).update(eq("UPDATE documents SET purged_at=CURRENT_TIMESTAMP,status='PURGED',updated_at=CURRENT_TIMESTAMP WHERE id=?"),eq(doc.getId()));verify(documents,never()).delete(any());}
    @Test void skipsActiveProcessing(){when(db.queryForObject(anyString(),eq(Long.class),eq(doc.getId()))).thenReturn(1L);purger.purge(doc.getId());verifyNoInteractions(storage);}
}
