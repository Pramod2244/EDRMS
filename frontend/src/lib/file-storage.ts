/**
 * Client-Side Persistent Document File Storage
 * Uses IndexedDB to store real uploaded PDF, image, and text blobs across refreshes.
 */

const DB_NAME = "edrms_file_repository";
const DB_VERSION = 1;
const STORE_NAME = "document_blobs";

// In-memory cache for fast synchronous retrieval
const blobUrlCache = new Map<string, string>();
const fileBlobCache = new Map<string, Blob>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available in this environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save an uploaded file or blob to persistent IndexedDB
 */
export async function saveDocumentBlob(docId: string, blob: Blob): Promise<string> {
  fileBlobCache.set(docId, blob);

  // Revoke previous URL if exists
  if (blobUrlCache.has(docId)) {
    try {
      URL.revokeObjectURL(blobUrlCache.get(docId)!);
    } catch {
      // ignore
    }
  }

  const url = URL.createObjectURL(blob);
  blobUrlCache.set(docId, url);

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, docId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to persist blob in IndexedDB, fallback to in-memory cache:", err);
  }

  return url;
}

/**
 * Retrieve document blob URL (returns cached URL or loads from IndexedDB)
 */
export async function getDocumentBlobUrl(docId: string): Promise<string | null> {
  if (blobUrlCache.has(docId)) {
    return blobUrlCache.get(docId)!;
  }

  try {
    const db = await openDB();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (blob) {
      fileBlobCache.set(docId, blob);
      const url = URL.createObjectURL(blob);
      blobUrlCache.set(docId, url);
      return url;
    }
  } catch (err) {
    console.warn("Failed to load blob from IndexedDB:", err);
  }

  return null;
}

/**
 * Retrieve raw Blob for download or printing
 */
export async function getDocumentBlob(docId: string): Promise<Blob | null> {
  if (fileBlobCache.has(docId)) {
    return fileBlobCache.get(docId)!;
  }

  try {
    const db = await openDB();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Generates a clean, valid sample PDF Blob with realistic enterprise text for default demo files
 */
export function createSamplePdfBlob(title: string, subtitle: string): Blob {
  // A minimal valid PDF structure with real text
  const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 380 >>
stream
BT
/F1 20 Tf
50 720 Td
(${title}) Tj
/F1 12 Tf
0 -30 Td
(${subtitle}) Tj
/F1 10 Tf
0 -35 Td
(ARKAA DIGITAL ENTERPRISE REPOSITORY SYSTEM) Tj
0 -20 Td
(Document Classification: HIGHLY CONFIDENTIAL) Tj
0 -20 Td
(Repository ID: EDRMS-2026-COMPLIANCE) Tj
0 -35 Td
(This is an official document preserved in the Arkaa digital enterprise repository.) Tj
0 -18 Td
(All pages have been verified, checksum-hashed and indexed for compliance.) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000315 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
750
%%EOF`;

  return new Blob([pdfContent], { type: "application/pdf" });
}
