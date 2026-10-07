"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import "./scan.css";
import { prepareScanImage } from "@/lib/scan-image";
import { Camera, Images, ScanLine, RotateCw, Crop, RefreshCw, ArrowUp, Trash2, ShieldCheck, AlertCircle, FileCheck2 } from "lucide-react";
type ScanCheck = { eligible: boolean; issues: string[]; width: number; height: number; bytes: number; recognizedCharacters: number };
type CapturedPage = { id: string; blob: Blob; url: string; rotation: number; check: ScanCheck };
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
export default function PhoneCapturePage() {
  const { token } = useParams<{ token: string }>();
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [folder, setFolder] = useState("");
  const [referencePreview,setReferencePreview]=useState("");
  const [referenceId,setReferenceId]=useState("");
  const [status, setStatus] = useState("LOADING");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CapturedPage | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef(false);
  const uploadRef = useRef<XMLHttpRequest | null>(null);
  const jobRef = useRef<AbortController | null>(null);
  const validationRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const urlsRef = useRef(new Set<string>());
  const createPreviewUrl = (blob: Blob) => { const url = URL.createObjectURL(blob); urlsRef.current.add(url); return url; };
  const releasePreviewUrl = (url: string) => { URL.revokeObjectURL(url); urlsRef.current.delete(url); };
  const prepareImage = (blob: Blob, rotation = 0, crop = false) => prepareScanImage(blob, rotation, crop, jobRef.current?.signal);
  const [progress, setProgress] = useState("");
  const [activePage, setActivePage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [pdfBytes, setPdfBytes] = useState<number | null>(null);
  const totalBytes = pages.reduce((total, page) => total + page.blob.size, 0);
  const invalidPages = pages.filter((page) => !page.check.eligible);
  const validatePage = async (blob: Blob): Promise<ScanCheck> => {
    const form = new FormData(); form.append("page", blob, "page.jpg");
    const controller = new AbortController(); validationRef.current = controller; const timeout = setTimeout(() => controller.abort(), 75000);
    try {
      const response = await fetch(`/api/mobile-capture/${token}/validate`, { method: "POST", body: form, signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to validate this page. Try again.");
      return result;
    } catch (cause) {
      return { eligible: false, issues: [cause instanceof Error && cause.name !== "AbortError" ? cause.message : "The quality check could not finish. Check your connection and try again."], width: 0, height: 0, bytes: blob.size, recognizedCharacters: 0 };
    } finally { clearTimeout(timeout); }
  };
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; uploadRef.current?.abort(); jobRef.current?.abort(); validationRef.current?.abort(); urlsRef.current.forEach((url) => URL.revokeObjectURL(url)); urlsRef.current.clear(); }; }, []);
  useEffect(() => {
    if (!pages.length && !pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pages.length, pending]);
  useEffect(() => {
    const controller = new AbortController();
    const linkTimeout = setTimeout(() => { controller.abort(); setError("The capture link could not be checked. Reconnect and reopen the QR link."); setStatus("INVALID"); }, 15000);
    fetch(`/api/mobile-capture/${token}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const result = await response.json(); if (!response.ok) throw new Error(result.message || "Capture link is invalid");
      setFolder(result.folderName); setStatus(result.status); setExpiresAt(result.expiresAt);
      setReferencePreview(result.referencePreview || "");
    }).catch((cause) => { if (!controller.signal.aborted) { setError(cause.message); setStatus("INVALID"); } }).finally(() => clearTimeout(linkTimeout));
    return () => { clearTimeout(linkTimeout); controller.abort(); };
  }, [token]);
  useEffect(() => {
    if (!expiresAt || status !== "OPEN" || busy) return;
    const timer = setTimeout(() => setStatus("EXPIRED"), Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt, status, busy]);
  const addFiles = async (files: FileList | null, capture = false) => {
    if (!files?.length || operationRef.current) return;
    const selected = Array.from(files);
    if (pages.length + selected.length > 30) { setError("Use up to 30 pages per document"); return; }
    if (selected.some((file) => file.size > 20 * 1024 * 1024)) { setError("Choose photos smaller than 20 MB each."); return; }
    operationRef.current = true; jobRef.current = new AbortController();
    setBusy(true); setError(""); let unownedUrl: string | null = null;
    try {
      for (let index = 0; index < selected.length; index++) {
        if (jobRef.current?.signal.aborted) throw new Error("Stopped. You can add the remaining photos again.");
        const file = selected[index];
        setProgress(`Preparing photo ${index + 1} of ${selected.length}…`);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const blob = await prepareImage(file);
        if (!mountedRef.current) return;
        const draft = { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, blob, url: createPreviewUrl(blob), rotation: 0, check: { eligible: false, issues: [], width: 0, height: 0, bytes: blob.size, recognizedCharacters: 0 } };
        unownedUrl = draft.url;
        if (capture) { setPending(draft); unownedUrl = null; }
        setProgress(`Checking text and quality · photo ${index + 1} of ${selected.length}…`);
        const check = await validatePage(blob);
        if (jobRef.current?.signal.aborted) throw new Error("Stopped. You can check this photo again.");
        if (!mountedRef.current) return;
        const checked = { ...draft, check };
        if (capture) setPending(checked);
        else { setPages((previous) => [...previous, checked]); if (index === 0) setActivePage(checked.id); }
        unownedUrl = null;
      }


    } catch (cause) { if (unownedUrl) releasePreviewUrl(unownedUrl); if (mountedRef.current) setError((cause instanceof Error ? cause.message : "Unable to open this photo.") + " Previously added pages are kept."); }
    finally { operationRef.current = false; if (mountedRef.current) { setBusy(false); setProgress(""); } }
  };
  const confirmCapture = (next = false) => {
    if (!pending || busy || !pending.check.eligible) return;
    setPages((previous) => [...previous, pending]); setActivePage(pending.id); setPending(null);
    if (next && pages.length + 1 < 30) cameraRef.current?.click();
  };
  const recheck = async (page: CapturedPage, trim = false) => {
    if (operationRef.current) return;
    operationRef.current = true; jobRef.current = new AbortController(); setBusy(true); setProgress(trim ? "Trimming and checking page…" : "Checking text and quality…");
    try {
      const blob = trim || page.rotation ? await prepareImage(page.blob, page.rotation, trim) : page.blob;
      const check = await validatePage(blob);
      if (!mountedRef.current || jobRef.current?.signal.aborted) return;
      const updated = { ...page, blob, check, rotation: 0, url: blob === page.blob ? page.url : createPreviewUrl(blob) };
      if (pending?.id === page.id) setPending(updated);
      else setPages((previous) => previous.map((entry) => entry.id === page.id ? updated : entry));
      if (updated.url !== page.url) releasePreviewUrl(page.url);
    } catch { if (mountedRef.current) setError("Photo processing stopped or failed. Your original page is kept; try again."); }
    finally { operationRef.current = false; if (mountedRef.current) { setBusy(false); setProgress(""); } }
  };
  const upload = async () => {
    if (operationRef.current || pending || invalidPages.length || !pages.length || totalBytes > 100 * 1024 * 1024) return;
    operationRef.current = true; jobRef.current = new AbortController(); setBusy(true); setError(""); setProgress("Validating upload…");
    try {
      const form = new FormData();
      for (let index = 0; index < pages.length; index++) {
        const page = pages[index]; const blob = page.rotation ? await prepareImage(page.blob, page.rotation) : page.blob;
        form.append("pages", blob, `page-${index + 1}.jpg`);
      }
      const result = await new Promise<{ pdfBytes?: number;referenceId?:string }>((resolve, reject) => {
        const request = new XMLHttpRequest(); uploadRef.current = request;
        request.open("POST", `/api/mobile-capture/${token}/upload`); request.timeout = 180000;
        request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(event.loaded === event.total ? "Checking every page and saving PDF…" : `Uploading ${mb(event.loaded)} / ${mb(event.total)} · ${Math.round(event.loaded / event.total * 100)}%`); };
        request.onload = () => { let data; try { data = JSON.parse(request.responseText); } catch { reject(new Error("Unable to confirm upload. Your pages are kept; try again.")); return; } if (request.status >= 200 && request.status < 300) resolve(data); else reject(new Error(data.message || "Upload could not be accepted. Check the pages and try again.")); };
        request.onerror = () => reject(new Error("Connection lost. Your pages are kept. Reconnect and tap Upload again."));
        request.ontimeout = () => reject(new Error("The server took too long. Your pages are kept. Retry; an already saved document will not be duplicated."));
        request.onabort = () => reject(new Error("Upload interrupted. Your pages are kept.")); request.send(form);
      });
      if (!mountedRef.current) return;
      setPdfBytes(result.pdfBytes ?? null); setStatus("COMPLETED"); pages.forEach((page) => releasePreviewUrl(page.url)); setPages([]);
      setReferenceId(result.referenceId || "");
    } catch (cause) { if (mountedRef.current) setError(cause instanceof Error ? cause.message : "Upload failed. Please retry."); }
    finally { operationRef.current = false; uploadRef.current = null; if (mountedRef.current) { setBusy(false); setProgress(""); } }
  };
  const current = pending || pages.find((page) => page.id === activePage) || pages[0];
  const currentIndex = pending ? pages.length + 1 : pages.findIndex((page) => page.id === current?.id) + 1;
  const qualityDetails = current && <div role={busy ? "status" : current.check.eligible ? "status" : "alert"} className={`scan-quality px-4 py-2 text-xs ${current.check.eligible ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
    <div className="flex flex-wrap justify-between gap-1"><strong className="flex items-center gap-1.5">{current.check.eligible ? <ShieldCheck size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}{busy ? "Checking page…" : current.check.eligible ? "Text detected · Ready to upload" : "Needs attention before upload"}</strong><span>{mb(current.blob.size)}{current.check.width > 0 && ` · ${current.check.width} × ${current.check.height}`}</span></div>
    {current.check.issues.map((issue) => <p key={issue} className="mt-1 leading-relaxed">{issue}</p>)}
  </div>;
  return <main className={`scan-shell ${busy ? "scan-busy" : ""} h-dvh w-full flex flex-col overflow-hidden bg-white text-slate-900`}>
    <header className="shrink-0 border-b px-4 flex items-center justify-between gap-3 min-h-12" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-orange-500 text-white grid place-items-center text-base font-bold" aria-hidden="true">A</span><span className="font-semibold text-sm tracking-tight">Arkaa Digital<span className="text-slate-300 mx-2">/</span><span className="text-slate-500 text-xs">EDRMS</span></span></div>
      <span className="text-xs text-slate-500">Scan</span>
    </header>
    <div className="scan-destination shrink-0 px-4 py-2 border-b flex items-center justify-between gap-3 text-xs"><span className="truncate" title={referenceId || referencePreview}>To: <strong>{folder || "Checking link…"}</strong>{(referenceId || referencePreview) && <span className="text-slate-500 ml-2">{referenceId || `Next ID: ${referencePreview}`}</span>}</span><span className="shrink-0 text-slate-500">{status === "COMPLETED" ? "Upload complete" : `${pages.length} ${pages.length === 1 ? "page" : "pages"} · ${mb(totalBytes)}`}</span></div>
    {error && <div role="alert" className="scan-error shrink-0 bg-rose-50 text-rose-800 px-4 py-3 text-sm max-h-32 overflow-auto">{error}<button className="underline ml-2" onClick={() => setError("")}>Dismiss</button></div>}
    {status === "COMPLETED" ? <section className="flex-1 min-h-0 grid place-items-center p-6 text-center"><div><FileCheck2 className="mx-auto text-emerald-600 mb-4" size={48} aria-hidden="true" /><h1 className="text-2xl font-semibold">Document uploaded</h1><p className="text-slate-500 mt-3 text-sm">All pages passed the checks and were saved as a PDF.{pdfBytes != null && ` ${mb(pdfBytes)}.`}</p><p className="text-sm text-slate-500 mt-2">Search indexing continues in the repository. You can close this page.</p></div></section>
    : status !== "OPEN" ? <section className="flex-1 grid place-items-center p-6 text-center"><p>{status === "EXPIRED" ? "This link expired. Generate a new QR on the desktop." : status === "LOADING" ? "Checking capture link…" : "This capture link is unavailable. Generate a new QR on the desktop."}</p></section>
    : <>
      <input ref={cameraRef} disabled={busy} className="sr-only" aria-label="Camera photo" type="file" accept="image/*" capture="environment" onChange={(event) => { void addFiles(event.target.files, true); event.target.value = ""; }} />
      <input ref={galleryRef} disabled={busy} className="sr-only" aria-label="Choose photos" type="file" accept="image/*" multiple onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
      {current ? <>
        <div className="scan-caption shrink-0 flex justify-between items-center px-4 py-2"><h1 className="text-sm font-semibold">{pending ? "Confirm photo" : "Review document"} · Page {currentIndex}</h1><button disabled={busy} className="text-xs font-medium text-orange-700 px-3 py-2 disabled:opacity-40" onClick={() => setSourceOpen(true)}>＋ Add page</button></div>
        <div className="scan-preview flex-1 min-h-0 w-full bg-slate-100 relative overflow-hidden flex items-center justify-center" aria-label={pending ? "Confirm captured page" : "Document preview"}>
          <img src={current.url} alt={pending ? "New capture preview" : `Captured page ${currentIndex}`} style={{ transform: `rotate(${current.rotation}deg)` }} className="w-full h-full object-contain" />
        </div>
        {qualityDetails}
        <div className="scan-tools shrink-0 flex items-center gap-1 overflow-x-auto px-3 py-1 border-b text-xs">
          <button disabled={busy} className="px-3 min-h-11 shrink-0" onClick={() => pending ? setPending({ ...pending, rotation: (pending.rotation + 90) % 360 }) : setPages((previous) => previous.map((page) => page.id === current.id ? { ...page, rotation: (page.rotation + 90) % 360 } : page))}><RotateCw size={18} aria-hidden="true" />Rotate</button>
          <button disabled={busy} className="px-3 min-h-11 shrink-0" onClick={() => void recheck(current,true)}><Crop size={18} aria-hidden="true" />Trim border</button>
          <button disabled={busy} className="px-3 min-h-11 shrink-0" onClick={() => void recheck(current)}><RefreshCw size={18} aria-hidden="true" />Check again</button>
          {pending ? <button disabled={busy} className="px-3 min-h-11 shrink-0 text-orange-700" onClick={() => { releasePreviewUrl(pending.url); setPending(null); cameraRef.current?.click(); }}><Camera size={18} aria-hidden="true" />Retake</button> : <>
            <button disabled={busy || currentIndex < 2} className="px-3 min-h-11 shrink-0 disabled:opacity-40" onClick={() => setPages((previous) => { const next=[...previous]; const index=next.findIndex((page) => page.id === current.id); [next[index-1],next[index]]=[next[index],next[index-1]]; return next; })}><ArrowUp size={18} aria-hidden="true" />Move up</button>
            <button disabled={busy} className="px-3 min-h-11 shrink-0 text-rose-700" onClick={() => { setPages((previous) => previous.filter((page) => page.id !== current.id)); setActivePage(pages.find((page) => page.id !== current.id)?.id || null); releasePreviewUrl(current.url); }}><Trash2 size={18} aria-hidden="true" />Remove</button>
          </>}
        </div>
        {!pending && <div className="scan-pages shrink-0 flex gap-2 overflow-x-auto px-4 py-2" aria-label="Document pages">{pages.map((page,index) => <button key={page.id} disabled={busy} aria-label={`Review page ${index+1}`} aria-pressed={current.id === page.id} onClick={() => setActivePage(page.id)} className={`shrink-0 border-2 rounded-md p-1 ${current.id === page.id ? "border-orange-500" : "border-slate-200"}`}><img src={page.url} alt="" loading="lazy" className="w-9 h-11 object-cover" /><span className={`block text-[10px] ${page.check.eligible ? "text-slate-600" : "text-rose-700"}`}>{index+1}{!page.check.eligible && " !"}</span></button>)}</div>}
      </> : <section className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center bg-slate-50"><div className="scan-empty-icon" aria-hidden="true"><ScanLine size={40} strokeWidth={1.5} /></div><h1 className="text-2xl font-semibold tracking-tight">Scan a document</h1><p className="text-sm text-slate-500 max-w-sm mt-3 leading-relaxed">Keep the whole page visible. Use good light, avoid glare, and tap to focus on the text.</p><button disabled={busy} onClick={() => setSourceOpen(true)} className="mt-7 rounded-full bg-orange-500 text-white px-7 py-3 font-medium min-h-12">＋ Add first page</button><p className="text-xs text-slate-400 mt-5">Camera or photos · Quality checked before upload</p></section>}
      {busy && <div role="status" aria-live="polite" className="scan-progress shrink-0 flex gap-2 items-center px-4 py-3 bg-orange-50 text-orange-800 text-xs"><span className="w-4 h-4 rounded-full border-2 border-orange-200 border-t-orange-600 animate-spin motion-reduce:animate-none shrink-0" /><span className="flex-1">{progress}</span><button className="underline min-h-9 px-2 shrink-0" onClick={() => { jobRef.current?.abort(); validationRef.current?.abort(); uploadRef.current?.abort(); }}>Stop</button></div>}
      {!busy && totalBytes > 100 * 1024 * 1024 && <p role="alert" className="px-4 py-2 text-xs text-rose-700">Document is over 100 MB. Remove some pages and upload in separate documents.</p>}
      <footer className="scan-footer shrink-0 border-t bg-white px-4 pt-3 pb-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        {pending ? <div className="grid grid-cols-2 gap-3"><button disabled={busy || !pending.check.eligible} className="rounded-full border px-4 min-h-12 font-medium text-sm disabled:opacity-40" onClick={() => confirmCapture()}>Use this page</button><button disabled={busy || !pending.check.eligible} className="rounded-full bg-orange-500 text-white px-4 min-h-12 font-medium text-sm disabled:opacity-40" onClick={() => confirmCapture(true)}>Use & next photo</button></div>
        : <div className="flex items-center gap-3"><button disabled={busy || pages.length>=30} onClick={() => setSourceOpen(true)} className="rounded-full border min-h-12 px-4 text-sm shrink-0 disabled:opacity-40">＋ Add</button><button disabled={busy || !pages.length || !!invalidPages.length || totalBytes>100*1024*1024} className="rounded-full bg-orange-500 text-white flex-1 min-h-12 px-4 text-sm font-medium disabled:opacity-40" onClick={() => void upload()}>{busy ? "Working…" : invalidPages.length ? `Fix ${invalidPages.length} ${invalidPages.length===1 ? "page" : "pages"} to upload` : `Upload${pages.length ? ` · ${mb(totalBytes)}` : " document"}`}</button></div>}
        {!pending && !!pages.length && <p className="text-[11px] text-slate-500 text-center mt-2">Photo payload shown. PDF size is confirmed after saving.</p>}
      </footer>
      {sourceOpen && <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setSourceOpen(false)}><section role="dialog" aria-modal="true" aria-label="Add a page" className="w-full bg-white rounded-t-3xl px-5 pt-5 pb-6 space-y-3" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }} onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-semibold">Add a page</h2><button aria-label="Close source choices" className="min-h-11 px-3" onClick={() => setSourceOpen(false)}>✕</button></div><button disabled={busy || pages.length>=30 || !!pending} className="w-full flex items-center gap-4 min-h-14 rounded-xl bg-orange-50 px-4 text-left font-medium disabled:opacity-40" onClick={() => { setSourceOpen(false); cameraRef.current?.click(); }}><Camera size={22} aria-hidden="true" />Take a photo</button><button disabled={busy || !!pending} className="w-full flex items-center gap-4 min-h-14 rounded-xl bg-slate-50 px-4 text-left font-medium disabled:opacity-40" onClick={() => { setSourceOpen(false); galleryRef.current?.click(); }}><Images size={22} aria-hidden="true" />Choose from photos</button>{pending && <p className="text-xs text-slate-500">Confirm or retake the current photo first.</p>}</section></div>}
    </>}
  </main>;
}
