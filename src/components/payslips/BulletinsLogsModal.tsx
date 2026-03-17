import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { ImSpinner2 } from "react-icons/im";
import {
  CheckCircle, XCircle, Clock, Download, Trash2, RefreshCw, X,
} from "lucide-react";
import {
  fetchBulletinsLogs,
  exportBulletinsLogs,
  deleteBulletinLog,
  type BulletinLogItem,
} from "@/services/employeeService";

dayjs.locale("fr");

type StatusFilter = "all" | "sent" | "failed" | "pending";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Tous statuts",
  sent: "Succès",
  failed: "Échecs",
  pending: "En attente",
};

function StatusBadge({ status }: { status: BulletinLogItem["status"] }) {
  if (status === "sent")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-xs">
        <CheckCircle className="h-3.5 w-3.5" /> Envoyé
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-red-600 font-medium text-xs">
        <XCircle className="h-3.5 w-3.5" /> Échec
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-xs">
      <Clock className="h-3.5 w-3.5" /> En attente
    </span>
  );
}

function PeriodLabel({ year, month }: { year: number | null; month: number | null }) {
  if (!year || !month) return <span className="text-slate-400">—</span>;
  return (
    <span className="text-slate-700 font-medium capitalize">
      {dayjs(`${year}-${String(month).padStart(2, "0")}-01`).format("MMM YYYY")}
    </span>
  );
}

export default function BulletinsLogsModal({
  open,
  title,
  start,
  end,
  scope,
  onClose,
  onChanged,
  autoRefresh = false,
}: {
  open: boolean;
  title: string;
  start: string;
  end: string;
  scope?: { year?: number; month?: number; status?: "sent" | "failed" | "pending" };
  onClose: () => void;
  onChanged: () => void;
  autoRefresh?: boolean;
}) {
  const [loading, setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus]     = useState<StatusFilter>(scope?.status ?? "all");
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 25;

  const [count, setCount] = useState(0);
  const [rows, setRows]   = useState<BulletinLogItem[]>([]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / PAGE_SIZE)), [count]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
    setStatus(scope?.status ?? "all");
  }, [open, scope?.status]);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchBulletinsLogs({
        start,
        end,
        year: scope?.year,
        month: scope?.month,
        status: status === "all" ? undefined : status,
        search: debouncedSearch.trim() || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setRows(data.results ?? []);
      setCount(data.count ?? 0);
    } catch (e: any) {
      if (!silent) toast.error(e?.response?.data?.error || "Erreur chargement des bulletins");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await load();
    };
    run();
    return () => { cancelled = true; };
  }, [open, start, end, scope?.year, scope?.month, status, debouncedSearch, page]);

  // auto-refresh toutes les 3s si en cours d'envoi
  useEffect(() => {
    if (!open || !autoRefresh) return;
    const id = setInterval(() => load(true), 3000);
    return () => clearInterval(id);
  }, [open, autoRefresh, status, debouncedSearch, page]);

  const doDelete = async (id: number) => {
    if (!window.confirm("Supprimer ce log d'envoi ?")) return;
    const t = toast.loading("Suppression…");
    try {
      await deleteBulletinLog(id);
      toast.success("Supprimé.", { id: t });
      const newCount = Math.max(0, count - 1);
      const newTotalPages = Math.max(1, Math.ceil(newCount / PAGE_SIZE));
      if (page > newTotalPages) setPage(newTotalPages);
      onChanged();
      await load(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Suppression impossible", { id: t });
    }
  };

  const doExport = async () => {
    setExporting(true);
    const t = toast.loading("Génération du CSV…");
    try {
      await exportBulletinsLogs({
        start,
        end,
        year: scope?.year,
        month: scope?.month,
        status: status === "all" ? undefined : status,
        search: debouncedSearch.trim() || undefined,
      });
      toast.success("Export téléchargé.", { id: t });
    } catch {
      toast.error("Erreur lors de l'export", { id: t });
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  const sentCount    = rows.filter((r) => r.status === "sent").length;
  const failedCount  = rows.filter((r) => r.status === "failed").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-5xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[95vh] sm:max-h-[90vh] flex flex-col">

        {/* ── En-tête ── */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between shrink-0 bg-slate-50">
          <div className="min-w-0 flex-1 mr-3">
            <div className="text-lg font-semibold text-slate-800 truncate">{title}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Période : <span className="font-medium">{start}</span> → <span className="font-medium">{end}</span>
              {scope?.year && scope?.month
                ? ` · ${dayjs(`${scope.year}-${String(scope.month).padStart(2, "0")}-01`).format("MMMM YYYY").toUpperCase()}`
                : ""}
              {autoRefresh && (
                <span className="ml-2 inline-flex items-center gap-1 text-blue-500">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Actualisation auto
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Filtres ── */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row gap-2 sm:items-center shrink-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (matricule / email)…"
            className="w-full sm:w-72 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900 shrink-0"
          />

          <div className="flex gap-1 flex-wrap">
            {(["all", "sent", "failed", "pending"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  status === s
                    ? s === "sent"    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : s === "failed"  ? "bg-red-50 text-red-700 border-red-300"
                    : s === "pending" ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-camublue-900 text-white border-transparent"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="sm:ml-auto flex items-center gap-3 shrink-0">
            <span className="text-sm text-slate-500">
              {loading ? "Chargement…" : <span>Total : <b>{count}</b></span>}
            </span>
            <button
              onClick={doExport}
              disabled={exporting || count === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50"
            >
              {exporting ? <ImSpinner2 className="animate-spin h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              Exporter CSV
            </button>
          </div>
        </div>

        {/* ── Mini-résumé de la page courante ── */}
        {!loading && rows.length > 0 && (
          <div className="px-5 py-2 flex gap-4 text-xs text-slate-500 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <span className="text-emerald-600 font-medium">{sentCount} envoyés</span>
            <span className="text-red-500 font-medium">{failedCount} échecs</span>
            <span>{rows.length - sentCount - failedCount} en attente</span>
          </div>
        )}

        {/* ── Tableau ── */}
        <div className="overflow-auto flex-1">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Matricule</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Période</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <ImSpinner2 className="animate-spin h-5 w-5 text-camublue-900" />
                      <span>Chargement…</span>
                    </span>
                  </td>
                </tr>
              )}

              {!loading && rows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    r.status === "failed" ? "bg-red-50/30" : r.status === "sent" ? "" : "bg-amber-50/20"
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-700 text-xs">{r.matricule}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs max-w-[180px] truncate">{r.email || <span className="text-slate-400 italic">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={r.status} />
                    {r.message && (
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]" title={r.message}>
                        {r.message}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <PeriodLabel year={r.year} month={r.month} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs tabular-nums">
                    {r.sent_at ? dayjs(r.sent_at).format("DD/MM/YYYY HH:mm") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => doDelete(r.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition"
                      title="Supprimer ce log"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="h-8 w-8 text-slate-200" />
                      <span className="text-sm">Aucun résultat pour ces critères.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div className="text-sm text-slate-500">
            Page <b>{page}</b> / <b>{totalPages}</b>
            {count > 0 && (
              <span className="ml-2 text-xs text-slate-400">
                ({((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, count)} sur {count})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Précédent
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Suivant →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
