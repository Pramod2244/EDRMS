"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Lock,
  FileText,
  Eye,
  Download,
  Shield,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import PdfPageViewer from "@/components/documents/pdf-page-viewer";
import { DocumentItem } from "@/types";

interface ShareInfo {
  valid: boolean;
  requiresPassword: boolean;
  documentId?: string;
  documentName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  validUntil?: string;
  remainingViews?: number | null;
  canDownload?: boolean;
  canPrint?: boolean;
  errorMessage?: string;
}

interface UnlockedDocument {
  documentId: string;
  name: string;
  mimeType: string;
  extension: string;
  fileSizeBytes: number;
  pageCount: number;
  previewUrl: string;
  downloadUrl: string;
  canDownload: boolean;
  canPrint: boolean;
  remainingViews?: number | null;
}

export default function TemporarySharePage({ params }: { params: { token: string } }) {
  const token = params.token;

  const [isLoading, setIsLoading] = useState(true);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockedDoc, setUnlockedDoc] = useState<UnlockedDocument | null>(null);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);

  // Fetch share metadata from backend
  const fetchShareInfo = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/temporary-access/info/${token}`);
      if (res.ok) {
        const data: ShareInfo = await res.json();
        setShareInfo(data);
        if (!data.valid) {
          setErrorMsg(data.errorMessage || "This temporary share link is no longer valid.");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setShareInfo({ valid: false, requiresPassword: false });
        setErrorMsg(data.errorMessage || "This share link was not found or has expired.");
      }
    } catch (err) {
      console.error("Error fetching share info:", err);
      // Fallback for legacy token format
      if (token.startsWith("token_")) {
        setShareInfo({
          valid: true,
          requiresPassword: false,
          documentName: "Protected Document",
        });
      } else {
        setErrorMsg("Unable to connect to document server.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchShareInfo();
  }, [fetchShareInfo]);

  // Handle unlock submission
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/temporary-access/unlock/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (res.ok) {
        const data: UnlockedDocument = await res.json();
        setUnlockedDoc(data);
        setIsUnlocked(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Invalid passcode. Please check the passcode and try again.");
      }
    } catch (err) {
      console.error("Error unlocking share:", err);
      setErrorMsg("Failed to unlock document. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert UnlockedDocument to DocumentItem for PdfPageViewer modal
  const viewerDocument: DocumentItem | null = unlockedDoc
    ? {
      id: unlockedDoc.documentId,
      folderId: null,
      name: unlockedDoc.name,
      mimeType: unlockedDoc.mimeType,
      extension: unlockedDoc.extension,
      fileSizeBytes: unlockedDoc.fileSizeBytes,
      currentVersion: 1,
      status: "INDEXED",
      storageProvider: "LOCAL",
      pageCount: unlockedDoc.pageCount || 1,
      createdAt: "Temporary Access",
      fileUrl: unlockedDoc.previewUrl,
    }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8 font-sans">
      <div className={`w-full ${isUnlocked ? "max-w-4xl" : "max-w-md"} border border-slate-200 bg-white rounded-2xl p-6 md:p-8 space-y-6 text-center shadow-md transition-all duration-200`}>
        {/* Brand Header */}
        <div className="flex flex-col items-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-2xs">
            {isUnlocked ? <FileText className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
          </div>
          <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold uppercase tracking-wider">
            <Building2 className="h-3 w-3 text-orange-500" />
            <span>Arkaa digital</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            {isUnlocked ? unlockedDoc?.name : "Protected Document Share"}
          </h1>
          <p className="text-xs text-slate-500 max-w-md">
            {isUnlocked
              ? "This document has been securely unlocked. You can view pages below or open fullscreen."
              : "Access to this document is time-bounded and governed by repository compliance policies."}
          </p>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
            <span className="text-xs font-semibold text-slate-600">Verifying access token...</span>
          </div>
        ) : shareInfo && !shareInfo.valid && !isUnlocked ? (
          /* Error State */
          <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
            <h3 className="text-sm font-bold text-rose-900">Share Link Unavailable</h3>
            <p className="text-xs text-rose-700 leading-relaxed">
              {errorMsg || "This temporary share link has expired or reached its maximum view limit."}
            </p>
            <div className="pt-2">
              <a
                href="/documents"
                className="inline-flex items-center text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline"
              >
                Go to Document
              </a>
            </div>
          </div>
        ) : !isUnlocked ? (
          /* Passcode / Access Form */
          <div className="space-y-4 text-left">
            {/* Document Info Pill */}
            {shareInfo?.documentName && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <FileText className="h-5 w-5 text-orange-500 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-xs text-slate-900 block truncate">
                      {shareInfo.documentName}
                    </span>
                    {shareInfo.fileSizeBytes && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatBytes(shareInfo.fileSizeBytes)}
                      </span>
                    )}
                  </div>
                </div>
                {shareInfo.remainingViews !== null && shareInfo.remainingViews !== undefined && (
                  <span className="text-[11px] font-semibold text-orange-700 bg-orange-100/70 border border-orange-200 px-2 py-0.5 rounded-full shrink-0">
                    {shareInfo.remainingViews} {shareInfo.remainingViews === 1 ? "view" : "views"} left
                  </span>
                )}
              </div>
            )}

            {/* Error Alert */}
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-4">
              {shareInfo?.requiresPassword ? (
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                    Enter Passcode Required by Sender
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter document passcode"
                    required
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This link is protected with a passcode set during link generation.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>No passcode required. Click below to view the document.</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition shadow-xs flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying Passcode...</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    <span>Access Document</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Unlocked Document View */
          unlockedDoc && (
            <div className="space-y-6 text-left">
              {/* Document Overview Bar */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-orange-500 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{unlockedDoc.name}</h3>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                      <span>{formatBytes(unlockedDoc.fileSizeBytes)}</span>
                      <span>&bull;</span>
                      <span>{unlockedDoc.pageCount} {unlockedDoc.pageCount === 1 ? "page" : "pages"}</span>
                      {unlockedDoc.remainingViews !== null && unlockedDoc.remainingViews !== undefined && (
                        <>
                          <span>&bull;</span>
                          <span className="text-orange-700 font-semibold font-mono">
                            {unlockedDoc.remainingViews} {unlockedDoc.remainingViews === 1 ? "view" : "views"} remaining
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsViewerModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition shadow-xs flex items-center space-x-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Open Fullscreen Viewer</span>
                  </button>
                  {unlockedDoc.canDownload && (
                    <a
                      href={unlockedDoc.downloadUrl}
                      download
                      className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition shadow-2xs flex items-center space-x-1.5"
                    >
                      <Download className="h-4 w-4 text-orange-500" />
                      <span>Download File</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Direct Inline Document Preview */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-inner">
                <div className="h-10 bg-slate-200/80 px-4 flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span>Document Preview: {unlockedDoc.name}</span>
                  <button
                    onClick={() => setIsViewerModalOpen(true)}
                    className="text-orange-700 hover:text-orange-800 font-bold hover:underline flex items-center text-[11px]"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" /> Fullscreen View
                  </button>
                </div>
                {unlockedDoc.mimeType === "application/pdf" ? (
                  <iframe
                    src={unlockedDoc.previewUrl}
                    className="w-full h-[600px] border-0 bg-white"
                    title={unlockedDoc.name}
                  />
                ) : (
                  <div className="p-4 flex items-center justify-center bg-white min-h-[400px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={unlockedDoc.previewUrl}
                      alt={unlockedDoc.name}
                      className="max-h-[550px] max-w-full object-contain rounded-lg shadow-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Footer */}
        <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span>
            Powered by <span className="font-semibold text-slate-700">Arkaa Digital</span>
          </span>
          <span className="font-mono text-slate-400 text-[10px]">End-to-End Encrypted</span>
        </div>
      </div>

      {/* Fullscreen PdfPageViewer Modal */}
      {isViewerModalOpen && viewerDocument && (
        <PdfPageViewer
          document={viewerDocument}
          initialPage={1}
          onClose={() => setIsViewerModalOpen(false)}
          isShared={true}
          hideTabs={true}
          canDownload={Boolean(unlockedDoc?.canDownload)}
          canPrint={Boolean(unlockedDoc?.canPrint)}
        />
      )}
    </div>
  );
}
