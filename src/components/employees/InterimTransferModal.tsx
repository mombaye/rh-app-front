// src/components/employees/InterimTransferModal.tsx
// Modal unifié : Basculement Intérimaire → Intérimaire  OU  → Interne
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaExchangeAlt, FaInfoCircle } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { Employee } from "@/types/employee";
import { convertInterim, interimToInterim } from "@/services/employeeService";
import toast from "react-hot-toast";

type Mode = "choice" | "to-interim" | "to-internal";

const CONTRACT_TYPES = [
  { value: "CDI",   label: "CDI — Durée Indéterminée" },
  { value: "CDD",   label: "CDD — Durée Déterminée"   },
  { value: "STAGE", label: "Stage"                     },
];

interface Props {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess: (updatedEmployee: Employee) => void;
}

export default function InterimTransferModal({ open, employee, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>("choice");

  // ── Champs Intérimaire → Interne ────────────────────────────────────────
  const [newMatricule,        setNewMatricule]        = useState("");
  const [newTypeContrat,      setNewTypeContrat]       = useState<"CDI" | "CDD" | "STAGE">("CDI");
  const [dateEmbauche,        setDateEmbauche]         = useState("");
  const [dateFinCdd,          setDateFinCdd]           = useState("");
  const [dateFinPeriodeEssai, setDateFinPeriodeEssai]  = useState("");
  const [description,         setDescription]          = useState("");

  // ── Champs Intérimaire → Intérimaire ────────────────────────────────────
  const [i2iMatricule,   setI2iMatricule]   = useState("");
  const [i2iDateDebut,   setI2iDateDebut]   = useState("");
  const [i2iDateFin,     setI2iDateFin]     = useState("");
  const [i2iDescription, setI2iDescription] = useState("");

  const [loading, setLoading] = useState(false);

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      setMode("choice");
      setNewMatricule(""); setNewTypeContrat("CDI"); setDateEmbauche("");
      setDateFinCdd(""); setDateFinPeriodeEssai(""); setDescription("");
      setI2iMatricule(""); setI2iDateDebut(""); setI2iDateFin(""); setI2iDescription("");
    }
  }, [open]);

  const isCdd   = newTypeContrat === "CDD";
  const isStage = newTypeContrat === "STAGE";

  // ── Soumission → Interne ────────────────────────────────────────────────
  const handleSubmitInternal = async () => {
    if (!newMatricule.trim()) { toast.error("Le nouveau matricule est obligatoire."); return; }
    if (!dateEmbauche)        { toast.error("La date d'embauche est obligatoire.");   return; }
    if (isCdd && !dateFinCdd) { toast.error("La date de fin de CDD est obligatoire."); return; }
    setLoading(true);
    try {
      const result = await convertInterim(employee!.id, {
        new_matricule:          newMatricule.trim(),
        new_type_contrat:       newTypeContrat,
        date_embauche:          dateEmbauche,
        date_fin_cdd:           isCdd ? dateFinCdd : undefined,
        date_fin_periode_essai: (isCdd || isStage) ? dateFinPeriodeEssai || undefined : undefined,
        description:            description.trim() || undefined,
      });
      toast.success(result.message);
      onSuccess(result.employee);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors du basculement.");
    } finally { setLoading(false); }
  };

  // ── Soumission → Intérimaire ────────────────────────────────────────────
  const handleSubmitInterim = async () => {
    if (!i2iMatricule.trim()) { toast.error("Le nouveau matricule est obligatoire."); return; }
    if (!i2iDateDebut)        { toast.error("La date de début est obligatoire.");     return; }
    if (!i2iDateFin)          { toast.error("La date de fin est obligatoire.");       return; }
    setLoading(true);
    try {
      const result = await interimToInterim(employee!.id, {
        new_matricule:  i2iMatricule.trim(),
        new_date_debut: i2iDateDebut,
        new_date_fin:   i2iDateFin,
        description:    i2iDescription.trim() || undefined,
      });
      toast.success(result.message);
      onSuccess(result.employee);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors du basculement.");
    } finally { setLoading(false); }
  };

  if (!open || !employee) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-camublue-900/10">
                  <FaExchangeAlt className="text-camublue-900" size={14} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-sm">Basculement</h2>
                  <p className="text-xs text-slate-400">
                    {employee.prenom} {employee.nom} · {employee.matricule}
                    <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 text-[10px] font-medium">INTERIM</span>
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <FaTimes size={13} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* ── STEP 1 : Choix du type ── */}
              {mode === "choice" && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 font-medium">Choisissez le type de basculement :</p>
                  <div className="grid grid-cols-1 gap-3">

                    {/* → Intérimaire */}
                    <button
                      onClick={() => setMode("to-interim")}
                      className="flex items-start gap-4 p-4 border-2 border-slate-200 rounded-xl hover:border-camublue-900 hover:bg-camublue-900/5 transition-all text-left group"
                    >
                      <div className="p-2.5 rounded-xl bg-orange-100 group-hover:bg-orange-200 transition-colors shrink-0">
                        <FaExchangeAlt className="text-orange-600" size={16} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Intérimaire → Intérimaire</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Changement de matricule uniquement. Le type de contrat reste <strong>INTERIM</strong>.
                          Un événement de parcours est enregistré.
                        </p>
                      </div>
                    </button>

                    {/* → Interne */}
                    <button
                      onClick={() => setMode("to-internal")}
                      className="flex items-start gap-4 p-4 border-2 border-slate-200 rounded-xl hover:border-camublue-900 hover:bg-camublue-900/5 transition-all text-left group"
                    >
                      <div className="p-2.5 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors shrink-0">
                        <FaExchangeAlt className="text-blue-600" size={16} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Intérimaire → Interne</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          L'employé rejoint la liste interne avec un nouveau matricule et un contrat CDI / CDD / Stage.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2a : Intérimaire → Intérimaire ── */}
              {mode === "to-interim" && (
                <div className="space-y-4">
                  <button onClick={() => setMode("choice")} className="text-xs text-camublue-900 hover:underline flex items-center gap-1">
                    ← Changer de type
                  </button>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1 font-medium">
                        Nouveau matricule <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={i2iMatricule}
                        onChange={e => setI2iMatricule(e.target.value)}
                        placeholder="Ex: UMO-2026-001"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 focus:border-camublue-900"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">
                          Date de début <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={i2iDateDebut}
                          onChange={e => setI2iDateDebut(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">
                          Date de fin <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={i2iDateFin}
                          min={i2iDateDebut || undefined}
                          onChange={e => setI2iDateFin(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-xs text-orange-700">
                    <FaInfoCircle className="shrink-0 mt-0.5 text-orange-400" size={12} />
                    <span>
                      L'employé reste dans la <strong>liste des intérimaires</strong>. Seul le matricule change.
                      Un événement <em>Changement de contrat</em> est enregistré dans son parcours de carrière.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">
                      Motif <span className="text-slate-300 font-normal">(optionnel)</span>
                    </label>
                    <textarea
                      value={i2iDescription}
                      onChange={e => setI2iDescription(e.target.value)}
                      placeholder="Contexte du changement de matricule…"
                      rows={2}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* ── STEP 2b : Intérimaire → Interne ── */}
              {mode === "to-internal" && (
                <div className="space-y-4">
                  <button onClick={() => setMode("choice")} className="text-xs text-camublue-900 hover:underline flex items-center gap-1">
                    ← Changer de type
                  </button>

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
                        Type de contrat <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={newTypeContrat}
                        onChange={e => { setNewTypeContrat(e.target.value as "CDI"|"CDD"|"STAGE"); setDateFinCdd(""); setDateFinPeriodeEssai(""); }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-white"
                      >
                        {CONTRACT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1 font-medium">
                        Date d'embauche <span className="text-red-500">*</span>
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

                  {(isCdd || isStage) && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1 font-medium">
                        Fin période d'essai <span className="text-slate-300 font-normal">(optionnel)</span>
                      </label>
                      <input
                        type="date"
                        value={dateFinPeriodeEssai}
                        min={dateEmbauche || undefined}
                        onChange={e => setDateFinPeriodeEssai(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                      />
                    </div>
                  )}

                  <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5 text-xs text-indigo-700">
                    <FaInfoCircle className="shrink-0 mt-0.5 text-indigo-400" size={12} />
                    <span>
                      <strong>{employee.prenom} {employee.nom}</strong> sera déplacé de la liste <strong>intérimaires</strong> vers la liste <strong>interne</strong>.
                      La hiérarchie (N+1/N+2) et un événement de parcours seront conservés.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">
                      Motif <span className="text-slate-300 font-normal">(optionnel)</span>
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
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 shrink-0 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
              >
                Annuler
              </button>

              {mode === "to-interim" && (
                <button
                  onClick={handleSubmitInterim}
                  disabled={loading || !i2iMatricule.trim() || !i2iDateDebut || !i2iDateFin}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? <ImSpinner2 className="animate-spin" size={13} /> : <FaExchangeAlt size={11} />}
                  Valider le basculement
                </button>
              )}

              {mode === "to-internal" && (
                <button
                  onClick={handleSubmitInternal}
                  disabled={loading || !newMatricule.trim() || !dateEmbauche || (isCdd && !dateFinCdd)}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? <ImSpinner2 className="animate-spin" size={13} /> : <FaExchangeAlt size={11} />}
                  Valider le basculement
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
