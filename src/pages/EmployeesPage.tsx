import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import EmployeesStatsHeader from "@/components/employees/EmployeesStatsHeader";
import EmployeesTable from "@/components/employees/EmployeeTable";
import ExitEmployeeModal from "@/components/employees/ExitEmployeeModal";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal";
import { Employee } from "@/types/employee";
import { getEmployees, importEmployees, markExit, reinstate, createAccountFromEmployee } from "@/services/employeeService";
import { FaPlus } from "react-icons/fa";
import toast from "react-hot-toast";
import ReinstateEmployeeModal from "@/components/employees/ReinstateEmployeeModal";


type StatusFilter = 'ALL' | 'ACTIVE' | 'EXITED';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [reinstateTarget, setReinstateTarget] = useState<Employee | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');

  // Sortie modal
  const [exitOpen, setExitOpen] = useState(false);
  const [exitTarget, setExitTarget] = useState<Employee | null>(null);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await getEmployees({ status: statusFilter });
      setEmployees(data);
    } catch {
      toast.error("Erreur lors du chargement des employés");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter]);

  const handleEdit = (employee: Employee) => {
    setSelected(employee);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelected(null);
    setShowModal(true);
  };

  const handleCloseModal = () => setShowModal(false);

  // → on remplace "delete" par "exit"
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
      fetchEmployees();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l’enregistrement de la sortie");
    }
  };

  const handleReinstate = async (emp: Employee) => {
    try {
      await reinstate(emp.id);
      toast.success(`${emp.prenom} ${emp.nom} réintégré`);
      fetchEmployees();
    } catch {
      toast.error("Erreur lors de la réintégration");
    }
  };

  const handleImport = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      await importEmployees(formData);
      toast.success("Import terminé avec succès");
      fetchEmployees();
    } catch {
      toast.error("Erreur lors de l'import");
    }
  };

  const openReinstate = (emp: Employee) => { setReinstateTarget(emp); setReinstateOpen(true); };

  const doReinstate = async (payload: { date_reintegration?: string; update_date_embauche?: boolean }) => {
    if (!reinstateTarget) return;
    await reinstate(reinstateTarget.id, payload);   // <-- envoie la date au backend
    toast.success(`${reinstateTarget.prenom} ${reinstateTarget.nom} réintégré`);
    setReinstateOpen(false);
    setReinstateTarget(null);
    fetchEmployees();
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center">
          <h1 className="text-3xl font-bold text-camublue-900">Gestion des employés</h1>

          <div className="flex items-center gap-3">
            {/* Filtre statut */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-camublue-900"
              title="Filtrer par statut"
            >
              <option value="ACTIVE">Actifs</option>
              <option value="EXITED">Sortis</option>
              <option value="ALL">Tous</option>
            </select>

            <button
              onClick={handleCreate}
              className="bg-camublue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 transition"
            >
              <FaPlus /> Ajouter
            </button>
          </div>
        </div>

        <EmployeesStatsHeader data={employees} loading={isLoading} />

        <EmployeesTable
          employees={employees}
          isLoading={isLoading}
          onEdit={handleEdit}
          onExit={handleExitClick}
          onReinstate={openReinstate}
          onImport={handleImport}
        />


        <EmployeeFormModal
          open={showModal}
          onClose={handleCloseModal}
          onSuccess={fetchEmployees}
          initialData={selected}
        />

        <ExitEmployeeModal
          open={exitOpen}
          onClose={() => setExitOpen(false)}
          employee={exitTarget}
          onConfirm={handleConfirmExit}
        />

        <ReinstateEmployeeModal
          open={reinstateOpen}
          onClose={()=>setReinstateOpen(false)}
          employee={reinstateTarget}
          onConfirm={doReinstate}
        />
      </motion.div>
    </AppLayout>
  );
}
