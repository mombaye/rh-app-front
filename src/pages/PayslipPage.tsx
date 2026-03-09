import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import AppLayout from "@/layouts/AppLayout";
import toast from "react-hot-toast";
import {
  FaSearch, FaChevronRight, FaFilePdf, FaSort, FaSortUp, FaSortDown,
  FaChevronLeft, FaAngleDoubleLeft, FaAngleDoubleRight, FaCheck
} from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { motion } from "framer-motion";

import PayslipUploader from "@/components/payslips/PayslipUploader";
import BulletinSendProgress from "@/components/payslips/BulletinSendProgress";
import PayslipTargetsModal from "@/components/payslips/PayslipTargetsModal";
import PayslipStatsCards from "@/components/payslips/PayslipStatsCards";
import BulletinsLogsModal from "@/components/payslips/BulletinsLogsModal";

import {
  uploadPayslipPdf,
  sendBulletinsSelected,
  startPreviewPayslipPdf,
  fetchPayslipPreviewProgress,
  fetchBulletinsSummary,
} from "@/services/employeeService";
import type { PayslipPreviewResponse, BulletinMonthSummary } from "@/services/employeeService";

// Modale d'upload
const UploadModal = ({
  open,
  onClose,
  onUploadAuto,
  step,
  onStepChange,
}: {
  open: boolean;
  onClose: () => void;
  onUploadAuto: (file: File) => void;
  step: "upload" | "processing" | "success";
  onStepChange: (step: "upload" | "processing" | "success") => void;
}) => {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!file) return;
    onStepChange("processing");
    onUploadAuto(file);
  };

  return (
    open && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6">
          {step === "upload" && (
            <div className="text-center">
              <div className="mb-4">
                <FaFilePdf className="h-16 w-16 text-camublue-500 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Importer un fichier PDF</h3>
              <p className="text-sm text-slate-600 mb-4">
                Glissez-déposez un fichier ou cliquez pour sélectionner.
              </p>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="mb-4"
              />
              <button
                onClick={handleSubmit}
                disabled={!file}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  file
                    ? "bg-camublue-900 text-white hover:bg-camublue-800"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                Importer
              </button>
            </div>
          )}
          {step === "processing" && (
            <div className="text-center">
              <div className="mb-4">
                <ImSpinner2 className="h-16 w-16 text-camublue-500 mx-auto animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Traitement en cours...</h3>
              <p className="text-sm text-slate-600">Votre fichier est en cours d'analyse.</p>
            </div>
          )}
          {step === "success" && (
            <div className="text-center">
              <div className="mb-4">
                <FaCheck className="h-16 w-16 text-green-500 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Fichier importé avec succès !</h3>
              <p className="text-sm text-slate-600 mb-4">
                Votre fichier a été analysé et est prêt pour la suite.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-camublue-900 text-white hover:bg-camublue-800"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    )
  );
};

// Badge de statut pour la table
const StatusBadge = ({ status, count }: { status: "sent" | "failed" | "pending"; count: number }) => {
  if (status === "sent")
    return <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{count} Envoyés</span>;
  if (status === "failed")
    return <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">{count} Échecs</span>;
  return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">{count} En attente</span>;
};

export default function PayslipPage() {
  const [start, setStart] = useState(dayjs().subtract(90, "day").format("YYYY-MM-DD"));
  const [end, setEnd] = useState(dayjs().format("YYYY-MM-DD"));
  const [searchTerm, setSearchTerm] = useState("");

  const [summary, setSummary] = useState<BulletinMonthSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const total = useMemo(() => summary.reduce((a, x) => a + (x.total || 0), 0), [summary]);
  const sent = useMemo(() => summary.reduce((a, x) => a + (x.sent || 0), 0), [summary]);
  const failed = useMemo(() => summary.reduce((a, x) => a + (x.failed || 0), 0), [summary]);

  const [logsOpen, setLogsOpen] = useState(false);
  const [logsTitle, setLogsTitle] = useState("Détails");
  const [logsScope, setLogsScope] = useState<{ year?: number; month?: number; status?: "sent" | "failed" | "pending" }>({});

  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PayslipPreviewResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendingSelected, setSendingSelected] = useState(false);
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ status: string; progress: number; total_pages?: number; found?: number; errors_count?: number }>({ status: "IDLE", progress: 0 });

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<"upload" | "processing" | "success">("upload");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  type SortKey = "year" | "month" | "total" | "sent" | "failed";
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const s = await fetchBulletinsSummary({ start, end });
      setSummary(s);
    } catch {
      toast.error("Erreur lors du chargement du reporting");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, []);

  useEffect(() => {
    if (!previewTaskId) return;
    let stopped = false;
    const tick = async () => {
      try {
        const p = await fetchPayslipPreviewProgress(previewTaskId);
        if (stopped) return;
        setPreviewMeta({ status: p.status, progress: Number(p.progress ?? 0), total_pages: p.total_pages, found: p.found, errors_count: p.errors_count });
        if (p.status === "SUCCESS" && p.result) {
          setPreview(p.result);
          setPreviewTaskId(null);
          toast.success(`Analyse terminée : ${p.result.items.length} matricule(s)`);
        }
        if (p.status === "FAILURE") {
          setPreviewTaskId(null);
          toast.error("Analyse échouée (preview).");
        }
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 1500);
    return () => { stopped = true; window.clearInterval(id); };
  }, [previewTaskId]);

  const handleUploadAuto = async (file: File) => {
    const toastId = toast.loading("Envoi automatique : traitement en cours...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await uploadPayslipPdf(formData);
      if (data.task_id) {
        setCurrentTaskId(data.task_id);
        setUploadStep("success");
        toast.success("Envoi automatique lancé : suivi en cours…", { id: toastId });
      } else {
        setUploadStep("upload");
        toast.error(data.error || "Erreur au lancement.", { id: toastId });
      }
    } catch (e: any) {
      setUploadStep("upload");
      toast.error(e?.response?.data?.error || "Erreur lors de l'envoi automatique", { id: toastId });
    }
  };

  const openFromCard = (kind: "all" | "sent" | "failed") => {
    setLogsScope(kind === "all" ? {} : { status: kind === "sent" ? "sent" : "failed" });
    setLogsTitle(kind === "all" ? "Tous les bulletins" : kind === "sent" ? "Succès" : "Échecs");
    setLogsOpen(true);
  };

  const openMonth = (y: number, m: number) => {
    setLogsScope({ year: y, month: m });
    setLogsTitle(`Détails — ${dayjs(`${y}-${String(m).padStart(2, "0")}-01`).format("MMMM YYYY")}`);
    setLogsOpen(true);
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) =>
      !prev || prev.key !== key ? { key, direction: "asc" } : { key, direction: prev.direction === "asc" ? "desc" : "asc" }
    );
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <FaSort className="text-xs opacity-60" />;
    return sortConfig.direction === "asc" ? <FaSortUp className="text-xs" /> : <FaSortDown className="text-xs" />;
  };

  const totalPages = Math.max(1, Math.ceil(summary.length / pageSize));
  const paginatedSummary = summary.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const s = Math.max(2, currentPage - 1);
      const e = Math.min(totalPages - 1, currentPage + 1);
      for (let i = s; i <= e; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-4 p-4 md:p-6"
      >
        {/* ── En-tête (fixe) ── */}
        <div className="flex flex-col gap-3 shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-camublue-900">Bulletins de salaire</h1>
          <div className="flex flex-wrap items-center gap-2">
            {/* Recherche */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Rechercher un bulletin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-camublue-900 text-sm px-3 py-2 w-full sm:w-52"
              />
            </div>
            {/* Filtre rapide */}
            <button
              onClick={() => {
                setStart(dayjs().subtract(90, "day").format("YYYY-MM-DD"));
                setEnd(dayjs().format("YYYY-MM-DD"));
                loadSummary();
              }}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 whitespace-nowrap transition"
            >
              3 derniers mois
            </button>
            <button
              onClick={loadSummary}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 whitespace-nowrap transition"
            >
              Appliquer
            </button>
            {/* Import PDF */}
            <button
              onClick={() => { setUploadModalOpen(true); setUploadStep("upload"); }}
              className="bg-camublue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 transition whitespace-nowrap"
            >
              <FaFilePdf size={14} />
              Importer PDF
            </button>
          </div>
        </div>

        {/* ── Stats (fixe) ── */}
        <div className="shrink-0">
          <PayslipStatsCards
            loading={summaryLoading}
            total={total}
            sent={sent}
            failed={failed}
            onOpen={openFromCard}
          />
        </div>

        {/* ── Progress bar envoi ── */}
        {currentTaskId && (
          <div className="shrink-0">
            <BulletinSendProgress
              taskId={currentTaskId}
              onDone={() => { setCurrentTaskId(null); loadSummary(); }}
            />
          </div>
        )}

        {/* ── Tableau : prend tout l'espace restant ── */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm min-h-0">
            <table className="min-w-full bg-white">
              <thead className="bg-camublue-900 text-white sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">
                    <button type="button" onClick={() => handleSort("month")} className="flex items-center gap-1 select-none hover:opacity-80 transition-opacity">
                      Mois {renderSortIcon("month")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">
                    <button type="button" onClick={() => handleSort("total")} className="flex items-center gap-1 select-none hover:opacity-80 transition-opacity">
                      Total {renderSortIcon("total")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">
                    <button type="button" onClick={() => handleSort("sent")} className="flex items-center gap-1 select-none hover:opacity-80 transition-opacity">
                      Envoyés {renderSortIcon("sent")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold">
                    <button type="button" onClick={() => handleSort("failed")} className="flex items-center gap-1 select-none hover:opacity-80 transition-opacity">
                      Échecs {renderSortIcon("failed")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center border-b border-camublue-800 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSummary.map((row) => (
                  <tr key={`${row.year}-${row.month}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      {dayjs(`${row.year}-${String(row.month).padStart(2, "0")}-01`).format("MMMM YYYY")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status="pending" count={row.total || 0} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status="sent" count={row.sent || 0} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status="failed" count={row.failed || 0} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openMonth(row.year, row.month)}
                        className="inline-flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedSummary.length === 0 && !summaryLoading && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                      Aucun bulletin trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {summary.length > 0 && (
            <div className="flex items-center justify-between px-1 shrink-0">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span>
                  {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, summary.length)} sur{" "}
                  <span className="font-semibold text-slate-700">{summary.length}</span> mois
                </span>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5">
                  <span>Afficher</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="border border-slate-300 rounded-md text-sm px-2 py-1 bg-white focus:ring-2 focus:ring-camublue-900 focus:outline-none shadow-sm"
                  >
                    {[10, 25, 50, 100].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span>par page</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Première page">
                  <FaAngleDoubleLeft size={12} />
                </button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Page précédente">
                  <FaChevronLeft size={12} />
                </button>
                <div className="flex items-center gap-1 mx-1">
                  {getPageNumbers().map((page, i) =>
                    page === "..." ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm select-none">…</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => goToPage(page as number)}
                        className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors ${
                          currentPage === page ? "bg-camublue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                </div>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Page suivante">
                  <FaChevronRight size={12} />
                </button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Dernière page">
                  <FaAngleDoubleRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Modals ── */}
        {preview && (
          <PayslipTargetsModal
            open={previewOpen}
            items={preview?.items ?? []}
            loading={!!previewTaskId && !preview}
            progress={previewMeta.progress}
            totalPages={previewMeta.total_pages}
            found={previewMeta.found}
            errorsCount={previewMeta.errors_count}
            sending={sendingSelected}
            onClose={() => setPreviewOpen(false)}
            onConfirm={async (matricules) => {
              setSendingSelected(true);
              const t = toast.loading("Lancement de l'envoi...");
              try {
                const res = await sendBulletinsSelected({ batch_id: preview.batch_id, year: preview.year, month: preview.month, matricules });
                setPreviewOpen(false);
                setPreview(null);
                if (res.task_id) {
                  setCurrentTaskId(res.task_id);
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
          onClose={() => setLogsOpen(false)}
          onChanged={loadSummary}
        />

        <UploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onUploadAuto={handleUploadAuto}
          step={uploadStep}
          onStepChange={setUploadStep}
        />
      </motion.div>
    </AppLayout>
  );
}