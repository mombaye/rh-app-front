// src/types/leave.ts
// Aligné avec leaves/serializers.py et leaves/models.py

export type ContractType = "INTERNE" | "INTERIM";

// ── LeaveType ── mirrors LeaveTypeSerializer ──────────────────────────────────
export interface LeaveType {
  id:                        number;
  code:                      string;
  label:                     string;
  is_paid:                   boolean;
  requires_justification:    boolean;
  justification_after_leave: boolean;  // true = demandé après le congé (mariage, baptême…), false = obligatoire avant soumission (médical)
  justification_grace_days:  number;   // délai (jours) pour fournir le justificatif après le congé
  color:                     string;
  monthly_accrual:           string;
  max_days_per_request:      number;   // 0 = illimité
  min_days_per_request:      number;   // 0 = sans minimum
  max_days_per_year:         number;   // 0 = illimité
  carry_forward_days:        number;   // jours reportables max (0 = pas de report)
  max_carry_over_days:       number;
  exclude_weekends:          boolean;
  allow_negative_balance:    boolean;
  deducts_from_balance:      boolean;  // seuls les CP déduisent du solde
  is_special_leave:          boolean;  // congé spécial Art. L147 — droit distinct, non déduit du solde CP
  notice_days_required:      number;   // délai de prévenance (0 = aucune contrainte)
  count_mode:                string;   // "CALENDAR" | "WORKING" | "WORKABLE"
  count_mode_display:        string;   // libellé lisible du mode de décompte
  seniority_bonus_enabled:   boolean;
}

// ── EmployeeMini ── mirrors EmployeeMiniSerializer ────────────────────────────
export interface EmployeeMini {
  id:                      number;
  matricule:               string;
  full_name:               string;
  fonction:                string;
  service:                 string;
  manager:                 string;
  email?:                  string;
  requires_two_approvals?: boolean;
  attendance_status?:      string;
  n1_manager_id?:          number | null;
  n2_manager_id?:          number | null;
  n1_manager_name?:        string | null;
  n2_manager_name?:        string | null;
}

// ── LeaveStatus ── mirrors LeaveRequest.Status choices ───────────────────────
export type LeaveStatus =
  | "PENDING"
  | "PENDING_SECOND"
  | "PENDING_RH"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REVOKED";

// ── LeaveRequest ── mirrors LeaveRequestSerializer ───────────────────────────
export interface LeaveRequest {
  id:            number;
  employee:      EmployeeMini;
  leave_type:    LeaveType;
  start_date:    string;
  end_date:      string;
  days:          string;
  duration_days: string;
  motif:         string;
  status:        LeaveStatus;
  status_label:  string;

  // Flags calculés côté serveur (évite les problèmes de fuseau horaire)
  is_ended:       boolean;
  is_in_progress: boolean;
  is_consumed:    boolean;

  // Demi-journée
  half_day_start: boolean;
  half_day_end:   boolean;

  // 1ère validation
  reviewed_by:   EmployeeMini | null;
  reviewed_at:   string | null;
  reject_reason: string;

  // 2ème validation
  requires_second_approval: boolean;
  second_reviewer:          EmployeeMini | null;
  second_reviewed_at:       string | null;

  // Validation RH finale
  hr_reviewer:    EmployeeMini | null;
  hr_reviewed_at: string | null;

  // Révocation
  revoke_reason:                string;
  revoked_by:                   EmployeeMini | null;
  revoked_at:                   string | null;
  days_remaining_at_revocation: string | null;

  // Justificatif
  justification_document:     string | null;
  justification_validated:    boolean;
  justification_validated_by: EmployeeMini | null;
  justification_validated_at: string | null;
  justification_deadline:     string | null;
  justification_pending:      boolean;

  // Absence pour défaut de justificatif
  marked_as_absent:    boolean;
  marked_as_absent_by: EmployeeMini | null;
  marked_as_absent_at: string | null;

  // Congé par anticipation
  is_anticipation: boolean;

  created_at:    string;
  updated_at:    string;
}

// ── LeaveRequestCreate ── mirrors LeaveRequestCreateSerializer ────────────────
export interface LeaveRequestCreate {
  employee_id:      number;
  leave_type_id:    number;
  start_date:       string;
  end_date:         string;
  days:             number;
  motif:            string;
  half_day_start?:  boolean;
  half_day_end?:    boolean;
  is_anticipation?: boolean;
}

// ── LeaveBalance ── mirrors LeaveBalanceSerializer ───────────────────────────
export interface LeaveBalance {
  id:              number;
  employee:        number;
  employee_name:   string;
  leave_type:      LeaveType;
  year:            number;
  acquired:        string;
  taken:           string;
  adjusted:        string;
  remaining:       string;
  carried_forward: string;  // jours reportés de l'année précédente
}

export interface LeaveBalanceAdjust {
  adjusted: number;
}

