// src/pages/LeavesMigrationPage.tsx
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, FileSpreadsheet, X,
  CheckCircle, AlertTriangle, Search, AlertCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import AppLayout from "@/layouts/AppLayout";
import { leaveBalanceService } from "@/services/leaveService";
import { MigrationImportResult, MigrationImportRow } from "@/types/leave";

// ─── Clés localStorage ────────────────────────────────────────────────────────
const LS_ROWS   = "migration_rows";
const LS_FNAME  = "migration_filename";
const LS_SYNCED = "migration_synced";

// ─── Badge de détection ───────────────────────────────────────────────────────
function MatchBadge({ row }: { row: MigrationImportRow }) {
  if (row.status === "not_found") return <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-100 text-red-600">Introuvable</span>;
  if (row.status === "ambiguous") return <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-orange-100 text-orange-600">Ambigu</span>;
  if (row.status === "error")     return <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-100 text-red-600">Erreur</span>;
  if (row.match_type === "matricule")  return <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700">Matricule</span>;
  if (row.match_type === "name_exact") return <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-sky-100 text-sky-700">Nom exact</span>;
  if (row.match_type === "name_fuzzy") return <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700">Nom approx.</span>;
  return null;
}

// ─── Types locaux ─────────────────────────────────────────────────────────────
interface EditableRow extends MigrationImportRow {
  edited: number;
}

