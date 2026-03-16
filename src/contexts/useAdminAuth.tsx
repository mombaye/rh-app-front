import React, { createContext, useContext, useEffect, useState } from "react";
import { adminLogin, getAdminProfile } from "@/services/adminService";

type AdminUser = {
  id: number;
  username: string;
  email: string;
  is_global_admin?: boolean;
  is_staff?: boolean;
};

type AdminAuthContextType = {
  adminUser: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AdminUser>;
  logout: () => void;
  isAuthenticated: boolean;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("admin_access_token");
      if (token) {
        try {
          const data = await getAdminProfile();
          if (data.is_global_admin || data.is_staff) {
            setAdminUser(data);
          } else {
            localStorage.removeItem("admin_access_token");
            localStorage.removeItem("admin_refresh_token");
          }
        } catch {
          setAdminUser(null);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const login = async (username: string, password: string): Promise<AdminUser> => {
    setLoading(true);
    try {
      const data = await adminLogin(username, password);
      localStorage.setItem("admin_access_token", data.access);
      localStorage.setItem("admin_refresh_token", data.refresh);
      const profile = await getAdminProfile();
      if (!profile.is_global_admin && !profile.is_staff) {
        localStorage.removeItem("admin_access_token");
        localStorage.removeItem("admin_refresh_token");
        throw new Error("Accès non autorisé. Identifiants administrateur requis.");
      }
      setAdminUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAdminUser(null);
    localStorage.removeItem("admin_access_token");
    localStorage.removeItem("admin_refresh_token");
    window.location.href = "/admin";
  };

  return (
    <AdminAuthContext.Provider
      value={{ adminUser, loading, login, logout, isAuthenticated: !!adminUser }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth doit être utilisé dans AdminAuthProvider");
  return ctx;
};
