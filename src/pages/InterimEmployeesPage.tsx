import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import EmployeesStatsHeader from "@/components/employees/EmployeesStatsHeader";
import EmployeesTable from "@/components/employees/EmployeeTable";
import ExitEmployeeModal from "@/components/employees/ExitEmployeeModal";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal";
import ReinstateEmployeeModal from "@/components/employees/ReinstateEmployeeModal";
import MissionModal from "@/components/employees/MissionModal";
import { Employee } from "@/types/employee";
import {
  getEmployees,
  importEmployees,
  markExit,
  reinstate,
  patchEmployee,
  sendAccessCodesInterim,
  bulkSwitchToInternal,
  bulkInterimToInterim,
  BulkSwitchPayload,
} from "@/services/employeeService";
import { FaUserCheck, FaUserTimes, FaUsers, FaExchangeAlt } from "react-icons/fa";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiX,
  FiEdit3,
  FiUploadCloud,
  FiArrowRight,
  FiChevronDown,
  FiChevronRight,
  FiInfo,
} from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProfileFilter = "ALL" | "ACTIVE" | "EXITED";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  skipped_details?: string[];
};



// ─── Import result modal (auto-dismiss 5s) ────────────────────────────────────
function ImportResultModal({
  result,
  onClose,
}: {
  result: ImportResult;
  onClose: () => void;
}) {
  const hasSkipped = result.skipped > 0;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const DURATION = 5000;
    const INTERVAL = 50;
    const step = (INTERVAL / DURATION) * 100;
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p - step <= 0) { clearInterval(timer); onClose(); return 0; }
        return p - step;
      });
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="px-6 pt-6 pb-5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${hasSkipped ? "bg-amber-100" : "bg-emerald-100"}`}>
            {hasSkipped ? <FiAlertTriangle className="text-amber-500" size={24} /> : <FiCheckCircle className="text-emerald-500" size={24} />}
          </div>
          <h3 className="text-center text-base font-bold text-gray-900 mb-3">Import terminé</h3>
          <div className="flex justify-center gap-6 mt-2 text-sm">
            <span className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-bold text-emerald-600">{result.created}</span>
              <span className="text-gray-500 text-xs">créé(s)</span>
            </span>
            <span className="w-px bg-gray-200" />
            <span className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-bold text-blue-600">{result.updated}</span>
              <span className="text-gray-500 text-xs">mis à jour</span>
            </span>
            {hasSkipped && (
              <>
                <span className="w-px bg-gray-200" />
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-2xl font-bold text-amber-500">{result.skipped}</span>
                  <span className="text-gray-500 text-xs">ignoré(s)</span>
                </span>
              </>
            )}
          </div>
          {result.skipped_details && result.skipped_details.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-amber-600 font-medium text-center">Voir les lignes ignorées</summary>
              <ul className="mt-2 space-y-0.5 text-xs text-amber-700 font-mono max-h-32 overflow-y-auto">
                {result.skipped_details.map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
            </details>
          )}
        </div>
        <div className="px-6 pb-5 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${hasSkipped ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${progress}%`, transition: "width 50ms linear" }} />
          </div>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 transition whitespace-nowrap">Fermer</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Types switch ─────────────────────────────────────────────────────────────
type ContractTarget = "CDI" | "CDD" | "STAGE";

type SwitchRow = {
  id: number;
  nom: string;
  prenom: string;
  oldMatricule: string;
  newMatricule: string;   // purement numérique
  // Détails contrat — pré-remplis depuis les infos existantes de l'employé
  contractType: ContractTarget;
  dateEmbauche?: string;
  dateFinContrat?: string; // CDD / STAGE uniquement
  error?: string;
  success?: boolean;
};

const CONTRACT_TARGET_STYLES: Record<ContractTarget, string> = {
  CDI:   "bg-emerald-100 text-emerald-700 border-emerald-300",
  CDD:   "bg-blue-100 text-blue-700 border-blue-300",
  STAGE: "bg-purple-100 text-purple-700 border-purple-300",
};

