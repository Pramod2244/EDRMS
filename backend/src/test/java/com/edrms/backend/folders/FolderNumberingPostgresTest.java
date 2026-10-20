package com.edrms.backend.folders;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in test creates and removes its own schema; never uses repository tables. */
@EnabledIfEnvironmentVariable(named="EDRMS_NUMBERING_TEST_URL",matches=".+")
class FolderNumberingPostgresTest {
    @Test void concurrentUploadsEditsAndPrefixReservationsRemainUnique() throws Exception {
        String schema="numbering_test_"+UUID.randomUUID().toString().replace("-","");
        String url=System.getenv("EDRMS_NUMBERING_TEST_URL"), username=System.getenv("EDRMS_NUMBERING_TEST_USER"),password=System.getenv("EDRMS_NUMBERING_TEST_PASSWORD");
        var admin=new DriverManagerDataSource(url,username,password);var adminDb=new JdbcTemplate(admin);
        adminDb.execute("CREATE SCHEMA "+schema);
        try {
            var source=new DriverManagerDataSource(url+(url.contains("?")?"&":"?")+"currentSchema="+schema,username,password);
            var db=new JdbcTemplate(source);var tx=new TransactionTemplate(new DataSourceTransactionManager(source));
            db.execute("CREATE TABLE folders(id UUID PRIMARY KEY,is_deleted BOOLEAN DEFAULT FALSE)");
            db.execute("CREATE TABLE documents(id UUID PRIMARY KEY)");
            UUID folder=UUID.randomUUID(),other=UUID.randomUUID();db.update("INSERT INTO folders(id) VALUES (?),(?)",folder,other);
            try(var connection=source.getConnection()) { ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V6__folder_document_numbering.sql")); }
            var service=new FolderNumberingService(db);
            var saved=tx.execute(status->service.save(folder,new FolderNumberingService.Settings("MEDDOCS","NONE",4,1001,0)));
            final int concurrentAllocations=200;
            var executor=Executors.newFixedThreadPool(12);
            List<Future<String>> results=new ArrayList<>();
            try {
                for(int i=0;i<concurrentAllocations;i++) results.add(executor.submit(()->tx.execute(status->service.allocate(folder))));
                Set<String> ids=new HashSet<>();for(var result:results) ids.add(result.get(20,TimeUnit.SECONDS));
                assertEquals(concurrentAllocations,ids.size());assertTrue(ids.contains("MEDDOCS-1001"));assertTrue(ids.contains("MEDDOCS-1200"));
            } finally {executor.shutdownNow();}
            var latest=service.get(folder);assertEquals(1201,latest.nextNumber());
            assertThrows(IllegalArgumentException.class,()->tx.execute(status->service.save(folder,new FolderNumberingService.Settings("MEDDOCS","NONE",4,1201,saved.revision()))));
            assertThrows(IllegalArgumentException.class,()->tx.execute(status->service.save(folder,new FolderNumberingService.Settings("MEDDOCS","NONE",4,1001,latest.revision()))));
            tx.execute(status->service.save(folder,new FolderNumberingService.Settings("ADMDOCS","YEAR_MONTH_DAY",4,2000,latest.revision())));
            var otherConfig=service.get(other);
            assertThrows(IllegalArgumentException.class,()->tx.execute(status->service.save(other,new FolderNumberingService.Settings("MEDDOCS","NONE",4,1001,otherConfig.revision()))));
            String dated=tx.execute(status->service.allocate(folder));assertTrue(dated.matches("ADMDOCS-\\d{4}-\\d{2}-\\d{2}-2000"));
            long revision=service.get(folder).revision();
            tx.execute(status->service.save(folder,new FolderNumberingService.Settings("MEDDOCS","NONE",4,2001,revision)));
            assertEquals("MEDDOCS-2001",tx.execute(status->service.allocate(folder)));
            db.update("INSERT INTO documents(id,reference_id) VALUES (?,?)",UUID.randomUUID(),"MEDDOCS-2001");
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->db.update("INSERT INTO documents(id,reference_id) VALUES (?,?)",UUID.randomUUID(),"MEDDOCS-2001"));
            UUID newlyCreated=UUID.randomUUID();db.update("INSERT INTO folders(id) VALUES (?)",newlyCreated);
            tx.execute(status->{service.initialize(newlyCreated);return null;});assertEquals(1001,service.get(newlyCreated).nextNumber());
        } finally {adminDb.execute("DROP SCHEMA "+schema+" CASCADE");}
    }
}
