"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search as SearchIcon,
  FileText,
  ChevronRight,
  Filter,
  Eye,
  Download,
  Sparkles,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { SearchHit, DocumentItem } from "@/types";
import PdfPageViewer from "@/components/documents/pdf-page-viewer";
import { useDocumentStore } from "@/stores/document-store";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const documents = useDocumentStore((state) => state.documents);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [activePreviewHit, setActivePreviewHit] = useState<{ docId: string; page: number } | null>(null);

  const searchController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState("");

  const executeSearch = useCallback(async (searchTerm: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    searchController.current?.abort();
    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) {
      setResults([]);
      setIsSearching(false);
      setSearchedQuery("");
      return;
    }
    const controller = new AbortController();
    searchController.current = controller;
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleanTerm }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Search is unavailable. Please try again.");
      const data: SearchHit[] = await res.json();
      if (!controller.signal.aborted) {
        setResults(data.map((hit) => ({ ...hit, pageHits: [...hit.pageHits].sort((a, b) => a.pageNumber - b.pageNumber) })));
        setSearchedQuery(cleanTerm);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setSearchError(error instanceof Error ? error.message : "Search failed");
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) setIsSearching(false);
    }
  }, []);

  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);

  useEffect(() => {
    searchController.current?.abort();
    setIsSearching(false);
    setSearchError(null);
    if (!query.trim()) {
      setResults([]);
      setSearchedQuery("");
      return;
    }
    debounceTimer.current = setTimeout(() => executeSearch(query), 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      searchController.current?.abort();
    };
  }, [query, executeSearch]);
  // Form submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  // Quick suggestion click handler
  const handleSuggestionClick = (term: string) => {
    setQuery(term);
  };

  // Filter results by selected category
  const filteredResults = results.filter((hit) => {
    if (selectedCategory === "ALL") return true;
    const name = hit.documentName.toLowerCase();
    if (selectedCategory === "PDF") return name.endsWith(".pdf");
    if (selectedCategory === "IMAGES") return name.match(/\.(png|jpg|jpeg|tiff|bmp)$/);
    if (selectedCategory === "OCR_ONLY") {
      return hit.pageHits.some((p) => p.highlightSnippet && !p.highlightSnippet.startsWith("Filename match:"));
    }
    return true;
  });

  const totalHitsCount = filteredResults.reduce((acc, h) => acc + h.pageHits.length, 0);

  // Resolved preview document
  const previewDoc: DocumentItem | null = activePreviewHit
    ? documents.find((d) => d.id === activePreviewHit.docId) || {
        id: activePreviewHit.docId,
        folderId: null,
        name: results.find((r) => r.documentId === activePreviewHit.docId)?.documentName || "Document",
        mimeType: results.find((r) => r.documentId === activePreviewHit.docId)?.documentName.endsWith(".png")
          ? "image/png"
          : "application/pdf",
        extension: results.find((r) => r.documentId === activePreviewHit.docId)?.documentName.endsWith(".png")
          ? "png"
          : "pdf",
        fileSizeBytes: results.find((r) => r.documentId === activePreviewHit.docId)?.fileSizeBytes || 0,
        currentVersion: 1,
        status: "INDEXED",
        storageProvider: "LOCAL",
        pageCount: results.find((r) => r.documentId === activePreviewHit.docId)?.pageHits.reduce((max, page) => Math.max(max, page.pageNumber), 1) || 1,
        createdAt: "Active",
        fileUrl: `/api/documents/${activePreviewHit.docId}/preview`,
      }
    : null;

  const quickPills = ["file-example", "Lorem", "invoice", "contract", "PDF", "Arkaa"];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Full-Text &amp; OCR Content Search
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
              Content search
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Search document content, digital text, OCR extracts, and filenames with instant deep-linking.
          </p>
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search content, OCR text, or filenames (e.g. 'file-example', 'Lorem', 'invoice')..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition shadow-xs flex items-center space-x-2"
          >
            {isSearching ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <span>Search</span>
            )}
          </button>
        </div>

        {/* Filter Pills & Quick Sample Suggestions */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          {/* Category Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] flex items-center mr-1">
              <Filter className="h-3 w-3 mr-1 text-slate-400" /> Filter:
            </span>
            {[
              { id: "ALL", label: "All Documents" },
              { id: "PDF", label: "PDFs" },
              { id: "IMAGES", label: "Images" },
              { id: "OCR_ONLY", label: "OCR Text" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full border text-xs transition ${
                  selectedCategory === cat.id
                    ? "bg-orange-50 text-orange-800 border-orange-300 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Quick Click Search Queries */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center">
              <Sparkles className="h-3 w-3 mr-1 text-orange-500" /> Suggestions:
            </span>
            {quickPills.map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => handleSuggestionClick(pill)}
                className="px-2.5 py-0.5 rounded-md bg-slate-100 hover:bg-orange-100 hover:text-orange-900 border border-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
              >
                {pill}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Results Header / Feedback */}
      {searchedQuery && !isSearching && !searchError && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-1 border-b border-slate-200 pb-2">
          <span>
            Found <strong className="text-slate-900 font-semibold">{filteredResults.length}</strong> matching{" "}
            {filteredResults.length === 1 ? "document" : "documents"} with{" "}
            <strong className="text-slate-900 font-semibold">{totalHitsCount}</strong> page occurrences for &quot;
            <strong className="text-orange-600">{searchedQuery}</strong>&quot;
          </span>
          {filteredResults.length > 0 && (
            <span className="text-[11px] text-slate-400 font-mono">Matching pages</span>
          )}
        </div>
      )}

      {/* Results List */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 pr-3 pb-4" style={{ scrollbarGutter: "stable" }} aria-label="Search results">
        {searchError && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{searchError}</p>}
        {filteredResults.length === 0 && !isSearching && !searchError && searchedQuery && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 space-y-3">
            <p className="font-semibold text-slate-700">
              No matching documents or OCR hits found for &quot;{query}&quot;.
            </p>
            <p className="text-xs text-slate-400">
              Try searching with broader terms or click one of the suggested keywords above.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              {quickPills.map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => handleSuggestionClick(pill)}
                  className="px-3 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold hover:bg-orange-100 transition"
                >
                  Search &quot;{pill}&quot;
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredResults.map((hit) => (
          <div
            key={hit.documentId}
            className="border border-slate-200 rounded-xl p-5 bg-white space-y-3 shadow-2xs hover:border-orange-300 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <FileText className="h-5 w-5 text-orange-500 shrink-0" />
                <span className="font-bold text-slate-900">{hit.documentName}</span>
                <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono flex items-center">
                  <FolderOpen className="h-3 w-3 mr-1 text-slate-400" />
                  {hit.folderPath}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full">
                  {hit.pageHits.length} matching {hit.pageHits.length === 1 ? "page" : "pages"}
                </span>
                <a
                  href={`/api/documents/${hit.documentId}/download`}
                  download
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                  title="Download File"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Direct Page Navigation Hits */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Occurrences (Click any page hit to open directly in viewer):
              </span>
              <div className="grid grid-cols-1 gap-2">
                {hit.pageHits.map((pageHit) => (
                  <div
                    key={pageHit.pageNumber}
                    onClick={() => setActivePreviewHit({ docId: hit.documentId, page: pageHit.pageNumber })}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-orange-50/50 border border-slate-200/80 hover:border-orange-200 transition cursor-pointer group"
                  >
                    <div className="space-y-1.5 pr-4 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                          Page {pageHit.pageNumber}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Relevance: {pageHit.score.toFixed(2)}
                        </span>
                      </div>
                      <p
                        className="text-xs text-slate-700 leading-relaxed font-sans"
                        dangerouslySetInnerHTML={{
                          __html: pageHit.highlightSnippet
                            ? pageHit.highlightSnippet
                                .replace(/<em>/g, '<mark class="bg-amber-200 text-amber-950 font-bold px-1 rounded">')
                                .replace(/<\/em>/g, "</mark>")
                            : "Match in content",
                        }}
                      />
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="hidden sm:inline-flex items-center text-xs font-semibold text-orange-600 group-hover:underline">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View Page
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-orange-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* PDF Page Viewer Deep-Linked to Matched Page */}
      {previewDoc && activePreviewHit && (
        <PdfPageViewer
          document={previewDoc}
          initialPage={activePreviewHit.page}
          onClose={() => setActivePreviewHit(null)}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}
