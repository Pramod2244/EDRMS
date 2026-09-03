"use client";

import React, { useState } from "react";
import { QrCode, Smartphone, X, CheckCircle2, RefreshCw } from "lucide-react";
import { useDocumentStore } from "@/stores/document-store";

interface MobileScanQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileScanQrModal({ isOpen, onClose }: MobileScanQrModalProps) {
  const { selectedFolderId, folders, uploadDocument } = useDocumentStore();
  const [isSimulating, setIsSimulating] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const folderName = currentFolder ? currentFolder.name : "Repository Root";

  const handleSimulateMobileUpload = () => {
    setIsSimulating(true);
    setTimeout(() => {
      uploadDocument(
        `Mobile_Scan_${new Date().toISOString().slice(0, 10)}.pdf`,
        3120400,
        "application/pdf",
        selectedFolderId
      );
      setIsSimulating(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in-50 zoom-in-95 text-center">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-left">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Scan with Phone</h3>
              <p className="text-xs text-muted-foreground">Target: {folderName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="p-6 bg-white rounded-xl mx-auto w-48 h-48 flex items-center justify-center shadow-inner relative">
          {/* Simulated QR Code Graphic */}
          <div className="grid grid-cols-6 gap-1.5 w-full h-full p-2">
            {Array.from({ length: 36 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-sm ${
                  (i % 2 === 0 && i % 3 === 0) || i < 7 || i % 6 === 0 || i > 28
                    ? "bg-black"
                    : "bg-neutral-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">
            Point phone camera at this QR code
          </p>
          <p className="text-[11px] text-muted-foreground">
            Opens the mobile camera with real-time edge detection and uploads straight to this folder.
          </p>
        </div>

        {/* Simulation Button for Testing */}
        <div className="pt-2 border-t border-border">
          <button
            onClick={handleSimulateMobileUpload}
            disabled={isSimulating || success}
            className="w-full py-2.5 px-4 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground text-xs font-semibold transition flex items-center justify-center space-x-2"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span>Receiving multi-page scan from mobile...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span>Mobile Scan Ingested Successfully!</span>
              </>
            ) : (
              <>
                <Smartphone className="h-4 w-4 text-primary" />
                <span>Test: Simulate Uploading from Phone</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
