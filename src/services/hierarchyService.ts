import api from '@/api/axios';
import type {
  Department,
  HierarchyNode,
  DepartmentWithTree,
} from '@/types/hierarchy';

// --- Departments ---

export const getDepartments = async (activeOnly = true): Promise<Department[]> => {
  const params: Record<string, string> = {};
  if (activeOnly) params.is_active = 'true';
  const res = await api.get('/api/hierarchy/departments/', { params });
  return res.data;
};

export const getDepartment = async (id: number): Promise<Department> => {
  const res = await api.get(`/api/hierarchy/departments/${id}/`);
  return res.data;
};

export const createDepartment = async (data: Partial<Department>): Promise<Department> => {
  const res = await api.post('/api/hierarchy/departments/', data);
  return res.data;
};

export const updateDepartment = async (id: number, data: Partial<Department>): Promise<Department> => {
  const res = await api.put(`/api/hierarchy/departments/${id}/`, data);
  return res.data;
};

export const deleteDepartment = async (id: number): Promise<void> => {
  await api.delete(`/api/hierarchy/departments/${id}/`);
};

export const getDepartmentTree = async (id: number): Promise<DepartmentWithTree> => {
  const res = await api.get(`/api/hierarchy/departments/${id}/tree/`);
  return res.data;
};

export const getAllDepartmentTrees = async (): Promise<DepartmentWithTree[]> => {
  const res = await api.get('/api/hierarchy/departments/with_trees/');
  return res.data;
};

// --- Hierarchy Nodes ---

export const getNodes = async (params?: {
  department?: number;
  level?: string;
  parent?: number | 'null';
}): Promise<HierarchyNode[]> => {
  const res = await api.get('/api/hierarchy/nodes/', { params });
  return res.data;
};

export const createNode = async (data: Partial<HierarchyNode>): Promise<HierarchyNode> => {
  const res = await api.post('/api/hierarchy/nodes/', data);
  return res.data;
};

export const updateNode = async (id: number, data: Partial<HierarchyNode>): Promise<HierarchyNode> => {
  const res = await api.put(`/api/hierarchy/nodes/${id}/`, data);
  return res.data;
};

export const deleteNode = async (id: number): Promise<void> => {
  await api.delete(`/api/hierarchy/nodes/${id}/`);
};
