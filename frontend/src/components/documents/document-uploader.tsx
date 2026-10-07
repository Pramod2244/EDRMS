"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck2,
  Cpu,
  Layers,
  Search,
  Sparkles,
  Shield,
  FileText,
  Clock,
} from "lucide-react";
import { useDocumentStore, PipelineStatus } from "@/stores/document-store";

interface DocumentUploaderProps {
  folderId: string | null;
  onUploadComplete: () => void;
}

const PIPELINE_STEPS = [
  { key: "VALIDATE_FILE", label: "File Validation" },
  { key: "MALWARE_SCAN", label: "Malware Scan" },
  { key: "HASH_FILE", label: "SHA-256 Checksum" },
  { key: "STORE_ORIGINAL", label: "Store Original" },
  { key: "EXTRACT_TEXT", label: "Extract Text" },
  { key: "DETECT_PAGES", label: "Page Detection" },
  { key: "OCR_IF_REQUIRED", label: "Tesseract OCR" },
  { key: "GENERATE_THUMBNAILS", label: "Thumbnails" },
  { key: "GENERATE_PREVIEW", label: "Generate Preview" },
  { key: "CREATE_ASSETS", label: "Asset Manifest" },
  { key: "INDEX_SEARCH", label: "OpenSearch Index" },
  { key: "FINALIZE", label: "Repository Finalize" },
];

export default function DocumentUploader({ folderId, onUploadComplete }: DocumentUploaderProps) {
  const { uploadRealDocument, folders } = useDocumentStore();
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentFolder = folders.find((f) => f.id === folderId);
  const folderName = currentFolder ? currentFolder.name : "Repository Root (/)";

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setFileName(file.name);
    setIsUploading(true);
    setErrorMsg(null);
    setPipeline({
      documentId: "",
      documentName: file.name,
      status: "RUNNING",
      progressPercentage: 5,
      steps: [],
    });

    try {
      const doc = await uploadRealDocument(file, folderId, (statusUpdate) => {
        setPipeline(statusUpdate);
        if (statusUpdate.status === "COMPLETED" || statusUpdate.status === "READY") {
          setTimeout(() => {
            setIsUploading(false);
            onUploadComplete();
          }, 1200);
        } else if (statusUpdate.status === "FAILED") {
          setIsUploading(false);
          setErrorMsg(statusUpdate.errorMessage || "Processing failed in pipeline");
        }
      });

      if (!doc) {
        setIsUploading(false);
        setErrorMsg("Document upload failed to start. Verify backend service.");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setIsUploading(false);
      setErrorMsg(err.message || "An unexpected error occurred during upload.");
    }
  };

  const getStepStatus = (stepKey: string) => {
    if (!pipeline) return "PENDING";
    const found = pipeline.steps.find((s) => s.stepName === stepKey);
    return found ? found.status : "PENDING";
  };

  const getStepDuration = (stepKey: string) => {
    if (!pipeline) return null;
    const found = pipeline.steps.find((s) => s.stepName === stepKey);
    return found && found.durationMs !== undefined && found.durationMs !== null
      ? `${found.durationMs}ms`
      : null;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-900">12-Stage Enterprise Ingestion Pipeline</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
              Arkaa digital
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real automated validation, SHA-256 hashing, Tika extraction, Tesseract OCR, and OpenSearch full-text indexing.
          </p>
        </div>
        <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full font-mono">
          Target: <strong className="text-slate-900">{folderName}</strong>
        </span>
      </div>

      {!isUploading && !pipeline ? (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-xl p-8 cursor-pointer transition-all bg-slate-50/50 hover:bg-orange-50/30 group">
          <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <UploadCloud className="h-6 w-6" />
          </div>
          <span className="text-sm font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
            Click to upload real document or drag &amp; drop
          </span>
          <span className="text-xs text-slate-500 mt-1 text-center max-w-sm">
            PDF, scanned PDF, TIFF, PNG, JPEG, DOCX, XLSX, TXT (up to 100MB)
          </span>
          <input
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
        </label>
      ) : (
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 truncate max-w-xs">{fileName}</p>
                <p className="text-[10px] text-slate-500">
                  {pipeline?.status === "COMPLETED" || pipeline?.status === "READY"
                    ? "Processing completed successfully!"
                    : pipeline?.status === "FAILED"
                    ? "Pipeline processing failed"
                    : "Executing 12-stage ingestion pipeline..."}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-orange-600 font-mono">
                {pipeline?.progressPercentage || 10}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 transition-all duration-300 rounded-full ${
                pipeline?.status === "FAILED" ? "bg-rose-500" : "bg-orange-500"
              }`}
              style={{ width: `${pipeline?.progressPercentage || 10}%` }}
            />
          </div>

          {/* 12-Stage Visual Steps Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            {PIPELINE_STEPS.map((step, idx) => {
              const status = getStepStatus(step.key);
              const duration = getStepDuration(step.key);
              const isCompleted = status === "COMPLETED";
              const isRunning = status === "RUNNING";
              const isFailed = status === "FAILED";

              return (
                <div
                  key={step.key}
                  className={`p-2 rounded-lg border text-xs flex flex-col justify-between transition-colors ${
                    isCompleted
                      ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                      : isRunning
                      ? "bg-orange-50 border-orange-300 text-orange-950 animate-pulse"
                      : isFailed
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : "bg-slate-50/70 border-slate-200 text-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[9px] font-bold text-slate-400">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    {isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : isRunning ? (
                      <Loader2 className="h-3.5 w-3.5 text-orange-600 animate-spin" />
                    ) : isFailed ? (
                      <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-slate-300" />
                    )}
                  </div>
                  <span className="font-medium text-[11px] leading-tight truncate">{step.label}</span>
                  <div className="mt-1 flex items-center justify-between text-[9px]">
                    <span className="capitalize font-mono opacity-80">{status.toLowerCase()}</span>
                    {duration && <span className="font-mono text-emerald-700 font-semibold">{duration}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setIsUploading(false);
                  setPipeline(null);
                }}
                className="px-2.5 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold transition shrink-0 ml-3"
              >
                Dismiss &amp; Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
