"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Folder,
  Search,
  ShieldAlert,
  Sliders,
  LogOut,
  ChevronDown,
  Shield,
  Layers,
  Clock,
  UserCheck,
  AlertTriangle,
  Bell,
  Check,
  X,
  Plus,
} from "lucide-react";
import { useAuthStore, UserRole, DEFAULT_ADMIN_USER } from "@/stores/auth-store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, sessionExpiresAt, logout, switchRole, setSessionDuration, extendSession } = useAuthStore();

  // Active user: always guarantees the profile & logout menu is present inside the system
  const rawUser = user || DEFAULT_ADMIN_USER;
  const activeUser = {
    ...rawUser,
    fullName: rawUser.fullName === "Alexander Davis" ? "Administrator" : (rawUser.fullName || rawUser.username),
  };

  // Sync live profile from database (/api/auth/me) so real database name (Administrator) is always displayed
  useEffect(() => {
    async function syncProfile() {
      try {
        const token = localStorage.getItem("edrms_access_token") || user?.token;
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch("/api/auth/me", { headers });
        if (res.ok) {
          const profile = await res.json();
          if (profile && profile.username) {
            useAuthStore.setState((state) => {
              if (!state.user) return state;
              return {
                user: {
                  ...state.user,
                  fullName: profile.fullName || state.user.fullName,
                  email: profile.email || state.user.email,
                  role: profile.role || state.user.role,
                  permissions: profile.permissions || state.user.permissions,
                  assignedFolderIds: profile.assignedFolderIds || state.user.assignedFolderIds,
                  accessibleMenus: profile.accessibleMenus || state.user.accessibleMenus,
                },
              };
            });
          }
        }
      } catch (err) {
        // silent fallback
      }
    }
    syncProfile();
  }, []);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [dismissedTier, setDismissedTier] = useState<string | null>(null);
  const [headerQuery, setHeaderQuery] = useState("");
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Live session countdown timer strictly following admin grant
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Real-time countdown and auto-logout strictly for temporary access users
  useEffect(() => {
    // If the user has permanent access (e.g. admin, root, or permanent account), do NOT show or run countdown
    if (!activeUser?.isTemporaryAccess) {
      setSecondsRemaining(null);
      return;
    }

    const effectiveExpiry = activeUser?.sessionExpiresAt || sessionExpiresAt;
    if (!effectiveExpiry) {
      setSecondsRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const expiry = new Date(effectiveExpiry).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((expiry - now) / 1000));
    };

    setSecondsRemaining(calculateTimeRemaining());

    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        logout();
        window.location.href = "/login?reason=session_expired";
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeUser?.isTemporaryAccess, activeUser?.sessionExpiresAt, sessionExpiresAt, logout]);

  // Expiry notification tier calculation: strictly for temporary access users
  const currentAlertTier = React.useMemo(() => {
    if (!activeUser?.isTemporaryAccess || secondsRemaining === null || secondsRemaining <= 0) return null;
    if (secondsRemaining <= 60) return "urgent";
    if (secondsRemaining <= 300) return "warning";
    return null;
  }, [activeUser?.isTemporaryAccess, secondsRemaining]);

  const formatRemainingTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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
    window.location.href = "/login";
  };

  const allNavLinks = [
    {
      name: "Repository Files",
      href: "/documents",
      icon: Folder,
      allowedRoles: ["SUPER_ADMIN", "DEPARTMENT_MANAGER", "CONTRIBUTOR", "AUDITOR", "VIEWER"],
    },
    {
      name: "Full-Text Search",
      href: "/search",
      icon: Search,
      allowedRoles: ["SUPER_ADMIN", "DEPARTMENT_MANAGER", "CONTRIBUTOR", "AUDITOR", "VIEWER"],
    },
    {
      name: "Audit Logs",
      href: "/audit",
      icon: ShieldAlert,
      allowedRoles: ["SUPER_ADMIN", "AUDITOR"],
    },
    {
      name: "System Admin",
      href: "/admin",
      icon: Sliders,
      allowedRoles: ["SUPER_ADMIN"],
    },
  ];

  const currentRole = activeUser.role;
  const navLinks = allNavLinks.filter((link) => {
    if (activeUser.accessibleMenus && activeUser.accessibleMenus.length > 0) {
      return activeUser.accessibleMenus.includes(link.href);
    }
    return link.allowedRoles.includes(currentRole);
  });

  const isCurrentRouteAllowed =
    navLinks.length === 0 ||
    navLinks.some((l) => l.href === pathname) ||
    pathname.startsWith("/share");

  const getInitials = (name?: string) => {
    if (!name) return "AD";
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Enterprise White + Warm Orange Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0 shadow-xs z-20">
        <div>
          {/* Brand Header with Tagline */}
          <div className="h-16 flex items-center px-6 border-b border-slate-200">
            <div className="h-9 w-9 rounded-lg bg-orange-500 text-white flex items-center justify-center mr-3 shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-none">
                EDMS
              </span>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                Document
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-5 space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </div>
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition ${isActive
                    ? "bg-orange-50 text-orange-800 font-bold border border-orange-200 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                    }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? "text-orange-500" : "text-slate-400"
                      }`}
                  />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Global Application Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 lg:px-8 z-10 shrink-0">
          <div className="flex items-center space-x-4">
            <div className="text-xs text-slate-400 flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Workspace</span>
              <span>/</span>
              <span className="text-slate-500">
                {pathname === "/documents"
                  ? "Repository Files"
                  : pathname === "/search"
                    ? "Full-Text Search"
                    : pathname === "/audit"
                      ? "Compliance Audit Trail"
                      : pathname === "/admin"
                        ? "System Administration & Access Governance"
                        : "Enterprise Document & Compliance"}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Global Search Quick Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (headerQuery.trim()) {
                  router.push(`/search?q=${encodeURIComponent(headerQuery.trim())}`);
                }
              }}
              className="relative hidden sm:block w-72"
            >
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
                placeholder="Search repository or OCR text..."
                className="w-full pl-8 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition shadow-2xs"
              />
            </form>

            {/* Live Access Countdown Counter (Strictly for temporary access users) */}
            {activeUser?.isTemporaryAccess && secondsRemaining !== null && (
              <div
                className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-2xs ${secondsRemaining <= 60
                  ? "bg-rose-50 text-rose-800 border-rose-300 animate-pulse ring-2 ring-rose-200"
                  : secondsRemaining <= 300
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-amber-50 text-amber-900 border-amber-200"
                  }`}
                title="Active access time remaining before automatic logout"
              >
                <Clock
                  className={`h-3.5 w-3.5 ${secondsRemaining <= 60
                    ? "text-rose-600 animate-spin"
                    : "text-amber-600"
                    }`}
                />
                <span className="text-[11px] text-amber-700 font-medium hidden sm:inline">
                  Access Timer:
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {formatRemainingTime(secondsRemaining)}
                </span>
              </div>
            )}

            {/* User Profile & Logout Dropdown - ALWAYS Available Inside System */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center space-x-2.5 p-1.5 rounded-lg hover:bg-slate-100 transition focus:outline-none border border-slate-200 bg-white shadow-2xs"
                title="User Profile & Settings"
              >
                <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center border border-orange-200 shadow-xs shrink-0">
                  {getInitials(activeUser.fullName)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {activeUser.fullName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {activeUser.role}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                  {/* User Info Header */}
                  <div className="p-3 border-b border-slate-100 bg-slate-50/80 rounded-lg">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-9 w-9 rounded-full bg-orange-500 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                        {getInitials(activeUser.fullName)}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">{activeUser.fullName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{activeUser.email}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200 uppercase">
                        {activeUser.role}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        @{activeUser.username}
                      </span>
                    </div>
                  </div>

                  {/* User Permissions & Access Overview */}
                  <div className="py-2.5 px-3 border-b border-slate-100 space-y-2">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Folder Governance:
                      </span>
                      <div className="text-xs font-medium text-slate-700 mt-0.5">
                        {!activeUser.assignedFolderIds || activeUser.assignedFolderIds.length === 0
                          ? "All Folders (Full Access)"
                          : `Assigned: ${activeUser.assignedFolderIds.length} folder(s)`}
                      </div>
                    </div>

                    {activeUser.permissions && activeUser.permissions.length > 0 && (
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Granted Permissions:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {activeUser.permissions.map((p) => (
                            <span
                              key={p}
                              className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeUser.accessibleMenus && activeUser.accessibleMenus.length > 0 && (
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Menu Modules:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {activeUser.accessibleMenus.map((m) => {
                            const name = allNavLinks.find((l) => l.href === m)?.name || m;
                            return (
                              <span
                                key={m}
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200"
                              >
                                {name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Switch to Another User / Login */}
                  <div className="py-1 px-1 border-b border-slate-100">
                    <Link
                      href="/login"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="w-full flex items-center space-x-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 transition"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                      <span>Switch User / Sign In</span>
                    </Link>
                  </div>

                  {/* Sign Out / Log Out Button */}
                  <div className="pt-1 px-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 text-xs font-semibold px-2.5 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out / Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Expiry Warning Notification Banner (strictly for temporary access users) */}
        {activeUser?.isTemporaryAccess && dismissedTier !== currentAlertTier && currentAlertTier && secondsRemaining !== null && (
          <div
            className={`px-6 lg:px-8 py-2.5 shrink-0 border-b flex items-center justify-between transition-all duration-200 ${currentAlertTier === "urgent"
              ? "bg-rose-50 border-rose-200 text-rose-900 animate-pulse"
              : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
          >
            <div className="flex items-center space-x-2.5 text-xs">
              <AlertTriangle
                className={`h-4 w-4 shrink-0 ${currentAlertTier === "urgent"
                  ? "text-rose-600 animate-bounce"
                  : "text-amber-600"
                  }`}
              />
              <span>
                {currentAlertTier === "urgent" ? (
                  <>
                    <strong>Urgent:</strong> Your access will automatically expire and log out in{" "}
                    <strong className="font-mono">{formatRemainingTime(secondsRemaining)}</strong>. Please save your work.
                  </>
                ) : (
                  <>
                    <strong>Access Expiry Notice:</strong> You will be automatically logged out in{" "}
                    <strong className="font-mono">{formatRemainingTime(secondsRemaining)}</strong>. Please ensure all work is saved.
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setDismissedTier(currentAlertTier)}
                className="p-1 hover:bg-black/5 rounded text-slate-500 hover:text-slate-700 transition"
                title="Dismiss notice"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Body */}
        <main className="flex-1 min-h-0 overflow-hidden px-6 py-5 lg:px-8 lg:py-6 bg-slate-50 flex flex-col justify-between">
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {isCurrentRouteAllowed ? (
              children
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-200 m-4 shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Module Access Restricted</h2>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Your account does not have access permissions configured for this navigation menu.
                    Please contact your system administrator to update your menu access rights.
                  </p>
                </div>
                {navLinks.length > 0 && (
                  <Link
                    href={navLinks[0].href}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition shadow-xs"
                  >
                    Go to {navLinks[0].name}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Footer Branding - Always visible at bottom */}
          <footer className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2 shrink-0 bg-slate-50">
            <div className="flex items-center space-x-2">
              <span>EDMS Enterprise</span>
              <span>&bull;</span>
              <span>Secure Document Governance</span>
            </div>
            <div className="flex items-center space-x-1 text-slate-500">
              <span>Powered by</span>
              <span className="font-bold text-slate-700">Arkaa Digital</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
