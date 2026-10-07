"use client";

import React, { useState } from "react";
import { Smartphone, X, CheckCircle2, RefreshCw } from "lucide-react";
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl animate-in fade-in-50 zoom-in-95 text-center">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-left">
            <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Scan with Mobile</h3>
              <p className="text-xs text-slate-500">Target: <strong className="text-slate-800">{folderName}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl mx-auto w-48 h-48 flex items-center justify-center shadow-xs relative">
          {/* Simulated High-Density QR Code Graphic */}
          <div className="grid grid-cols-6 gap-1.5 w-full h-full p-2">
            {Array.from({ length: 36 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-xs ${
                  (i % 2 === 0 && i % 3 === 0) || i < 7 || i % 6 === 0 || i > 28
                    ? "bg-slate-900"
                    : "bg-slate-100"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-900">
            Point smartphone camera at QR code
          </p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            Opens the mobile web capture camera with automatic edge detection and uploads to Arkaa digital repository.
          </p>
        </div>

        {/* Simulation Button for Testing */}
        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={handleSimulateMobileUpload}
            disabled={isSimulating || success}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold transition flex items-center justify-center space-x-2 shadow-2xs"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
                <span>Receiving multi-page scan from mobile...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-700">Mobile Scan Ingested Successfully!</span>
              </>
            ) : (
              <>
                <Smartphone className="h-4 w-4 text-orange-500" />
                <span>Test: Simulate Uploading from Mobile</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
