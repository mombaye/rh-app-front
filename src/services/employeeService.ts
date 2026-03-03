import api from "@/api/axios";
import { Employee, ContractType } from "@/types/employee";

// =======================
// ===== EMPLOYEES =======
// =======================

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

export const getEmployeesByContractType = async (
  contractType: ContractType,
  status?: "ALL" | "ACTIVE" | "EXITED"
) => getEmployees({ type_contrat: contractType, status });

export const importEmployees = async (formData: FormData) => {
  const res = await api.post("/api/employees/import/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const createEmployee = async (data: Partial<Employee>) =>
  (await api.post("/api/employees/", data)).data;

export const updateEmployee = async (id: number, data: Partial<Employee>) =>
  (await api.put(`/api/employees/${id}/`, data)).data;

export const deleteEmployee = async (id: number) =>
  await api.delete(`/api/employees/${id}/`);

export const markExit = async (
  id: number,
  payload: { date_sortie: string; motif_sortie?: string }
) => (await api.post(`/api/employees/${id}/mark-exit/`, payload)).data;

export const reinstate = async (
  id: number,
  payload?: { date_reintegration?: string; update_date_embauche?: boolean }
) => (await api.post(`/api/employees/${id}/reinstate/`, payload ?? {})).data;

export const sendAccessCodesInterim = async (matricules?: string[]) => {
  const payload = matricules?.length ? { matricules } : {};
  return (await api.post("/api/employees/send-access-codes-interim/", payload)).data;
};

export const exportEmployeesExcel = async (opts?: {
  status?: "ALL" | "ACTIVE" | "EXITED";
  type_contrat?: ContractType;
}) => {
  const params: Record<string, string> = {};
  if (opts?.status)       params.status       = opts.status;
  if (opts?.type_contrat) params.type_contrat = opts.type_contrat;
  const res = await api.get("/api/employees/export/", { params, responseType: "blob" });
  const blob = new Blob([res.data], { type: res.headers["content-type"] });
  const filename = `employees_export_${opts?.type_contrat ?? "all"}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const createAccountFromEmployee = async (employeeId: number) => {
  const res = await api.post(`/api/employees/${employeeId}/create-account/`);
  return res.data;
};

export const sendAccessCodes = async (matricules: string[]) => {
  const res = await api.post("/api/employees/send-access-codes/", { matricules });
  return res.data;
};

// ══════════════════════════════════════════════════════
//  BULK UPDATE MATRICULES
// ══════════════════════════════════════════════════════

export type MatriculeUpdate = {
  id: number;
  matricule: string;
};

export type BulkUpdateMatriculesResult = {
  message: string;
  updated: number;
  errors: { id: number; matricule: string; error: string }[];
};

export const bulkUpdateMatricules = async (
  updates: MatriculeUpdate[]
): Promise<BulkUpdateMatriculesResult> => {
  const res = await api.post("/api/employees/bulk-update-matricules/", { updates });
  return res.data;
};

// ══════════════════════════════════════════════════════
//  PREVIEW MATRICULE CHANGES
// ══════════════════════════════════════════════════════

export type MatriculeChangeStatus = "changed" | "unchanged" | "not_found" | "conflict";

export type MatriculeChange = {
  id: number | null;
  nom: string;
  prenom: string;
  old_matricule: string;
  new_matricule: string;
  status: MatriculeChangeStatus;
  conflict_detail?: string;
};

export type PreviewMatriculeChangesResult = {
  changes: MatriculeChange[];
  summary: {
    changed: number;
    unchanged: number;
    not_found: number;
    conflict: number;
  };
};

export const previewMatriculeChanges = async (
  file: File
): Promise<PreviewMatriculeChangesResult> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/api/employees/preview-matricule-changes/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

// ══════════════════════════════════════════════════════
//  BULLETINS / PAYSLIPS
//
//  ⚠️  Tous les endpoints sont sous /api/employees/ via EmployeeViewSet.
//      Il n'existe PAS de router /api/bulletins/.
//
//  Endpoints réels (views.py) :
//   POST   /api/employees/send-bulletins/
//   POST   /api/employees/send-bulletins-preview/
//   POST   /api/employees/send-bulletins-selected/
//   POST   /api/employees/send-bulletins-to-user/
//   GET    /api/employees/<pk>/available-bulletins/
//   GET    /api/employees/bulletins-envoyes-recents/
//   GET    /api/employees/bulletins-preview-progress/<task_id>/  (vue standalone)
//   GET    /api/employees/bulletins-progress/<task_id>/          (vue standalone)
// ══════════════════════════════════════════════════════

export type PayslipPreviewResponse = {
  batch_id: string;
  year: number;
  month: number;
  items: { matricule: string; nom?: string; prenom?: string; email?: string }[];
};

export type BulletinEnvoiLog = {
  id: number;
  matricule: string;
  nom?: string;
  prenom?: string;
  email?: string;
  date_envoi: string;
  year: number;
  month: number;
  status: "sent" | "failed";
  error?: string;
};

export type BulletinMonthSummary = {
  year: number;
  month: number;
  total: number;
  sent: number;
  failed: number;
};

/** POST /api/employees/send-bulletins/ → { task_id } */
export const uploadPayslipPdf = async (formData: FormData) => {
  const res = await api.post("/api/employees/send-bulletins/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

/** POST /api/employees/send-bulletins-preview/ → { task_id, batch_id } */
export const startPreviewPayslipPdf = async (formData: FormData) => {
  const res = await api.post("/api/employees/send-bulletins-preview/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

/** GET /api/employees/bulletins-preview-progress/<taskId>/ */
export const fetchPayslipPreviewProgress = async (taskId: string) => {
  const res = await api.get(`/api/employees/bulletins-preview-progress/${taskId}/`);
  return res.data;
};

/** GET /api/employees/bulletins-progress/<taskId>/ */
export const fetchBulletinProgress = async (taskId: string) => {
  const res = await api.get(`/api/employees/bulletins-progress/${taskId}/`);
  return res.data;
};

/** POST /api/employees/send-bulletins-selected/ */
export const sendBulletinsSelected = async (payload: {
  batch_id: string;
  year: number;
  month: number;
  matricules: string[];
}) => {
  const res = await api.post("/api/employees/send-bulletins-selected/", payload);
  return res.data;
};

/** POST /api/employees/send-bulletins-to-user/ */
export const sendBulletinsToUser = async (payload: {
  matricule: string;
  email?: string;
  mois: { year: number; month: number }[];
}) => {
  const res = await api.post("/api/employees/send-bulletins-to-user/", payload);
  return res.data;
};

/** GET /api/employees/<matricule>/available-bulletins/ */
export const fetchAvailableBulletins = async (matricule: string) => {
  const res = await api.get(`/api/employees/${matricule}/available-bulletins/`);
  return res.data as { year: number; month: number }[];
};

/**
 * Agrège les logs par mois côté client.
 * Remplace fetchBulletinsSummary() → /api/bulletins/summary/ (n'existe pas).
 * Source réelle : GET /api/employees/bulletins-envoyes-recents/
 */
export const fetchBulletinsSummary = async (opts?: {
  start?: string;
  end?: string;
}): Promise<BulletinMonthSummary[]> => {
  const res = await api.get("/api/employees/bulletins-envoyes-recents/");
  const logs: BulletinEnvoiLog[] = res.data;

  const filtered = logs.filter((log) => {
    if (opts?.start && log.date_envoi < opts.start) return false;
    if (opts?.end   && log.date_envoi > opts.end + "T23:59:59") return false;
    return true;
  });

  const map = new Map<string, BulletinMonthSummary>();
  for (const log of filtered) {
    const key = `${log.year}-${log.month}`;
    if (!map.has(key)) {
      map.set(key, { year: log.year, month: log.month, total: 0, sent: 0, failed: 0 });
    }
    const entry = map.get(key)!;
    entry.total += 1;
    if (log.status === "sent")   entry.sent   += 1;
    if (log.status === "failed") entry.failed += 1;
  }

  return Array.from(map.values()).sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month
  );
};

/**
 * Logs bruts filtrés pour BulletinsLogsModal.
 * Remplace fetchBulletinsLogs() → /api/bulletins/logs/ (n'existe pas).
 * Source réelle : GET /api/employees/bulletins-envoyes-recents/
 */
export const fetchBulletinsLogs = async (opts?: {
  year?: number;
  month?: number;
  status?: "sent" | "failed" | "pending";
  start?: string;
  end?: string;
}): Promise<BulletinEnvoiLog[]> => {
  const res = await api.get("/api/employees/bulletins-envoyes-recents/");
  let logs: BulletinEnvoiLog[] = res.data;

  if (opts?.year)  logs = logs.filter((l) => l.year  === opts.year);
  if (opts?.month) logs = logs.filter((l) => l.month === opts.month);
  if (opts?.status && opts.status !== "pending") {
    logs = logs.filter((l) => l.status === opts.status);
  }
  if (opts?.start) logs = logs.filter((l) => l.date_envoi >= opts.start!);
  if (opts?.end)   logs = logs.filter((l) => l.date_envoi <= opts.end! + "T23:59:59");

  return logs;
};

/** Supprime un log — adapter l'URL selon urls.py */
export const deleteBulletinLog = async (id: number) =>
  await api.delete(`/api/employees/bulletin-log/${id}/`);