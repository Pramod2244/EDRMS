import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DocumentItem } from "@/types";
import { useAuthStore } from "@/stores/auth-store";

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  materializedPath: string;
  depth: number;
}

export interface PipelineStep {
  stepName: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  metadataJson?: string;
  errorMessage?: string;
}

export interface PipelineStatus {
  documentId: string;
  documentName: string;
  status: string;
  progressPercentage: number;
  errorMessage?: string;
  jobId?: string;
  steps: PipelineStep[];
}

interface DocumentStoreState {
  folders: FolderNode[];
  documents: DocumentItem[];
  selectedFolderId: string | null;
  activeStorageProvider: "LOCAL" | "NAS" | "S3";
  activeOcrEngine: string;
  isLoading: boolean;
  activePipeline: PipelineStatus | null;

  // Actions
  fetchFolders: () => Promise<void>;
  fetchDocuments: () => Promise<void>;
  selectFolder: (folderId: string | null) => void;
  createFolder: (name: string, parentId: string | null) => Promise<FolderNode | null>;
  deleteFolder: (folderId: string) => Promise<void>;
  uploadRealDocument: (
    file: File,
    folderId: string | null,
    onProgress?: (status: PipelineStatus) => void
  ) => Promise<DocumentItem | null>;
  uploadDocument: (
    name: string,
    sizeBytes: number,
    mimeType: string,
    folderId: string | null,
    fileUrl?: string,
    pageCount?: number,
    checksum?: string
  ) => DocumentItem;
  deleteDocument: (documentId: string) => Promise<void>;
  deleteDocumentPage: (documentId: string, pageNumber: number) => Promise<any[]>;
  ingestFromScanner: (deviceName: string, pageCount: number, folderId: string | null) => DocumentItem;
  setStorageProvider: (provider: "LOCAL" | "NAS" | "S3") => void;
  setOcrEngine: (engine: string) => void;
}

const initialFolders: FolderNode[] = [];

const initialDocuments: DocumentItem[] = [];

