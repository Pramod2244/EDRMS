"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  UserPlus,
  Edit,
  Folder,
  ChevronRight,
  ChevronDown,
  Shield,
  Lock,
  User,
  Mail,
  Clock,
  Check,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { FolderNode } from "@/stores/document-store";
import { UserRole, useAuthStore } from "@/stores/auth-store";

export interface EditableUser {
  id?: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  assignedFolderIds: string[];
  permissions: string[];
  accessibleMenus?: string[];
  isTemporary?: boolean;
  status?: string;
  isPreset?: boolean;
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserSaved: () => void;
  availableFolders: FolderNode[];
  userToEdit?: EditableUser | null;
}

const DEFAULT_ROLE_PERMS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ["VIEW", "UPLOAD", "DOWNLOAD", "DELETE", "SHARE", "PRINT", "MANAGE_PERMISSIONS", "AUDIT_READ"],
  DEPARTMENT_MANAGER: ["VIEW", "UPLOAD", "DOWNLOAD", "DELETE", "SHARE", "PRINT", "MANAGE_PERMISSIONS"],
  CONTRIBUTOR: ["VIEW", "UPLOAD", "DOWNLOAD", "PRINT"],
  VIEWER: ["VIEW"],
  AUDITOR: ["VIEW", "AUDIT_READ"],
};

const DEFAULT_ROLE_MENUS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ["/documents", "/search", "/audit", "/admin"],
  DEPARTMENT_MANAGER: ["/documents", "/search", "/audit"],
  CONTRIBUTOR: ["/documents", "/search"],
  VIEWER: ["/documents", "/search"],
  AUDITOR: ["/documents", "/search", "/audit"],
};

export const AVAILABLE_NAV_MODULES = [
  { id: "/documents", name: "Repository Files", desc: "Document directory tree, upload & download" },
  { id: "/search", name: "Full-Text Search", desc: "Keyword & OCR textual content discovery" },
  { id: "/audit", name: "Compliance Audit Trail", desc: "Immutable compliance and activity history" },
  { id: "/admin", name: "System Admin & Governance", desc: "User management, access control & system settings" },
];

