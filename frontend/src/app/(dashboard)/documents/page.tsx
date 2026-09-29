"use client";

import React, { useState, useEffect } from "react";
import FolderTree from "@/components/folders/folder-tree";
import DocumentTable from "@/components/documents/document-table";
import UploadDocumentModal from "@/components/documents/upload-document-modal";
import CreateFolderModal from "@/components/folders/create-folder-modal";
import MobileScanQrModal from "@/components/scanner/mobile-scan-qr-modal";
import { FolderPlus, UploadCloud, Smartphone, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useDocumentStore } from "@/stores/document-store";
import { useAuthStore } from "@/stores/auth-store";

export default function DocumentsPage() {
  const { selectedFolderId, selectFolder, fetchDocuments, fetchFolders } = useDocumentStore();
  const { user } = useAuthStore();
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isMobileQrOpen, setIsMobileQrOpen] = useState(false);
  const [isFolderTreeOpen, setIsFolderTreeOpen] = useState(true);

  useEffect(() => {
    fetchFolders();
    fetchDocuments();
  }, [fetchFolders, fetchDocuments]);

  const canUpload =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ? user.permissions.includes("UPLOAD") : false);

  const canCreateFolder =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "DEPARTMENT_MANAGER" ||
    (user?.permissions ? user.permissions.includes("UPLOAD") : false);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden space-y-3">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Document
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized document management, scanning, OCR text extraction, and granular RBAC governance.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Folders Toggle Button */}
          <button
            onClick={() => setIsFolderTreeOpen(!isFolderTreeOpen)}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-2xs ${isFolderTreeOpen
                ? "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300"
                : "bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
              }`}
            title={isFolderTreeOpen ? "Hide Folder Directory" : "Show Folder Directory"}
          >
            {isFolderTreeOpen ? (
              <>
                <PanelLeftClose className="h-4 w-4 mr-1.5 text-slate-500" />
                <span>Hide Folders</span>
              </>
            ) : (
              <>
                <PanelLeftOpen className="h-4 w-4 mr-1.5 text-orange-600" />
                <span>Show Folders</span>
              </>
            )}
          </button>

          {canUpload && (
            <button
              onClick={() => setIsUploaderOpen(true)}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition shadow-xs"
            >
              <UploadCloud className="h-4 w-4 mr-1.5" />
              Upload Document
            </button>
          )}

          {canCreateFolder && (
            <button
              onClick={() => setIsCreateFolderOpen(true)}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 transition shadow-2xs"
            >
              <FolderPlus className="h-4 w-4 mr-1.5 text-orange-500" />
              New Folder
            </button>
          )}

          {canUpload && (
            <button
              onClick={() => setIsMobileQrOpen(true)}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 transition shadow-2xs"
            >
              <Smartphone className="h-4 w-4 mr-1.5 text-orange-500" />
              Mobile Scan QR
            </button>
          )}
        </div>
      </div>

      {/* Two-Column Responsive Fluid Explorer Layout */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        {/* Left Column: Hierarchical Folder Tree (Collapsible) */}
        <div
          className={`border border-slate-200 rounded-xl bg-white shadow-2xs flex flex-col min-h-0 transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${isFolderTreeOpen
              ? "w-72 p-3.5 opacity-100"
              : "w-0 p-0 border-0 m-0 opacity-0 pointer-events-none"
            }`}
        >
          <div className="flex items-center justify-between mb-2.5 px-1 shrink-0">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Folder Directory
            </h2>
            <div className="flex items-center gap-1">
              {canCreateFolder && (
                <button
                  onClick={() => setIsCreateFolderOpen(true)}
                  className="text-[11px] text-orange-600 hover:text-orange-700 font-bold hover:underline mr-1"
                >
                  + Add
                </button>
              )}
              <button
                onClick={() => setIsFolderTreeOpen(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition"
                title="Collapse Folder Sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <FolderTree
              selectedFolderId={selectedFolderId}
              onSelectFolder={selectFolder}
            />
          </div>
        </div>

        {/* Right Column: Documents Table (Expands to Full Width when sidebar is hidden) */}
        <div className="flex-1 min-w-0 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs flex flex-col min-h-0">
          <DocumentTable
            folderId={selectedFolderId}
            onOpenUpload={() => setIsUploaderOpen(true)}
            isFolderTreeOpen={isFolderTreeOpen}
            onToggleFolderTree={() => setIsFolderTreeOpen(!isFolderTreeOpen)}
          />
        </div>
      </div>

      {/* Floating Upload Modal (Prevents vertical scrolling and grid displacement) */}
      <UploadDocumentModal
        isOpen={isUploaderOpen}
        folderId={selectedFolderId}
        onClose={() => setIsUploaderOpen(false)}
        onUploadSuccess={() => {
          fetchDocuments();
          fetchFolders();
        }}
      />

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
