import api from '@/api/axios';
import type {
  Department,
  DepartmentMember,
  DepartmentOrgChart,
  HierarchyType,
  MemberRole,
} from '@/types/hierarchy';

// ===== Départements =====

export async function getDepartments(opts?: { is_active?: boolean }) {
  const params: Record<string, any> = {};
  if (opts?.is_active !== undefined) params.is_active = opts.is_active;
  const { data } = await api.get<Department[]>('/api/hierarchy/departments/', { params });
  return data;
}

export async function getDepartment(id: number) {
  const { data } = await api.get<Department>(`/api/hierarchy/departments/${id}/`);
  return data;
}

export async function createDepartment(payload: {
  name: string;
  description?: string;
  hierarchy_type: HierarchyType;
}) {
  const { data } = await api.post<Department>('/api/hierarchy/departments/', payload);
  return data;
}

export async function updateDepartment(
  id: number,
  payload: Partial<{ name: string; description: string; hierarchy_type: HierarchyType; is_active: boolean }>
) {
  const { data } = await api.patch<Department>(`/api/hierarchy/departments/${id}/`, payload);
  return data;
}

export async function deleteDepartment(id: number) {
  await api.delete(`/api/hierarchy/departments/${id}/`);
}

// ===== Membres =====

export async function getDepartmentMembers(departmentId: number, opts?: { role?: MemberRole }) {
  const params: Record<string, any> = { department: departmentId };
  if (opts?.role) params.role = opts.role;
  const { data } = await api.get<DepartmentMember[]>('/api/hierarchy/members/', { params });
  return data;
}

export async function addMember(payload: {
  department: number;
  employee: number;
  role: MemberRole;
  reports_to?: number | null;
}) {
  const { data } = await api.post<DepartmentMember>('/api/hierarchy/members/', payload);
  return data;
}

export async function updateMember(
  id: number,
  payload: Partial<{ role: MemberRole; reports_to: number | null; is_active: boolean }>
) {
  const { data } = await api.patch<DepartmentMember>(`/api/hierarchy/members/${id}/`, payload);
  return data;
}

export async function removeMember(id: number) {
  await api.delete(`/api/hierarchy/members/${id}/`);
}

export async function bulkAssignMembers(payload: {
  department: number;
  members: { employee: number; role: MemberRole; reports_to?: number | null }[];
}) {
  const { data } = await api.post('/api/hierarchy/members/bulk_assign/', payload);
  return data;
}

// ===== Organigramme =====

export async function getDepartmentOrgChart(departmentId: number) {
  const { data } = await api.get<DepartmentOrgChart>(
    `/api/hierarchy/departments/${departmentId}/org_chart/`
  );
  return data;
}

export async function getFullOrgChart() {
  const { data } = await api.get<DepartmentOrgChart[]>('/api/hierarchy/departments/full_org_chart/');
  return data;
}
