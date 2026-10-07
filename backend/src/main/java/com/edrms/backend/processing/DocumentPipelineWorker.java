package com.edrms.backend.processing;

import com.edrms.backend.audit.AuditAction;
import com.edrms.backend.audit.AuditService;
import com.edrms.backend.documents.*;
import com.edrms.backend.ocr.OcrPageData;
import com.edrms.backend.ocr.OcrResult;
import com.edrms.backend.ocr.OcrService;
import com.edrms.backend.search.SearchService;
import com.edrms.backend.storage.StorageMetadata;
import com.edrms.backend.storage.StorageProviderType;
import com.edrms.backend.storage.StorageResult;
import com.edrms.backend.storage.StorageService;
import com.edrms.backend.users.User;
import com.edrms.backend.users.UserRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.List;

@Component
public class DocumentPipelineWorker {

    private static final Logger log = LoggerFactory.getLogger(DocumentPipelineWorker.class);

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentAssetRepository assetRepository;
    private final DocumentPageRepository pageRepository;
    private final ProcessingJobRepository jobRepository;
    private final ProcessingJobStepRepository stepRepository;
    private final StorageService storageService;
    private final OcrService ocrService;
    private final SearchService searchService;
    private final AuditService auditService;
    private final MalwareScanner malwareScanner;
    private final UserRepository userRepository;
    private final Tika tika = new Tika();

