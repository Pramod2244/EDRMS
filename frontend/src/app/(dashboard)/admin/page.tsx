"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  HardDrive,
  Cloud,
  Cpu,
  Save,
  CheckCircle2,
  Users,
  UserPlus,
  ShieldAlert,
  Folder,
  Trash2,
  RefreshCw,
  Clock,
  Search,
  Edit,
  Key,
  Database,
  Lock,
  Check,
  AlertTriangle,
  Play,
  Server,
  Shield,
  LayoutGrid,
  Radio,
  Network,
  Zap,
  FolderTree,
} from "lucide-react";
import { useDocumentStore } from "@/stores/document-store";
import { useAuthStore, DEFAULT_ADMIN_USER } from "@/stores/auth-store";
import CreateUserModal, { EditableUser } from "@/components/admin/create-user-modal";
import DataTablePagination from "@/components/common/data-table-pagination";
import { CustomAlertDialog, AlertVariant } from "@/components/common/custom-alert-dialog";

interface ManagedUser {
  id: string;
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

const MENU_LABELS: Record<string, string> = {
  "/documents": "Files",
  "/search": "Search",
  "/audit": "Audit",
  "/admin": "Admin",
};

export default function AdminPage() {
  const { user } = useAuthStore();
  const { activeStorageProvider, activeOcrEngine, setStorageProvider, setOcrEngine, folders, fetchFolders } =
    useDocumentStore();

  const [activeTab, setActiveTab] = useState<"users" | "nas" | "system">("users");

  // Storage / OCR settings state
  const [selectedProvider, setSelectedProvider] = useState<"LOCAL" | "NAS" | "S3">(activeStorageProvider);
  const [localRootPath, setLocalRootPath] = useState("./data/storage");
  const [nasRootPath, setNasRootPath] = useState("/Volumes/NAS/edms_storage");
  const [s3BucketName, setS3BucketName] = useState("edrms-documents-bucket");
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3SecretConfigured, setS3SecretConfigured] = useState(false);
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [selectedOcr, setSelectedOcr] = useState(activeOcrEngine);

