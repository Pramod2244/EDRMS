package com.edrms.backend.documents;
import com.edrms.backend.configuration.ApplicationSettingsService;
import com.edrms.backend.roles.RoleCatalogService;
import com.edrms.backend.users.User;
import com.edrms.backend.folders.*;
import com.edrms.backend.storage.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class RecycleBinServiceTest {
    final DocumentRepository documents=mock(DocumentRepository.class);final FolderRepository folders=mock(FolderRepository.class);final RoleCatalogService access=mock(RoleCatalogService.class);final ApplicationSettingsService settings=mock(ApplicationSettingsService.class);final JdbcTemplate db=mock(JdbcTemplate.class);final ApplicationEventPublisher events=mock(ApplicationEventPublisher.class);final StorageService storage=mock(StorageService.class);final StorageProvider provider=mock(StorageProvider.class);
    final RecycleBinService service=new RecycleBinService(documents,folders,access,settings,db,events,storage);
    final User user=User.builder().id(UUID.randomUUID()).role("SUPER_ADMIN").build();
    Document doc;
    @BeforeEach void setup(){doc=Document.builder().id(UUID.randomUUID()).folderId(UUID.randomUUID()).name("test.pdf").storageProvider("LOCAL").storageKey("Repository/test.pdf").build();when(access.requireUser()).thenReturn(user);when(documents.lockById(doc.getId())).thenReturn(Optional.of(doc));when(settings.retentionDays()).thenReturn(30);when(folders.findById(doc.getFolderId())).thenReturn(Optional.of(Folder.builder().isDeleted(false).build()));when(storage.getProvider(StorageProviderType.LOCAL)).thenReturn(provider);when(provider.exists(doc.getStorageKey())).thenReturn(true);}
    @Test void deletionKeepsFilesAndSetsThirtyDayDeadline(){var before=OffsetDateTime.now();service.move(doc.getId());var deadline=ArgumentCaptor.forClass(OffsetDateTime.class);verify(db).update(eq("UPDATE documents SET is_deleted=true,deleted_at=?,deleted_by=?,purge_after=?,updated_at=? WHERE id=?"),any(OffsetDateTime.class),eq(user.getId()),deadline.capture(),any(OffsetDateTime.class),eq(doc.getId()));assertFalse(deadline.getValue().isBefore(before.plusDays(30)));assertFalse(deadline.getValue().isAfter(OffsetDateTime.now().plusDays(30)));verifyNoInteractions(storage);}
    @Test void repeatedDeleteDoesNotExtendDeadline(){doc.setIsDeleted(true);service.move(doc.getId());verifyNoInteractions(db,events,settings);}
    @Test void restoresOriginalDocumentBeforeDeadline(){doc.setIsDeleted(true);doc.setPurgeAfter(OffsetDateTime.now().plusDays(2));service.restore(doc.getId());verify(db).update(eq("UPDATE documents SET is_deleted=false,deleted_at=null,deleted_by=null,purge_after=null,updated_at=CURRENT_TIMESTAMP WHERE id=?"),eq(doc.getId()));verify(events).publishEvent(new RecycleBinService.Change(doc.getId(),true));verify(provider,never()).delete(anyString());}
    @Test void cannotRestoreExpiredDocument(){doc.setIsDeleted(true);doc.setPurgeAfter(OffsetDateTime.now().minusSeconds(1));assertThrows(IllegalArgumentException.class,()->service.restore(doc.getId()));verifyNoInteractions(db,storage);}
    @Test void cannotRestoreIntoDeletedFolder(){doc.setIsDeleted(true);doc.setPurgeAfter(OffsetDateTime.now().plusDays(1));when(folders.findById(doc.getFolderId())).thenReturn(Optional.of(Folder.builder().isDeleted(true).build()));assertThrows(IllegalArgumentException.class,()->service.restore(doc.getId()));verifyNoInteractions(db,storage);}
    @Test void cannotRestoreMissingOriginal(){doc.setIsDeleted(true);doc.setPurgeAfter(OffsetDateTime.now().plusDays(1));when(provider.exists(doc.getStorageKey())).thenReturn(false);assertThrows(IllegalArgumentException.class,()->service.restore(doc.getId()));verifyNoInteractions(db);}
    @Test void exactFolderPermissionsAreEnforced(){user.setRole("CONTRIBUTOR");user.setPermissions("DELETE");user.setAssignedFolderIds(UUID.randomUUID().toString());assertThrows(SecurityException.class,()->service.move(doc.getId()));verifyNoInteractions(db);}
    @Test void deletePermissionIsRequired(){user.setRole("VIEWER");assertThrows(SecurityException.class,()->service.move(doc.getId()));verifyNoInteractions(documents,db);}
}
