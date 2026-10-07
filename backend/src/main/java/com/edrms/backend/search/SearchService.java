package com.edrms.backend.search;

import com.edrms.backend.documents.Document;
import com.edrms.backend.documents.DocumentPage;
import com.edrms.backend.documents.DocumentPageRepository;
import com.edrms.backend.documents.DocumentRepository;
import com.edrms.backend.folders.Folder;
import com.edrms.backend.folders.FolderRepository;
import jakarta.annotation.PostConstruct;
import org.opensearch.client.opensearch.OpenSearchClient;
import org.opensearch.client.opensearch._types.FieldValue;
import org.opensearch.client.opensearch.core.SearchResponse;
import org.opensearch.client.opensearch.core.search.Hit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SearchService {

    private static final Logger log = LoggerFactory.getLogger(SearchService.class);

    @Value("${edrms.opensearch.index-name:edrms_document_pages_v1}")
    private String indexName;

    private final OpenSearchClient openSearchClient;
    private final DocumentRepository documentRepository;
    private final DocumentPageRepository pageRepository;
    private final FolderRepository folderRepository;

    public SearchService(
        OpenSearchClient openSearchClient,
        DocumentRepository documentRepository,
        DocumentPageRepository pageRepository,
        FolderRepository folderRepository
    ) {
        this.openSearchClient = openSearchClient;
        this.documentRepository = documentRepository;
        this.pageRepository = pageRepository;
        this.folderRepository = folderRepository;
    }

    @PostConstruct
    public void ensureIndexExists() {
        try {
            boolean exists = openSearchClient.indices().exists(e -> e.index(indexName)).value();
            if (!exists) {
                log.info("Creating OpenSearch index: {}", indexName);
                openSearchClient.indices().create(c -> c
                    .index(indexName)
                    .mappings(m -> m
                        .properties("document_id", p -> p.keyword(k -> k))
                        .properties("tenant_id", p -> p.keyword(k -> k))
                        .properties("folder_id", p -> p.keyword(k -> k))
                        .properties("document_name", p -> p.text(t -> t.fields("keyword", k -> k.keyword(kk -> kk))))
                        .properties("page_number", p -> p.integer(i -> i))
                        .properties("text_content", p -> p.text(t -> t))
                        .properties("text_source", p -> p.keyword(k -> k))
                        .properties("ocr_confidence", p -> p.double_(d -> d))
                        .properties("file_size_bytes", p -> p.long_(l -> l))
                        .properties("created_at", p -> p.date(d -> d))
                    )
                );
                log.info("Successfully created OpenSearch index: {}", indexName);
            }
        } catch (Exception e) {
            log.warn("Could not verify/create OpenSearch index (will retry on indexing): {}", e.getMessage());
        }
    }

    public void indexDocument(Document document, List<DocumentPage> pages) {
        try {
            ensureIndexExists();
            for (DocumentPage page : pages) {
                Map<String, Object> docMap = new HashMap<>();
                docMap.put("document_id", document.getId().toString());
                docMap.put("tenant_id", document.getTenantId() != null ? document.getTenantId().toString() : "00000000-0000-0000-0000-000000000001");
                docMap.put("folder_id", document.getFolderId().toString());
                docMap.put("document_name", document.getName());
                docMap.put("page_number", page.getPageNumber());
                docMap.put("text_content", page.getTextContent() != null ? page.getTextContent() : "");
                docMap.put("text_source", page.getTextSource() != null ? page.getTextSource() : "DIGITAL");
                docMap.put("ocr_confidence", page.getOcrConfidence() != null ? page.getOcrConfidence() : 100.0);
                docMap.put("file_size_bytes", document.getFileSizeBytes() != null ? document.getFileSizeBytes() : 0L);
                docMap.put("created_at", OffsetDateTime.now().toString());

                String docId = document.getId() + "_p" + page.getPageNumber();
                openSearchClient.index(i -> i
                    .index(indexName)
                    .id(docId)
                    .document(docMap)
                );
            }
            log.info("Indexed {} pages for document: {} in OpenSearch", pages.size(), document.getId());
        } catch (Exception e) {
            log.error("Failed to index document in OpenSearch: {}", e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    public List<DocumentSearchHit> search(DocumentSearchQuery query) {
        String queryText = query.getQuery();
        if (queryText == null || queryText.isBlank()) {
            return Collections.emptyList();
        }
        String cleanQuery = queryText.trim();

        try {
            SearchResponse<Map> response = openSearchClient.search(s -> s
                .index(indexName)
                .query(q -> q.bool(b -> {
                    b.should(sh -> sh.multiMatch(mm -> mm
                        .query(cleanQuery)
                        .fields("document_name^4", "text_content^2")
                    ));
                    if (cleanQuery.contains(" ")) {
                        b.should(sh -> sh.matchPhrase(mp -> mp.field("text_content").query(cleanQuery)));
                        b.should(sh -> sh.matchPhrase(mp -> mp.field("document_name").query(cleanQuery)));
                    } else {
                        b.should(sh -> sh.wildcard(w -> w
                            .field("document_name.keyword")
                            .value("*" + cleanQuery + "*")
                            .caseInsensitive(true)
                        ));
                        b.should(sh -> sh.wildcard(w -> w
                            .field("document_name")
                            .value("*" + cleanQuery.toLowerCase() + "*")
                        ));
                        b.should(sh -> sh.wildcard(w -> w
                            .field("text_content")
                            .value("*" + cleanQuery.toLowerCase() + "*")
                        ));
                    }
                    b.minimumShouldMatch("1");
                    if (query.getFolderId() != null) {
                        b.filter(f -> f.term(t -> t.field("folder_id").value(FieldValue.of(query.getFolderId().toString()))));
                    }
                    return b;
                }))
                .highlight(h -> h
                    .fields("text_content", hf -> hf
                        .preTags("<em>")
                        .postTags("</em>")
                        .fragmentSize(150)
                        .numberOfFragments(3)
                    )
                    .fields("document_name", hf -> hf
                        .preTags("<em>")
                        .postTags("</em>")
                        .fragmentSize(150)
                    )
                )
                .size(query.getSize() > 0 ? query.getSize() * 5 : 50),
                Map.class
            );

            Map<UUID, DocumentSearchHit> hitMap = new LinkedHashMap<>();

            for (Hit<Map> hit : response.hits().hits()) {
                Map<String, Object> source = hit.source();
                if (source == null) continue;

                UUID docId = UUID.fromString((String) source.get("document_id"));
                Optional<Document> docOpt = documentRepository.findById(docId);
                if (docOpt.isEmpty() || Boolean.TRUE.equals(docOpt.get().getIsDeleted())) {
                    continue;
                }
                Document doc = docOpt.get();
                String docName = doc.getName();
                UUID folderId = doc.getFolderId();
                long fileSize = doc.getFileSizeBytes() != null ? doc.getFileSizeBytes() : 0L;
                int pageNumber = source.get("page_number") != null ? ((Number) source.get("page_number")).intValue() : 1;

                String snippet = "";
                if (hit.highlight() != null && hit.highlight().containsKey("text_content")) {
                    snippet = String.join(" ... ", hit.highlight().get("text_content"));
                } else if (hit.highlight() != null && hit.highlight().containsKey("document_name")) {
                    snippet = "Filename match: " + String.join(" ... ", hit.highlight().get("document_name"));
                } else {
                    String fullText = (String) source.getOrDefault("text_content", "");
                    int idx = fullText.toLowerCase().indexOf(cleanQuery.toLowerCase());
                    if (idx >= 0) {
                        int start = Math.max(0, idx - 40);
                        int end = Math.min(fullText.length(), idx + cleanQuery.length() + 40);
                        snippet = "..." + fullText.substring(start, end).replace("\n", " ") + "...";
                    } else {
                        snippet = fullText.length() > 80 ? fullText.substring(0, 80).replace("\n", " ") + "..." : fullText.replace("\n", " ");
                    }
                }

                DocumentSearchHit docHit = hitMap.computeIfAbsent(docId, id -> {
                    String folderPath = "/";
                    Optional<Folder> f = folderRepository.findById(folderId);
                    if (f.isPresent()) {
                        folderPath = f.get().getMaterializedPath();
                    }
                    return DocumentSearchHit.builder()
                        .documentId(docId)
                        .documentName(docName)
                        .folderId(folderId)
                        .folderPath(folderPath)
                        .fileSizeBytes(fileSize)
                        .pageHits(new ArrayList<>())
                        .build();
                });

                docHit.getPageHits().add(PageSearchHit.builder()
                    .pageNumber(pageNumber)
                    .highlightSnippet(snippet)
                    .score(hit.score() != null ? hit.score() : 1.0)
                    .build());
            }

            if (!hitMap.isEmpty()) {
                return new ArrayList<>(hitMap.values());
            }
        } catch (Exception e) {
            log.warn("OpenSearch query error, falling back to database query: {}", e.getMessage());
        }

        // Database Fallback Search
        return searchFallback(cleanQuery, query.getFolderId());
    }

    private List<DocumentSearchHit> searchFallback(String queryText, UUID folderId) {
        Map<UUID, DocumentSearchHit> hitMap = new LinkedHashMap<>();

        // 1. Text content search
        List<DocumentPage> matchedPages = pageRepository.findByTextContentContainingIgnoreCase(queryText);
        for (DocumentPage page : matchedPages) {
            UUID docId = page.getDocumentId();
            Document doc = documentRepository.findById(docId).orElse(null);
            if (doc == null || Boolean.TRUE.equals(doc.getIsDeleted())) continue;
            if (folderId != null && !doc.getFolderId().equals(folderId)) continue;

            addHitToMap(hitMap, doc, page.getPageNumber(), page.getTextContent(), queryText, 1.0);
        }

        // 2. Document name search
        List<Document> matchedDocs = documentRepository.findByNameContainingIgnoreCaseAndIsDeletedFalse(queryText);
        for (Document doc : matchedDocs) {
            if (folderId != null && !doc.getFolderId().equals(folderId)) continue;
            if (!hitMap.containsKey(doc.getId())) {
                List<DocumentPage> pages = pageRepository.findByDocumentIdOrderByPageNumberAsc(doc.getId());
                if (!pages.isEmpty()) {
                    for (DocumentPage p : pages) {
                        addHitToMap(hitMap, doc, p.getPageNumber(), p.getTextContent(), queryText, 1.0);
                    }
                } else {
                    addHitToMap(hitMap, doc, 1, doc.getName(), queryText, 1.0);
                }
            }
        }

        return new ArrayList<>(hitMap.values());
    }

    private void addHitToMap(Map<UUID, DocumentSearchHit> hitMap, Document doc, int pageNumber, String text, String queryText, double score) {
        String content = text != null ? text : "";
        int idx = content.toLowerCase().indexOf(queryText.toLowerCase());
        String snippet;
        if (idx >= 0) {
            int start = Math.max(0, idx - 40);
            int end = Math.min(content.length(), idx + queryText.length() + 40);
            snippet = "..." + content.substring(start, end).replace("\n", " ") + "...";
        } else {
            snippet = content.length() > 80 ? content.substring(0, 80).replace("\n", " ") + "..." : content.replace("\n", " ");
        }

        DocumentSearchHit hit = hitMap.computeIfAbsent(doc.getId(), id -> {
            String folderPath = "/";
            Optional<Folder> f = folderRepository.findById(doc.getFolderId());
            if (f.isPresent()) {
                folderPath = f.get().getMaterializedPath();
            }
            return DocumentSearchHit.builder()
                .documentId(doc.getId())
                .documentName(doc.getName())
                .folderId(doc.getFolderId())
                .folderPath(folderPath)
                .fileSizeBytes(doc.getFileSizeBytes() != null ? doc.getFileSizeBytes() : 0L)
                .pageHits(new ArrayList<>())
                .build();
        });

        hit.getPageHits().add(PageSearchHit.builder()
            .pageNumber(pageNumber)
            .highlightSnippet(snippet)
            .score(score)
            .build());
    }

    public void deleteDocumentIndex(UUID documentId) {
        try {
            openSearchClient.deleteByQuery(d -> d
                .index(indexName)
                .query(q -> q.term(t -> t.field("document_id").value(FieldValue.of(documentId.toString()))))
            );
            log.info("Deleted OpenSearch index entries for document: {}", documentId);
        } catch (Exception e) {
            log.warn("Could not delete document from OpenSearch index: {}", e.getMessage());
        }
    }
}
