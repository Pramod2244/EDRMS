"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, UserRole } from "@/stores/auth-store";
import { FileText, Shield, KeyRound, ArrowRight, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin_secret");
  const [selectedRole, setSelectedRole] = useState<UserRole>("SUPER_ADMIN");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      login(username, selectedRole);
      router.push("/documents");
    }, 400);
  };

  const handleQuickLogin = (role: UserRole, user: string) => {
    login(user, role);
    router.push("/documents");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[140px] pointer-events-none" />

      <div className="max-w-md w-full border border-border bg-card/90 backdrop-blur-md rounded-2xl p-8 shadow-2xl space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center mx-auto mb-3 shadow-inner">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            EDRMS Enterprise
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign in to access secure document repository &amp; compliance records
          </p>
        </div>

        {/* Keycloak SSO Quick Button */}
        <button
          onClick={() => handleQuickLogin("SUPER_ADMIN", "admin")}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-secondary hover:bg-muted border border-border text-foreground text-sm font-medium transition"
        >
          <Shield className="h-4 w-4 text-primary" />
          <span>Single Sign-On with Keycloak (OIDC)</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-border w-full" />
          <span className="bg-card px-3 text-xs text-muted-foreground uppercase tracking-wider relative">
            Or credentials
          </span>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Username or Corporate ID
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Assigned Role (RBAC Simulation)
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-secondary/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="SUPER_ADMIN">Super Administrator (Full Rights)</option>
              <option value="DEPARTMENT_MANAGER">Department Manager (Approver)</option>
              <option value="CONTRIBUTOR">Contributor (Upload &amp; Edit)</option>
              <option value="AUDITOR">Auditor (Compliance &amp; Logs)</option>
              <option value="VIEWER">Viewer (Read Only &amp; Watermark)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? "Signing in..." : "Sign In to Repository"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Quick Persona Demo Switcher */}
        <div className="pt-4 border-t border-border space-y-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block text-center">
            One-Click Demo Personas:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickLogin("SUPER_ADMIN", "admin")}
              className="text-left p-2 rounded-md bg-secondary/40 hover:bg-secondary border border-border/50 text-xs transition"
            >
              <span className="font-semibold block text-primary">Admin Davis</span>
              <span className="text-[10px] text-muted-foreground">All permissions</span>
            </button>
            <button
              onClick={() => handleQuickLogin("VIEWER", "guest_auditor")}
              className="text-left p-2 rounded-md bg-secondary/40 hover:bg-secondary border border-border/50 text-xs transition"
            >
              <span className="font-semibold block text-foreground">Viewer Mode</span>
              <span className="text-[10px] text-muted-foreground">Watermark &amp; No Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
