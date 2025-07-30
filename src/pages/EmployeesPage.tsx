import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import EmployeesStatsHeader from "@/components/employees/EmployeesStatsHeader";
import EmployeesTable from "@/components/employees/EmployeeTable";
import { Employee } from "@/types/employee";
import { getEmployees, deleteEmployee, importEmployees } from "@/services/employeeService";
import { FaPlus } from "react-icons/fa";
import toast from "react-hot-toast";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      toast.error("Erreur lors du chargement des employés");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleEdit = (employee: Employee) => {
    setSelected(employee);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelected(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  // À passer à la table, pour maj data après suppression/import…
  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cet employé ?")) return;
    try {
      await deleteEmployee(id);
      toast.success("Employé supprimé");
      fetchEmployees();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleImport = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      await importEmployees(formData);
      toast.success("Import terminé avec succès");
      fetchEmployees();
    } catch (err) {
      toast.error("Erreur lors de l'import");
    }
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-camublue-900">
            Gestion des employés
          </h1>
          <button
            onClick={handleCreate}
            className="bg-camublue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 transition"
          >
            <FaPlus /> Ajouter
          </button>
        </div>

        <EmployeesStatsHeader data={employees} loading={isLoading} />

        <EmployeesTable
          employees={employees}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onImport={handleImport}
        />
      </motion.div>
    </AppLayout>
  );
}
