import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import AppLayout from "@/layouts/AppLayout";
import toast from "react-hot-toast";

import PayslipUploader from "@/components/payslips/PayslipUploader";
import BulletinSendProgress from "@/components/payslips/BulletinSendProgress";
import PayslipTargetsModal from "@/components/payslips/PayslipTargetsModal";

import PayslipStatsCards from "@/components/payslips/PayslipStatsCards";
import BulletinsMonthlyTable from "@/components/payslips/BulletinsMonthlyTable";
import BulletinsLogsModal from "@/components/payslips/BulletinsLogsModal";

import {
  uploadPayslipPdf,
  sendBulletinsSelected,
  startPreviewPayslipPdf,
  fetchPayslipPreviewProgress,
  fetchBulletinsSummary,
} from "@/services/employeeService";
import type { PayslipPreviewResponse, BulletinMonthSummary } from "@/services/employeeService";

export default function PayslipPage() {
  // ✅ période par défaut: 3 derniers mois
  const [start, setStart] = useState(dayjs().subtract(90, "day").format("YYYY-MM-DD"));
  const [end, setEnd] = useState(dayjs().format("YYYY-MM-DD"));

  const [summary, setSummary] = useState<BulletinMonthSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const total = useMemo(() => summary.reduce((a, x) => a + (x.total || 0), 0), [summary]);
  const sent = useMemo(() => summary.reduce((a, x) => a + (x.sent || 0), 0), [summary]);
  const failed = useMemo(() => summary.reduce((a, x) => a + (x.failed || 0), 0), [summary]);

  // ✅ modal détails (cards + monthly)
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsTitle, setLogsTitle] = useState("Détails");
  const [logsScope, setLogsScope] = useState<{ year?: number; month?: number; status?: "sent"|"failed"|"pending" }>({});

  // ✅ preview/select flow (ton existant)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PayslipPreviewResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendingSelected, setSendingSelected] = useState(false);

  type PreviewMeta = { status: string; progress: number; total_pages?: number; found?: number; errors_count?: number; };
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta>({ status: "IDLE", progress: 0 });

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const s = await fetchBulletinsSummary({ start, end });
      setSummary(s);
    } catch {
      toast.error("Erreur chargement du reporting");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload summary quand la période change (bouton “Appliquer” conseillé)
  const applyPeriod = () => loadSummary();

  // poll preview progress (ton existant)
  useEffect(() => {
    if (!previewTaskId) return;
    let stopped = false;

    const tick = async () => {
      try {
        const p = await fetchPayslipPreviewProgress(previewTaskId);
        if (stopped) return;

        setPreviewMeta({
          status: p.status,
          progress: Number(p.progress ?? 0),
          total_pages: p.total_pages,
          found: p.found,
          errors_count: p.errors_count,
        });

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
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [previewTaskId]);

  const handleUploadAuto = async (file: File) => {
    const toastId = toast.loading("Envoi automatique : traitement en cours...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await uploadPayslipPdf(formData);

      if (data.task_id) {
        setCurrentTaskId(data.task_id);
        toast.success("Envoi automatique lancé : suivi en cours…", { id: toastId });
      } else {
        toast.error(data.error || "Erreur au lancement.", { id: toastId });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l’envoi automatique", { id: toastId });
    }
  };

  const handleUploadSelect = async (file: File) => {
    const toastId = toast.loading("Analyse lancée...");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const startRes = await startPreviewPayslipPdf(formData);
      setPreview(null);
      setPreviewMeta({ status: "PENDING", progress: 0 });
      setPreviewTaskId(startRes.task_id);
      setPreviewOpen(true);

      toast.success("Analyse en cours… vous pouvez patienter ou fermer le modal.", { id: toastId });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Erreur lancement analyse", { id: toastId });
    }
  };

  const openFromCard = (kind: "all" | "sent" | "failed") => {
    setLogsScope(kind === "all" ? {} : { status: kind === "sent" ? "sent" : "failed" });
    setLogsTitle(kind === "all" ? "Tous les bulletins (détails)" : kind === "sent" ? "Succès (détails)" : "Échecs (détails)");
    setLogsOpen(true);
  };

  const openMonth = (y: number, m: number) => {
    setLogsScope({ year: y, month: m });
    setLogsTitle(`Détails du mois ${dayjs(`${y}-${String(m).padStart(2, "0")}-01`).format("MMMM YYYY")}`);
    setLogsOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-camublue-900">Bulletins de salaire</h1>

        {/* Upload / envoi */}
        <PayslipUploader onUploadAuto={handleUploadAuto} onUploadSelect={handleUploadSelect} />

        {/* Preview select (ton existant) */}
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
              const t = toast.loading("Lancement de l’envoi...");
              try {
                const res = await sendBulletinsSelected({
                  batch_id: preview.batch_id,
                  year: preview.year,
                  month: preview.month,
                  matricules,
                });
                setPreviewOpen(false);
                setPreview(null);

                if (res.task_id) {
                  setCurrentTaskId(res.task_id);
                  toast.success("Envoi lancé : suivi de progression…", { id: t });
                } else {
                  toast.error("Impossible de lancer l’envoi", { id: t });
                }
              } catch (e: any) {
                toast.error(e?.response?.data?.error || "Erreur lancement envoi", { id: t });
              } finally {
                setSendingSelected(false);
              }
            }}
          />
        )}

        {currentTaskId && (
          <BulletinSendProgress
            taskId={currentTaskId}
            onDone={() => {
              setCurrentTaskId(null);
              loadSummary(); // refresh reporting
            }}
          />
        )}

        {/* Filtres période */}
        <div className="bg-white rounded-2xl shadow border border-slate-200 p-4 flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Début</div>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Fin</div>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 md:ml-auto">
            <button
              className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
              onClick={() => {
                setStart(dayjs().subtract(90, "day").format("YYYY-MM-DD"));
                setEnd(dayjs().format("YYYY-MM-DD"));
              }}
            >
              3 derniers mois
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-800"
              onClick={applyPeriod}
            >
              Appliquer
            </button>
          </div>
        </div>

        {/* Cards (cliquables) */}
        <PayslipStatsCards
          loading={summaryLoading}
          total={total}
          sent={sent}
          failed={failed}
          onOpen={openFromCard}
        />

        {/* Table principale mensuelle */}
        <BulletinsMonthlyTable rows={summary} loading={summaryLoading} onOpenMonth={openMonth} />

        {/* Modal détails paginé */}
        <BulletinsLogsModal
          open={logsOpen}
          title={logsTitle}
          start={start}
          end={end}
          scope={logsScope}
          onClose={() => setLogsOpen(false)}
          onChanged={loadSummary}
        />
      </div>
    </AppLayout>
  );
}
