import { useEffect, useState, useRef } from "react";
import { FaEdit, FaTrash, FaFileExcel } from "react-icons/fa";
import { Employee } from "@/types/employee";
import { getEmployees, deleteEmployee, importEmployees } from "@/services/employeeService";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im"; // Spinner

interface Props {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (id: number) => void;
  onImport: (file: File) => void;
}
export default function EmployeesTable({ employees, isLoading, onEdit, onDelete, onImport }: Props) {
 
  const [search, setSearch] = useState<string>("");
  const [filtered, setFiltered] = useState<Employee[]>([]);

  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  

  useEffect(() => {
    setFiltered(
      employees.filter((e) =>
        e.matricule.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, employees]);


 

   const handleDeleteClick = (id: number) => onDelete(id);

   
  const handleImport = async () => {
    if (!importFile) return toast.error("Veuillez sélectionner un fichier Excel.");
    setIsImporting(true);
    const toastId = toast.loading("Import en cours...");
    try {
      await onImport(importFile);
      toast.success("Import terminé avec succès", { id: toastId });
      setImportFile(null);
    } catch (err) {
      toast.error("Erreur lors de l'import", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
        <Input
          placeholder="Rechercher par nom, prénom ou matricule..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/3"
        />

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            accept=".xlsx"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-300"
          >
            <FaFileExcel /> Choisir un fichier
          </button>
          <button
            onClick={handleImport}
            disabled={!importFile || isImporting}
            className="bg-camublue-900 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-camublue-800 disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <ImSpinner2 className="animate-spin" />
                Importation...
              </>
            ) : (
              "Importer"
            )}
          </button>
        </div>
      </div>

    {importFile && (
        <div className="text-sm text-gray-500 italic">Fichier sélectionné : {importFile.name}</div>
      )}


     

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-xl shadow-md">
            <thead className="bg-camublue-900 text-white">
                <tr>
                    <th className="px-4 py-2 text-left">Matricule</th>
                    <th className="px-4 py-2 text-left">Nom</th>
                    <th className="px-4 py-2 text-left">Prénom</th>
                    <th className="px-4 py-2 text-left">Sexe</th>
                    <th className="px-4 py-2 text-left">Fonction</th>
                    <th className="px-4 py-2 text-left">Date d’embauche</th>
                    <th className="px-4 py-2 text-left">Projet</th>
                    <th className="px-4 py-2 text-left">Manager</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{emp.matricule}</td>
                    <td className="px-4 py-2">{emp.nom}</td>
                    <td className="px-4 py-2">{emp.prenom}</td>
                    <td className="px-4 py-2">{emp.sexe === 'H' ? 'Homme' : emp.sexe === 'F' ? 'Femme' : ''}</td>
                    <td className="px-4 py-2">{emp.fonction}</td>
                    <td className="px-4 py-2">{emp.date_embauche}</td>
                    <td className="px-4 py-2">{emp.projet}</td>
                    <td className="px-4 py-2">{emp.manager}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                        <button
                        onClick={() => onEdit(emp)}
                        className="text-yellow-500 hover:text-yellow-700"
                        >
                        <FaEdit />
                        </button>
                        <button
                        onClick={() => handleDeleteClick(emp.id)}
                        className="text-red-600 hover:text-red-800"
                        >
                        <FaTrash />
                        </button>
                    </td>
                </tr>
                ))}
                {filtered.length === 0 && !isLoading && (
                    <tr>
                    <td colSpan={9} className="text-center py-4 text-gray-500">
                        Aucun employé trouvé.
                    </td>
                    </tr>
                )}
            </tbody>

        </table>
      </div>
    </div>
  );
}
