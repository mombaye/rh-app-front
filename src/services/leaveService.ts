import api from '../api/axios';

export interface LeaveRequest {
  id: number;
  employee: number;
  employee_name: string;
  employee_matricule: string;
  leave_type: number;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days: number;
  motif: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewed_by: number | null;
  reviewed_at: string | null;
  reject_reason: string;
  created_at: string;
}

export const getManagerRequests = async (): Promise<LeaveRequest[]> => {
  const response = await api.get('/api/leaves/requests/manager-requests/');
  return response.data.results ?? response.data;
};

export const approveLeaveRequest = async (id: number): Promise<LeaveRequest> => {
  const response = await api.post(`/api/leaves/requests/${id}/approve/`);
  return response.data;
};

export const rejectLeaveRequest = async (id: number, reason: string): Promise<LeaveRequest> => {
  const response = await api.post(`/api/leaves/requests/${id}/reject/`, { reason });
  return response.data;
};
