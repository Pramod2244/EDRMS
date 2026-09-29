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
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
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

  // Determine which folders to display based on assigned permissions
  const visibleFolders = useMemo(() => {
    if (!assignedIds) return folders;

    // A folder is visible if:
    // 1. It is directly assigned to the user
    // 2. OR an ancestor is assigned
    // 3. OR a descendant is assigned
    return folders.filter((folder) => {
      if (assignedIds.has(folder.id)) return true;

      // Check ancestors
      let curParent = folder.parentId;
      while (curParent) {
        if (assignedIds.has(curParent)) return true;
        const pFolder = folders.find((f) => f.id === curParent);
        curParent = pFolder ? pFolder.parentId : null;
      }

      // Check descendants
      const hasAssignedDescendant = (fId: string): boolean => {
        const children = folders.filter((f) => f.parentId === fId);
        for (const ch of children) {
          if (assignedIds.has(ch.id) || hasAssignedDescendant(ch.id)) return true;
        }
        return false;
      };

      return hasAssignedDescendant(folder.id);
    });
  }, [folders, assignedIds]);

  // Build recursive tree from visible list of folders
  const buildTree = (parentId: string | null = null): FolderNode[] => {
    // If root level and parentId is null, but visible folders have no root folder directly visible,
    // we want to list the highest visible folders
    if (parentId === null && assignedIds) {
      const topLevelVisible = visibleFolders.filter((f) => {
        if (f.parentId === null) return true;
        // If its parent is NOT in visibleFolders, treat it as a top-level node for this user
        return !visibleFolders.some((vf) => vf.id === f.parentId);
      });
      return topLevelVisible;
    }

    return visibleFolders.filter((f) => f.parentId === parentId);
  };

  const renderNodes = (parentId: string | null = null) => {
    const nodes = buildTree(parentId);
    if (nodes.length === 0) return null;

    return (
      <ul className="space-y-1 pl-2.5">
        {nodes.map((node) => {
          const isExpanded = !!expandedNodes[node.id];
          const isSelected = selectedFolderId === node.id;
          const children = visibleFolders.filter((f) => f.parentId === node.id);
          const hasChildren = children.length > 0;

          return (
            <li key={node.id}>
              <div
                onClick={() => onSelectFolder(node.id)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                  isSelected
                    ? "bg-orange-50 text-orange-800 font-bold border border-orange-200 shadow-2xs"
                    : "hover:bg-slate-50 text-slate-700 border border-transparent"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  {hasChildren ? (
                    <button
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
                  <span className="truncate">{node.name}</span>
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
