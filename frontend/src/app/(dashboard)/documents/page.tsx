"use client";

import React, { useState } from "react";
import FolderTree from "@/components/folders/folder-tree";
import DocumentTable from "@/components/documents/document-table";
import DocumentUploader from "@/components/documents/document-uploader";
import { FolderPlus, UploadCloud, Smartphone } from "lucide-react";

export default function DocumentsPage() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Document Repository</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Store, scan, process, preview, and govern enterprise documents with fine-grained RBAC.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsUploaderOpen(!isUploaderOpen)}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition"
          >
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload Document
          </button>
          <button className="inline-flex items-center px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm hover:bg-muted transition">
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </button>
          <button className="inline-flex items-center px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm hover:bg-muted transition">
            <Smartphone className="h-4 w-4 mr-2" />
            Mobile Scan QR
          </button>
        </div>
      </div>

      {/* Upload Drawer / Modal */}
      {isUploaderOpen && (
        <div className="border border-border rounded-lg p-6 bg-card">
          <DocumentUploader
            folderId={selectedFolderId}
            onUploadComplete={() => setIsUploaderOpen(false)}
          />
        </div>
      )}

      {/* Two-Column Explorer Layout */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left Column: Hierarchical Folder Tree */}
        <div className="col-span-3 border border-border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Folder Directory
          </h2>
          <FolderTree
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
          />
        </div>

        {/* Right Column: Documents Table */}
        <div className="col-span-9 border border-border rounded-lg bg-card overflow-hidden">
          <DocumentTable folderId={selectedFolderId} />
        </div>
      </div>
    </div>
  );
}
