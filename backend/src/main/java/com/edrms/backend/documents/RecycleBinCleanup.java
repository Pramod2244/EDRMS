package com.edrms.backend.documents;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.*;
import java.util.UUID;
@Component
public class RecycleBinCleanup {
    private static final Logger log=LoggerFactory.getLogger(RecycleBinCleanup.class);
    private final JdbcTemplate db;private final RecycleBinPurger purger;
    public RecycleBinCleanup(JdbcTemplate db,RecycleBinPurger purger){this.db=db;this.purger=purger;}
    @Scheduled(initialDelay=60000,fixedDelay=3600000)
    public void clean(){
        var ids=db.query("SELECT id FROM documents WHERE is_deleted=true AND purged_at IS NULL AND purge_after<=CURRENT_TIMESTAMP AND NOT EXISTS (SELECT 1 FROM processing_jobs j WHERE j.document_id=documents.id AND j.status IN ('PENDING','RUNNING')) ORDER BY coalesce(purge_attempted_at,'1970-01-01'::timestamptz),purge_after LIMIT 25",(row,index)->row.getObject(1,UUID.class));
        for(UUID id:ids)try{db.update("UPDATE documents SET purge_attempted_at=CURRENT_TIMESTAMP WHERE id=?",id);purger.purge(id);}catch(RuntimeException failure){log.warn("Recycle cleanup will retry document {}: {}",id,failure.getMessage());}
    }
}
