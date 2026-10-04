"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface ScrollablePdfViewerProps {
  /** Local File or Blob (pre-upload) */
  file?: File | Blob | null;
  /** Or URL to fetch (post-upload) */
  url?: string | null;
  /** Active page controlled by parent (1-indexed) */
  currentPage: number;
  /** Callback when scrolling changes active page in real time */
  onPageChange: (pageNumber: number) => void;
  /** Callback when total pages are loaded */
  onTotalPagesLoaded?: (totalPages: number) => void;
  /** Zoom percentage */
  zoom?: number;
  /** Fit mode */
  fitMode?: "width" | "page" | "auto";
  /** ID prefix for scroll targets */
  pageIdPrefix?: string;
  className?: string;
}

export default function ScrollablePdfViewer({
  file,
  url,
  currentPage,
  onPageChange,
  onTotalPagesLoaded,
  zoom = 100,
  fitMode = "width",
  pageIdPrefix = "pdf-page",
  className = "",
}: ScrollablePdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Tracks the last page synced by scroll to distinguish user scrolling vs external clicks
  const lastScrolledPageRef = useRef<number>(currentPage);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const programmaticScrollTimerRef = useRef<any>(null);

  // Load PDF Document via pdfjs-dist
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setPdfDoc(null);
    setTotalPages(0);

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (pdfjs.GlobalWorkerOptions) {
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
        }

        let data: ArrayBuffer;
        if (file) {
          data = await file.arrayBuffer();
        } else if (url) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load PDF (HTTP ${res.status})`);
          data = await res.arrayBuffer();
        } else {
          throw new Error("No PDF source provided");
        }

        if (cancelled) return;

        const loadingTask = pdfjs.getDocument({
          data,
          cMapUrl: "/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        const pages = doc.numPages;
        setTotalPages(pages);
        if (onTotalPagesLoaded) {
          onTotalPagesLoaded(pages);
        }
        setIsLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error("ScrollablePdfViewer load error:", err);
          setLoadError(err?.message || "Failed to load PDF preview");
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [file, url]);

  // Real-time active page detection on scroll
  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Reading reference line is at ~35% from container top
    const readingLineY = containerRect.top + containerRect.height * 0.35;

    const pageEls = container.querySelectorAll<HTMLElement>(`[data-page-number]`);
    if (pageEls.length === 0) return;

    let bestPage = 1;
    let foundOnReadingLine = false;
    let maxVisibleHeight = -1;

    pageEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const pageNum = parseInt(el.getAttribute("data-page-number") || "1", 10);

      // Check if this page covers the reading line
      if (rect.top <= readingLineY && rect.bottom >= readingLineY) {
        bestPage = pageNum;
        foundOnReadingLine = true;
        return;
      }

      // Fallback: Pick page with greatest visible vertical height in viewport
      if (!foundOnReadingLine) {
        const visibleTop = Math.max(rect.top, containerRect.top);
        const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        if (visibleHeight > maxVisibleHeight) {
          maxVisibleHeight = visibleHeight;
          bestPage = pageNum;
        }
      }
    });

    if (bestPage && bestPage !== lastScrolledPageRef.current) {
      lastScrolledPageRef.current = bestPage;
      onPageChange(bestPage);
    }
  }, [onPageChange]);

  // Attach native passive scroll listener for maximum responsiveness
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Programmatic scroll to target page when currentPage changes EXTERNALLY (e.g. clicking sidebar thumbnail)
  useEffect(() => {
    if (!containerRef.current || totalPages <= 0) return;

    // If currentPage equals lastScrolledPageRef, this change was triggered by the user scrolling -> do nothing!
    if (currentPage === lastScrolledPageRef.current) {
      return;
    }

    lastScrolledPageRef.current = currentPage;

    const targetEl = document.getElementById(`${pageIdPrefix}-${currentPage}`);
    if (!targetEl || !containerRef.current) return;

    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
    }

    targetEl.scrollIntoView({ behavior: "smooth", block: "start" });

    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 650);
  }, [currentPage, pageIdPrefix, totalPages]);

  // Initial jump to initial page once pages are loaded
  useEffect(() => {
    if (totalPages > 0 && currentPage > 1 && containerRef.current) {
      const targetEl = document.getElementById(`${pageIdPrefix}-${currentPage}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }
  }, [totalPages]);

  if (isLoading) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center space-y-3 bg-slate-50 ${className}`}>
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
        <span className="text-xs font-semibold text-slate-600">Rendering PDF pages...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2 bg-slate-50 ${className}`}>
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <p className="text-xs font-bold text-slate-800">Preview Error</p>
        <p className="text-xs text-rose-600 max-w-sm">{loadError}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`w-full h-full overflow-y-auto overflow-x-auto p-4 flex flex-col items-center space-y-6 bg-slate-100 select-none ${className}`}
    >
      {Array.from({ length: totalPages }, (_, idx) => {
        const pageNum = idx + 1;
        return (
          <PdfSinglePage
            key={`page-${pageNum}-${zoom}-${fitMode}`}
            pdfDoc={pdfDoc}
            pageNumber={pageNum}
            totalPages={totalPages}
            zoom={zoom}
            fitMode={fitMode}
            pageIdPrefix={pageIdPrefix}
            isActive={currentPage === pageNum}
          />
        );
      })}
    </div>
  );
}

