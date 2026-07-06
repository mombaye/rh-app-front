import api from "@/api/axios";

export type MissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MissionEmployee {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  full_name: string;
  service: string | null;
  fonction: string | null;
  n1_manager_id: number | null;
}

export interface MissionRequest {
  id: number;
  employee: MissionEmployee;
  destination: string;
  objet: string;
  date_debut: string;
  date_fin: string;
  status: MissionStatus;
  notes: string;
  reject_reason: string;
  reviewed_by: MissionEmployee | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionRequestCreate {
  employee_id: number;
  destination: string;
  objet: string;
  date_debut: string;
  date_fin: string;
}

const BASE = "/api/employees/missions/";

export const missionService = {
  list: async (params?: { employee_id?: number; status?: string }): Promise<MissionRequest[]> => {
    const res = await api.get<MissionRequest[]>(BASE, { params });
    return res.data;
  },

  create: async (data: MissionRequestCreate): Promise<MissionRequest> => {
    const res = await api.post<MissionRequest>(BASE, data);
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${BASE}${id}/`);
  },

  approve: async (id: number, notes?: string): Promise<MissionRequest> => {
    const res = await api.post<MissionRequest>(`${BASE}${id}/approve/`, { notes: notes ?? "" });
    return res.data;
  },

  reject: async (id: number, reject_reason: string): Promise<MissionRequest> => {
    const res = await api.post<MissionRequest>(`${BASE}${id}/reject/`, { reject_reason });
    return res.data;
  },
};

