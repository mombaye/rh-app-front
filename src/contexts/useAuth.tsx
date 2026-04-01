import React, { createContext, useContext, useEffect, useState } from "react";
import { getProfile, login as apiLogin } from "@/services/userService";
import { useNavigate } from "react-router-dom";

export type UserRole = "rh" | "manager1" | "manager2" | "employe" | "planning";

type User = {
  id: number;
  username: string;
  email: string;
  is_global_admin?: boolean;
  is_staff?: boolean;
  is_planning_manager?: boolean;
  manager_level?: number | null;
  country?: any;
  first_login?: boolean;
  employee_id?: number | null;
  employee_matricule?: string | null;
  employee_name?: string | null;
  employee_service?: string | null;
  employee_fonction?: string | null;
  is_department_head?: boolean;
  department_name?: string | null;
  roles?: UserRole[];
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  activeRole: UserRole | null;
  availableRoles: UserRole[];
  switchRole: (role: UserRole) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function computeRoles(profile: User): UserRole[] {
  return (profile.roles as UserRole[]) ?? [];
}

// Priorité de rôle : rh > manager2 > manager1 > planning > employe
const ROLE_PRIORITY: UserRole[] = ["rh", "manager2", "manager1", "planning", "employe"];

function pickBestRole(roles: UserRole[]): UserRole {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
}

function dashboardForRole(role: UserRole): string {
  switch (role) {
    case "rh":       return "/dashboard";
    case "manager1":
    case "manager2": return "/manager/dashboard";
    case "planning": return "/planning";
    case "employe":  return "/employee/dashboard";
  }
}

export { dashboardForRole };

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole | null>(() => {
    return (localStorage.getItem("active_role") as UserRole) || null;
  });

  // Charge l'utilisateur courant au démarrage si token présent
  useEffect(() => {
    const fetchUser = async () => {
      const access = localStorage.getItem("access_token");
      if (access) {
        try {
          const data = await getProfile();
          setUser(data);
          // Validate stored activeRole is still valid
          const roles = computeRoles(data);
          const stored = localStorage.getItem("active_role") as UserRole | null;
          if (stored && roles.includes(stored)) {
            setActiveRole(stored);
          } else if (roles.length > 0) {
            const best = pickBestRole(roles);
            setActiveRole(best);
            localStorage.setItem("active_role", best);
          }
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const availableRoles: UserRole[] = user ? computeRoles(user) : [];

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin(username, password);
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      const profile = await getProfile();
      setUser(profile);
      return profile;
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Erreur de connexion.");
      setUser(null);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const switchRole = (role: UserRole) => {
    // Pas de garde sur availableRoles : juste après login() le state user
    // n'est pas encore re-rendu donc availableRoles serait vide et bloquerait.
    setActiveRole(role);
    localStorage.setItem("active_role", role);
  };

  const logout = () => {
    setUser(null);
    setActiveRole(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("active_role");
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!user,
        setUser,
        activeRole,
        availableRoles,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
};
