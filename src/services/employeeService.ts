import api from "@/api/axios";
import { Employee } from "@/types/employee";


// ...


export type PayslipPreviewItem = {
  matricule: string;
  employee_id: number | null;
  fullname: string;
  email: string;
  page: number;
  can_send: boolean;
  reason?: string | null;
};

export type PayslipPreviewResponse = {
  batch_id: string;
  year: number;
  month: number;
  total_pages: number;
  items: PayslipPreviewItem[];
  errors: string[];
};

export type BulletinMonthSummary = {
  year: number;
  month: number;
  total: number;
  sent: number;
  failed: number;
  pending: number;
};

export type BulletinLogItem = {
  id: number;
  matricule: string;
  email: string;
  status: "sent" | "failed" | "pending";
  sent_at?: string;
  statut?: string;
  message?: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};


export type BulletinMonth = { year: number; month: number };



export async function sendBulletinsToUser(payload: {
  matricule: string;
  mois: BulletinMonth[];
  email?: string; // optionnel
}): Promise<{ message: string; not_found?: string[]; errors?: string[] }> {
  const { data } = await api.post(`/api/employees/send-bulletins-to-user/`, payload);
  return data;
}

export const createEmployee = async (data: Partial<Employee>) => {
  const res = await api.post("/api/employees/", data);
  return res.data;
};

export const updateEmployee = async (id: number, data: Partial<Employee>) => {
  const res = await api.put(`/api/employees/${id}/`, data);
  return res.data;
};

export const deleteEmployee = async (id: number) => {
  await api.delete(`/api/employees/${id}/`);
};



// Correction dans employeeService.ts :

export const importEmployees = async (formData: FormData) => {
  const res = await api.post("/api/employees/import/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};


export const uploadPayslipPdf = async (formData: FormData) => {
  const res = await api.post("/api/employees/send-bulletins/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};








export async function sendAccessCodes(matricules?: string[]) {
  // Si matricules est undefined ou [], l’API enverra à tout le monde
  const payload = matricules && matricules.length ? { matricules } : {};
  const { data } = await api.post("/api/employees/send-access-codes/", payload);
  return data as { sent: string[]; errors: string[] };
}



export const createAccountFromEmployee = async (employeeId: number) => {
  // Ici, tu appelles l’endpoint DRF sur UN SEUL employé
  const res = await api.post("/api/employees/create-accounts/", {
    employee_ids: [employeeId]
  });
  return res.data;
};








export const fetchAvailableBulletins = async (matricule: string) => {
  const res = await api.get(`/api/employees/${matricule}/available-bulletins/`);
  // Retourne directement le tableau [{ year: number, month: number }, ...]
  return Array.isArray(res.data) ? res.data : [];
};

// services/employeeService.ts

// Pour lancer l’envoi massif (upload PDF)
export const sendBulletinsMass = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/api/employees/send-bulletins/", formData);
  return res.data;
};


// Pour suivre la progression Celery
export const fetchBulletinProgress = async (taskId: string) => {
  const res = await api.get(`/api/employees/progress/${taskId}/`);
  return res.data;
};




// services/employeeService.ts
export const getEmployees = async (opts?: { status?: 'ALL' | 'ACTIVE' | 'EXITED' }) => {
  const params: Record<string, any> = {};
  if (opts?.status) params.status = opts.status;   // ACTIVE / EXITED / ALL
  const res = await api.get('/api/employees/', { params });
  return Array.isArray(res.data) ? res.data : [];
};



// 🔁 “Sortie” (soft-delete)
export const markExit = async (id: number, payload: { date_sortie: string; motif_sortie?: string }) => {
  const res = await api.post(`/api/employees/${id}/mark-exit/`, payload);
  return res.data as Employee;
};




// services/employeeService.ts
export const reinstate = async (
  id: number,
  payload?: { date_reintegration?: string; update_date_embauche?: boolean }
) => {
  const res = await api.post(`/api/employees/${id}/reinstate/`, payload ?? {});
  return res.data;
};





type ExportStatus = "ALL" | "ACTIVE" | "EXITED";

function getFilenameFromContentDisposition(cd?: string) {
  if (!cd) return null;

  // filename="..."
  const m1 = /filename="?([^"]+)"?/i.exec(cd);
  if (m1?.[1]) return m1[1];

  // filename*=UTF-8''...
  const m2 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
  if (m2?.[1]) {
    try {
      return decodeURIComponent(m2[1]);
    } catch {
      return m2[1];
    }
  }

  return null;
}

export async function exportEmployeesExcel(opts?: { status?: ExportStatus }) {
  const params: Record<string, any> = {};
  if (opts?.status) params.status = opts.status; // ACTIVE / EXITED / ALL

  const res = await api.get("/api/employees/export/", {
    params,
    responseType: "blob",
  });

  const contentType =
    res.headers?.["content-type"] ||
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const blob = new Blob([res.data], { type: contentType });

  const cd = res.headers?.["content-disposition"];
  const filename =
    getFilenameFromContentDisposition(cd) ||
    `employees_export_${new Date().toISOString().slice(0, 10)}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}



export const previewPayslipPdf = async (formData: FormData): Promise<PayslipPreviewResponse> => {
  const res = await api.post("/api/employees/send-bulletins-preview/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const sendBulletinsSelected = async (payload: {
  batch_id: string;
  year: number;
  month: number;
  matricules: string[];
}) => {
  const res = await api.post("/api/employees/send-bulletins-selected/", payload);
  return res.data as { task_id: string; message?: string };
};


export type PayslipPreviewStartResponse = {
  task_id: string;
  batch_id: string;
};

export const startPreviewPayslipPdf = async (formData: FormData): Promise<PayslipPreviewStartResponse> => {
  const res = await api.post("/api/employees/send-bulletins-preview/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const fetchPayslipPreviewProgress = async (taskId: string) => {
  const res = await api.get(`/api/employees/preview-progress/${taskId}/`);
  return res.data; // {status, progress, result?}
};




export async function fetchBulletinsSummary(params: { start: string; end: string }) {
  const res = await api.get<BulletinMonthSummary[]>("/api/employees/bulletins/logs/summary/", { params });
  return res.data;
}

export async function fetchBulletinsLogs(params: {
  start: string; end: string;
  year?: number; month?: number;
  status?: "sent" | "failed" | "pending";
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const res = await api.get<Paginated<BulletinLogItem>>("/api/employees/bulletins/logs/", { params });
  return res.data;
}

export async function deleteBulletinLog(id: number) {
  await api.delete(`/api/employees/bulletins/logs/${id}/`);
}

