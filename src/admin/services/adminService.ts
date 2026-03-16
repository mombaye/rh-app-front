import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8030";

const adminApi = axios.create({ baseURL, headers: { "Content-Type": "application/json" } });

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    if (error.response?.status === 401 && !orig._retry && localStorage.getItem("admin_refresh_token")) {
      orig._retry = true;
      try {
        const res = await axios.post(`${baseURL}/api/auth/token/refresh/`, {
          refresh: localStorage.getItem("admin_refresh_token"),
        });
        const token = res.data.access;
        localStorage.setItem("admin_access_token", token);
        orig.headers.Authorization = `Bearer ${token}`;
        return adminApi(orig);
      } catch {
        localStorage.removeItem("admin_access_token");
        localStorage.removeItem("admin_refresh_token");
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  is_global_admin: boolean;
  is_staff: boolean;
  is_planning_manager: boolean;
  manager_level: 1 | 2 | null;
  first_login: boolean;
  is_active: boolean;
  country: { id: number; name: string; code: string } | null;
  employee_id?: number | null;
  employee_name?: string | null;
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

export type UserFormData = {
  username: string;
  email: string;
  password?: string;
  is_staff?: boolean;
  is_global_admin?: boolean;
  is_planning_manager?: boolean;
  manager_level?: 1 | 2 | null;
  country_id?: number | null;
  employee_id?: number | null;
  is_active?: boolean;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const adminLogin = async (username: string, password: string) => {
  const res = await axios.post(`${baseURL}/api/auth/login/`, { username, password });
  return res.data;
};

export const adminGetProfile = async () => {
  const res = await adminApi.get("/api/auth/profile/");
  return res.data;
};

// ─── Stats ────────────────────────────────────────────────────────────────────

export const getAdminStats = async (): Promise<AdminStats> => {
  const res = await adminApi.get("/api/users/admin/stats/");
  return res.data;
};

// ─── User CRUD ────────────────────────────────────────────────────────────────

export type UserListParams = {
  role?: "employee" | "rh" | "manager" | "manager1" | "manager2";
  search?: string;
  country?: string;
  is_active?: boolean;
};

export const getUsers = async (params?: UserListParams): Promise<AdminUser[]> => {
  const res = await adminApi.get("/api/users/admin/accounts/", { params });
  return Array.isArray(res.data) ? res.data : res.data.results ?? [];
};

export const createUser = async (data: UserFormData): Promise<AdminUser> => {
  const res = await adminApi.post("/api/users/admin/accounts/", data);
  return res.data;
};

export const updateUser = async (id: number, data: Partial<UserFormData>): Promise<AdminUser> => {
  const res = await adminApi.patch(`/api/users/admin/accounts/${id}/`, data);
  return res.data;
};

export const deleteUser = async (id: number): Promise<void> => {
  await adminApi.delete(`/api/users/admin/accounts/${id}/`);
};

export const resetUserPassword = async (id: number, password: string): Promise<void> => {
  await adminApi.post(`/api/users/admin/accounts/${id}/reset_password/`, { password });
};

export const toggleUserActive = async (id: number): Promise<{ is_active: boolean }> => {
  const res = await adminApi.post(`/api/users/admin/accounts/${id}/toggle_active/`);
  return res.data;
};
