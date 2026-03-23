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
  justification_grace_days: number;   // délai en jours après fin du congé pour soumettre le justificatif
  color:                    string;
  monthly_accrual:          string;
  max_days_per_request:     number;
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
  attendance_status?:      string;   // "SHIFT" → intérimaire, sinon interne
  // Hiérarchie N+1 / N+2
  n1_manager_id?:          number | null;
  n2_manager_id?:          number | null;
  n1_manager_name?:        string | null;
  n2_manager_name?:        string | null;
}

// ── LeaveStatus ── mirrors LeaveRequest.Status choices ───────────────────────
export type LeaveStatus =
  | "PENDING"
  | "PENDING_SECOND"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REVOKED";

// ── LeaveRequest ── mirrors LeaveRequestSerializer ───────────────────────────
export interface LeaveRequest {
  id:            number;
  employee:      EmployeeMini;
  leave_type:    LeaveType;
  start_date:    string;          // "YYYY-MM-DD"
  end_date:      string;          // "YYYY-MM-DD"
  days:          string;          // DecimalField → string en JSON
  duration_days: string;          // alias de days (read_only)
  motif:         string;
  status:        LeaveStatus;
  status_label:  string;          // get_status_display()

  // 1ère validation
  reviewed_by:   EmployeeMini | null;
  reviewed_at:   string | null;
  reject_reason: string;

  // 2ème validation
  requires_second_approval: boolean;
  second_reviewer:          EmployeeMini | null;
  second_reviewed_at:       string | null;

  // Révocation (rappel d'urgence)
  revoke_reason:                string;
  revoked_by:                   EmployeeMini | null;
  revoked_at:                   string | null;
  days_remaining_at_revocation: string | null;

  // Justificatif
  justification_document:     string | null;
  justification_validated:    boolean;
  justification_validated_by: EmployeeMini | null;
  justification_validated_at: string | null;
  justification_deadline:     string | null;   // "YYYY-MM-DD" — date limite de dépôt
  justification_pending:      boolean;         // true si justif requise, congé terminé, aucun doc

  // Absence pour défaut de justificatif
  marked_as_absent:    boolean;
  marked_as_absent_by: EmployeeMini | null;
  marked_as_absent_at: string | null;

  created_at:    string;
  updated_at:    string;
}

// ── LeaveRequestCreate ── mirrors LeaveRequestCreateSerializer ────────────────
export interface LeaveRequestCreate {
  employee_id:   number;
  leave_type_id: number;
  start_date:    string;
  end_date:      string;
  days:          number;
  motif:         string;
}

// ── LeaveBalance ── mirrors LeaveBalanceSerializer ───────────────────────────
export interface LeaveBalance {
  id:            number;
  employee:      number;          // PK
  employee_name: string;
  leave_type:    LeaveType;
  year:          number;
  acquired:      string;          // DecimalField
  taken:         string;
  adjusted:      string;
  remaining:     string;          // computed read_only
}

export interface LeaveBalanceAdjust {
  adjusted: number;
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
  leave_type:    string;    // code
  leave_label:   string;
  color:         string;
  start_date:    string;
  end_date:      string;
  days:          string;
}

// ── LeaveRequestFilters ── query params supportés par get_queryset() ──────────
export interface LeaveRequestFilters {
  status?:                 LeaveStatus;
  employee_id?:            number;
  leave_type_id?:          number;
  start_date?:             string;
  end_date?:               string;
  department?:             string;
  employee_name?:          string;  // recherche par nom/prénom/matricule
  year?:                   number;  // filtre par année de début
  contract_type?:          ContractType; // filtré côté frontend uniquement
  manager_employee_id?:    number;  // filtre les subordonnés d'un manager
  pending_justification?:  string;  // "true" → congés approuvés dont le justif. est manquant
}

// ── ExportColumn ── colonnes disponibles pour l'export personnalisé ──────────
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
  date:         string;   // "YYYY-MM-DD"
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
export interface Department {
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

export interface DepartmentCreate {
  name:           string;
  code:           string;
  description?:   string;
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

// ── ApprovePayload ────────────────────────────────────────────────────────────
export interface ApprovePayload {
  reviewer_id?:        number;
  second_approver_id?: number;
}

// ── RevokePayload ─────────────────────────────────────────────────────────────
export interface RevokePayload {
  revoke_reason: string;
  revoker_id?:   number;
  recall_date?:  string;  // "YYYY-MM-DD"
}