  const [isSaved, setIsSaved] = useState(false);
  const [isTestingStorage, setIsTestingStorage] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingStorage, setIsSavingStorage] = useState(false);

  // User management state
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Pagination state for users table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Custom Alert / Confirmation Dialog state
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message?: React.ReactNode;
    variant?: AlertVariant;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    isProcessing?: boolean;
  }>({
    isOpen: false,
    title: "",
  });

  const closeAlert = () => {
    setAlertDialog((prev) => ({ ...prev, isOpen: false, isProcessing: false }));
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchStorageConfig = async () => {
    try {
      const res = await fetch("/api/admin/config/storage");
      if (res.ok) {
        const data = await res.json();
        if (data.providerType === "LOCAL" || data.providerType === "NAS" || data.providerType === "S3") {
          setSelectedProvider(data.providerType);
        }
        if (data.localRootPath) setLocalRootPath(data.localRootPath);
        if (data.nasRootPath) setNasRootPath(data.nasRootPath);
        if (data.s3BucketName) setS3BucketName(data.s3BucketName);
        if (data.s3Region) setS3Region(data.s3Region);
        if (data.s3AccessKey !== undefined) setS3AccessKey(data.s3AccessKey);
        if (data.s3SecretConfigured !== undefined) setS3SecretConfigured(data.s3SecretConfigured);
        if (data.s3Endpoint !== undefined) setS3Endpoint(data.s3Endpoint);
      }
    } catch (err) {
      console.error("Failed to fetch storage config:", err);
    }
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch("/api/auth/users");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsersList(data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchFolders();
    fetchUsers();
    fetchStorageConfig();
  }, [fetchFolders]);

  const handleDeleteUser = (username: string) => {
    if (!username || username.trim().toLowerCase() === "admin") {
      setAlertDialog({
        isOpen: true,
        title: "Root Administrator Protected",
        variant: "warning",
        message: (
          <span>
            The system root administrator account <strong className="text-slate-900 font-mono">admin</strong> is protected by security governance and cannot be deleted or revoked.
          </span>
        ),
        confirmText: "Understood",
        onConfirm: closeAlert,
      });
      return;
    }

    setAlertDialog({
      isOpen: true,
      title: "Revoke & Delete User Account",
      variant: "danger",
      message: (
        <span>
          Are you sure you want to permanently revoke access and delete account{" "}
          <strong className="text-slate-900 font-semibold underline decoration-rose-400 underline-offset-2">
            @{username}
          </strong>
          ? This will terminate all active session grants and folder clearances.
        </span>
      ),
      confirmText: "Delete User",
      cancelText: "Cancel",
      onConfirm: async () => {
        setAlertDialog((prev) => ({ ...prev, isProcessing: true }));
        try {
          const res = await fetch(`/api/auth/users/${encodeURIComponent(username.trim())}`, {
            method: "DELETE",
          });
          if (res.ok) {
            closeAlert();
            showNotification(`User account "${username}" deleted successfully.`);
            setUsersList((prev) => prev.filter((u) => u.username.toLowerCase() !== username.trim().toLowerCase()));
            fetchUsers();
          } else {
            const err = await res.json().catch(() => ({}));
            setAlertDialog({
              isOpen: true,
              title: "Action Failed",
              variant: "danger",
              message: err.error || "Failed to delete user account.",
              confirmText: "Dismiss",
              onConfirm: closeAlert,
            });
          }
        } catch (err) {
          console.error("Failed to delete user:", err);
          setAlertDialog({
            isOpen: true,
            title: "Network Error",
            variant: "danger",
            message: "Unable to contact the authentication service. Please verify server connectivity.",
            confirmText: "Dismiss",
            onConfirm: closeAlert,
          });
        }
      },
    });
  };

  const handleTestStorage = async () => {
    setIsTestingStorage(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/config/storage/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: selectedProvider,
          localRootPath,
          nasRootPath,
          s3BucketName,
          s3Region,
          s3AccessKey,
          s3SecretKey,
          s3Endpoint,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: "Storage probe test failed: " + err.message });
    } finally {
      setIsTestingStorage(false);
    }
  };

  const handleSaveStorageConfig = async () => {
    setIsSavingStorage(true);
    try {
      const res = await fetch("/api/admin/config/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: selectedProvider,
          localRootPath,
          nasRootPath,
          s3BucketName,
          s3Region,
          s3AccessKey,
          s3SecretKey,
          s3Endpoint,
        }),
      });

      if (res.ok) {
        setStorageProvider(selectedProvider);
        setOcrEngine(selectedOcr);
        setIsSaved(true);
        showNotification("Storage configuration and credentials successfully saved & hot-reloaded!");
        setTimeout(() => setIsSaved(false), 3000);
        fetchStorageConfig();
      } else {
        const err = await res.json().catch(() => ({}));
        setAlertDialog({
          isOpen: true,
          title: "Configuration Error",
          variant: "danger",
          message: err.error || "Failed to save storage configuration.",
          confirmText: "Dismiss",
          onConfirm: closeAlert,
        });
      }
    } catch (err: any) {
      setAlertDialog({
        isOpen: true,
        title: "Connection Error",
        variant: "danger",
        message: "Failed to connect to configuration service: " + err.message,
        confirmText: "Dismiss",
        onConfirm: closeAlert,
      });
    } finally {
      setIsSavingStorage(false);
    }
  };

  // Helper to map folder IDs to names
  const getFolderName = (folderId: string) => {
    const found = folders.find((f) => f.id === folderId);
    return found ? found.name : folderId.substring(0, 8);
  };

  // Dedicated NAS storage activation & testing helpers
  const handleSaveNasStorage = async (mountPathOverride?: string) => {
    setIsSavingStorage(true);
    const targetPath = mountPathOverride || nasRootPath;
    try {
      const res = await fetch("/api/admin/config/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: "NAS",
          localRootPath,
          nasRootPath: targetPath,
          s3BucketName,
          s3Region,
          s3AccessKey,
          s3SecretKey,
          s3Endpoint,
        }),
      });

      if (res.ok) {
        setSelectedProvider("NAS");
        setStorageProvider("NAS");
        setIsSaved(true);
        showNotification(`External NAS Box successfully activated at "${targetPath}"!`);
        setTimeout(() => setIsSaved(false), 3000);
        fetchStorageConfig();
      } else {
        const err = await res.json().catch(() => ({}));
        setAlertDialog({
          isOpen: true,
          title: "Configuration Error",
          variant: "danger",
          message: err.error || "Failed to activate External NAS Box.",
          confirmText: "Dismiss",
          onConfirm: closeAlert,
        });
      }
    } catch (err: any) {
      setAlertDialog({
        isOpen: true,
        title: "Connection Error",
        variant: "danger",
        message: "Failed to connect to configuration service: " + err.message,
        confirmText: "Dismiss",
        onConfirm: closeAlert,
      });
    } finally {
      setIsSavingStorage(false);
    }
  };

  const handleTestNasProbe = async (mountPathOverride?: string) => {
    setIsTestingStorage(true);
    setTestResult(null);
    const targetPath = mountPathOverride || nasRootPath;
    try {
      const res = await fetch("/api/admin/config/storage/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: "NAS",
          localRootPath,
          nasRootPath: targetPath,
          s3BucketName,
          s3Region,
          s3AccessKey,
          s3SecretKey,
          s3Endpoint,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: "NAS Box probe benchmark failed: " + err.message });
    } finally {
      setIsTestingStorage(false);
    }
  };

  const handleSwitchToLocalDisk = async () => {
    setIsSavingStorage(true);
    try {
      const res = await fetch("/api/admin/config/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: "LOCAL",
          localRootPath,
          nasRootPath,
          s3BucketName,
          s3Region,
          s3AccessKey,
          s3SecretKey,
          s3Endpoint,
        }),
      });

      if (res.ok) {
        setSelectedProvider("LOCAL");
        setStorageProvider("LOCAL");
        setIsSaved(true);
        showNotification("Storage provider switched back to Local Server Disk.");
        setTimeout(() => setIsSaved(false), 3000);
        fetchStorageConfig();
      } else {
        const err = await res.json().catch(() => ({}));
        setAlertDialog({
          isOpen: true,
          title: "Configuration Error",
          variant: "danger",
          message: err.error || "Failed to switch storage provider.",
          confirmText: "Dismiss",
          onConfirm: closeAlert,
        });
      }
    } catch (err: any) {
      setAlertDialog({
        isOpen: true,
        title: "Connection Error",
        variant: "danger",
        message: "Failed to connect to configuration service: " + err.message,
        confirmText: "Dismiss",
        onConfirm: closeAlert,
      });
    } finally {
      setIsSavingStorage(false);
    }
  };

  // Screen Guard: SUPER_ADMIN or user granted /admin menu permission
  const activeUser = user || DEFAULT_ADMIN_USER;
  const isAuthorized =
    activeUser.role === "SUPER_ADMIN" || activeUser.accessibleMenus?.includes("/admin");
  if (!isAuthorized) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-4">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted (403 Forbidden)</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          System Administration, Storage Setup, and Access Governance are restricted to authorized administrators.
          Your current authenticated role is <span className="font-semibold text-slate-800">{activeUser.role}</span>.
        </p>
        <div className="pt-2">
          <Link
            href="/documents"
            className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition shadow-xs"
          >
            Return to Document Repository
          </Link>
        </div>
      </div>
    );
  }

  const filteredUsers = usersList.filter((u) => {
    if (!userSearchTerm.trim()) return true;
    const q = userSearchTerm.toLowerCase().trim();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.fullName && u.fullName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden space-y-4">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-8 z-50 bg-orange-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Administration &amp; Access Governance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage repository users, assign menu &amp; folder permissions, and configure Server / S3 credentials.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
          <button
            onClick={() => setActiveTab("users")}
            className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "users"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>User Accounts &amp; Governance</span>
          </button>
          <button
            onClick={() => setActiveTab("nas")}
            className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "nas"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>External NAS Box Setup</span>
            {activeStorageProvider === "NAS" && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-1" title="NAS is Active" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("system")}
            className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "system"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>Server Disk / S3 Cloud</span>
          </button>
        </div>
      </div>

      {/* TAB 1: USER MANAGEMENT & ACCESS CONTROL */}
      {activeTab === "users" && (
        <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
          {/* User Management Actions Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs shrink-0">
            <div className="flex items-center space-x-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => {
                    setUserSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search user by name, role, email..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <button
                onClick={fetchUsers}
                disabled={isLoadingUsers}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 text-orange-500 ${isLoadingUsers ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <button
              onClick={() => {
                setEditingUser(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition shadow-xs"
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              Create New User
            </button>
          </div>

          {/* Users Table Card */}
          <div className="flex-1 min-h-0 border border-slate-200 rounded-xl bg-white flex flex-col overflow-hidden shadow-2xs">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3.5 bg-slate-50">User Account</th>
                    <th className="px-6 py-3.5 bg-slate-50">Role</th>
                    <th className="px-6 py-3.5 bg-slate-50">Menu Access</th>
                    <th className="px-6 py-3.5 bg-slate-50">Folder Governance</th>
                    <th className="px-6 py-3.5 bg-slate-50">Action Permissions</th>
                    <th className="px-6 py-3.5 bg-slate-50">Session Lifetime</th>
                    <th className="px-6 py-3.5 bg-slate-50 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-xs">
                        No users match the search query.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => {
                      const isAllFolders = !u.assignedFolderIds || u.assignedFolderIds.length === 0;
                      const isRoot = u.username === "admin";
                      return (
                        <tr key={u.id || u.username} className="hover:bg-orange-50/20 transition-colors">
                          {/* User Account */}
                          <td className="px-6 py-3.5">
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center border border-orange-200 shrink-0">
                                {u.username.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                                  <span>{u.fullName || u.username}</span>
                                  {isRoot && (
                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                      Root
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 font-mono text-[11px]">
                                  @{u.username} &bull; {u.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-6 py-3.5">
                            <span
                              className={`inline-block font-semibold px-2.5 py-0.5 rounded-full border text-[11px] ${
                                u.role === "SUPER_ADMIN"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : u.role === "DEPARTMENT_MANAGER"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : u.role === "AUDITOR"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : u.role === "CONTRIBUTOR"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-50 text-slate-700 border-slate-200"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>

                          {/* Menu Access Modules */}
                          <td className="px-6 py-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[170px]">
                              {u.accessibleMenus && u.accessibleMenus.length > 0 ? (
                                u.accessibleMenus.map((m) => (
                                  <span
                                    key={m}
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200"
                                  >
                                    {MENU_LABELS[m] || m}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[10px]">Default</span>
                              )}
                            </div>
                          </td>

                          {/* Folder Access Governance */}
                          <td className="px-6 py-3.5">
                            {isAllFolders ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                                <Folder className="h-3 w-3 mr-1 text-emerald-600" />
                                All Folders (Full)
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                                  Restricted ({u.assignedFolderIds.length}):
                                </span>
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {u.assignedFolderIds.map((fId) => (
                                    <span
                                      key={fId}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-medium"
                                    >
                                      {getFolderName(fId)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Action Permissions */}
                          <td className="px-6 py-3.5">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {u.permissions && u.permissions.length > 0 ? (
                                u.permissions.map((p) => (
                                  <span
                                    key={p}
                                    className="text-[9px] font-mono font-semibold px-1 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                                  >
                                    {p}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[10px]">None</span>
                              )}
                            </div>
                          </td>

                          {/* Session Lifetime */}
                          <td className="px-6 py-3.5">
                            {u.isTemporary ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="h-3 w-3 mr-1 text-amber-600" />
                                Temporary
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">Permanent</span>
                            )}
                          </td>

                          {/* Actions: Edit & Delete */}
                          <td className="px-6 py-3.5 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              {/* Edit Button */}
                              <button
                                onClick={() => {
                                  setEditingUser(u);
                                  setIsCreateModalOpen(true);
                                }}
                                title={isRoot ? "Edit Root Administrator Settings" : "Edit User & Access"}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition"
                              >
                                <Edit className="h-4 w-4" />
                              </button>

                              {/* Delete Button */}
                              {!isRoot ? (
                                <button
                                  onClick={() => handleDeleteUser(u.username)}
                                  title="Delete User"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-400 select-none px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                  Protected
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredUsers.length}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* TAB 2: DEDICATED EXTERNAL NAS BOX SETUP */}
      {activeTab === "nas" && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1 animate-in fade-in-50">
          {/* NAS Operational Status Banner */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    activeStorageProvider === "NAS"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-slate-900">External Storage NAS Box</h2>
                    {activeStorageProvider === "NAS" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                        ACTIVE • Powering Repository
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
                        STANDBY • Current Active: {activeStorageProvider}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Connect an external network attached storage appliance (NFS/SMB/CIFS or local volume mount) to store and stream all repository documents directly.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {activeStorageProvider === "NAS" ? (
                  <button
                    type="button"
                    onClick={handleSwitchToLocalDisk}
                    disabled={isSavingStorage}
                    className="inline-flex items-center px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                  >
                    <HardDrive className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    Switch to Local Disk
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSaveNasStorage()}
                    disabled={isSavingStorage}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 text-xs font-bold shadow-xs transition disabled:opacity-50"
                  >
                    <Zap className={`h-3.5 w-3.5 mr-1.5 ${isSavingStorage ? "animate-spin" : ""}`} />
                    {isSavingStorage ? "Activating..." : "Activate NAS Box Now"}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Mount Status
                </span>
                <span className="text-xs font-bold text-slate-800 mt-1 flex items-center">
                  <Radio className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                  Mounted &amp; Configured
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Configured Target Path
                </span>
                <span className="text-xs font-mono font-semibold text-slate-800 mt-1 truncate block" title={nasRootPath}>
                  {nasRootPath}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Retrieval Architecture
                </span>
                <span className="text-xs font-semibold text-slate-800 mt-1 flex items-center">
                  <Network className="h-3.5 w-3.5 mr-1.5 text-orange-500" />
                  Direct Hardware Streaming
                </span>
              </div>
            </div>
          </div>

          {/* NAS Box Path & Mount Form */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-2xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <Server className="h-4 w-4 text-orange-600" />
                <span>NAS Box Mount Path Configuration</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set the physical mount point directory of your external NAS box. All document viewing, downloads, and new uploads will read and write directly to this path.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                NAS Mount Directory / Root Path *
              </label>
              <input
                type="text"
                value={nasRootPath}
                onChange={(e) => setNasRootPath(e.target.value)}
                placeholder="/Volumes/NAS_STORAGE/edrms or /mnt/nas/documents"
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Directory will be created automatically if permissions allow. Files will be organized into human-readable repository folder structures.
              </p>
            </div>

            {/* 1-Click Environment Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                1-Click Preset Mount Paths:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setNasRootPath("/Volumes/NAS_STORAGE/edrms")}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition"
                >
                  🍏 macOS External Volume (<span className="font-mono text-[10px]">/Volumes/NAS_STORAGE/edrms</span>)
                </button>
                <button
                  type="button"
                  onClick={() => setNasRootPath("/mnt/nas/edrms_documents")}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition"
                >
                  🐧 Linux NFS/SMB Mount (<span className="font-mono text-[10px]">/mnt/nas/edrms_documents</span>)
                </button>
                <button
                  type="button"
                  onClick={() => setNasRootPath("./data/nas_storage")}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition"
                >
                  📁 Local Disk Storage Test (<span className="font-mono text-[10px]">./data/nas_storage</span>)
                </button>
              </div>
            </div>

            {/* Test Benchmark Button & Save Actions */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleTestNasProbe()}
                  disabled={isTestingStorage}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
                >
                  <Play className={`h-3.5 w-3.5 mr-1.5 text-orange-500 ${isTestingStorage ? "animate-spin" : ""}`} />
                  {isTestingStorage ? "Testing NAS Connection..." : "Test NAS Connection & Benchmark"}
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleSaveNasStorage()}
                  disabled={isSavingStorage}
                  className="inline-flex items-center px-5 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition shadow-xs disabled:opacity-50"
                >
                  <Save className={`h-3.5 w-3.5 mr-1.5 ${isSavingStorage ? "animate-spin" : ""}`} />
                  {isSavingStorage ? "Saving & Activating..." : "Save & Activate External NAS Box"}
                </button>
              </div>
            </div>

            {/* Benchmark Diagnostics Display */}
            {testResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in ${
                  testResult.success
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                    : "bg-rose-50/80 border-rose-200 text-rose-900"
                }`}
              >
                <div className="flex items-center space-x-2 font-bold">
                  {testResult.success ? (
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                {testResult.success && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-emerald-800">
                    <div className="bg-white/80 p-2 rounded border border-emerald-200">
                      ✓ Write / Read I/O: <span className="font-bold">Verified</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded border border-emerald-200">
                      ✓ SHA-256 Checksum: <span className="font-bold">Matched</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded border border-emerald-200">
                      ✓ Directory Traversal: <span className="font-bold">Protected</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded border border-emerald-200">
                      ✓ Hot-Reload: <span className="font-bold">Ready</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Physical Storage Organization Visual Architecture */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-2xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <FolderTree className="h-4 w-4 text-orange-600" />
                <span>Physical Storage Folder Hierarchy Architecture</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                How document files, folder trees, and OCR assets are physically structured and stored on your external NAS box.
              </p>
            </div>

            <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs border border-slate-800 overflow-x-auto space-y-1">
              <div className="text-slate-400">📦 [NAS Mount Directory] {nasRootPath}</div>
              <div className="text-orange-400 ml-4">└── 📁 Repository/</div>
              <div className="text-slate-300 ml-8">├── 📁 Human Resources/</div>
              <div className="text-emerald-400 ml-12">├── 📄 8a1c3f91_Employee_Contract.pdf</div>
              <div className="text-emerald-400 ml-12">└── 📄 b72e9014_Staff_Policy_Handbook.pdf</div>
              <div className="text-slate-300 ml-8">├── 📁 Finance/</div>
              <div className="text-emerald-400 ml-12">├── 📄 4f7b1102_Q3_Tax_Audit_Report.pdf</div>
              <div className="text-emerald-400 ml-12">└── 📄 55c91a38_Vendor_Invoice_Invoice2026.pdf</div>
              <div className="text-slate-300 ml-8">└── 📁 Legal/</div>
              <div className="text-emerald-400 ml-12">└── 📄 93235200_NDA_External_NAS_Box.pdf</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900 block">Direct NAS Retrieval</span>
                <p className="text-slate-500 mt-1 text-[11px] leading-relaxed">
                  When users click preview or download in the repository, files stream straight from the external NAS box without local disk copying.
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900 block">Human-Readable Hierarchy</span>
                <p className="text-slate-500 mt-1 text-[11px] leading-relaxed">
                  Documents are stored under their respective folder paths (e.g. <span className="font-mono">Repository/Finance</span>) rather than abstract date hashes.
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-900 block">SHA-256 Tamper Proofing</span>
                <p className="text-slate-500 mt-1 text-[11px] leading-relaxed">
                  Every file written to the NAS box includes cryptographic SHA-256 digest validation, verifying full data integrity upon retrieval.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STORAGE PATHS & CREDENTIALS CONFIGURATION */}
      {activeTab === "system" && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
          {/* Storage Provider Selection Card */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4 shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Storage Provider &amp; Path Governance</h2>
                <p className="text-xs text-slate-500">
                  Configure Server Local Path or S3-compatible credentials and bucket parameters.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Newly uploaded documents and rasterized OCR page previews persist to the selected active target.
              Existing documents continue to be loaded from their recorded storage keys.
            </p>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div
                onClick={() => setSelectedProvider("LOCAL")}
                className={`cursor-pointer border rounded-xl p-4 transition-all ${
                  selectedProvider === "LOCAL"
                    ? "border-orange-500 bg-orange-50/50 ring-1 ring-orange-500 shadow-2xs"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center space-x-2.5 font-bold text-sm text-slate-900">
                  <HardDrive className={`h-4 w-4 ${selectedProvider === "LOCAL" ? "text-orange-600" : "text-slate-400"}`} />
                  <span>Local Server Disk</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Direct server directory storage with SHA-256 validation, partition folders, and path traversal protection. Zero cloud overhead.
                </p>
              </div>

              <div
                onClick={() => setSelectedProvider("NAS")}
                className={`cursor-pointer border rounded-xl p-4 transition-all ${
                  selectedProvider === "NAS"
                    ? "border-orange-500 bg-orange-50/50 ring-1 ring-orange-500 shadow-2xs"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center space-x-2.5 font-bold text-sm text-slate-900">
                  <Database className={`h-4 w-4 ${selectedProvider === "NAS" ? "text-orange-600" : "text-slate-400"}`} />
                  <span>External NAS Box</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Dedicated Network Attached Storage mount path. Files store directly to external NAS hardware and stream from it.
                </p>
              </div>

              <div
                onClick={() => setSelectedProvider("S3")}
                className={`cursor-pointer border rounded-xl p-4 transition-all ${
                  selectedProvider === "S3"
                    ? "border-orange-500 bg-orange-50/50 ring-1 ring-orange-500 shadow-2xs"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center space-x-2.5 font-bold text-sm text-slate-900">
                  <Cloud className={`h-4 w-4 ${selectedProvider === "S3" ? "text-orange-600" : "text-slate-400"}`} />
                  <span>S3 / MinIO Storage</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Scalable object storage with AWS S3, self-hosted MinIO, or SeaweedFS with presigned download URLs.
                </p>
              </div>
            </div>

            {/* Sub-form: Local Server Storage Path */}
            {selectedProvider === "LOCAL" && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Server className="h-3.5 w-3.5 text-orange-600" />
                    <span>Server Storage Directory Path</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Host Filesystem</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Server Local Root Path *
                  </label>
                  <input
                    type="text"
                    value={localRootPath}
                    onChange={(e) => setLocalRootPath(e.target.value)}
                    placeholder="./data/storage or /var/data/edms/storage"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Relative paths are resolved from backend root. Directory will be created automatically if permissions allow.
                  </p>
                </div>

                <div className="pt-1 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleTestStorage}
                    disabled={isTestingStorage}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition shadow-2xs disabled:opacity-50"
                  >
                    <Play className={`h-3 w-3 mr-1 text-orange-500 ${isTestingStorage ? "animate-spin" : ""}`} />
                    {isTestingStorage ? "Verifying Path..." : "Test Local Path Access"}
                  </button>
                </div>
              </div>
            )}

            {/* Sub-form: External Storage NAS Box */}
            {selectedProvider === "NAS" && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Database className="h-3.5 w-3.5 text-orange-600" />
                    <span>External NAS Box Mount &amp; Network Share Directory</span>
                  </h3>
                  <span className="text-[10px] text-emerald-700 font-mono font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    NAS Hardware / NFS / SMB Mount
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    NAS Box Mount Path / Root Directory *
                  </label>
                  <input
                    type="text"
                    value={nasRootPath}
                    onChange={(e) => setNasRootPath(e.target.value)}
                    placeholder="/Volumes/NAS/edms_storage or /mnt/nas/documents"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enter the mounted path of your external NAS box (e.g. NFS, SMB/CIFS mount or dedicated external volume). All repository folders and documents will be stored on and read from this NAS box.
                  </p>
                </div>

                <div className="pt-1 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleTestStorage}
                    disabled={isTestingStorage}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition shadow-2xs disabled:opacity-50"
                  >
                    <Play className={`h-3 w-3 mr-1 text-orange-500 ${isTestingStorage ? "animate-spin" : ""}`} />
                    {isTestingStorage ? "Verifying NAS Box..." : "Test NAS Connection & Read/Write"}
                  </button>
                </div>
              </div>
            )}

            {/* Sub-form: S3 Credentials & Paths */}
            {selectedProvider === "S3" && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Key className="h-3.5 w-3.5 text-orange-600" />
                    <span>S3 &amp; Object Storage Credentials</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">AWS S3 / MinIO / SeaweedFS</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Bucket Name *
                    </label>
                    <input
                      type="text"
                      value={s3BucketName}
                      onChange={(e) => setS3BucketName(e.target.value)}
                      placeholder="e.g. edrms-documents-bucket"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      AWS Region *
                    </label>
                    <input
                      type="text"
                      value={s3Region}
                      onChange={(e) => setS3Region(e.target.value)}
                      placeholder="e.g. us-east-1 or ap-south-1"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Access Key ID *
                    </label>
                    <input
                      type="text"
                      value={s3AccessKey}
                      onChange={(e) => setS3AccessKey(e.target.value)}
                      placeholder="e.g. AKIAIOSFODNN7EXAMPLE"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Secret Access Key *
                    </label>
                    <input
                      type="password"
                      value={s3SecretKey}
                      onChange={(e) => setS3SecretKey(e.target.value)}
                      placeholder={s3SecretConfigured ? "•••••••• (Saved - leave blank to keep)" : "Enter Secret Access Key"}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Custom Endpoint URL <span className="text-slate-400 font-normal">(Optional for MinIO / SeaweedFS / LocalStack)</span>
                    </label>
                    <input
                      type="text"
                      value={s3Endpoint}
                      onChange={(e) => setS3Endpoint(e.target.value)}
                      placeholder="e.g. http://localhost:9000 (Leave blank for AWS S3)"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleTestStorage}
                    disabled={isTestingStorage}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition shadow-2xs disabled:opacity-50"
                  >
                    <Play className={`h-3 w-3 mr-1 text-orange-500 ${isTestingStorage ? "animate-spin" : ""}`} />
                    {isTestingStorage ? "Testing S3 Connection..." : "Test S3 Connection & Bucket"}
                  </button>
                </div>
              </div>
            )}

            {/* Test Results Banner */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center space-x-2.5 animate-in fade-in ${
                  testResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {testResult.success ? (
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium">{testResult.message}</span>
              </div>
            )}
          </div>

          {/* OCR Engine Configuration */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3 shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">OCR Engine Configuration</h2>
                <p className="text-xs text-slate-500">
                  Asynchronous optical character recognition provider
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              The EDMS processing pipeline extracts embedded digital text first via Apache PDFBox/Tika. If extracted text is below 20 characters per page, the page image is rendered via PDFBox and passed to the local Tesseract OCR engine.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div
                onClick={() => setSelectedOcr("LOCAL_TESSERACT")}
                className={`cursor-pointer border rounded-xl p-4 transition-all ${
                  selectedOcr === "LOCAL_TESSERACT"
                    ? "border-orange-500 bg-orange-50/50 ring-1 ring-orange-500 shadow-2xs"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center space-x-2.5 font-bold text-sm text-slate-900">
                  <Cpu className="h-4 w-4 text-orange-600" />
                  <span>Local Tesseract OCR Engine</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Air-gapped, privacy-compliant local OCR processing without external network calls.
                </p>
              </div>

              <div
                onClick={() => setSelectedOcr("TIKA_ONLY")}
                className={`cursor-pointer border rounded-xl p-4 transition-all ${
                  selectedOcr === "TIKA_ONLY"
                    ? "border-orange-500 bg-orange-50/50 ring-1 ring-orange-500 shadow-2xs"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center space-x-2.5 font-bold text-sm text-slate-900">
                  <Cpu className="h-4 w-4 text-slate-400" />
                  <span>Apache Tika Digital Extraction Only</span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Fast extraction for native digital PDFs, Word, and Excel without rasterization.
                </p>
              </div>
            </div>
          </div>

          {/* Save Action Bar */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-500">
              Storage and credentials changes are persisted to the database and hot-reloaded across backend workers.
            </div>
            <div className="flex items-center space-x-3">
              {isSaved && (
                <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" /> Configuration Saved!
                </span>
              )}
              <button
                onClick={handleSaveStorageConfig}
                disabled={isSavingStorage}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition shadow-xs disabled:opacity-50"
              >
                <Save className={`h-4 w-4 mr-1.5 ${isSavingStorage ? "animate-spin" : ""}`} />
                {isSavingStorage ? "Saving Configuration..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingUser(null);
        }}
        onUserSaved={() => {
          showNotification(editingUser ? "User account updated successfully!" : "User created successfully!");
          fetchUsers();
        }}
        availableFolders={folders}
        userToEdit={editingUser}
      />

      {/* Customized Alert / Confirm Dialog */}
      <CustomAlertDialog {...alertDialog} onClose={closeAlert} />
    </div>
  );
}
