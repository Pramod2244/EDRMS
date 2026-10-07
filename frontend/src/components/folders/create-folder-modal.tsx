"use client";

import React, { useEffect, useState } from "react";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const selectedFolderExists = folders.some((folder) => folder.id === selectedFolderId);
    setParentId(selectedFolderExists ? selectedFolderId! : "");
    setErrorMessage(null);
  }, [isOpen, selectedFolderId, folders]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const createdFolder = await createFolder(name.trim(), parentId || null);
      if (!createdFolder) throw new Error("The folder was not saved. Please try again.");
      setName("");
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create the folder.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl animate-in fade-in-50 zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Create New Folder</h3>
              <p className="text-[11px] text-slate-400">Arkaa digital &bull; Repository Directory</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Folder Name
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FY2026 Audit Reports"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Parent Folder Location
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
            >
              <option value="">Repository Root (/) </option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {"—".repeat(f.depth)} {f.name}
                </option>
              ))}
            </select>
          </div>

          {errorMessage && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition shadow-xs"
            >
              {isSubmitting ? "Creating…" : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
