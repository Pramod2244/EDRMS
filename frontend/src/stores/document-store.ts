import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DocumentItem } from "@/types";

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  materializedPath: string;
  depth: number;
}

interface DocumentStoreState {
  folders: FolderNode[];
  documents: DocumentItem[];
  selectedFolderId: string | null;
  activeStorageProvider: "LOCAL" | "S3";
  activeOcrEngine: string;

  // Actions
  selectFolder: (folderId: string | null) => void;
  createFolder: (name: string, parentId: string | null) => FolderNode;
  deleteFolder: (folderId: string) => void;
  uploadDocument: (name: string, sizeBytes: number, mimeType: string, folderId: string | null) => DocumentItem;
  deleteDocument: (documentId: string) => void;
  ingestFromScanner: (deviceName: string, pageCount: number, folderId: string | null) => DocumentItem;
  setStorageProvider: (provider: "LOCAL" | "S3") => void;
  setOcrEngine: (engine: string) => void;
}

const initialFolders: FolderNode[] = [
  { id: "1", name: "Corporate & Legal", parentId: null, materializedPath: "/1/", depth: 0 },
  { id: "1-1", name: "Contracts & Agreements", parentId: "1", materializedPath: "/1/1-1/", depth: 1 },
  { id: "1-2", name: "NDAs & Compliance", parentId: "1", materializedPath: "/1/1-2/", depth: 1 },
  { id: "2", name: "Finance & Accounts", parentId: null, materializedPath: "/2/", depth: 0 },
  { id: "2-1", name: "Audits 2026", parentId: "2", materializedPath: "/2/2-1/", depth: 1 },
  { id: "2-2", name: "Invoices & Receipts", parentId: "2", materializedPath: "/2/2-2/", depth: 1 },
  { id: "3", name: "Human Resources", parentId: null, materializedPath: "/3/", depth: 0 },
  { id: "3-1", name: "Personnel Files", parentId: "3", materializedPath: "/3/3-1/", depth: 1 },
];

const initialDocuments: DocumentItem[] = [
  {
    id: "doc-1",
    folderId: "1-1",
    name: "Q3_Vendor_Master_Contract.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    fileSizeBytes: 3450200,
    currentVersion: 2,
    status: "INDEXED",
    storageProvider: "LOCAL",
    pageCount: 18,
    createdAt: "2026-09-03 10:30",
  },
  {
    id: "doc-2",
    folderId: "2-1",
    name: "Audited_Balance_Sheet_2026.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    fileSizeBytes: 1240900,
    currentVersion: 1,
    status: "INDEXED",
    storageProvider: "LOCAL",
    pageCount: 4,
    createdAt: "2026-09-03 11:15",
  },
  {
    id: "doc-3",
    folderId: "2-2",
    name: "Scanned_Receipt_Receipts_ADF.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    fileSizeBytes: 5490200,
    currentVersion: 1,
    status: "PROCESSING",
    storageProvider: "LOCAL",
    pageCount: 8,
    createdAt: "2026-09-03 11:45",
  },
  {
    id: "doc-4",
    folderId: null, // Root
    name: "Enterprise_DMS_Architecture_Spec.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    fileSizeBytes: 2180400,
    currentVersion: 1,
    status: "INDEXED",
    storageProvider: "LOCAL",
    pageCount: 12,
    createdAt: "2026-09-03 12:00",
  },
];

export const useDocumentStore = create<DocumentStoreState>()(
  persist(
    (set, get) => ({
      folders: initialFolders,
      documents: initialDocuments,
      selectedFolderId: null,
      activeStorageProvider: "LOCAL",
      activeOcrEngine: "AWS_TEXTRACT",

      selectFolder: (folderId: string | null) => {
        set({ selectedFolderId: folderId });
      },

      createFolder: (name: string, parentId: string | null) => {
        const id = `fld-${Date.now()}`;
        let depth = 0;
        let materializedPath = `/${id}/`;

        if (parentId) {
          const parent = get().folders.find((f) => f.id === parentId);
          if (parent) {
            depth = parent.depth + 1;
            materializedPath = `${parent.materializedPath}${id}/`;
          }
        }

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

      deleteFolder: (folderId: string) => {
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

      uploadDocument: (
        name: string,
        sizeBytes: number,
        mimeType: string,
        folderId: string | null
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
          pageCount: Math.floor(Math.random() * 8) + 1,
          createdAt: "Just now",
        };

        set((state) => ({
          documents: [newDoc, ...state.documents],
        }));

        // Simulate asynchronous pipeline transition to INDEXED after 2.5 seconds
        setTimeout(() => {
          set((state) => ({
            documents: state.documents.map((d) =>
              d.id === docId ? { ...d, status: "INDEXED" } : d
            ),
          }));
        }, 2500);

        return newDoc;
      },

      deleteDocument: (documentId: string) => {
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== documentId),
        }));
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
        }, 2500);

        return newDoc;
      },

      setStorageProvider: (provider: "LOCAL" | "S3") => {
        set({ activeStorageProvider: provider });
      },

      setOcrEngine: (engine: string) => {
        set({ activeOcrEngine: engine });
      },
    }),
    {
      name: "edrms-document-storage",
    }
  )
);
