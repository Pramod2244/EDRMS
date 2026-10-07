package com.edrms.backend.documents;

import com.edrms.backend.configuration.ApplicationSettingsService;
import com.edrms.backend.roles.RoleCatalogService;
import com.edrms.backend.users.User;
import com.edrms.backend.folders.FolderRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.*;
import java.time.*;
import java.util.*;

@Service
public class RecycleBinService {
    public record Change(UUID id,boolean restored) {}
    public record Item(UUID id,String name,String referenceId,UUID folderId,String folderName,long fileSizeBytes,OffsetDateTime deletedAt,OffsetDateTime purgeAfter,boolean canRestore) {}
    private final DocumentRepository documents;
    private final FolderRepository folders;
    private final RoleCatalogService access;
    private final ApplicationSettingsService settings;
    private final JdbcTemplate db;
    private final ApplicationEventPublisher events;
    private final com.edrms.backend.storage.StorageService storage;
    public RecycleBinService(DocumentRepository documents,FolderRepository folders,RoleCatalogService access,ApplicationSettingsService settings,JdbcTemplate db,ApplicationEventPublisher events,com.edrms.backend.storage.StorageService storage){this.documents=documents;this.folders=folders;this.access=access;this.settings=settings;this.db=db;this.events=events;this.storage=storage;}
    private User requireDelete() {User user=access.requireUser();if(!"SUPER_ADMIN".equals(user.getRole())&&!RoleCatalogService.split(user.getPermissions()).contains("DELETE"))throw new SecurityException("Delete permission is required");return user;}
    private void checkFolder(User user,UUID id) {var assigned=RoleCatalogService.split(user.getAssignedFolderIds());if(!"SUPER_ADMIN".equals(user.getRole())&&!assigned.isEmpty()&&!assigned.contains(id.toString()))throw new SecurityException("Folder access is required");}
    public Page<Item> list(int page,int size,String term) {
        User user=requireDelete();var assigned=RoleCatalogService.split(user.getAssignedFolderIds()).stream().map(UUID::fromString).toList();boolean all="SUPER_ADMIN".equals(user.getRole())||assigned.isEmpty();
        var result=documents.recyclePage(all,assigned.isEmpty()?List.of(new UUID(0,0)):assigned,Objects.toString(term,""),PageRequest.of(Math.max(0,page),Math.max(1,Math.min(50,size))));
        Map<UUID,String> names=new HashMap<>();folders.findAllById(result.stream().map(Document::getFolderId).distinct().toList()).forEach(f->names.put(f.getId(),f.getName()));
        OffsetDateTime now=OffsetDateTime.now();return result.map(d->new Item(d.getId(),d.getName(),d.getReferenceId(),d.getFolderId(),names.getOrDefault(d.getFolderId(),"Unavailable folder"),d.getFileSizeBytes(),d.getDeletedAt(),d.getPurgeAfter(),d.getPurgeAfter()!=null&&d.getPurgeAfter().isAfter(now)));
    }
    @Transactional public void move(UUID id) {
        User user=requireDelete();Document doc=documents.lockById(id).orElseThrow(()->new IllegalArgumentException("Document not found"));checkFolder(user,doc.getFolderId());
        if(Boolean.TRUE.equals(doc.getIsDeleted()))return;
        OffsetDateTime now=OffsetDateTime.now();db.update("UPDATE documents SET is_deleted=true,deleted_at=?,deleted_by=?,purge_after=?,updated_at=? WHERE id=?",now,user.getId(),now.plusDays(settings.retentionDays()),now,id);
        events.publishEvent(new Change(id,false));
    }
    @Transactional public void restore(UUID id) {
        User user=requireDelete();Document doc=documents.lockById(id).orElseThrow(()->new IllegalArgumentException("Document not found"));checkFolder(user,doc.getFolderId());
        if(!Boolean.TRUE.equals(doc.getIsDeleted()))return;
        if(doc.getPurgedAt()!=null||doc.getPurgeAfter()==null||!doc.getPurgeAfter().isAfter(OffsetDateTime.now()))throw new IllegalArgumentException("The recovery period has expired. This document cannot be restored.");
        if(folders.findById(doc.getFolderId()).filter(f->!Boolean.TRUE.equals(f.getIsDeleted())).isEmpty())throw new IllegalArgumentException("The original folder is unavailable. Contact your administrator before restoring.");
        if(!storage.getProvider(com.edrms.backend.storage.StorageProviderType.valueOf(doc.getStorageProvider())).exists(doc.getStorageKey()))throw new IllegalArgumentException("The original file is unavailable. Ask your administrator to check storage before restoring.");
        db.update("UPDATE documents SET is_deleted=false,deleted_at=null,deleted_by=null,purge_after=null,updated_at=CURRENT_TIMESTAMP WHERE id=?",id);
        events.publishEvent(new Change(id,true));
    }
}
