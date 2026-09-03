"use client";

import React, { useState } from "react";
import { HardDrive, Cloud, Cpu, Save, CheckCircle2 } from "lucide-react";
import { useDocumentStore } from "@/stores/document-store";

export default function AdminPage() {
  const { activeStorageProvider, activeOcrEngine, setStorageProvider, setOcrEngine } = useDocumentStore();
  const [selectedProvider, setSelectedProvider] = useState<"LOCAL" | "S3">(activeStorageProvider);
  const [selectedOcr, setSelectedOcr] = useState(activeOcrEngine);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setStorageProvider(selectedProvider);
    setOcrEngine(selectedOcr);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          System Configuration &amp; Storage Abstraction
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure runtime storage providers, OCR engines, and document pipeline behaviors.
        </p>
      </div>

      {/* Storage Provider Selection Card */}
      <div className="border border-border rounded-xl p-6 bg-card space-y-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-primary/20 text-primary">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Active Storage Provider</h2>
            <p className="text-xs text-muted-foreground">
              Current Active Target: <span className="font-mono text-primary font-semibold">{activeStorageProvider}</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Select whether newly ingested documents persist to the on-premise local server filesystem or AWS S3 cloud storage.
          Existing documents continue to stream seamlessly from their original storage provider.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div
            onClick={() => setSelectedProvider("LOCAL")}
            className={`cursor-pointer border rounded-xl p-5 transition ${
              selectedProvider === "LOCAL"
                ? "border-primary bg-primary/10 ring-1 ring-primary"
                : "border-border bg-secondary/30 hover:bg-secondary/60"
            }`}
          >
            <div className="flex items-center space-x-2.5 font-bold text-sm text-foreground">
              <HardDrive className="h-4 w-4 text-primary" />
              <span>Local Server Storage</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Partitioned filesystem directory writes (`/var/data/edrms/storage`) with path traversal protection and atomic move semantics.
            </p>
          </div>

          <div
            onClick={() => setSelectedProvider("S3")}
            className={`cursor-pointer border rounded-xl p-5 transition ${
              selectedProvider === "S3"
                ? "border-primary bg-primary/10 ring-1 ring-primary"
                : "border-border bg-secondary/30 hover:bg-secondary/60"
            }`}
          >
            <div className="flex items-center space-x-2.5 font-bold text-sm text-foreground">
              <Cloud className="h-4 w-4 text-primary" />
              <span>AWS S3 / MinIO Cloud Storage</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Cloud-native object storage with SSE encryption and presigned direct browser upload/download URLs.
            </p>
          </div>
        </div>
      </div>

      {/* OCR Engine Card */}
      <div className="border border-border rounded-xl p-6 bg-card space-y-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-primary/20 text-primary">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">OCR Engine Configuration</h2>
            <p className="text-xs text-muted-foreground">
              Asynchronous optical character recognition provider
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Engine utilized for asynchronous scanned document and image text extraction and bounding box coordinate calculation.
        </p>

        <select
          value={selectedOcr}
          onChange={(e) => setSelectedOcr(e.target.value)}
          className="w-full max-w-sm px-3.5 py-2.5 rounded-lg border border-border bg-secondary text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="AWS_TEXTRACT">AWS Textract (Tables, Forms &amp; Geometry)</option>
          <option value="TESSERACT">Local Tesseract Engine (Offline Air-gapped)</option>
        </select>
      </div>

      {/* Save Button */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleSave}
          className="inline-flex items-center px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition shadow-sm"
        >
          {isSaved ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {isSaved ? "Configuration Updated & Persisted!" : "Save & Switch Storage Provider"}
        </button>
      </div>
    </div>
  );
}
