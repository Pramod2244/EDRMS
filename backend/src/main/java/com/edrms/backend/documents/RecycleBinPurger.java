package com.edrms.backend.documents;

import com.edrms.backend.storage.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class RecycleBinPurger {
    private final DocumentRepository documents;private final JdbcTemplate db;private final StorageService storage;
    public RecycleBinPurger(DocumentRepository documents,JdbcTemplate db,StorageService storage){this.documents=documents;this.db=db;this.storage=storage;}
    @Transactional public void purge(UUID id) {
        var doc=documents.lockById(id).orElse(null);
        if(doc==null||!Boolean.TRUE.equals(doc.getIsDeleted())||doc.getPurgedAt()!=null||doc.getPurgeAfter()==null||doc.getPurgeAfter().isAfter(OffsetDateTime.now()))return;
        // Do not race a still-running ingestion job that may be writing assets.
        if(db.queryForObject("SELECT count(*) FROM processing_jobs WHERE document_id=? AND status IN ('PENDING','RUNNING')",Long.class,id)>0)return;
        record FileKey(String provider,String key) {}
        Set<FileKey> files=new LinkedHashSet<>();files.add(new FileKey(doc.getStorageProvider(),doc.getStorageKey()));
        files.addAll(db.query("SELECT storage_provider,storage_key FROM document_assets WHERE document_id=? UNION SELECT storage_provider,storage_key FROM document_versions WHERE document_id=?",(row,index)->new FileKey(row.getString(1),row.getString(2)),id,id));
        // Each provider validates its keys. A storage failure leaves the item expired and retryable.
        for(var file:files)storage.getProvider(StorageProviderType.valueOf(file.provider())).delete(file.key());
        db.update("DELETE FROM document_assets WHERE document_id=?",id);
        db.update("DELETE FROM document_pages WHERE document_id=?",id);
        db.update("DELETE FROM document_versions WHERE document_id=?",id);
        db.update("UPDATE documents SET purged_at=CURRENT_TIMESTAMP,status='PURGED',updated_at=CURRENT_TIMESTAMP WHERE id=?",id);
        // Keep the document tombstone/reference ID and audit history; never recycle its ID.
    }
}
