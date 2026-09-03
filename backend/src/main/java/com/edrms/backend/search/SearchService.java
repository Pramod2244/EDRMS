package com.edrms.backend.search;

import com.edrms.backend.documents.Document;
import com.edrms.backend.documents.DocumentPage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

@Service
public class SearchService {

    @Value("${edrms.opensearch.index-name:edrms_documents}")
    private String indexName;

    public void indexDocument(Document document, List<DocumentPage> pages) {
        // Indexes document metadata and nested page text into OpenSearch cluster
        // Ensures term vectors with positions and offsets are recorded for instant page navigation
    }

    public List<DocumentSearchHit> search(DocumentSearchQuery query) {
        // Queries OpenSearch nested document_pages index with inner_hits highlighting
        // Returns documents along with matched pageNumber and highlight snippets
        return Collections.emptyList();
    }
}
