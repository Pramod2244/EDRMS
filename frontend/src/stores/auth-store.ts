import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PermissionType } from "@/types";

export type UserRole = "SUPER_ADMIN" | "DEPARTMENT_MANAGER" | "CONTRIBUTOR" | "VIEWER" | "AUDITOR" | (string & {});

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  permissions: PermissionType[];
  assignedFolderIds?: string[];
  accessibleMenus?: string[];
  token?: string;
  sessionExpiresAt?: string | null;
  isTemporaryAccess?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  token: string | null;
  sessionExpiresAt: string | null;
  isTemporaryAccess: boolean;
  login: (username: string, role?: UserRole) => void;
  setAuthenticatedUser: (
    user: AuthUser,
    token: string,
    expiresAt?: string | null,
    isTemporary?: boolean
  ) => void;
  setSessionDuration: (durationMinutes: number) => void;
  extendSession: (additionalMinutes: number) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

export const rolePermissionsMap: Record<UserRole, PermissionType[]> = {
  SUPER_ADMIN: [
    "VIEW",
    "UPLOAD",
    "DOWNLOAD",
    "DELETE",
    "SHARE",
    "PRINT",
    "MANAGE_PERMISSIONS",
    "AUDIT_READ",
  ],
  DEPARTMENT_MANAGER: [
    "VIEW",
    "UPLOAD",
    "DOWNLOAD",
    "DELETE",
    "SHARE",
    "PRINT",
    "MANAGE_PERMISSIONS",
  ],
  CONTRIBUTOR: ["VIEW", "UPLOAD", "DOWNLOAD", "PRINT"],
  VIEWER: ["VIEW"],
  AUDITOR: ["VIEW", "AUDIT_READ"],
};

export const DEFAULT_ADMIN_USER: AuthUser = {
  id: "be9f4073-f622-46ec-854e-e422e30ddbeb",
  username: "admin",
  fullName: "Administrator",
  email: "admin@arkaa-digital.local",
  role: "SUPER_ADMIN",
  permissions: rolePermissionsMap["SUPER_ADMIN"],
  accessibleMenus: ["/documents", "/search", "/audit", "/admin"],
  sessionExpiresAt: null,
  isTemporaryAccess: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: DEFAULT_ADMIN_USER,
      isAuthenticated: true,
      token: null,
      sessionExpiresAt: null,
      isTemporaryAccess: false,

      // Compatibility login
      login: (username: string, role: UserRole = "SUPER_ADMIN") => {
        const fullName =
          username === "admin"
            ? "Administrator"
            : username === "jdoe"
            ? "John Doe"
            : username.charAt(0).toUpperCase() + username.slice(1);

        const email = `${username.toLowerCase()}@arkaa-digital.local`;

        set({
          isAuthenticated: true,
          token: null,
          sessionExpiresAt: null,
          isTemporaryAccess: false,
          user: {
            id: `usr-${username.toLowerCase()}`,
            username,
            fullName,
            email,
            role,
            permissions: rolePermissionsMap[role] || ["VIEW"],
            sessionExpiresAt: null,
            isTemporaryAccess: false,
          },
        });
      },

      setAuthenticatedUser: (
        user: AuthUser,
        token: string,
        expiresAt?: string | null,
        isTemporary: boolean = false
      ) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("edrms_access_token", token);
        }
        // ONLY temporary access users get an active expiring countdown; permanent users have no expiration
        const effectiveExpiry = isTemporary ? (expiresAt || null) : null;
        set({
          isAuthenticated: true,
          token,
          sessionExpiresAt: effectiveExpiry,
          isTemporaryAccess: isTemporary,
          user: {
            ...user,
            token,
            sessionExpiresAt: effectiveExpiry,
            isTemporaryAccess: isTemporary,
          },
        });
      },

      setSessionDuration: (durationMinutes: number) => {
        const newExpiry = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
        set((state) => ({
          sessionExpiresAt: newExpiry,
          user: state.user ? { ...state.user, sessionExpiresAt: newExpiry } : null,
        }));
      },

      extendSession: (additionalMinutes: number) => {
        set((state) => {
          const currentMs = state.sessionExpiresAt ? new Date(state.sessionExpiresAt).getTime() : Date.now();
          const baseTime = Math.max(Date.now(), currentMs);
          const newExpiry = new Date(baseTime + additionalMinutes * 60 * 1000).toISOString();
          return {
            sessionExpiresAt: newExpiry,
            user: state.user ? { ...state.user, sessionExpiresAt: newExpiry } : null,
          };
        });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("edrms_access_token");
        }
        set({
          user: null,
          isAuthenticated: false,
          token: null,
          sessionExpiresAt: null,
          isTemporaryAccess: false,
        });
      },

      switchRole: (newRole: UserRole) => {
        set((state) => {
          const targetUser = state.user || DEFAULT_ADMIN_USER;
          return {
            user: {
              ...targetUser,
              role: newRole,
              permissions: rolePermissionsMap[newRole] || ["VIEW"],
            },
          };
        });
      },
    }),
    {
      name: "edrms-auth-storage",
      onRehydrateStorage: () => (state) => {
        if (state?.user && state.user.username === "admin" && state.user.fullName === "Alexander Davis") {
          state.user.fullName = "Administrator";
        }
      },
    }
  )
);
