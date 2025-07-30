import React, { createContext, useContext, useEffect, useState } from "react";
import { getProfile, login as apiLogin } from "@/services/userService";

type User = {
  id: number;
  username: string;
  email: string;
  is_global_admin?: boolean;
  country?: any;
  // Ajoute d'autres champs si besoin
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Charge l'utilisateur courant au démarrage si token présent
  useEffect(() => {
    const fetchUser = async () => {
      const access = localStorage.getItem("access_token");
      if (access) {
        try {
          const data = await getProfile();
          setUser(data);
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  // Méthode de login
  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin(username, password);
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
     
      
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Erreur de connexion.");
      setUser(null);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      setLoading(false);
    }
  };

  // Méthode de logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook pour utiliser le contexte
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
};
