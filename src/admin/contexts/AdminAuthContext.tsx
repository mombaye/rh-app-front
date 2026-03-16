import React, { createContext, useContext, useEffect, useState } from "react";
import { adminLogin, adminGetProfile } from "@/admin/services/adminService";

type AdminUser = {
  id: number;
  username: string;
  email: string;
  is_global_admin?: boolean;
  is_staff?: boolean;
};

type AdminAuthCtx = {
  admin: AdminUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
};

const AdminAuthContext = createContext<AdminAuthCtx | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_access_token");
    if (token) {
      adminGetProfile()
        .then((data) => {
          if (data.is_global_admin || data.is_staff) setAdmin(data);
          else localStorage.removeItem("admin_access_token");
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const tokens = await adminLogin(username, password);
      localStorage.setItem("admin_access_token", tokens.access);
      localStorage.setItem("admin_refresh_token", tokens.refresh);
      const profile = await adminGetProfile();
      if (!profile.is_global_admin && !profile.is_staff) {
        localStorage.removeItem("admin_access_token");
        localStorage.removeItem("admin_refresh_token");
        throw new Error("Accès refusé. Vous n'avez pas les droits administrateur.");
      }
      setAdmin(profile);
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.detail || "Identifiants incorrects.";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAdmin(null);
    localStorage.removeItem("admin_access_token");
    localStorage.removeItem("admin_refresh_token");
    window.location.href = "/admin/login";
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, error, login, logout, isAuthenticated: !!admin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth doit être dans AdminAuthProvider");
  return ctx;
};
