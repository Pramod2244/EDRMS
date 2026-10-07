"use client";

import React from "react";
import { X, UploadCloud, Folder } from "lucide-react";
import DocumentUploader from "./document-uploader";
import { useDocumentStore } from "@/stores/document-store";
import { NumberingPreview } from "@/components/folders/folder-numbering";

interface UploadDocumentModalProps {
  isOpen: boolean;
  folderId: string | null;
  onClose: () => void;
  onUploadSuccess?: () => void;
}

export default function UploadDocumentModal({
  isOpen,
  folderId,
  onClose,
  onUploadSuccess,
}: UploadDocumentModalProps) {
  const { folders } = useDocumentStore();

  if (!isOpen) return null;

  const currentFolder = folders.find((f) => f.id === folderId);
  const targetFolderName = currentFolder ? currentFolder.name : "Repository Root (/)";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-orange-500 text-white shadow-xs">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Upload Document</h3>
              <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-0.5">
                <span>Target Folder:</span>
                <span className="inline-flex items-center font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                  <Folder className="h-3 w-3 mr-1 text-orange-500" />
                  {targetFolderName}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
            title="Close Uploader"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Document Uploader with 12-Stage Pipeline */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <NumberingPreview folderId={folderId}/>
          <DocumentUploader
            folderId={folderId}
            onUploadComplete={() => {
              if (onUploadSuccess) onUploadSuccess();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
