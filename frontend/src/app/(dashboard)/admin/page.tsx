"use client";

import React, { useState } from "react";
import { HardDrive, Cloud, Cpu, Save } from "lucide-react";

export default function AdminPage() {
  const [activeProvider, setActiveProvider] = useState<"LOCAL" | "S3">("LOCAL");
  const [ocrEngine, setOcrEngine] = useState("AWS_TEXTRACT");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure runtime storage providers, OCR engines, and document pipeline behaviors.
        </p>
      </div>

      {/* Storage Provider Selection Card */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <div className="flex items-center space-x-3">
          <HardDrive className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Active Storage Provider</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Select whether newly ingested documents persist to the on-premise local server filesystem or AWS S3 cloud storage. Existing documents continue to load from their original storage provider.
        </p>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div
            onClick={() => setActiveProvider("LOCAL")}
            className={`cursor-pointer border rounded-lg p-4 transition ${
              activeProvider === "LOCAL"
                ? "border-primary bg-primary/10"
                : "border-border bg-secondary/30 hover:bg-secondary/60"
            }`}
          >
            <div className="flex items-center space-x-2 font-medium">
              <HardDrive className="h-4 w-4" />
              <span>Local Server Storage</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Partitioned filesystem writes with path traversal protection and atomic move semantics.
            </p>
          </div>

          <div
            onClick={() => setActiveProvider("S3")}
            className={`cursor-pointer border rounded-lg p-4 transition ${
              activeProvider === "S3"
                ? "border-primary bg-primary/10"
                : "border-border bg-secondary/30 hover:bg-secondary/60"
            }`}
          >
            <div className="flex items-center space-x-2 font-medium">
              <Cloud className="h-4 w-4" />
              <span>AWS S3 / MinIO Cloud Storage</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cloud-native object storage with SSE encryption and presigned direct browser upload URLs.
            </p>
          </div>
        </div>
      </div>

      {/* OCR Engine Card */}
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <div className="flex items-center space-x-3">
          <Cpu className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">OCR Engine Configuration</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Engine utilized for asynchronous scanned document and image text extraction.
        </p>
        <select
          value={ocrEngine}
          onChange={(e) => setOcrEngine(e.target.value)}
          className="w-full max-w-xs px-3 py-2 rounded-md border border-border bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="AWS_TEXTRACT">AWS Textract (Tables & Forms)</option>
          <option value="TESSERACT">Local Tesseract Engine (Offline)</option>
        </select>
      </div>

      {/* Save Button */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleSave}
          className="inline-flex items-center px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaved ? "Saved Successfully!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
