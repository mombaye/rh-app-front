// src/services/leaveService.ts
// URLs alignées avec le router DRF + les @action decorators de views.py

import axios from "axios";
import {
  LeaveType,
  LeaveBalance,
  LeaveBalanceAdjust,
  LeaveRequest,
  LeaveRequestCreate,
  LeaveRequestFilters,
  LeaveSummary,
  LeaveCalendarEntry,
  LeaveTypeStatRow,
  LeaveDeptStatRow,
  ApproveLeaveData,
  RevokeLeaveData,
} from "../types/leave";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
const API      = `${BASE_URL}/api/leaves`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("access_token");
  return { Authorization: `Bearer ${token}` };
};

// ─────────────────────────────────────────────────────────────────────────────
// LeaveType  →  /api/leaves/types/
// ─────────────────────────────────────────────────────────────────────────────
export const leaveTypeService = {
  /** GET /api/leaves/types/ */
  getAll: async (): Promise<LeaveType[]> => {
    const res = await axios.get(`${API}/types/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /** POST /api/leaves/types/ */
  create: async (data: Partial<LeaveType>): Promise<LeaveType> => {
    const res = await axios.post(`${API}/types/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /** PATCH /api/leaves/types/<id>/ */
  update: async (id: number, data: Partial<LeaveType>): Promise<LeaveType> => {
    const res = await axios.patch(`${API}/types/${id}/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /** DELETE /api/leaves/types/<id>/ */
  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API}/types/${id}/`, {
      headers: getAuthHeaders(),
    });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LeaveBalance  →  /api/leaves/balances/
// ─────────────────────────────────────────────────────────────────────────────
export const leaveBalanceService = {
  /** GET /api/leaves/balances/?year=Y&employee_id=X */
  getAll: async (year?: number): Promise<LeaveBalance[]> => {
    const params: Record<string, string> = {};
    if (year) params.year = String(year);
    const res = await axios.get(`${API}/balances/`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  },

  /** GET /api/leaves/balances/employee/<id>/?year=Y */
  getByEmployee: async (employeeId: number, year?: number): Promise<LeaveBalance[]> => {
    const params: Record<string, string> = {};
    if (year) params.year = String(year);
    const res = await axios.get(`${API}/balances/employee/${employeeId}/`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  },

  /** POST /api/leaves/balances/ */
  create: async (data: Partial<LeaveBalance>): Promise<LeaveBalance> => {
    const res = await axios.post(`${API}/balances/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /** PATCH /api/leaves/balances/<id>/adjust/  body: { adjusted } */
  adjust: async (id: number, data: LeaveBalanceAdjust): Promise<LeaveBalance> => {
    const res = await axios.patch(`${API}/balances/${id}/adjust/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LeaveRequest  →  /api/leaves/requests/
// ─────────────────────────────────────────────────────────────────────────────
export const leaveRequestService = {
  /**
   * GET /api/leaves/requests/
   * contract_type retiré des params (pas de filtre Django sur ce champ)
   */
  getAll: async (filters?: LeaveRequestFilters): Promise<LeaveRequest[]> => {
    const { contract_type, ...apiFilters } = filters ?? {};
    void contract_type;

    const res = await axios.get(`${API}/requests/`, {
      headers: getAuthHeaders(),
      params:  apiFilters,
    });
    return res.data;
  },

  /** GET /api/leaves/requests/<id>/ */
  getById: async (id: number): Promise<LeaveRequest> => {
    const res = await axios.get(`${API}/requests/${id}/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /** GET /api/leaves/requests/employee/<id>/?status=X */
  getByEmployee: async (
    employeeId: number,
    filters?: Pick<LeaveRequestFilters, "status">
  ): Promise<LeaveRequest[]> => {
    const res = await axios.get(`${API}/requests/employee/${employeeId}/`, {
      headers: getAuthHeaders(),
      params:  filters,
    });
    return res.data;
  },

  /** POST /api/leaves/requests/ */
  create: async (data: LeaveRequestCreate): Promise<LeaveRequest> => {
    const res = await axios.post(`${API}/requests/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /** PATCH /api/leaves/requests/<id>/ */
  update: async (id: number, data: Partial<LeaveRequestCreate>): Promise<LeaveRequest> => {
    const res = await axios.patch(`${API}/requests/${id}/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /** DELETE /api/leaves/requests/<id>/ */
  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API}/requests/${id}/`, {
      headers: getAuthHeaders(),
    });
  },

  /**
   * POST /api/leaves/requests/<id>/approve/
   * - Sans second_approver_id → approbation directe (APPROVED)
   * - Avec second_approver_id → bascule en PENDING_SECOND + notifie 2ème approbateur
   * - reviewer_id (optionnel) : ID de l'employé qui approuve
   */
  approve: async (id: number, data?: ApproveLeaveData): Promise<LeaveRequest> => {
    const res = await axios.post(
      `${API}/requests/${id}/approve/`,
      data ?? {},
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/reject/
   * Body : { reject_reason, reviewer_id? }
   */
  reject: async (
    id: number,
    reject_reason: string,
    reviewer_id?: number
  ): Promise<LeaveRequest> => {
    const res = await axios.post(
      `${API}/requests/${id}/reject/`,
      { reject_reason, ...(reviewer_id ? { reviewer_id } : {}) },
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/cancel/
   * Si APPROVED → restaure balance.taken, status → CANCELLED
   */
  cancel: async (id: number): Promise<LeaveRequest> => {
    const res = await axios.post(
      `${API}/requests/${id}/cancel/`,
      {},
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/revoke/
   * Rappel d'urgence : révoque un congé approuvé et restitue les jours restants.
   * Body : { revoke_reason, revoker_id?, recall_date? }
   */
  revoke: async (id: number, data: RevokeLeaveData): Promise<LeaveRequest & { days_restored: string }> => {
    const res = await axios.post(
      `${API}/requests/${id}/revoke/`,
      data,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  // ── Calendrier ─────────────────────────────────────────────────────────────

  /** GET /api/leaves/requests/calendar/?month=M&year=Y */
  getCalendar: async (month: number, year: number): Promise<LeaveCalendarEntry[]> => {
    const res = await axios.get(`${API}/requests/calendar/`, {
      headers: getAuthHeaders(),
      params:  { month, year },
    });
    return res.data;
  },

  // ── Statistiques ───────────────────────────────────────────────────────────

  /** GET /api/leaves/requests/stats/summary/ */
  getSummary: async (year?: number): Promise<LeaveSummary> => {
    const params: Record<string, string> = {};
    if (year) params.year = String(year);
    const res = await axios.get(`${API}/requests/stats/summary/`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  },

  /** GET /api/leaves/requests/stats/by-type/ */
  getStatsByType: async (year?: number): Promise<LeaveTypeStatRow[]> => {
    const params: Record<string, string> = {};
    if (year) params.year = String(year);
    const res = await axios.get(`${API}/requests/stats/by-type/`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  },

  /** GET /api/leaves/requests/stats/by-department/ */
  getStatsByDepartment: async (year?: number): Promise<LeaveDeptStatRow[]> => {
    const params: Record<string, string> = {};
    if (year) params.year = String(year);
    const res = await axios.get(`${API}/requests/stats/by-department/`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  },

  // ── Export Excel ───────────────────────────────────────────────────────────

  /**
   * GET /api/leaves/requests/export/excel/
   * Déclenche le téléchargement du fichier Excel via une nouvelle fenêtre.
   */
  downloadExcel: (): void => {
    const token = localStorage.getItem("access_token");
    const url = `${API}/requests/export/excel/`;
    // Ouvre via fetch pour inclure le token Bearer
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        const now = new Date();
        const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        a.download = `conges_${ts}.xlsx`;
        a.click();
        URL.revokeObjectURL(href);
      });
  },

  // ── Accrual mensuel manuel (admin) ─────────────────────────────────────────

  /** POST /api/leaves/requests/trigger-monthly-credit/ */
  triggerMonthlyCredit: async (): Promise<{ task_id: string; message: string }> => {
    const res = await axios.post(
      `${API}/requests/trigger-monthly-credit/`,
      {},
      { headers: getAuthHeaders() }
    );
    return res.data;
  },
};
