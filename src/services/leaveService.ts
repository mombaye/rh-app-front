// src/services/leaveService.ts
// URLs alignées avec le router DRF + les @action decorators de views.py

import api from "@/api/axios";
import {
  LeaveType,
  LeaveBalance,
  LeaveBalanceAdjust,
  LeaveBalanceHistory,
  CarryoverResult,
  MigrationImportResult,
  LeaveRequest,
  LeaveRequestCreate,
  LeaveRequestFilters,
  LeaveSummary,
  LeaveCalendarEntry,
  LeavePlanningEntry,
  AbsenceRateRow,
  ApprovalChainInfo,
  ApprovePayload,
  RevokePayload,
  ExportColumnKey,
  PublicHoliday,
  HolidayCheckResult,
  ManagerDelegation,
  ManagerDelegationCreate,
  ExitAuthorization,
  ExitAuthorizationCreate,
  ExitAuthorizationFilters,
} from "../types/leave";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
const API      = `${BASE_URL}/api/leaves`;

// ─────────────────────────────────────────────────────────────────────────────
// LeaveType  →  /api/leaves/types/
// ─────────────────────────────────────────────────────────────────────────────
export const leaveTypeService = {
  /** GET /api/leaves/types/ */
  getAll: async (): Promise<LeaveType[]> => {
    const res = await api.get(`${API}/types`, {
      });
    return res.data;
  },

  /** POST /api/leaves/types/ */
  create: async (data: Partial<LeaveType>): Promise<LeaveType> => {
    const res = await api.post(`${API}/types/`, data, {
      });
    return res.data;
  },

  /** PATCH /api/leaves/types/<id>/ */
  update: async (id: number, data: Partial<LeaveType>): Promise<LeaveType> => {
    const res = await api.patch(`${API}/types/${id}/`, data, {
      });
    return res.data;
  },

  /** DELETE /api/leaves/types/<id>/ */
  delete: async (id: number): Promise<void> => {
    await api.delete(`${API}/types/${id}/`, {
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
    const res = await api.get(`${API}/balances/`, {
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
    const res = await api.get(`${API}/balances/employee/${employeeId}/`, {
      params,
    });
    return res.data;
  },

  /** POST /api/leaves/balances/ */
  create: async (data: Partial<LeaveBalance>): Promise<LeaveBalance> => {
    const res = await api.post(`${API}/balances/`, data, {
      });
    return res.data;
  },

  /**
   * PATCH /api/leaves/balances/<id>/adjust/
   * Body : { adjusted: number }
   * Enregistré par le router via @action(detail=True, url_path="adjust")
   */
  adjust: async (id: number, data: LeaveBalanceAdjust): Promise<LeaveBalance> => {
    const res = await api.patch(`${API}/balances/${id}/adjust/`, data, {
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
    const res = await api.post(`${API}/balances/bulk_import/`, form, {
      });
    return res.data;
  },

  /**
   * POST /api/leaves/balances/migration_import/
   * Import souple depuis une autre plateforme (colonnes auto-détectées).
   * dry_run=true → prévisualisation sans enregistrement.
   */
  migrationImport: async (
    file: File,
    opts: { dry_run?: boolean; year?: number; leave_type_code?: string }
  ): Promise<MigrationImportResult> => {
    const form = new FormData();
    form.append("file", file);
    form.append("dry_run", opts.dry_run ? "true" : "false");
    if (opts.year)            form.append("year",            String(opts.year));
    if (opts.leave_type_code) form.append("leave_type_code", opts.leave_type_code);
    const res = await api.post(`${API}/balances/migration_import/`, form, {
      // L'instance `api` force Content-Type: application/json par défaut,
      // ce qui empêche axios d'envoyer un vrai multipart/form-data (le
      // fichier arrive alors vide côté backend). On le réinitialise pour
      // qu'axios/le navigateur génère le bon Content-Type + boundary.
      headers: { "Content-Type": undefined },
    });
    return res.data;
  },

  /**
   * POST /api/leaves/balances/migration_apply/
   * Applique directement (sans fichier) des changements de soldes édités sur la
   * page Migration — utilisé par le bouton "Synchroniser" après modification
   * manuelle des valeurs dans le tableau.
   */
  migrationApply: async (
    rows: {
      matricule: string;
      poste?: string;
      date_embauche?: string;
      solde_anterieur: number;
      acquired_override?: number;
      taken_override?: number;
    }[],
    opts: { year?: number; leave_type_code?: string }
  ): Promise<{ processed: number; errors_count: number; results: any[] }> => {
    const body: Record<string, any> = { rows };
    if (opts.year)            body.year            = opts.year;
    if (opts.leave_type_code) body.leave_type_code = opts.leave_type_code;
    const res = await api.post(`${API}/balances/migration_apply/`, body);
    return res.data;
  },

  /**
   * GET /api/leaves/balances/migration_snapshot/?year=2026
   * Génère la vue migration depuis la base de données sans import de fichier.
   * Retourne tous les employés non-intérimaires avec leurs soldes calculés.
   */
  migrationSnapshot: async (year: number): Promise<{ processed: number; errors_count: number; results: any[] }> => {
    const res = await api.get(`${API}/balances/migration_snapshot/`, { params: { year } });
    return res.data;
  },

  /** GET /api/leaves/balances/<id>/history/ — historique des mouvements de solde */
  getHistory: async (balanceId: number): Promise<LeaveBalanceHistory[]> => {
    const res = await api.get(`${API}/balances/${balanceId}/history/`, {
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
    const res = await api.post(`${API}/balances/carryover/`, body, {
      });
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MigrationSession  →  /api/leaves/migration-session/
// ─────────────────────────────────────────────────────────────────────────────

export interface MigrationSessionData {
  year:       number;
  filename:   string;
  synced:     boolean;
  rows:       any[];
  updated_at: string;
  updated_by: string | null;
}

export const migrationSessionService = {
  get: async (year: number): Promise<MigrationSessionData | null> => {
    const res = await api.get(`${API}/migration-session/`, {
      params: { year },
    });
    return res.data;
  },

  save: async (data: { year: number; filename: string; synced: boolean; rows: any[] }): Promise<MigrationSessionData> => {
    const res = await api.post(`${API}/migration-session/`, data, {
      });
    return res.data;
  },

  clear: async (year: number): Promise<void> => {
    await api.delete(`${API}/migration-session/`, {
      params: { year },
    });
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

    const res = await api.get(`${API}/requests/`, {
      params:  apiFilters,
    });
    return res.data;
  },

  /** GET /api/leaves/requests/<id>/ */
  getById: async (id: number): Promise<LeaveRequest> => {
    const res = await api.get(`${API}/requests/${id}/`, {
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
    const res = await api.get(`${API}/requests/employee/${employeeId}/`, {
      params:  filters,
    });
    return res.data;
  },

  /**
   * GET /api/leaves/requests/approval-chain/<employeeId>/
   * Retourne la chaîne de validation applicable pour cet employé
   * (hiérarchie N+1/N+2 ou DG pour les responsables de département).
   */
  getApprovalChain: async (employeeId: number): Promise<ApprovalChainInfo> => {
    const res = await api.get(`${API}/requests/approval-chain/${employeeId}/`, {
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
    const res = await api.post(`${API}/requests/`, data, {
      });
    return res.data;
  },

  /** PATCH /api/leaves/requests/<id>/ */
  update: async (
    id: number,
    data: Partial<LeaveRequestCreate>
  ): Promise<LeaveRequest> => {
    const res = await api.patch(`${API}/requests/${id}/`, data, {
      });
    return res.data;
  },

  /** DELETE /api/leaves/requests/<id>/ */
  delete: async (id: number): Promise<void> => {
    await api.delete(`${API}/requests/${id}/`, {
      });
  },

  /**
   * POST /api/leaves/requests/<id>/approve/
   * Body optionnel :
   *   - reviewer_id        : ID employé validateur
   *   - second_approver_id : si présent → passe en PENDING_SECOND
   */
  approve: async (id: number, payload?: ApprovePayload): Promise<LeaveRequest> => {
    const res = await api.post(
      `${API}/requests/${id}/approve/`,
      payload ?? {},
      {}
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
    const res = await api.post(
      `${API}/requests/${id}/reject/`,
      { reject_reason },
      {}
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/cancel/
   * Body optionnel : { canceller_id: number }
   * Pour les congés APPROVED, seul le RH peut annuler (canceller_id requis).
   */
  cancel: async (id: number, cancellerId?: number): Promise<LeaveRequest> => {
    const res = await api.post(
      `${API}/requests/${id}/cancel/`,
      cancellerId ? { canceller_id: cancellerId } : {},
      {}
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/recalculate-chains/
   * Recalcule pending_approver_id pour toutes les demandes PENDING en attente.
   * À appeler après une mise à jour de la hiérarchie (n1_manager ou département).
   */
  recalculateChains: async (): Promise<{ message: string }> => {
    const res = await api.post(
      `${API}/requests/recalculate-chains/`,
      {},
      {}
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/reminder/
   * L'employé relance le manager qui n'a pas encore validé.
   */
  sendReminder: async (id: number): Promise<{ message: string }> => {
    const res = await api.post(
      `${API}/requests/${id}/reminder/`,
      {},
      {}
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/hr_validate/
   * Validation finale RH : PENDING_RH → APPROVED (déclenche déduction solde)
   */
  hrValidate: async (id: number, hr_reviewer_id?: number): Promise<LeaveRequest> => {
    const res = await api.post(
      `${API}/requests/${id}/hr_validate/`,
      hr_reviewer_id ? { hr_reviewer_id } : {},
      {}
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/hr_reject/
   * Rejet final RH : PENDING_RH → REJECTED
   */
  hrReject: async (id: number, reject_reason: string, hr_reviewer_id?: number): Promise<LeaveRequest> => {
    const res = await api.post(
      `${API}/requests/${id}/hr_reject/`,
      { reject_reason, ...(hr_reviewer_id ? { hr_reviewer_id } : {}) },
      {}
    );
    return res.data;
  },

  /**
   * GET /api/leaves/requests/calendar/?month=M&year=Y
   * Route manuelle dans urls.py : path('calendar/', ...)
   * Retourne les absences APPROVED du mois
   */
  getCalendar: async (month: number, year: number): Promise<LeaveCalendarEntry[]> => {
    const res = await api.get(`${API}/requests/calendar/`, {
      params:  { month, year },
    });
    return res.data;
  },

  /**
   * GET /api/leaves/requests/stats/summary/
   * Retourne : total, pending, approved, rejected, cancelled, revoked, total_days_approved
   */
  getSummary: async (): Promise<LeaveSummary> => {
    const res = await api.get(`${API}/requests/stats/summary/`, {
      });
    return res.data;
  },

  /**
   * PATCH /api/leaves/requests/<id>/ — modifie une demande PENDING
   */
  updatePending: async (id: number, data: Partial<LeaveRequestCreate>): Promise<LeaveRequest> => {
    const res = await api.patch(`${API}/requests/${id}/`, data, {
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
    const res = await api.post(`${API}/requests/${id}/upload_document/`, form, {
      });
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/validate_document/
   * Marque le justificatif comme validé par le RH.
   * Body optionnel : { validator_id: number }
   */
  validateDocument: async (id: number, validatorId?: number): Promise<LeaveRequest> => {
    const res = await api.post(
      `${API}/requests/${id}/validate_document/`,
      validatorId ? { validator_id: validatorId } : {},
      {}
    );
    return res.data;
  },

  /**
   * POST /api/leaves/requests/<id>/revoke/
   * Body : { revoke_reason, revoker_id?, recall_date? }
   * Révoque un congé approuvé (rappel d'urgence) et restitue les jours restants.
   */
  revoke: async (id: number, payload: RevokePayload): Promise<LeaveRequest & { days_restored: string }> => {
    const res = await api.post(
      `${API}/requests/${id}/revoke/`,
      payload,
      {}
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
    const res = await api.post(
      `${API}/requests/${id}/mark_as_absent/`,
      payload ?? {},
      {}
    );
    return res.data;
  },

  /**
   * GET /api/leaves/requests/?pending_justification=true
   * Retourne tous les congés approuvés dont la justification est requise,
   * la période est terminée, et dont le document n'a pas encore été soumis.
   */
  getPendingJustifications: async (): Promise<LeaveRequest[]> => {
    const res = await api.get(`${API}/requests/`, {
      params:  { pending_justification: "true" },
    });
    return res.data;
  },

  /**
   * POST /api/leaves/requests/trigger-monthly-credit/
   * Déclenche le crédit mensuel (+2j) pour tous les employés actifs.
   */
  triggerMonthlyCredit: async (): Promise<{ message: string; employees_credited: number }> => {
    const res = await api.post(
      `${API}/requests/trigger-monthly-credit/`,
      {},
      {}
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
    const res = await api.get(`${API}/requests/export/excel/`, {
      params,
      responseType: "blob",
    });
    return res.data;
  },

  /** GET /api/leaves/requests/stats/absence-rate/?year= */
  getAbsenceRate: async (year?: number): Promise<AbsenceRateRow[]> => {
    const res = await api.get(`${API}/requests/stats/absence-rate/`, {
      params: year ? { year } : {},
    });
    return res.data;
  },

  /** GET /api/leaves/requests/stats/by-type/?year= */
  statsByType: async (year?: number): Promise<{ leave_type__code: string; leave_type__label: string; leave_type__color: string; total: number; total_days: number }[]> => {
    const res = await api.get(`${API}/requests/stats/by-type/`, {
      params: year ? { year } : {},
    });
    return res.data;
  },

  /** GET /api/leaves/requests/stats/by-department/?year= */
  statsByDepartment: async (year?: number): Promise<{ employee__service: string; total: number; total_days: number }[]> => {
    const res = await api.get(`${API}/requests/stats/by-department/`, {
      params: year ? { year } : {},
    });
    return res.data;
  },

  /**
   * GET /api/leaves/requests/planning/?start=&end=&department=
   * Planning prévisionnel des congés approuvés sur une plage de dates.
   */
  getPlanning: async (start: string, end: string, department?: string): Promise<LeavePlanningEntry[]> => {
    const res = await api.get(`${API}/requests/planning/`, {
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
    const res = await api.get(`${API}/holidays/`, { params });
    return res.data;
  },

  /** GET /api/leaves/holidays/for-month/?month=M&year=Y */
  getForMonth: async (month: number, year: number): Promise<PublicHoliday[]> => {
    const res = await api.get(`${API}/holidays/for-month/`, {
      params: { month, year },
    });
    return res.data;
  },

  /** GET /api/leaves/holidays/for-range/?start=&end= */
  getForRange: async (start: string, end: string): Promise<PublicHoliday[]> => {
    const res = await api.get(`${API}/holidays/for-range/`, {
      params: { start, end },
    });
    return res.data;
  },

  /** POST /api/leaves/holidays/check-days/ */
  checkDays: async (startDate: string, endDate: string, leaveTypeId?: string | number): Promise<HolidayCheckResult> => {
    const body: Record<string, unknown> = { start_date: startDate, end_date: endDate };
    if (leaveTypeId) body.leave_type_id = leaveTypeId;
    const res = await api.post(
      `${API}/holidays/check-days/`,
      body,
      {},
    );
    return res.data;
  },

  /** POST /api/leaves/holidays/ */
  create: async (data: Omit<PublicHoliday, "id">): Promise<PublicHoliday> => {
    const res = await api.post(`${API}/holidays/`, data, {});
    return res.data;
  },

  /** PATCH /api/leaves/holidays/<id>/ */
  update: async (id: number, data: Partial<PublicHoliday>): Promise<PublicHoliday> => {
    const res = await api.patch(`${API}/holidays/${id}/`, data, {});
    return res.data;
  },

  /** DELETE /api/leaves/holidays/<id>/ */
  delete: async (id: number): Promise<void> => {
    await api.delete(`${API}/holidays/${id}/`, {});
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ManagerDelegation  →  /api/leaves/delegations/
// ─────────────────────────────────────────────────────────────────────────────
export const managerDelegationService = {
  /** GET /api/leaves/delegations/ */
  getAll: async (params?: { delegator_id?: number; delegate_id?: number; active_only?: boolean }): Promise<ManagerDelegation[]> => {
    const res = await api.get(`${API}/delegations/`, {
      params,
    });
    return res.data;
  },

  /** GET /api/leaves/delegations/<id>/ */
  getById: async (id: number): Promise<ManagerDelegation> => {
    const res = await api.get(`${API}/delegations/${id}/`, {});
    return res.data;
  },

  /** POST /api/leaves/delegations/ */
  create: async (data: ManagerDelegationCreate): Promise<ManagerDelegation> => {
    const res = await api.post(`${API}/delegations/`, data, {});
    return res.data;
  },

  /** PATCH /api/leaves/delegations/<id>/ */
  update: async (id: number, data: Partial<ManagerDelegationCreate>): Promise<ManagerDelegation> => {
    const res = await api.patch(`${API}/delegations/${id}/`, data, {});
    return res.data;
  },

  /** DELETE /api/leaves/delegations/<id>/ */
  delete: async (id: number): Promise<void> => {
    await api.delete(`${API}/delegations/${id}/`, {});
  },

  /** POST /api/leaves/delegations/<id>/deactivate/ */
  deactivate: async (id: number): Promise<ManagerDelegation> => {
    const res = await api.post(`${API}/delegations/${id}/deactivate/`, {}, {});
    return res.data;
  },

  /** GET /api/leaves/delegations/active-for/<managerId>/ */
  getActiveFor: async (managerId: number): Promise<{ delegate: { id: number; full_name: string; email: string } | null; delegation: ManagerDelegation | null }> => {
    const res = await api.get(`${API}/delegations/active-for/${managerId}/`, {});
    return res.data;
  },
};

// Re-export leaveHolidayService alias for backward compatibility
export const leaveHolidayService = holidayService;

// Re-export leaveApprovalRuleService
export const leaveApprovalRuleService = {
  getAll: async (): Promise<import("../types/leave").ApprovalRule[]> => {
    const res = await api.get(`${API}/approval-rules/`, {});
    return res.data;
  },
  create: async (data: import("../types/leave").ApprovalRuleCreate): Promise<import("../types/leave").ApprovalRule> => {
    const res = await api.post(`${API}/approval-rules/`, data, {});
    return res.data;
  },
  update: async (id: number, data: Partial<import("../types/leave").ApprovalRuleCreate>): Promise<import("../types/leave").ApprovalRule> => {
    const res = await api.patch(`${API}/approval-rules/${id}/`, data, {});
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`${API}/approval-rules/${id}/`, {});
  },
  getActive: async (): Promise<import("../types/leave").ApprovalRule[]> => {
    const res = await api.get(`${API}/approval-rules/active/`, {});
    return res.data;
  },
  checkRules: async (employeeId: number, leaveTypeId: number, days: number) => {
    const res = await api.post(`${API}/approval-rules/check/`, { employee_id: employeeId, leave_type_id: leaveTypeId, days }, {});
    return res.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ExitAuthorization  →  /api/leaves/exit-authorizations/
// ─────────────────────────────────────────────────────────────────────────────
export const exitAuthorizationService = {
  getAll: async (filters?: ExitAuthorizationFilters): Promise<ExitAuthorization[]> => {
    const res = await api.get(`${API}/exit-authorizations/`, {
      params:  filters,
    });
    return res.data;
  },

  getByEmployee: async (employeeId: number): Promise<ExitAuthorization[]> => {
    const res = await api.get(`${API}/exit-authorizations/employee/${employeeId}/`, {
      });
    return res.data;
  },

  create: async (data: ExitAuthorizationCreate): Promise<ExitAuthorization> => {
    const res = await api.post(`${API}/exit-authorizations/`, data, {
      });
    return res.data;
  },

  approve: async (id: number, reviewerId?: number): Promise<ExitAuthorization> => {
    const res = await api.post(
      `${API}/exit-authorizations/${id}/approve/`,
      reviewerId ? { reviewer_id: reviewerId } : {},
      {},
    );
    return res.data;
  },

  reject: async (id: number, rejectReason: string, reviewerId?: number): Promise<ExitAuthorization> => {
    const res = await api.post(
      `${API}/exit-authorizations/${id}/reject/`,
      { reject_reason: rejectReason, ...(reviewerId ? { reviewer_id: reviewerId } : {}) },
      {},
    );
    return res.data;
  },

  cancel: async (id: number): Promise<ExitAuthorization> => {
    const res = await api.post(`${API}/exit-authorizations/${id}/cancel/`, {}, {
      });
    return res.data;
  },
};

