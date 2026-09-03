"use client";

import React, { useState } from "react";
import { UploadCloud, CheckCircle2 } from "lucide-react";
import { useDocumentStore } from "@/stores/document-store";

interface DocumentUploaderProps {
  folderId: string | null;
  onUploadComplete: () => void;
}

export default function DocumentUploader({ folderId, onUploadComplete }: DocumentUploaderProps) {
  const { uploadDocument, folders } = useDocumentStore();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const currentFolder = folders.find((f) => f.id === folderId);
  const folderName = currentFolder ? currentFolder.name : "Repository Root (/)";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);
    setProgress(15);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // Actually persist to document store
          uploadDocument(file.name, file.size, file.type || "application/pdf", folderId);

          setTimeout(() => {
            setIsUploading(false);
            onUploadComplete();
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 200);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Upload Document</h3>
        <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full font-mono">
          Target: {folderName}
        </span>
      </div>

      <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary rounded-xl p-8 cursor-pointer transition bg-secondary/10 hover:bg-secondary/20">
        <UploadCloud className="h-10 w-10 text-primary mb-2" />
        <span className="text-sm font-semibold text-foreground">
          Click to choose a file or drag &amp; drop
        </span>
        <span className="text-xs text-muted-foreground mt-1 text-center">
          PDF, scanned PDF, DOCX, XLSX, PPTX, TXT and common formats up to 100MB
        </span>
        <input
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
      </label>

      {isUploading && (
        <div className="space-y-2 p-3 bg-secondary/30 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">
              {progress < 100 ? "Uploading & computing SHA-256..." : "Ingestion complete!"}
            </span>
            <span className="font-mono font-bold text-primary">{progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-2 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
