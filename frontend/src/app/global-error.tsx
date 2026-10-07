"use client";

import React, { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global system error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center font-sans antialiased text-slate-800">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-4">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-900">Application Error</h2>
          <p className="text-xs text-slate-500">
            A critical error occurred. Please refresh or reset to resume.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition shadow-xs"
            >
              Reset Application
            </button>
            <a
              href="/documents"
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition"
            >
              Go to Documents
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
