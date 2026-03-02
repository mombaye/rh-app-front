import api from "@/api/axios";
import { Employee, ContractType } from "@/types/employee";

// Récupération employés
export type GetEmployeesOptions = {
  status?: "ALL" | "ACTIVE" | "EXITED";
  type_contrat?: ContractType;
};
export const getEmployees = async (opts?: GetEmployeesOptions): Promise<Employee[]> => {
  const params: Record<string, string> = {};
  if (opts?.status)       params.status       = opts.status;
  if (opts?.type_contrat) params.type_contrat = opts.type_contrat;
  const res = await api.get("/api/employees/", { params });
  return Array.isArray(res.data) ? res.data : [];
};
export const getInterimEmployees = async (): Promise<Employee[]> =>
  getEmployees({ type_contrat: "INTERIM" });
export const getInternalEmployees = async (): Promise<Employee[]> =>
  getEmployees({ type_contrat: "INTERNE" });
export const getEmployeesByContractType = async (contractType: ContractType, status?: "ALL" | "ACTIVE" | "EXITED") =>
  getEmployees({ type_contrat: contractType, status });

// Import
export const importEmployees = async (formData: FormData) => {
  const res = await api.post("/api/employees/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

// CRUD
export const createEmployee = async (data: Partial<Employee>) => (await api.post("/api/employees/", data)).data;
export const updateEmployee = async (id: number, data: Partial<Employee>) => (await api.put(`/api/employees/${id}/`, data)).data;
export const deleteEmployee = async (id: number) => await api.delete(`/api/employees/${id}/`);

// Sorties / Réintégration
export const markExit = async (id: number, payload: { date_sortie: string; motif_sortie?: string }) =>
  (await api.post(`/api/employees/${id}/mark-exit/`, payload)).data;
export const reinstate = async (id: number, payload?: { date_reintegration?: string; update_date_embauche?: boolean }) =>
  (await api.post(`/api/employees/${id}/reinstate/`, payload ?? {})).data;

// Codes d'accès
export const sendAccessCodesInterim = async (matricules?: string[]) => {
  const payload = matricules?.length ? { matricules } : {};
  return (await api.post("/api/employees/send-access-codes-interim/", payload)).data;
};

// Export Excel
export async function exportEmployeesExcel(opts?: { status?: "ALL" | "ACTIVE" | "EXITED"; type_contrat?: ContractType }) {
  const params: Record<string, string> = {};
  if (opts?.status)       params.status       = opts.status;
  if (opts?.type_contrat) params.type_contrat = opts.type_contrat;
  const res = await api.get("/api/employees/export/", { params, responseType: "blob" });
  const blob = new Blob([res.data], { type: res.headers["content-type"] });
  const filename = `employees_export_${opts?.type_contrat ?? "all"}_${new Date().toISOString().slice(0,10)}.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}