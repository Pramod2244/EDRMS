"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Shield, ArrowRight, Layers, Lock, User, AlertTriangle, Eye, EyeOff, Clock } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthenticatedUser } = useAuthStore();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin123!");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "session_expired") {
      setInfoMsg("Your session has expired. Please sign in again to continue.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        // Authenticate user strictly using the admin-assigned expiration
        setAuthenticatedUser(
          data.user,
          data.token,
          data.expiresAt,
          Boolean(data.isTemporaryAccess || data.temporaryAccess)
        );
        router.push("/documents");
      } else {
        setErrorMsg(data.error || "Invalid username or password. Please verify your credentials.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorMsg("Unable to connect to authentication service. Please check your network connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeycloakSso = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/keycloak-config");
      const config = await res.json().catch(() => ({}));
      if (config.authUrl) {
        window.location.href = config.authUrl;
      } else {
        setErrorMsg("Keycloak SSO service is not reachable. Please sign in using your repository credentials.");
      }
    } catch {
      setErrorMsg("Failed to initialize Keycloak SSO authentication.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between items-center p-4 relative overflow-hidden font-sans">
      {/* Subtle Warm Background Accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100/50 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="my-auto max-w-md w-full border border-slate-200 bg-white rounded-2xl p-8 shadow-sm space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-orange-500 text-white flex items-center justify-center mx-auto shadow-xs">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              EDMS Enterprise
            </h1>
          </div>
          <p className="text-xs text-slate-500 pt-0.5">
            Enterprise Document Management System &amp; Compliance Portal
          </p>
        </div>

        {/* Notifications & Alerts */}
        {infoMsg && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}


        {/* <button
          type="button"
          onClick={handleKeycloakSso}
          disabled={isLoading}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium transition shadow-2xs"
        >
          <Shield className="h-4 w-4 text-orange-500" />
          <span>Single Sign-On with Keycloak (OIDC)</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-xs text-slate-400 uppercase tracking-wider relative font-semibold">
            Or repository credentials
          </span>
        </div> */}

        {/* Production Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Username / Corporate ID
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoFocus
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition flex items-center justify-center space-x-2 shadow-xs disabled:opacity-60"
          >
            <span>{isLoading ? "Authenticating..." : "Sign In to Repository"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Credentials Info Box */}
        {/* <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="font-semibold text-slate-700">Quick Test Credentials:</div>
          <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
            <div>Admin: <span className="text-orange-700 font-semibold">admin</span> / Admin123!</div>
            <div>Auditor: <span className="text-orange-700 font-semibold">auditor</span> / Auditor123!</div>
          </div>
        </div> */}
      </div>

      {/* Footer Branding */}
      <footer className="w-full max-w-md text-center py-4 text-xs text-slate-400">
        <span>Powered by </span>
        <span className="font-bold text-slate-600">Arkaa Digital</span>
        <span> &bull; Secure Document Governance</span>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">
          Loading authentication portal...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
