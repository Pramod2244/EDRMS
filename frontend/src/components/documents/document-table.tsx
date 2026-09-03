"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  Printer,
  Share2,
  Trash2,
  Eye,
  Inbox,
  FolderOpen,
  CheckCircle2,
} from "lucide-react";
import { DocumentItem } from "@/types";
import { formatBytes } from "@/lib/utils";
import PdfPageViewer from "./pdf-page-viewer";
import TemporaryShareModal from "../permissions/temporary-share-modal";
import { useDocumentStore } from "@/stores/document-store";

interface DocumentTableProps {
  folderId: string | null;
  onOpenUpload?: () => void;
}

export default function DocumentTable({ folderId, onOpenUpload }: DocumentTableProps) {
  const { documents, folders, deleteDocument } = useDocumentStore();
  const [activePreviewDoc, setActivePreviewDoc] = useState<DocumentItem | null>(null);
  const [activeShareDoc, setActiveShareDoc] = useState<DocumentItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  // Filter documents by selected folder
  const currentFolder = folders.find((f) => f.id === folderId);
  const currentFolderName = currentFolder ? currentFolder.name : "All Documents (Root)";

  const filteredDocuments = documents.filter((doc) => {
    if (!folderId) return true; // Root shows all or root
    return doc.folderId === folderId;
  });

  // Handle Download simulation
  const handleDownload = (doc: DocumentItem) => {
    const element = document.createElement("a");
    const file = new Blob([`EDRMS Document Content: ${doc.name}\nVersion: v${doc.currentVersion}\nStatus: ${doc.status}`], {
      type: "text/plain",
    });
    element.href = URL.createObjectURL(file);
    element.download = doc.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showNotification(`Downloading "${doc.name}"...`);
  };

  // Handle Print simulation
  const handlePrint = (doc: DocumentItem) => {
    showNotification(`Opening watermarked print stream for "${doc.name}"`);
    setActivePreviewDoc(doc);
  };

  // Handle Delete
  const handleDelete = (doc: DocumentItem) => {
    if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      deleteDocument(doc.id);
      showNotification(`Deleted "${doc.name}"`);
    }
  };

  return (
    <div className="w-full relative">
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-3 right-4 z-40 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Table Header / Breadcrumb Bar */}
      <div className="h-12 border-b border-border bg-secondary/30 px-6 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-2">
          <FolderOpen className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">{currentFolderName}</span>
          <span>&middot;</span>
          <span>{filteredDocuments.length} files</span>
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
          <Inbox className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <h4 className="font-semibold text-foreground text-sm">No documents in this folder</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Upload files or scan documents from ADF to populate this directory.
            </p>
          </div>
          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition mt-2"
            >
              Upload to this folder
            </button>
          )}
        </div>
      ) : (
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
            {filteredDocuments.map((doc) => (
              <tr key={doc.id} className="hover:bg-secondary/20 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <span
                        onClick={() => setActivePreviewDoc(doc)}
                        className="font-medium text-foreground block hover:underline cursor-pointer"
                      >
                        {doc.name}
                      </span>
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
                      onClick={() => handleDownload(doc)}
                      title="Download Original"
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handlePrint(doc)}
                      title="Print Document (Watermarked)"
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setActiveShareDoc(doc)}
                      title="Share Link / Temporary Access"
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
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
      )}

      {/* Preview Modal */}
      {activePreviewDoc && (
        <PdfPageViewer
          document={activePreviewDoc}
          onClose={() => setActivePreviewDoc(null)}
        />
      )}

      {/* Temporary Share Modal */}
      {activeShareDoc && (
        <TemporaryShareModal
          document={activeShareDoc}
          isOpen={!!activeShareDoc}
          onClose={() => setActiveShareDoc(null)}
        />
      )}
    </div>
  );
}
