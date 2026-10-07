"use client";

import React, { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

export type PreviewKind = "pdf" | "image" | "docx" | "text" | "unsupported";

const TEXT_EXT = ["txt", "csv", "md", "json", "log", "xml"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];

export function getPreviewKind(extension?: string, mimeType?: string): PreviewKind {
  const ext = (extension || "").toLowerCase().replace(".", "");
  const mime = (mimeType || "").toLowerCase();
  if (ext === "pdf" || mime.includes("pdf")) return "pdf";
  if (IMAGE_EXT.includes(ext) || (mime.startsWith("image/") && !mime.includes("tiff"))) return "image";
  if (ext === "docx") return "docx";
  if (TEXT_EXT.includes(ext) || mime.startsWith("text/")) return "text";
  return "unsupported";
}

interface FilePreviewProps {
  /** A local file (pre-upload preview) ... */
  file?: File | null;
  /** ...or a URL to fetch (post-upload preview). */
  url?: string | null;
  name: string;
  extension?: string;
  mimeType?: string;
  /** Extra fragment appended to PDF urls, e.g. "toolbar=0". */
  pdfFragment?: string;
  className?: string;
}

export default function FilePreview({
  file,
  url,
  name,
  extension,
  mimeType,
  pdfFragment = "toolbar=1",
  className = "",
}: FilePreviewProps) {
  const ext = extension || name.split(".").pop() || "";
  const kind = getPreviewKind(ext, mimeType || file?.type);
  const docxRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setStatus("loading");
    setError(null);
    setObjectUrl(null);
    setText("");

    async function load() {
      try {
        if (kind === "unsupported") {
          setStatus("ready");
          return;
        }

        let blob: Blob;
        if (file) {
          blob = file;
        } else if (url) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Could not load file (HTTP ${res.status})`);
          blob = await res.blob();
        } else {
          throw new Error("No file to preview");
        }
        if (cancelled) return;

        if (kind === "pdf" || kind === "image") {
          const type = kind === "pdf" ? "application/pdf" : blob.type || mimeType || "image/png";
          createdUrl = URL.createObjectURL(new Blob([blob], { type }));
          setObjectUrl(createdUrl);
        } else if (kind === "text") {
          setText(await blob.text());
        } else if (kind === "docx") {
          const buffer = await blob.arrayBuffer();
          const { renderAsync } = await import("docx-preview");
          if (cancelled || !docxRef.current) return;
          docxRef.current.innerHTML = "";
          await renderAsync(buffer, docxRef.current, undefined, {
            inWrapper: true,
            ignoreWidth: false,
            breakPages: true,
          });
        }
        if (!cancelled) setStatus("ready");
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Unable to render preview");
          setStatus("error");
        }
      }
    }
    load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file, url, kind, mimeType]);

  return (
    <div className={`relative w-full h-full bg-white overflow-hidden ${className}`}>
      {status === "loading" && kind !== "unsupported" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center space-y-2 bg-white/80">
          <Loader2 className="h-6 w-6 text-orange-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-600">Loading preview...</span>
        </div>
      )}

      {status === "error" && (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
          <FileText className="h-8 w-8 text-rose-500" />
          <p className="text-xs font-semibold text-slate-800">{name}</p>
          <p className="text-xs text-rose-600">{error}</p>
        </div>
      )}

      {kind === "pdf" && objectUrl && (
        <iframe src={`${objectUrl}#${pdfFragment}`} title={name} className="w-full h-full border-0" />
      )}

      {kind === "image" && objectUrl && (
        <div className="w-full h-full overflow-auto flex items-center justify-center p-3 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={objectUrl} alt={name} className="max-w-full max-h-full object-contain rounded shadow" />
        </div>
      )}

      {kind === "text" && status === "ready" && (
        <pre className="w-full h-full overflow-auto p-4 text-xs leading-relaxed font-mono text-slate-800 bg-slate-50 whitespace-pre-wrap break-words">
          {text || "(empty file)"}
        </pre>
      )}

      {kind === "docx" && (
        <div className="w-full h-full overflow-auto bg-slate-100">
          <div ref={docxRef} />
        </div>
      )}

      {kind === "unsupported" && (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <FileText className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold text-slate-800 break-all">{name}</p>
          <p className="text-xs text-slate-500 max-w-xs">
            In-browser preview isn&apos;t available for .{ext.toLowerCase()} files. The file will still be stored
            securely and can be downloaded after upload.
          </p>
        </div>
      )}
    </div>
  );
}
