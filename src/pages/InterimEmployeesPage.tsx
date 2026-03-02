import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import EmployeesStatsHeader from "@/components/employees/EmployeesStatsHeader";
import EmployeesTable from "@/components/employees/EmployeeTable";
import ExitEmployeeModal from "@/components/employees/ExitEmployeeModal";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal";
import ReinstateEmployeeModal from "@/components/employees/ReinstateEmployeeModal";
import { Employee } from "@/types/employee";
import {
  getEmployees,
  importEmployees,
  markExit,
  reinstate,
  sendAccessCodesInterim,
} from "@/services/employeeService";
import { FaPlus, FaPaperPlane } from "react-icons/fa";
import toast from "react-hot-toast";
import { Menu } from "@headlessui/react";

export default function InterimEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [reinstateTarget, setReinstateTarget] = useState<Employee | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitTarget, setExitTarget] = useState<Employee | null>(null);
  const [isSendingCodes, setIsSendingCodes] = useState(false);

  const fetchInterimEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await getEmployees({ type_contrat: "INTERIM" });
      setEmployees(data);
    } catch (error) {
      console.error("Erreur lors du chargement des employés intérimaires :", error);
      toast.error("Erreur lors du chargement des employés intérimaires");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInterimEmployees();
  }, []);

  const handleEdit = (employee: Employee) => {
    setSelected(employee);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelected(null);
    setShowModal(true);
  };

  const handleExitClick = (emp: Employee) => {
    setExitTarget(emp);
    setExitOpen(true);
  };

  const handleConfirmExit = async (payload: { date_sortie: string; motif_sortie?: string }) => {
    if (!exitTarget) return;
    try {
      await markExit(exitTarget.id, payload);
      toast.success(`Sortie enregistrée pour ${exitTarget.prenom} ${exitTarget.nom}`);
      setExitOpen(false);
      setExitTarget(null);
      fetchInterimEmployees();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'enregistrement de la sortie");
    }
  };

  const handleImport = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await importEmployees(formData);
      const c = result.created ?? 0;
      const u = result.updated ?? 0;
      const s = result.skipped ?? 0;
      if (s > 0) {
        toast.error(`Import terminé — ${s} ligne(s) ignorée(s)`);
      } else {
        toast.success(`Import terminé — ${c} employé(s) INTERIM créé(s), ${u} mis à jour`);
      }
      fetchInterimEmployees();
    } catch (err: any) {
      toast.error("Erreur lors de l'import");
      console.error(err?.response?.data);
    }
  };

  const openReinstate = (emp: Employee) => {
    setReinstateTarget(emp);
    setReinstateOpen(true);
  };

  const doReinstate = async (payload: { date_reintegration?: string; update_date_embauche?: boolean }) => {
    if (!reinstateTarget) return;
    try {
      await reinstate(reinstateTarget.id, payload);
      toast.success(`${reinstateTarget.prenom} ${reinstateTarget.nom} réintégré(e)`);
      setReinstateOpen(false);
      setReinstateTarget(null);
      fetchInterimEmployees();
    } catch {
      toast.error("Erreur lors de la réintégration");
    }
  };

  const handleSendAccessCodes = async () => {
    setIsSendingCodes(true);
    try {
      const result = await sendAccessCodesInterim();
      toast.success(`Codes d'accès envoyés à ${result.sent.length} employé(s) intérimaire(s)`);
    } catch {
      toast.error("Erreur lors de l'envoi des codes d'accès");
    } finally {
      setIsSendingCodes(false);
    }
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-6 p-6"
      >
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center shrink-0">
          <h1 className="text-3xl font-bold text-camublue-900">
            Gestion des employés intérimaires
          </h1>
          <div className="flex items-center gap-3">
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button
                onClick={handleSendAccessCodes}
                disabled={isSendingCodes}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-70"
              >
                <FaPaperPlane size={13} />
                {isSendingCodes ? "Envoi en cours..." : "Envoyer les codes"}
              </Menu.Button>
            </Menu>

            <button
              onClick={handleCreate}
              className="bg-camublue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 transition"
            >
              <FaPlus /> Ajouter un intérimaire
            </button>
          </div>
        </div>

        <div className="shrink-0">
          <EmployeesStatsHeader data={employees} loading={isLoading} />
        </div>

        <div className="flex-1 min-h-0">
          <EmployeesTable
            employees={employees}
            isLoading={isLoading}
            onEdit={handleEdit}
            onExit={handleExitClick}
            onReinstate={openReinstate}
            onImport={handleImport}
            showContractType={false}
          />
        </div>

        <EmployeeFormModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={fetchInterimEmployees}
          initialData={selected}
          defaultContractType="INTERIM"
        />
        <ExitEmployeeModal
          open={exitOpen}
          onClose={() => setExitOpen(false)}
          employee={exitTarget}
          onConfirm={handleConfirmExit}
        />
        <ReinstateEmployeeModal
          open={reinstateOpen}
          onClose={() => setReinstateOpen(false)}
          employee={reinstateTarget}
          onConfirm={doReinstate}
        />
      </motion.div>
    </AppLayout>
  );
}