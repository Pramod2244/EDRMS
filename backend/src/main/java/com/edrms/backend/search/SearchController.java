package com.edrms.backend.search;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @PostMapping
    public ResponseEntity<List<DocumentSearchHit>> searchDocuments(@RequestBody DocumentSearchQuery query) {
        return ResponseEntity.ok(searchService.search(query));
    }
}
