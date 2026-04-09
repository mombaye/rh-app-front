// src/types/leave.ts
// Aligné avec leaves/serializers.py et leaves/models.py

export type ContractType = "INTERNE" | "INTERIM";

// ── LeaveType ── mirrors LeaveTypeSerializer ──────────────────────────────────
export interface LeaveType {
  id:                       number;
  code:                     string;
  label:                    string;
  is_paid:                  boolean;
  requires_justification:   boolean;
  justification_grace_days: number;
  color:                    string;
  monthly_accrual:          string;
  max_days_per_request:     number;
  max_days_per_year:        number;   // plafond annuel (0 = illimité)
  carry_forward_days:       number;   // jours reportables max (0 = pas de report)
  exclude_weekends:         boolean;  // exclure sam/dim du décompte
  allow_negative_balance:   boolean;  // autoriser solde négatif
  deducts_from_balance:     boolean;  // seuls les congés annuels déduisent du solde
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

  created_at:    string;
  updated_at:    string;
}

// ── LeaveRequestCreate ── mirrors LeaveRequestCreateSerializer ────────────────
export interface LeaveRequestCreate {
  employee_id:    number;
  leave_type_id:  number;
  start_date:     string;
  end_date:       string;
  days:           number;
  motif:          string;
  half_day_start?: boolean;
  half_day_end?:   boolean;
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
  level:          string;        // "N+1", "N+2", "DG"
  approver_id:    number | null;
  approver_name:  string | null;
  is_on_leave?:   boolean;       // true si le manager est actuellement en congé
}

export interface ApprovalChainInfo {
  is_department_head: boolean;
  department:         string | null;
  /** DG_ONLY = responsable dept racine | N1_ONLY = employé sous dept racine | HIERARCHY = employé sous-département */
  approval_flow:      "HIERARCHY" | "DG_ONLY" | "N1_ONLY";
  steps:              ApprovalChainStep[];
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
