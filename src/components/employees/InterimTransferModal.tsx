import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaExchangeAlt } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { Employee } from "@/types/employee";
import { convertInterim } from "@/services/employeeService";
import toast from "react-hot-toast";

const CONTRACT_TYPES = [
  { value: "CDI", label: "CDI (Contrat Durée Indéterminée)" },
  { value: "CDD", label: "CDD (Contrat Durée Déterminée)" },
  { value: "STAGE", label: "Stage" },
];

interface Props {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess: (updatedEmployee: Employee) => void;
}

export default function InterimTransferModal({ open, employee, onClose, onSuccess }: Props) {
  const [newMatricule, setNewMatricule] = useState("");
  const [newTypeContrat, setNewTypeContrat] = useState<"CDI" | "CDD" | "STAGE">("CDI");
  const [dateEmbauche, setDateEmbauche] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setNewMatricule("");
      setNewTypeContrat("CDI");
      setDateEmbauche(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  if (!open || !employee) return null;

  const handleSubmit = async () => {
    if (!newMatricule.trim()) {
      toast.error("Le nouveau matricule est obligatoire.");
      return;
    }
    setLoading(true);
    try {
      const result = await convertInterim(employee.id, {
        new_matricule: newMatricule.trim(),
        new_type_contrat: newTypeContrat,
        date_embauche: dateEmbauche,
      });
      toast.success(result.message);
      onSuccess(result.employee);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erreur lors du basculement.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-camublue to-camublue/80 text-white">
            <div className="flex items-center gap-3">
              <FaExchangeAlt className="text-lg" />
              <h2 className="text-lg font-semibold">Basculement Intérimaire</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
              <FaTimes />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Current employee info */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Employé actuel</p>
              <p className="font-semibold text-gray-800">
                {employee.nom} {employee.prenom}
              </p>
              <div className="flex gap-4 mt-2 text-sm text-gray-600">
                <span>Matricule : <strong>{employee.matricule}</strong></span>
                <span>Contrat : <strong>{employee.type_contrat}</strong></span>
              </div>
              {employee.service && (
                <p className="text-sm text-gray-600 mt-1">
                  Service : <strong>{employee.service}</strong>
                </p>
              )}
            </div>

            {/* New matricule */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau matricule <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newMatricule}
                onChange={(e) => setNewMatricule(e.target.value)}
                placeholder="Ex: EMP-2026-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-camublue/30 focus:border-camublue outline-none"
              />
            </div>

            {/* New contract type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau type de contrat
              </label>
              <select
                value={newTypeContrat}
                onChange={(e) => setNewTypeContrat(e.target.value as "CDI" | "CDD" | "STAGE")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-camublue/30 focus:border-camublue outline-none"
              >
                {CONTRACT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>

            {/* Date embauche */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'embauche (interne)
              </label>
              <input
                type="date"
                value={dateEmbauche}
                onChange={(e) => setDateEmbauche(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-camublue/30 focus:border-camublue outline-none"
              />
            </div>

            {/* Summary */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 text-sm">
              <p className="font-medium text-blue-800 mb-2">Changements qui seront appliqués :</p>
              <ul className="list-disc list-inside text-blue-700 space-y-1">
                <li>Matricule : {employee.matricule} → <strong>{newMatricule || "..."}</strong></li>
                <li>Contrat : INTERIM → <strong>{newTypeContrat}</strong></li>
                <li>Date d'embauche : <strong>{dateEmbauche}</strong></li>
                <li>La hiérarchie (N+1/N+2) sera conservée</li>
                <li>Un événement de carrière sera enregistré</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !newMatricule.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-camublue text-white rounded-lg hover:bg-camublue/90 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <ImSpinner2 className="animate-spin" />
                  Basculement en cours...
                </>
              ) : (
                <>
                  <FaExchangeAlt />
                  Confirmer le basculement
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
