import api from "@/api/axios";
import { Employee } from "@/types/employee";
// ... autres imports ...
import { PayslipStatus } from "@/components/payslips/PayslipStatusTable";

// ...

export const getEmployees = async (): Promise<Employee[]> => {
  const res = await api.get("/api/employees/");
  return Array.isArray(res.data) ? res.data : []; // 🔥 Ajout de sécurité
};


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




export const fetchPayslipStatus = async (): Promise<PayslipStatus[]> => {
  const res = await api.get("/api/employees/bulletins-envoyes-recents/");
  // On mappe pour convertir les champs backend → frontend
  return Array.isArray(res.data)
    ? res.data.map((item: any) => ({
        matricule: item.matricule,
        email: item.email,
        employee_id: item.employees_id,
        status:
          item.statut === "succès"
            ? "sent"
            : item.statut === "échec"
            ? "failed"
            : "pending",
        sent_at: item.date_envoi
          ? new Date(item.date_envoi).toLocaleString()
          : undefined,
      }))
    : [];
};



export const createAccountFromEmployee = async (employeeId: number) => {
  // Ici, tu appelles l’endpoint DRF sur UN SEUL employé
  const res = await api.post("/api/employees/create-accounts/", {
    employee_ids: [employeeId]
  });
  return res.data;
};





export const sendBulletinToUser = async ({
  matricule,
  email,
  months,
}: {
  matricule: string;
  email?: string;
  months: { year: number; month: number }[];
}) => {
  const res = await api.post("/api/employees/send-bulletins-to-user/", {
    matricule,
    email,
    mois: months,
  });
  return res.data;
};


export const fetchAvailableBulletins = async (matricule: string) => {
  const res = await api.get(`/api/employees/${matricule}/available-bulletins/`);
  // Retourne directement le tableau [{ year: number, month: number }, ...]
  return Array.isArray(res.data) ? res.data : [];
};