// ── LeaveBalanceHistory ── mirrors LeaveBalanceHistorySerializer ───────────────
export type BalanceOperationType =
  | "ACCRUAL"
  | "DEDUCTION"
  | "RESTORATION"
  | "ADJUSTMENT"
  | "CARRYOVER"
  | "IMPORT";

export interface LeaveBalanceHistory {
  id:                number;
  operation:         BalanceOperationType;
  operation_label:   string;
  delta:             string;       // positif = gain, négatif = perte
  balance_after:     string;
  leave_request_id:  number | null;
  performed_by_name: string | null;
  note:              string;
  created_at:        string;
}

// ── CarryoverResult ── mirrors carryover() action ──────────────────────────────
export interface CarryoverResult {
  year_from:           number;
  year_to:             number;
  processed:           number;
  skipped:             number;
  total_days_carried:  number;
}

// ── MigrationImportResult ── mirrors migration_import() action ────────────────
export interface MigrationImportRow {
  row:               number;
  status:            "ok" | "not_found" | "ambiguous" | "error";
  employee:          string;
  matricule?:        string;
  nom?:              string;
  prenom?:           string;
  poste?:            string;
  service?:          string;
  date_embauche?:    string;
  match_type?:       "matricule" | "name_exact" | "name_fuzzy" | "not_found" | "ambiguous";
  current_remaining: number | null;
  new_remaining:     number | null;
  delta?:            number;
  solde_anterieur?:  number;
  acquired?:         number;
  taken?:            number;
  message?:          string;
}
export interface MigrationImportResult {
  dry_run:           boolean;
  year:              number;
  leave_type:        string;
  leave_type_label:  string;
  processed:         number;
  errors_count:      number;
  results:           MigrationImportRow[];
}

// ── LeaveSummary ── mirrors summary() action ──────────────────────────────────
export interface LeaveSummary {
  total:               number;
  pending:             number;
  approved:            number;
  rejected:            number;
  cancelled:           number;
  revoked:             number;
  total_days_approved: number;
}

// ── LeaveCalendarEntry ── mirrors calendar() action ───────────────────────────
export interface LeaveCalendarEntry {
  id:            number;
  employee_id:   number;
  employee_name: string;
  matricule:     string;
  leave_type:    string;
  leave_label:   string;
  color:         string;
  start_date:    string;
  end_date:      string;
  days:          string;
}

// ── LeavePlanningEntry ── mirrors planning() action ───────────────────────────
export interface LeavePlanningEntry {
  id:              number;
  employee_id:     number;
  employee_name:   string;
  matricule:       string;
  service:         string;
  leave_type_id:   number;
  leave_type:      string;
  leave_label:     string;
  color:           string;
  start_date:      string;
  end_date:        string;
  days:            number;
  half_day_start:  boolean;
  half_day_end:    boolean;
}

// ── AbsenceRateRow ── mirrors stats_absence_rate() action ─────────────────────
export interface AbsenceRateRow {
  department:       string | null;
  employee_count:   number;
  total_requests:   number;
  total_days:       number;
  absence_rate_pct: number;
}

// ── LeaveRequestFilters ───────────────────────────────────────────────────────
export interface LeaveRequestFilters {
  status?:                 LeaveStatus;
  employee_id?:            number;
  leave_type_id?:          number;
  start_date?:             string;
  end_date?:               string;
  department?:             string;
  employee_name?:          string;
  year?:                   number;
  contract_type?:          ContractType;
  manager_employee_id?:    number;
  pending_justification?:  string;
}

// ── ExportColumn ──────────────────────────────────────────────────────────────
export type ExportColumnKey =
  | "id" | "employee" | "matricule" | "service" | "leave_type"
  | "start_date" | "end_date" | "days" | "motif" | "status"
  | "reviewed_by" | "reviewed_by_email" | "reviewed_at"
  | "second_reviewer" | "second_reviewer_email" | "second_reviewed_at"
  | "reject_reason" | "revoke_reason"
  | "justification_validated"
  | "created_at";

export interface ExportColumnDef {
  key:   ExportColumnKey;
  label: string;
}

// ── PublicHoliday ─────────────────────────────────────────────────────────────
export interface PublicHoliday {
  id:           number;
  date:         string;
  name:         string;
  is_recurring: boolean;
  description:  string;
}

export interface HolidayCheckResult {
  total_days:     number;
  holidays_count: number;
  effective_days: number;
  holidays:       { date: string; name: string }[];
}

// ── Department ────────────────────────────────────────────────────────────────
export interface DepartmentChild {
  id:                  number;
  name:                string;
  code:                string;
  description:         string;
  head:                number | null;
  head_name:           string | null;
  dg_validator:        number | null;
  dg_validator_name:   string | null;
  employee_count:      number;
  created_at:          string;
  updated_at:          string;
}

