"use client";

import React, { useState } from "react";
import { Scan, RefreshCw, CheckCircle2 } from "lucide-react";
import { useDocumentStore } from "@/stores/document-store";

export default function ScannerAgentWidget() {
  const { selectedFolderId, ingestFromScanner } = useDocumentStore();
  const [agentStatus, setAgentStatus] = useState<"connected" | "scanning" | "done">("connected");
  const [statusMessage, setStatusMessage] = useState("Canon DR-C225 II");
  const [isScanning, setIsScanning] = useState(false);

  const handleTriggerScan = () => {
    setIsScanning(true);
    setAgentStatus("scanning");
    setStatusMessage("Feeding pages from ADF...");

    setTimeout(() => {
      setStatusMessage("Acquiring 4 pages (300 DPI)...");
    }, 1000);

    setTimeout(() => {
      setStatusMessage("Assembling PDF & uploading...");
      ingestFromScanner("Canon DR-C225 II", 4, selectedFolderId);
    }, 2200);

    setTimeout(() => {
      setIsScanning(false);
      setAgentStatus("done");
      setStatusMessage("Batch scan ingested!");
      setTimeout(() => {
        setAgentStatus("connected");
        setStatusMessage("Canon DR-C225 II");
      }, 2000);
    }, 3000);
  };

  return (
    <div className="bg-secondary/40 border border-border rounded-xl p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-bold text-foreground">
          <Scan className="h-4 w-4 text-primary" />
          <span>Desktop Scanner</span>
        </div>
        <div className="flex items-center space-x-1.5">
          {agentStatus === "connected" && (
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Scanner Online" />
          )}
          {agentStatus === "scanning" && (
            <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
          )}
          {agentStatus === "done" && (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          )}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground truncate font-mono">
        {statusMessage}
      </div>

      <button
        onClick={handleTriggerScan}
        disabled={isScanning}
        className="w-full py-2 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center space-x-2 shadow-sm"
      >
        <Scan className="h-3.5 w-3.5" />
        <span>{isScanning ? "Scanning Feeder..." : "Scan from ADF"}</span>
      </button>
    </div>
  );
}
