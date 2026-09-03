"use client";

import React, { useState, useEffect } from "react";
import { Scan, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export default function ScannerAgentWidget() {
  const [agentStatus, setAgentStatus] = useState<"connected" | "disconnected" | "scanning">("connected");
  const [activeDevice, setActiveDevice] = useState("Canon DR-C225 II");
  const [isScanning, setIsScanning] = useState(false);

  const handleTriggerScan = () => {
    setIsScanning(true);
    setAgentStatus("scanning");
    setTimeout(() => {
      setIsScanning(false);
      setAgentStatus("connected");
    }, 2500);
  };

  return (
    <div className="bg-secondary/40 border border-border rounded-lg p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs font-semibold">
          <Scan className="h-4 w-4 text-primary" />
          <span>Desktop Scanner</span>
        </div>
        <div className="flex items-center space-x-1">
          {agentStatus === "connected" && (
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          )}
          {agentStatus === "scanning" && (
            <RefreshCw className="h-3 w-3 text-primary animate-spin" />
          )}
          {agentStatus === "disconnected" && (
            <span className="h-2 w-2 rounded-full bg-destructive" />
          )}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground truncate">
        {agentStatus === "scanning" ? "Scanning feeder pages..." : `Device: ${activeDevice}`}
      </div>

      <button
        onClick={handleTriggerScan}
        disabled={isScanning}
        className="w-full py-1.5 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
      >
        <Scan className="h-3.5 w-3.5" />
        <span>{isScanning ? "Scanning..." : "Scan from ADF"}</span>
      </button>
    </div>
  );
}
