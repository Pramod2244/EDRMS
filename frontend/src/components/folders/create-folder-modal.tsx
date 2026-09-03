"use client";

import React, { useState } from "react";
import { FolderPlus, X } from "lucide-react";
import { useDocumentStore } from "@/stores/document-store";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateFolderModal({ isOpen, onClose }: CreateFolderModalProps) {
  const { folders, selectedFolderId, createFolder } = useDocumentStore();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>(selectedFolderId || "");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createFolder(name.trim(), parentId ? parentId : null);
    setName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in-50 zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <FolderPlus className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-lg">Create New Folder</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Folder Name
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FY2026 Tax Filings"
              required
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Parent Folder Location
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Repository Root (/) </option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {"—".repeat(f.depth)} {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition"
            >
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
