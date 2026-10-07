"use client";

import React from "react";
import Link from "next/link";
import { Folder, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-5">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-xs">
          <Folder className="h-8 w-8" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">404</h1>
          <h2 className="text-base font-bold text-slate-800 mt-1">Page Not Found</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            The requested document view or system resource could not be found or has moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/documents"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition shadow-xs space-x-2"
          >
            <Home className="h-4 w-4" />
            <span>Go to Documents</span>
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Go to Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
