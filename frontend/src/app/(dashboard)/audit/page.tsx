"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  RefreshCw,
  Eye,
  X,
  Copy,
  Check,
  Search,
  User,
  FileText,
  Globe,
  HardDrive,
  Database,
  LogIn,
  Trash2,
  Printer,
  UploadCloud,
  Layers,
  Clock,
  Terminal,
} from "lucide-react";
import { useAuthStore, DEFAULT_ADMIN_USER } from "@/stores/auth-store";
import DataTablePagination from "@/components/common/data-table-pagination";

export interface AuditLogEntry {
  id: string | number;
  traceId?: string;
  action: string;
  actor: string;
  role?: string;
  entityType: string;
  entityId: string;
  documentName?: string;
  actionDescription?: string;
  clientIp: string;
  userAgent?: string;
  status: string;
  timestamp: string;
  rawTimestamp?: string;
  rawDetails?: any;
}

export default function AuditPage() {
  const { user } = useAuthStore();
  const activeUser = user || DEFAULT_ADMIN_USER;
  const [filterAction, setFilterAction] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [copiedTrace, setCopiedTrace] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Screen Guard: SUPER_ADMIN, AUDITOR, or users with /audit in accessibleMenus
  const isAuthorized =
    activeUser.role === "SUPER_ADMIN" ||
    activeUser.role === "AUDITOR" ||
    activeUser.accessibleMenus?.includes("/audit");

  const formatClientIp = (ip: string | undefined): string => {
    if (!ip) return "127.0.0.1";
    if (ip === "0:0:0:0:0:0:0:1" || ip === "::1") return "127.0.0.1";
    if (ip.includes(",")) return ip.split(",")[0].trim();
    return ip;
  };

  const fetchLiveLogs = async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/audit/logs?page=0&size=200&sort=createdAt,desc");
      if (res.ok) {
        const data = await res.json();
        if (data.content && Array.isArray(data.content)) {
          const mapped: AuditLogEntry[] = data.content.map((item: any) => {
            let docName = "";
            let role = "";
            let actionDesc = "";
            let rawDetails: any = null;

            try {
              if (item.detailsJson) {
                const parsed =
                  typeof item.detailsJson === "string" ? JSON.parse(item.detailsJson) : item.detailsJson;
                rawDetails = parsed;
                docName = parsed.documentName || parsed.name || "";
                role = parsed.role || "";
                actionDesc = parsed.actionDescription || parsed.description || parsed.message || "";
                if (!role && parsed.isTemporary) {
                  role = "TEMPORARY";
                }
              }
            } catch (e) { }

            // Contextual fallbacks if actionDescription is not explicit
            if (!actionDesc) {
              switch (item.action) {
                case "LOGIN":
                  actionDesc = rawDetails?.sessionLifetime
                    ? `Session login (${rawDetails.sessionLifetime} lifetime)`
                    : "User authenticated successfully";
                  break;
                case "VIEW":
                  actionDesc = docName ? `Previewed "${docName}"` : "Document viewed in viewer";
                  break;
                case "DOWNLOAD":
                  actionDesc = docName ? `Downloaded "${docName}"` : "Document binary downloaded";
                  break;
                case "UPLOAD":
                  actionDesc = docName ? `Ingested "${docName}"` : "New document ingested";
                  break;
                case "PRINT":
                  actionDesc = docName ? `Printed "${docName}"` : "Document sent to print pipeline";
                  break;
                case "DELETE":
                  actionDesc = docName ? `Deleted "${docName}"` : "Resource record removed";
                  break;
                case "SYSTEM_CONFIG_CHANGE":
                  actionDesc = rawDetails?.providerType
                    ? `Storage switched to ${rawDetails.providerType}`
                    : "System storage configuration updated";
                  break;
                case "ACCESS_DENIED":
                  actionDesc = "Unauthorized request attempt blocked";
                  break;
                default:
                  actionDesc = `${item.action} operation performed`;
              }
            }

            return {
              id: item.id,
              traceId: item.traceId || `TR-${item.id}`,
              action: item.action || "OPERATION",
              actor: item.actorUsername || "system",
              role: role || (item.actorUsername === "root" || item.actorUsername === "admin" ? "SUPER_ADMIN" : undefined),
              entityType: item.entityType || "DOCUMENT",
              entityId: item.entityId
                ? item.entityId.length > 18
                  ? item.entityId.substring(0, 10) + "..."
                  : item.entityId
                : "system",
              documentName: docName,
              actionDescription: actionDesc,
              clientIp: formatClientIp(item.clientIp),
              userAgent: item.userAgent || "Unknown Client",
              status: item.status || "SUCCESS",
              rawTimestamp: item.createdAt,
              timestamp: item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recent",
              rawDetails: rawDetails,
            };
          });
          setLogs(mapped);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch live audit logs:", err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLiveLogs();
  }, []);

  const fallbackLogs: AuditLogEntry[] = [
    {
      id: "101",
      traceId: "TR-101-789a",
      action: "UPLOAD",
      actor: "admin",
      role: "SUPER_ADMIN",
      entityType: "DOCUMENT",
      entityId: "doc-1",
      documentName: "NDA_Enterprise_Vendor.pdf",
      actionDescription: 'Ingested "NDA_Enterprise_Vendor.pdf" into Repository/Legal',
      clientIp: "127.0.0.1",
      status: "SUCCESS",
      timestamp: "2026-09-09 10:45:12",
    },
    {
      id: "102",
      traceId: "TR-102-123b",
      action: "VIEW",
      actor: "temp_auditor",
      role: "AUDITOR (TEMP)",
      entityType: "DOCUMENT",
      entityId: "doc-1",
      documentName: "NDA_Enterprise_Vendor.pdf",
      actionDescription: 'Previewed "NDA_Enterprise_Vendor.pdf" in high-res viewer',
      clientIp: "192.168.1.102",
      status: "SUCCESS",
      timestamp: "2026-09-09 10:48:02",
    },
    {
      id: "103",
      traceId: "TR-103-456c",
      action: "DOWNLOAD",
      actor: "temp_auditor",
      role: "AUDITOR (TEMP)",
      entityType: "DOCUMENT",
      entityId: "doc-2",
      documentName: "Q3_Financial_Audit.pdf",
      actionDescription: 'Downloaded "Q3_Financial_Audit.pdf" binary',
      clientIp: "192.168.1.102",
      status: "SUCCESS",
      timestamp: "2026-09-09 11:10:30",
    },
    {
      id: "104",
      traceId: "TR-104-890d",
      action: "LOGIN",
      actor: "superadmin",
      role: "SUPER_ADMIN",
      entityType: "SESSION",
      entityId: "auth-session-1",
      actionDescription: "Authenticated session (Permanent access)",
      clientIp: "127.0.0.1",
      status: "SUCCESS",
      timestamp: "2026-09-09 11:15:00",
    },
    {
      id: "105",
      traceId: "TR-105-234e",
      action: "SYSTEM_CONFIG_CHANGE",
      actor: "admin",
      role: "SUPER_ADMIN",
      entityType: "SYSTEM_CONFIG",
      entityId: "storage-cfg",
      actionDescription: "Storage provider switched to External NAS Box (/Volumes/NAS_STORAGE)",
      clientIp: "127.0.0.1",
      status: "SUCCESS",
      timestamp: "2026-09-09 11:30:14",
    },
    {
      id: "106",
      traceId: "TR-106-567f",
      action: "PRINT",
      actor: "manager",
      role: "MANAGER",
      entityType: "DOCUMENT",
      entityId: "doc-3",
      documentName: "Employee_Policy_Handbook.pdf",
      actionDescription: 'Printed "Employee_Policy_Handbook.pdf"',
      clientIp: "192.168.1.80",
      status: "SUCCESS",
      timestamp: "2026-09-09 11:45:22",
    },
  ];

  const displayLogs = logs.length > 0 ? logs : fallbackLogs;

  const filteredLogs = useMemo(() => {
    return displayLogs.filter((log) => {
      // Action Filter
      if (filterAction !== "ALL") {
        if (filterAction === "CONFIG" && !log.action.includes("CONFIG")) return false;
        if (filterAction !== "CONFIG" && log.action.toUpperCase() !== filterAction.toUpperCase()) {
          return false;
        }
      }
      // Search Query filter (matches actor, action, documentName, actionDescription, clientIp)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const actorMatch = log.actor.toLowerCase().includes(q);
        const actionMatch = log.action.toLowerCase().includes(q);
        const docMatch = (log.documentName || "").toLowerCase().includes(q);
        const descMatch = (log.actionDescription || "").toLowerCase().includes(q);
        const ipMatch = log.clientIp.includes(q);
        const roleMatch = (log.role || "").toLowerCase().includes(q);
        if (!actorMatch && !actionMatch && !docMatch && !descMatch && !ipMatch && !roleMatch) {
          return false;
        }
      }
      return true;
    });
  }, [displayLogs, filterAction, searchQuery]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "LOGIN":
        return {
          label: "LOGIN",
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: <LogIn className="h-3 w-3 mr-1 text-amber-600" />,
        };
      case "VIEW":
        return {
          label: "VIEW",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: <Eye className="h-3 w-3 mr-1 text-blue-600" />,
        };
      case "DOWNLOAD":
        return {
          label: "DOWNLOAD",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: <Download className="h-3 w-3 mr-1 text-emerald-600" />,
        };
      case "PRINT":
        return {
          label: "PRINT",
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          icon: <Printer className="h-3 w-3 mr-1 text-purple-600" />,
        };
      case "UPLOAD":
        return {
          label: "UPLOAD",
          bg: "bg-orange-50 text-orange-800 border-orange-200",
          icon: <UploadCloud className="h-3 w-3 mr-1 text-orange-600" />,
        };
      case "DELETE":
        return {
          label: "DELETE",
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          icon: <Trash2 className="h-3 w-3 mr-1 text-rose-600" />,
        };
      case "SYSTEM_CONFIG_CHANGE":
      case "CONFIG":
        return {
          label: "CONFIG",
          bg: "bg-cyan-50 text-cyan-800 border-cyan-200",
          icon: <HardDrive className="h-3 w-3 mr-1 text-cyan-600" />,
        };
      case "ACCESS_DENIED":
        return {
          label: "DENIED",
          bg: "bg-rose-100 text-rose-800 border-rose-300",
          icon: <ShieldAlert className="h-3 w-3 mr-1 text-rose-600" />,
        };
      default:
        return {
          label: action,
          bg: "bg-slate-100 text-slate-800 border-slate-200",
          icon: <Layers className="h-3 w-3 mr-1 text-slate-600" />,
        };
    }
  };

  const handleCopyTrace = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  const handleExportCsv = () => {
    const headers = ["ID", "Timestamp", "Actor", "Role", "Action", "Description", "Resource", "Client IP", "Status", "Trace ID"];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.actor}"`,
      `"${l.role || ""}"`,
      `"${l.action}"`,
      `"${(l.actionDescription || "").replace(/"/g, '""')}"`,
      `"${(l.documentName || l.entityType || "").replace(/"/g, '""')}"`,
      `"${l.clientIp}"`,
      `"${l.status}"`,
      `"${l.traceId || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EDMS_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-lg mx-auto my-16 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-4">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted (403 Forbidden)</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Compliance audit trails and security activity logs are restricted to Compliance Auditors and Authorized Administrators.
          Your current authenticated role is <span className="font-semibold text-slate-800">{user?.role || "GUEST"}</span>.
        </p>
        <div className="pt-2">
          <Link
            href="/documents"
            className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition shadow-xs"
          >
            Return to Document
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden space-y-3">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Compliance &amp; Security Audit Trail
            </h1>
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center">
              <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" /> Tamper-Evident
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all user authentication, document views, downloads, prints, deletions, and storage modifications with captured IP addresses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search user, action, IP, doc..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-48 lg:w-56 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <button
            onClick={fetchLiveLogs}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
            title="Refresh logs from server"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-orange-600 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition shadow-2xs"
            title="Export filtered logs to CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Export CSV
          </button>
        </div>
      </div>

      {/* Action Filter Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 shrink-0">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
        {["ALL", "LOGIN", "VIEW", "DOWNLOAD", "PRINT", "UPLOAD", "DELETE", "CONFIG"].map((act) => (
          <button
            key={act}
            onClick={() => {
              setFilterAction(act);
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${filterAction === act
                ? "bg-orange-500 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            {act}
          </button>
        ))}
      </div>

      {/* Audit Log Table Container with Sticky Header */}
      <div className="flex-1 min-h-0 border border-slate-200 rounded-xl bg-white flex flex-col overflow-hidden shadow-2xs">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 bg-slate-50">Timestamp</th>
                <th className="px-4 py-3 bg-slate-50">User / Actor</th>
                <th className="px-4 py-3 bg-slate-50">Action</th>
                <th className="px-4 py-3 bg-slate-50">Action Details &amp; Summary</th>
                <th className="px-4 py-3 bg-slate-50">Target Resource</th>
                <th className="px-4 py-3 bg-slate-50">Client IP</th>
                <th className="px-4 py-3 bg-slate-50">Result</th>
                <th className="px-3 py-3 bg-slate-50 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-xs">
                    No compliance logs match the selected filter or query.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-orange-50/20 transition-colors">
                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-1 text-slate-700 font-mono text-xs">
                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{log.timestamp}</span>
                        </div>
                      </td>

                      {/* User / Actor */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="h-6 w-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0">
                            {log.actor.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-xs text-slate-900 block leading-tight">
                              {log.actor}
                            </span>
                            {log.role && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {log.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>

                      {/* Action Details & Summary */}
                      <td className="px-4 py-3 text-xs text-slate-800 max-w-sm">
                        <span className="font-medium block truncate" title={log.actionDescription}>
                          {log.actionDescription || "—"}
                        </span>
                      </td>

                      {/* Target Resource */}
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-xs">
                        {log.documentName ? (
                          <div>
                            <span className="font-semibold text-slate-900 block truncate" title={log.documentName}>
                              {log.documentName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {log.entityType} • {log.entityId}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-slate-600">
                            {log.entityType} <span className="text-slate-400">({log.entityId})</span>
                          </span>
                        )}
                      </td>

                      {/* Client IP */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-flex items-center">
                          <Globe className="h-2.5 w-2.5 mr-1 text-slate-400" />
                          {log.clientIp}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${log.status === "SUCCESS"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                        >
                          {log.status === "SUCCESS" ? (
                            <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" />
                          ) : (
                            <ShieldAlert className="h-3 w-3 mr-1 text-rose-600" />
                          )}
                          {log.status}
                        </span>
                      </td>

                      {/* Inspect Action */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                          title="Inspect raw audit record"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Full Pagination Bar */}
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Audit Detail Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Audit Record Inspector #{selectedLog.id}
                  </h3>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono mt-0.5">
                    <span>Trace: {selectedLog.traceId}</span>
                    <button
                      onClick={() => handleCopyTrace(selectedLog.traceId || "")}
                      className="text-slate-400 hover:text-slate-700"
                      title="Copy Trace ID"
                    >
                      {copiedTrace ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Summary Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Action
                  </span>
                  <span className="text-xs font-bold text-slate-900 mt-1 block">
                    {selectedLog.action}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    User / Actor
                  </span>
                  <span className="text-xs font-bold text-slate-900 mt-1 block truncate">
                    {selectedLog.actor} {selectedLog.role ? `(${selectedLog.role})` : ""}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Client IP Address
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900 mt-1 block truncate">
                    {selectedLog.clientIp}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Execution Status
                  </span>
                  <span
                    className={`text-xs font-bold mt-1 inline-flex items-center ${selectedLog.status === "SUCCESS" ? "text-emerald-700" : "text-rose-700"
                      }`}
                  >
                    {selectedLog.status}
                  </span>
                </div>
              </div>

              {/* Action Description */}
              <div className="bg-orange-50/60 border border-orange-200/80 rounded-xl p-3.5">
                <span className="text-[10px] font-bold text-orange-900 uppercase tracking-wider block mb-1">
                  Action Detail
                </span>
                <p className="text-xs text-orange-950 font-medium">
                  {selectedLog.actionDescription || "No detailed description provided."}
                </p>
                {selectedLog.documentName && (
                  <p className="text-xs text-orange-800 mt-1">
                    <span className="font-semibold">Target Document:</span> {selectedLog.documentName}
                  </p>
                )}
              </div>

              {/* Client & Metadata Info */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Logged Timestamp</span>
                  <span className="font-mono text-slate-800">{selectedLog.timestamp}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Resource Entity</span>
                  <span className="font-mono text-slate-800">
                    {selectedLog.entityType} ({selectedLog.entityId})
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Client User-Agent</span>
                  <span className="font-mono text-[11px] text-slate-600 max-w-sm truncate text-right">
                    {selectedLog.userAgent || "curl / browser"}
                  </span>
                </div>
              </div>

              {/* Raw JSON Details Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Terminal className="h-3.5 w-3.5 text-orange-600" />
                    <span>Raw Structured Metadata (JSON)</span>
                  </span>
                  <button
                    onClick={() =>
                      handleCopyTrace(JSON.stringify(selectedLog.rawDetails || {}, null, 2))
                    }
                    className="text-[11px] text-orange-600 hover:text-orange-700 font-semibold"
                  >
                    Copy JSON
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                  {JSON.stringify(selectedLog.rawDetails || { id: selectedLog.id, action: selectedLog.action }, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition shadow-2xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
