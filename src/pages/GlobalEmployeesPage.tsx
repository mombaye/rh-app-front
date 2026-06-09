import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import EmployeesStatsHeader from "@/components/employees/EmployeesStatsHeader";
import EmployeesTable from "@/components/employees/EmployeeTable";
import ExitEmployeeModal from "@/components/employees/ExitEmployeeModal";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal";
import ReinstateEmployeeModal from "@/components/employees/ReinstateEmployeeModal";
import MissionModal from "@/components/employees/MissionModal";
import BulkCreateAccountsModal from "@/components/employees/BulkCreateAccountsModal";
import { Employee } from "@/types/employee";
import {
  getEmployees,
  importEmployees,
  markExit,
  reinstate,
  patchEmployee,
  shareMatriculeChanges,
  bulkUpdateMatricules,
  previewMatriculeChanges,
  MatriculeUpdate,
  MatriculeChange,
} from "@/services/employeeService";
import { FaPlus, FaUserCheck, FaUserTimes, FaUsers } from "react-icons/fa";
import {
  FiChevronDown,
  FiAlertTriangle,
  FiCheckCircle,
  FiGitCommit,
  FiEye,
  FiShare2,
  FiMail,
  FiPlusCircle,
  FiTrash2,
  FiSend,
  FiInfo,
  FiX,
  FiEdit3,
  FiArrowRight,
  FiUploadCloud,
} from "react-icons/fi";
import { UserPlus } from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProfileFilter  = "ALL" | "ACTIVE" | "EXITED";
type ContractFilter = "ALL" | "INTERIM" | "INTERNE";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  skipped_details?: string[];
};

