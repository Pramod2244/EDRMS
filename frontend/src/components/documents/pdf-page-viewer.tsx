"use client";

import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Printer } from "lucide-react";
import { DocumentItem } from "@/types";

interface PdfPageViewerProps {
  document: DocumentItem;
  initialPage?: number;
  onClose: () => void;
}

export default function PdfPageViewer({
  document,
  initialPage = 1,
  onClose,
}: PdfPageViewerProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const totalPages = document.pageCount || 10;
  const [zoom, setZoom] = useState(100);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Viewer Header */}
        <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-secondary/30">
          <div className="flex items-center space-x-3">
            <span className="font-semibold text-sm truncate max-w-sm">{document.name}</span>
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
              v{document.currentVersion}
            </span>
          </div>

          {/* Navigation & Controls */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 bg-secondary rounded-lg px-2 py-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center space-x-1 bg-secondary rounded-lg px-2 py-1">
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="p-1 rounded hover:bg-muted"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono px-2">{zoom}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 10))}
                className="p-1 rounded hover:bg-muted"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            <button
              title="Print Watermarked Document"
              className="p-1.5 rounded-lg bg-secondary hover:bg-muted transition text-muted-foreground hover:text-foreground"
            >
              <Printer className="h-4 w-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Viewer Viewport with Simulated Watermark Overlay */}
        <div className="flex-1 bg-neutral-900 overflow-auto p-8 flex items-center justify-center relative select-none">
          <div
            className="bg-white text-black rounded shadow-2xl relative transition-all duration-200 overflow-hidden flex flex-col justify-between p-12"
            style={{
              width: `${(600 * zoom) / 100}px`,
              height: `${(850 * zoom) / 100}px`,
            }}
          >
            {/* Dynamic Watermark Canvas Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-15 rotate-[-35deg] text-center leading-relaxed">
              <span className="text-3xl font-black uppercase tracking-widest text-neutral-800">
                CONFIDENTIAL &bull; AUTHORIZED VIEWER &bull; {document.id}
              </span>
            </div>

            {/* Document Mock Page Content */}
            <div className="space-y-4">
              <div className="h-6 bg-neutral-200 rounded w-1/3" />
              <div className="h-3 bg-neutral-100 rounded w-full" />
              <div className="h-3 bg-neutral-100 rounded w-5/6" />
              <div className="h-3 bg-neutral-100 rounded w-4/6" />

              <div className="pt-6 space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-1/4" />
                <p className="text-xs text-neutral-600 leading-5">
                  Page {currentPage}: Extracted document body content and OCR layer. All search occurrences
                  are highlighted directly on this canvas layer. Printing routes through dynamic server-side
                  watermarking with audit logging.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-neutral-400 border-t border-neutral-100 pt-4">
              <span>EDRMS SECURE PREVIEW</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
