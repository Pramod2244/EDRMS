"use client";

import React, { useState } from "react";
import { UploadCloud, CheckCircle2 } from "lucide-react";

interface DocumentUploaderProps {
  folderId: string | null;
  onUploadComplete: () => void;
}

export default function DocumentUploader({ folderId, onUploadComplete }: DocumentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setProgress(20);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsUploading(false);
            onUploadComplete();
          }, 500);
          return 100;
        }
        return prev + 25;
      });
    }, 200);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Upload New Documents</h3>
        <span className="text-xs text-muted-foreground">
          Target: {folderId ? `Folder (${folderId})` : "Root Directory"}
        </span>
      </div>

      <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary rounded-lg p-8 cursor-pointer transition bg-secondary/20">
        <UploadCloud className="h-10 w-10 text-primary mb-2" />
        <span className="text-sm font-medium">Click or drag files here to upload</span>
        <span className="text-xs text-muted-foreground mt-1">
          Supports PDF, Word, Excel, PowerPoint, Text & Scanned Images up to 100MB
        </span>
        <input
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
      </label>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>Uploading and initiating pipeline...</span>
            <span className="font-mono">{progress}%</span>
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
