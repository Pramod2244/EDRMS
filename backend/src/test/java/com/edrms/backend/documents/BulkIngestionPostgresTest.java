package com.edrms.backend.documents;

import com.edrms.backend.audit.AuditService;
import com.edrms.backend.folders.*;
import com.edrms.backend.search.SearchService;
import com.edrms.backend.storage.*;
import com.edrms.backend.users.*;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.annotation.DirtiesContext;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real migrations/DB/files/PDF pipeline; isolated schema and temporary storage. Search/audit mocked. */
@SpringBootTest
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfEnvironmentVariable(named="EDRMS_BULK_TEST_URL", matches="jdbc:postgresql://localhost:.+")
class BulkIngestionPostgresTest {
    static String schema;
    static JdbcTemplate administrativeDb;
    static Path storageRoot;
    @Autowired DocumentService service;
    @Autowired DocumentRepository documents;
    @Autowired FolderRepository folders;
    @Autowired UserRepository users;
    @Autowired StorageService storage;
    @Autowired JdbcTemplate db;
    @MockBean SearchService search;
    @MockBean AuditService audit;

    @DynamicPropertySource static void isolatedProperties(DynamicPropertyRegistry properties) throws IOException {
        String url=System.getenv("EDRMS_BULK_TEST_URL");
        String username=System.getenv("EDRMS_NUMBERING_TEST_USER");
        String password=System.getenv("EDRMS_NUMBERING_TEST_PASSWORD");
        schema="bulk_test_"+UUID.randomUUID().toString().replace("-", "");
        administrativeDb=new JdbcTemplate(new DriverManagerDataSource(url,username,password));
        administrativeDb.execute("CREATE SCHEMA "+schema);
        storageRoot=Files.createTempDirectory("edrms-bulk-test-").toAbsolutePath().normalize();
        properties.add("spring.datasource.url",()->url+(url.contains("?")?"&":"?")+"currentSchema="+schema);
        properties.add("spring.datasource.username",()->username);
        properties.add("spring.datasource.password",()->password);
        properties.add("spring.flyway.default-schema",()->schema);
        properties.add("spring.flyway.schemas",()->schema);
        properties.add("edrms.storage.local.root-path",()->storageRoot.toString());
        properties.add("edrms.storage.nas.root-path",()->storageRoot.resolve("unused-nas").toString());
        properties.add("edrms.storage.active-provider",()->"LOCAL");
        properties.add("edrms.ocr.active-engine",()->"LOCAL_TESSERACT");
    }

    @AfterAll void removeIsolatedResources() throws IOException {
        // All jobs settle before successful test completion. Spring closes the test context.
        // Never resolve or delete repository storage.
        administrativeDb.execute("DROP SCHEMA "+schema+" CASCADE");
        Path tempRoot=Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
        if(storageRoot.startsWith(tempRoot)&&storageRoot.getFileName().toString().startsWith("edrms-bulk-test-")) {
            try(var paths=Files.walk(storageRoot)) {
                for(Path path:paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }

    @Test void concurrentUploadsPreserveBytesReferencesAndCompleteProcessing() throws Exception {
        var user=users.saveAndFlush(User.builder().keycloakId(UUID.randomUUID().toString())
            .username("qa-bulk").email("qa-bulk@example.invalid").status("ACTIVE").role("SUPER_ADMIN").build());
        var folder=folders.saveAndFlush(Folder.builder().name("QA-Bulk").materializedPath("/QA-Bulk/").ownerId(user.getId()).build());
        int count=25;
        var executor=Executors.newFixedThreadPool(8);
        var expected=new ConcurrentHashMap<UUID,byte[]>();
        var ids=new HashSet<UUID>();
        var references=new HashSet<String>();
        List<Future<Document>> futures=new ArrayList<>();
        try {
            for(int i=0;i<count;i++) {
                final int item=i;
                futures.add(executor.submit(()->{
                    byte[] bytes=pdf(item);
                    var document=service.uploadDocument(new MockMultipartFile("file","qa-bulk-"+item+".pdf","application/pdf",bytes),folder.getId(),user);
                    expected.put(document.getId(),MessageDigest.getInstance("SHA-256").digest(bytes));
                    return document;
                }));
            }
            for(var future:futures) {
                var document=future.get(60,TimeUnit.SECONDS);
                assertTrue(ids.add(document.getId()));
                assertTrue(references.add(document.getReferenceId()));
            }
        } finally {executor.shutdownNow();}
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(90);
        long completed;
        do {
            completed=db.queryForObject("SELECT count(*) FROM processing_jobs WHERE status IN ('COMPLETED','FAILED')",Long.class);
            if(completed==count) break;
            TimeUnit.MILLISECONDS.sleep(200);
        } while(System.nanoTime()<deadline);
        var statuses=db.queryForList("SELECT status,count(*) AS count FROM processing_jobs GROUP BY status");
        assertEquals(count,completed,"Processing did not settle: "+statuses);
        assertEquals(count,db.queryForObject("SELECT count(*) FROM processing_jobs WHERE status='COMPLETED'",Integer.class),"Job outcomes: "+statuses);
        assertEquals(count,documents.count());
        assertEquals(1001L+count,db.queryForObject("SELECT next_number FROM folder_numbering WHERE folder_id=?",Long.class,folder.getId()));
        for(UUID id:ids) {
            var document=documents.findById(id).orElseThrow();
            assertEquals("READY",document.getStatus());
            try(var stream=storage.load(StorageProviderType.valueOf(document.getStorageProvider()),document.getStorageKey())) {
                assertArrayEquals(expected.get(id),MessageDigest.getInstance("SHA-256").digest(stream.readAllBytes()));
            }
            assertTrue(db.queryForObject("SELECT count(*) FROM document_pages WHERE document_id=? AND text_content LIKE '%QA ORCHID%'",Integer.class,id)>0);
        }
    }

    private byte[] pdf(int number) throws IOException {
        try(var document=new PDDocument();var output=new ByteArrayOutputStream()) {
            var page=new PDPage();document.addPage(page);
            try(var content=new PDPageContentStream(document,page)) {
                content.beginText();content.setFont(PDType1Font.HELVETICA,12);content.newLineAtOffset(40,700);
                content.showText("QA ORCHID 7401 synthetic admission document "+number+" for isolated bulk validation.");
                content.endText();
            }
            document.save(output);return output.toByteArray();
        }
    }
}
