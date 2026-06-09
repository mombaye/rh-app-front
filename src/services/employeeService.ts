import api from "@/api/axios";
import adminApi from "@/api/adminAxios";
import { Employee, ContractType, EmployeeHistoryEntry } from "@/types/employee";

// ══════════════════════════════════════════════════════
//  EMPLOYEES
// ══════════════════════════════════════════════════════
export type GetEmployeesOptions = {
  status?: "ALL" | "ACTIVE" | "EXITED";
  type_contrat?: ContractType;
  has_matricule_change?: boolean;
};

export const getEmployees = async (
  opts?: GetEmployeesOptions
): Promise<Employee[]> => {
  const params: Record<string, string> = {};
  if (opts?.status)                params.status                = opts.status;
  if (opts?.type_contrat)          params.type_contrat          = opts.type_contrat;
  if (opts?.has_matricule_change)  params.has_matricule_change  = "true";
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
  const res = await api.post("/api/employees/import/", formData);
  return res.data;
};

export const createEmployee = async (data: Partial<Employee>) =>
  (await api.post("/api/employees/", data)).data;

export const updateEmployee = async (id: number, data: Partial<Employee>) =>
  (await api.put(`/api/employees/${id}/`, data)).data;

export const patchEmployee = async (id: number, data: Partial<Employee>) =>
  (await api.patch(`/api/employees/${id}/`, data)).data;

export const getEmployeeById = async (id: number): Promise<Employee> =>
  (await api.get(`/api/employees/${id}/`)).data;

export const getEmployeeHistory = async (id: number): Promise<EmployeeHistoryEntry[]> =>
  (await api.get(`/api/employees/${id}/history/`)).data;

// ══════════════════════════════════════════════════════
//  PARCOURS DE CARRIERE
// ══════════════════════════════════════════════════════
export type CareerEventType =
  | "EMBAUCHE"
  | "PROMOTION"
  | "CHANGEMENT_CONTRAT"
  | "RENOUVELLEMENT_CDD"
  | "RENOUVELLEMENT_STAGE"
  | "CHANGEMENT_SERVICE"
  | "TITULARISATION"
  | "STAGE_VERS_INTERIM"
  | "SORTIE"
  | "REINTEGRATION"
  | "AUTRE";

export type CareerHistoryEntry = {
  id: number | string | null;
  event_type: CareerEventType;
  event_type_display: string;
  event_date: string;
  description: string;
  matricule: string | null;
  type_contrat: string | null;
  fonction: string | null;
  categorie: string | null;
  service: string | null;
  manager: string | null;
  projet: string | null;
  business_line: string | null;
  localisation: string | null;
  date_fin_cdd: string | null;
  created_at: string | null;
  created_by: string;
  source: "computed" | "history" | "manual" | "exit" | "reinstate";
};

export const getCareerHistory = async (employeeId: number): Promise<CareerHistoryEntry[]> =>
  (await api.get(`/api/employees/${employeeId}/career-history/`)).data;

export const addCareerHistoryEntry = async (
  employeeId: number,
  entry: Partial<CareerHistoryEntry>
): Promise<CareerHistoryEntry> =>
  (await api.post(`/api/employees/${employeeId}/career-history/`, entry)).data;

// ══════════════════════════════════════════════════════
//  MUTATION CONTRACTUELLE
// ══════════════════════════════════════════════════════
export type ContractChangePayload = {
  event_type: CareerEventType;
  event_date: string;
  description?: string;
  // Champs contractuels à mettre à jour (tous optionnels)
  type_contrat?: string | null;
  date_embauche?: string | null;
  date_fin_cdd?: string | null;
  date_fin_periode_essai?: string | null;
  fonction?: string | null;
  categorie?: string | null;
  service?: string | null;
  manager?: string | null;
  projet?: string | null;
  business_line?: string | null;
  localisation?: string | null;
};

export type ContractChangeResult = {
  employee: Employee;
  career_event: CareerHistoryEntry;
};

export const applyContractChange = async (
  employeeId: number,
  payload: ContractChangePayload
): Promise<ContractChangeResult> =>
  (await api.post(`/api/employees/${employeeId}/contract-change/`, payload)).data;

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

