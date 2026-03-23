// src/services/leaveService.ts
// URLs alignées avec le router DRF + les @action decorators de views.py

import axios from "axios";
import {
  LeaveType,
  LeaveBalance,
  LeaveBalanceAdjust,
  LeaveBalanceHistory,
  CarryoverResult,
  LeaveRequest,
  LeaveRequestCreate,
  LeaveRequestFilters,
  LeaveSummary,
  LeaveCalendarEntry,
  LeavePlanningEntry,
  AbsenceRateRow,
  ApprovePayload,
  RevokePayload,
  ExportColumnKey,
  PublicHoliday,
  HolidayCheckResult,
  ManagerDelegation,
  ManagerDelegationCreate,
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

  /**
   * POST /api/leaves/balances/bulk_import/
   * Multipart form : { file: File (.xlsx) }
   * Colonnes attendues : MATRICULE | TYPE_CONGE | ACQUIS
   * Retourne : { created: number, updated: number, errors: ImportError[] }
   */
  bulkImport: async (file: File): Promise<{ created: number; updated: number; errors: { row: number; matricule: string; message: string }[] }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await axios.post(`${API}/balances/bulk_import/`, form, {
      headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  /** GET /api/leaves/balances/<id>/history/ — historique des mouvements de solde */
  getHistory: async (balanceId: number): Promise<LeaveBalanceHistory[]> => {
    const res = await axios.get(`${API}/balances/${balanceId}/history/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /**
   * POST /api/leaves/balances/carryover/
   * Body : { year_from, year_to, employee_id? }
   * Reporte les soldes non-utilisés d'une année à l'autre.
   */
  carryover: async (yearFrom: number, yearTo: number, employeeId?: number): Promise<CarryoverResult> => {
    const body: Record<string, number> = { year_from: yearFrom, year_to: yearTo };
    if (employeeId) body.employee_id = employeeId;
    const res = await axios.post(`${API}/balances/carryover/`, body, {
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
   * POST /api/leaves/requests/<id>/validate_document/
   * Marque le justificatif comme validé par le RH.
   * Body optionnel : { validator_id: number }
   */
  validateDocument: async (id: number, validatorId?: number): Promise<LeaveRequest> => {
    const res = await axios.post(
      `${API}/requests/${id}/validate_document/`,
      validatorId ? { validator_id: validatorId } : {},
      { headers: getAuthHeaders() }
    );
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

  /**
   * POST /api/leaves/requests/<id>/mark_as_absent/
   * Le RH marque l'employé comme absent (justificatif non fourni).
   * Body optionnel : { marker_id: number, undo: boolean }
   */
  markAsAbsent: async (
    id: number,
    payload?: { marker_id?: number; undo?: boolean }
  ): Promise<LeaveRequest> => {
    const res = await axios.post(
      `${API}/requests/${id}/mark_as_absent/`,
      payload ?? {},
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  /**
   * GET /api/leaves/requests/?pending_justification=true
   * Retourne tous les congés approuvés dont la justification est requise,
   * la période est terminée, et dont le document n'a pas encore été soumis.
   */
  getPendingJustifications: async (): Promise<LeaveRequest[]> => {
    const res = await axios.get(`${API}/requests/`, {
      headers: getAuthHeaders(),
      params:  { pending_justification: "true" },
    });
    return res.data;
  },

  /**
   * POST /api/leaves/requests/trigger-monthly-credit/
   * Déclenche le crédit mensuel (+2j) pour tous les employés actifs.
   */
  triggerMonthlyCredit: async (): Promise<{ message: string; employees_credited: number }> => {
    const res = await axios.post(
      `${API}/requests/trigger-monthly-credit/`,
      {},
      { headers: getAuthHeaders() }
    );
    return res.data;
  },

  /**
   * GET /api/leaves/requests/export/excel/
   * Export Excel personnalisé : filtres + sélection de colonnes.
   * Retourne un Blob pour téléchargement côté client.
   *
   * @param filters  - Filtres à appliquer (mêmes que getAll)
   * @param columns  - Liste des clés de colonnes à inclure (toutes si vide)
   */
  exportExcel: async (
    filters?: Omit<LeaveRequestFilters, "contract_type">,
    columns?: ExportColumnKey[]
  ): Promise<Blob> => {
    const params: Record<string, string> = {};
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          params[k] = String(v);
        }
      });
    }
    if (columns && columns.length > 0) {
      params.columns = columns.join(",");
    }
    const res = await axios.get(`${API}/requests/export/excel/`, {
      headers: getAuthHeaders(),
      params,
      responseType: "blob",
    });
    return res.data;
  },

  /** GET /api/leaves/requests/stats/absence-rate/?year= */
  getAbsenceRate: async (year?: number): Promise<AbsenceRateRow[]> => {
    const res = await axios.get(`${API}/requests/stats/absence-rate/`, {
      headers: getAuthHeaders(),
      params: year ? { year } : {},
    });
    return res.data;
  },

  /** GET /api/leaves/requests/stats/by-type/?year= */
  statsByType: async (year?: number): Promise<{ leave_type__code: string; leave_type__label: string; leave_type__color: string; total: number; total_days: number }[]> => {
    const res = await axios.get(`${API}/requests/stats/by-type/`, {
      headers: getAuthHeaders(),
      params: year ? { year } : {},
    });
    return res.data;
  },

  /** GET /api/leaves/requests/stats/by-department/?year= */
  statsByDepartment: async (year?: number): Promise<{ employee__service: string; total: number; total_days: number }[]> => {
    const res = await axios.get(`${API}/requests/stats/by-department/`, {
      headers: getAuthHeaders(),
      params: year ? { year } : {},
    });
    return res.data;
  },

  /**
   * GET /api/leaves/requests/planning/?start=&end=&department=
   * Planning prévisionnel des congés approuvés sur une plage de dates.
   */
  getPlanning: async (start: string, end: string, department?: string): Promise<LeavePlanningEntry[]> => {
    const res = await axios.get(`${API}/requests/planning/`, {
      headers: getAuthHeaders(),
      params: { start, end, ...(department ? { department } : {}) },
    });
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PublicHoliday  →  /api/leaves/holidays/
// ─────────────────────────────────────────────────────────────────────────────
export const holidayService = {
  /** GET /api/leaves/holidays/ */
  getAll: async (year?: number): Promise<PublicHoliday[]> => {
    const params: Record<string, string> = {};
    if (year) params.year = String(year);
    const res = await axios.get(`${API}/holidays/`, { headers: getAuthHeaders(), params });
    return res.data;
  },

  /** GET /api/leaves/holidays/for-month/?month=M&year=Y */
  getForMonth: async (month: number, year: number): Promise<PublicHoliday[]> => {
    const res = await axios.get(`${API}/holidays/for-month/`, {
      headers: getAuthHeaders(),
      params: { month, year },
    });
    return res.data;
  },

  /** GET /api/leaves/holidays/for-range/?start=&end= */
  getForRange: async (start: string, end: string): Promise<PublicHoliday[]> => {
    const res = await axios.get(`${API}/holidays/for-range/`, {
      headers: getAuthHeaders(),
      params: { start, end },
    });
    return res.data;
  },

  /** POST /api/leaves/holidays/check-days/ */
  checkDays: async (startDate: string, endDate: string): Promise<HolidayCheckResult> => {
    const res = await axios.post(
      `${API}/holidays/check-days/`,
      { start_date: startDate, end_date: endDate },
      { headers: getAuthHeaders() },
    );
    return res.data;
  },

  /** POST /api/leaves/holidays/ */
  create: async (data: Omit<PublicHoliday, "id">): Promise<PublicHoliday> => {
    const res = await axios.post(`${API}/holidays/`, data, { headers: getAuthHeaders() });
    return res.data;
  },

  /** PATCH /api/leaves/holidays/<id>/ */
  update: async (id: number, data: Partial<PublicHoliday>): Promise<PublicHoliday> => {
    const res = await axios.patch(`${API}/holidays/${id}/`, data, { headers: getAuthHeaders() });
    return res.data;
  },

  /** DELETE /api/leaves/holidays/<id>/ */
  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API}/holidays/${id}/`, { headers: getAuthHeaders() });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ManagerDelegation  →  /api/leaves/delegations/
// ─────────────────────────────────────────────────────────────────────────────
export const managerDelegationService = {
  /** GET /api/leaves/delegations/ */
  getAll: async (params?: { delegator_id?: number; delegate_id?: number; active_only?: boolean }): Promise<ManagerDelegation[]> => {
    const res = await axios.get(`${API}/delegations/`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  },

  /** GET /api/leaves/delegations/<id>/ */
  getById: async (id: number): Promise<ManagerDelegation> => {
    const res = await axios.get(`${API}/delegations/${id}/`, { headers: getAuthHeaders() });
    return res.data;
  },

  /** POST /api/leaves/delegations/ */
  create: async (data: ManagerDelegationCreate): Promise<ManagerDelegation> => {
    const res = await axios.post(`${API}/delegations/`, data, { headers: getAuthHeaders() });
    return res.data;
  },

  /** PATCH /api/leaves/delegations/<id>/ */
  update: async (id: number, data: Partial<ManagerDelegationCreate>): Promise<ManagerDelegation> => {
    const res = await axios.patch(`${API}/delegations/${id}/`, data, { headers: getAuthHeaders() });
    return res.data;
  },

  /** DELETE /api/leaves/delegations/<id>/ */
  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API}/delegations/${id}/`, { headers: getAuthHeaders() });
  },

  /** POST /api/leaves/delegations/<id>/deactivate/ */
  deactivate: async (id: number): Promise<ManagerDelegation> => {
    const res = await axios.post(`${API}/delegations/${id}/deactivate/`, {}, { headers: getAuthHeaders() });
    return res.data;
  },

  /** GET /api/leaves/delegations/active-for/<managerId>/ */
  getActiveFor: async (managerId: number): Promise<{ delegate: { id: number; full_name: string; email: string } | null; delegation: ManagerDelegation | null }> => {
    const res = await axios.get(`${API}/delegations/active-for/${managerId}/`, { headers: getAuthHeaders() });
    return res.data;
  },
};

// Re-export leaveHolidayService alias for backward compatibility
export const leaveHolidayService = holidayService;

// Re-export leaveApprovalRuleService
export const leaveApprovalRuleService = {
  getAll: async (): Promise<import("../types/leave").ApprovalRule[]> => {
    const res = await axios.get(`${API}/approval-rules/`, { headers: getAuthHeaders() });
    return res.data;
  },
  create: async (data: import("../types/leave").ApprovalRuleCreate): Promise<import("../types/leave").ApprovalRule> => {
    const res = await axios.post(`${API}/approval-rules/`, data, { headers: getAuthHeaders() });
    return res.data;
  },
  update: async (id: number, data: Partial<import("../types/leave").ApprovalRuleCreate>): Promise<import("../types/leave").ApprovalRule> => {
    const res = await axios.patch(`${API}/approval-rules/${id}/`, data, { headers: getAuthHeaders() });
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API}/approval-rules/${id}/`, { headers: getAuthHeaders() });
  },
  getActive: async (): Promise<import("../types/leave").ApprovalRule[]> => {
    const res = await axios.get(`${API}/approval-rules/active/`, { headers: getAuthHeaders() });
    return res.data;
  },
  checkRules: async (employeeId: number, leaveTypeId: number, days: number) => {
    const res = await axios.post(`${API}/approval-rules/check/`, { employee_id: employeeId, leave_type_id: leaveTypeId, days }, { headers: getAuthHeaders() });
    return res.data;
  },
};