export const useDocumentStore = create<DocumentStoreState>()(
  persist(
    (set, get) => ({
      folders: initialFolders,
      documents: initialDocuments,
      selectedFolderId: null,
      activeStorageProvider: "LOCAL",
      activeOcrEngine: "LOCAL_TESSERACT",
      isLoading: false,
      activePipeline: null,

      fetchFolders: async () => {
        try {
          const token = typeof window !== "undefined" ? (localStorage.getItem("edrms_access_token") || useAuthStore.getState().token) : null;
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch("/api/folders/all", { headers });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const mapped: FolderNode[] = data.map((f: any) => ({
                id: f.id,
                name: f.name,
                parentId: f.parentId,
                materializedPath: f.materializedPath,
                depth: f.depth,
              }));
              set((state) => {
                const isValidCurrent =
                  state.selectedFolderId === null ||
                  mapped.some((f) => f.id === state.selectedFolderId);
                return {
                  folders: mapped,
                  selectedFolderId: isValidCurrent ? state.selectedFolderId : null,
                };
              });
            }
          }
        } catch (err) {
          console.warn("Could not fetch remote folders:", err);
        }
      },

      fetchDocuments: async () => {
        try {
          set({ isLoading: true });
          const token = typeof window !== "undefined" ? (localStorage.getItem("edrms_access_token") || useAuthStore.getState().token) : null;
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const res = await fetch("/api/documents", { headers });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const liveDocs: DocumentItem[] = data.map((d: any) => ({
                id: d.id,
                folderId: d.folderId,
                name: d.name,
                mimeType: d.mimeType,
                extension: d.extension,
                fileSizeBytes: d.fileSizeBytes,
                currentVersion: d.currentVersion || 1,
                status: d.status === "READY" ? "INDEXED" : d.status,
                storageProvider: d.storageProvider || "LOCAL",
                storageKey: d.storageKey || "",
                pageCount: d.pageCount,
                createdAt: d.createdAt ? new Date(d.createdAt).toLocaleString() : "Just now",
                checksum: d.checksumSha256,
                fileUrl: `/api/documents/${d.id}/preview`,
              }));
              set({
                documents: liveDocs,
                isLoading: false,
              });
              return;
            }
          }
          set({ isLoading: false });
        } catch (err) {
          console.warn("Could not fetch remote documents:", err);
          set({ isLoading: false });
        }
      },

      selectFolder: (folderId: string | null) => {
        set({ selectedFolderId: folderId });
      },

      createFolder: async (name: string, parentId: string | null) => {
        try {
          const isUUID = (str?: string | null) =>
            !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
          const sanitizedParentId = isUUID(parentId) ? parentId : null;
          const res = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, parentId: sanitizedParentId }),
          });
          if (res.ok) {
            const created = await res.json();
            const newFolder: FolderNode = {
              id: created.id,
              name: created.name,
              parentId: created.parentId,
              materializedPath: created.materializedPath,
              depth: created.depth,
            };
            set((state) => ({
              folders: [...state.folders, newFolder],
              selectedFolderId: created.id,
            }));
            return newFolder;
          }
        } catch (err) {
          console.warn("Backend create folder failed, falling back to local:", err);
        }

        const id = `f-${Date.now()}`;
        const parent = get().folders.find((f) => f.id === parentId);
        const depth = parent ? parent.depth + 1 : 0;
        const materializedPath = parent
          ? `${parent.materializedPath}${id}/`
          : `/${id}/`;

        const newFolder: FolderNode = {
          id,
          name,
          parentId,
          materializedPath,
          depth,
        };

        set((state) => ({
          folders: [...state.folders, newFolder],
          selectedFolderId: id,
        }));

        return newFolder;
      },

      deleteFolder: async (folderId: string) => {
        try {
          await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
        } catch (err) {
          console.warn("Backend delete folder error:", err);
        }
        const target = get().folders.find((f) => f.id === folderId);
        if (!target) return;

        set((state) => ({
          folders: state.folders.filter(
            (f) => !f.materializedPath.startsWith(target.materializedPath)
          ),
          documents: state.documents.filter((d) => d.folderId !== folderId),
          selectedFolderId: state.selectedFolderId === folderId ? null : state.selectedFolderId,
        }));
      },

      uploadRealDocument: async (
        file: File,
        folderId: string | null,
        onProgress?: (status: PipelineStatus) => void
      ) => {
        const isUUID = (str?: string | null) =>
          !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        // Find a valid UUID folder id
        let targetFolderId = isUUID(folderId) ? folderId! : "";
        if (!targetFolderId) {
          const validFolder = get().folders.find((f) => isUUID(f.id));
          targetFolderId = validFolder ? validFolder.id : "6a893dc0-2afe-4861-b355-0531a6e90836";
        }

        const currentUser = useAuthStore.getState().user;
        const currentUsername = currentUser?.username || "manoj";
        const currentRole = currentUser?.role || "CONTRIBUTOR";
        const token = useAuthStore.getState().token;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderId", targetFolderId);
        formData.append("actor", currentUsername);
        formData.append("role", currentRole);

        const headers: Record<string, string> = {
          "X-Actor-Username": currentUsername,
          "X-Actor-Role": currentRole,
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const uploadRes = await fetch(`/api/documents/upload?actor=${encodeURIComponent(currentUsername)}`, {
          method: "POST",
          headers: headers,
          body: formData,
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          let msg = `Upload failed (HTTP ${uploadRes.status})`;
          try {
            const parsed = JSON.parse(errText);
            msg = parsed.message || parsed.error || msg;
          } catch {
            if (errText && errText.length < 200) msg = errText;
          }
          throw new Error(msg);
        }

        const createdDoc = await uploadRes.json();
        const docItem: DocumentItem = {
          id: createdDoc.id,
          folderId: createdDoc.folderId,
          name: createdDoc.name,
          mimeType: createdDoc.mimeType,
          extension: createdDoc.extension,
          fileSizeBytes: createdDoc.fileSizeBytes,
          currentVersion: createdDoc.currentVersion || 1,
          status: "PROCESSING",
          storageProvider: createdDoc.storageProvider || "LOCAL",
          storageKey: createdDoc.storageKey || "",
          pageCount: createdDoc.pageCount || 1,
          createdAt: "Just now",
          checksum: createdDoc.checksumSha256,
          fileUrl: `/api/documents/${createdDoc.id}/preview`,
        };

        set((state) => ({
          documents: [docItem, ...state.documents.filter((d) => d.id !== docItem.id)],
        }));

        // Poll pipeline status until completed
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/documents/${createdDoc.id}/status`);
            if (statusRes.ok) {
              const pipeline: PipelineStatus = await statusRes.json();
              set({ activePipeline: pipeline });
              if (onProgress) {
                onProgress(pipeline);
              }

              if (pipeline.status === "COMPLETED" || pipeline.status === "READY") {
                clearInterval(pollInterval);
                await get().fetchDocuments();
              } else if (pipeline.status === "FAILED") {
                clearInterval(pollInterval);
                set((state) => ({
                  documents: state.documents.map((d) =>
                    d.id === createdDoc.id ? { ...d, status: "FAILED" } : d
                  ),
                }));
              }
            }
          } catch (pollErr) {
            console.warn("Status polling error:", pollErr);
          }
        }, 350);

        return docItem;
      },

      uploadDocument: (
        name: string,
        sizeBytes: number,
        mimeType: string,
        folderId: string | null,
        fileUrl?: string,
        pageCount?: number,
        checksum?: string
      ) => {
        const ext = name.split(".").pop()?.toLowerCase() || "pdf";
        const docId = `doc-${Date.now()}`;
        const newDoc: DocumentItem = {
          id: docId,
          folderId: folderId || "root",
          name,
          mimeType,
          extension: ext,
          fileSizeBytes: sizeBytes,
          currentVersion: 1,
          status: "PROCESSING",
          storageProvider: get().activeStorageProvider,
          pageCount: pageCount || 1,
          createdAt: "Just now",
          fileUrl,
          checksum,
        };

        set((state) => ({
          documents: [newDoc, ...state.documents],
        }));

        setTimeout(() => {
          set((state) => ({
            documents: state.documents.map((d) =>
              d.id === docId ? { ...d, status: "INDEXED" } : d
            ),
          }));
        }, 1800);

        return newDoc;
      },

      deleteDocument: async (documentId: string) => {
        try {
          await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
        } catch (err) {
          console.warn("Backend delete doc error:", err);
        }
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== documentId),
        }));
      },

      deleteDocumentPage: async (documentId: string, pageNumber: number) => {
        const res = await fetch(`/api/documents/${documentId}/pages/${pageNumber}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `Failed to delete page ${pageNumber}`);
        }
        const updatedPages = await res.json();
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  pageCount: Array.isArray(updatedPages)
                    ? updatedPages.length
                    : Math.max(1, (d.pageCount || 1) - 1),
                }
              : d
          ),
        }));
        return updatedPages;
      },

      ingestFromScanner: (deviceName: string, pageCount: number, folderId: string | null) => {
        const docId = `scan-${Date.now()}`;
        const timestamp = new Date().toISOString().slice(0, 10);
        const name = `Scanned_Batch_${timestamp}_ADF.pdf`;

        const newDoc: DocumentItem = {
          id: docId,
          folderId: folderId || "root",
          name,
          mimeType: "application/pdf",
          extension: "pdf",
          fileSizeBytes: pageCount * 650000,
          currentVersion: 1,
          status: "PROCESSING",
          storageProvider: get().activeStorageProvider,
          pageCount,
          createdAt: "Just now",
        };

        set((state) => ({
          documents: [newDoc, ...state.documents],
        }));

        setTimeout(() => {
          set((state) => ({
            documents: state.documents.map((d) =>
              d.id === docId ? { ...d, status: "INDEXED" } : d
            ),
          }));
        }, 2000);

        return newDoc;
      },

      setStorageProvider: (provider: "LOCAL" | "NAS" | "S3") => {
        set({ activeStorageProvider: provider });
      },

      setOcrEngine: (engine: string) => {
        set({ activeOcrEngine: engine });
      },
    }),
    {
      name: "edrms-document-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.documents = (state.documents || []).filter(
            (d) => d.id && !d.id.startsWith("doc-") && !d.id.startsWith("scan-")
          );
        }
      },
    }
  )
);
