// src/types/leave.ts
// Aligné avec leaves/serializers.py et leaves/models.py

export type ContractType = "INTERNE" | "INTERIM";

// ── LeaveType ── mirrors LeaveTypeSerializer ──────────────────────────────────
export interface LeaveType {
  id:                      number;
  code:                    string;
  label:                   string;
  is_paid:                 boolean;
  requires_justification:  boolean;
  color:                   string;
  monthly_accrual:         string;  // accrual automatique mensuel (ex: "2.0")
}

// ── EmployeeMini ── mirrors EmployeeMiniSerializer ────────────────────────────
export interface EmployeeMini {
  id:        number;
  matricule: string;
  full_name: string;
  fonction:  string;
  service:   string;
  manager:   string;
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
  start_date:    string;        // "YYYY-MM-DD"
  end_date:      string;        // "YYYY-MM-DD"
  days:          string;        // DecimalField → string en JSON
  duration_days: string;        // alias de days (read_only)
  motif:         string;
  status:        LeaveStatus;
  status_label:  string;        // get_status_display()
  // 1ère validation
  reviewed_by:   EmployeeMini | null;
  reviewed_at:   string | null;
  reject_reason: string;
  // 2ème validation
  requires_second_approval: boolean;
  second_reviewer:          EmployeeMini | null;
  second_reviewed_at:       string | null;
  // Révocation
  revoke_reason:                 string;
  revoked_by:                    EmployeeMini | null;
  revoked_at:                    string | null;
  days_remaining_at_revocation:  string | null;
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
  employee:      number;        // PK
  employee_name: string;
  leave_type:    LeaveType;
  year:          number;
  acquired:      string;        // DecimalField
  taken:         string;
  adjusted:      string;
  remaining:     string;        // computed read_only
}

export interface LeaveBalanceAdjust {
  adjusted: number;
}

// ── LeaveSummary ── mirrors summary() action ──────────────────────────────────
export interface LeaveSummary {
  total:                number;
  pending:              number;
  approved:             number;
  rejected:             number;
  cancelled:            number;
  revoked:              number;
  total_days_approved:  number;
}

// ── LeaveCalendarEntry ── mirrors calendar() action ───────────────────────────
export interface LeaveCalendarEntry {
  employee_id:   number;
  employee_name: string;
  leave_type:    string;   // code
  color:         string;
  start_date:    string;
  end_date:      string;
  days:          string;
}

// ── LeaveRequestFilters ── query params supportés par get_queryset() ──────────
export interface LeaveRequestFilters {
  status?:        LeaveStatus;
  employee_id?:   number;
  leave_type_id?: number;
  start_date?:    string;
  end_date?:      string;
  department?:    string;
  contract_type?: ContractType; // filtré côté frontend uniquement
}
