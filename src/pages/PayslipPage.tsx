import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import AppLayout from "@/layouts/AppLayout";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaFilePdf, FaSort, FaSortUp, FaSortDown,
  FaChevronLeft, FaChevronRight, FaAngleDoubleLeft, FaAngleDoubleRight,
} from "react-icons/fa";
import {
  Upload, X, Zap, ListChecks, History,
  CheckCircle, XCircle, Clock, RefreshCw, ChevronDown,
  Download, Trash2, Send,
} from "lucide-react";
import { ImSpinner2 } from "react-icons/im";

import BulletinSendProgress from "@/components/payslips/BulletinSendProgress";
import PayslipStatsCards    from "@/components/payslips/PayslipStatsCards";
import BulletinsLogsModal   from "@/components/payslips/BulletinsLogsModal";
import PayslipTargetsModal  from "@/components/payslips/PayslipTargetsModal";
import { BulletinResendModal } from "@/components/payslips/BulletinResendModal";

import {
  uploadPayslipPdf,
  sendBulletinsSelected,
  startPreviewPayslipPdf,
  fetchPayslipPreviewProgress,
  fetchBulletinsSummary,
  deleteBulletinsByMonth,
} from "@/services/employeeService";
import type { PayslipPreviewResponse, BulletinMonthSummary } from "@/services/employeeService";

dayjs.locale("fr");

// ─── Constantes ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// ─── Badge de statut pour la table ───────────────────────────────────────────

const StatusBadge = ({ status, count }: { status: "sent" | "failed" | "pending"; count: number }) => {
  if (status === "sent")
    return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle className="h-3 w-3" />{count}</span>;
  if (status === "failed")
    return <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700"><XCircle className="h-3 w-3" />{count}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700"><Clock className="h-3 w-3" />{count}</span>;
};

// ─── Zone de dépôt de fichier (drag & drop) ───────────────────────────────────

