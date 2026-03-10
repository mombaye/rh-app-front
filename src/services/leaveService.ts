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
  ApprovePayload,
  RevokePayload,
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
    const res = await axios.get(`${API}/types`, {
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
  /**
   * GET /api/leaves/balances/
   * Query params : year, employee_id  (via get_queryset)
   */
  getAll: async (year?: number): Promise<LeaveBalance[]> => {
    const params: Record<string, string> = {};
    if (year) params.year = String(year);
    const res = await axios.get(`${API}/balances/`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  },

  /**
   * GET /api/leaves/balances/employee/<employeeId>/
   * Route déclarée dans urls.py : balances/employee/<int:employee_id>/
   * Query param optionnel : year
   */
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

  /**
   * PATCH /api/leaves/balances/<id>/adjust/
   * Body : { adjusted: number }
   * Enregistré par le router via @action(detail=True, url_path="adjust")
   */
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
   * Query params supportés par get_queryset() :
   *   status, employee_id, leave_type_id, start_date, end_date, department
   *
   * contract_type retiré des params (pas de filtre Django sur ce champ)
   */
  getAll: async (filters?: LeaveRequestFilters): Promise<LeaveRequest[]> => {
    // On extrait contract_type pour ne pas l'envoyer à Django
    const { contract_type, ...apiFilters } = filters ?? {};
    void contract_type; // utilisé uniquement pour le routing frontend

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

  /**
   * GET /api/leaves/requests/employee/<employeeId>/
   * Route déclarée dans urls.py : requests/employee/<int:employee_id>/
   * Query param optionnel : status
   */
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

  /**
   * POST /api/leaves/requests/
   * Body (LeaveRequestCreateSerializer) :
   *   employee_id, leave_type_id, start_date, end_date, days, motif
   *
   * Validations backend :
   *   1. end_date >= start_date
   *   2. Pas de doublon sur la période (PENDING/APPROVED)
   *   3. Solde suffisant si leave_type.is_paid
   */
  create: async (data: LeaveRequestCreate): Promise<LeaveRequest> => {
    const res = await axios.post(`${API}/requests/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /** PATCH /api/leaves/requests/<id>/ */
  update: async (
    id: number,
    data: Partial<LeaveRequestCreate>
  ): Promise<LeaveRequest> => {
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
   * Body optionnel :
   *   - reviewer_id        : ID employé validateur
   *   - second_approver_id : si présent → passe en PENDING_SECOND
   */
  approve: async (id: number, payload?: ApprovePayload): Promise<LeaveRequest> => {
    const res = await axios.post(
      `${API}/requests/${id}/approve/`,
      payload ?? {},
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/reject/
   * Enregistré par le router via @action(detail=True, url_path="reject")
   * Body : { reject_reason: string }
   * Backend : status → REJECTED, stocke reject_reason
   */
  reject: async (id: number, reject_reason: string): Promise<LeaveRequest> => {
    const res = await axios.post(
      `${API}/requests/${id}/reject/`,
      { reject_reason },
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/cancel/
   * Enregistré par le router via @action(detail=True, url_path="cancel")
   * Backend : si APPROVED → restaure balance.taken, status → CANCELLED
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
   * GET /api/leaves/requests/calendar/?month=M&year=Y
   * Route manuelle dans urls.py : path('calendar/', ...)
   * Retourne les absences APPROVED du mois
   */
  getCalendar: async (month: number, year: number): Promise<LeaveCalendarEntry[]> => {
    const res = await axios.get(`${API}/requests/calendar/`, {
      headers: getAuthHeaders(),
      params:  { month, year },
    });
    return res.data;
  },

  /**
   * GET /api/leaves/requests/stats/summary/
   * Retourne : total, pending, approved, rejected, cancelled, revoked, total_days_approved
   */
  getSummary: async (): Promise<LeaveSummary> => {
    const res = await axios.get(`${API}/requests/stats/summary/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /**
   * PATCH /api/leaves/requests/<id>/ — modifie une demande PENDING
   */
  updatePending: async (id: number, data: Partial<LeaveRequestCreate>): Promise<LeaveRequest> => {
    const res = await axios.patch(`${API}/requests/${id}/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/upload_document/
   * Multipart: champ 'document' (PDF/image, max 5 Mo)
   */
  uploadDocument: async (id: number, file: File): Promise<LeaveRequest> => {
    const form = new FormData();
    form.append("document", file);
    const res = await axios.post(`${API}/requests/${id}/upload_document/`, form, {
      headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/revoke/
   * Body : { revoke_reason, revoker_id?, recall_date? }
   * Révoque un congé approuvé (rappel d'urgence) et restitue les jours restants.
   */
  revoke: async (id: number, payload: RevokePayload): Promise<LeaveRequest & { days_restored: string }> => {
    const res = await axios.post(
      `${API}/requests/${id}/revoke/`,
      payload,
      { headers: getAuthHeaders() }
    );
    return res.data;
  },
};