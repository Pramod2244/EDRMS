"use client";

import React, { useState } from "react";
import { Share2, X, Copy, Check, ExternalLink, ShieldCheck } from "lucide-react";
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
  const [copied, setCopied] = useState(false);

  if (!isOpen || !document) return null;

  const shareToken = `token_${document.id.replace(/[^a-zA-Z0-9]/g, "")}_${expiry}`;
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/share/${shareToken}`
    : `/share/${shareToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in fade-in-50 zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-left">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Share Document</h3>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{document.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Configurations */}
        <div className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Access Duration
              </label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full mt-1.5 px-3 py-2 rounded-lg border border-border bg-secondary/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="1h">1 Hour (High Security)</option>
                <option value="24h">24 Hours (Standard)</option>
                <option value="7d">7 Days (Audit Review)</option>
                <option value="30d">30 Days (Client Access)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Maximum Views
              </label>
              <select
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                className="w-full mt-1.5 px-3 py-2 rounded-lg border border-border bg-secondary/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="1">1 View (Burn after reading)</option>
                <option value="5">5 Views</option>
                <option value="20">20 Views</option>
                <option value="unlimited">Unlimited Views</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="protect-pwd"
              checked={hasPassword}
              onChange={(e) => setHasPassword(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="protect-pwd" className="text-xs font-medium cursor-pointer">
              Protect with Access Passcode
            </label>
          </div>

          {hasPassword && (
            <div>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter passcode"
                className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Generated Share Link Box */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Secure Share Link
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-secondary/70 text-xs font-mono text-muted-foreground truncate"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition flex items-center space-x-1.5 shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Actions Bottom Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Open Temporary Link
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
