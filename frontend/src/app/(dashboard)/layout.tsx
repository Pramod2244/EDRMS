import React from "react";
import Link from "next/link";
import { Folder, Search, ShieldAlert, Sliders, FileText } from "lucide-react";
import ScannerAgentWidget from "@/components/scanner/scanner-agent-widget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <FileText className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">EDRMS Enterprise</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link
            href="/documents"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary transition text-foreground"
          >
            <Folder className="h-4 w-4 mr-3 text-muted-foreground" />
            Repository Files
          </Link>
          <Link
            href="/search"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary transition text-foreground"
          >
            <Search className="h-4 w-4 mr-3 text-muted-foreground" />
            Full-Text Search
          </Link>
          <Link
            href="/audit"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary transition text-foreground"
          >
            <ShieldAlert className="h-4 w-4 mr-3 text-muted-foreground" />
            Audit Logs
          </Link>
          <Link
            href="/admin"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary transition text-foreground"
          >
            <Sliders className="h-4 w-4 mr-3 text-muted-foreground" />
            System Admin
          </Link>
        </nav>

        {/* Scanner Agent Status Card */}
        <div className="p-4 border-t border-border">
          <ScannerAgentWidget />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8">
          <div className="flex items-center text-sm text-muted-foreground">
            Enterprise Document Repository &middot; Modular Architecture
          </div>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
              Java 21 &bull; Spring Boot 3
            </span>
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">
              AD
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
