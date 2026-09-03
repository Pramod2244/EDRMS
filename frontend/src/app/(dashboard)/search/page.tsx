"use client";

import React, { useState } from "react";
import { Search as SearchIcon, FileText, ChevronRight } from "lucide-react";
import { SearchHit } from "@/types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);

    // Mock search hit demonstrating page-level navigation
    setTimeout(() => {
      setResults([
        {
          documentId: "doc-1",
          documentName: "Master_Services_Agreement_2026.pdf",
          folderId: "folder-1",
          folderPath: "/Corporate/Legal",
          fileSizeBytes: 3450200,
          pageHits: [
            {
              pageNumber: 8,
              highlightSnippet: "...under no circumstances shall <em>limitation of liability</em> exceed total fees...",
              score: 9.2,
            },
            {
              pageNumber: 14,
              highlightSnippet: "...provisions for <em>indemnification</em> shall survive termination...",
              score: 7.8,
            },
          ],
        },
      ]);
      setIsSearching(false);
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Full-Text & Page Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search indexed document content across OCR and digital texts with direct page navigation.
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search words, phrases, OCR text, contract clauses..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition"
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Results List */}
      <div className="space-y-4">
        {results.map((hit) => (
          <div key={hit.documentId} className="border border-border rounded-lg p-5 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">{hit.documentName}</span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                  {hit.folderPath}
                </span>
              </div>
            </div>

            {/* Direct Page Navigation Hits */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Matching Pages ({hit.pageHits.length}):
              </span>
              {hit.pageHits.map((pageHit) => (
                <div
                  key={pageHit.pageNumber}
                  className="flex items-center justify-between p-3 rounded-md bg-secondary/50 hover:bg-secondary transition cursor-pointer"
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-primary">Page {pageHit.pageNumber}</span>
                    <p
                      className="text-sm text-foreground"
                      dangerouslySetInnerHTML={{ __html: pageHit.highlightSnippet }}
                    />
                  </div>
                  <button className="inline-flex items-center text-xs font-medium text-primary hover:underline">
                    Jump to Page {pageHit.pageNumber} <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
