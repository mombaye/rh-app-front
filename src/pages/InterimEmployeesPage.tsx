import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import EmployeesStatsHeader from "@/components/employees/EmployeesStatsHeader";
import EmployeesTable from "@/components/employees/EmployeeTable";
import ExitEmployeeModal from "@/components/employees/ExitEmployeeModal";
import EmployeeFormModal from "@/components/employees/EmployeeFormModal";
import ReinstateEmployeeModal from "@/components/employees/ReinstateEmployeeModal";
import EmployeeMissionModal from "@/components/employees/EmployeeMissionModal";
import { Employee } from "@/types/employee";
import {
  getEmployees,
  importEmployees,
  markExit,
  reinstate,
  sendAccessCodesInterim,
  bulkUpdateMatricules,
  previewMatriculeChanges,
  MatriculeUpdate,
  MatriculeChange,
} from "@/services/employeeService";
import { FaPlus, FaUserCheck, FaUserTimes, FaUsers } from "react-icons/fa";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiX,
  FiEdit3,
  FiUploadCloud,
  FiArrowRight,
  FiChevronDown,
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

// ─── Bulk Update Matricules Modal ─────────────────────────────────────────────
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
    employees.map((e) => ({ id: e.id, nom: e.nom, prenom: e.prenom, oldMatricule: e.matricule, newMatricule: e.matricule }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [search, setSearch] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [resultSummary, setResultSummary] = useState<{ updated: number; errors: { id: number; matricule: string; error: string }[] } | null>(null);
  const [previewSummary, setPreviewSummary] = useState<{ changed: number; unchanged: number; not_found: number; conflict: number } | null>(null);

  const changedCount = rows.filter((r) => r.newMatricule.trim() !== r.oldMatricule && !r.success).length;

  const filteredRows = rows
    .filter((r) =>
      r.nom.toLowerCase().includes(search.toLowerCase()) ||
      r.prenom.toLowerCase().includes(search.toLowerCase()) ||
      r.oldMatricule.toLowerCase().includes(search.toLowerCase()) ||
      r.newMatricule.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const priority = (r: MatriculeRow) => {
        if (r.previewStatus === "conflict") return 0;
        if (r.previewStatus === "not_found") return 1;
        if (r.newMatricule.trim() !== r.oldMatricule && !r.success) return 2;
        return 3;
      };
      return priority(a) - priority(b);
    });

  const handleChange = (id: number, value: string) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, newMatricule: value, error: undefined, success: undefined } : r));

  const handleReset = (id: number) =>
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, newMatricule: r.oldMatricule, error: undefined, success: undefined, previewStatus: undefined, conflictDetail: undefined } : r));

  const handleResetAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, newMatricule: r.oldMatricule, error: undefined, success: undefined, previewStatus: undefined, conflictDetail: undefined })));
    setPreviewSummary(null);
  };

  const handleExcelPreview = async (file: File) => {
    setIsPreviewing(true); setPreviewSummary(null);
    try {
      const result = await previewMatriculeChanges(file);
      setPreviewSummary(result.summary);
      const changeById = new Map<number, MatriculeChange>();
      const changeByOldMat = new Map<string, MatriculeChange>();
      for (const c of result.changes) {
        if (c.id !== null) changeById.set(c.id, c);
        changeByOldMat.set(c.old_matricule, c);
      }
      setRows((prev) => prev.map((r) => {
        const change = changeById.get(r.id) ?? changeByOldMat.get(r.oldMatricule);
        if (!change) return r;
        return { ...r, newMatricule: change.new_matricule, previewStatus: change.status, conflictDetail: change.conflict_detail, error: undefined, success: undefined };
      }));
      const { changed, conflict, not_found } = result.summary;
      if (changed > 0) toast.success(`${changed} changement(s) détecté(s)${conflict > 0 ? ` · ${conflict} conflit(s)` : ""}${not_found > 0 ? ` · ${not_found} introuvable(s)` : ""}`);
      else toast("Aucun changement détecté dans le fichier.", { icon: "ℹ️" });
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
      setResultSummary(result); setIsDone(true);
      const errorMap = new Map(result.errors.map((e) => [e.id, e.error]));
      setRows((prev) => prev.map((r) => {
        if (r.newMatricule.trim() === r.oldMatricule || r.success) return r;
        const err = errorMap.get(r.id);
        return err ? { ...r, error: err } : { ...r, oldMatricule: r.newMatricule.trim(), success: true, previewStatus: undefined };
      }));
      if (result.errors.length === 0) { toast.success(`${result.updated} matricule(s) mis à jour avec succès`); onSuccess(); }
      else toast.error(`${result.errors.length} erreur(s) — voir le détail dans le tableau`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la mise à jour");
    } finally {
      setIsSubmitting(false);
    }
  };

  const conflictCount = rows.filter((r) => r.previewStatus === "conflict" && r.newMatricule.trim() !== r.oldMatricule).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ duration: 0.2 }}
        className="w-full max-w-full sm:max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Mise à jour des matricules</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Modifiez les matricules directement dans le tableau ou importez un fichier Excel.{" "}
              {changedCount > 0 && <span className="font-semibold text-camublue-900">{changedCount} modification(s) en attente</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100"><FiX size={18} /></button>
        </div>
        <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExcelPreview(f); }} />
        {previewSummary && (
          <div className="px-6 pt-4 shrink-0">
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium"><FiCheckCircle size={14} />{previewSummary.changed} à modifier</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">{previewSummary.unchanged} inchangé(s)</span>
              {previewSummary.conflict > 0 && <><span className="text-gray-400">·</span><span className="flex items-center gap-1.5 text-red-600 font-medium"><FiAlertTriangle size={14} />{previewSummary.conflict} conflit(s)</span></>}
              {previewSummary.not_found > 0 && <><span className="text-gray-400">·</span><span className="flex items-center gap-1.5 text-amber-600 font-medium"><FiAlertTriangle size={14} />{previewSummary.not_found} introuvable(s)</span></>}
            </div>
          </div>
        )}
        {isDone && resultSummary && (
          <div className={`mx-6 mt-3 rounded-xl px-4 py-3 flex items-start gap-3 text-sm shrink-0 ${resultSummary.errors.length === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            {resultSummary.errors.length === 0 ? <FiCheckCircle className="text-emerald-500 mt-0.5 shrink-0" size={16} /> : <FiAlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={16} />}
            <p className="font-semibold text-gray-800">{resultSummary.updated} matricule(s) mis à jour.{resultSummary.errors.length > 0 && ` ${resultSummary.errors.length} erreur(s) dans le tableau ci-dessous.`}</p>
          </div>
        )}
        <div className="px-6 pt-4 pb-2 flex items-center gap-3 shrink-0">
          <input type="text" placeholder="Rechercher par nom, prénom ou matricule..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900" />
          {(changedCount > 0 || previewSummary) && !isDone && (
            <button onClick={handleResetAll} className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 whitespace-nowrap">Tout réinitialiser</button>
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
                const isChanged = row.newMatricule.trim() !== row.oldMatricule && !row.success;
                const isConflict = row.previewStatus === "conflict";
                const isNotFound = row.previewStatus === "not_found";
                return (
                  <tr key={row.id ?? row.oldMatricule} className={`transition-colors ${row.success ? "bg-emerald-50" : row.error || isConflict ? "bg-red-50" : isNotFound ? "bg-amber-50" : isChanged ? "bg-blue-50" : ""}`}>
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
                        <input type="text" value={row.newMatricule} onChange={(e) => handleChange(row.id, e.target.value)}
                          disabled={isSubmitting || row.success || isNotFound}
                          className={`w-full border rounded-lg px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 transition ${row.success ? "border-emerald-300 bg-emerald-50 text-emerald-700 cursor-not-allowed" : isConflict || row.error ? "border-red-300 bg-red-50 focus:ring-red-300" : isNotFound ? "border-amber-300 bg-amber-50 text-amber-700 cursor-not-allowed" : isChanged ? "border-blue-400 bg-white focus:ring-camublue-900" : "border-gray-300 bg-white focus:ring-camublue-900"}`}
                        />
                        {isConflict && <p className="text-xs text-red-600">{row.conflictDetail ?? "Conflit : matricule déjà utilisé"}</p>}
                        {row.error && !isConflict && <p className="text-xs text-red-600">{row.error}</p>}
                        {row.success && <p className="text-xs text-emerald-600 flex items-center gap-1"><FiCheckCircle size={11} /> Mis à jour</p>}
                      </div>
                    </td>
                    <td className="py-2.5 text-center">
                      {isChanged && !isNotFound && (
                        <button onClick={() => handleReset(row.id)} title="Annuler la modification" className="text-gray-400 hover:text-red-500 transition"><FiX size={14} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">Aucun employé trouvé.</td></tr>}
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
              className="px-4 py-2 rounded-lg border border-gray-300 hover:border-camublue-900 hover:bg-blue-50 text-gray-600 hover:text-camublue-900 text-sm font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Colonnes attendues : ANCIEN_MATRICULE / NOUVEAU_MATRICULE">
              {isPreviewing ? <><ImSpinner2 className="animate-spin" size={14} />Analyse…</> : <><FiUploadCloud size={14} />Importer Excel</>}
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition">
              {isDone && resultSummary?.errors.length === 0 ? "Fermer" : "Annuler"}
            </button>
            {(!isDone || (resultSummary && resultSummary.errors.length > 0)) && (
              <button onClick={handleSubmit} disabled={isSubmitting || changedCount === 0 || isPreviewing}
                className="px-5 py-2 rounded-lg bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {isSubmitting ? <><ImSpinner2 className="animate-spin" size={14} />Mise à jour...</> : <><FiEdit3 size={14} />Mettre à jour {changedCount > 0 ? `(${changedCount})` : ""}</>}
              </button>
            )}
          </div>
        </div>
      </motion.div>
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
  const [missionTarget, setMissionTarget] = useState<Employee | null>(null);
  const [isSendingCodes, setIsSendingCodes] = useState(false);
  const [bulkMatOpen, setBulkMatOpen] = useState(false);

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
  const handleCreate = () => { setSelected(null); setShowModal(true); };
  const handleExitClick = (emp: Employee) => { setExitTarget(emp); setExitOpen(true); };
  const handleMission   = (emp: Employee) => { setMissionTarget(emp); };

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
              <p className="text-sm mt-1 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  profileFilter === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {profileFilter === "ACTIVE" ? "Actifs uniquement" : "Sortis uniquement"}
                </span>
                <button onClick={() => setProfileFilter("ALL")} className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition">
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
              onClick={() => setBulkMatOpen(true)}
              disabled={isLoading || allEmployees.length === 0}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiEdit3 size={14} />
              Mettre à jour les matricules
            </button>

            <button
              onClick={handleCreate}
              className="bg-camublue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 transition"
            >
              <FaPlus /> Ajouter un intérimaire
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
            onMission={handleMission}
            onImport={handleImport}
            onEmployeeUpdated={fetchInterimEmployees}
            showContractType={false}
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
        <EmployeeMissionModal
          employee={missionTarget}
          onClose={() => setMissionTarget(null)}
          onUpdated={(updated) => setAllEmployees(prev => prev.map(e => e.id === updated.id ? updated : e))}
        />

        <AnimatePresence>
          {bulkMatOpen && (
            <BulkMatriculeModal
              employees={allEmployees}
              onClose={() => setBulkMatOpen(false)}
              onSuccess={() => { fetchInterimEmployees(); setBulkMatOpen(false); }}
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
