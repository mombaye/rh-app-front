import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaExchangeAlt, FaInfoCircle } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { Employee } from "@/types/employee";
import { convertInterim } from "@/services/employeeService";
import toast from "react-hot-toast";

const CONTRACT_TYPES = [
  { value: "CDI",   label: "CDI (Contrat Durée Indéterminée)" },
  { value: "CDD",   label: "CDD (Contrat Durée Déterminée)"  },
  { value: "STAGE", label: "Stage"                            },
];

interface Props {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess: (updatedEmployee: Employee) => void;
}

export default function InterimTransferModal({ open, employee, onClose, onSuccess }: Props) {
  const [newMatricule,        setNewMatricule]        = useState("");
  const [newTypeContrat,      setNewTypeContrat]       = useState<"CDI" | "CDD" | "STAGE">("CDI");
  const [dateFinCdd,          setDateFinCdd]           = useState("");
  const [dateFinPeriodeEssai, setDateFinPeriodeEssai]  = useState("");
  const [description,         setDescription]          = useState("");
  const [loading,             setLoading]              = useState(false);

  useEffect(() => {
    if (open) {
      setNewMatricule("");
      setNewTypeContrat("CDI");
      setDateFinCdd("");
      setDateFinPeriodeEssai("");
      setDescription("");
    }
  }, [open]);

  const isCdd   = newTypeContrat === "CDD";
  const isStage = newTypeContrat === "STAGE";

  const handleSubmit = async () => {
    if (!newMatricule.trim()) {
      toast.error("Le nouveau matricule est obligatoire.");
      return;
    }
    if (isCdd && !dateFinCdd) {
      toast.error("La date de fin de CDD est obligatoire.");
      return;
    }
    setLoading(true);
    try {
      const result = await convertInterim(employee!.id, {
        new_matricule:          newMatricule.trim(),
        new_type_contrat:       newTypeContrat,
        date_fin_cdd:           isCdd ? dateFinCdd : undefined,
        date_fin_periode_essai: (isCdd || isStage) ? dateFinPeriodeEssai || undefined : undefined,
        description:            description.trim() || undefined,
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

  if (!open || !employee) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-camublue-900/10">
                  <FaExchangeAlt className="text-camublue-900" size={14} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-sm">Basculement Intérimaire</h2>
                  <p className="text-xs text-slate-400">
                    {employee.prenom} {employee.nom} · {employee.matricule}
                    <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 text-[10px] font-medium">
                      INTERIM
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <FaTimes size={13} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Nouveau matricule + nouveau contrat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-medium">
                    Nouveau matricule <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newMatricule}
                    onChange={e => setNewMatricule(e.target.value)}
                    placeholder="Ex: EMP-2026-001"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 focus:border-camublue-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-medium">
                    Nouveau type de contrat <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newTypeContrat}
                    onChange={e => {
                      setNewTypeContrat(e.target.value as "CDI" | "CDD" | "STAGE");
                      setDateFinCdd("");
                      setDateFinPeriodeEssai("");
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-white"
                  >
                    {CONTRACT_TYPES.map(ct => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date d'embauche + Date fin CDD (si CDD) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-medium">
                    Date d'embauche (interne) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dateEmbauche}
                    onChange={e => setDateEmbauche(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                  />
                </div>

                {isCdd && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">
                      Date de fin CDD <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dateFinCdd}
                      min={dateEmbauche || undefined}
                      onChange={e => setDateFinCdd(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                    />
                  </div>
                )}
              </div>

              {/* Période d'essai (CDD ou Stage uniquement) */}
              {(isCdd || isStage) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">
                      Fin période d'essai{" "}
                      <span className="text-slate-300 font-normal">(optionnel)</span>
                    </label>
                    <input
                      type="date"
                      value={dateFinPeriodeEssai}
                      min={dateEmbauche || undefined}
                      onChange={e => setDateFinPeriodeEssai(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                    />
                  </div>
                </div>
              )}

              {/* Notice info */}
              <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5 text-xs text-indigo-700">
                <FaInfoCircle className="shrink-0 mt-0.5 text-indigo-400" size={12} />
                <span>
                  Ce basculement déplacera <strong>{employee.prenom} {employee.nom}</strong>{" "}
                  de la <strong>liste intérimaires</strong> vers la <strong>liste interne</strong>.
                  La hiérarchie (N+1/N+2) sera conservée et un événement de carrière sera enregistré.
                </span>
              </div>

              {/* Motif optionnel */}
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium">
                  Motif{" "}
                  <span className="text-slate-300 font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Contexte ou observations…"
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 resize-none"
                />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-5 py-3 border-t border-slate-100 shrink-0 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !newMatricule.trim() || (isCdd && !dateFinCdd)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading
                  ? <><ImSpinner2 className="animate-spin" size={13} />Basculement…</>
                  : <><FaExchangeAlt size={11} />Valider</>
                }
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
