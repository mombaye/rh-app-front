import api from "@/api/axios";

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface AppointmentEmployee {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  full_name: string;
  service: string | null;
  fonction: string | null;
}

export interface InfirmerieAppointment {
  id: number;
  employee: AppointmentEmployee;
  date: string;          // "YYYY-MM-DD"
  creneau: string;       // "HH:MM"
  motif: string;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

export interface SlotInfo {
  creneau: string;
  disponible: boolean;
}

export interface SlotsResponse {
  date: string;
  slots: SlotInfo[];
}

const BASE = "/api/employees/infirmerie/";

export const infirmerieService = {
  list: async (params?: { employee_id?: number; date?: string }): Promise<InfirmerieAppointment[]> => {
    const res = await api.get<InfirmerieAppointment[]>(BASE, { params });
    return res.data;
  },

  create: async (data: { employee_id: number; date: string; creneau: string; motif?: string }): Promise<InfirmerieAppointment> => {
    const res = await api.post<InfirmerieAppointment>(BASE, data);
    return res.data;
  },

  cancel: async (id: number): Promise<void> => {
    await api.delete(`${BASE}${id}/`);
  },

  confirm: async (id: number): Promise<InfirmerieAppointment> => {
    const res = await api.post<InfirmerieAppointment>(`${BASE}${id}/confirm/`);
    return res.data;
  },

  slotsDisponibles: async (date: string): Promise<SlotsResponse> => {
    const res = await api.get<SlotsResponse>(`${BASE}slots-disponibles/`, { params: { date } });
    return res.data;
  },
};