// ─── ContractConfigModal ──────────────────────────────────────────────────────
// Modal qui s'affiche quand on clique sur "Définir" ou "Modifier" pour un employé
function ContractConfigModal({
  row,
  onConfirm,
  onCancel,
}: {
  row: SwitchRow;
  onConfirm: (contractType: ContractTarget, dateEmbauche: string, dateFinContrat: string) => void;
  onCancel: () => void;
}) {
  const [ct, setCt] = useState<ContractTarget>(row.contractType);
  const [de, setDe] = useState(row.dateEmbauche ?? "");
  const [df, setDf] = useState(row.dateFinContrat ?? "");

  const CONTRACT_OPTS: { value: ContractTarget; label: string }[] = [
    { value: "CDI",   label: "CDI" },
    { value: "CDD",   label: "CDD" },
    { value: "STAGE", label: "Stage" },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">
            Contrat — {row.prenom} {row.nom}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition">
            <FiX size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Type de contrat */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Type de contrat *</label>
            <div className="flex gap-2">
              {CONTRACT_OPTS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setCt(o.value)}
                  className={`flex-1 px-3 py-2 rounded-xl border text-sm font-bold transition
                    ${ct === o.value
                      ? `${CONTRACT_TARGET_STYLES[o.value]} ring-2 ring-offset-1 ring-current`
                      : "bg-white border-gray-300 text-gray-500 hover:border-gray-400"
                    }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date d'embauche */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date d'embauche (interne)</label>
            <input
              type="date" value={de} onChange={(e) => setDe(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Date de fin — uniquement CDD / STAGE */}
          {ct !== "CDI" && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Date de fin {ct === "CDD" ? "CDD" : "Stage"}
              </label>
              <input
                type="date" value={df} onChange={(e) => setDf(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            type="button" onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition"
          >
            Annuler
          </button>
          <button
            type="button" onClick={() => onConfirm(ct, de, df)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
          >
            Confirmer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── BulkSwitchModal ──────────────────────────────────────────────────────────
// ─── Modal de choix du type de basculement massif ────────────────────────────
function BulkBasculementChoiceModal({
  onClose,
  onChooseInterim,
  onChooseInterne,
}: {
  onClose: () => void;
  onChooseInterim: () => void;
  onChooseInterne: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <FaExchangeAlt className="text-indigo-600" size={17} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Basculements Massifs</h2>
              <p className="text-sm text-gray-400 mt-0.5">Choisissez le type de basculement</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100">
            <FiX size={18} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 gap-3">
          <button
            onClick={() => { onClose(); onChooseInterim(); }}
            className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50/50 transition-all text-left group"
          >
            <div className="p-2.5 rounded-xl bg-orange-100 group-hover:bg-orange-200 transition-colors shrink-0">
              <FaExchangeAlt className="text-orange-600" size={16} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Intérimaire → Intérimaire</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Changement de matricule uniquement. Le contrat reste <strong>INTERIM</strong>. Parcours enregistré.
              </p>
            </div>
          </button>

          <button
            onClick={() => { onClose(); onChooseInterne(); }}
            className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-left group"
          >
            <div className="p-2.5 rounded-xl bg-indigo-100 group-hover:bg-indigo-200 transition-colors shrink-0">
              <FaExchangeAlt className="text-indigo-600" size={16} />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Intérimaire → Interne</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Passage en liste interne avec nouveau matricule numérique et contrat CDI / CDD / Stage.
              </p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal basculement massif Intérimaire → Intérimaire ───────────────────────
function BulkInterimToInterimModal({
  employees,
  onClose,
  onSuccess,
}: {
  employees: Employee[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  type I2IRow = {
    id: number; nom: string; prenom: string;
    oldMatricule: string; newMatricule: string;
    dateDebut: string; dateFin: string;
    success?: boolean; error?: string;
  };

  const today = new Date().toISOString().slice(0, 10);

  const [rows, setRows] = useState<I2IRow[]>(
    employees
      .filter(e => e.type_contrat === "INTERIM" && e.status !== "EXITED")
      .map(e => ({
        id: e.id, nom: e.nom, prenom: e.prenom,
        oldMatricule: e.matricule, newMatricule: "",
        dateDebut: today, dateFin: "",
      }))
  );
  const [search,       setSearch]       = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone,       setIsDone]       = useState(false);
  const [summary,      setSummary]      = useState<{ switched: number; errors: number } | null>(null);

  const updateRow = (id: number, patch: Partial<I2IRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch, error: undefined } : r));

  const setNewMat = (id: number, v: string) => updateRow(id, { newMatricule: v });

  const readyRows  = rows.filter(r => !r.success && r.newMatricule.trim() !== "" && r.dateDebut && r.dateFin);
  const readyCount = readyRows.length;

  const filteredRows = rows.filter(r => {
    const q = search.toLowerCase();
    return r.nom.toLowerCase().includes(q) || r.prenom.toLowerCase().includes(q) || r.oldMatricule.toLowerCase().includes(q);
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await bulkInterimToInterim(
        readyRows.map(r => ({
          id:         r.id,
          matricule:  r.newMatricule.trim(),
          date_debut: r.dateDebut,
          date_fin:   r.dateFin,
        }))
      );
      const errorMap = new Map(result.errors.map((e: any) => [e.id, e.error]));
      setRows(prev => prev.map(r => {
        if (!readyRows.find(rr => rr.id === r.id)) return r;
        const err = errorMap.get(r.id);
        return err ? { ...r, error: err } : { ...r, success: true };
      }));
      setSummary({ switched: result.switched, errors: result.errors.length });
      setIsDone(true);
      if (result.errors.length === 0) {
        toast.success(`${result.switched} matricule(s) mis à jour`);
        onSuccess();
      } else {
        toast.error(`${result.errors.length} erreur(s) — ${result.switched} succès`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors du basculement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <FaExchangeAlt className="text-orange-500" size={17} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Basculement massif Intérimaire → Intérimaire</h2>
              <p className="text-sm text-gray-400 mt-0.5">Saisissez le nouveau matricule pour chaque employé. Le contrat reste INTERIM.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100"><FiX size={18} /></button>
        </div>

        {/* Info */}
        <div className="mx-6 mt-4 shrink-0 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
          <FiInfo className="shrink-0 mt-0.5 text-orange-400" size={13} />
          <span>Toutes les informations de l'employé sont conservées. Seul le <strong>matricule</strong> change. Un événement de parcours est enregistré pour chaque employé.</span>
        </div>

        {/* Résumé */}
        {summary && (
          <div className={`mx-6 mt-3 shrink-0 rounded-xl px-4 py-3 flex items-center gap-3 text-sm ${summary.errors === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            {summary.errors === 0
              ? <FiCheckCircle className="text-emerald-500 shrink-0" size={16} />
              : <FiAlertTriangle className="text-amber-500 shrink-0" size={16} />}
            <p className="font-semibold text-gray-800">
              {summary.switched} matricule(s) mis à jour.{summary.errors > 0 && ` ${summary.errors} erreur(s).`}
            </p>
          </div>
        )}

        {/* Recherche */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom ou matricule…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-0">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 pr-3 font-semibold text-gray-600">Employé</th>
                <th className="text-left py-3 pr-3 font-semibold text-gray-600 w-32">Matricule actuel</th>
                <th className="text-left py-3 pr-3 font-semibold text-gray-600 w-40">Nouveau matricule</th>
                <th className="text-left py-3 pr-3 font-semibold text-gray-600 w-36">Date début</th>
                <th className="text-left py-3 font-semibold text-gray-600 w-36">Date fin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map(row => {
                const isReady = row.newMatricule.trim() && row.dateDebut && row.dateFin;
                return (
                  <tr key={row.id} className={row.success ? "bg-emerald-50" : row.error ? "bg-red-50" : isReady ? "bg-orange-50/40" : ""}>
                    <td className="py-2.5 pr-3 font-medium text-gray-800">{row.prenom} {row.nom}</td>
                    <td className="py-2.5 pr-3">
                      <span className="font-mono text-gray-500 text-xs bg-gray-100 px-2 py-0.5 rounded">{row.oldMatricule}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {row.success ? (
                        <span className="font-mono text-emerald-700 text-xs bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                          <FiCheckCircle size={11} /> {row.newMatricule}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <input type="text" value={row.newMatricule} onChange={e => setNewMat(row.id, e.target.value)}
                            disabled={isSubmitting} placeholder="ex. UMO-2026-001"
                            className={`w-full border rounded-lg px-2.5 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 transition ${row.error ? "border-red-300 bg-red-50 focus:ring-red-300" : row.newMatricule.trim() ? "border-orange-400 focus:ring-orange-400" : "border-gray-300 focus:ring-orange-400"}`} />
                          {row.error && <p className="text-xs text-red-600">{row.error}</p>}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <input type="date" value={row.dateDebut} disabled={isSubmitting || !!row.success}
                        onChange={e => updateRow(row.id, { dateDebut: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </td>
                    <td className="py-2.5">
                      <input type="date" value={row.dateFin} disabled={isSubmitting || !!row.success}
                        min={row.dateDebut || undefined}
                        onChange={e => updateRow(row.id, { dateFin: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">Aucun intérimaire actif trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {rows.filter(r => !r.success).length} intérimaire(s) actif(s)
            {readyCount > 0 && <span className="ml-2 font-semibold text-orange-600">· {readyCount} prêt(s)</span>}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition">
              {isDone && summary?.errors === 0 ? "Fermer" : "Annuler"}
            </button>
            {(!isDone || (summary && summary.errors > 0)) && (
              <button onClick={handleSubmit} disabled={isSubmitting || readyCount === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting
                  ? <><ImSpinner2 className="animate-spin" size={14} />Basculement…</>
                  : <><FaExchangeAlt size={12} />Basculer {readyCount > 0 ? `(${readyCount})` : ""}</>}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── BulkSwitchModal ──────────────────────────────────────────────────────────
function BulkSwitchModal({
  employees,
  onClose,
  onSuccess,
}: {
  employees: Employee[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [rows, setRows] = useState<SwitchRow[]>(
    employees
      .filter((e) => e.type_contrat === "INTERIM" && e.status !== "EXITED")
      .map((e) => ({
        id: e.id,
        nom: e.nom,
        prenom: e.prenom,
        oldMatricule: e.matricule,
        // Pré-remplir le matricule s'il est déjà numérique, sinon laisser vide
        newMatricule: /^\d+$/.test((e.matricule || "").trim()) ? e.matricule : "",
        // Contrat CDI par défaut + date d'embauche existante conservée
        contractType: "CDI",
        dateEmbauche: e.date_embauche || "",
      }))
  );

  // ID de la ligne dont on configure le contrat via le modal "Définir"
  const [configModalId, setConfigModalId] = useState<number | null>(null);
  const configModalRow = rows.find((r) => r.id === configModalId) ?? null;

  const [search, setSearch]             = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone]             = useState(false);
  const [summary, setSummary]           = useState<{ switched: number; errors: number } | null>(null);

  // Ligne "prête" = matricule numérique valide + contrat défini
  const isReady = (r: SwitchRow) =>
    !r.success && /^\d+$/.test(r.newMatricule.trim()) && !!r.contractType;

  const readyRows   = rows.filter(isReady);
  const readyCount  = readyRows.length;

  const filteredRows = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.nom.toLowerCase().includes(q) ||
      r.prenom.toLowerCase().includes(q) ||
      r.oldMatricule.toLowerCase().includes(q)
    );
  });

  // Mise à jour d'un champ sur une ligne
  const updateRow = (id: number, patch: Partial<SwitchRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const setNewMat = (id: number, value: string) =>
    updateRow(id, { newMatricule: value, error: undefined });

  const setContractConfig = (
    id: number,
    contractType: ContractTarget,
    dateEmbauche: string,
    dateFinContrat: string
  ) => {
    updateRow(id, { contractType, dateEmbauche, dateFinContrat, error: undefined });
    setConfigModalId(null);
  };

  const handleSubmit = async () => {
    const items = readyRows.map((r) => ({
      id: r.id,
      matricule: r.newMatricule.trim(),
      contract_type: r.contractType!,
      event_date: today,
      ...(r.dateEmbauche    ? { date_embauche: r.dateEmbauche }       : {}),
      ...(r.dateFinContrat && r.contractType !== "CDI"
        ? { date_fin_contrat: r.dateFinContrat } : {}),
    }));

    setIsSubmitting(true);
    try {
      const result = await bulkSwitchToInternal({ items });
      const errorMap = new Map(result.errors.map((e) => [e.id, e.error]));
      setRows((prev) =>
        prev.map((r) => {
          if (!isReady(r)) return r;
          const err = errorMap.get(r.id);
          return err ? { ...r, error: err } : { ...r, success: true };
        })
      );
      setSummary({ switched: result.switched, errors: result.errors.length });
      setIsDone(true);
      if (result.errors.length === 0) {
        toast.success(`${result.switched} employé(s) basculé(s) vers la liste interne`);
        onSuccess();
      } else {
        toast.error(`${result.errors.length} erreur(s) — ${result.switched} succès`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors du basculement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <FaExchangeAlt className="text-indigo-600" size={17} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Basculement massif vers la liste interne</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Saisissez le nouveau matricule numérique, puis définissez le contrat pour chaque employé.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100">
            <FiX size={18} />
          </button>
        </div>

        {/* Info matricule */}
        <div className="mx-6 mt-4 shrink-0 flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700">
          <FiInfo className="shrink-0 mt-0.5 text-indigo-400" size={13} />
          <span>
            Toutes les informations de l'employé (service, manager, fonction…) sont conservées.
            Seul le <strong>type de contrat</strong> change. Les matricules internes sont <strong>purement numériques</strong> (ex. 001, 123).
            Cliquez sur <strong>Modifier →</strong> pour ajuster le type de contrat ou les dates.
          </span>
        </div>

        {/* ── Résumé après soumission ── */}
        {summary && (
          <div className={`mx-6 mt-3 shrink-0 rounded-xl px-4 py-3 flex items-center gap-3 text-sm ${
            summary.errors === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
          }`}>
            {summary.errors === 0
              ? <FiCheckCircle className="text-emerald-500 shrink-0" size={16} />
              : <FiAlertTriangle className="text-amber-500 shrink-0" size={16} />}
            <p className="font-semibold text-gray-800">
              {summary.switched} employé(s) basculé(s) vers la liste interne.
              {summary.errors > 0 && ` ${summary.errors} erreur(s) — voir le tableau.`}
            </p>
          </div>
        )}

        {/* ── Barre de recherche ── */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom ou matricule…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 font-semibold text-gray-600">Employé</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-600 w-36">Matricule actuel</th>
                  <th className="text-left py-3 pr-3 font-semibold text-gray-600 w-44">
                    Nouveau matricule <span className="font-normal text-gray-400">(numérique)</span>
                  </th>
                  <th className="text-left py-3 font-semibold text-gray-600">Statut / Contrat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => {
                  const matOk = /^\d+$/.test(row.newMatricule.trim());
                  const matInvalid = row.newMatricule.trim() !== "" && !matOk;
                  const configured = matOk;

                  return (
                    <tr key={row.id} className={`transition-colors ${
                      row.success  ? "bg-emerald-50"
                      : row.error ? "bg-red-50"
                      : configured ? "bg-indigo-50/40"
                      : ""
                    }`}>
                      <td className="py-3 pr-4">
                        <span className="font-medium text-gray-800">{row.prenom} {row.nom}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-gray-500 text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {row.oldMatricule}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        {row.success ? (
                          <span className="font-mono text-emerald-700 text-xs bg-emerald-100 px-2 py-0.5 rounded">
                            {row.newMatricule}
                          </span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <input
                              type="text"
                              value={row.newMatricule}
                              onChange={(e) => setNewMat(row.id, e.target.value)}
                              disabled={isSubmitting}
                              placeholder="ex. 042"
                              className={`w-full border rounded-lg px-2.5 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 transition ${
                                row.error      ? "border-red-300 bg-red-50 focus:ring-red-300"
                                : matInvalid   ? "border-amber-400 focus:ring-amber-300"
                                : matOk        ? "border-indigo-400 focus:ring-indigo-400"
                                : "border-gray-300 focus:ring-indigo-400"
                              }`}
                            />
                            {matInvalid && <p className="text-xs text-amber-600">Doit être numérique</p>}
                            {row.error && <p className="text-xs text-red-600">{row.error}</p>}
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        {row.success ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <FiCheckCircle size={13} />
                            Basculé · <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${CONTRACT_TARGET_STYLES[row.contractType]}`}>{row.contractType}</span>
                          </span>
                        ) : row.error ? (
                          <span className="text-xs text-red-600 font-medium">Erreur</span>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded border text-xs font-bold ${CONTRACT_TARGET_STYLES[row.contractType]}`}>
                              {row.contractType}
                            </span>
                            <button
                              onClick={() => setConfigModalId(row.id)}
                              disabled={isSubmitting}
                              className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline transition"
                            >
                              Modifier
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-gray-400 text-sm">
                      Aucun intérimaire actif trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {rows.filter((r) => !r.success).length} intérimaire(s) actif(s)
            {readyCount > 0 && (
              <span className="ml-2 font-semibold text-indigo-700">· {readyCount} prêt(s) à basculer</span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition">
              {isDone && summary?.errors === 0 ? "Fermer" : "Annuler"}
            </button>
            {(!isDone || (summary && summary.errors > 0)) && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || readyCount === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? <><ImSpinner2 className="animate-spin" size={14} />Basculement…</>
                  : <><FaExchangeAlt size={12} />Basculer {readyCount > 0 ? `(${readyCount})` : ""}</>
                }
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Modal "Définir le contrat" — s'affiche au-dessus du BulkSwitchModal ── */}
      <AnimatePresence>
        {configModalRow && (
          <ContractConfigModal
            row={configModalRow}
            onConfirm={(ct, de, df) => setContractConfig(configModalRow.id, ct, de, df)}
            onCancel={() => setConfigModalId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function InterimEmployeesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ── Filtre profil : ALL / ACTIVE / EXITED ──
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("ALL");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Employés affichés dans le tableau selon le filtre profil actif
  const employees = allEmployees.filter((e) => {
    if (profileFilter === "ACTIVE") return e.status === "ACTIVE" || e.is_active_employee === true;
    if (profileFilter === "EXITED") return e.status === "EXITED";
    return true;
  });

  const [selected, setSelected] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [reinstateTarget, setReinstateTarget] = useState<Employee | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitTarget, setExitTarget] = useState<Employee | null>(null);
  const [missionOpen, setMissionOpen] = useState(false);
  const [missionTarget, setMissionTarget] = useState<Employee | null>(null);
  const [isSendingCodes, setIsSendingCodes] = useState(false);
  const [bulkSwitchOpen, setBulkSwitchOpen]         = useState(false);
  const [bulkChoiceOpen, setBulkChoiceOpen]         = useState(false);
  const [bulkI2IOpen, setBulkI2IOpen]               = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchInterimEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await getEmployees({ type_contrat: "INTERIM", status: "ALL" });
      setAllEmployees(data);
    } catch (error) {
      console.error("Erreur lors du chargement des employés intérimaires :", error);
      toast.error("Erreur lors du chargement des employés intérimaires");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchInterimEmployees(); }, []);

  const handleEdit = (employee: Employee) => { setSelected(employee); setShowModal(true); };
  const handleExitClick    = (emp: Employee) => { setExitTarget(emp); setExitOpen(true); };
  const handleMissionClick = (emp: Employee) => { setMissionTarget(emp); setMissionOpen(true); };

  const handleConfirmMission = async (payload: {
    on_mission: boolean; mission_label?: string; mission_start?: string | null; mission_end?: string | null;
  }) => {
    if (!missionTarget) return;
    try {
      await patchEmployee(missionTarget.id, payload);
      toast.success(payload.on_mission
        ? `${missionTarget.prenom} ${missionTarget.nom} défini(e) en mission`
        : `Mission terminée pour ${missionTarget.prenom} ${missionTarget.nom}`);
      setMissionOpen(false); setMissionTarget(null);
      fetchInterimEmployees();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Erreur lors de la mise à jour de la mission");
    }
  };

  const handleConfirmExit = async (payload: { date_sortie: string; motif_sortie?: string }) => {
    if (!exitTarget) return;
    try {
      await markExit(exitTarget.id, payload);
      toast.success(`Sortie enregistrée pour ${exitTarget.prenom} ${exitTarget.nom}`);
      setExitOpen(false); setExitTarget(null);
      fetchInterimEmployees();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'enregistrement de la sortie");
    }
  };

  const handleImport = async (file: File) => {
    setIsImporting(true); setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await importEmployees(formData);
      const summary: ImportResult = { created: result.created ?? 0, updated: result.updated ?? 0, skipped: result.skipped ?? 0, skipped_details: result.skipped_details ?? [] };
      setImportResult(summary);
      await fetchInterimEmployees();
    } catch (err: any) {
      toast.error("Erreur lors de l'import");
      console.error(err?.response?.data);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    e.target.value = "";
  };

  const openReinstate = (emp: Employee) => { setReinstateTarget(emp); setReinstateOpen(true); };

  const doReinstate = async (payload: { date_reintegration?: string; update_date_embauche?: boolean }) => {
    if (!reinstateTarget) return;
    try {
      await reinstate(reinstateTarget.id, payload);
      toast.success(`${reinstateTarget.prenom} ${reinstateTarget.nom} réintégré(e)`);
      setReinstateOpen(false); setReinstateTarget(null);
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
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-camublue-900">Gestion des employés intérimaires</h1>
            {profileFilter !== "ALL" && (
              <p className="text-sm mt-1 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  profileFilter === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {profileFilter === "ACTIVE" ? "Actifs uniquement" : "Sortis uniquement"}
                </span>
                <button
                  onClick={() => setProfileFilter("ALL")}
                  className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition"
                >
                  Réinitialiser
                </button>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">

            {/* ── Filtre profil dropdown ── */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen((o) => !o)}
                className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border shadow-sm transition font-medium
                  ${profileFilter === "ALL"
                    ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    : profileFilter === "ACTIVE"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                    : "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                  }`}
              >
                {profileFilter === "ALL"    && <FaUsers size={13} />}
                {profileFilter === "ACTIVE" && <FaUserCheck size={13} />}
                {profileFilter === "EXITED" && <FaUserTimes size={13} />}
                {profileFilter === "ALL" ? "Tous les profils" : profileFilter === "ACTIVE" ? "Actifs" : "Sortis"}
                <FiChevronDown size={13} className={`transition-transform duration-200 ${profileDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {profileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-30"
                  >
                    {[
                      { value: "ALL"    as ProfileFilter, icon: <FaUsers     size={13} className="text-gray-400"    />, label: "Tous les profils",  activeClass: "text-camublue-900 bg-camublue-900/5" },
                      { value: "ACTIVE" as ProfileFilter, icon: <FaUserCheck size={13} className="text-emerald-500" />, label: "Actifs uniquement", activeClass: "text-emerald-700 bg-emerald-50" },
                      { value: "EXITED" as ProfileFilter, icon: <FaUserTimes size={13} className="text-red-400"     />, label: "Sortis uniquement", activeClass: "text-red-700 bg-red-50" },
                    ].map(({ value, icon, label, activeClass }) => (
                      <button
                        key={value}
                        onClick={() => { setProfileFilter(value); setProfileDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors
                          ${profileFilter === value ? `font-semibold ${activeClass}` : "text-gray-700 hover:bg-gray-50"}`}
                      >
                        {icon}
                        {label}
                        {profileFilter === value && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>


            <button
              onClick={() => setBulkChoiceOpen(true)}
              disabled={isLoading || allEmployees.filter((e) => e.type_contrat === "INTERIM" && e.status !== "EXITED").length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaExchangeAlt size={13} />
              Basculements Massifs
            </button>

          </div>
        </div>

        {/* Stats — filtre profil wired */}
        <div className="shrink-0">
          <EmployeesStatsHeader
            data={allEmployees}
            loading={isLoading}
            profileFilter={profileFilter}
            onProfileFilterChange={setProfileFilter}
          />
        </div>

        {/* Input fichier caché */}
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />

        {/* Table — filtrée selon profileFilter */}
        <div className="flex-1 min-h-0">
          <EmployeesTable
            employees={employees}
            isLoading={isLoading || isImporting}
            onEdit={handleEdit}
            onExit={handleExitClick}
            onReinstate={openReinstate}
            onMission={handleMissionClick}
            onImport={handleImport}
            onEmployeeUpdated={fetchInterimEmployees}
            showContractType={false}
            showSendCodes={false}
          />
        </div>

        {/* Modals */}
        <EmployeeFormModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={fetchInterimEmployees}
          initialData={selected}
          defaultContractType="INTERIM"
        />
        <ExitEmployeeModal open={exitOpen} onClose={() => setExitOpen(false)} employee={exitTarget} onConfirm={handleConfirmExit} />
        <ReinstateEmployeeModal open={reinstateOpen} onClose={() => setReinstateOpen(false)} employee={reinstateTarget} onConfirm={doReinstate} />
        <MissionModal open={missionOpen} onClose={() => setMissionOpen(false)} employee={missionTarget} onConfirm={handleConfirmMission} />



        {/* Modal de choix du type de basculement massif */}
        <AnimatePresence>
          {bulkChoiceOpen && (
            <BulkBasculementChoiceModal
              onClose={() => setBulkChoiceOpen(false)}
              onChooseInterim={() => setBulkI2IOpen(true)}
              onChooseInterne={() => setBulkSwitchOpen(true)}
            />
          )}
        </AnimatePresence>

        {/* Basculement massif → Intérimaire */}
        <AnimatePresence>
          {bulkI2IOpen && (
            <BulkInterimToInterimModal
              employees={allEmployees}
              onClose={() => setBulkI2IOpen(false)}
              onSuccess={() => { fetchInterimEmployees(); setBulkI2IOpen(false); }}
            />
          )}
        </AnimatePresence>

        {/* Basculement massif → Interne (existant) */}
        <AnimatePresence>
          {bulkSwitchOpen && (
            <BulkSwitchModal
              employees={allEmployees}
              onClose={() => setBulkSwitchOpen(false)}
              onSuccess={() => { fetchInterimEmployees(); setBulkSwitchOpen(false); }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {importResult && <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />}
        </AnimatePresence>

      </motion.div>
    </AppLayout>
  );
}
