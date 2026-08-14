import axios from "axios";

import { BASE_URL } from "@/api/baseUrl";

const adminApi = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refresh = localStorage.getItem("admin_refresh_token");
      if (refresh) {
        try {
          const res = await axios.post(`${BASE_URL}/api/auth/token/refresh/`, { refresh });
          localStorage.setItem("admin_access_token", res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return adminApi(originalRequest);
        } catch {
          // fall through to redirect
        }
      }
      localStorage.removeItem("admin_access_token");
      localStorage.removeItem("admin_refresh_token");
      window.location.href = "/admin";
    }
    return Promise.reject(error);
  }
);

export default adminApi;
