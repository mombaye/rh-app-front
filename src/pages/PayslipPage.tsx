import { useState, useEffect } from "react";
import AppLayout from "@/layouts/AppLayout";
import PayslipUploader from "@/components/payslips/PayslipUploader";
import PayslipStatusTable, { PayslipStatus } from "@/components/payslips/PayslipStatusTable";
import { uploadPayslipPdf, fetchPayslipStatus, sendBulletinsMass } from "@/services/employeeService";
import toast from "react-hot-toast";
import PayslipStatsCards from "@/components/payslips/PayslipStatsCards"; // On va le créer !
import BulletinSendProgress from "@/components/payslips/BulletinSendProgress";

export default function PayslipPage() {
  const [payslipStatus, setPayslipStatus] = useState<PayslipStatus[]>([]);
  const [loading, setLoading] = useState(true);
 
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null); // NEW
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
      try {
        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);
        // ← Utilise le service pour l’envoi massif, doit retourner {task_id}
        const data = await uploadPayslipPdf(formData);
        console.log("Upload result:", data);
        if (data.task_id) {
          setCurrentTaskId(data.task_id); // Affiche la progress bar
          toast.success("Traitement lancé : suivi de l’envoi en cours…");
        } else {
          toast.error(data.error || "Erreur au lancement.");
        }
      } catch (error) {
        toast.error("Erreur lors de l'import du fichier");
      } finally {
        setLoading(false);
      }
    };
  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-camublue-900">Bulletins de salaire</h1>
        <PayslipUploader onUpload={handleUpload} />
          {currentTaskId && (
            <BulletinSendProgress
              taskId={currentTaskId}
              onDone={() => {
                setCurrentTaskId(null);
                fetchPayslipLogs(); // Recharge la table à la fin !
              }}
            />
          )}
        <PayslipStatsCards data={payslipStatus} loading={loading} />
        <PayslipStatusTable data={payslipStatus} />
      </div>
    </AppLayout>
  );
}
