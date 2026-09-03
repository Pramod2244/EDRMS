package com.edrms.backend.processing;

import com.edrms.backend.documents.Document;
import com.edrms.backend.documents.DocumentPage;
import com.edrms.backend.documents.DocumentPageRepository;
import com.edrms.backend.documents.DocumentRepository;
import com.edrms.backend.ocr.OcrResult;
import com.edrms.backend.ocr.OcrService;
import com.edrms.backend.search.SearchService;
import com.edrms.backend.storage.StorageProviderType;
import com.edrms.backend.storage.StorageService;
import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class DocumentPipelineWorker {

    private static final Logger log = LoggerFactory.getLogger(DocumentPipelineWorker.class);

    private final DocumentRepository documentRepository;
    private final DocumentPageRepository pageRepository;
    private final ProcessingTaskRepository taskRepository;
    private final StorageService storageService;
    private final OcrService ocrService;
    private final SearchService searchService;
    private final Tika tika = new Tika();

    public DocumentPipelineWorker(
        DocumentRepository documentRepository,
        DocumentPageRepository pageRepository,
        ProcessingTaskRepository taskRepository,
        StorageService storageService,
        OcrService ocrService,
        SearchService searchService
    ) {
        this.documentRepository = documentRepository;
        this.pageRepository = pageRepository;
        this.taskRepository = taskRepository;
        this.storageService = storageService;
        this.ocrService = ocrService;
        this.searchService = searchService;
    }

    @Async
    @EventListener
    @Transactional
    public void onDocumentIngested(DocumentIngestedEvent event) {
        log.info("Processing pipeline started for document: {}", event.getDocumentId());

        ProcessingTask task = taskRepository.save(ProcessingTask.builder()
            .documentId(event.getDocumentId())
            .taskType("INGESTION_PIPELINE")
            .status("RUNNING")
            .startedAt(OffsetDateTime.now())
            .build());

        try {
            Document doc = documentRepository.findById(event.getDocumentId())
                .orElseThrow(() -> new IllegalStateException("Document not found: " + event.getDocumentId()));

            StorageProviderType providerType = StorageProviderType.valueOf(doc.getStorageProvider());

            // 1. Text extraction & OCR
            List<DocumentPage> pages = new ArrayList<>();
            try (InputStream is = storageService.load(providerType, doc.getStorageKey())) {
                String extractedText = tika.parseToString(is);

                if (extractedText != null && extractedText.trim().length() > 20) {
                    // Digital document text
                    DocumentPage page = pageRepository.save(DocumentPage.builder()
                        .documentId(doc.getId())
                        .pageNumber(1)
                        .textContent(extractedText)
                        .ocrConfidence(100.0)
                        .pageWidth(1000)
                        .pageHeight(1400)
                        .build());
                    pages.add(page);
                } else {
                    // Scanned document: execute OCR abstraction
                    try (InputStream ocrStream = storageService.load(providerType, doc.getStorageKey())) {
                        OcrResult ocrResult = ocrService.extractText(ocrStream);
                        ocrResult.getPages().forEach(p -> {
                            DocumentPage page = pageRepository.save(DocumentPage.builder()
                                .documentId(doc.getId())
                                .pageNumber(p.getPageNumber())
                                .textContent(p.getTextContent())
                                .ocrConfidence(p.getConfidence())
                                .pageWidth(p.getWidth())
                                .pageHeight(p.getHeight())
                                .build());
                            pages.add(page);
                        });
                    }
                }
            }

            // 2. OpenSearch Indexing
            searchService.indexDocument(doc, pages);

            // 3. Mark document as INDEXED
            doc.setStatus("INDEXED");
            doc.setPageCount(pages.size());
            documentRepository.save(doc);

            // 4. Finalize Task
            task.setStatus("COMPLETED");
            task.setCompletedAt(OffsetDateTime.now());
            taskRepository.save(task);

            log.info("Processing pipeline successfully completed for document: {}", doc.getId());
        } catch (Exception e) {
            log.error("Document processing pipeline failed for: {}", event.getDocumentId(), e);
            task.setStatus("FAILED");
            task.setErrorMessage(e.getMessage());
            task.setCompletedAt(OffsetDateTime.now());
            taskRepository.save(task);

            documentRepository.findById(event.getDocumentId()).ifPresent(d -> {
                d.setStatus("FAILED");
                documentRepository.save(d);
            });
        }
    }
}
