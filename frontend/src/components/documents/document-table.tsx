"use client";

import React, { useState } from "react";
import { FileText, Download, Printer, Share2, Trash2, Eye } from "lucide-react";
import { DocumentItem } from "@/types";
import { formatBytes } from "@/lib/utils";
import PdfPageViewer from "./pdf-page-viewer";

interface DocumentTableProps {
  folderId: string | null;
}

export default function DocumentTable({ folderId }: DocumentTableProps) {
  const [activePreviewDoc, setActivePreviewDoc] = useState<DocumentItem | null>(null);

  const mockDocuments: DocumentItem[] = [
    {
      id: "doc-1",
      folderId: folderId || "root",
      name: "Q3_Vendor_Master_Contract.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      fileSizeBytes: 3450200,
      currentVersion: 2,
      status: "INDEXED",
      storageProvider: "LOCAL",
      pageCount: 18,
      createdAt: "2026-09-03 10:30",
    },
    {
      id: "doc-2",
      folderId: folderId || "root",
      name: "Audited_Balance_Sheet_2026.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
      fileSizeBytes: 1240900,
      currentVersion: 1,
      status: "INDEXED",
      storageProvider: "LOCAL",
      pageCount: 4,
      createdAt: "2026-09-03 11:15",
    },
    {
      id: "doc-3",
      folderId: folderId || "root",
      name: "Scanned_Receipt_Receipts_ADF.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      fileSizeBytes: 5490200,
      currentVersion: 1,
      status: "PROCESSING",
      storageProvider: "LOCAL",
      pageCount: 8,
      createdAt: "2026-09-03 11:45",
    },
  ];

  return (
    <div className="w-full">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary/40 text-muted-foreground border-b border-border">
          <tr>
            <th className="px-6 py-3 font-semibold">Name</th>
            <th className="px-6 py-3 font-semibold">Size</th>
            <th className="px-6 py-3 font-semibold">Version</th>
            <th className="px-6 py-3 font-semibold">Status</th>
            <th className="px-6 py-3 font-semibold">Storage</th>
            <th className="px-6 py-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {mockDocuments.map((doc) => (
            <tr key={doc.id} className="hover:bg-secondary/20 transition">
              <td className="px-6 py-4">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <span className="font-medium text-foreground block">{doc.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {doc.pageCount ? `${doc.pageCount} pages` : "Processing pages..."}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                {formatBytes(doc.fileSizeBytes)}
              </td>
              <td className="px-6 py-4 text-xs font-mono">v{doc.currentVersion}</td>
              <td className="px-6 py-4">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    doc.status === "INDEXED"
                      ? "bg-green-500/20 text-green-400"
                      : doc.status === "PROCESSING"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {doc.status}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                  {doc.storageProvider}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => setActivePreviewDoc(doc)}
                    title="Preview Document"
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    title="Download Original"
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    title="Print Document"
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button
                    title="Share Link"
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    title="Delete Document"
                    className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Preview Modal */}
      {activePreviewDoc && (
        <PdfPageViewer
          document={activePreviewDoc}
          onClose={() => setActivePreviewDoc(null)}
        />
      )}
    </div>
  );
}
