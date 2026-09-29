"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Share2,
  X,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Key,
  Clock,
  Eye,
  RefreshCw,
  Download,
  Printer,
} from "lucide-react";
import { DocumentItem } from "@/types";

interface TemporaryShareModalProps {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TemporaryShareModal({
  document,
  isOpen,
  onClose,
}: TemporaryShareModalProps) {
  const [expiry, setExpiry] = useState("24h");
  const [maxViews, setMaxViews] = useState("5");
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState("Confidential123!");
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowPrint, setAllowPrint] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate real backend share grant
  const generateShareLink = useCallback(async () => {
    if (!document) return;
    setIsGenerating(true);

    try {
      const res = await fetch("/api/temporary-access/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          duration: expiry,
          maxViews: maxViews,
          password: hasPassword && password.trim() ? password.trim() : null,
          allowDownload: allowDownload,
          allowPrint: allowPrint,
          permissionsMask: "VIEW",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShareToken(data.token);
      } else {
        // Fallback backward-compatible token
        const legacyToken = `token_${document.id.replace(/[^a-zA-Z0-9]/g, "")}_${expiry}`;
        setShareToken(legacyToken);
      }
    } catch (e) {
      console.error("Error creating share link:", e);
      const legacyToken = `token_${document.id.replace(/[^a-zA-Z0-9]/g, "")}_${expiry}`;
      setShareToken(legacyToken);
    } finally {
      setIsGenerating(false);
    }
  }, [document, expiry, maxViews, hasPassword, password, allowDownload, allowPrint]);

  // Generate link on mount / open and when settings change
  useEffect(() => {
    if (isOpen && document) {
      generateShareLink();
    }
  }, [isOpen, document, generateShareLink]);

  if (!isOpen || !document) return null;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareToken}`
      : `/share/${shareToken}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPasscode = () => {
    navigator.clipboard.writeText(password);
    setCopiedPasscode(true);
    setTimeout(() => setCopiedPasscode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-xl animate-in fade-in-50 zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 text-left">
            <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Share Document</h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">{document.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Configurations */}
        <div className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                Access Duration
              </label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="1h">1 Hour (High Security)</option>
                <option value="24h">24 Hours (Standard)</option>
                <option value="7d">7 Days (Review)</option>
                <option value="30d">30 Days (Client)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                Maximum Views
              </label>
              <select
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="1">1 View (Burn after reading)</option>
                <option value="5">5 Views</option>
                <option value="20">20 Views</option>
                <option value="unlimited">Unlimited Views</option>
              </select>
            </div>
          </div>

          {/* Passcode Protection Toggle */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="protect-pwd"
                checked={hasPassword}
                onChange={(e) => setHasPassword(e.target.checked)}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 h-4 w-4"
              />
              <label htmlFor="protect-pwd" className="text-xs font-medium text-slate-700 cursor-pointer flex items-center">
                <Key className="h-3.5 w-3.5 mr-1 text-slate-400" />
                Protect with Access Passcode
              </label>
            </div>

            {hasPassword && (
              <div className="space-y-1 pl-6">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter passcode required to open"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-[11px] text-slate-500">
                  Recipients will be required to enter this passcode before accessing the document.
                </p>
              </div>
            )}
          </div>

          {/* Recipient Permissions Configuration */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
              Recipient Permissions
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`flex items-start space-x-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                  allowDownload
                    ? "bg-orange-50/70 border-orange-200 text-slate-900"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 h-4 w-4 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold flex items-center space-x-1">
                    <Download className="h-3.5 w-3.5 text-orange-500 mr-1" />
                    Allow Download
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Permit downloading original file
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start space-x-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                  allowPrint
                    ? "bg-orange-50/70 border-orange-200 text-slate-900"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={allowPrint}
                  onChange={(e) => setAllowPrint(e.target.checked)}
                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 h-4 w-4 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold flex items-center space-x-1">
                    <Printer className="h-3.5 w-3.5 text-orange-500 mr-1" />
                    Allow Print
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Permit printing from viewer
                  </p>
                </div>
              </label>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 pt-0.5">
              <Shield className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <span>
                {allowDownload && allowPrint
                  ? "Recipient can view, download, and print this document."
                  : allowDownload
                  ? "Recipient can view and download, but cannot print."
                  : allowPrint
                  ? "Recipient can view and print, but cannot download."
                  : "View-only access. Download and print are strictly disabled."}
              </span>
            </div>
          </div>

          {/* Generated Share Link Box */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Secure Share Link
              </label>
              {isGenerating && (
                <span className="text-[10px] text-orange-600 font-medium flex items-center">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Updating grant...
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono text-slate-700 select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition flex items-center space-x-1.5 shrink-0 shadow-xs"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>
          </div>

          {/* Passcode Copy Helper */}
          {hasPassword && password && (
            <div className="p-3 rounded-lg bg-orange-50/70 border border-orange-200 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Key className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-slate-600">Passcode:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-orange-200">
                  {password}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPasscode}
                className="text-[11px] font-semibold text-orange-700 hover:text-orange-800 hover:underline flex items-center space-x-1"
              >
                {copiedPasscode ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                <span>{copiedPasscode ? "Copied!" : "Copy Passcode"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Actions Bottom Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-xs font-semibold text-orange-600 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Open Temporary Link
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