function DropZone({
  onFile,
  disabled,
}: {
  onFile: (f: File) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f?.type === "application/pdf") onFile(f);
      else toast.error("Veuillez déposer un fichier PDF.");
    },
    [disabled, onFile],
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  };

  return (
    <div
      onDragEnter={() => !disabled && setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer select-none
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${dragging ? "border-camublue-600 bg-camublue-50" : "border-slate-300 hover:border-camublue-400 hover:bg-slate-50"}`}
    >
      <div className={`p-4 rounded-2xl ${dragging ? "bg-camublue-100" : "bg-slate-100"} transition-colors`}>
        <Upload className={`h-8 w-8 ${dragging ? "text-camublue-700" : "text-slate-400"}`} />
      </div>
      <div>
        <p className="font-semibold text-slate-700">Glissez-déposez votre PDF ici</p>
        <p className="text-sm text-slate-400 mt-0.5">ou cliquez pour parcourir</p>
      </div>
      <input ref={inputRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
    </div>
  );
}

// ─── Modale d'import principale (drag & drop + choix du mode) ────────────────

type UploadStep = "idle" | "preview_loading" | "preview_ready" | "sending";

function ImportModal({
  open,
  onClose,
  onTaskStarted,
  onPreviewReady,
}: {
  open: boolean;
  onClose: () => void;
  onTaskStarted: (taskId: string) => void;
  onPreviewReady: (preview: PayslipPreviewResponse) => void;
}) {
  const [file, setFile]     = useState<File | null>(null);
  const [step, setStep]     = useState<UploadStep>("idle");
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState({ progress: 0, total_pages: 0, found: 0, errors_count: 0 });

  // Reset on open
  useEffect(() => {
    if (open) { setFile(null); setStep("idle"); setPreviewTaskId(null); }
  }, [open]);

  // Polling preview progress
  useEffect(() => {
    if (!previewTaskId) return;
    let stopped = false;
    const tick = async () => {
      try {
        const p = await fetchPayslipPreviewProgress(previewTaskId);
        if (stopped) return;
        setPreviewMeta({
          progress: Number(p.progress ?? 0),
          total_pages: p.total_pages ?? 0,
          found: p.found ?? 0,
          errors_count: p.errors_count ?? 0,
        });
        if (p.status === "SUCCESS" && p.result) {
          setPreviewTaskId(null);
          setStep("preview_ready");
          onPreviewReady(p.result);
          toast.success(`Analyse terminée : ${p.result.items.length} bulletin(s) détecté(s)`);
          onClose();
        }
        if (p.status === "FAILURE") {
          setPreviewTaskId(null);
          setStep("idle");
          toast.error("Analyse échouée.");
        }
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 1500);
    return () => { stopped = true; window.clearInterval(id); };
  }, [previewTaskId]);

  const handleAutoSend = async () => {
    if (!file) return;
    setStep("sending");
    const t = toast.loading("Envoi automatique en cours…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await uploadPayslipPdf(fd);
      if (data.task_id) {
        toast.success("Envoi lancé — suivi en cours…", { id: t });
        onTaskStarted(data.task_id);
        onClose();
      } else {
        setStep("idle");
        toast.error(data.error || "Erreur au lancement.", { id: t });
      }
    } catch (e: any) {
      setStep("idle");
      toast.error(e?.response?.data?.error || "Erreur lors de l'envoi automatique", { id: t });
    }
  };

  const handleSelectSend = async () => {
    if (!file) return;
    setStep("preview_loading");
    const t = toast.loading("Analyse du fichier…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await startPreviewPayslipPdf(fd);
      toast.dismiss(t);
      if (data.task_id) {
        setPreviewTaskId(data.task_id);
      } else {
        setStep("idle");
        toast.error(data.error || "Erreur analyse.");
      }
    } catch (e: any) {
      setStep("idle");
      toast.error(e?.response?.data?.error || "Erreur analyse du fichier", { id: t });
    }
  };

  if (!open) return null;

  const busy = step === "sending" || step === "preview_loading";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-camublue-900">
              <FaFilePdf className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Importer les bulletins</h3>
              <p className="text-xs text-slate-500">Choisissez un PDF multi-bulletins</p>
            </div>
          </div>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-40 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Drop zone */}
          <DropZone onFile={setFile} disabled={busy} />

          {/* Fichier sélectionné */}
          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50"
              >
                <div className="p-2 rounded-lg bg-red-50">
                  <FaFilePdf className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} Mo</p>
                </div>
                {!busy && (
                  <button onClick={() => setFile(null)} className="p-1 rounded-md hover:bg-slate-200 text-slate-400 transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress analyse */}
          {step === "preview_loading" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                <ImSpinner2 className="animate-spin h-4 w-4" />
                Analyse OCR en cours… {previewMeta.progress}%
              </div>
              <div className="h-2 w-full rounded-full bg-blue-200">
                <div className="h-2 rounded-full bg-camublue-900 transition-all" style={{ width: `${previewMeta.progress}%` }} />
              </div>
              {previewMeta.total_pages > 0 && (
                <p className="text-xs text-blue-500">
                  {Math.round((previewMeta.progress * previewMeta.total_pages) / 100)}/{previewMeta.total_pages} pages
                  · {previewMeta.found} détecté(s) · {previewMeta.errors_count} erreur(s)
                </p>
              )}
            </div>
          )}

          {/* Mode d'envoi */}
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={!file || busy}
              onClick={handleAutoSend}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="p-2.5 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 transition">
                {step === "sending"
                  ? <ImSpinner2 className="h-5 w-5 text-emerald-700 animate-spin" />
                  : <Zap className="h-5 w-5 text-emerald-700" />}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-emerald-800">Envoi automatique</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Envoie à tous les bulletins détectés</p>
              </div>
            </button>

            <button
              disabled={!file || busy}
              onClick={handleSelectSend}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-camublue-200 bg-camublue-50 hover:bg-camublue-100 hover:border-camublue-400 transition disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="p-2.5 rounded-xl bg-camublue-100 group-hover:bg-camublue-200 transition">
                {step === "preview_loading"
                  ? <ImSpinner2 className="h-5 w-5 text-camublue-700 animate-spin" />
                  : <ListChecks className="h-5 w-5 text-camublue-700" />}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-camublue-800">Envoi sélectif</p>
                <p className="text-[11px] text-camublue-600 mt-0.5">Choisissez les destinataires</p>
              </div>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 text-center">
            Chaque bulletin est chiffré avec le code d'accès personnel de l'employé (dérivé de son matricule).
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Colonnes disponibles pour l'export ──────────────────────────────────────

type ColKey = "mois" | "annee" | "total" | "envoyes" | "echecs" | "taux";
const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "mois",    label: "Mois"             },
  { key: "annee",   label: "Année"            },
  { key: "total",   label: "Total"            },
  { key: "envoyes", label: "Envoyés"          },
  { key: "echecs",  label: "Échecs"           },
  { key: "taux",    label: "Taux de réussite" },
];

function ExportModal({
  open,
  onClose,
  rows,
  selectedKeys,
}: {
  open: boolean;
  onClose: () => void;
  rows: BulletinMonthSummary[];
  selectedKeys: Set<string>;   // clés "year-month" des lignes cochées dans la table
}) {
  const [cols, setCols] = useState<Set<ColKey>>(new Set(ALL_COLS.map((c) => c.key)));
  const [scope, setScope] = useState<"all" | "selected">("all");

  useEffect(() => {
    if (open) { setCols(new Set(ALL_COLS.map((c) => c.key))); setScope("all"); }
  }, [open]);

  const toggleCol = (k: ColKey) =>
    setCols((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const doExport = () => {
    const data = scope === "selected" && selectedKeys.size > 0
      ? rows.filter((r) => selectedKeys.has(`${r.year}-${r.month}`))
      : rows;

    const activeCols = ALL_COLS.filter((c) => cols.has(c.key));

    const sheetRows = data.map((r) => {
      const rate = r.total ? Math.round((r.sent / r.total) * 100) : 0;
      const obj: Record<string, any> = {};
      activeCols.forEach(({ key, label }) => {
        switch (key) {
          case "mois":    obj[label] = MONTH_NAMES[r.month]; break;
          case "annee":   obj[label] = r.year;               break;
          case "total":   obj[label] = r.total;              break;
          case "envoyes": obj[label] = r.sent;               break;
          case "echecs":  obj[label] = r.failed;             break;
          case "taux":    obj[label] = `${rate}%`;           break;
        }
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(sheetRows);

    // Largeurs de colonnes
    ws["!cols"] = activeCols.map(({ label }) => ({
      wch: Math.max(label.length, ...sheetRows.map((r) => String(r[label] ?? "").length)) + 3,
    }));

    // Gel de la première ligne
    (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulletins");
    XLSX.writeFile(wb, `bulletins_résumé_${new Date().toISOString().slice(0, 10)}.xlsx`);
    onClose();
    toast.success("Export XLSX téléchargé.");
  };

  if (!open) return null;

  const exportCount = scope === "selected" && selectedKeys.size > 0
    ? selectedKeys.size
    : rows.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600">
              <Download className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Export personnalisé</h3>
              <p className="text-xs text-slate-500">Choisissez les données à exporter</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Périmètre */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Périmètre</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { val: "all",      label: `Tous les mois (${rows.length})` },
                { val: "selected", label: `Sélection (${selectedKeys.size})`, disabled: selectedKeys.size === 0 },
              ] as const).map(({ val, label, disabled }) => (
                <button
                  key={val}
                  disabled={disabled}
                  onClick={() => setScope(val)}
                  className={`px-3 py-2 rounded-xl border text-sm font-medium transition
                    ${scope === val ? "bg-camublue-900 text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}
                    ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Colonnes */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Colonnes à inclure</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_COLS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition select-none">
                  <input
                    type="checkbox"
                    checked={cols.has(key)}
                    onChange={() => toggleCol(key)}
                    className="accent-camublue-900 h-3.5 w-3.5"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            disabled={cols.size === 0 || exportCount === 0}
            onClick={doExport}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exporter {exportCount} ligne{exportCount > 1 ? "s" : ""} en CSV
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function PayslipPage() {
  const [start, setStart] = useState(dayjs().subtract(90, "day").format("YYYY-MM-DD"));
  const [end,   setEnd]   = useState(dayjs().format("YYYY-MM-DD"));
  const [dateOpen, setDateOpen] = useState(false);

  const [summary, setSummary]           = useState<BulletinMonthSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const total  = useMemo(() => summary.reduce((a, x) => a + (x.total || 0), 0), [summary]);
  const sent   = useMemo(() => summary.reduce((a, x) => a + (x.sent  || 0), 0), [summary]);
  const failed = useMemo(() => summary.reduce((a, x) => a + (x.failed || 0), 0), [summary]);

  // Logs modal
  const [logsOpen,  setLogsOpen]  = useState(false);
  const [logsTitle, setLogsTitle] = useState("Historique");
  const [logsScope, setLogsScope] = useState<{ year?: number; month?: number; status?: "sent" | "failed" | "pending" }>({});
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false);

  // Task progress
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // Upload modal
  const [importOpen, setImportOpen] = useState(false);

  // Select targets modal
  const [preview, setPreview]         = useState<PayslipPreviewResponse | null>(null);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [sendingSelected, setSendingSelected] = useState(false);

  // Sélection de lignes + export
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [exportOpen,   setExportOpen]   = useState(false);
  const [resendOpen,   setResendOpen]   = useState(false);

  const toggleRowSelect = (key: string) =>
    setSelectedRows((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleSelectAll = () => {
    const allKeys = sortedSummary.map((r) => `${r.year}-${r.month}`);
    setSelectedRows((prev) =>
      allKeys.every((k) => prev.has(k)) ? new Set() : new Set(allKeys)
    );
  };

  const doDeleteMonth = async (year: number, month: number) => {
    const label = `${MONTH_NAMES[month]} ${year}`;
    if (!window.confirm(`Supprimer tous les logs de ${label} ?`)) return;
    const t = toast.loading(`Suppression de ${label}…`);
    try {
      const res = await deleteBulletinsByMonth(year, month);
      toast.success(`${res.deleted} log(s) supprimé(s).`, { id: t });
      loadSummary();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de la suppression.", { id: t });
    }
  };

  // Table sort + pagination
  type SortKey = "year" | "month" | "total" | "sent" | "failed";
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(10);

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      setSummary(await fetchBulletinsSummary({ start, end }));
    } catch {
      toast.error("Erreur lors du chargement du résumé");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, []);

  // Quand une tâche tourne, auto-refresh logs s'ils sont ouverts
  useEffect(() => {
    setLogsAutoRefresh(!!currentTaskId);
  }, [currentTaskId]);

  const openFromCard = (kind: "all" | "sent" | "failed") => {
    setLogsScope(kind === "all" ? {} : { status: kind });
    setLogsTitle(kind === "all" ? "Tous les bulletins" : kind === "sent" ? "Bulletins envoyés" : "Bulletins en échec");
    setLogsOpen(true);
  };

  const openMonth = (y: number, m: number) => {
    setLogsScope({ year: y, month: m });
    setLogsTitle(`${MONTH_NAMES[m]} ${y}`);
    setLogsOpen(true);
  };

  const handleTaskStarted = (taskId: string) => {
    setCurrentTaskId(taskId);
  };

  const handlePreviewReady = (p: PayslipPreviewResponse) => {
    setPreview(p);
    setTargetsOpen(true);
  };

  // Table
  const handleSort = (key: SortKey) => {
    setSortConfig((prev) =>
      !prev || prev.key !== key ? { key, direction: "asc" } : { key, direction: prev.direction === "asc" ? "desc" : "asc" }
    );
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <FaSort className="opacity-50 text-[10px]" />;
    return sortConfig.direction === "asc" ? <FaSortUp className="text-[10px]" /> : <FaSortDown className="text-[10px]" />;
  };

  const sortedSummary = useMemo(() => {
    if (!sortConfig) return summary;
    return [...summary].sort((a, b) => {
      const av = a[sortConfig.key as keyof BulletinMonthSummary] as number;
      const bv = b[sortConfig.key as keyof BulletinMonthSummary] as number;
      return sortConfig.direction === "asc" ? av - bv : bv - av;
    });
  }, [summary, sortConfig]);

  const totalPages      = Math.max(1, Math.ceil(sortedSummary.length / pageSize));
  const paginatedSummary = sortedSummary.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const goToPage = (p: number) => setCurrentPage(Math.min(Math.max(1, p), totalPages));
  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const s = Math.max(2, currentPage - 1), e = Math.min(totalPages - 1, currentPage + 1);
      for (let i = s; i <= e; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const taux = total ? Math.round((sent / total) * 100) : 0;

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-4 p-4 md:p-6"
      >
        {/* ── En-tête ── */}
        <div className="flex flex-col gap-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-camublue-900">Bulletins de salaire</h1>
              <p className="text-sm text-slate-500 mt-0.5">Importez, distribuez et suivez les bulletins de vos employés</p>
            </div>
            {/* Actions principales */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtre date + bouton expand */}
              <div className="relative">
                <button
                  onClick={() => setDateOpen((v) => !v)}
                  className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm hover:bg-slate-50 transition"
                >
                  <span className="text-slate-600">{start} → {end}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${dateOpen ? "rotate-180" : ""}`} />
                </button>
                {dateOpen && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 flex flex-col gap-3 min-w-[260px]">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Début</label>
                      <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Fin</label>
                      <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: "3 mois", days: 90 },
                        { label: "6 mois", days: 180 },
                        { label: "1 an", days: 365 },
                      ].map(({ label, days }) => (
                        <button
                          key={days}
                          onClick={() => {
                            setStart(dayjs().subtract(days, "day").format("YYYY-MM-DD"));
                            setEnd(dayjs().format("YYYY-MM-DD"));
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => { setDateOpen(false); loadSummary(); }}
                      className="w-full py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-800 transition"
                    >
                      Appliquer
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setLogsOpen(true)}
                className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm hover:bg-slate-50 transition"
              >
                <History className="h-4 w-4 text-slate-500" />
                <span className="hidden sm:inline">Historique</span>
              </button>

              <button
                onClick={() => setExportOpen(true)}
                disabled={summary.length === 0}
                className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-xl px-3 py-2 text-sm hover:bg-emerald-100 transition font-semibold disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Exporter</span>
              </button>

              <button
                onClick={loadSummary}
                disabled={summaryLoading}
                className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm hover:bg-slate-50 transition disabled:opacity-40"
                title="Actualiser"
              >
                <RefreshCw className={`h-4 w-4 text-slate-500 ${summaryLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>

              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 bg-camublue-900 text-white rounded-xl px-4 py-2 text-sm hover:bg-camublue-800 transition font-semibold shadow-sm"
              >
                <Upload className="h-4 w-4" />
                Importer PDF
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="shrink-0">
          <PayslipStatsCards
            loading={summaryLoading}
            total={total}
            sent={sent}
            failed={failed}
            onOpen={openFromCard}
          />
        </div>

        {/* ── Barre de progression envoi ── */}
        <AnimatePresence>
          {currentTaskId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="shrink-0"
            >
              <BulletinSendProgress
                taskId={currentTaskId}
                onDone={() => { setCurrentTaskId(null); loadSummary(); setLogsAutoRefresh(false); }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tableau résumé ── */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <h2 className="text-base font-semibold text-slate-700">
              Récapitulatif par mois
              {summary.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  — taux global : <span className={`font-semibold ${taux >= 90 ? "text-emerald-600" : taux >= 70 ? "text-amber-600" : "text-red-600"}`}>{taux}%</span>
                </span>
              )}
            </h2>
            {selectedRows.size > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                {selectedRows.size} sélectionné{selectedRows.size > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 shadow-sm min-h-0">
            <table className="min-w-full bg-white">
              <thead className="bg-camublue-900 text-white sticky top-0 z-10">
                <tr>
                  <th className="pl-4 pr-2 py-3 border-b border-camublue-800 w-8">
                    <input
                      type="checkbox"
                      className="accent-white h-3.5 w-3.5 cursor-pointer"
                      checked={sortedSummary.length > 0 && sortedSummary.every((r) => selectedRows.has(`${r.year}-${r.month}`))}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold border-b border-camublue-800">
                    <button type="button" onClick={() => handleSort("month")} className="flex items-center gap-1.5 hover:opacity-80 transition">
                      Mois {renderSortIcon("month")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold border-b border-camublue-800">
                    <button type="button" onClick={() => handleSort("total")} className="flex items-center gap-1.5 hover:opacity-80 transition mx-auto">
                      Total {renderSortIcon("total")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold border-b border-camublue-800">
                    <button type="button" onClick={() => handleSort("sent")} className="flex items-center gap-1.5 hover:opacity-80 transition mx-auto">
                      Envoyés {renderSortIcon("sent")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold border-b border-camublue-800">
                    <button type="button" onClick={() => handleSort("failed")} className="flex items-center gap-1.5 hover:opacity-80 transition mx-auto">
                      Échecs {renderSortIcon("failed")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold border-b border-camublue-800">Taux</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold border-b border-camublue-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSummary.map((row) => {
                  const key  = `${row.year}-${row.month}`;
                  const rate = row.total ? Math.round((row.sent / row.total) * 100) : 0;
                  return (
                    <tr
                      key={key}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedRows.has(key) ? "bg-camublue-50/40" : ""}`}
                    >
                      <td className="pl-4 pr-2 py-3">
                        <input
                          type="checkbox"
                          className="accent-camublue-900 h-3.5 w-3.5 cursor-pointer"
                          checked={selectedRows.has(key)}
                          onChange={() => toggleRowSelect(key)}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 capitalize text-sm">
                        {MONTH_NAMES[row.month]} {row.year}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-slate-700">{row.total}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status="sent" count={row.sent || 0} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status="failed" count={row.failed || 0} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${rate >= 90 ? "bg-emerald-500" : rate >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold tabular-nums ${rate >= 90 ? "text-emerald-600" : rate >= 70 ? "text-amber-600" : "text-red-600"}`}>
                            {rate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openMonth(row.year, row.month)}
                            className="inline-flex items-center gap-1 bg-camublue-50 hover:bg-camublue-100 text-camublue-900 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-camublue-200 transition"
                          >
                            <History className="h-3 w-3" /> Détails
                          </button>
                          <button
                            onClick={() => setResendOpen(true)}
                            className="inline-flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-purple-200 transition"
                            title="Renvoyer un bulletin à un employé"
                          >
                            <Send className="h-3 w-3" /> Renvoyer
                          </button>
                          <button
                            onClick={() => doDeleteMonth(row.year, row.month)}
                            className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-red-200 transition"
                            title={`Supprimer tous les logs de ${MONTH_NAMES[row.month]} ${row.year}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedSummary.length === 0 && !summaryLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <FaFilePdf className="h-8 w-8 text-slate-200" />
                        <p className="text-sm">Aucun bulletin sur cette période.</p>
                        <button onClick={() => setImportOpen(true)} className="mt-1 text-xs text-camublue-700 underline">
                          Importer un PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {summaryLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <ImSpinner2 className="animate-spin h-6 w-6 mx-auto text-camublue-900" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {summary.length > 0 && (
            <div className="flex flex-wrap items-center justify-between px-1 gap-2 shrink-0">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>{((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, summary.length)} sur <b>{summary.length}</b> mois</span>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span>Afficher</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="border border-slate-300 rounded-md text-sm px-2 py-1 bg-white focus:ring-2 focus:ring-camublue-900 focus:outline-none shadow-sm"
                  >
                    {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span>par page</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                  <FaAngleDoubleLeft size={12} />
                </button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                  <FaChevronLeft size={12} />
                </button>
                <div className="flex items-center gap-1 mx-1">
                  {getPageNumbers().map((p, i) =>
                    p === "..." ? (
                      <span key={`e-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => goToPage(p as number)}
                        className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition ${currentPage === p ? "bg-camublue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                  <FaChevronRight size={12} />
                </button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                  <FaAngleDoubleRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Modales ── */}
      <AnimatePresence>
        {importOpen && (
          <ImportModal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            onTaskStarted={handleTaskStarted}
            onPreviewReady={handlePreviewReady}
          />
        )}
      </AnimatePresence>

      {preview && (
        <PayslipTargetsModal
          open={targetsOpen}
          items={preview.items ?? []}
          loading={false}
          sending={sendingSelected}
          onClose={() => { setTargetsOpen(false); setPreview(null); }}
          onConfirm={async (matricules) => {
            setSendingSelected(true);
            const t = toast.loading("Lancement de l'envoi…");
            try {
              const res = await sendBulletinsSelected({
                batch_id: preview.batch_id,
                year: preview.year,
                month: preview.month,
                matricules,
              });
              setTargetsOpen(false);
              setPreview(null);
              if (res.task_id) {
                handleTaskStarted(res.task_id);
                toast.success("Envoi lancé…", { id: t });
              } else {
                toast.error("Impossible de lancer l'envoi", { id: t });
              }
            } catch (e: any) {
              toast.error(e?.response?.data?.error || "Erreur lancement envoi", { id: t });
            } finally {
              setSendingSelected(false);
            }
          }}
        />
      )}

      <BulletinsLogsModal
        open={logsOpen}
        title={logsTitle}
        start={start}
        end={end}
        scope={logsScope}
        autoRefresh={logsAutoRefresh}
        onClose={() => { setLogsOpen(false); setLogsAutoRefresh(false); }}
        onChanged={loadSummary}
      />

      <AnimatePresence>
        {exportOpen && (
          <ExportModal
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            rows={sortedSummary}
            selectedKeys={selectedRows}
          />
        )}
      </AnimatePresence>

      <BulletinResendModal
        open={resendOpen}
        onClose={() => setResendOpen(false)}
      />

    </AppLayout>
  );
}
