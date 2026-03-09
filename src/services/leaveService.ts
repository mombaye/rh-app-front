// src/services/leaveService.ts
// Utilise l'instance axios partagée (token refresh automatique, baseURL, intercepteurs)

import api from "@/api/axios";
import {
  LeaveType,
  LeaveBalance,
  LeaveBalanceAdjust,
  LeaveRequest,
  LeaveRequestCreate,
  LeaveRequestFilters,
  LeaveSummary,
  LeaveCalendarEntry,
} from "../types/leave";

// ─────────────────────────────────────────────────────────────────────────────
// LeaveType  →  /api/leaves/types/
// ─────────────────────────────────────────────────────────────────────────────
export const leaveTypeService = {
  /** GET /api/leaves/types/ */
  getAll: async (): Promise<LeaveType[]> => {
    const res = await api.get("/api/leaves/types/");
    return res.data;
  },

  /** POST /api/leaves/types/ */
  create: async (data: Partial<LeaveType>): Promise<LeaveType> => {
    const res = await api.post("/api/leaves/types/", data);
    return res.data;
  },

  /** PATCH /api/leaves/types/<id>/ */
  update: async (id: number, data: Partial<LeaveType>): Promise<LeaveType> => {
    const res = await api.patch(`/api/leaves/types/${id}/`, data);
    return res.data;
  },

  /** DELETE /api/leaves/types/<id>/ */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/leaves/types/${id}/`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LeaveBalance  →  /api/leaves/balances/
// ─────────────────────────────────────────────────────────────────────────────
export const leaveBalanceService = {
  /**
   * GET /api/leaves/balances/?year=Y&employee_id=X
   */
  getAll: async (year?: number): Promise<LeaveBalance[]> => {
    const params: Record<string, string> = {};
    if (year) params.year = String(year);
    const res = await api.get("/api/leaves/balances/", { params });
    return res.data;
  },

  /**
   * Vérifie si un solde existe pour employé + type + année
   * Retourne le solde ou null
   */
  checkBalance: async (
    employeeId: number,
    leaveTypeId: number,
    year: number
  ): Promise<LeaveBalance | null> => {
    const res = await api.get("/api/leaves/balances/", {
      params: { employee_id: employeeId, year },
    });
    const list: LeaveBalance[] = res.data;
    return list.find((b) => b.leave_type.id === leaveTypeId) ?? null;
  },

  /** GET /api/leaves/balances/employee/<employeeId>/ */
  getByEmployee: async (employeeId: number, year?: number): Promise<LeaveBalance[]> => {
    const params: Record<string, string> = {};
    if (year) params.year = String(year);
    const res = await api.get(`/api/leaves/balances/employee/${employeeId}/`, { params });
    return res.data;
  },

  /** POST /api/leaves/balances/ */
  create: async (data: Partial<LeaveBalance>): Promise<LeaveBalance> => {
    const res = await api.post("/api/leaves/balances/", data);
    return res.data;
  },

  /** PATCH /api/leaves/balances/<id>/adjust/ */
  adjust: async (id: number, data: LeaveBalanceAdjust): Promise<LeaveBalance> => {
    const res = await api.patch(`/api/leaves/balances/${id}/adjust/`, data);
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LeaveRequest  →  /api/leaves/requests/
// ─────────────────────────────────────────────────────────────────────────────
export const leaveRequestService = {
  /**
   * GET /api/leaves/requests/
   * Filtres supportés : status, employee_id, leave_type_id, start_date, end_date, department
   */
  getAll: async (filters?: LeaveRequestFilters): Promise<LeaveRequest[]> => {
    const { contract_type, ...apiFilters } = filters ?? {};
    void contract_type; // filtre frontend uniquement
    const res = await api.get("/api/leaves/requests/", { params: apiFilters });
    return res.data;
  },

  /** GET /api/leaves/requests/<id>/ */
  getById: async (id: number): Promise<LeaveRequest> => {
    const res = await api.get(`/api/leaves/requests/${id}/`);
    return res.data;
  },

  /** GET /api/leaves/requests/employee/<employeeId>/ */
  getByEmployee: async (
    employeeId: number,
    filters?: Pick<LeaveRequestFilters, "status">
  ): Promise<LeaveRequest[]> => {
    const res = await api.get(`/api/leaves/requests/employee/${employeeId}/`, {
      params: filters,
    });
    return res.data;
  },

  /** POST /api/leaves/requests/ */
  create: async (data: LeaveRequestCreate): Promise<LeaveRequest> => {
    const res = await api.post("/api/leaves/requests/", data);
    return res.data;
  },

  /** PATCH /api/leaves/requests/<id>/ */
  update: async (id: number, data: Partial<LeaveRequestCreate>): Promise<LeaveRequest> => {
    const res = await api.patch(`/api/leaves/requests/${id}/`, data);
    return res.data;
  },

  /** DELETE /api/leaves/requests/<id>/ */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/leaves/requests/${id}/`);
  },

  /** POST /api/leaves/requests/<id>/approve/ */
  approve: async (id: number): Promise<LeaveRequest> => {
    const res = await api.post(`/api/leaves/requests/${id}/approve/`);
    return res.data;
  },

  /** POST /api/leaves/requests/<id>/reject/ */
  reject: async (id: number, reject_reason: string): Promise<LeaveRequest> => {
    const res = await api.post(`/api/leaves/requests/${id}/reject/`, { reject_reason });
    return res.data;
  },

  /** POST /api/leaves/requests/<id>/cancel/ */
  cancel: async (id: number): Promise<LeaveRequest> => {
    const res = await api.post(`/api/leaves/requests/${id}/cancel/`);
    return res.data;
  },

  /** GET /api/leaves/requests/calendar/?month=M&year=Y */
  getCalendar: async (month: number, year: number): Promise<LeaveCalendarEntry[]> => {
    const res = await api.get("/api/leaves/requests/calendar/", { params: { month, year } });
    return res.data;
  },

  /** GET /api/leaves/requests/stats/summary/ */
  getSummary: async (): Promise<LeaveSummary> => {
    const res = await api.get("/api/leaves/requests/stats/summary/");
    return res.data;
  },
};
