"use client";

import React, { useState } from "react";
import { Folder, FolderOpen, ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { useDocumentStore, FolderNode } from "@/stores/document-store";

interface FolderTreeProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

export default function FolderTree({
  selectedFolderId,
  onSelectFolder,
}: FolderTreeProps) {
  const { folders, deleteFolder } = useDocumentStore();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "1": true,
    "2": true,
    "3": true,
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDeleteFolder = (folder: FolderNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete folder "${folder.name}" and all contents?`)) {
      deleteFolder(folder.id);
    }
  };

  // Build recursive tree from flat list of folders
  const buildTree = (parentId: string | null = null): FolderNode[] => {
    return folders
      .filter((f) => f.parentId === parentId)
      .map((f) => f);
  };

  const renderNodes = (parentId: string | null = null) => {
    const nodes = buildTree(parentId);
    if (nodes.length === 0) return null;

    return (
      <ul className="space-y-1 pl-2.5">
        {nodes.map((node) => {
          const isExpanded = !!expandedNodes[node.id];
          const isSelected = selectedFolderId === node.id;
          const children = buildTree(node.id);
          const hasChildren = children.length > 0;

          return (
            <li key={node.id}>
              <div
                onClick={() => onSelectFolder(node.id)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                  isSelected
                    ? "bg-primary/20 text-primary font-semibold"
                    : "hover:bg-secondary text-foreground"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  {hasChildren ? (
                    <button
                      onClick={(e) => toggleExpand(node.id, e)}
                      className="p-0.5 hover:bg-secondary rounded text-muted-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                  ) : (
                    <span className="w-3" />
                  )}

                  {isExpanded ? (
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{node.name}</span>
                </div>

                <button
                  onClick={(e) => handleDeleteFolder(node, e)}
                  title="Delete Folder"
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive rounded transition"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
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
        className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
          selectedFolderId === null
            ? "bg-primary/20 text-primary font-semibold"
            : "hover:bg-secondary text-foreground"
        }`}
      >
        <Folder className="h-4 w-4 text-primary shrink-0" />
        <span className="font-semibold">All Documents (Root)</span>
      </div>

      {renderNodes(null)}
    </div>
  );
}
