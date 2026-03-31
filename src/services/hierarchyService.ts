import api from '@/api/axios';
import type { Department, DepartmentMember, DepartmentTree } from '@/types/hierarchy';

export const hierarchyService = {
  // Departments
  getDepartments: () =>
    api.get<Department[]>('/api/hierarchy/departments/'),

  getDepartment: (id: number) =>
    api.get<Department>(`/api/hierarchy/departments/${id}/`),

  createDepartment: (data: Partial<Department>) =>
    api.post<Department>('/api/hierarchy/departments/', data),

  updateDepartment: (id: number, data: Partial<Department>) =>
    api.patch<Department>(`/api/hierarchy/departments/${id}/`, data),

  deleteDepartment: (id: number) =>
    api.delete(`/api/hierarchy/departments/${id}/`),

  getDepartmentTree: (id: number) =>
    api.get<DepartmentTree>(`/api/hierarchy/departments/${id}/tree/`),

  // Members
  getMembers: (departmentId?: number) =>
    api.get<DepartmentMember[]>('/api/hierarchy/members/', {
      params: departmentId ? { department: departmentId } : undefined,
    }),

  createMember: (data: {
    department: number;
    employee: number;
    role: string;
    parent?: number | null;
  }) => api.post<DepartmentMember>('/api/hierarchy/members/', data),

  updateMember: (id: number, data: Partial<DepartmentMember>) =>
    api.patch<DepartmentMember>(`/api/hierarchy/members/${id}/`, data),

  deleteMember: (id: number) =>
    api.delete(`/api/hierarchy/members/${id}/`),
};
