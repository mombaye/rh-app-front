import adminApi from "@/api/adminAxios";
import axios from "axios";

import { API_BASE_URL } from "@/config";

const BASE_URL = API_BASE_URL;

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  is_global_admin: boolean;
  is_staff: boolean;
  is_planning_manager: boolean;
  manager_level: number | null;
  first_login: boolean;
  is_active: boolean;
  country: { id: number; name: string; code: string } | null;
  employee_name: string | null;
  employee_id: number | null;
};

export type EmployeeMinimal = {
  id: number;
  nom: string;
  prenom: string;
  matricule: string;
};

export type AdminStats = {
  total_users: number;
  admin_users: number;
  staff_users: number;
  planning_managers: number;
  active_users: number;
  employee_accounts: number;
  manager_n1: number;
  manager_n2: number;
};

export type CreateUserPayload = {
  username: string;
  email: string;
  password: string;
  is_staff?: boolean;
  is_planning_manager?: boolean;
  manager_level?: number | null;
  is_active?: boolean;
  employee_id?: number | null;
};

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, "password">> & {
  password?: string;
};

// Use plain axios (no interceptors) so a 401 propagates as-is to the caller
export const adminLogin = async (username: string, password: string) => {
  const res = await axios.post(`${BASE_URL}/api/auth/login/`, { username, password });
  return res.data;
};

export const getAdminProfile = async () => {
  const res = await adminApi.get("/api/auth/profile/");
  return res.data;
};

export const getAdminStats = async (): Promise<AdminStats> => {
  const res = await adminApi.get("/api/auth/admin/stats/");
  return res.data;
};

export const getAdminAccounts = async (params?: {
  role?: "employee" | "rh" | "manager" | "manager1" | "manager2";
  search?: string;
  is_active?: string;
}): Promise<AdminUser[]> => {
  const res = await adminApi.get("/api/auth/admin/accounts/", { params });
  return res.data;
};

export const createAdminAccount = async (data: CreateUserPayload): Promise<AdminUser> => {
  const res = await adminApi.post("/api/auth/admin/accounts/", data);
  return res.data;
};

export const updateAdminAccount = async (
  id: number,
  data: UpdateUserPayload
): Promise<AdminUser> => {
  const res = await adminApi.patch(`/api/auth/admin/accounts/${id}/`, data);
  return res.data;
};

export const deleteAdminAccount = async (id: number): Promise<void> => {
  await adminApi.delete(`/api/auth/admin/accounts/${id}/`);
};

export const resetAdminPassword = async (id: number, password: string) => {
  const res = await adminApi.post(`/api/auth/admin/accounts/${id}/reset_password/`, { password });
  return res.data;
};

export const toggleAdminActive = async (id: number) => {
  const res = await adminApi.post(`/api/auth/admin/accounts/${id}/toggle_active/`);
  return res.data;
};

export type AccountHistoryEntry = {
  id: number;
  action: string;
  action_label: string;
  details: Record<string, any>;
  timestamp: string;
  changed_by_username: string;
};

export const getAccountHistory = async (id: number): Promise<AccountHistoryEntry[]> => {
  const res = await adminApi.get(`/api/auth/admin/accounts/${id}/history/`);
  return res.data;
};

export const getEmployeesForAdmin = async (): Promise<EmployeeMinimal[]> => {
  const res = await adminApi.get("/api/employees/");
  return Array.isArray(res.data) ? res.data : [];
};