    public DocumentPipelineWorker(
        DocumentRepository documentRepository,
        DocumentVersionRepository versionRepository,
        DocumentAssetRepository assetRepository,
        DocumentPageRepository pageRepository,
        ProcessingJobRepository jobRepository,
        ProcessingJobStepRepository stepRepository,
        StorageService storageService,
        OcrService ocrService,
        SearchService searchService,
        AuditService auditService,
        MalwareScanner malwareScanner,
        UserRepository userRepository
    ) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.assetRepository = assetRepository;
        this.pageRepository = pageRepository;
        this.jobRepository = jobRepository;
        this.stepRepository = stepRepository;
        this.storageService = storageService;
        this.ocrService = ocrService;
        this.searchService = searchService;
        this.auditService = auditService;
        this.malwareScanner = malwareScanner;
        this.userRepository = userRepository;
    }

    @Async
    @org.springframework.transaction.event.TransactionalEventListener(phase = org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void onDocumentIngested(DocumentIngestedEvent event) {
        UUID docId = event.getDocumentId();
        log.info("Starting 12-stage processing pipeline for document: {}", docId);

        ProcessingJob job = jobRepository.findTopByDocumentIdOrderByCreatedAtDesc(docId)
            .orElseGet(() -> jobRepository.save(ProcessingJob.builder()
                .documentId(docId)
                .jobType("INGESTION_PIPELINE")
                .status("RUNNING")
                .startedAt(OffsetDateTime.now())
                .progressPercentage(5)
                .build()));

        job.setStatus("RUNNING");
        job.setStartedAt(OffsetDateTime.now());
        job.setProgressPercentage(5);
        job = jobRepository.save(job);

        Document doc = documentRepository.findById(docId).orElse(null);
        if (doc == null || doc.getPurgedAt()!=null) {
            log.error("Document not found for pipeline processing: {}", docId);
            job.setStatus("FAILED");
            job.setErrorMessage("Document not found in repository");
            job.setCompletedAt(OffsetDateTime.now());
            jobRepository.save(job);
            return;
        }

        UUID versionId = null;
        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByVersionNumberDesc(docId);
        if (!versions.isEmpty()) {
            versionId = versions.get(0).getId();
            job.setDocumentVersionId(versionId);
            jobRepository.save(job);
        }

        StorageProviderType providerType = StorageProviderType.valueOf(doc.getStorageProvider());
        Path tempFile = null;

        try {
            // Stage 1: VALIDATE_FILE
            ProcessingJobStep step1 = startStep(job.getId(), "VALIDATE_FILE");
            if (doc.getName() == null || doc.getExtension() == null || doc.getFileSizeBytes() <= 0) {
                failStep(step1, "Invalid document metadata");
                throw new IllegalArgumentException("Invalid document attributes");
            }
            // Download to temporary local file for inspection & multi-stage processing
            tempFile = Files.createTempFile("edrms_proc_" + docId + "_", "." + doc.getExtension());
            try (InputStream is = storageService.load(providerType, doc.getStorageKey());
                 OutputStream os = Files.newOutputStream(tempFile)) {
                is.transferTo(os);
            }
            completeStep(step1, "{\"sizeBytes\":" + Files.size(tempFile) + ",\"extension\":\"" + doc.getExtension() + "\"}");
            updateJobProgress(job, 10);

            // Stage 2: MALWARE_SCAN
            ProcessingJobStep step2 = startStep(job.getId(), "MALWARE_SCAN");
            try (InputStream scanStream = Files.newInputStream(tempFile)) {
                boolean clean = malwareScanner.scan(scanStream, doc.getName());
                if (!clean) {
                    failStep(step2, "Malware or prohibited executable detected");
                    throw new SecurityException("Malware signature detected in uploaded document");
                }
            }
            completeStep(step2, "{\"scanner\":\"" + malwareScanner.getClass().getSimpleName() + "\",\"clean\":true}");
            updateJobProgress(job, 18);

            // Stage 3: HASH_FILE
            ProcessingJobStep step3 = startStep(job.getId(), "HASH_FILE");
            String computedHash = calculateSha256(tempFile);
            if (doc.getChecksumSha256() == null || doc.getChecksumSha256().isBlank()) {
                doc.setChecksumSha256(computedHash);
                documentRepository.save(doc);
            }
            completeStep(step3, "{\"sha256\":\"" + computedHash + "\"}");
            updateJobProgress(job, 25);

            // Stage 4: STORE_ORIGINAL
            ProcessingJobStep step4 = startStep(job.getId(), "STORE_ORIGINAL");
            final UUID finalVersionId = versionId;
            Optional<DocumentAsset> originalAsset = assetRepository.findByDocumentIdAndAssetType(docId, "ORIGINAL");
            if (originalAsset.isEmpty() && finalVersionId != null) {
                assetRepository.save(DocumentAsset.builder()
                    .tenantId(doc.getTenantId())
                    .documentId(docId)
                    .documentVersionId(finalVersionId)
                    .assetType("ORIGINAL")
                    .storageProvider(doc.getStorageProvider())
                    .storageKey(doc.getStorageKey())
                    .mimeType(doc.getMimeType())
                    .extension(doc.getExtension())
                    .sizeBytes(doc.getFileSizeBytes())
                    .checksumSha256(doc.getChecksumSha256())
                    .createdBy(doc.getOwnerId())
                    .build());
            }
            completeStep(step4, "{\"storageKey\":\"" + doc.getStorageKey() + "\"}");
            updateJobProgress(job, 35);

            // Stage 5: EXTRACT_TEXT
            ProcessingJobStep step5 = startStep(job.getId(), "EXTRACT_TEXT");
            String digitalText = "";
            boolean isPdf = "pdf".equalsIgnoreCase(doc.getExtension()) || (doc.getMimeType() != null && doc.getMimeType().contains("pdf"));

            if (isPdf) {
                // Fast PDFTextStripper for digital PDFs (extracts text in milliseconds without unpacking heavy photo scan images)
                try (PDDocument pdDoc = PDDocument.load(tempFile.toFile())) {
                    org.apache.pdfbox.text.PDFTextStripper stripper = new org.apache.pdfbox.text.PDFTextStripper();
                    stripper.setSortByPosition(true);
                    digitalText = stripper.getText(pdDoc);
                } catch (Exception e) {
                    log.warn("PDFTextStripper error on doc {}, trying Tika: {}", docId, e.getMessage());
                    try (InputStream is = Files.newInputStream(tempFile)) {
                        digitalText = tika.parseToString(is);
                    } catch (Exception ignored) {}
                }
            } else {
                // Non-PDF (images, docs, sheets, text)
                try (InputStream is = Files.newInputStream(tempFile)) {
                    digitalText = tika.parseToString(is);
                } catch (Exception e) {
                    log.warn("Tika text extraction had warnings for doc {}: {}", docId, e.getMessage());
                }
            }
            completeStep(step5, "{\"extractedLength\":" + (digitalText != null ? digitalText.length() : 0) + "}");
            updateJobProgress(job, 45);

            // Stage 6: DETECT_PAGES
            ProcessingJobStep step6 = startStep(job.getId(), "DETECT_PAGES");
            int pageCount = 1;
            if (isPdf) {
                try (PDDocument pdDoc = PDDocument.load(tempFile.toFile())) {
                    pageCount = pdDoc.getNumberOfPages();
                } catch (Exception e) {
                    log.warn("PDFBox page detection error: {}", e.getMessage());
                }
            }
            completeStep(step6, "{\"isPdf\":" + isPdf + ",\"pageCount\":" + pageCount + "}");
            updateJobProgress(job, 55);

            // Stage 7: OCR_IF_REQUIRED
            ProcessingJobStep step7 = startStep(job.getId(), "OCR_IF_REQUIRED");
            List<DocumentPage> pages = new ArrayList<>();
            boolean ranOcr = false;

            boolean hasRichDigitalText = digitalText != null && digitalText.trim().length() > (20 * Math.max(1, pageCount));

            if (isPdf && hasRichDigitalText) {
                // Digital PDF: parse pages
                try (PDDocument pdDoc = PDDocument.load(tempFile.toFile())) {
                    org.apache.pdfbox.text.PDFTextStripper stripper = new org.apache.pdfbox.text.PDFTextStripper();
                    for (int p = 1; p <= pageCount; p++) {
                        stripper.setStartPage(p);
                        stripper.setEndPage(p);
                        String pageText = stripper.getText(pdDoc);
                        PDPage pdPage = pdDoc.getPage(p - 1);
                        int width = (int) pdPage.getMediaBox().getWidth();
                        int height = (int) pdPage.getMediaBox().getHeight();

                        DocumentPage page = DocumentPage.builder()
                            .tenantId(doc.getTenantId())
                            .documentId(docId)
                            .documentVersionId(finalVersionId)
                            .pageNumber(p)
                            .sequenceNumber(p)
                            .textContent(pageText != null ? pageText.trim() : "")
                            .ocrConfidence(100.0)
                            .textSource("DIGITAL")
                            .ocrStatus("NOT_REQUIRED")
                            .pageWidth(width)
                            .pageHeight(height)
                            .build();
                        pages.add(pageRepository.save(page));
                    }
                }
            } else {
                // Scanned PDF or Image: execute local Tesseract OCR engine!
                ranOcr = true;
                try (InputStream ocrStream = Files.newInputStream(tempFile)) {
                    OcrResult ocrResult = ocrService.extractText(ocrStream);
                    for (OcrPageData op : ocrResult.getPages()) {
                        DocumentPage page = DocumentPage.builder()
                            .tenantId(doc.getTenantId())
                            .documentId(docId)
                            .documentVersionId(finalVersionId)
                            .pageNumber(op.getPageNumber())
                            .sequenceNumber(op.getPageNumber())
                            .textContent(op.getTextContent())
                            .ocrConfidence(op.getConfidence())
                            .textSource("OCR")
                            .ocrStatus("COMPLETED")
                            .pageWidth(op.getWidth() > 0 ? op.getWidth() : 1000)
                            .pageHeight(op.getHeight() > 0 ? op.getHeight() : 1400)
                            .build();
                        pages.add(pageRepository.save(page));
                    }
                }
            }

            if (pages.isEmpty()) {
                // Fallback page
                DocumentPage fallbackPage = DocumentPage.builder()
                    .tenantId(doc.getTenantId())
                    .documentId(docId)
                    .documentVersionId(finalVersionId)
                    .pageNumber(1)
                    .sequenceNumber(1)
                    .textContent(digitalText != null ? digitalText : "")
                    .ocrConfidence(90.0)
                    .textSource("DIGITAL")
                    .ocrStatus("NOT_REQUIRED")
                    .pageWidth(1000)
                    .pageHeight(1400)
                    .build();
                pages.add(pageRepository.save(fallbackPage));
            }

            completeStep(step7, "{\"ranOcr\":" + ranOcr + ",\"pagesProcessed\":" + pages.size() + "}");
            updateJobProgress(job, 68);

            // Stage 8: GENERATE_THUMBNAILS
            ProcessingJobStep step8 = startStep(job.getId(), "GENERATE_THUMBNAILS");
            String thumbStorageKey = null;
            try {
                BufferedImage thumbImage = null;
                if (isPdf) {
                    try (PDDocument pdDoc = PDDocument.load(tempFile.toFile())) {
                        PDFRenderer renderer = new PDFRenderer(pdDoc);
                        thumbImage = renderer.renderImageWithDPI(0, 100, ImageType.RGB);
                    }
                } else if (doc.getMimeType() != null && doc.getMimeType().startsWith("image")) {
                    thumbImage = ImageIO.read(tempFile.toFile());
                }

                if (thumbImage != null) {
                    BufferedImage scaled = resizeImage(thumbImage, 300, 400);
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    ImageIO.write(scaled, "PNG", baos);
                    byte[] thumbBytes = baos.toByteArray();

                    String thumbKey = "thumbnails/" + docId + "_p1.png";
                    StorageMetadata meta = StorageMetadata.builder()
                        .contentLength((long) thumbBytes.length)
                        .contentType("image/png")
                        .build();

                    storageService.getProvider(providerType).store(thumbKey, new ByteArrayInputStream(thumbBytes), meta);
                    thumbStorageKey = thumbKey;

                    // Update page 1 thumbnail key
                    if (!pages.isEmpty()) {
                        DocumentPage p1 = pages.get(0);
                        p1.setThumbnailStorageKey(thumbKey);
                        pageRepository.save(p1);
                    }

                    // Save DocumentAsset for thumbnail
                    if (finalVersionId != null) {
                        assetRepository.save(DocumentAsset.builder()
                            .tenantId(doc.getTenantId())
                            .documentId(docId)
                            .documentVersionId(finalVersionId)
                            .documentPageId(pages.get(0).getId())
                            .assetType("THUMBNAIL")
                            .storageProvider(providerType.name())
                            .storageKey(thumbKey)
                            .mimeType("image/png")
                            .extension("png")
                            .sizeBytes((long) thumbBytes.length)
                            .createdBy(doc.getOwnerId())
                            .build());
                    }
                }
            } catch (Exception e) {
                log.warn("Thumbnail generation error (skipped gracefully): {}", e.getMessage());
            }
            completeStep(step8, "{\"thumbnailKey\":\"" + thumbStorageKey + "\"}");
            updateJobProgress(job, 78);

            // Stage 9: GENERATE_PREVIEW
            ProcessingJobStep step9 = startStep(job.getId(), "GENERATE_PREVIEW");
            if (finalVersionId != null) {
                // PDF is natively canonical preview; register preview asset
                Optional<DocumentAsset> previewAsset = assetRepository.findByDocumentIdAndAssetType(docId, "PREVIEW_PDF");
                if (previewAsset.isEmpty()) {
                    assetRepository.save(DocumentAsset.builder()
                        .tenantId(doc.getTenantId())
                        .documentId(docId)
                        .documentVersionId(finalVersionId)
                        .assetType("PREVIEW_PDF")
                        .storageProvider(doc.getStorageProvider())
                        .storageKey(doc.getStorageKey())
                        .mimeType(doc.getMimeType())
                        .extension(doc.getExtension())
                        .sizeBytes(doc.getFileSizeBytes())
                        .checksumSha256(doc.getChecksumSha256())
                        .createdBy(doc.getOwnerId())
                        .build());
                }
            }
            completeStep(step9, "{\"previewReady\":true}");
            updateJobProgress(job, 85);

            // Stage 10: CREATE_ASSETS
            ProcessingJobStep step10 = startStep(job.getId(), "CREATE_ASSETS");
            List<DocumentAsset> createdAssets = assetRepository.findByDocumentId(docId);
            completeStep(step10, "{\"assetCount\":" + createdAssets.size() + "}");
            updateJobProgress(job, 90);

            // Stage 11: INDEX_SEARCH
            ProcessingJobStep step11 = startStep(job.getId(), "INDEX_SEARCH");
            searchService.indexDocument(doc, pages);
            completeStep(step11, "{\"indexedPages\":" + pages.size() + ",\"index\":\"edrms_document_pages_v1\"}");
            updateJobProgress(job, 96);

            // Stage 12: FINALIZE
            ProcessingJobStep step12 = startStep(job.getId(), "FINALIZE");
            doc.setStatus("READY");
            doc.setPageCount(pageCount);
            documentRepository.save(doc);

            job.setStatus("COMPLETED");
            job.setProgressPercentage(100);
            job.setCompletedAt(OffsetDateTime.now());
            jobRepository.save(job);

            completeStep(step12, "{\"finalStatus\":\"READY\",\"pageCount\":" + pages.size() + "}");

            String actorUsername = "admin";
            if (doc.getOwnerId() != null) {
                actorUsername = userRepository.findById(doc.getOwnerId())
                    .map(User::getUsername)
                    .orElse("admin");
            }

            String detailsJson = String.format(
                "{\"documentName\":\"%s\",\"message\":\"12-stage ingestion pipeline completed successfully\",\"indexedPages\":%d,\"actionDescription\":\"Uploaded \\\"%s\\\" into repository\"}",
                doc.getName().replace("\"", "\\\""),
                pages.size(),
                doc.getName().replace("\"", "\\\"")
            );

            auditService.recordAction(
                UUID.randomUUID().toString(),
                doc.getOwnerId(),
                actorUsername,
                "127.0.0.1",
                "EDMS-Pipeline-Worker",
                AuditAction.UPLOAD,
                "DOCUMENT",
                docId.toString(),
                "SUCCESS",
                detailsJson
            );

            log.info("12-stage processing pipeline completed successfully for document: {}", docId);
        } catch (Exception e) {
            log.error("Pipeline failure for document {}: {}", docId, e.getMessage(), e);
            job.setStatus("FAILED");
            job.setErrorMessage(e.getMessage());
            job.setCompletedAt(OffsetDateTime.now());
            jobRepository.save(job);

            doc.setStatus("FAILED");
            documentRepository.save(doc);
        } finally {
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (IOException ignored) {}
            }
        }
    }

    private ProcessingJobStep startStep(UUID jobId, String stepName) {
        ProcessingJobStep step = ProcessingJobStep.builder()
            .processingJobId(jobId)
            .stepName(stepName)
            .status("RUNNING")
            .startedAt(OffsetDateTime.now())
            .build();
        return stepRepository.save(step);
    }

    private void completeStep(ProcessingJobStep step, String metadataJson) {
        step.setStatus("COMPLETED");
        step.setCompletedAt(OffsetDateTime.now());
        if (step.getStartedAt() != null) {
            step.setDurationMs(Duration.between(step.getStartedAt(), step.getCompletedAt()).toMillis());
        }
        step.setMetadataJson(metadataJson);
        stepRepository.save(step);
    }

    private void failStep(ProcessingJobStep step, String error) {
        step.setStatus("FAILED");
        step.setCompletedAt(OffsetDateTime.now());
        if (step.getStartedAt() != null) {
            step.setDurationMs(Duration.between(step.getStartedAt(), step.getCompletedAt()).toMillis());
        }
        step.setErrorMessage(error);
        stepRepository.save(step);
    }

    private void updateJobProgress(ProcessingJob job, int percentage) {
        job.setProgressPercentage(percentage);
        jobRepository.save(job);
    }

    private BufferedImage resizeImage(BufferedImage originalImage, int targetWidth, int targetHeight) {
        int originalWidth = originalImage.getWidth();
        int originalHeight = originalImage.getHeight();
        double ratio = Math.min((double) targetWidth / originalWidth, (double) targetHeight / originalHeight);
        int width = (int) (originalWidth * ratio);
        int height = (int) (originalHeight * ratio);

        BufferedImage resizedImage = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = resizedImage.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(originalImage, 0, 0, width, height, null);
        g.dispose();
        return resizedImage;
    }

    private String calculateSha256(Path file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream is = Files.newInputStream(file)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = is.read(buffer)) != -1) {
                    digest.update(buffer, 0, read);
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception e) {
            throw new IOException("SHA-256 computation failed", e);
        }
    }
}