// ─── Import Result Modal ──────────────────────────────────────────────────────
function ImportResultModal({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const hasSkipped = result.skipped > 0;
  const [progress, setProgress] = useState(100);
  useEffect(() => {
    const DURATION = 5000; const INTERVAL = 50;
    const step = (INTERVAL / DURATION) * 100;
    const timer = setInterval(() => {
      setProgress((p) => { if (p - step <= 0) { clearInterval(timer); onClose(); return 0; } return p - step; });
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 pt-6 pb-5">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${hasSkipped ? "bg-amber-100" : "bg-emerald-100"}`}>
            {hasSkipped ? <FiAlertTriangle className="text-amber-500" size={24} /> : <FiCheckCircle className="text-emerald-500" size={24} />}
          </div>
          <h3 className="text-center text-base font-bold text-gray-900 mb-3">Import terminé</h3>
          <div className="flex justify-center gap-6 mt-2 text-sm">
            <span className="flex flex-col items-center gap-0.5"><span className="text-2xl font-bold text-emerald-600">{result.created}</span><span className="text-gray-500 text-xs">créé(s)</span></span>
            <span className="w-px bg-gray-200" />
            <span className="flex flex-col items-center gap-0.5"><span className="text-2xl font-bold text-blue-600">{result.updated}</span><span className="text-gray-500 text-xs">mis à jour</span></span>
            {hasSkipped && (<><span className="w-px bg-gray-200" /><span className="flex flex-col items-center gap-0.5"><span className="text-2xl font-bold text-amber-500">{result.skipped}</span><span className="text-gray-500 text-xs">ignoré(s)</span></span></>)}
          </div>
          {result.skipped_details && result.skipped_details.length > 0 && (
            <details className="mt-4"><summary className="cursor-pointer text-xs text-amber-600 font-medium text-center">Voir les lignes ignorées</summary><ul className="mt-2 space-y-0.5 text-xs text-amber-700 font-mono max-h-32 overflow-y-auto">{result.skipped_details.map((d, i) => <li key={i}>• {d}</li>)}</ul></details>
          )}
        </div>
        <div className="px-6 pb-5 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${hasSkipped ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${progress}%`, transition: "width 50ms linear" }} /></div>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 transition whitespace-nowrap">Fermer</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Types Matricule ──────────────────────────────────────────────────────────
type MatriculeRow = {
  id: number;
  nom: string;
  prenom: string;
  oldMatricule: string;
  newMatricule: string;
  error?: string;
  success?: boolean;
  previewStatus?: "changed" | "unchanged" | "not_found" | "conflict";
  conflictDetail?: string;
};

// ─── Bulk Matricule Modal ─────────────────────────────────────────────────────
function BulkMatriculeModal({
  employees,
  onClose,
  onSuccess,
}: {
  employees: Employee[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<MatriculeRow[]>(
    employees.map((e) => ({
      id: e.id,
      nom: e.nom,
      prenom: e.prenom,
      oldMatricule: e.matricule,
      newMatricule: e.matricule,
    }))
  );
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [isPreviewing, setIsPreviewing]     = useState(false);
  const [search, setSearch]                 = useState("");
  const [isDone, setIsDone]                 = useState(false);
  const [resultSummary, setResultSummary]   = useState<{
    updated: number;
    errors: { id: number; matricule: string; error: string }[];
  } | null>(null);
  const [previewSummary, setPreviewSummary] = useState<{
    changed: number; unchanged: number; not_found: number; conflict: number;
  } | null>(null);

  const changedCount = rows.filter(
    (r) => r.newMatricule.trim() !== r.oldMatricule && !r.success
  ).length;

  const filteredRows = rows
    .filter(
      (r) =>
        r.nom.toLowerCase().includes(search.toLowerCase()) ||
        r.prenom.toLowerCase().includes(search.toLowerCase()) ||
        r.oldMatricule.toLowerCase().includes(search.toLowerCase()) ||
        r.newMatricule.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const priority = (r: MatriculeRow) => {
        if (r.previewStatus === "conflict")  return 0;
        if (r.previewStatus === "not_found") return 1;
        if (r.newMatricule.trim() !== r.oldMatricule && !r.success) return 2;
        return 3;
      };
      return priority(a) - priority(b);
    });

  const handleChange = (id: number, value: string) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, newMatricule: value, error: undefined, success: undefined } : r
      )
    );

  const handleReset = (id: number) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, newMatricule: r.oldMatricule, error: undefined, success: undefined, previewStatus: undefined, conflictDetail: undefined }
          : r
      )
    );

  const handleResetAll = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r, newMatricule: r.oldMatricule, error: undefined, success: undefined,
        previewStatus: undefined, conflictDetail: undefined,
      }))
    );
    setPreviewSummary(null);
  };

  const handleExcelPreview = async (file: File) => {
    setIsPreviewing(true);
    setPreviewSummary(null);
    try {
      const result = await previewMatriculeChanges(file);
      setPreviewSummary(result.summary);
      const changeById     = new Map<number, MatriculeChange>();
      const changeByOldMat = new Map<string, MatriculeChange>();
      for (const c of result.changes) {
        if (c.id !== null) changeById.set(c.id, c);
        changeByOldMat.set(c.old_matricule, c);
      }
      setRows((prev) =>
        prev.map((r) => {
          const change = changeById.get(r.id) ?? changeByOldMat.get(r.oldMatricule);
          if (!change) return r;
          return { ...r, newMatricule: change.new_matricule, previewStatus: change.status, conflictDetail: change.conflict_detail, error: undefined, success: undefined };
        })
      );
      const { changed, conflict, not_found } = result.summary;
      if (changed > 0)
        toast.success(
          `${changed} changement(s) détecté(s)` +
          (conflict  > 0 ? ` · ${conflict} conflit(s)`      : "") +
          (not_found > 0 ? ` · ${not_found} introuvable(s)` : "")
        );
      else
        toast("Aucun changement détecté dans le fichier.", { icon: "ℹ️" });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la lecture du fichier");
    } finally {
      setIsPreviewing(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    const updates: MatriculeUpdate[] = rows
      .filter((r) => r.newMatricule.trim() !== "" && r.newMatricule.trim() !== r.oldMatricule && !r.success && r.previewStatus !== "conflict")
      .map((r) => ({ id: r.id, matricule: r.newMatricule.trim() }));
    if (updates.length === 0) { toast.error("Aucune modification valide à envoyer."); return; }
    setIsSubmitting(true);
    try {
      const result = await bulkUpdateMatricules(updates);
      setResultSummary(result);
      setIsDone(true);
      const errorMap = new Map(result.errors.map((e) => [e.id, e.error]));
      setRows((prev) =>
        prev.map((r) => {
          if (r.newMatricule.trim() === r.oldMatricule || r.success) return r;
          const err = errorMap.get(r.id);
          return err
            ? { ...r, error: err }
            : { ...r, oldMatricule: r.newMatricule.trim(), success: true, previewStatus: undefined };
        })
      );
      if (result.errors.length === 0) {
        toast.success(`${result.updated} matricule(s) mis à jour avec succès`);
        onSuccess();
      } else {
        toast.error(`${result.errors.length} erreur(s) — voir le détail dans le tableau`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la mise à jour");
    } finally {
      setIsSubmitting(false);
    }
  };

  const conflictCount = rows.filter(
    (r) => r.previewStatus === "conflict" && r.newMatricule.trim() !== r.oldMatricule
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.2 }}
        className="w-full max-w-full sm:max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Mise à jour des matricules</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Modifiez les matricules directement ou importez un fichier Excel.{" "}
              {changedCount > 0 && (
                <span className="font-semibold text-camublue-900">{changedCount} modification(s) en attente</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100">
            <FiX size={18} />
          </button>
        </div>

        <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExcelPreview(f); }} />

        {previewSummary && (
          <div className="px-6 pt-4 shrink-0">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium"><FiCheckCircle size={14} />{previewSummary.changed} à modifier</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">{previewSummary.unchanged} inchangé(s)</span>
              {previewSummary.conflict > 0 && (
                <><span className="text-gray-400">·</span><span className="flex items-center gap-1.5 text-red-600 font-medium"><FiAlertTriangle size={14} />{previewSummary.conflict} conflit(s)</span></>
              )}
              {previewSummary.not_found > 0 && (
                <><span className="text-gray-400">·</span><span className="flex items-center gap-1.5 text-amber-600 font-medium"><FiAlertTriangle size={14} />{previewSummary.not_found} introuvable(s)</span></>
              )}
            </div>
          </div>
        )}

        {isDone && resultSummary && (
          <div className={`mx-6 mt-3 rounded-xl px-4 py-3 flex items-start gap-3 text-sm shrink-0 ${
            resultSummary.errors.length === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            {resultSummary.errors.length === 0
              ? <FiCheckCircle className="text-emerald-500 mt-0.5 shrink-0" size={16} />
              : <FiAlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={16} />}
            <p className="font-semibold text-gray-800">
              {resultSummary.updated} matricule(s) mis à jour.
              {resultSummary.errors.length > 0 && ` ${resultSummary.errors.length} erreur(s) dans le tableau ci-dessous.`}
            </p>
          </div>
        )}

        <div className="px-6 pt-4 pb-2 flex items-center gap-3 shrink-0">
          <input type="text" placeholder="Rechercher par nom, prénom ou matricule..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900" />
          {(changedCount > 0 || previewSummary) && !isDone && (
            <button onClick={handleResetAll} className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 whitespace-nowrap">
              Tout réinitialiser
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 font-semibold text-gray-600 w-1/4">Employé</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-600 w-1/4">Matricule actuel</th>
                  <th className="text-left py-3 pr-4 font-semibold text-gray-600 w-1/3">Nouveau matricule</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => {
                  const isChanged  = row.newMatricule.trim() !== row.oldMatricule && !row.success;
                  const isConflict = row.previewStatus === "conflict";
                  const isNotFound = row.previewStatus === "not_found";
                  return (
                    <tr key={row.id ?? row.oldMatricule}
                      className={`transition-colors ${
                        row.success ? "bg-emerald-50"
                        : row.error || isConflict ? "bg-red-50"
                        : isNotFound ? "bg-amber-50"
                        : isChanged ? "bg-blue-50" : ""}`}>
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-gray-800">{row.prenom} {row.nom}</span>
                        {isNotFound && <p className="text-xs text-amber-600 mt-0.5">Introuvable en base</p>}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-gray-500">{row.oldMatricule}</span>
                          {isChanged && <FiArrowRight className="text-blue-400 shrink-0" size={12} />}
                        </div>
                      </td>
                      <td className="py-2.5 pr-2">
                        <div className="flex flex-col gap-1">
                          <input type="text" value={row.newMatricule}
                            onChange={(e) => handleChange(row.id, e.target.value)}
                            disabled={isSubmitting || row.success || isNotFound}
                            className={`w-full border rounded-lg px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 transition ${
                              row.success ? "border-emerald-300 bg-emerald-50 text-emerald-700 cursor-not-allowed"
                              : isConflict || row.error ? "border-red-300 bg-red-50 focus:ring-red-300"
                              : isNotFound ? "border-amber-300 bg-amber-50 text-amber-700 cursor-not-allowed"
                              : isChanged ? "border-blue-400 bg-white focus:ring-camublue-900"
                              : "border-gray-300 bg-white focus:ring-camublue-900"}`} />
                          {isConflict && <p className="text-xs text-red-600">{row.conflictDetail ?? "Conflit : matricule déjà utilisé"}</p>}
                          {row.error && !isConflict && <p className="text-xs text-red-600">{row.error}</p>}
                          {row.success && <p className="text-xs text-emerald-600 flex items-center gap-1"><FiCheckCircle size={11} /> Mis à jour</p>}
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        {isChanged && !isNotFound && (
                          <button onClick={() => handleReset(row.id)} title="Annuler" className="text-gray-400 hover:text-red-500 transition">
                            <FiX size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">Aucun employé trouvé.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between shrink-0 gap-3">
          <p className="text-xs text-gray-400">
            {employees.length} employé(s) au total
            {changedCount > 0 && ` · ${changedCount} modification(s) en attente`}
            {conflictCount > 0 && <span className="text-red-500"> · {conflictCount} conflit(s) à résoudre</span>}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => excelInputRef.current?.click()} disabled={isPreviewing || isSubmitting}
              className="px-4 py-2 rounded-lg border border-gray-300 hover:border-camublue-900 hover:bg-blue-50 text-gray-600 hover:text-camublue-900 text-sm font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {isPreviewing ? <><ImSpinner2 className="animate-spin" size={14} />Analyse…</> : <><FiUploadCloud size={14} />Importer Excel</>}
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition">
              {isDone && resultSummary?.errors.length === 0 ? "Fermer" : "Annuler"}
            </button>
            {(!isDone || (resultSummary && resultSummary.errors.length > 0)) && (
              <button onClick={handleSubmit} disabled={isSubmitting || changedCount === 0 || isPreviewing}
                className="px-5 py-2 rounded-lg bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting
                  ? <><ImSpinner2 className="animate-spin" size={14} />Mise à jour...</>
                  : <><FiEdit3 size={14} />Mettre à jour {changedCount > 0 ? `(${changedCount})` : ""}</>}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Config colonnes disponibles ─────────────────────────────────────────────
type ColDef = { key: string; label: string; group: string; locked?: boolean; defaultOn: boolean };

const COLUMN_DEFS: ColDef[] = [
  // Identité
  { key: "Nom",               label: "Nom",               group: "Identité",       locked: true, defaultOn: true  },
  { key: "Prénom",            label: "Prénom",             group: "Identité",       locked: true, defaultOn: true  },
  { key: "Sexe",              label: "Sexe",               group: "Identité",       defaultOn: false },
  { key: "Date de naissance", label: "Date de naissance",  group: "Identité",       defaultOn: false },
  { key: "Nationalité",       label: "Nationalité",        group: "Identité",       defaultOn: false },
  // Matricule
  { key: "Ancien matricule",  label: "Ancien matricule",   group: "Matricule",      locked: true, defaultOn: true  },
  { key: "Nouveau matricule", label: "Nouveau matricule",  group: "Matricule",      locked: true, defaultOn: true  },
  { key: "Matricule actuel",  label: "Matricule actuel",   group: "Matricule",      defaultOn: false },
  // Professionnel
  { key: "Service",           label: "Service",            group: "Professionnel",  defaultOn: true  },
  { key: "Fonction",          label: "Fonction",           group: "Professionnel",  defaultOn: true  },
  { key: "Type contrat",      label: "Type contrat",       group: "Professionnel",  defaultOn: false },
  { key: "Catégorie",         label: "Catégorie",          group: "Professionnel",  defaultOn: false },
  { key: "Date d'embauche",   label: "Date d'embauche",    group: "Professionnel",  defaultOn: false },
  { key: "Localisation",      label: "Localisation",       group: "Professionnel",  defaultOn: false },
  { key: "Manager",           label: "Manager",            group: "Professionnel",  defaultOn: false },
  { key: "Business line",     label: "Business line",      group: "Professionnel",  defaultOn: false },
  // Statut
  { key: "Statut",            label: "Statut",             group: "Statut",         defaultOn: false },
  { key: "Date de sortie",    label: "Date de sortie",     group: "Statut",         defaultOn: false },
  // Contact
  { key: "Email",             label: "Email",              group: "Contact",        defaultOn: false },
  { key: "Téléphone",         label: "Téléphone",          group: "Contact",        defaultOn: false },
];

const DEFAULT_COLS = new Set(COLUMN_DEFS.filter(c => c.defaultOn).map(c => c.key));
const GROUPS = [...new Set(COLUMN_DEFS.map(c => c.group))];

// ─── Historique des Matricules Modal ─────────────────────────────────────────
function MatriculeChangedModal({
  onClose,
  onShowInfo,
  onShare,
}: {
  onClose:    () => void;
  onShowInfo: () => void;
  onShare:    (emails: string[], columns: string[]) => Promise<void>;
}) {
  type View = "choice" | "columns" | "emails" | "result";
  const [view,       setView]       = useState<View>("choice");
  const [selected,   setSelected]   = useState<Set<string>>(new Set(DEFAULT_COLS));
  const [emails,     setEmails]     = useState<string[]>([""]);
  const [isSending,  setIsSending]  = useState(false);
  const [result,     setResult]     = useState<{ sent: string[]; errors: { email: string; error: string }[]; total_employees: number } | null>(null);

  const toggleCol = (key: string) => {
    const def = COLUMN_DEFS.find(c => c.key === key);
    if (def?.locked) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const groupCols = COLUMN_DEFS.filter(c => c.group === group && !c.locked);
    const allOn = groupCols.every(c => selected.has(c.key));
    setSelected(prev => {
      const next = new Set(prev);
      groupCols.forEach(c => allOn ? next.delete(c.key) : next.add(c.key));
      return next;
    });
  };

  const addEmail    = () => setEmails(p => [...p, ""]);
  const removeEmail = (i: number) => setEmails(p => p.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, v: string) => setEmails(p => p.map((e, idx) => idx === i ? v : e));
  const validEmails = emails.map(e => e.trim()).filter(e => e.includes("@"));

  // Colonnes ordonnées selon COLUMN_DEFS
  const orderedCols = COLUMN_DEFS.filter(c => selected.has(c.key)).map(c => c.key);

  const handleSend = async () => {
    if (validEmails.length === 0 || orderedCols.length === 0) return;
    setIsSending(true);
    try { const res = await onShare(validEmails, orderedCols); setResult(res as any); setView("result"); }
    finally { setIsSending(false); }
  };

  const viewTitle =
    view === "choice"  ? "Que souhaitez-vous faire ?"
    : view === "columns" ? "Colonnes à exporter"
    : view === "emails"  ? "Destinataires"
    :                      "Résultat de l'envoi";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={{ duration: 0.18 }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <FiGitCommit className="text-violet-600" size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Historique des matricules</h2>
              <p className="text-xs text-gray-400">{viewTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"><FiX size={18} /></button>
        </div>

        {/* ── Vue choix ── */}
        {view === "choice" && (
          <div className="p-5 grid grid-cols-1 gap-3">
            <button onClick={() => { onShowInfo(); onClose(); }}
              className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-violet-400 hover:bg-violet-50/50 transition-all text-left group">
              <div className="p-2.5 rounded-xl bg-violet-100 group-hover:bg-violet-200 shrink-0"><FiEye className="text-violet-600" size={16} /></div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Afficher les informations</p>
                <p className="text-xs text-gray-400 mt-0.5">Filtrer le tableau sur les employés dont le matricule a changé (actifs + sortis).</p>
              </div>
            </button>
            <button onClick={() => setView("columns")}
              className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/50 transition-all text-left group">
              <div className="p-2.5 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 shrink-0"><FiShare2 className="text-emerald-600" size={16} /></div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Partager les informations</p>
                <p className="text-xs text-gray-400 mt-0.5">Choisir les colonnes à exporter et envoyer un fichier Excel par email.</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Étape 2 : Sélection des colonnes ── */}
        {view === "columns" && (
          <div className="flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">Choisissez les colonnes à inclure dans le fichier Excel.</p>
                <span className="text-xs text-violet-600 font-semibold">{orderedCols.length} sélectionnée(s)</span>
              </div>
              <div className="space-y-3">
                {GROUPS.map(group => {
                  const cols = COLUMN_DEFS.filter(c => c.group === group);
                  const freeCols = cols.filter(c => !c.locked);
                  const allOn = freeCols.length > 0 && freeCols.every(c => selected.has(c.key));
                  return (
                    <div key={group} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-700">{group}</span>
                        {freeCols.length > 0 && (
                          <button onClick={() => toggleGroup(group)} className="text-xs text-violet-600 hover:text-violet-800 font-medium transition">
                            {allOn ? "Tout désélectionner" : "Tout sélectionner"}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-0">
                        {cols.map(col => (
                          <label key={col.key}
                            className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition select-none border-b border-gray-100 last:border-0
                              ${col.locked ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50"}`}>
                            <input type="checkbox" checked={selected.has(col.key)} onChange={() => toggleCol(col.key)}
                              disabled={col.locked} className="accent-violet-600 w-3.5 h-3.5 shrink-0" />
                            <span className={`${col.locked ? "text-gray-500 font-medium" : "text-gray-700"} text-xs`}>
                              {col.label}
                              {col.locked && <span className="ml-1 text-[10px] text-gray-400">(obligatoire)</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 shrink-0">
              <button onClick={() => setView("choice")} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
                Retour
              </button>
              <button onClick={() => setView("emails")} disabled={orderedCols.length === 0}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
                Suivant — Destinataires →
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Destinataires ── */}
        {view === "emails" && (
          <div className="flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
              {/* Récap colonnes */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-violet-700 mb-1.5">{orderedCols.length} colonne(s) sélectionnée(s)</p>
                <div className="flex flex-wrap gap-1">
                  {orderedCols.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[11px] font-medium">{c}</span>
                  ))}
                </div>
              </div>
              {/* Liste emails */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <FiMail size={12} /> Adresses email
                </label>
                <div className="space-y-2">
                  {emails.map((email, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="email" value={email} onChange={e => updateEmail(i, e.target.value)}
                        placeholder="exemple@camusat.com"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }} />
                      {emails.length > 1 && (
                        <button onClick={() => removeEmail(i)} className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50"><FiTrash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={addEmail} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium transition">
                    <FiPlusCircle size={13} /> Ajouter un destinataire
                  </button>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 shrink-0">
              <button onClick={() => setView("columns")} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
                ← Retour
              </button>
              <button onClick={handleSend} disabled={isSending || validEmails.length === 0}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
                {isSending
                  ? <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />Envoi en cours…</>
                  : <><FiSend size={14} />Envoyer à {validEmails.length} destinataire(s)</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Vue résultat ── */}
        {view === "result" && result && (
          <div className="px-6 py-5 space-y-4">
            <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${result.errors.length === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
              {result.errors.length === 0
                ? <FiCheckCircle className="text-emerald-500 shrink-0" size={18} />
                : <FiAlertTriangle className="text-amber-500 shrink-0" size={18} />}
              <div>
                <p className="font-semibold text-sm text-gray-800">
                  {result.sent.length} email(s) envoyé(s) · {result.total_employees} employé(s) dans le fichier
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{orderedCols.length} colonne(s) exportée(s)</p>
                {result.errors.length > 0 && <p className="text-xs text-amber-700 mt-0.5">{result.errors.length} erreur(s) d'envoi</p>}
              </div>
            </div>
            {result.sent.length > 0 && (
              <ul className="text-xs text-gray-500 space-y-0.5">
                {result.sent.map(e => <li key={e} className="flex items-center gap-1.5"><FiCheckCircle size={11} className="text-emerald-500" />{e}</li>)}
              </ul>
            )}
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition">Fermer</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Page Principale ──────────────────────────────────────────────────────────
export default function GlobalEmployeesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [isLoading,    setIsLoading]    = useState<boolean>(true);
  const [isImporting,  setIsImporting]  = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [profileFilter,  setProfileFilter]  = useState<ProfileFilter>("ALL");
  const [contractFilter, setContractFilter] = useState<ContractFilter>("ALL");

  // ── Filtre "Historique des matricules" ──────────────────────────────────────
  const [matriculeChangedOnly, setMatriculeChangedOnly] = useState(false);
  const [matriculeModalOpen,   setMatriculeModalOpen]   = useState(false);

  // Quand le filtre matricule est actif : on ignore le filtre profil
  // (on veut voir actifs ET sortis)
  const employees = allEmployees.filter((e) => {
    if (matriculeChangedOnly) {
      // Seul le filtre contrat reste actif
      return contractFilter === "ALL" ||
        (contractFilter === "INTERIM" && e.type_contrat === "INTERIM") ||
        (contractFilter === "INTERNE" && e.type_contrat !== "INTERIM");
    }
    const profileOk =
      profileFilter === "ALL" ||
      (profileFilter === "ACTIVE" && (e.status === "ACTIVE" || e.is_active_employee === true)) ||
      (profileFilter === "EXITED" && e.status === "EXITED");
    const contractOk =
      contractFilter === "ALL" ||
      (contractFilter === "INTERIM" && e.type_contrat === "INTERIM") ||
      (contractFilter === "INTERNE" && e.type_contrat !== "INTERIM");
    return profileOk && contractOk;
  });

  // ── États des modales ────────────────────────────────────────────────────────
  const [selected,         setSelected]        = useState<Employee | null>(null);
  const [showModal,        setShowModal]        = useState(false);
  const [reinstateOpen,    setReinstateOpen]    = useState(false);
  const [reinstateTarget,  setReinstateTarget]  = useState<Employee | null>(null);
  const [exitOpen,         setExitOpen]         = useState(false);
  const [exitTarget,       setExitTarget]       = useState<Employee | null>(null);
  const [missionOpen,      setMissionOpen]      = useState(false);
  const [missionTarget,    setMissionTarget]    = useState<Employee | null>(null);
  const [bulkAccountsOpen, setBulkAccountsOpen] = useState(false);
  const [bulkMatOpen,      setBulkMatOpen]      = useState(false);

  // ── Dropdowns ────────────────────────────────────────────────────────────────
  const [profileDropdownOpen,  setProfileDropdownOpen]  = useState(false);
  const [contractDropdownOpen, setContractDropdownOpen] = useState(false);
  const profileDropdownRef  = useRef<HTMLDivElement>(null);
  const contractDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileDropdownRef.current  && !profileDropdownRef.current.contains(e.target as Node)) setProfileDropdownOpen(false);
      if (contractDropdownRef.current && !contractDropdownRef.current.contains(e.target as Node)) setContractDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Chargement ───────────────────────────────────────────────────────────────
  const fetchAllEmployees = async (matChanged = matriculeChangedOnly) => {
    setIsLoading(true);
    try {
      const data = await getEmployees({
        status: "ALL",
        ...(matChanged ? { has_matricule_change: true } : {}),
      });
      setAllEmployees(data);
    } catch {
      toast.error("Erreur lors du chargement des employés");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAllEmployees(); }, []);
  useEffect(() => { fetchAllEmployees(matriculeChangedOnly); }, [matriculeChangedOnly]);

  // ── Import Excel ─────────────────────────────────────────────────────────────
  const handleImport = async (file: File) => {
    setIsImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await importEmployees(formData);
      const summary: ImportResult = {
        created: result.created ?? 0,
        updated: result.updated ?? 0,
        skipped: result.skipped ?? 0,
        skipped_details: result.skipped_details ?? [],
      };
      setImportResult(summary);
      await fetchAllEmployees();
      if (summary.skipped > 0 && summary.created === 0 && summary.updated === 0)
        toast.error(`Import terminé — ${summary.skipped} ligne(s) ignorée(s)`);
      else
        toast.success(`Import terminé — ${summary.created} créé(s), ${summary.updated} mis à jour`);
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

  // ── Actions table ─────────────────────────────────────────────────────────────
  const handleEdit   = (emp: Employee) => { setSelected(emp); setShowModal(true); };
  const handleCreate = () => { setSelected(null); setShowModal(true); };

  const handleExitClick    = (emp: Employee) => { setExitTarget(emp);    setExitOpen(true);    };
  const handleMissionClick = (emp: Employee) => { setMissionTarget(emp); setMissionOpen(true); };

  const handleConfirmMission = async (payload: {
    on_mission: boolean; mission_label?: string; mission_start?: string | null; mission_end?: string | null;
  }) => {
    if (!missionTarget) return;
    try {
      await patchEmployee(missionTarget.id, payload);
      toast.success(payload.on_mission ? `${missionTarget.prenom} ${missionTarget.nom} défini(e) en mission` : `Mission terminée pour ${missionTarget.prenom} ${missionTarget.nom}`);
      setMissionOpen(false); setMissionTarget(null); fetchAllEmployees();
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Erreur lors de la mise à jour de la mission"); }
  };

  const handleConfirmExit = async (payload: { date_sortie: string; motif_sortie?: string }) => {
    if (!exitTarget) return;
    try {
      await markExit(exitTarget.id, payload);
      toast.success(`Sortie enregistrée pour ${exitTarget.prenom} ${exitTarget.nom}`);
      setExitOpen(false); setExitTarget(null); fetchAllEmployees();
    } catch (e: any) { toast.error(e?.response?.data?.error || "Erreur lors de l'enregistrement de la sortie"); }
  };

  const openReinstate = (emp: Employee) => { setReinstateTarget(emp); setReinstateOpen(true); };
  const doReinstate   = async (payload: { date_reintegration?: string; update_date_embauche?: boolean }) => {
    if (!reinstateTarget) return;
    try {
      await reinstate(reinstateTarget.id, payload);
      toast.success(`${reinstateTarget.prenom} ${reinstateTarget.nom} réintégré(e)`);
      setReinstateOpen(false); setReinstateTarget(null); fetchAllEmployees();
    } catch { toast.error("Erreur lors de la réintégration"); }
  };

  // ── Compteurs ─────────────────────────────────────────────────────────────────
  const totalCount   = allEmployees.length;
  const activeCount  = allEmployees.filter((e) => e.status === "ACTIVE" || e.is_active_employee).length;
  const interimCount = allEmployees.filter((e) => e.type_contrat === "INTERIM").length;
  const interneCount = allEmployees.filter((e) => e.type_contrat !== "INTERIM").length;

  const contractLabel =
    contractFilter === "ALL"       ? "Tous les contrats"
    : contractFilter === "INTERIM" ? "Intérimaires"
    :                                "Internes";

  const resetAllFilters = () => {
    setProfileFilter("ALL");
    setContractFilter("ALL");
    setMatriculeChangedOnly(false);
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6"
      >
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-camublue-900">
              Vue Globale — Tous les employés
            </h1>
            {/* Badges filtres actifs */}
            {(profileFilter !== "ALL" || contractFilter !== "ALL" || matriculeChangedOnly) && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {profileFilter !== "ALL" && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${profileFilter === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {profileFilter === "ACTIVE" ? "Actifs uniquement" : "Sortis uniquement"}
                    <button onClick={() => setProfileFilter("ALL")} className="ml-1 opacity-60 hover:opacity-100 transition">✕</button>
                  </span>
                )}
                {contractFilter !== "ALL" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {contractLabel}
                    <button onClick={() => setContractFilter("ALL")} className="ml-1 opacity-60 hover:opacity-100 transition">✕</button>
                  </span>
                )}
                {matriculeChangedOnly && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                    <FiGitCommit size={11} /> Historique des matricules · actifs + sortis
                    <button onClick={() => setMatriculeChangedOnly(false)} className="ml-0.5 hover:text-violet-900 transition"><FiX size={11} /></button>
                  </span>
                )}
                <button onClick={resetAllFilters} className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition">
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre profil */}
            <div className="relative" ref={profileDropdownRef}>
              <button onClick={() => setProfileDropdownOpen((o) => !o)}
                className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border shadow-sm transition font-medium ${
                  profileFilter === "ALL" ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  : profileFilter === "ACTIVE" ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  : "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"}`}>
                {profileFilter === "ALL" && <FaUsers size={13} />}
                {profileFilter === "ACTIVE" && <FaUserCheck size={13} />}
                {profileFilter === "EXITED" && <FaUserTimes size={13} />}
                {profileFilter === "ALL" ? "Tous les profils" : profileFilter === "ACTIVE" ? "Actifs" : "Sortis"}
                <FiChevronDown size={14} className={`transition-transform ${profileDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {profileDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                    {(["ALL", "ACTIVE", "EXITED"] as ProfileFilter[]).map((f) => (
                      <button key={f} onClick={() => { setProfileFilter(f); setProfileDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition ${profileFilter === f ? "bg-camublue-900/10 text-camublue-900 font-semibold" : "hover:bg-gray-50 text-gray-700"}`}>
                        {f === "ALL" && <FaUsers size={13} />}
                        {f === "ACTIVE" && <FaUserCheck size={13} className="text-emerald-600" />}
                        {f === "EXITED" && <FaUserTimes size={13} className="text-red-500" />}
                        {f === "ALL" ? "Tous les profils" : f === "ACTIVE" ? "Actifs" : "Sortis"}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Filtre contrat */}
            <div className="relative" ref={contractDropdownRef}>
              <button onClick={() => setContractDropdownOpen((o) => !o)}
                className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border shadow-sm transition font-medium ${contractFilter === "ALL" ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50" : "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"}`}>
                {contractLabel}
                <FiChevronDown size={14} className={`transition-transform ${contractDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {contractDropdownOpen && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                    {(["ALL", "INTERNE", "INTERIM"] as ContractFilter[]).map((f) => (
                      <button key={f} onClick={() => { setContractFilter(f); setContractDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition ${contractFilter === f ? "bg-camublue-900/10 text-camublue-900 font-semibold" : "hover:bg-gray-50 text-gray-700"}`}>
                        {f === "ALL" ? "Tous les contrats" : f === "INTERNE" ? "Internes" : "Intérimaires"}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-8 w-px bg-gray-200 hidden sm:block" />

            {/* Mettre à jour les matricules */}
            <button onClick={() => setBulkMatOpen(true)} disabled={isLoading || allEmployees.length === 0}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
              <FiEdit3 size={14} /> Mettre à jour les matricules
            </button>

            {/* Créer les comptes */}
            <button onClick={() => setBulkAccountsOpen(true)} disabled={isLoading || allEmployees.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
              <UserPlus size={14} /> Créer les comptes
            </button>

            {/* Ajouter un employé */}
            <button onClick={handleCreate}
              className="bg-camublue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 transition text-sm">
              <FaPlus size={13} /> Ajouter un employé
            </button>

            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* ── Compteurs rapides ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
            <p className="text-xs text-gray-500 font-medium">Total</p>
            <p className="text-2xl font-bold text-camublue-900 mt-0.5">{totalCount}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm px-4 py-3">
            <p className="text-xs text-emerald-600 font-medium">Actifs</p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{activeCount}</p>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <p className="text-xs text-slate-500 font-medium">Internes</p>
            <p className="text-2xl font-bold text-slate-700 mt-0.5">{interneCount}</p>
          </div>
          <div className="bg-purple-50 rounded-xl border border-purple-100 shadow-sm px-4 py-3">
            <p className="text-xs text-purple-600 font-medium">Intérimaires</p>
            <p className="text-2xl font-bold text-purple-700 mt-0.5">{interimCount}</p>
          </div>
        </div>

        {/* ── Stats header ── */}
        <div className="shrink-0">
          <EmployeesStatsHeader
            data={allEmployees}
            loading={isLoading}
            profileFilter={matriculeChangedOnly ? "ALL" : profileFilter}
            onProfileFilterChange={setProfileFilter}
            showExitsByContract
          />
        </div>

        {/* ── Table ── */}
        <div className="flex-1 min-h-0">
          <EmployeesTable
            employees={employees}
            isLoading={isLoading || isImporting}
            onEdit={handleEdit}
            onExit={handleExitClick}
            onReinstate={openReinstate}
            onMission={handleMissionClick}
            onImport={handleImport}
            onEmployeeUpdated={fetchAllEmployees}
            showContractType={true}
            matriculeChangedOnly={matriculeChangedOnly}
            onMatriculeChangedToggle={() => setMatriculeModalOpen(true)}
          />
        </div>

        {/* ── Modales ── */}
        <EmployeeFormModal open={showModal} onClose={() => setShowModal(false)} onSuccess={fetchAllEmployees} initialData={selected} />
        <ExitEmployeeModal open={exitOpen} onClose={() => setExitOpen(false)} employee={exitTarget} onConfirm={handleConfirmExit} />
        <ReinstateEmployeeModal open={reinstateOpen} onClose={() => setReinstateOpen(false)} employee={reinstateTarget} onConfirm={doReinstate} />
        <MissionModal open={missionOpen} onClose={() => setMissionOpen(false)} employee={missionTarget} onConfirm={handleConfirmMission} />

        <BulkCreateAccountsModal open={bulkAccountsOpen} employees={allEmployees} onClose={() => setBulkAccountsOpen(false)} onSuccess={fetchAllEmployees} />

        <AnimatePresence>
          {bulkMatOpen && (
            <BulkMatriculeModal
              employees={allEmployees}
              onClose={() => setBulkMatOpen(false)}
              onSuccess={() => { fetchAllEmployees(); setBulkMatOpen(false); }}
            />
          )}
        </AnimatePresence>

        {/* Historique des Matricules Modal */}
        <AnimatePresence>
          {matriculeModalOpen && (
            <MatriculeChangedModal
              onClose={() => setMatriculeModalOpen(false)}
              onShowInfo={() => { setMatriculeChangedOnly(true); setMatriculeModalOpen(false); }}
              onShare={async (emails, columns) => {
                const res = await shareMatriculeChanges({ emails, columns });
                return res as any;
              }}
            />
          )}
        </AnimatePresence>

        {/* Import result */}
        <AnimatePresence>
          {importResult && <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
}
