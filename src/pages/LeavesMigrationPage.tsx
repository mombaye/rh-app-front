// src/pages/LeavesMigrationPage.tsx
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, FileSpreadsheet, X,
  CheckCircle, AlertTriangle, Search, AlertCircle,
  ChevronLeft, ChevronRight, SlidersHorizontal, RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import * as XLSXStyle from "xlsx-js-style";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import AppLayout from "@/layouts/AppLayout";
import { leaveBalanceService, migrationSessionService } from "@/services/leaveService";
import { MigrationImportResult, MigrationImportRow } from "@/types/leave";

// ─── Types locaux ─────────────────────────────────────────────────────────────
interface EditableRow extends MigrationImportRow {
  edited: number;
  acquired_override?: number | null;  // null = utiliser calcul auto
  taken_override?: number | null;     // null = utiliser somme DB
}

// ─── Export Excel ─────────────────────────────────────────────────────────────
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MIGRATION_EXPORT_COLS = [
  "Matricule", "Nom", "Prénom", "Poste", "Date embauche",
  "Solde antérieur", "Congés acquis", "Solde congé actuel", "Congé pris", "Congé restant",
] as const;
type MigrationExportCol = typeof MIGRATION_EXPORT_COLS[number];

function exportMigrationXLSX(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const ws = XLSXStyle.utils.json_to_sheet(rows);
  const wb = XLSXStyle.utils.book_new();
  const keys = Object.keys(rows[0]);
  ws["!cols"] = keys.map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 3,
  }));
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };

  // En-têtes en bleu (#003c71) avec texte blanc en gras
  keys.forEach((_, idx) => {
    const cellRef = XLSXStyle.utils.encode_cell({ r: 0, c: idx });
    const cell = ws[cellRef];
    if (cell) {
      cell.s = {
        fill: { fgColor: { rgb: "003C71" } },
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { vertical: "center", horizontal: "left" },
      };
    }
  });

  XLSXStyle.utils.book_append_sheet(wb, ws, "Migration");
  XLSXStyle.writeFile(wb, `${filename}_${isoToday()}.xlsx`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Parse une date d'embauche (formats ISO "YYYY-MM-DD" ou "DD/MM/YYYY") en Date. */
function parseDateEmbauche(raw?: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  // ISO : YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // DD/MM/YYYY
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

/** Formate une date d'embauche brute en JJ/MM/AAAA pour l'affichage. */
function formatDateEmbauche(raw?: string): string {
  const d = parseDateEmbauche(raw);
  if (!d) return raw || "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
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
  const [rows,        setRows]        = useState<EditableRow[]>([]);
  const [fileName,    setFileName]    = useState<string>("");
  const [synced,      setSynced]      = useState<boolean>(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [loadingPrev,   setLoadingPrev]   = useState(false);
  const [loadingSync,   setLoadingSync]   = useState(false);
  const [loadingSnap,   setLoadingSnap]   = useState(false);
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [search,      setSearch]      = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Pagination ──────────────────────────────────────────────────────────────
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Filtres personnalisés ────────────────────────────────────────────────────
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [posteFiltre,  setPosteFiltre]  = useState("TOUS");
  const [serviceFiltre,setServiceFiltre]= useState("TOUS");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");

  // ── Export ────────────────────────────────────────────────────────────────────
  const [showExportDlg, setShowExportDlg] = useState(false);
  const [exportCols,    setExportCols]    = useState<MigrationExportCol[]>([...MIGRATION_EXPORT_COLS]);

  // ── Chargement de la session au montage (serveur en priorité, localStorage en fallback) ──
  useEffect(() => {
    migrationSessionService.get(currentYear)
      .then(session => {
        if (session && session.rows.length > 0) {
          // Données serveur → les utiliser
          setFileName(session.filename);
          setSynced(session.synced);
          setRows(session.rows.map((r: any) => ({
            ...r,
            edited: r.edited ?? r.new_remaining ?? r.current_remaining ?? 0,
          })));
        } else {
          // Pas de session serveur → tenter de récupérer le localStorage existant et le migrer
          try {
            const lsRows   = localStorage.getItem("migration_rows");
            const lsFname  = localStorage.getItem("migration_filename");
            const lsSynced = localStorage.getItem("migration_synced");
            if (lsRows && lsFname) {
              const parsed: EditableRow[] = JSON.parse(lsRows);
              const syncedVal = lsSynced === "true";
              setFileName(lsFname);
              setSynced(syncedVal);
              setRows(parsed);
              // Migrer vers le serveur et nettoyer localStorage
              migrationSessionService.save({
                year: currentYear,
                filename: lsFname,
                synced: syncedVal,
                rows: parsed,
              }).then(() => {
                localStorage.removeItem("migration_rows");
                localStorage.removeItem("migration_filename");
                localStorage.removeItem("migration_synced");
              }).catch(() => {});
            }
          } catch { /* localStorage invalide, on ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => setSessionLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Sauvegarder la session sur le serveur (visible pour tous les utilisateurs)
      migrationSessionService.save({
        year: currentYear,
        filename: f.name,
        synced: false,
        rows: newRows,
      }).catch(() => {});
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
    if (pendingFile) {
      loadFile(pendingFile);
      setPendingFile(null);
    }
  };

  const handleOverwriteCancel = () => {
    setConfirmOpen(false);
    setPendingFile(null);
  };

  // ── Modifier le solde antérieur (seule saisie manuelle) ─────────────────────
  // Règles (calcul automatique) :
  //   Congés acquis      = mois de présence écoulés depuis la date d'embauche
  //                         × incrément mensuel (incrément du mois en cours
  //                         crédité seulement en fin de mois)
  //   Congé pris         = somme des demandes de congé validées de l'année
  //   Solde congé actuel = Solde antérieur + Congés acquis
  //   Congé restant      = Solde congé actuel - Congé pris
  const recomputeRow = (
    r: EditableRow,
    overrides: Partial<{ solde_anterieur: number; acquired: number; taken: number }>,
  ): EditableRow => {
    const solde_anterieur  = overrides.solde_anterieur  ?? r.solde_anterieur  ?? 0;
    const acquired         = overrides.acquired         ?? r.acquired_override ?? r.acquired ?? 0;
    const taken            = overrides.taken            ?? r.taken_override    ?? r.taken    ?? 0;
    const current_remaining = solde_anterieur + acquired;
    const edited            = current_remaining - taken;

    return {
      ...r,
      solde_anterieur,
      acquired_override: "acquired" in overrides ? overrides.acquired! : r.acquired_override ?? null,
      taken_override:    "taken"    in overrides ? overrides.taken!    : r.taken_override    ?? null,
      current_remaining,
      edited,
    };
  };

  const updateField = (
    rowIndex: number,
    field: "solde_anterieur" | "acquired" | "taken",
    value: string,
  ) => {
    const num = parseFloat(value);
    const val = isNaN(num) ? 0 : num;
    setRows(prev => prev.map((r, i) =>
      i === rowIndex ? recomputeRow(r, { [field]: val }) : r
    ));
    if (synced) setSynced(false);
  };

  // ── Synchroniser ────────────────────────────────────────────────────────────
  // Applique directement les valeurs (édités ou non) du tableau aux soldes des
  // employés concernés, sans avoir besoin de re-soumettre un fichier.
  const handleSync = async () => {
    setLoadingSync(true);
    try {
      const okRows = rows.filter(r => r.status === "ok" && r.matricule);
      if (okRows.length === 0) {
        toast.error("Aucun employé à synchroniser.");
        return;
      }

      await leaveBalanceService.migrationApply(
        okRows.map(r => ({
          matricule:         r.matricule!,
          poste:             r.poste,
          date_embauche:     r.date_embauche,
          solde_anterieur:   r.solde_anterieur ?? 0,
          ...(r.acquired_override != null ? { acquired_override: r.acquired_override } : {}),
          ...(r.taken_override    != null ? { taken_override:    r.taken_override    } : {}),
        })),
        { year: currentYear }
      );
      setSynced(true);
      setShowSyncBanner(true);
      setTimeout(() => setShowSyncBanner(false), 3000);
      toast.success("Synchronisation réussie — soldes mis à jour.");
      // Mettre à jour la session serveur avec synced=true
      migrationSessionService.save({
        year: currentYear,
        filename: fileName,
        synced: true,
        rows,
      }).catch(() => {});
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de la synchronisation.");
    } finally {
      setLoadingSync(false);
    }
  };

  // ── Générer depuis la base (tous les employés non-intérimaires) ─────────────
  // Fusionne les données DB avec les soldes_anterieur déjà saisis dans la session.
  // Les employés du fichier conservent leur solde_anterieur.
  // Les nouveaux (basculements, nouvelles intégrations) apparaissent avec leur solde calculé.
  const handleSnapshot = () => doSnapshot();

  const doSnapshot = async () => {
    setLoadingSnap(true);
    try {
      const res = await leaveBalanceService.migrationSnapshot(currentYear);

      // Index des soldes_anterieur déjà saisis dans la session courante (par matricule)
      const existingSoldes: Record<string, number> = {};
      for (const r of rows) {
        if (r.matricule && r.status === "ok") {
          existingSoldes[r.matricule.toUpperCase()] = r.solde_anterieur ?? 0;
        }
      }

      const newRows = res.results.map((r: any) => {
        // Préserver le solde_anterieur saisi manuellement dans la session (depuis fichier)
        const mat = (r.matricule || "").toUpperCase();
        const solde_anterieur = mat in existingSoldes ? existingSoldes[mat] : (r.solde_anterieur ?? 0);
        const acquired = r.acquired ?? 0;
        const taken    = r.taken ?? 0;
        const current_remaining = solde_anterieur + acquired;
        const edited = current_remaining - taken;
        return { ...r, solde_anterieur, current_remaining, edited };
      });

      const newFileName = fileName && !fileName.startsWith("Employés base")
        ? fileName  // Conserver le nom du fichier original
        : `Employés base de données (${res.processed})`;

      setRows(newRows);
      setFileName(newFileName);
      setSynced(false);
      setSearch("");

      migrationSessionService.save({
        year: currentYear,
        filename: newFileName,
        synced: false,
        rows: newRows,
      }).catch(() => {});

      const newCount = newRows.filter(
        (r: any) => !(r.matricule?.toUpperCase() in existingSoldes)
      ).length;
      if (newCount > 0) {
        toast.success(`${res.processed} employé(s) chargé(s) · ${newCount} nouveau(x) ajouté(s).`);
      } else {
        toast.success(`${res.processed} employé(s) chargé(s) depuis la base de données.`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors du chargement.");
    } finally {
      setLoadingSnap(false);
    }
  };

  // ── Réinitialiser ───────────────────────────────────────────────────────────
  const reset = () => {
    setFileName("");
    setRows([]);
    setSynced(false);
    setSearch("");
    if (inputRef.current) inputRef.current.value = "";
    migrationSessionService.clear(currentYear).catch(() => {});
  };

  const downloadTemplate = () => {
    const headers = [
      "NOM_PRENOM", "MATRICULE", "POSTE", "DATE_EMBAUCHE", "SOLDE_ANTERIEUR",
    ];
    const ws = XLSXStyle.utils.aoa_to_sheet([
      headers,
      ["Jean Dupont",  "EMP001",    "Technicien",     "15/03/2020",    10],
      ["Marie Martin", "EMP002",    "Comptable",      "01/09/2019",    5],
      ["Ahmed Diallo", "EMP003",    "Chef de service","10/01/2018",    12],
    ]);
    ws["!cols"] = [
      { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
    ];
    // En-têtes en bleu (#003c71) avec texte blanc en gras, comme le reste de la plateforme
    headers.forEach((_, idx) => {
      const cellRef = XLSXStyle.utils.encode_cell({ r: 0, c: idx });
      const cell = ws[cellRef];
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: "003C71" } },
          font: { color: { rgb: "FFFFFF" }, bold: true },
          alignment: { vertical: "center", horizontal: "left" },
        };
      }
    });
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, `Migration ${currentYear}`);
    XLSXStyle.writeFile(wb, `template_migration_soldes_${currentYear}.xlsx`);
  };

  // Listes des postes / services disponibles (pour les menus du filtre)
  const postes = Array.from(
    new Set(rows.map(r => (r.poste ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const services = Array.from(
    new Set(rows.map(r => (r.service ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const dateFromObj = dateFrom ? new Date(dateFrom) : null;
  const dateToObj   = dateTo   ? new Date(dateTo)   : null;

  const filtersActive = posteFiltre !== "TOUS" || serviceFiltre !== "TOUS" || !!dateFrom || !!dateTo;

  const q        = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (q && !(r.employee.toLowerCase().includes(q) || (r.matricule ?? "").toLowerCase().includes(q))) {
      return false;
    }
    if (posteFiltre !== "TOUS" && (r.poste ?? "").trim() !== posteFiltre) return false;
    if (serviceFiltre !== "TOUS" && (r.service ?? "").trim() !== serviceFiltre) return false;
    if (dateFromObj || dateToObj) {
      const d = parseDateEmbauche(r.date_embauche);
      if (!d) return false;
      if (dateFromObj && d < dateFromObj) return false;
      if (dateToObj && d > dateToObj) return false;
    }
    return true;
  });
  const okCount  = rows.filter(r => r.status === "ok").length;
  const errCount = rows.filter(r => r.status !== "ok").length;
  const hasData  = rows.length > 0 || !!fileName;

  // Export Excel complet
  const doExport = () => {
    const okRows = filtered.filter(r => r.status === "ok");
    const ALL: Record<MigrationExportCol, (r: EditableRow) => any> = {
      "Matricule":           (r) => r.matricule || "",
      "Nom":                 (r) => r.nom ?? r.employee.split(" ")[0] ?? "",
      "Prénom":              (r) => r.prenom ?? r.employee.split(" ").slice(1).join(" "),
      "Poste":               (r) => r.poste || "",
      "Date embauche":       (r) => formatDateEmbauche(r.date_embauche),
      "Solde antérieur":     (r) => r.solde_anterieur ?? ((r.acquired ?? 0) - (r.taken ?? 0)),
      "Congés acquis":       (r) => r.acquired ?? 0,
      "Solde congé actuel":  (r) => r.current_remaining ?? 0,
      "Congé pris":          (r) => r.taken ?? 0,
      "Congé restant":       (r) => r.edited,
    };
    exportMigrationXLSX("migration_soldes",
      okRows.map((r) => Object.fromEntries(exportCols.map((k) => [k, ALL[k](r)])))
    );
    setShowExportDlg(false);
  };

  // Export modèle "solde antérieur uniquement" (à remplir et réimporter)
  const exportSoldeAnterieurTemplate = () => {
    const okRows = rows.filter(r => r.status === "ok");
    if (!okRows.length) {
      toast.error("Générez d'abord les données depuis la base.");
      return;
    }
    const data = okRows.map(r => ({
      "MATRICULE":        r.matricule || "",
      "NOM":              r.nom ?? r.employee.split(" ")[0] ?? "",
      "PRENOM":           r.prenom ?? r.employee.split(" ").slice(1).join(" ") ?? "",
      "SOLDE_ANTERIEUR":  r.solde_anterieur ?? 0,
    }));
    exportMigrationXLSX("solde_anterieur_a_remplir", data);
  };

  // Pagination dérivée
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page si la recherche ou les filtres changent
  const prevSearch = useRef(search);
  if (prevSearch.current !== search) { prevSearch.current = search; if (page !== 1) setPage(1); }

  const filterKey = `${posteFiltre}|${serviceFiltre}|${dateFrom}|${dateTo}`;
  const prevFilterKey = useRef(filterKey);
  if (prevFilterKey.current !== filterKey) { prevFilterKey.current = filterKey; if (page !== 1) setPage(1); }

  // Génère la liste de numéros de pages avec ellipsis
  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 4)  return [1, 2, 3, 4, 5, "…", totalPages];
    if (safePage >= totalPages - 3) return [1, "…", totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages];
    return [1, "…", safePage - 1, safePage, safePage + 1, "…", totalPages];
  })();

  return (
    <AppLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Chargement initial session ───────────────────────────────────── */}
        {sessionLoading && (
          <div className="flex items-center justify-center py-24 gap-3">
            <ImSpinner2 className="animate-spin text-[#003c71]" size={28} />
            <p className="text-gray-500 text-sm font-medium">Chargement de la session…</p>
          </div>
        )}

        {!sessionLoading && (<>

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
            {/* Exporter */}
            {okCount > 0 && (
              <button
                onClick={() => setShowExportDlg(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#003c71] hover:bg-[#003c71]/90 text-white text-sm font-bold transition shadow-sm"
              >
                <FileSpreadsheet size={15} /> Exporter
              </button>
            )}

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

            {/* Générer depuis la base */}
            <button
              onClick={handleSnapshot}
              disabled={loadingSnap || loadingPrev}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#003c71] text-[#003c71] bg-white hover:bg-[#003c71]/5 text-sm font-bold transition shadow-sm disabled:opacity-60"
            >
              {loadingSnap
                ? <ImSpinner2 className="animate-spin" size={15} />
                : <RefreshCw size={15} />}
              Générer depuis la base
            </button>

            {/* Export modèle solde antérieur */}
            {rows.length > 0 && (
              <button
                onClick={exportSoldeAnterieurTemplate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 text-sm font-bold transition shadow-sm"
                title="Exporter un fichier à remplir avec les soldes antérieurs"
              >
                <Download size={15} />
                Modèle solde antérieur
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
              disabled={loadingPrev || loadingSnap}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] hover:bg-[#003c71]/90 text-white text-sm font-bold transition shadow-sm disabled:opacity-60"
            >
              {loadingPrev
                ? <ImSpinner2 className="animate-spin" size={15} />
                : <Upload size={15} />}
              Importer un fichier
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
                  Colonnes détectées automatiquement : NOM · MATRICULE · SOLDE_ANTERIEUR (POSTE et DATE_EMBAUCHE optionnels)
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

              {/* Modifications non synchronisées → CTA Synchroniser */}
              {!synced && okCount > 0 && (
                <div className="flex items-center gap-2.5 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 flex-wrap">
                  <AlertCircle size={16} className="text-sky-600 shrink-0" />
                  <p className="text-sm text-sky-800 flex-1 min-w-[200px]">
                    Des valeurs ont été modifiées. Cliquez sur <strong>Synchroniser</strong> pour
                    appliquer les changements aux soldes des {okCount} employé{okCount > 1 ? "s" : ""} concerné{okCount > 1 ? "s" : ""}.
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={loadingSync}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-sm disabled:opacity-50 shrink-0"
                  >
                    {loadingSync
                      ? <ImSpinner2 className="animate-spin" size={14} />
                      : <CheckCircle size={15} />}
                    {loadingSync ? "Synchronisation…" : `Synchroniser (${okCount})`}
                  </button>
                </div>
              )}

              {/* Recherche + Filtre */}
              <div className="flex items-center gap-2 w-full max-w-2xl mx-auto">
                <div className="relative flex-1">
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

                <button
                  onClick={() => setFilterOpen(true)}
                  className="relative shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-[#003c71] text-white text-sm font-semibold shadow-sm hover:bg-[#003c71]/90 transition"
                >
                  <SlidersHorizontal size={15} />
                  Filtre
                  {filtersActive && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
                  )}
                </button>
              </div>

              {/* Tableau */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#003c71]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Matricule</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Nom</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Prénom</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Poste</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wide">Date embauche</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide">Solde antérieur</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide">Congés acquis</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide">Solde congé actuel</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide">Congé pris</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide">Congé restant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginated.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-400">
                            Aucun résultat pour cette recherche.
                          </td>
                        </tr>
                      )}
                      {paginated.map((row, idx) => {
                        const globalIdx = rows.indexOf(row);
                        const isOk      = row.status === "ok";
                        const acquired  = row.acquired_override ?? row.acquired ?? 0;
                        const taken     = row.taken_override    ?? row.taken    ?? 0;
                        const soldeAnterieur = row.solde_anterieur ?? 0;
                        const nom    = row.nom    ?? row.employee.split(" ")[0] ?? "";
                        const prenom = row.prenom ?? row.employee.split(" ").slice(1).join(" ");
                        return (
                          <motion.tr
                            key={row.row}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.008 }}
                            className={`transition ${isOk ? "hover:bg-gray-50/50" : "bg-red-50/60"}`}
                          >
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">{row.matricule || "—"}</td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-800">{nom || "—"}</p>
                              {row.message && <p className="text-[11px] text-red-500 mt-0.5">{row.message}</p>}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{prenom || "—"}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{row.poste || "—"}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{formatDateEmbauche(row.date_embauche)}</td>
                            <td className="px-4 py-3 text-center">
                              {isOk ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={soldeAnterieur}
                                  onChange={(e) => updateField(globalIdx, "solde_anterieur", e.target.value)}
                                  className="w-20 text-center font-mono text-gray-600 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition mx-auto block"
                                />
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center"
                              title="Modifiable : remplace le calcul automatique si vous saisissez une valeur">
                              {isOk ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={acquired.toFixed(2)}
                                  onChange={(e) => updateField(globalIdx, "acquired", e.target.value)}
                                  className="w-20 text-center font-mono border border-gray-200 text-gray-600 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition mx-auto block"
                                />
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-semibold text-gray-700 text-sm" title="Calculé : Solde antérieur + Congés acquis">
                              {isOk && row.current_remaining !== null ? row.current_remaining.toFixed(2) : "—"}
                            </td>
                            <td className="px-4 py-3 text-center"
                              title="Modifiable : remplace la somme automatique des demandes validées si vous saisissez une valeur">
                              {isOk ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={taken.toFixed(2)}
                                  onChange={(e) => updateField(globalIdx, "taken", e.target.value)}
                                  className="w-20 text-center font-mono border border-gray-200 text-gray-600 rounded-lg px-2 py-1 text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition mx-auto block"
                                />
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-[#003c71] text-sm"
                              title="Calculé automatiquement : Solde congé actuel - Congé pris">
                              {isOk ? row.edited.toFixed(2) : <span className="text-gray-300">—</span>}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Pagination ── */}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between flex-wrap gap-3 pt-1">

                  {/* Infos + sélecteur de taille */}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>
                      {filtered.length === 0
                        ? "Aucun résultat"
                        : <>
                            <span className="font-semibold text-gray-700">
                              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}
                            </span>
                            {" "}sur{" "}
                            <span className="font-semibold text-gray-700">{filtered.length}</span>
                            {" "}résultat{filtered.length > 1 ? "s" : ""}
                          </>
                      }
                    </span>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#003c71] bg-white"
                    >
                      {[10, 25, 50, 100].map(n => (
                        <option key={n} value={n}>{n} / page</option>
                      ))}
                    </select>
                  </div>

                  {/* Boutons de pages */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeft size={14} />
                      </button>

                      {pageNumbers.map((n, i) =>
                        n === "…" ? (
                          <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs select-none">
                            …
                          </span>
                        ) : (
                          <button
                            key={n}
                            onClick={() => setPage(n as number)}
                            className={`w-8 h-8 rounded-lg text-xs font-semibold transition border ${
                              safePage === n
                                ? "bg-[#003c71] text-white border-[#003c71] shadow-sm"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {n}
                          </button>
                        )
                      )}

                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

        </>)}
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

      {/* ── Modal Filtre personnalisé ─────────────────────────────────────── */}
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setFilterOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              {/* En-tête */}
              <div className="flex items-center justify-between px-5 py-4 bg-[#003c71]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal size={16} />
                  Filtrer la liste
                </h3>
                <button onClick={() => setFilterOpen(false)} className="text-white/80 hover:text-white transition">
                  <X size={18} />
                </button>
              </div>

              {/* Contenu */}
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Poste</label>
                  <select
                    value={posteFiltre}
                    onChange={(e) => setPosteFiltre(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]"
                  >
                    <option value="TOUS">Tous les postes</option>
                    {postes.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Service</label>
                  <select
                    value={serviceFiltre}
                    onChange={(e) => setServiceFiltre(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]"
                  >
                    <option value="TOUS">Tous les services</option>
                    {services.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Date d'embauche — période
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]"
                    />
                    <span className="text-slate-400 text-xs">à</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]"
                    />
                  </div>
                </div>
              </div>

              {/* Pied */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => { setPosteFiltre("TOUS"); setServiceFiltre("TOUS"); setDateFrom(""); setDateTo(""); }}
                  disabled={!filtersActive}
                  className="text-xs font-medium text-slate-500 hover:text-[#003c71] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Réinitialiser
                </button>
                <button
                  onClick={() => setFilterOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#003c71] text-white text-xs font-semibold shadow-sm hover:bg-[#003c71]/90 transition"
                >
                  Appliquer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Export Dialog ── */}
      <AnimatePresence>
        {showExportDlg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
            onClick={() => setShowExportDlg(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 bg-[#003c71]">
                <div>
                  <h2 className="font-black text-white text-base">Export personnalisé</h2>
                  <p className="text-xs text-white/70 mt-0.5">
                    {okCount} employé{okCount > 1 ? "s" : ""} · Sélectionnez les colonnes à inclure
                  </p>
                </div>
                <button onClick={() => setShowExportDlg(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/80">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 py-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs font-semibold text-slate-500">
                    {exportCols.length}/{MIGRATION_EXPORT_COLS.length} colonnes sélectionnées
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setExportCols([...MIGRATION_EXPORT_COLS])}
                      className="text-xs text-[#003c71] hover:underline font-medium">Tout</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={() => setExportCols([])}
                      className="text-xs text-slate-500 hover:underline font-medium">Aucun</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {MIGRATION_EXPORT_COLS.map((col) => {
                    const checked = exportCols.includes(col);
                    return (
                      <label key={col}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border transition text-sm ${
                          checked ? "bg-[#003c71]/5 border-[#003c71]/30 text-[#003c71]" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => {
                          setExportCols((prev) =>
                            checked ? prev.filter((k) => k !== col) : [...prev, col]
                          );
                        }} className="accent-[#003c71] w-3.5 h-3.5" />
                        <span className="font-medium">{col}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setShowExportDlg(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">
                  Annuler
                </button>
                <button onClick={doExport} disabled={exportCols.length === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#003c71] text-white text-sm font-bold hover:bg-[#003c71]/90 disabled:opacity-50 transition">
                  <FileSpreadsheet className="h-4 w-4" />
                  Télécharger
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
