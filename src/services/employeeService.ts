import axios from "@/api/axios";
import { Employee } from "@/types/employee";
// ... autres imports ...
import { PayslipStatus } from "@/components/payslips/PayslipStatusTable";

// ...

export const getEmployees = async (): Promise<Employee[]> => {
  const res = await axios.get("/api/employees/");
  return Array.isArray(res.data) ? res.data : []; // 🔥 Ajout de sécurité
};


export const createEmployee = async (data: Partial<Employee>) => {
  const res = await axios.post("/api/employees/", data);
  return res.data;
};

export const updateEmployee = async (id: number, data: Partial<Employee>) => {
  const res = await axios.put(`/api/employees/${id}/`, data);
  return res.data;
};

export const deleteEmployee = async (id: number) => {
  await axios.delete(`/api/employees/${id}/`);
};



// Correction dans employeeService.ts :

export const importEmployees = async (formData: FormData) => {
  const res = await axios.post("/api/employees/import/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};


export const uploadPayslipPdf = async (formData: FormData) => {
  const res = await axios.post("/api/employees/send-bulletins/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};




export const fetchPayslipStatus = async (): Promise<PayslipStatus[]> => {
  const res = await axios.get("/api/employees/bulletins-envoyes-recents/");
  // On mappe pour convertir les champs backend → frontend
  return Array.isArray(res.data)
    ? res.data.map((item: any) => ({
        matricule: item.matricule,
        email: item.email,
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
