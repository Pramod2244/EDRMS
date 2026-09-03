"use client";

import React, { useState } from "react";
import { Lock, FileText, Eye } from "lucide-react";

export default function TemporarySharePage({ params }: { params: { token: string } }) {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUnlocked(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full border border-border bg-card rounded-lg p-8 space-y-6 text-center">
        <div className="h-12 w-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto">
          <Lock className="h-6 w-6" />
        </div>

        <div>
          <h1 className="text-xl font-bold">Protected Document Share</h1>
          <p className="text-xs text-muted-foreground mt-1">
            This document has been shared with time-bounded temporary access.
          </p>
        </div>

        {!isUnlocked ? (
          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Passcode (if required)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter document access passcode"
                className="w-full mt-1.5 px-3 py-2 rounded-md border border-border bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition"
            >
              Access Document
            </button>
          </form>
        ) : (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-center space-x-2 text-sm text-foreground">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold">Confidential_Report_Q3.pdf</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Watermarked Preview Only &bull; Download Disabled
            </p>
            <button className="w-full inline-flex items-center justify-center py-2.5 rounded-md bg-secondary text-foreground font-medium text-sm hover:bg-muted transition">
              <Eye className="h-4 w-4 mr-2" /> Open Secure Viewer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
