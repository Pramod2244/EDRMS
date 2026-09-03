"use client";

import React, { useState } from "react";
import { Folder, FolderOpen, ChevronRight, ChevronDown } from "lucide-react";

interface FolderTreeProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
}

export default function FolderTree({
  selectedFolderId,
  onSelectFolder,
}: FolderTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "1": true,
    "2": true,
  });

  const folderData: TreeNode[] = [
    {
      id: "1",
      name: "Corporate & Legal",
      children: [
        { id: "1-1", name: "Contracts & Agreements" },
        { id: "1-2", name: "NDAs & Compliance" },
      ],
    },
    {
      id: "2",
      name: "Finance & Accounts",
      children: [
        { id: "2-1", name: "Audits 2026" },
        { id: "2-2", name: "Invoices & Receipts" },
      ],
    },
    {
      id: "3",
      name: "Human Resources",
      children: [{ id: "3-1", name: "Personnel Files" }],
    },
  ];

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTree = (nodes: TreeNode[]) => {
    return (
      <ul className="space-y-1 pl-2">
        {nodes.map((node) => {
          const isExpanded = !!expandedNodes[node.id];
          const isSelected = selectedFolderId === node.id;
          const hasChildren = node.children && node.children.length > 0;

          return (
            <li key={node.id}>
              <div
                onClick={() => onSelectFolder(node.id)}
                className={`flex items-center space-x-2 px-2 py-1.5 rounded-md text-xs font-medium cursor-pointer transition ${
                  isSelected
                    ? "bg-primary/20 text-primary font-semibold"
                    : "hover:bg-secondary text-foreground"
                }`}
              >
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
                  <span className="w-4" />
                )}

                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">{node.name}</span>
              </div>

              {hasChildren && isExpanded && renderTree(node.children!)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => onSelectFolder(null)}
        className={`flex items-center space-x-2 px-2 py-1.5 rounded-md text-xs font-medium cursor-pointer transition ${
          selectedFolderId === null
            ? "bg-primary/20 text-primary font-semibold"
            : "hover:bg-secondary text-foreground"
        }`}
      >
        <Folder className="h-4 w-4 text-primary shrink-0" />
        <span>All Documents (Root)</span>
      </div>
      {renderTree(folderData)}
    </div>
  );
}
