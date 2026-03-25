import api from "@/api/axios";

// ── Hierarchy ───────────────────────────────────────────

export interface HierarchyNode {
  id: number;
  nom: string;
  prenom: string;
  fonction: string;
  service: string;
  business_line: string;
  manager: string;
  localisation: string;
  children: HierarchyNode[];
}

export interface HierarchyResponse {
  tree: HierarchyNode[];
  total: number;
}

export const getHierarchy = async (): Promise<HierarchyResponse> => {
  const res = await api.get("/api/employees/hierarchy/");
  return res.data;
};

// ── Leave Types ─────────────────────────────────────────

export interface LeaveType {
  id: number;
  code: string;
  label: string;
  is_paid: boolean;
  requires_justification: boolean;
  color: string;
}

export const getLeaveTypes = async (): Promise<LeaveType[]> => {
  const res = await api.get("/api/leaves/types/");
  return res.data?.results ?? res.data;
};

// ── Leave Requests ──────────────────────────────────────

export interface LeaveRequest {
  id: number;
  employee: { id: number; nom: string; prenom: string; matricule: string };
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  motif: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewed_by?: { nom: string; prenom: string } | null;
  reviewed_at?: string | null;
  reject_reason?: string;
  created_at: string;
}

export const getLeaveRequests = async (
  params?: Record<string, string | number | undefined>
): Promise<LeaveRequest[]> => {
  const res = await api.get("/api/leaves/requests/", { params });
  return res.data?.results ?? res.data;
};

export const createLeaveRequest = async (data: {
  employee: number;
  leave_type: number;
  start_date: string;
  end_date: string;
  days: number;
  motif?: string;
}): Promise<LeaveRequest> => {
  const res = await api.post("/api/leaves/requests/", data);
  return res.data;
};

export const approveLeave = async (id: number): Promise<LeaveRequest> => {
  const res = await api.post(`/api/leaves/requests/${id}/approve/`);
  return res.data;
};

export const rejectLeave = async (
  id: number,
  reason: string
): Promise<LeaveRequest> => {
  const res = await api.post(`/api/leaves/requests/${id}/reject/`, {
    reject_reason: reason,
  });
  return res.data;
};

export const cancelLeave = async (id: number): Promise<LeaveRequest> => {
  const res = await api.post(`/api/leaves/requests/${id}/cancel/`);
  return res.data;
};
