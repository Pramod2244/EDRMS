"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-5">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">System Notice</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {error?.message || "An unexpected error occurred while loading this view."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition shadow-xs space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
          <Link
            href="/documents"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition space-x-2"
          >
            <Home className="h-4 w-4" />
            <span>Return to Repository</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
