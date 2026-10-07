package com.edrms.backend.documents;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.event.TransactionalEventListener;
import com.edrms.backend.search.SearchService;
@Component
public class RecycleBinSearchListener {
    private final DocumentRepository documents;private final DocumentPageRepository pages;private final SearchService search;
    public RecycleBinSearchListener(DocumentRepository documents,DocumentPageRepository pages,SearchService search){this.documents=documents;this.pages=pages;this.search=search;}
    @Async @TransactionalEventListener
    public void changed(RecycleBinService.Change change){documents.findById(change.id()).ifPresent(doc->{if(change.restored()&&!Boolean.TRUE.equals(doc.getIsDeleted()))search.indexDocument(doc,pages.findByDocumentIdOrderByPageNumberAsc(doc.getId()));else if(!change.restored()&&Boolean.TRUE.equals(doc.getIsDeleted()))search.deleteDocumentIndex(doc.getId());});}
}
