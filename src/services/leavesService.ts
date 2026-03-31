import api from '@/api/axios';
import type {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveCalendarEntry,
  LeaveSummary,
  LeaveStatus,
} from '@/types/leaves';

// ===== Types de cong\u00e9s =====

export async function getLeaveTypes() {
  const { data } = await api.get<LeaveType[]>('/api/leaves/types/');
  return data;
}

export async function createLeaveType(payload: Omit<LeaveType, 'id'>) {
  const { data } = await api.post<LeaveType>('/api/leaves/types/', payload);
  return data;
}

export async function updateLeaveType(id: number, payload: Partial<LeaveType>) {
  const { data } = await api.patch<LeaveType>(`/api/leaves/types/${id}/`, payload);
  return data;
}

export async function deleteLeaveType(id: number) {
  await api.delete(`/api/leaves/types/${id}/`);
}

// ===== Soldes =====

export async function getLeaveBalances(params?: { year?: number; employee_id?: number }) {
  const { data } = await api.get<LeaveBalance[]>('/api/leaves/balances/', { params });
  return data;
}

export async function getEmployeeBalances(employeeId: number, year?: number) {
  const params: Record<string, any> = {};
  if (year) params.year = year;
  const { data } = await api.get<LeaveBalance[]>(
    `/api/leaves/balances/employee/${employeeId}/`,
    { params }
  );
  return data;
}

export async function adjustBalance(id: number, adjusted: number) {
  const { data } = await api.patch<LeaveBalance>(`/api/leaves/balances/${id}/adjust/`, {
    adjusted,
  });
  return data;
}

// ===== Demandes =====

export async function getLeaveRequests(params?: {
  status?: LeaveStatus;
  employee_id?: number;
  leave_type_id?: number;
  start_date?: string;
  end_date?: string;
}) {
  const { data } = await api.get<LeaveRequest[]>('/api/leaves/requests/', { params });
  return data;
}

export async function getEmployeeRequests(employeeId: number, status?: LeaveStatus) {
  const params: Record<string, any> = {};
  if (status) params.status = status;
  const { data } = await api.get<LeaveRequest[]>(
    `/api/leaves/requests/employee/${employeeId}/`,
    { params }
  );
  return data;
}

export async function createLeaveRequest(payload: {
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days: number;
  motif?: string;
}) {
  const { data } = await api.post<LeaveRequest>('/api/leaves/requests/', payload);
  return data;
}

export async function approveLeaveRequest(id: number) {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/approve/`);
  return data;
}

export async function rejectLeaveRequest(id: number, reject_reason: string) {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/reject/`, {
    reject_reason,
  });
  return data;
}

export async function cancelLeaveRequest(id: number) {
  const { data } = await api.post<LeaveRequest>(`/api/leaves/requests/${id}/cancel/`);
  return data;
}

// ===== Calendrier =====

export async function getLeaveCalendar(params: { year: number; month: number }) {
  const { data } = await api.get<LeaveCalendarEntry[]>('/api/leaves/calendar/', { params });
  return data;
}

// ===== Stats =====

export async function getLeaveSummary() {
  const { data } = await api.get<LeaveSummary>('/api/leaves/stats/summary/');
  return data;
}
