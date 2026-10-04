"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { useDocumentStore, PipelineStatus } from "@/stores/document-store";
import FilePreview from "./file-preview";
import { formatBytes } from "@/lib/utils";
import { PDFDocument } from "pdf-lib";
import { CustomAlertDialog } from "@/components/common/custom-alert-dialog";
import ScrollablePdfViewer from "./scrollable-pdf-viewer";
import { ArrowLeftRight } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);

  // Invalid file alert modal state
  const [invalidFileAlert, setInvalidFileAlert] = useState<{
    isOpen: boolean;
    fileName: string;
    extension: string;
  } | null>(null);

  // Pre-upload preview & page states
  const [pdfPageCount, setPdfPageCount] = useState<number>(1);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [sidebarPosition, setSidebarPosition] = useState<"left" | "right">("left");
  const activeUploaderSidebarCardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll sidebar when previewPage changes on scroll
  useEffect(() => {
    if (activeUploaderSidebarCardRef.current) {
      activeUploaderSidebarCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [previewPage]);

  const currentFolder = folders.find((f) => f.id === folderId);
  const folderName = currentFolder ? currentFolder.name : "Repository Root (/)";

  // Validate and inspect file (strictly PDF only)
  const handleValidateAndProcessFile = (file: File) => {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      const ext = file.name.split(".").pop() || "unknown";
      setInvalidFileAlert({
        isOpen: true,
        fileName: file.name,
        extension: ext.toLowerCase(),
      });
      setErrorMsg(`Only PDF documents (.pdf) are permitted. You selected "${file.name}" (.${ext}).`);
      setSelectedFile(null);
      return false;
    }

    setErrorMsg(null);
    setInvalidFileAlert(null);
    setSelectedFile(file);
    setPreviewPage(1);
    return true;
  };

  // Step 1: choosing a file only shows a preview; only PDF files allowed.
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleValidateAndProcessFile(files[0]);
    e.target.value = "";
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleValidateAndProcessFile(files[0]);
    }
  };

  // Inspect PDF pages on file select
  useEffect(() => {
    let cancelled = false;

    async function inspectPdf() {
      if (!selectedFile) {
        setPdfPageCount(1);
        return;
      }

      const isPdf =
        selectedFile.type === "application/pdf" ||
        selectedFile.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        try {
          const buffer = await selectedFile.arrayBuffer();
          if (cancelled) return;
          const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
          const count = pdfDoc.getPageCount();
          setPdfPageCount(count);
          setPreviewPage((p) => Math.min(Math.max(1, p), count));
        } catch (e) {
          console.warn("Could not inspect PDF pages:", e);
          setPdfPageCount(1);
        }
      } else {
        setPdfPageCount(1);
      }
    }

    inspectPdf();

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  // Remove a single page from local PDF before uploading
  const handleDeleteLocalPage = async (pageNumber: number) => {
    if (!selectedFile) return;
    if (pdfPageCount <= 1) {
      setErrorMsg("Cannot delete the only page of a document.");
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      if (pageNumber >= 1 && pageNumber <= pdfDoc.getPageCount()) {
        pdfDoc.removePage(pageNumber - 1);
        const newBytes = await pdfDoc.save();
        const newFile = new File([newBytes.buffer as ArrayBuffer], selectedFile.name, { type: "application/pdf" });
        setSelectedFile(newFile);
        const newCount = pdfDoc.getPageCount();
        setPdfPageCount(newCount);
        if (previewPage >= pageNumber) {
          setPreviewPage((p) => Math.max(1, Math.min(p, newCount)));
        }
      }
    } catch (e: any) {
      setErrorMsg("Failed to delete page: " + e.message);
    }
  };

  // Step 2: the Upload button actually sends the file to the backend.
  const handleUpload = async () => {
    const file = selectedFile;
    if (!file) return;
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
    <div className="space-y-4">
      {/* Target Folder Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
            Live Ingestion
          </span>
          <span className="text-xs text-slate-400">Target Folder:</span>
          <span className="text-xs font-bold text-slate-800">{folderName}</span>
        </div>
        <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
          PDF Only Repository
        </span>
      </div>

      {/* Prominent Inline Error Alert */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between shadow-2xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Upload Restricted</p>
              <p className="text-rose-700 text-[11px] mt-0.5">{errorMsg}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-1 rounded-md text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isUploading && !pipeline && !selectedFile ? (
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group ${
            isDragging
              ? "border-orange-500 bg-orange-50/70 scale-[1.01]"
              : "border-slate-300 hover:border-orange-500 bg-slate-50/50"
          }`}
        >
          <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <UploadCloud className="h-6 w-6" />
          </div>
          <span className="text-sm font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
            Click to upload PDF document or drag &amp; drop
          </span>
          <span className="text-xs text-slate-500 mt-1 text-center max-w-sm">
            Only PDF files (.pdf, up to 100MB)
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
        </label>
      ) : !isUploading && !pipeline && selectedFile ? (
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-slate-500">
                  {formatBytes(selectedFile.size)} &middot; {pdfPageCount} {pdfPageCount === 1 ? "page" : "pages"} &middot; Preview only &mdash; not uploaded yet
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setPdfPageCount(1);
                setPreviewPage(1);
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline shrink-0"
            >
              Choose another
            </button>
          </div>

          {/* Action toolbar for preview layout */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-slate-700">Interactive Scroll Preview</span>
              <span>&bull;</span>
              <span className="text-orange-600 font-semibold font-mono">Page {previewPage} of {pdfPageCount}</span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarPosition(sidebarPosition === "left" ? "right" : "left")}
              className="px-2 py-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[11px] flex items-center space-x-1.5 border border-slate-200 transition"
              title={`Switch sidebar to ${sidebarPosition === "left" ? "right" : "left"}`}
            >
              <ArrowLeftRight className="h-3 w-3 text-orange-600" />
              <span>Sidebar: {sidebarPosition === "left" ? "Left" : "Right"}</span>
            </button>
          </div>

          {/* Split Container: Pages Sidebar (Left or Right) + Continuous Scrollable PDF Viewer */}
          <div className={`h-[480px] border border-slate-200 rounded-xl overflow-hidden flex bg-slate-50 ${sidebarPosition === "right" ? "flex-row-reverse" : "flex-row"}`}>
            {/* Pages Sidebar with Live Scroll Sync */}
            <div className={`w-56 shrink-0 bg-white flex flex-col h-full overflow-hidden select-none ${sidebarPosition === "right" ? "border-l border-slate-200" : "border-r border-slate-200"}`}>
              <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                  <Layers className="h-3.5 w-3.5 text-orange-600" />
                  <span>Pages ({pdfPageCount})</span>
                </div>
                <span className="text-[11px] text-orange-600 font-mono font-bold">Page {previewPage}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {Array.from({ length: pdfPageCount }, (_, idx) => {
                  const pNum = idx + 1;
                  const isActive = previewPage === pNum;
                  return (
                    <div
                      key={`uploader-page-${pNum}`}
                      ref={isActive ? activeUploaderSidebarCardRef : null}
                      onClick={() => setPreviewPage(pNum)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isActive
                          ? "bg-orange-50 border-orange-500 text-orange-950 font-semibold ring-2 ring-orange-200 shadow-2xs"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded-md font-bold ${
                            isActive ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          Page {pNum}
                        </span>
                        {isActive && (
                          <span className="text-[9px] text-orange-600 font-bold uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Delete Page button before upload */}
                      <button
                        type="button"
                        disabled={pdfPageCount <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLocalPage(pNum);
                        }}
                        title={pdfPageCount <= 1 ? "Cannot delete the only page" : `Delete Page ${pNum}`}
                        className={`p-1.5 rounded-lg transition ${
                          pdfPageCount <= 1
                            ? "opacity-30 cursor-not-allowed text-slate-300"
                            : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="p-2 border-t border-slate-100 text-[10px] text-slate-400 text-center bg-slate-50/50">
                Click trash to delete any page
              </div>
            </div>

            {/* Continuous Canvas Scroll Viewer with Live Scroll Tracking */}
            <div className="flex-1 h-full overflow-hidden bg-slate-100 relative">
              <ScrollablePdfViewer
                key={`${selectedFile.name}-${selectedFile.size}`}
                file={selectedFile}
                currentPage={previewPage}
                onPageChange={(p) => setPreviewPage(p)}
                onTotalPagesLoaded={(count) => {
                  setPdfPageCount(count);
                }}
                pageIdPrefix="uploader-pdf-page"
                fitMode="width"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">
              {pdfPageCount} {pdfPageCount === 1 ? "page" : "pages"} ready to upload to repository
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPdfPageCount(1);
                  setPreviewPage(1);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                className="inline-flex items-center px-4 py-1.5 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition shadow-xs"
              >
                <UploadCloud className="h-4 w-4 mr-1.5" />
                Upload
              </button>
            </div>
          </div>
        </div>
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

      {/* Invalid File Error Alert Modal */}
      <CustomAlertDialog
        isOpen={!!invalidFileAlert?.isOpen}
        onClose={() => setInvalidFileAlert(null)}
        title="Invalid File Format — PDF Only"
        variant="warning"
        confirmText="Choose a PDF File"
        message={
          invalidFileAlert ? (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600">
                You attempted to upload <strong className="font-semibold text-slate-900 underline decoration-amber-400">{invalidFileAlert.fileName}</strong>, which is not a valid PDF file.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  This repository accepts <strong>only PDF documents (.pdf)</strong>. Other file types (DOCX, images, TXT, Excel, etc.) cannot be uploaded.
                </span>
              </div>
            </div>
          ) : undefined
        }
        onConfirm={() => {
          setInvalidFileAlert(null);
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }}
      />
    </div>
  );
}