export default function CreateUserModal({
  isOpen,
  onClose,
  onUserSaved,
  availableFolders,
  userToEdit,
}: CreateUserModalProps) {
  const isEditing = Boolean(userToEdit);
  const isRootUser = isEditing && userToEdit?.username?.toLowerCase() === "admin";

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("CONTRIBUTOR");
  const [folderMode, setFolderMode] = useState<"all" | "specific">("all");
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_ROLE_PERMS["CONTRIBUTOR"]);
  const [accessibleMenus, setAccessibleMenus] = useState<string[]>(DEFAULT_ROLE_MENUS["CONTRIBUTOR"]);
  const [accessDuration, setAccessDuration] = useState<"permanent" | "2m" | "5m" | "10m" | "15m" | "1h" | "24h" | "7d" | "custom">("permanent");
  const [customMinutes, setCustomMinutes] = useState("5");
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [roleCatalog, setRoleCatalog] = useState<Array<{name: string; permissions: string[]; menus: string[]}>>([]);
  const folderChildren = useMemo(() => {
    const index = new Map<string | null, FolderNode[]>();
    for (const folder of availableFolders) {
      const key = folder.parentId || null;
      index.set(key, [...(index.get(key) || []), folder]);
    }
    return index;
  }, [availableFolders]);
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const token = useAuthStore.getState().token || localStorage.getItem("edrms_access_token");
    fetch("/api/roles", { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal })
      .then(async (response) => { if (response.ok) setRoleCatalog(await response.json()); })
      .catch(() => {});
    return () => controller.abort();
  }, [isOpen]);
  // Initialize or reset form state on open or when userToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    if (userToEdit) {
      setUsername(userToEdit.username);
      setFullName(userToEdit.fullName || "");
      setEmail(userToEdit.email || "");
      setPassword(""); // Blank means keep existing password
      setRole((userToEdit.role as UserRole) || "CONTRIBUTOR");

      const hasFolders = userToEdit.assignedFolderIds && userToEdit.assignedFolderIds.length > 0;
      setFolderMode(hasFolders ? "specific" : "all");
      setSelectedFolderIds(userToEdit.assignedFolderIds || []);
      setPermissions(userToEdit.permissions != null
        ? userToEdit.permissions
        : DEFAULT_ROLE_PERMS[(userToEdit.role as UserRole) || "CONTRIBUTOR"] || ["VIEW"]);

      const initialMenus = userToEdit.accessibleMenus != null
        ? userToEdit.accessibleMenus
        : DEFAULT_ROLE_MENUS[(userToEdit.role as UserRole) || "CONTRIBUTOR"] || ["/documents", "/search"];
      
      // Ensure root admin always has /admin menu
      if (userToEdit.username?.toLowerCase() === "admin" && !initialMenus.includes("/admin")) {
        setAccessibleMenus([...initialMenus, "/admin"]);
      } else {
        setAccessibleMenus(initialMenus);
      }

      if (userToEdit.isTemporary) {
        const sec = (userToEdit as any).durationSeconds;
        if (sec === 120) {
          setAccessDuration("2m");
        } else if (sec === 300) {
          setAccessDuration("5m");
        } else if (sec === 600) {
          setAccessDuration("10m");
        } else if (sec === 900) {
          setAccessDuration("15m");
        } else if (sec === 3600) {
          setAccessDuration("1h");
        } else if (sec && sec > 0) {
          setAccessDuration("custom");
          setCustomMinutes(String(Math.round(sec / 60)));
        } else {
          setAccessDuration("5m");
        }
      } else {
        setAccessDuration("permanent");
      }
    } else {
      setUsername("");
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("CONTRIBUTOR");
      setFolderMode("all");
      setSelectedFolderIds([]);
      setPermissions(DEFAULT_ROLE_PERMS["CONTRIBUTOR"]);
      setAccessibleMenus(DEFAULT_ROLE_MENUS["CONTRIBUTOR"]);
      setAccessDuration("permanent");
    }

    // Expand all top-level folders by default
    const initExpanded: Record<string, boolean> = {};
    availableFolders.forEach((f) => {
      if (!f.parentId) initExpanded[f.id] = true;
    });
    setExpandedFolderIds(initExpanded);
    setErrorMsg(null);
  }, [isOpen, userToEdit, availableFolders]);

  if (!isOpen) return null;

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions(roleCatalog.find((entry) => entry.name === newRole)?.permissions ?? DEFAULT_ROLE_PERMS[newRole] ?? ["VIEW"]);
    setAccessibleMenus(roleCatalog.find((entry) => entry.name === newRole)?.menus ?? DEFAULT_ROLE_MENUS[newRole] ?? ["/documents", "/search"]);
  };

  const toggleMenuAccess = (menuId: string) => {
    if (isRootUser && menuId === "/admin") {
      return; // Root administrator must always keep /admin
    }
    setAccessibleMenus((prev) =>
      prev.includes(menuId) ? prev.filter((m) => m !== menuId) : [...prev, menuId]
    );
  };

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleFolderCheckToggle = (folderId: string) => {
    setSelectedFolderIds((previous) => previous.includes(folderId)
      ? previous.filter((id) => id !== folderId) : [...previous, folderId]);
  };
  const toggleExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Recursive tree builder
  const getChildFolders = (parentId: string | null): FolderNode[] => {
    return folderChildren.get(parentId) || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim()) {
      setErrorMsg("Username is required.");
      return;
    }

    if (!isEditing && !password.trim()) {
      setErrorMsg("Password is required for new user accounts.");
      return;
    }

    if (folderMode === "specific" && selectedFolderIds.length === 0) {
      setErrorMsg("Please select at least one folder for specific folder access, or choose 'All Folders'.");
      return;
    }

    setIsSubmitting(true);

    const durationSeconds =
      accessDuration === "2m"
        ? 120
        : accessDuration === "5m"
        ? 300
        : accessDuration === "10m"
        ? 600
        : accessDuration === "15m"
        ? 900
        : accessDuration === "1h"
        ? 3600
        : accessDuration === "24h"
        ? 86400
        : accessDuration === "7d"
        ? 604800
        : accessDuration === "custom"
        ? (parseInt(customMinutes, 10) || 5) * 60
        : null;

    const payload: any = {
      username: username.trim(),
      fullName: fullName.trim() || username.trim(),
      email: email.trim() || `${username.trim().toLowerCase()}@arkaa-digital.local`,
      role: isRootUser ? "SUPER_ADMIN" : role,
      assignedFolderIds: folderMode === "all" ? [] : selectedFolderIds,
      permissions,
      accessibleMenus: isRootUser
        ? Array.from(new Set([...accessibleMenus, "/admin"]))
        : accessibleMenus,
      isTemporary: isRootUser ? false : accessDuration !== "permanent",
      durationSeconds: isRootUser ? null : durationSeconds,
    };

    if (password.trim()) {
      payload.password = password;
    }

    try {
      const endpoint = isEditing ? `/api/auth/users/${encodeURIComponent(username.trim())}` : "/api/auth/users";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        onUserSaved();
        onClose();
      } else {
        setErrorMsg(data.error || `Failed to ${isEditing ? "update" : "create"} user.`);
      }
    } catch (err) {
      console.error("Error saving user:", err);
      setErrorMsg("Failed to connect to user management service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render hierarchical folder tree
  const renderFolderHierarchy = (parentId: string | null = null, depth = 0) => {
    const nodes = getChildFolders(parentId);
    if (nodes.length === 0) return null;

    return (
      <div className={`space-y-1 ${depth > 0 ? "pl-5 border-l border-slate-200 ml-3" : ""}`}>
        {nodes.map((node) => {
          const isChecked = selectedFolderIds.includes(node.id);
          const children = getChildFolders(node.id);
          const hasChildren = children.length > 0;
          const isExpanded = !!expandedFolderIds[node.id];



          return (
            <div key={node.id} className="space-y-1">
              <div
                className={`flex items-center justify-between p-2 rounded-lg border transition select-none text-xs ${
                  isChecked
                    ? "bg-orange-50/80 border-orange-300 text-slate-900 font-medium"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center space-x-2 truncate flex-1">
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(node.id, e)}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="w-3.5" />
                  )}

                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleFolderCheckToggle(node.id)}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 h-4 w-4"
                  />

                  <Folder className="h-4 w-4 text-orange-500 shrink-0" />
                  <span className="truncate font-semibold">{node.name}</span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {hasChildren && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {children.length} folders
                    </span>
                  )}
                  {isChecked && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      Granted
                    </span>
                  )}
                </div>
              </div>

              {hasChildren && isExpanded && renderFolderHierarchy(node.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl p-4 sm:p-6 gap-4 shadow-2xl animate-in fade-in-50 zoom-in-95 h-[94dvh] max-h-[960px] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
              {isEditing ? <Edit className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {isEditing ? `Edit Repository User: @${userToEdit?.username}` : "Create New Repository User"}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing
                  ? "Update credentials, adjust hierarchical folder access, or configure granular action permissions."
                  : "Configure account credentials, assign permitted folders, and set granular role permissions."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2 shrink-0">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form id="repository-user-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto min-h-0 pr-2 flex-1 text-left text-sm">
          {/* Account Credentials */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-orange-700">
              1. Account Credentials &amp; Profile
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 block">Username *</label>
                  {isRootUser && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center">
                      <Shield className="h-3 w-3 mr-1 text-amber-600" /> Root Administrator
                    </span>
                  )}
                </div>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. jdoe"
                    required
                    disabled={isEditing}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </div>
                {isRootUser && (
                  <p className="text-[10px] text-amber-700 font-medium mt-1">
                    Root login name cannot be edited or renamed.
                  </p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Password {isEditing ? "(Leave blank to keep current)" : "*"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEditing ? "•••••••• (Unchanged)" : "Enter secure password"}
                    required={!isEditing}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jdoe@arkaa-digital.local"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 block">Assigned Role</label>
                {isRootUser && (
                  <span className="text-[10px] text-slate-500 font-mono">Permanent Root Role</span>
                )}
              </div>
              <select
                value={isRootUser ? "SUPER_ADMIN" : role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                disabled={isRootUser}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                <option value="CONTRIBUTOR">Contributor (Upload, View &amp; Download)</option>
                <option value="VIEWER">Viewer (Read Only Access)</option>
                <option value="DEPARTMENT_MANAGER">Department Manager (Full Department Admin)</option>
                <option value="AUDITOR">Auditor (Compliance &amp; Audit Logs)</option>
                <option value="SUPER_ADMIN">Super Administrator (Full System Access)</option>
                {roleCatalog.filter((entry) => !Object.keys(DEFAULT_ROLE_PERMS).includes(entry.name)).map((entry) => <option key={entry.name} value={entry.name}>{entry.name.replaceAll("_", " ")}</option>)}
              </select>
            </div>
          </div>

          {/* 2. Navigation Menu Access Governance */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-orange-700">
                2. Navigation Menu Access Governance
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                {accessibleMenus.length} of {AVAILABLE_NAV_MODULES.length} Menus Permitted
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Configure which application menus and workspace views this user is authorized to access.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AVAILABLE_NAV_MODULES.map((m) => {
                const isChecked = accessibleMenus.includes(m.id);
                const isLockedAdmin = isRootUser && m.id === "/admin";
                return (
                  <div
                    key={m.id}
                    onClick={() => !isLockedAdmin && toggleMenuAccess(m.id)}
                    className={`border rounded-xl p-3 flex items-start space-x-3 transition cursor-pointer select-none ${
                      isChecked
                        ? "bg-orange-50/70 border-orange-300 ring-1 ring-orange-200 shadow-2xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                    } ${isLockedAdmin ? "cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      disabled={isLockedAdmin}
                      className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                        <span>{m.name}</span>
                        {isLockedAdmin && (
                          <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            Root Locked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{m.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Folder Access Configuration */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-orange-700">
                3. Hierarchical Folder Access Governance
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                {folderMode === "all" ? "Full Access to All Folders" : `${selectedFolderIds.length} Folder(s) Assigned`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center space-x-2.5 p-3 rounded-xl border transition cursor-pointer select-none ${
                  folderMode === "all"
                    ? "bg-orange-50/80 border-orange-300 text-orange-950 font-semibold shadow-2xs"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="folderMode"
                  checked={folderMode === "all"}
                  onChange={() => setFolderMode("all")}
                  className="text-orange-500 focus:ring-orange-500 h-4 w-4"
                />
                <div>
                  <div className="font-bold">All Folders (Unrestricted)</div>
                  <div className="text-[10px] text-slate-500">User can browse all repository directories</div>
                </div>
              </label>

              <label
                className={`flex items-center space-x-2.5 p-3 rounded-xl border transition cursor-pointer select-none ${
                  folderMode === "specific"
                    ? "bg-orange-50/80 border-orange-300 text-orange-950 font-semibold shadow-2xs"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="folderMode"
                  checked={folderMode === "specific"}
                  onChange={() => setFolderMode("specific")}
                  className="text-orange-500 focus:ring-orange-500 h-4 w-4"
                />
                <div>
                  <div className="font-bold">Specific Folders Only</div>
                  <div className="text-[10px] text-slate-500">Assign specific directories &amp; subfolders</div>
                </div>
              </label>
            </div>

            {folderMode === "specific" && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 block text-[11px]">
                    Hierarchical Folder Directory:
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Select individual folders. Selecting a parent does not select its child folders.
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  {renderFolderHierarchy(null)}
                </div>
              </div>
            )}
          </div>

          {/* Granular Permissions Checkboxes */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-orange-700">
              4. Granular Action Permissions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: "VIEW", label: "View / Preview", desc: "Open document viewer" },
                { id: "DOWNLOAD", label: "Download Original", desc: "Download raw binary file" },
                { id: "PRINT", label: "Print Document", desc: "Print from browser viewer" },
                { id: "UPLOAD", label: "Upload Documents", desc: "Ingest new files & folders" },
                { id: "SHARE", label: "Generate Shares", desc: "Create temporary links" },
                { id: "DELETE", label: "Delete Documents", desc: "Remove files from repository" },
              ].map((p) => {
                const active = permissions.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-start space-x-2 p-2.5 rounded-lg border transition cursor-pointer select-none ${
                      active
                        ? "bg-orange-50 border-orange-200 text-slate-900 font-medium"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => togglePermission(p.id)}
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5 mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-xs">{p.label}</div>
                      <div className="text-[10px] text-slate-400">{p.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Access Duration (Timer / Expiration) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-1.5">
              <Clock className="h-3.5 w-3.5 text-orange-600" />
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-orange-700">
                5. Access Lifetime &amp; Session Duration
              </h4>
              {isRootUser && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full ml-auto">
                  Permanent Root Session
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: "permanent", label: "Permanent" },
                { id: "2m", label: "2 Min (Test)" },
                { id: "5m", label: "5 Minutes" },
                { id: "10m", label: "10 Minutes" },
                { id: "15m", label: "15 Minutes" },
                { id: "1h", label: "1 Hour" },
                { id: "24h", label: "24 Hours" },
                { id: "7d", label: "7 Days" },
                { id: "custom", label: "Custom Min" },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setAccessDuration(d.id as any)}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-semibold text-center transition ${
                    accessDuration === d.id
                      ? "bg-orange-500 text-white border-orange-500 shadow-xs"
                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Custom Minutes Input Field */}
            {accessDuration === "custom" && (
              <div className="flex items-center space-x-2 p-2.5 bg-orange-50/60 border border-orange-200 rounded-lg animate-in fade-in-50">
                <span className="text-xs text-slate-700 font-semibold">Enter custom session lifetime:</span>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="w-24 px-2.5 py-1 text-xs rounded border border-slate-300 bg-white text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Minutes"
                />
                <span className="text-xs text-slate-600 font-medium">Minutes</span>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              {accessDuration !== "permanent"
                ? "A live countdown timer will display in the user's header with proactive alerts at 10 min and 5 min remaining, and the account will automatically be logged out when the timer reaches zero."
                : "Permanent standard corporate user account with standard session lifetime."}
            </p>
          </div>

        </form>
          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit" form="repository-user-form"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition shadow-xs flex items-center space-x-1.5 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Saving..." : isEditing ? "Update User" : "Create User"}</span>
            </button>
          </div>

      </div>
    </div>
  );
}
