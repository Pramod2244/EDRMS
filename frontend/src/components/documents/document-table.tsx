"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  Download,
  Printer,
  Share2,
  Trash2,
  Eye,
  Inbox,
  FolderOpen,
  CheckCircle2,
  FileSpreadsheet,
  FileCode,
  Search,
  ShieldAlert,
  Folder,
  ChevronRight,
  Home,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
} from "lucide-react";
import { DocumentItem } from "@/types";
import { formatBytes } from "@/lib/utils";
import PdfPageViewer from "./pdf-page-viewer";
import TemporaryShareModal from "../permissions/temporary-share-modal";
import { useDocumentStore, FolderNode } from "@/stores/document-store";
import { useAuthStore } from "@/stores/auth-store";
import { getDocumentBlob, createSamplePdfBlob } from "@/lib/file-storage";
import DataTablePagination from "@/components/common/data-table-pagination";
import { CustomAlertDialog } from "@/components/common/custom-alert-dialog";

interface DocumentTableProps {
  folderId: string | null;
  onOpenUpload?: () => void;
  isFolderTreeOpen?: boolean;
  onToggleFolderTree?: () => void;
}

export default function DocumentTable({
  folderId,
  onOpenUpload,
  isFolderTreeOpen,
  onToggleFolderTree,
}: DocumentTableProps) {
  const { documents, folders, deleteDocument, selectFolder } = useDocumentStore();
  const { user } = useAuthStore();

  const [activePreviewDoc, setActivePreviewDoc] = useState<DocumentItem | null>(null);
  const [activeShareDoc, setActiveShareDoc] = useState<DocumentItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Subfolder file inclusion toggle (default: true so users see contents across nested directories)
  const [includeSubfolders, setIncludeSubfolders] = useState<boolean>(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Custom Alert confirmation state for document deletion
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  // Permissions calculation
  const canView =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ? user.permissions.includes("VIEW") : true);

  const canDownload =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ? user.permissions.includes("DOWNLOAD") : false);

  const canPrint =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ? user.permissions.includes("PRINT") : false);

  const canShare =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ? user.permissions.includes("SHARE") : false);

  const canDelete =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ? user.permissions.includes("DELETE") : false);

  const canUpload =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ? user.permissions.includes("UPLOAD") : false);

  // Folder access restrictions
  const assignedIds = useMemo(() => {
    if (!user || !user.assignedFolderIds || user.assignedFolderIds.length === 0) {
      return null;
    }
    return new Set(user.assignedFolderIds);
  }, [user]);

  const currentFolder = folders.find((f) => f.id === folderId);
  const currentFolderName = currentFolder
    ? currentFolder.name
    : assignedIds
    ? "All Permitted Files"
    : "All Documents (Root)";

  const isFolderForbidden = folderId !== null && assignedIds && !assignedIds.has(folderId);

  // Helper to recursively collect descendant folder IDs
  const getDescendantFolderIds = (fId: string): Set<string> => {
    const ids = new Set<string>([fId]);
    const collect = (parentId: string) => {
      for (const f of folders) {
        if (f.parentId === parentId && !ids.has(f.id)) {
          ids.add(f.id);
          collect(f.id);
        }
      }
    };
    collect(fId);
    return ids;
  };

  // Subfolders strictly inside the current folder
  const currentSubfolders = useMemo(() => {
    if (!folderId) {
      return folders.filter((f) => {
        if (assignedIds) {
          if (!assignedIds.has(f.id)) return false;
          return !f.parentId || !assignedIds.has(f.parentId);
        }
        return f.parentId === null;
      });
    }
    return folders.filter((f) => {
      if (f.parentId !== folderId) return false;
      if (assignedIds && !assignedIds.has(f.id)) return false;
      return true;
    });
  }, [folders, folderId, assignedIds]);

  // Compute file counts inside any given subfolder (including nested descendants)
  const getSubfolderDocCount = (subId: string) => {
    const subDescendants = getDescendantFolderIds(subId);
    return documents.filter((d) => d.folderId && subDescendants.has(d.folderId)).length;
  };

  // Breadcrumbs chain
  const breadcrumbs = useMemo(() => {
    const crumbs: { id: string | null; name: string }[] = [];
    crumbs.push({
      id: null,
      name: assignedIds ? "All Permitted Files" : "All Documents",
    });

    if (folderId) {
      const path: { id: string; name: string }[] = [];
      let curr = folders.find((f) => f.id === folderId);
      while (curr) {
        path.unshift({ id: curr.id, name: curr.name });
        curr = curr.parentId ? folders.find((f) => f.id === curr!.parentId) : undefined;
      }
      crumbs.push(...path);
    }
    return crumbs;
  }, [folderId, folders, assignedIds]);

  // Documents in scope: either direct folder only or recursive including subfolders
  const folderDocuments = useMemo(() => {
    if (!folderId) {
      if (assignedIds) {
        return documents.filter((doc) => doc.folderId && assignedIds.has(doc.folderId));
      }
      return documents;
    }

    if (includeSubfolders) {
      const descendantIds = getDescendantFolderIds(folderId);
      return documents.filter((doc) => doc.folderId && descendantIds.has(doc.folderId));
    }

    return documents.filter((doc) => doc.folderId === folderId);
  }, [documents, folderId, includeSubfolders, assignedIds, folders]);

  const displayDocuments = folderDocuments.filter((doc) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      doc.name.toLowerCase().includes(term) ||
      (doc.extension && doc.extension.toLowerCase().includes(term)) ||
      (doc.status && doc.status.toLowerCase().includes(term))
    );
  });

  const directDocumentsCount = useMemo(() => {
    if (!folderId) return folderDocuments.length;
    return documents.filter((d) => d.folderId === folderId).length;
  }, [documents, folderId, folderDocuments.length]);

  const totalPages = Math.ceil(displayDocuments.length / pageSize) || 1;
  const paginatedDocuments = displayDocuments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Handle Real Download
  const handleDownload = async (doc: DocumentItem) => {
    if (!canDownload) {
      showNotification("Permission denied: Download not granted.");
      return;
    }
    showNotification(`Downloading "${doc.name}"...`);

    const actorName = user?.username || "anonymous";
    const actorRole = user?.role || "VIEWER";
    fetch("/api/audit/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "DOWNLOAD",
        documentId: doc.id,
        documentName: doc.name,
        actorUsername: actorName,
        actorRole: actorRole,
        detailsJson: JSON.stringify({
          documentName: doc.name,
          role: actorRole,
          isTemporary: user?.isTemporaryAccess || false,
        }),
      }),
    }).catch(() => {});

    if (doc.id && !doc.id.startsWith("doc-") && !doc.id.startsWith("scan-")) {
      const actorParam = user?.username ? `?actor=${encodeURIComponent(user.username)}` : "";
      window.open(`/api/documents/${doc.id}/download${actorParam}`, "_blank");
      return;
    }
    const blob = await getDocumentBlob(doc.id);
    const element = document.createElement("a");
    if (blob) {
      const url = URL.createObjectURL(blob);
      element.href = url;
      element.download = doc.name;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(url);
      return;
    }
    if (doc.fileUrl) {
      element.href = doc.fileUrl;
      element.download = doc.name;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      return;
    }
    const sampleBlob = createSamplePdfBlob(
      doc.name,
      `Official EDMS Document: ${doc.name} • Secured by Arkaa Digital`
    );
    const url = URL.createObjectURL(sampleBlob);
    element.href = url;
    element.download = doc.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  // Handle Print
  const handlePrint = (doc: DocumentItem) => {
    if (!canPrint) {
      showNotification("Permission denied: Print not granted.");
      return;
    }
    showNotification(`Opening print stream for "${doc.name}"`);
    setActivePreviewDoc(doc);
  };

  // Handle Delete
  const handleDelete = (doc: DocumentItem) => {
    if (!canDelete) {
      showNotification("Permission denied: Delete not granted.");
      return;
    }
    setDocToDelete(doc);
  };

  // Helper to pick semantic file icon
  const getFileIcon = (mimeType?: string, ext?: string) => {
    if (ext === "xlsx" || ext === "xls" || mimeType?.includes("sheet")) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />;
    }
    if (ext === "pdf" || mimeType?.includes("pdf")) {
      return <FileText className="h-5 w-5 text-rose-500 shrink-0" />;
    }
    return <FileCode className="h-5 w-5 text-orange-500 shrink-0" />;
  };

  if (isFolderForbidden) {
    return (
      <div className="w-full h-full bg-white p-12 flex flex-col items-center justify-center text-center space-y-3">
        <div className="h-14 w-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 text-sm">Access Restricted</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
            You do not have access permission to browse folder &quot;{currentFolderName}&quot;. Please contact your repository administrator for folder clearance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0 relative bg-white">
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-3 right-4 z-40 bg-orange-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Breadcrumbs Path Bar */}
      <div className="px-5 py-2 bg-white border-b border-slate-200 text-xs text-slate-500 flex items-center space-x-2 shrink-0 overflow-x-auto">
        {onToggleFolderTree && (
          <button
            type="button"
            onClick={onToggleFolderTree}
            className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200 mr-2 shrink-0"
            title={isFolderTreeOpen ? "Hide Folder Directory (Widescreen View)" : "Show Folder Directory"}
          >
            {isFolderTreeOpen ? (
              <PanelLeftClose className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <PanelLeftOpen className="h-3.5 w-3.5 text-orange-600" />
            )}
            <span className="text-[11px] font-semibold">
              {isFolderTreeOpen ? "Hide Folders" : "Show Folders"}
            </span>
          </button>
        )}

        <Home className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id || "root"}>
            {idx > 0 && <span className="text-slate-300">/</span>}
            <button
              onClick={() => selectFolder(crumb.id)}
              className={`hover:text-orange-600 transition shrink-0 ${
                idx === breadcrumbs.length - 1
                  ? "font-bold text-slate-800"
                  : "text-slate-500 hover:underline"
              }`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Table Toolbar with Fast Search & Filter */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 shrink-0">
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
          <FolderOpen className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="font-semibold text-slate-800 text-xs">{currentFolderName}</span>
          <span className="text-slate-300">&middot;</span>
          <span className="text-xs text-slate-500 font-medium">
            {displayDocuments.length} {displayDocuments.length === 1 ? "document" : "documents"}
            {currentSubfolders.length > 0 && ` &bull; ${currentSubfolders.length} subfolder(s)`}
            {searchTerm && ` (matching "${searchTerm}")`}
          </span>

          {/* Subfolder inclusion toggle */}
          {folderId && currentSubfolders.length > 0 && (
            <button
              type="button"
              onClick={() => setIncludeSubfolders(!includeSubfolders)}
              className={`ml-2 inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                includeSubfolders
                  ? "bg-orange-100 text-orange-800 border-orange-300 shadow-2xs"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
              }`}
              title="Toggle files from all subfolders"
            >
              <Layers className="h-3 w-3" />
              <span>Include Subfolders</span>
              {includeSubfolders && <Check className="h-3 w-3 text-orange-600 ml-0.5" />}
            </button>
          )}
        </div>

        {/* Live Filter Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Filter files by name or type..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* SUBFOLDERS SECTION: Displayed right inside the explorer view */}
      {currentSubfolders.length > 0 && (
        <div className="p-4 border-b border-slate-200 bg-slate-50/40 shrink-0">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Folder className="h-3.5 w-3.5 text-orange-500" />
              <span>Subfolders inside {currentFolderName} ({currentSubfolders.length})</span>
            </span>
            <span className="text-[10px] text-slate-400">Click a subfolder to navigate</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {currentSubfolders.map((sub) => {
              const count = getSubfolderDocCount(sub.id);
              return (
                <button
                  key={sub.id}
                  onClick={() => selectFolder(sub.id)}
                  className="group flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-orange-400 hover:bg-orange-50/50 hover:shadow-xs transition-all text-left select-none"
                >
                  <div className="flex items-center space-x-2.5 truncate flex-1 mr-2">
                    <div className="h-9 w-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-orange-600">
                        {sub.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {count} {count === 1 ? "file" : "files"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Table Content Body */}
      {folderDocuments.length === 0 ? (
        <div className="flex-1 min-h-0 p-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Inbox className="h-7 w-7" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 text-sm">
              {currentSubfolders.length > 0 ? "No direct documents in this folder" : "No documents found"}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {currentSubfolders.length > 0
                ? "You can click any subfolder above to view its contents, or upload files into this directory."
                : assignedIds
                ? "No documents are currently available in your assigned folder clearance."
                : "Upload files or scan documents from the desktop feeder to populate this directory."}
            </p>
          </div>
          {onOpenUpload && canUpload && (
            <button
              onClick={onOpenUpload}
              className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition shadow-xs mt-2"
            >
              Upload to this folder
            </button>
          )}
        </div>
      ) : displayDocuments.length === 0 ? (
        <div className="flex-1 min-h-0 p-12 text-center text-slate-500 flex flex-col items-center justify-center">
          <p className="text-xs">No documents match filter &quot;{searchTerm}&quot; in this folder.</p>
          <button
            onClick={() => {
              setSearchTerm("");
              setCurrentPage(1);
            }}
            className="mt-2 text-xs font-semibold text-orange-600 hover:underline"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3.5 bg-slate-50">Name</th>
                <th className="px-6 py-3.5 bg-slate-50">Size</th>
                <th className="px-6 py-3.5 bg-slate-50">Version</th>
                <th className="px-6 py-3.5 bg-slate-50">Status</th>
                <th className="px-6 py-3.5 bg-slate-50">Storage</th>
                <th className="px-6 py-3.5 bg-slate-50 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedDocuments.map((doc) => {
                const isFromSubfolder = folderId !== null && doc.folderId !== folderId;
                const docFolderName = doc.folderId ? folders.find((f) => f.id === doc.folderId)?.name : null;

                return (
                  <tr key={doc.id} className="hover:bg-orange-50/30 transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center space-x-3">
                        {getFileIcon(doc.mimeType, doc.extension)}
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            {canView ? (
                              <span
                                onClick={() => setActivePreviewDoc(doc)}
                                className="font-semibold text-slate-900 hover:text-orange-600 hover:underline cursor-pointer transition-colors"
                              >
                                {doc.name}
                              </span>
                            ) : (
                              <span className="font-semibold text-slate-700">
                                {doc.name}
                              </span>
                            )}

                            {/* Subfolder Badge */}
                            {isFromSubfolder && docFolderName && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectFolder(doc.folderId);
                                }}
                                className="inline-flex items-center space-x-1 text-[10px] text-orange-800 bg-orange-100/70 border border-orange-200 px-1.5 py-0.5 rounded font-medium hover:bg-orange-200 transition"
                                title={`Located in subfolder: ${docFolderName}`}
                              >
                                <Folder className="h-2.5 w-2.5 text-orange-600" />
                                <span>{docFolderName}</span>
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {doc.pageCount ? `${doc.pageCount} pages` : "Processing pages..."}
                            {doc.createdAt && ` &bull; ${doc.createdAt}`}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-600">
                      {formatBytes(doc.fileSizeBytes)}
                    </td>
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-600">v{doc.currentVersion}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center ${
                          doc.status === "INDEXED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : doc.status === "PROCESSING"
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                        {doc.storageProvider}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* View Action */}
                        {canView && (
                          <button
                            onClick={() => setActivePreviewDoc(doc)}
                            title="Preview Document"
                            className="p-1.5 rounded-md hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}

                        {/* Download Action */}
                        {canDownload && (
                          <button
                            onClick={() => handleDownload(doc)}
                            title="Download Original"
                            className="p-1.5 rounded-md hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}

                        {/* Print Action */}
                        {canPrint && (
                          <button
                            onClick={() => handlePrint(doc)}
                            title="Print Document"
                            className="p-1.5 rounded-md hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        )}

                        {/* Share Action */}
                        {canShare && (
                          <button
                            onClick={() => setActiveShareDoc(doc)}
                            title="Share Link / Temporary Access"
                            className="p-1.5 rounded-md hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete Action */}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(doc)}
                            title="Delete Document"
                            className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={displayDocuments.length}
        pageSize={pageSize}
        pageSizeOptions={[10, 25, 50, 100]}
        onPageChange={(p) => setCurrentPage(p)}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setCurrentPage(1);
        }}
      />

      {/* Preview Modal */}
      {activePreviewDoc && (
        <PdfPageViewer
          document={activePreviewDoc}
          onClose={() => setActivePreviewDoc(null)}
          canDownload={canDownload}
          canPrint={canPrint}
        />
      )}

      {/* Temporary Share Modal */}
      {activeShareDoc && (
        <TemporaryShareModal
          document={activeShareDoc}
          isOpen={!!activeShareDoc}
          onClose={() => setActiveShareDoc(null)}
        />
      )}

      {/* Customized Alert Dialog for Document Deletion */}
      <CustomAlertDialog
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        title="Delete Document"
        variant="danger"
        message={
          docToDelete ? (
            <span>
              Are you sure you want to permanently delete{" "}
              <strong className="text-slate-900 font-semibold underline decoration-rose-400 underline-offset-2">
                {docToDelete.name}
              </strong>
              ? This action will remove all indexed content, pages, and versions.
            </span>
          ) : undefined
        }
        confirmText="Delete Document"
        cancelText="Cancel"
        onConfirm={() => {
          if (docToDelete) {
            deleteDocument(docToDelete.id);
            showNotification(`Deleted "${docToDelete.name}"`);
            setDocToDelete(null);
          }
        }}
      />
    </div>
  );
}
