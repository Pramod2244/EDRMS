"use client";

import React, { useState, useMemo } from "react";
import { Folder, FolderOpen, ChevronRight, ChevronDown, Trash2, Lock } from "lucide-react";
import { useDocumentStore, FolderNode } from "@/stores/document-store";
import { useAuthStore } from "@/stores/auth-store";
import { CustomAlertDialog } from "@/components/common/custom-alert-dialog";

interface FolderTreeProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

export default function FolderTree({
  selectedFolderId,
  onSelectFolder,
}: FolderTreeProps) {
  const { folders, deleteFolder } = useDocumentStore();
  const { user } = useAuthStore();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "1": true,
    "2": true,
    "3": true,
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !(prev[id] ?? folders.find(folder=>folder.id===id)?.parentId === null) }));
  };

  const [folderToDelete, setFolderToDelete] = useState<FolderNode | null>(null);

  const canDeleteFolder =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ? user.permissions.includes("DELETE") : false);

  const handleDeleteFolder = (folder: FolderNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDeleteFolder) return;
    setFolderToDelete(folder);
  };

  // Check if user has specific folder restrictions
  const assignedIds = useMemo(() => {
    if (!user || !user.assignedFolderIds || user.assignedFolderIds.length === 0) {
      return null; // Unrestricted access to all folders
    }
    return new Set(user.assignedFolderIds);
  }, [user]);

  const [folderQuery, setFolderQuery] = useState("");
  const byId = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const visibleFolders = useMemo(() => {
    const visible = new Set<string>();
    const includeAncestors = (folder: FolderNode) => {
      let current: FolderNode | undefined = folder;
      const visited = new Set<string>();
      while (current && !visible.has(current.id) && !visited.has(current.id)) {
        visited.add(current.id); visible.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    };
    for (const folder of folders) {
      if ((!assignedIds || assignedIds.has(folder.id)) && (!folderQuery.trim() || folder.name.toLowerCase().includes(folderQuery.trim().toLowerCase()))) includeAncestors(folder);
    }
    return folders.filter((folder) => visible.has(folder.id));
  }, [folders, assignedIds, byId, folderQuery]);
  const childrenIndex = useMemo(() => {
    const index = new Map<string | null, FolderNode[]>();
    const visibleIds = new Set(visibleFolders.map((folder) => folder.id));
    for (const folder of visibleFolders) {
      const parent = folder.parentId && visibleIds.has(folder.parentId) ? folder.parentId : null;
      const siblings = index.get(parent) || [];
      siblings.push(folder); index.set(parent, siblings);
    }
    return index;
  }, [visibleFolders]);
  const buildTree = (parentId: string | null = null): FolderNode[] => childrenIndex.get(parentId) || [];
  const renderNodes = (parentId: string | null = null) => {
    const nodes = buildTree(parentId);
    if (nodes.length === 0) return null;

    return (
      <ul className={`space-y-1 ${parentId ? "ml-4 pl-2 border-l border-slate-200" : "pl-0"}`}>
        {nodes.map((node) => {
          const isExpanded = (expandedNodes[node.id] ?? node.parentId === null) || !!folderQuery.trim();
          const isSelected = selectedFolderId === node.id;
          const children = childrenIndex.get(node.id) || [];
          const hasChildren = children.length > 0;

          return (
            <li key={node.id}>
              <div
                onClick={() => { if (!assignedIds || assignedIds.has(node.id)) onSelectFolder(node.id); }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                  isSelected
                    ? "bg-orange-50 text-orange-800 font-bold border border-orange-200 shadow-2xs"
                    : "hover:bg-slate-50 text-slate-700 border border-transparent"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  {hasChildren ? (
                    <button
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name}`}
                      aria-expanded={isExpanded}
                      onClick={(e) => toggleExpand(node.id, e)}
                      className="p-0.5 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 transition"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="w-3.5" />
                  )}

                  {isExpanded ? (
                    <FolderOpen className="h-4 w-4 text-orange-500 shrink-0" />
                  ) : (
                    <Folder className="h-4 w-4 text-slate-400 shrink-0 group-hover:text-slate-600" />
                  )}
                  <span className="truncate" title={node.name}>{node.name}</span>
                  {assignedIds && !assignedIds.has(node.id) && <Lock className="h-3 w-3 text-slate-400" aria-label="Parent folder for navigation only" />}
                </div>

                {canDeleteFolder && (
                  <button
                    onClick={(e) => handleDeleteFolder(node, e)}
                    title="Delete Folder"
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>

              {hasChildren && isExpanded && renderNodes(node.id)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-1.5">
      <input aria-label="Find a folder" placeholder="Find a folder…" value={folderQuery} onChange={(event) => setFolderQuery(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-xs mb-2" />
      <div
        onClick={() => onSelectFolder(null)}
        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
          selectedFolderId === null
            ? "bg-orange-50 text-orange-800 font-bold border border-orange-200 shadow-2xs"
            : "hover:bg-slate-50 text-slate-700 border border-transparent"
        }`}
      >
        <div className="flex items-center space-x-2">
          <Folder className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="font-semibold">
            {assignedIds ? "All Permitted Files" : "All Documents (Root)"}
          </span>
        </div>
        {assignedIds && (
          <span className="text-[10px] font-mono text-orange-700 bg-orange-100/70 px-1.5 py-0.5 rounded border border-orange-200">
            {assignedIds.size} assigned
          </span>
        )}
      </div>

      {visibleFolders.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-400">
          No folders assigned to this account.
        </div>
      ) : (
        renderNodes(null)
      )}

      {/* Customized Alert Dialog for Folder Deletion */}
      <CustomAlertDialog
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        title="Delete Folder Directory"
        variant="danger"
        message={
          folderToDelete ? (
            <span>
              Are you sure you want to permanently delete directory{" "}
              <strong className="text-slate-900 font-semibold underline decoration-rose-400 underline-offset-2">
                &quot;{folderToDelete.name}&quot;
              </strong>{" "}
              and all subfolders and documents contained within?
            </span>
          ) : undefined
        }
        confirmText="Delete Folder"
        cancelText="Cancel"
        onConfirm={() => {
          if (folderToDelete) {
            deleteFolder(folderToDelete.id);
            setFolderToDelete(null);
          }
        }}
      />
    </div>
  );
}