// ─── Modal de confirmation remplacement ──────────────────────────────────────
function OverwriteConfirmModal({
  oldName,
  newName,
  onConfirm,
  onCancel,
}: {
  oldName: string;
  newName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertCircle size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-base">Remplacer le contenu actuel ?</h3>
            <p className="text-sm text-gray-500 mt-1">
              Les données chargées depuis <span className="font-semibold text-gray-700">«&nbsp;{oldName}&nbsp;»</span> seront
              remplacées par <span className="font-semibold text-gray-700">«&nbsp;{newName}&nbsp;»</span>.
            </p>
            <p className="text-sm text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              ⚠️ Si vous avez déjà synchronisé, les soldes en base ne seront pas affectés — seul l'affichage sera remplacé.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 font-medium transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition"
          >
            Remplacer quand même
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LeavesMigrationPage() {
  const inputRef    = useRef<HTMLInputElement>(null);
  const currentYear = new Date().getFullYear();

  // ── Restauration depuis localStorage ──────────────────────────────────────
  const [rows,        setRows]        = useState<EditableRow[]>(() => {
    try {
      const saved = localStorage.getItem(LS_ROWS);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [fileName,    setFileName]    = useState<string>(() =>
    localStorage.getItem(LS_FNAME) ?? ""
  );

  const [synced,      setSynced]      = useState<boolean>(() =>
    localStorage.getItem(LS_SYNCED) === "true"
  );

  const [loadingPrev,   setLoadingPrev]   = useState(false);
  const [loadingSync,   setLoadingSync]   = useState(false);
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [search,      setSearch]      = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Persistance automatique dans localStorage ──────────────────────────────
  useEffect(() => {
    if (rows.length > 0) {
      localStorage.setItem(LS_ROWS, JSON.stringify(rows));
    } else {
      localStorage.removeItem(LS_ROWS);
    }
  }, [rows]);

  useEffect(() => {
    if (fileName) {
      localStorage.setItem(LS_FNAME, fileName);
    } else {
      localStorage.removeItem(LS_FNAME);
    }
  }, [fileName]);

  useEffect(() => {
    localStorage.setItem(LS_SYNCED, String(synced));
  }, [synced]);

  // ── Chargement effectif d'un fichier ────────────────────────────────────────
  const loadFile = async (f: File) => {
    setFileName(f.name);
    setRows([]);
    setSynced(false);
    setSearch("");
    setLoadingPrev(true);
    try {
      const res: MigrationImportResult = await leaveBalanceService.migrationImport(f, {
        dry_run: true,
        year: currentYear,
      });
      const newRows = res.results.map(r => ({
        ...r,
        edited: r.new_remaining ?? r.current_remaining ?? 0,
      }));
      setRows(newRows);
      if (res.errors_count > 0) {
        toast(`${res.processed} employé(s) détecté(s) · ${res.errors_count} ligne(s) non reconnue(s)`, { icon: "⚠️" });
      } else {
        toast.success(`${res.processed} employé(s) chargé(s) avec succès.`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors du chargement du fichier.");
      setFileName("");
    } finally {
      setLoadingPrev(false);
    }
  };

  // ── Sélection d'un fichier ──────────────────────────────────────────────────
  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Fichier Excel (.xlsx / .xls) ou CSV requis.");
      return;
    }
    if (inputRef.current) inputRef.current.value = "";

    // Des données existent déjà → demander confirmation
    if (rows.length > 0 || fileName) {
      setPendingFile(f);
      setConfirmOpen(true);
      return;
    }
    loadFile(f);
  };

  const handleOverwriteConfirm = () => {
    setConfirmOpen(false);
    if (pendingFile) loadFile(pendingFile);
    setPendingFile(null);
  };

  const handleOverwriteCancel = () => {
    setConfirmOpen(false);
    setPendingFile(null);
  };

  // ── Modifier une ligne ──────────────────────────────────────────────────────
  const updateEdited = (rowIndex: number, value: string) => {
    const num = parseFloat(value);
    setRows(prev => prev.map((r, i) =>
      i === rowIndex ? { ...r, edited: isNaN(num) ? 0 : num } : r
    ));
    if (synced) setSynced(false);
  };

  // ── Synchroniser ────────────────────────────────────────────────────────────
  const handleSync = async () => {
    if (!fileName) return;
    // NOTE : on ne peut pas re-soumettre le fichier original après un reload
    // On utilise les soldes édités stockés en localStorage
    setLoadingSync(true);
    try {
      // Reconstruction du fichier virtuel à partir des rows édités
      const ws = XLSX.utils.aoa_to_sheet([
        ["NOM_PRENOM", "MATRICULE", "SOLDE_RESTANT"],
        ...rows
          .filter(r => r.status === "ok")
          .map(r => [r.employee, r.matricule ?? "", r.edited]),
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Migration");
      const buf  = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const virtualFile = new File([blob], fileName, { type: blob.type });

      await leaveBalanceService.migrationImport(virtualFile, {
        dry_run: false,
        year: currentYear,
      });
      setSynced(true);
      setShowSyncBanner(true);
      setTimeout(() => setShowSyncBanner(false), 3000);
      toast.success("Synchronisation réussie — soldes mis à jour.");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de la synchronisation.");
    } finally {
      setLoadingSync(false);
    }
  };

  // ── Réinitialiser ───────────────────────────────────────────────────────────
  const reset = () => {
    setFileName("");
    setRows([]);
    setSynced(false);
    setSearch("");
    localStorage.removeItem(LS_ROWS);
    localStorage.removeItem(LS_FNAME);
    localStorage.removeItem(LS_SYNCED);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["NOM_PRENOM",   "MATRICULE", "SOLDE_RESTANT"],
      ["Jean Dupont",  "EMP001",    15.5],
      ["Marie Martin", "EMP002",    8],
      ["Ahmed Diallo", "EMP003",    22],
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Migration ${currentYear}`);
    XLSX.writeFile(wb, `template_migration_soldes_${currentYear}.xlsx`);
  };

  const q        = search.trim().toLowerCase();
  const filtered = rows.filter(r =>
    !q || r.employee.toLowerCase().includes(q) || (r.matricule ?? "").toLowerCase().includes(q)
  );
  const okCount  = rows.filter(r => r.status === "ok").length;
  const errCount = rows.filter(r => r.status !== "ok").length;
  const hasData  = rows.length > 0 || !!fileName;

  return (
    <AppLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Migration des soldes de congés</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Importez les soldes depuis votre ancienne plateforme · Année {currentYear}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Modèle */}
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition font-medium"
            >
              <Download size={15} /> Modèle
            </button>

            {/* Synchroniser */}
            {rows.length > 0 && !loadingPrev && (
              <button
                onClick={handleSync}
                disabled={loadingSync || okCount === 0 || synced}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-50 ${
                  synced
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {loadingSync
                  ? <ImSpinner2 className="animate-spin" size={14} />
                  : <CheckCircle size={15} />}
                {loadingSync
                  ? "Synchronisation…"
                  : synced
                    ? `Synchronisé (${okCount})`
                    : `Synchroniser (${okCount} employé(s))`}
              </button>
            )}

            {/* Importer */}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={loadingPrev}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] hover:bg-[#003c71]/90 text-white text-sm font-bold transition shadow-sm disabled:opacity-60"
            >
              {loadingPrev
                ? <ImSpinner2 className="animate-spin" size={15} />
                : <Upload size={15} />}
              {fileName
                ? fileName.length > 22 ? fileName.slice(0, 20) + "…" : fileName
                : "Importer un fichier"}
            </button>
          </div>
        </motion.div>

        {/* ── Contenu ─────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* État initial — aucune donnée */}
          {!hasData && !loadingPrev && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="border-2 border-dashed border-gray-200 rounded-2xl p-16 text-center cursor-pointer hover:border-[#003c71]/40 hover:bg-[#003c71]/5 transition"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              >
                <FileSpreadsheet size={40} className="mx-auto mb-4 text-gray-200" />
                <p className="font-semibold text-gray-500">Glissez votre fichier ici</p>
                <p className="text-sm text-gray-400 mt-1">.xlsx · .xls · .csv</p>
                <p className="text-xs text-gray-300 mt-3">
                  Colonnes détectées automatiquement : NOM · MATRICULE · SOLDE_RESTANT
                </p>
              </div>
            </motion.div>
          )}

          {/* Chargement */}
          {loadingPrev && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-3"
            >
              <ImSpinner2 className="animate-spin text-[#003c71]" size={30} />
              <p className="text-gray-500 text-sm font-medium">Analyse du fichier en cours…</p>
            </motion.div>
          )}

          {/* Résultats */}
          {hasData && !loadingPrev && rows.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Fichier source */}
              {fileName && (
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                  <FileSpreadsheet size={15} className="text-[#003c71] shrink-0" />
                  <span>Fichier chargé : <span className="font-semibold text-gray-700">{fileName}</span></span>
                  {synced && (
                    <span className="ml-auto flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                      <CheckCircle size={13} /> Synchronisé
                    </span>
                  )}
                </div>
              )}

              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total détectés", value: rows.length, dot: "bg-slate-300"   },
                  { label: "Prêts à sync.",  value: okCount,     dot: "bg-emerald-400" },
                  { label: "Non reconnus",   value: errCount,    dot: "bg-red-400"     },
                  { label: "Année",          value: currentYear, dot: "bg-[#003c71]"   },
                ].map(s => (
                  <div key={s.label}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl border border-gray-200 bg-white">
                    <span className="text-2xl font-bold text-[#003c71]">{s.value}</span>
                    <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bannières */}
              <AnimatePresence>
                {showSyncBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3"
                  >
                    <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-800 font-semibold">
                      Synchronisation réussie — {okCount} solde(s) mis à jour avec succès.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {!synced && errCount > 0 && (
                <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-800">
                    <strong>{errCount} ligne(s)</strong> n'ont pas pu être associées à un employé. Vérifiez les lignes en rouge.
                  </p>
                </div>
              )}

              {/* Recherche */}
              <div className="relative w-full max-w-2xl mx-auto">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher un employé…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition bg-white shadow-sm"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Tableau */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Employé</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Détection</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Solde actuel</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Nouveau solde</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Différence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                            Aucun résultat pour cette recherche.
                          </td>
                        </tr>
                      )}
                      {filtered.map((row, idx) => {
                        const globalIdx = rows.indexOf(row);
                        const delta     = row.edited - (row.current_remaining ?? 0);
                        const isOk      = row.status === "ok";
                        return (
                          <motion.tr
                            key={row.row}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.012 }}
                            className={`transition ${isOk ? "hover:bg-gray-50/50" : "bg-red-50/60"}`}
                          >
                            <td className="px-4 py-3 text-xs text-gray-400 font-mono">{row.row}</td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-800">{row.employee}</p>
                              {row.matricule && <p className="text-[11px] text-gray-400 font-mono mt-0.5">{row.matricule}</p>}
                              {row.message   && <p className="text-[11px] text-red-500 mt-0.5">{row.message}</p>}
                            </td>
                            <td className="px-4 py-3 text-center"><MatchBadge row={row} /></td>
                            <td className="px-4 py-3 text-center font-mono text-gray-500 text-sm">
                              {row.current_remaining !== null ? row.current_remaining.toFixed(2) : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isOk ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={row.edited}
                                  onChange={(e) => updateEdited(globalIdx, e.target.value)}
                                  className="w-24 text-center font-mono font-bold text-[#003c71] border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition mx-auto block"
                                />
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isOk ? (
                                <span className={`font-mono font-bold text-sm ${
                                  delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-gray-400"
                                }`}>
                                  {delta > 0 ? "+" : ""}{delta.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal confirmation remplacement ─────────────────────────────── */}
      <AnimatePresence>
        {confirmOpen && pendingFile && (
          <OverwriteConfirmModal
            oldName={fileName}
            newName={pendingFile.name}
            onConfirm={handleOverwriteConfirm}
            onCancel={handleOverwriteCancel}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
