// src/services/leavesService.ts

import api from '@/api/axios';
import type {
  DepartmentHierarchyConfig,
  DepartmentFromEmployees,
  EmployeeHierarchyRole,
  HierarchyTree,
  HierarchyType,
  BulkRoleItem,
} from '@/types/leaves';

const BASE = '/api/leaves/hierarchy';

// ─── Departments ────────────────────────────────────────────────

export async function fetchDepartments(): Promise<DepartmentHierarchyConfig[]> {
  const { data } = await api.get(`${BASE}/departments/`);
  return data;
}

export async function fetchDepartmentsFromEmployees(): Promise<DepartmentFromEmployees[]> {
  const { data } = await api.get(`${BASE}/departments/from-employees/`);
  return data;
}

export async function createDepartment(
  payload: { department_name: string; hierarchy_type: HierarchyType; chef_id?: number | null }
): Promise<DepartmentHierarchyConfig> {
  const { data } = await api.post(`${BASE}/departments/`, payload);
  return data;
}

export async function updateDepartment(
  id: number,
  payload: Partial<{ department_name: string; hierarchy_type: HierarchyType; chef_id: number | null }>
): Promise<DepartmentHierarchyConfig> {
  const { data } = await api.patch(`${BASE}/departments/${id}/`, payload);
  return data;
}

export async function deleteDepartment(id: number): Promise<void> {
  await api.delete(`${BASE}/departments/${id}/`);
}

export async function fetchDepartmentTree(id: number): Promise<HierarchyTree> {
  const { data } = await api.get(`${BASE}/departments/${id}/tree/`);
  return data;
}

// ─── Roles ───────────────────────────────────────────────────────

export async function fetchRoles(params?: {
  department_id?: number;
  role?: string;
}): Promise<EmployeeHierarchyRole[]> {
  const { data } = await api.get(`${BASE}/roles/`, { params });
  return data;
}

export async function createRole(payload: {
  employee_id: number;
  role: string;
  department_config?: number | null;
  supervisor_id?: number | null;
}): Promise<EmployeeHierarchyRole> {
  const { data } = await api.post(`${BASE}/roles/`, payload);
  return data;
}

export async function updateRole(
  id: number,
  payload: Partial<{ role: string; supervisor_id: number | null; department_config: number | null }>
): Promise<EmployeeHierarchyRole> {
  const { data } = await api.patch(`${BASE}/roles/${id}/`, payload);
  return data;
}

export async function deleteRole(id: number): Promise<void> {
  await api.delete(`${BASE}/roles/${id}/`);
}

export async function bulkAssignRoles(payload: {
  department_id: number;
  roles: BulkRoleItem[];
}): Promise<{ created: number; updated: number; department: string }> {
  const { data } = await api.post(`${BASE}/roles/bulk-assign/`, payload);
  return data;
}
