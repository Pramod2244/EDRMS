"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useDocumentStore } from "@/stores/document-store";
import { useAuthStore } from "@/stores/auth-store";
import MobileScanDemo from "./mobile-scan-demo";
export default function MobileScanQrModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const folders = useDocumentStore((state) => state.folders);
  const selectedFolder = useDocumentStore((state) => state.selectedFolderId);
  const [folderId, setFolderId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [session, setSession] = useState<{ token: string; expiresAt: string; folderName: string } | null>(null);
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    setFolderId(selectedFolder || folders.find((folder) => !folder.parentId)?.id || folders[0]?.id || "");
    setBaseUrl(process.env.NEXT_PUBLIC_EDRMS_PUBLIC_URL || window.location.origin);
    setSession(null); setQr(""); setLink(""); setError(""); setStatus("OPEN"); setDemo(false);
  }, [isOpen, selectedFolder]);
  useEffect(() => {
    if (!session || !isOpen || demo) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const response = await fetch(`/api/mobile-capture/${session.token}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Unable to check capture status");
        const result = await response.json();
        if (controller.signal.aborted) return;
        setStatus(result.status);
        if (result.status === "COMPLETED") { await useDocumentStore.getState().fetchDocuments(); return; }
        if (result.status === "EXPIRED") return;
      } catch { if (controller.signal.aborted) return; }
      if (!controller.signal.aborted) timer = setTimeout(check, 2500);
    };
    void check(); return () => { controller.abort(); clearTimeout(timer); };
  }, [session, isOpen, demo]);
  if (!isOpen) return null;
  if (demo) return <MobileScanDemo isOpen onClose={() => { setDemo(false); onClose(); }} />;
  return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3">
    <section role="dialog" aria-modal="true" aria-labelledby="mobile-title" className="bg-white rounded-2xl w-full max-w-xl max-h-[94dvh] overflow-y-auto p-5 sm:p-7 space-y-5 shadow-xl">
      <header className="flex items-center justify-between"><h2 id="mobile-title" className="text-xl font-semibold">Scan with your phone</h2><button aria-label="Close phone scanner" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">✕</button></header>
      <p className="text-sm text-slate-500">Capture and review pages on your phone, then upload one PDF to the selected folder.</p>
      {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 p-3 rounded-lg">{error}</p>}
      <label className="block text-sm font-medium">Destination folder<select disabled={!!session} value={folderId} onChange={(event) => setFolderId(event.target.value)} className="mt-2 w-full border rounded-lg p-3">
        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select></label>
      {!session && <label className="block text-sm font-medium">Address reachable from your phone<input type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="mt-2 w-full border rounded-lg p-3" />
        <span className="block text-xs text-slate-500 mt-2">Use your HTTPS EDRMS address. Localhost and 127.0.0.1 cannot connect a different phone to this computer.</span>
      </label>}
      {session && <div className="text-center space-y-3">
        {qr && <img src={qr} alt="QR code for phone capture" className="mx-auto w-56 h-56" />}
        <a href={link} target="_blank" rel="noreferrer" className="text-orange-700 text-sm underline break-all">Open capture page</a>
        <p className="text-sm font-medium">{status === "COMPLETED" ? "Document received. Processing has started." : status === "EXPIRED" ? "Link expired. Generate a new QR code." : `Waiting for your scan · ${session.folderName}`}</p>
        <p className="text-xs text-slate-500">Upload-only · expires at {new Date(session.expiresAt).toLocaleTimeString()}</p>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <button className="text-xs text-slate-500 underline" onClick={() => setDemo(true)}>Open existing demo</button>
        <button disabled={busy || !folderId} className="bg-orange-500 text-white px-4 py-2.5 rounded-lg disabled:opacity-50" onClick={async () => {
          setBusy(true); setError("");
          try {
            const parsed = new URL(baseUrl);
            if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Enter a valid application address");
            const token = useAuthStore.getState().token || localStorage.getItem("edrms_access_token");
            const response = await fetch("/api/mobile-capture", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ folderId }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.message || "Unable to create capture link");
            const captureUrl = `${baseUrl.replace(/\/$/, "")}/scan/${result.token}`;
            setQr(await QRCode.toDataURL(captureUrl, { width: 256, margin: 2 }));
            setLink(captureUrl); setSession(result); setStatus("OPEN");
          } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create capture link"); }
          finally { setBusy(false); }
        }}>{busy ? "Creating…" : session ? "Generate new QR" : "Generate QR code"}</button>
      </div>
    </section>
  </div>;
}