interface PdfSinglePageProps {
  pdfDoc: any;
  pageNumber: number;
  totalPages: number;
  zoom: number;
  fitMode: "width" | "page" | "auto";
  pageIdPrefix: string;
  isActive: boolean;
}

function PdfSinglePage({
  pdfDoc,
  pageNumber,
  totalPages,
  zoom,
  fitMode,
  pageIdPrefix,
  isActive,
}: PdfSinglePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 600, height: 800 });

  useEffect(() => {
    let renderTask: any = null;
    let cancelled = false;

    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        // Base unscaled viewport
        const baseViewport = page.getViewport({ scale: 1.0 });

        // Calculate scaling
        let scale = (zoom / 100) * 1.5; // High-DPI crisp scale
        if (fitMode === "width") {
          const containerWidth = Math.min(window.innerWidth - 380, 850);
          scale = (containerWidth / baseViewport.width) * (zoom / 100);
        } else if (fitMode === "page") {
          const containerHeight = Math.min(window.innerHeight - 220, 750);
          scale = (containerHeight / baseViewport.height) * (zoom / 100);
        }

        const viewport = page.getViewport({ scale: Math.max(0.4, scale) });
        setDimensions({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });

        await renderTask.promise;
        if (!cancelled) {
          setIsRendered(true);
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== "RenderingCancelledException") {
          console.warn(`Render error page ${pageNumber}:`, err);
          setRenderError(err?.message || "Render error");
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber, zoom, fitMode]);

  return (
    <div
      id={`${pageIdPrefix}-${pageNumber}`}
      data-page-number={pageNumber}
      className={`relative flex flex-col items-center transition-all duration-150 ${
        isActive
          ? "ring-4 ring-orange-500/40 rounded-xl"
          : "hover:ring-2 hover:ring-slate-300 rounded-xl"
      }`}
    >
      {/* Page Card Container */}
      <div className="relative bg-white rounded-lg shadow-md border border-slate-200/90 overflow-hidden">
        {!isRendered && !renderError && (
          <div
            style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
            className="flex flex-col items-center justify-center bg-slate-50 space-y-2"
          >
            <Loader2 className="h-6 w-6 text-orange-500 animate-spin" />
            <span className="text-[11px] font-medium text-slate-500">Loading Page {pageNumber}...</span>
          </div>
        )}

        {renderError && (
          <div
            style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
            className="flex flex-col items-center justify-center bg-rose-50 text-rose-700 p-4 space-y-1"
          >
            <AlertCircle className="h-6 w-6" />
            <span className="text-xs font-semibold">Page {pageNumber} failed to render</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`block max-w-full h-auto ${!isRendered ? "hidden" : ""}`}
        />
      </div>

      {/* Floating Bottom Page Badge */}
      <div
        className={`mt-2 px-3 py-1 rounded-full text-[11px] font-mono font-semibold shadow-xs transition-colors ${
          isActive
            ? "bg-orange-500 text-white shadow-orange-200"
            : "bg-white text-slate-600 border border-slate-200"
        }`}
      >
        Page {pageNumber} of {totalPages}
      </div>
    </div>
  );
}
