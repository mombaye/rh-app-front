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
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

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
  reviewed_by:   EmployeeMini | null;
  reviewed_at:   string | null;
  reject_reason: string;
  created_at:    string;
  updated_at:    string;
}

// ── LeaveRequestCreate ── mirrors LeaveRequestCreateSerializer ────────────────
// Champs attendus par POST /api/leaves/requests/
export interface LeaveRequestCreate {
  employee_id:   number;
  leave_type_id: number;
  start_date:    string;
  end_date:      string;
  days:          number;
  motif:         string;
  // contract_type n'est PAS envoyé au backend (pas dans le serializer)
  // il est utilisé uniquement côté frontend pour le filtrage GET
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
// NB : contract_type est géré côté frontend uniquement (pas de filtre Django)
export interface LeaveRequestFilters {
  status?:        LeaveStatus;
  employee_id?:   number;
  leave_type_id?: number;
  start_date?:    string;
  end_date?:      string;
  department?:    string;       // filtre sur employee__service__icontains
  contract_type?: ContractType; // filtré côté frontend après réception
}