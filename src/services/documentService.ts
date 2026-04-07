// src/services/documentService.ts
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
const API = `${BASE_URL}/api/employees/hr-documents`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("access_token");
  return { Authorization: `Bearer ${token}` };
};

export interface HRDocument {
  id: number;
  title: string;
  description: string;
  category: string;
  file: string;
  file_url: string | null;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  REGLEMENT:    "Règlement intérieur",
  NOTE_SERVICE: "Note de service",
  PROCEDURE:    "Procédure / Politique",
  FORMULAIRE:   "Formulaire",
  AUTRE:        "Autre",
};

export const documentService = {
  getAll: async (): Promise<HRDocument[]> => {
    const res = await axios.get(`${API}/`, { headers: getAuthHeaders() });
    return res.data;
  },

  upload: async (formData: FormData): Promise<HRDocument> => {
    const res = await axios.post(`${API}/`, formData, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  update: async (id: number, data: Partial<HRDocument>): Promise<HRDocument> => {
    const res = await axios.patch(`${API}/${id}/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API}/${id}/`, { headers: getAuthHeaders() });
  },

  toggleActive: async (id: number): Promise<{ id: number; is_active: boolean }> => {
    const res = await axios.post(`${API}/${id}/toggle_active/`, {}, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  formatSize: (bytes: number): string => {
    if (bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  },
};
