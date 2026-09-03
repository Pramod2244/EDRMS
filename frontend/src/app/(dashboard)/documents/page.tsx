"use client";

import React, { useState } from "react";
import FolderTree from "@/components/folders/folder-tree";
import DocumentTable from "@/components/documents/document-table";
import DocumentUploader from "@/components/documents/document-uploader";
import CreateFolderModal from "@/components/folders/create-folder-modal";
import MobileScanQrModal from "@/components/scanner/mobile-scan-qr-modal";
import { FolderPlus, UploadCloud, Smartphone } from "lucide-react";
import { useDocumentStore } from "@/stores/document-store";

export default function DocumentsPage() {
  const { selectedFolderId, selectFolder } = useDocumentStore();
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isMobileQrOpen, setIsMobileQrOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Document Repository
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Store, scan, process, preview, and govern enterprise documents with fine-grained RBAC.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsUploaderOpen(!isUploaderOpen)}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition shadow-sm"
          >
            <UploadCloud className="h-4 w-4 mr-2" />
            {isUploaderOpen ? "Close Uploader" : "Upload Document"}
          </button>
          <button
            onClick={() => setIsCreateFolderOpen(true)}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-secondary hover:bg-muted text-secondary-foreground font-semibold text-xs border border-border transition"
          >
            <FolderPlus className="h-4 w-4 mr-2 text-primary" />
            New Folder
          </button>
          <button
            onClick={() => setIsMobileQrOpen(true)}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-secondary hover:bg-muted text-secondary-foreground font-semibold text-xs border border-border transition"
          >
            <Smartphone className="h-4 w-4 mr-2 text-primary" />
            Mobile Scan QR
          </button>
        </div>
      </div>

      {/* Upload Drawer */}
      {isUploaderOpen && (
        <div className="border border-border rounded-xl p-6 bg-card shadow-lg animate-in fade-in slide-in-from-top-4">
          <DocumentUploader
            folderId={selectedFolderId}
            onUploadComplete={() => setIsUploaderOpen(false)}
          />
        </div>
      )}

      {/* Two-Column Explorer Layout */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left Column: Hierarchical Folder Tree */}
        <div className="col-span-12 lg:col-span-3 border border-border rounded-xl p-4 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Folder Directory
            </h2>
            <button
              onClick={() => setIsCreateFolderOpen(true)}
              className="text-[11px] text-primary hover:underline font-semibold"
            >
              + Add
            </button>
          </div>
          <FolderTree
            selectedFolderId={selectedFolderId}
            onSelectFolder={selectFolder}
          />
        </div>

        {/* Right Column: Documents Table */}
        <div className="col-span-12 lg:col-span-9 border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          <DocumentTable
            folderId={selectedFolderId}
            onOpenUpload={() => setIsUploaderOpen(true)}
          />
        </div>
      </div>

      {/* Modals */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
      />

      <MobileScanQrModal
        isOpen={isMobileQrOpen}
        onClose={() => setIsMobileQrOpen(false)}
      />
    </div>
  );
}
