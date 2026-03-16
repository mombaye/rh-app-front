import axios from "@/api/axios";

const API = "/api/users";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

export type UserRole = "EMPLOYEE" | "HR" | "MANAGER_N1" | "MANAGER_N2" | "";

export const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE:   "Employé",
  HR:         "RH",
  MANAGER_N1: "Manager N1",
  MANAGER_N2: "Manager N2",
  "":         "—",
};

export interface AdminUser {
  id:                  number;
  username:            string;
  email:               string;
  role:                UserRole;
  role_label:          string;
  is_active:           boolean;
  is_global_admin:     boolean;
  is_planning_manager: boolean;
  first_login:         boolean;
  date_joined:         string;
  employee_name:       string | null;
}

export interface AdminStats {
  total:      number;
  active:     number;
  inactive:   number;
  employees:  number;
  hr:         number;
  manager_n1: number;
  manager_n2: number;
}

export const adminService = {
  getStats: async (): Promise<AdminStats> => {
    const res = await axios.get(`${API}/admin/stats/`, { headers: getAuthHeaders() });
    return res.data;
  },

  listUsers: async (params?: { role?: string; search?: string }): Promise<AdminUser[]> => {
    const res = await axios.get(`${API}/admin/users/`, { headers: getAuthHeaders(), params });
    return res.data;
  },

  createUser: async (data: {
    username: string; email: string; password: string;
    role: UserRole; is_active?: boolean;
  }): Promise<AdminUser> => {
    const res = await axios.post(`${API}/admin/users/`, data, { headers: getAuthHeaders() });
    return res.data;
  },

  updateUser: async (id: number, data: Partial<AdminUser>): Promise<AdminUser> => {
    const res = await axios.patch(`${API}/admin/users/${id}/`, data, { headers: getAuthHeaders() });
    return res.data;
  },

  deleteUser: async (id: number): Promise<void> => {
    await axios.delete(`${API}/admin/users/${id}/`, { headers: getAuthHeaders() });
  },

  resetPassword: async (id: number, newPassword: string): Promise<void> => {
    await axios.post(
      `${API}/admin/users/${id}/reset-password/`,
      { new_password: newPassword },
      { headers: getAuthHeaders() },
    );
  },
};