export interface Department {
  id:                  number;
  name:                string;
  code:                string;
  description:         string;
  parent:              number | null;
  parent_name:         string | null;
  head:                number | null;
  head_name:           string | null;
  dg_validator:        number | null;
  dg_validator_name:   string | null;
  employee_count:      number;
  children:            DepartmentChild[];
  created_at:          string;
  updated_at:          string;
}

export interface DepartmentCreate {
  name:           string;
  code:           string;
  description?:   string;
  parent_id?:     number | null;
  head_id?:       number | null;
  dg_validator_id?: number | null;
}

// ── ApprovalRule ──────────────────────────────────────────────────────────────
export type ApprovalRuleType = "LONG_LEAVE" | "LEAVE_TYPE" | "DEPARTMENT";

export interface ApprovalRule {
  id:                     number;
  name:                   string;
  rule_type:              ApprovalRuleType;
  rule_type_display:      string;
  min_days:               number;
  leave_type:             number | null;
  leave_type_label:       string | null;
  required_approver:      number | null;
  required_approver_name: string | null;
  is_active:              boolean;
  description:            string;
  created_at:             string;
  updated_at:             string;
}

export interface ApprovalRuleCreate {
  name:                string;
  rule_type:           ApprovalRuleType;
  min_days?:           number;
  leave_type_id?:      number | null;
  required_approver_id?: number | null;
  is_active?:          boolean;
  description?:        string;
}

// ── EmployeeHierarchy ─────────────────────────────────────────────────────────
export interface EmployeeHierarchy {
  id:                   number;
  matricule:            string;
  full_name:            string;
  fonction:             string | null;
  service:              string | null;
  n1_manager:           number | null;
  n1_manager_name:      string | null;
  n2_manager:           number | null;
  n2_manager_name:      string | null;
  requires_two_approvals: boolean;
  manages_n1_count:     number;
  manages_n2_count:     number;
  status:               string;
}

// ── ManagerDelegation ── mirrors ManagerDelegationSerializer ──────────────────
export interface ManagerDelegation {
  id:                  number;
  delegator:           number;
  delegator_name:      string;
  delegate:            number;
  delegate_name:       string;
  start_date:          string;
  end_date:            string;
  reason:              string;
  is_active:           boolean;
  is_currently_active: boolean;
  created_by:          number | null;
  created_by_name:     string | null;
  created_at:          string;
  updated_at:          string;
}

export interface ManagerDelegationCreate {
  delegator_id:  number;
  delegate_id:   number;
  start_date:    string;
  end_date:      string;
  reason?:       string;
  is_active?:    boolean;
  created_by_id?: number;
}

// ── ApprovalChainStep ─────────────────────────────────────────────────────────
export interface ApprovalChainStep {
  level:          string;        // "N+1", "N+2", "N+3"…
  approver_id:    number | null;
  approver_name:  string | null;
  is_on_leave?:   boolean;
}

export interface ApprovalChainInfo {
  is_department_head: boolean;
  department:         string | null;
  /**
   * DG_ONLY   = responsable de département racine → seul le DG valide
   * SINGLE    = 1 seul validateur (ex : FLOTTE)
   * MULTI     = N validateurs selon l'arborescence (ex : FO-NEU → FO)
   * N1_ONLY / HIERARCHY = valeurs legacy (rétrocompatibilité)
   */
  approval_flow: "DG_ONLY" | "SINGLE" | "MULTI" | "N1_ONLY" | "HIERARCHY";
  steps:         ApprovalChainStep[];
  total_steps?:  number;
}

// ── ApprovePayload ────────────────────────────────────────────────────────────
export interface ApprovePayload {
  reviewer_id?:        number;
  second_approver_id?: number;
}

// ── RevokePayload ─────────────────────────────────────────────────────────────
export interface RevokePayload {
  revoke_reason: string;
  revoker_id?:   number;
  recall_date?:  string;
}

// ── ExitAuthorization ─────────────────────────────────────────────────────────
export type ExitAuthStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface ExitAuthorization {
  id:                   number;
  employee:             number;
  employee_name:        string;
  employee_matricule:   string;
  employee_service:     string | null;
  datetime_exit:        string;   // ISO datetime
  datetime_return:      string;   // ISO datetime
  motif:                string;
  status:               ExitAuthStatus;
  status_label:         string;
  reviewed_by:          number | null;
  reviewed_by_name:     string | null;
  reviewed_at:          string | null;
  reject_reason:        string;
  created_at:           string;
  updated_at:           string;
}

export interface ExitAuthorizationCreate {
  employee_id:     number;
  datetime_exit:   string;
  datetime_return: string;
  motif:           string;
}

export interface ExitAuthorizationFilters {
  employee_id?:         number;
  status?:              ExitAuthStatus;
  manager_employee_id?: number;
}