export type BulkCreateAccountsResult = {
  total_sans_compte: number;
  comptes_crees:     number;
  details_crees:     { id: number; nom: string; email: string; role: string }[];
  erreurs:           { id: number; nom: string; erreur: string }[];
};

export const bulkCreateAccounts = async (
  contractType?: "INTERNE" | "INTERIM",
  employeeIds?:  number[],
): Promise<BulkCreateAccountsResult> => {
  const payload: Record<string, unknown> = {};
  if (contractType)              payload.contract_type  = contractType;
  if (employeeIds?.length)       payload.employee_ids   = employeeIds;
  return (await api.post("/api/employees/bulk-create-accounts/", payload)).data;
};

// ══════════════════════════════════════════════════════
//  BASCULEMENT INTÉRIMAIRE → INTERNE
// ══════════════════════════════════════════════════════
export type ConvertInterimPayload = {
  new_matricule:          string;
  new_type_contrat?:      "CDI" | "CDD" | "STAGE";
  date_embauche?:         string;
  date_fin_cdd?:          string;
  date_fin_periode_essai?: string;
  description?:           string;
};

export type ConvertInterimResult = {
  message: string;
  employee: Employee;
};

export const convertInterim = async (
  employeeId: number,
  payload: ConvertInterimPayload
): Promise<ConvertInterimResult> =>
  (await api.post(`/api/employees/${employeeId}/convert-interim/`, payload)).data;

// ── Basculement Intérimaire → Intérimaire ────────────────────────────────────
export type InterimToInterimPayload = {
  new_matricule:  string;
  new_date_debut: string;  // obligatoire — début du renouvellement
  new_date_fin:   string;  // obligatoire — fin du renouvellement
  description?:   string;
};

export const interimToInterim = async (
  employeeId: number,
  payload: InterimToInterimPayload
): Promise<ConvertInterimResult> =>
  (await api.post(`/api/employees/${employeeId}/interim-to-interim/`, payload)).data;

