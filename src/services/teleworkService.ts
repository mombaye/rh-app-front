import api from "@/api/axios";
import { BASE_URL } from "@/api/baseUrl";

const URL_TT = `${BASE_URL}/api/leaves/telework/`;

export interface TeleworkPeriod {
  id: number;
  start_date: string;
  end_date: string;
  days: number;
  motif: string;
  created_at: string | null;
  is_past: boolean;
}

/** Télétravail défini par la RH depuis « Gérer » (compté comme jours travaillés). */
export const teleworkService = {
  list: async (employeeId: number): Promise<TeleworkPeriod[]> =>
    (await api.get(URL_TT, { params: { employee: employeeId } })).data,
  create: async (data: { employee_id: number; start_date: string; end_date: string; motif?: string }): Promise<TeleworkPeriod> =>
    (await api.post(URL_TT, data)).data,
  remove: async (id: number): Promise<void> => { await api.delete(`${URL_TT}${id}/`); },
};
