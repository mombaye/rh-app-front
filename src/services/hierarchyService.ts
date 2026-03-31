import api from "@/api/axios";
import type { Department, DepartmentMember, DepartmentTree } from "@/types/hierarchy";

export const getDepartments = async (): Promise<Department[]> => {
  const res = await api.get("/api/hierarchy/departments/");
  return res.data;
};

export const getDepartment = async (id: number): Promise<Department> => {
  const res = await api.get(`/api/hierarchy/departments/${id}/`);
  return res.data;
};

export const createDepartment = async (data: Partial<Department>): Promise<Department> => {
  const res = await api.post("/api/hierarchy/departments/", data);
  return res.data;
};

export const updateDepartment = async (id: number, data: Partial<Department>): Promise<Department> => {
  const res = await api.put(`/api/hierarchy/departments/${id}/`, data);
  return res.data;
};

export const deleteDepartment = async (id: number): Promise<void> => {
  await api.delete(`/api/hierarchy/departments/${id}/`);
};

export const getDepartmentTree = async (id: number): Promise<DepartmentTree> => {
  const res = await api.get(`/api/hierarchy/departments/${id}/tree/`);
  return res.data;
};

export const getAllDepartmentsOverview = async (): Promise<DepartmentTree[]> => {
  const res = await api.get("/api/hierarchy/departments/overview/");
  return res.data;
};

export const getMembers = async (departmentId?: number): Promise<DepartmentMember[]> => {
  const params = departmentId ? { department: departmentId } : {};
  const res = await api.get("/api/hierarchy/members/", { params });
  return res.data;
};

export const addMember = async (data: {
  department: number;
  employee: number;
  role: string;
  parent?: number | null;
}): Promise<DepartmentMember> => {
  const res = await api.post("/api/hierarchy/members/", data);
  return res.data;
};

export const updateMember = async (
  id: number,
  data: Partial<DepartmentMember>
): Promise<DepartmentMember> => {
  const res = await api.patch(`/api/hierarchy/members/${id}/`, data);
  return res.data;
};

export const removeMember = async (id: number): Promise<void> => {
  await api.delete(`/api/hierarchy/members/${id}/`);
};