export const exportEmployeesExcel = async (opts?: {
  status?: "ALL" | "ACTIVE" | "EXITED";
  type_contrat?: ContractType;
}) => {
  const params: Record<string, string> = {};
  if (opts?.status)       params.status       = opts.status;
  if (opts?.type_contrat) params.type_contrat = opts.type_contrat;
  const res = await api.get("/api/employees/export/", {
    params,
    responseType: "blob",
  });
  const blob = new Blob([res.data], { type: res.headers["content-type"] });
  const filename = `employees_export_${opts?.type_contrat ?? "all"}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const createAccountFromEmployee = async (
  employeeId: number,
  managerLevel?: 1 | 2,
) => {
  // Utilise admin_access_token si disponible (portail admin),
  // sinon fallback sur access_token (interface RH classique)
  const axiosInstance = localStorage.getItem("admin_access_token") ? adminApi : api;
  const payload = managerLevel ? { manager_level: managerLevel } : {};
  return (await axiosInstance.post(`/api/employees/${employeeId}/create-account/`, payload)).data;
};

export const deleteAccountFromEmployee = async (employeeId: number) => {
  const axiosInstance = localStorage.getItem("admin_access_token") ? adminApi : api;
  return (await axiosInstance.delete(`/api/employees/${employeeId}/delete-account/`)).data;
};

export const sendAccessCodes = async (
  matricules: string[]
): Promise<{ sent: number; failed: number; errors: string[] }> =>
  (await api.post("/api/employees/send-access-codes/", { matricules })).data;

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
//  PARTAGE CHANGEMENTS MATRICULE PAR EMAIL
// ══════════════════════════════════════════════════════
export const shareMatriculeChanges = async (payload: {
  emails: string[];
  type_contrat?: string;
  columns?: string[];   // colonnes à inclure dans le fichier Excel
}): Promise<{ sent: string[]; errors: { email: string; error: string }[]; total_employees: number }> => {
  const res = await api.post("/api/employees/share-matricule-changes/", payload);
  return res.data;
};

// ══════════════════════════════════════════════════════
//  BULK SWITCH INTÉRIM → INTERNE
// ══════════════════════════════════════════════════════
export type BulkSwitchItem = {
  id: number;
  matricule: string;          // nouveau matricule numérique obligatoire
  contract_type: "CDI" | "CDD" | "STAGE";
  event_date?: string;
  date_embauche?: string;
  date_fin_contrat?: string;  // uniquement pour CDD / STAGE
};

export type BulkSwitchPayload = {
  items: BulkSwitchItem[];
};

export type BulkSwitchResult = {
  switched: number;
  errors: { id: number | null; nom?: string; prenom?: string; error: string }[];
  results: {
    id: number;
    nom: string;
    prenom: string;
    old_matricule: string;
    new_matricule: string;
    contract_type: string;
  }[];
};

export const bulkSwitchToInternal = async (
  payload: BulkSwitchPayload
): Promise<BulkSwitchResult> => {
  const res = await api.post("/api/employees/bulk-switch-to-internal/", payload);
  return res.data;
};

// ── Basculement massif Intérimaire → Intérimaire ─────────────────────────────
export type BulkInterimToInterimItem = {
  id:         number;
  matricule:  string;
  date_debut: string;  // obligatoire — renouvellement
  date_fin:   string;  // obligatoire — renouvellement
};

export const bulkInterimToInterim = async (items: BulkInterimToInterimItem[]): Promise<BulkSwitchResult> => {
  const res = await api.post("/api/employees/bulk-interim-to-interim/", { items });
  return res.data;
};

// ══════════════════════════════════════════════════════
//  PREVIEW MATRICULE CHANGES
// ══════════════════════════════════════════════════════
export type MatriculeChangeStatus =
  | "changed"
  | "unchanged"
  | "not_found"
  | "conflict";

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
  const res = await api.post(
    "/api/employees/preview-matricule-changes/",
    formData
  );
  return res.data;
};

// ══════════════════════════════════════════════════════
//  BULLETINS / PAYSLIPS
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

// Type utilisé par BulletinsLogsModal (retour de l'API paginée)
export type BulletinLogItem = {
  id: number;
  matricule: string;
  email: string | null;
  status: "sent" | "failed" | "pending";
  sent_at: string;
  statut: string;
  message: string | null;
  year: number | null;
  month: number | null;
};

export type BulletinMonthSummary = {
  year: number;
  month: number;
  total: number;
  sent: number;
  failed: number;
};

/** POST /api/employees/send-bulletins/ */
export const uploadPayslipPdf = async (formData: FormData) => {
  const res = await api.post("/api/employees/send-bulletins/", formData);
  return res.data;
};

/** POST /api/employees/send-bulletins-preview/ */
export const startPreviewPayslipPdf = async (formData: FormData) => {
  const res = await api.post(
    "/api/employees/send-bulletins-preview/",
    formData
  );
  return res.data;
};

/** GET /api/employees/preview-progress/<taskId>/ */
export const fetchPayslipPreviewProgress = async (taskId: string) =>
  (await api.get(`/api/employees/preview-progress/${taskId}/`)).data;

/** GET /api/employees/progress/<taskId>/ */
export const fetchBulletinProgress = async (taskId: string) =>
  (await api.get(`/api/employees/progress/${taskId}/`)).data;

/** POST /api/employees/send-bulletins-selected/ */
export const sendBulletinsSelected = async (payload: {
  batch_id: string;
  year: number;
  month: number;
  matricules: string[];
}) => (await api.post("/api/employees/send-bulletins-selected/", payload)).data;

/** POST /api/employees/send-bulletins-to-user/ */
export const sendBulletinsToUser = async (payload: {
  matricule: string;
  email?: string;
  mois: { year: number; month: number }[];
}) => (await api.post("/api/employees/send-bulletins-to-user/", payload)).data;

/** GET /api/employees/<matricule>/available-bulletins/ */
export const fetchAvailableBulletins = async (matricule: string) =>
  (
    await api.get(`/api/employees/${matricule}/available-bulletins/`)
  ).data as { year: number; month: number }[];

/** GET /api/employees/bulletins/logs/summary/ — agrégation par mois côté serveur */
export const fetchBulletinsSummary = async (opts?: {
  start?: string;
  end?: string;
}): Promise<BulletinMonthSummary[]> => {
  const params: Record<string, string> = {};
  if (opts?.start) params.start = opts.start;
  if (opts?.end)   params.end   = opts.end;
  const res = await api.get("/api/employees/bulletins/logs/summary/", { params });
  // trier du plus récent au plus ancien
  return (res.data as BulletinMonthSummary[]).sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month
  );
};

/** GET /api/employees/bulletins/logs/ — liste paginée côté serveur */
export const fetchBulletinsLogs = async (opts?: {
  year?: number;
  month?: number;
  status?: "sent" | "failed" | "pending";
  start?: string;
  end?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<{ count: number; results: BulletinLogItem[] }> => {
  const params: Record<string, string> = {};
  if (opts?.year)      params.year      = String(opts.year);
  if (opts?.month)     params.month     = String(opts.month);
  if (opts?.status)    params.status    = opts.status;
  if (opts?.start)     params.start     = opts.start;
  if (opts?.end)       params.end       = opts.end;
  if (opts?.search)    params.search    = opts.search;
  if (opts?.page)      params.page      = String(opts.page);
  if (opts?.page_size) params.page_size = String(opts.page_size);
  const res = await api.get("/api/employees/bulletins/logs/", { params });
  return res.data;
};

/** GET /api/employees/bulletins/logs/export/ — téléchargement CSV */
export const exportBulletinsLogs = async (opts?: {
  year?: number;
  month?: number;
  status?: "sent" | "failed" | "pending";
  start?: string;
  end?: string;
  search?: string;
}): Promise<void> => {
  const params: Record<string, string> = {};
  if (opts?.year)   params.year   = String(opts.year);
  if (opts?.month)  params.month  = String(opts.month);
  if (opts?.status) params.status = opts.status;
  if (opts?.start)  params.start  = opts.start;
  if (opts?.end)    params.end    = opts.end;
  if (opts?.search) params.search = opts.search;
  const res = await api.get("/api/employees/bulletins/logs/export/", {
    params,
    responseType: "blob",
  });
  const blob = new Blob([res.data], { type: "text/csv;charset=utf-8-sig" });
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "bulletins_logs.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};


export const deleteBulletinLog = async (id: number) =>
  (await api.delete(`/api/employees/bulletins/logs/${id}/`)).data;

// ══════════════════════════════════════════════════════
//  ALERTES PÉRIODE D'ESSAI
// ══════════════════════════════════════════════════════
export type TypeAlerte = "PERIODE_ESSAI" | "FIN_CDD" | "FIN_STAGE" | "FIN_INTERIM";

export type AlertePeriodeEssai = {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  fonction: string;
  service: string;
  localisation: string;
  type_contrat: string;
  type_alerte: TypeAlerte;
  date_fin: string;
  date_fin_periode_essai: string; // alias compat — même valeur que date_fin
  jours_restants: number;
};

export type AlertesPeriodeEssaiResult = {
  count: number;
  jours: number;
  results: AlertePeriodeEssai[];
};

export const getAlertesPeriodeEssai = async (
  jours = 30
): Promise<AlertesPeriodeEssaiResult> => {
  const res = await api.get("/api/employees/alertes-periode-essai/", {
    params: { jours },
  });
  return res.data;
};

/** DELETE /api/employees/bulletins/logs/by-month/?year=&month= */
export const deleteBulletinsByMonth = async (
  year: number,
  month: number,
): Promise<{ deleted: number }> =>
  (await api.delete("/api/employees/bulletins/logs/by-month/", { params: { year, month } })).data;

/** DELETE /api/employees/bulletins/logs/by-month-failed/?year=&month= — supprime uniquement les échecs */
export const deleteBulletinFailedByMonth = async (
  year: number,
  month: number,
): Promise<{ deleted: number }> =>
  (await api.delete("/api/employees/bulletins/logs/by-month-failed/", { params: { year, month } })).data;

// ══════════════════════════════════════════════════════
//  DOCUMENTS RH — dossiers personnels NAS
// ══════════════════════════════════════════════════════
export type DocumentItem = {
  name: string;
  type: "folder" | "file";
  size?: number;
  modified?: string;
};

export type EmployeeDocumentsResult = {
  matricule: string;
  folder_found: boolean;
  folder_name?: string;
  path: string;
  items: DocumentItem[];
};

/** GET /api/employees/{id}/documents/?path=... */
export const getEmployeeDocuments = async (
  employeeId: number | string,
  path?: string
): Promise<EmployeeDocumentsResult> => {
  const params: Record<string, string> = {};
  if (path) params.path = path;
  const res = await api.get(`/api/employees/${employeeId}/documents/`, { params });
  return res.data;
};

/** GET /api/employees/{id}/documents/download/?path=... */
export const downloadEmployeeDocument = async (
  employeeId: number | string,
  filePath: string
): Promise<void> => {
  const res = await api.get(
    `/api/employees/${employeeId}/documents/download/`,
    { params: { path: filePath }, responseType: "blob" }
  );
  const blob     = new Blob([res.data], {
    type: res.headers["content-type"] || "application/octet-stream",
  });
  const filename = filePath.split("/").pop() || "document";
  const url      = window.URL.createObjectURL(blob);
  const a        = document.createElement("a");
  a.href         = url;
  a.download     = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// ══════════════════════════════════════════════════════
//  DOCUMENTS RH — import ZIP (dossiers de tous les employés)
// ══════════════════════════════════════════════════════
export type ZipImportFolderResult = {
  folder: string;
  dest: string;
  status: "created" | "merged";
  files: number;
};

export type ZipImportResult = {
  processed: number;
  total_files: number;
  results: ZipImportFolderResult[];
  errors: { folder: string; error: string }[];
};

/** POST /api/employees/upload-zip-dossiers/ */
export const uploadDossierZip = async (
  file: File,
  onUploadProgress?: (percent: number) => void
): Promise<ZipImportResult> => {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/api/employees/upload-zip-dossiers/", form, {
    onUploadProgress: onUploadProgress
      ? (e) => {
          if (e.total) onUploadProgress(Math.round((e.loaded * 100) / e.total));
        }
      : undefined,
  });
  return res.data;
};

// ─── Demande d'accès aux bulletins antérieurs ─────────────────────────────────
export const requestPayslipAccess = async (payload: {
  months: { year: number; month: number }[];
  message?: string;
}): Promise<{ detail: string; request_id: number }> =>
  (await api.post("/api/employees/request-payslip-access/", payload)).data;

// ─── Pointages de l'employé connecté ─────────────────────────────────────────
export const fetchMyAttendance = async (start: string, end: string) =>
  (await api.get("/api/attendance/my-attendance/", { params: { start, end } })).data as {
    employee_id: number;
    matricule: string;
    start: string;
    end: string;
    days: {
      date: string;
      status: "present" | "absent" | "incomplete";
      in_time: string | null;
      out_time: string | null;
      worked_minutes: number;
      flags: Record<string, unknown>;
    }[];
  };

// ─── Pointages bruts machine (justification d'absence) ───────────────────────
export type RawPunchRecord = {
  time: string;
  person_id: string;
  device_ip: string;
  checkpoint: string | null;
};

export const fetchMyRawPunches = async (date: string) =>
  (await api.get("/api/attendance/my-punches/", { params: { date } })).data as {
    date: string;
    employee_id: number;
    matricule: string;
    punches: RawPunchRecord[];
    message?: string;
  };

// ─── Justifications d'absence (disputes) ─────────────────────────────────────
export type AttendanceDispute = {
  id: number;
  work_date: string;
  justification_text: string;
  status: "pending" | "approved" | "rejected";
  raw_punch_count: number;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string;
};

export const fetchMyDisputes = async (): Promise<AttendanceDispute[]> =>
  (await api.get("/api/attendance/my-disputes/")).data;

export const submitDispute = async (work_date: string, justification_text: string) =>
  (await api.post("/api/attendance/my-disputes/", { work_date, justification_text })).data as {
    id: number;
    work_date: string;
    status: string;
    raw_punch_count: number;
    created_at: string;
  };
