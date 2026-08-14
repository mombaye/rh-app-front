import api from "@/api/axios";
import axios from "axios";

import { BASE_URL } from "@/api/baseUrl";


// Appel l'API login et retourne access/refresh tokens
export const login = async (username: string, password: string) => {
  const res = await api.post("/api/auth/login/", { username, password });
  return res.data;
};

// Récupère le profil utilisateur courant (besoin d'être connecté)
export const getProfile = async () => {
  const res = await api.get("/api/auth/profile/");
  return res.data;
};

// Exemple : register un nouvel utilisateur (selon besoin)
export const register = async (username: string, email: string, password: string) => {
  const res = await api.post("/api/auth/register/", { username, email, password });
  return res.data;
};

export const changePassword = async (
  old_password: string,
  new_password: string,
  confirm_password: string
) => {
  const res = await api.post("/api/auth/change-password/", {
    old_password,
    new_password,
    confirm_password,
  });
  return res.data;
};

export const getAdminStats = async () => {
  const res = await api.get("/api/users/admin/stats/");
  return res.data;
};

export const getAdminUsers = async (params?: { search?: string; country?: string }) => {
  const res = await api.get("/api/users/admin/users/", { params });
  return res.data;
};

export const updateAdminUser = async (
  userId: number,
  data: { is_global_admin?: boolean; is_planning_manager?: boolean; is_active?: boolean }
) => {
  const res = await api.patch(`/api/users/admin/users/${userId}/`, data);
  return res.data;
};

// ── Mot de passe oublié (sans auth) ──────────────────────────────────────────
const publicApi = axios.create({ baseURL: BASE_URL });

export const forgotPassword = async (email: string): Promise<{ detail: string; email: string }> => {
  const res = await publicApi.post("/api/auth/forgot-password/", { email });
  return res.data;
};

export const verifyOtp = async (email: string, code: string): Promise<{ detail: string }> => {
  const res = await publicApi.post("/api/auth/verify-otp/", { email, code });
  return res.data;
};

export const resetPasswordOtp = async (
  email: string,
  code: string,
  new_password: string
): Promise<{ detail: string }> => {
  const res = await publicApi.post("/api/auth/reset-password/", { email, code, new_password });
  return res.data;
};