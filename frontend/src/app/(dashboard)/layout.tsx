"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Folder,
  Search,
  ShieldAlert,
  Sliders,
  FileText,
  LogOut,
  ChevronDown,
  UserCheck,
  Shield,
  User,
} from "lucide-react";
import ScannerAgentWidget from "@/components/scanner/scanner-agent-widget";
import { useAuthStore, UserRole } from "@/stores/auth-store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, switchRole } = useAuthStore();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    router.push("/login");
  };

  const navLinks = [
    { name: "Repository Files", href: "/documents", icon: Folder },
    { name: "Full-Text Search", href: "/search", icon: Search },
    { name: "Audit Logs", href: "/audit", icon: ShieldAlert },
    { name: "System Admin", href: "/admin", icon: Sliders },
  ];

  const getInitials = (name?: string) => {
    if (!name) return "AD";
    const parts = name.split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col justify-between">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-border">
            <FileText className="h-6 w-6 text-primary mr-2.5" />
            <span className="font-black text-lg tracking-tight text-foreground">
              EDRMS Enterprise
            </span>
          </div>

          <nav className="px-4 py-6 space-y-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center px-3.5 py-2.5 text-sm font-medium rounded-lg transition ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 mr-3" />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Scanner Agent Status Card in Sidebar Bottom */}
        <div className="p-4 border-t border-border">
          <ScannerAgentWidget />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 z-30">
          <div className="flex items-center text-xs text-muted-foreground font-mono">
            Enterprise Document Repository &middot; Modular Monolith &middot; Keycloak OIDC
          </div>

          <div className="flex items-center space-x-4">
            <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Java 21 &bull; Spring Boot 3
            </span>

            {/* User Profile & Logout Dropdown */}
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-secondary transition focus:outline-none"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center border border-primary/30 shadow-sm">
                    {getInitials(user.fullName)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-semibold text-foreground leading-tight">
                      {user.fullName}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {user.role}
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {/* Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                    {/* User Info Header */}
                    <div className="p-3 border-b border-border">
                      <p className="text-xs font-bold text-foreground">{user.fullName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                      <div className="mt-2">
                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/20 text-primary uppercase">
                          Role: {user.role}
                        </span>
                      </div>
                    </div>

                    {/* Role Switcher Menu */}
                    <div className="py-2 border-b border-border space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase px-2">
                        Switch Active Role:
                      </span>
                      <div className="grid grid-cols-1 gap-1 px-1">
                        {(
                          [
                            "SUPER_ADMIN",
                            "DEPARTMENT_MANAGER",
                            "CONTRIBUTOR",
                            "AUDITOR",
                            "VIEWER",
                          ] as UserRole[]
                        ).map((role) => (
                          <button
                            key={role}
                            onClick={() => {
                              switchRole(role);
                              setIsProfileMenuOpen(false);
                            }}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded transition ${
                              user.role === role
                                ? "bg-primary/10 text-primary font-semibold"
                                : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {role === user.role ? "&bull; " : "  "}
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Logout Button */}
                    <div className="pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 text-xs font-semibold px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out / Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
              >
                Sign In
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
