export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveType {
  id: number;
  code: string;
  label: string;
  is_paid: boolean;
  requires_justification: boolean;
  color: string;
}

export interface EmployeeMini {
  id: number;
  matricule: string;
  full_name: string;
  fonction: string;
  service: string | null;
  manager: string | null;
}

export interface LeaveBalance {
  id: number;
  employee: number;
  employee_name: string;
  leave_type: LeaveType;
  year: number;
  acquired: number;
  taken: number;
  adjusted: number;
  remaining: number;
}

export interface LeaveRequest {
  id: number;
  employee: EmployeeMini;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  duration_days: number;
  motif: string;
  status: LeaveStatus;
  status_label: string;
  reviewed_by: EmployeeMini | null;
  reviewed_at: string | null;
  reject_reason: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveCalendarEntry {
  id: number;
  employee_name: string;
  leave_type: string;
  color: string;
  start_date: string;
  end_date: string;
  days: number;
}

export interface LeaveSummary {
  total_requests: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  total_approved_days: number;
}

export const STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuv\u00e9',
  REJECTED: 'Rejet\u00e9',
  CANCELLED: 'Annul\u00e9',
};

export const STATUS_COLORS: Record<LeaveStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
};
