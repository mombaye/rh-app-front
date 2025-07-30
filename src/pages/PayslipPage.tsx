import { useState, useEffect } from "react";
import AppLayout from "@/layouts/AppLayout";
import PayslipUploader from "@/components/payslips/PayslipUploader";
import PayslipStatusTable, { PayslipStatus } from "@/components/payslips/PayslipStatusTable";
import { uploadPayslipPdf, fetchPayslipStatus } from "@/services/employeeService";
import toast from "react-hot-toast";
import PayslipStatsCards from "@/components/payslips/PayslipStatsCards"; // On va le créer !

export default function PayslipPage() {
  const [payslipStatus, setPayslipStatus] = useState<PayslipStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayslipLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchPayslipStatus(); // Doit retourner un tableau
      setPayslipStatus(data);
    } catch {
      toast.error("Erreur lors de la récupération de l'historique");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPayslipLogs();
  }, []);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      await uploadPayslipPdf(formData);
      toast.success("Fichier traité avec succès");
      fetchPayslipLogs(); // Rafraîchit l'historique après upload
    } catch (error) {
      toast.error("Erreur lors de l'import du fichier");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-camublue-900">Bulletins de salaire</h1>
        <PayslipUploader onUpload={handleUpload} />
        <PayslipStatsCards data={payslipStatus} loading={loading} />
        <PayslipStatusTable data={payslipStatus} />
      </div>
    </AppLayout>
  );
}
