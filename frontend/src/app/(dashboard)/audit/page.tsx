"use client";

import React from "react";
import { ShieldCheck, Filter } from "lucide-react";

export default function AuditPage() {
  const auditLogs = [
    {
      id: "101",
      action: "UPLOAD",
      actor: "admin",
      entityType: "DOCUMENT",
      entityId: "doc-1",
      clientIp: "192.168.1.45",
      status: "SUCCESS",
      timestamp: "2026-09-03 11:45:12",
    },
    {
      id: "102",
      action: "VIEW",
      actor: "jdoe",
      entityType: "DOCUMENT",
      entityId: "doc-1",
      clientIp: "192.168.1.102",
      status: "SUCCESS",
      timestamp: "2026-09-03 11:48:02",
    },
    {
      id: "103",
      action: "PRINT",
      actor: "jdoe",
      entityType: "DOCUMENT",
      entityId: "doc-1",
      clientIp: "192.168.1.102",
      status: "SUCCESS",
      timestamp: "2026-09-03 11:49:33",
    },
    {
      id: "104",
      action: "DOWNLOAD",
      actor: "external_guest",
      entityType: "DOCUMENT",
      entityId: "doc-2",
      clientIp: "45.33.21.9",
      status: "DENIED",
      timestamp: "2026-09-03 11:51:00",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable, tamper-evident record of all security-sensitive document operations.
          </p>
        </div>
        <button className="inline-flex items-center px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-medium text-sm hover:bg-muted transition">
          <Filter className="h-4 w-4 mr-2" /> Filter Logs
        </button>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/40 text-muted-foreground border-b border-border">
            <tr>
              <th className="px-6 py-3 font-semibold">Timestamp</th>
              <th className="px-6 py-3 font-semibold">Actor</th>
              <th className="px-6 py-3 font-semibold">Action</th>
              <th className="px-6 py-3 font-semibold">Entity</th>
              <th className="px-6 py-3 font-semibold">Client IP</th>
              <th className="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-secondary/20 transition">
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{log.timestamp}</td>
                <td className="px-6 py-4 font-medium">{log.actor}</td>
                <td className="px-6 py-4">
                  <span className="font-semibold text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs font-mono">{log.entityType} ({log.entityId})</td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{log.clientIp}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                      log.status === "SUCCESS"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {log.status === "SUCCESS" && <ShieldCheck className="h-3 w-3 mr-1" />}
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
