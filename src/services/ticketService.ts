import axios from "axios";
import { Ticket, TicketCategory, TicketStats } from "@/types/ticket";

import { BASE_URL } from "@/api/baseUrl";
const API = `${BASE_URL}/api/employees/tickets`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

export const ticketService = {
  list: async (params?: { status?: string; category?: string; self_only?: "1" }): Promise<Ticket[]> => {
    const res = await axios.get<Ticket[]>(`${API}/`, { headers: authHeaders(), params });
    return res.data;
  },

  create: async (data: { title: string; description: string; category: TicketCategory }): Promise<Ticket> => {
    const res = await axios.post<Ticket>(`${API}/`, data, { headers: authHeaders() });
    return res.data;
  },

  resolve: async (id: number, resolution_note: string): Promise<Ticket> => {
    const res = await axios.patch<Ticket>(`${API}/${id}/resolve/`, { resolution_note }, { headers: authHeaders() });
    return res.data;
  },

  reopen: async (id: number): Promise<Ticket> => {
    const res = await axios.patch<Ticket>(`${API}/${id}/reopen/`, {}, { headers: authHeaders() });
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API}/${id}/`, { headers: authHeaders() });
  },

  stats: async (): Promise<TicketStats> => {
    const res = await axios.get<TicketStats>(`${API}/stats/`, { headers: authHeaders() });
    return res.data;
  },
};
