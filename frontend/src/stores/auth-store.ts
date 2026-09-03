import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PermissionType } from "@/types";

export type UserRole = "SUPER_ADMIN" | "DEPARTMENT_MANAGER" | "CONTRIBUTOR" | "VIEWER" | "AUDITOR";

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  permissions: PermissionType[];
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, role?: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const rolePermissionsMap: Record<UserRole, PermissionType[]> = {
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: {
        id: "usr-admin-01",
        username: "admin",
        fullName: "Alexander Davis",
        email: "a.davis@edrms.corp",
        role: "SUPER_ADMIN",
        permissions: rolePermissionsMap["SUPER_ADMIN"],
      },
      isAuthenticated: true,

      login: (username: string, role: UserRole = "SUPER_ADMIN") => {
        const fullName =
          username === "admin"
            ? "Alexander Davis"
            : username === "jdoe"
            ? "John Doe"
            : username.charAt(0).toUpperCase() + username.slice(1);

        const email = `${username.toLowerCase()}@edrms.corp`;

        set({
          isAuthenticated: true,
          user: {
            id: `usr-${username.toLowerCase()}`,
            username,
            fullName,
            email,
            role,
            permissions: rolePermissionsMap[role],
          },
        });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("edrms_access_token");
        }
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      switchRole: (newRole: UserRole) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              role: newRole,
              permissions: rolePermissionsMap[newRole],
            },
          };
        });
      },
    }),
    {
      name: "edrms-auth-storage",
    }
  )
);
