export type PermissionType = 
  | "VIEW"
  | "UPLOAD"
  | "DOWNLOAD"
  | "DELETE"
  | "SHARE"
  | "PRINT"
  | "MANAGE_PERMISSIONS"
  | "AUDIT_READ";

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  materializedPath: string;
  depth: number;
  ownerId: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentItem {
  id: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  extension: string;
  fileSizeBytes: number;
  currentVersion: number;
  status: "PENDING" | "PROCESSING" | "INDEXED" | "FAILED";
  storageProvider: "LOCAL" | "NAS" | "S3" | string;
  storageKey?: string;
  pageCount: number | null;
  createdAt: string;
  fileUrl?: string;
  checksum?: string;
  textContent?: string;
}

export interface SearchHit {
  documentId: string;
  documentName: string;
  folderId: string;
  folderPath: string;
  fileSizeBytes: number;
  pageHits: Array<{
    pageNumber: number;
    highlightSnippet: string;
    score: number;
  }>;
}
