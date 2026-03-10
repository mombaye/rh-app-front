// src/pages/LeavePage.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import LeaveRequestForm from "@/components/leaves/LeaveRequestForm";
import LeaveBalances from "@/components/leaves/LeaveBalances";
import LeaveCalendar from "@/components/leaves/LeaveCalendar";
import { leaveRequestService } from "@/services/leaveService";
import {
  ContractType, LeaveRequest, LeaveStatus, LeaveSummary,
  ApprovePayload, RevokePayload,
} from "@/types/leave";
import {
  CalendarDays, RefreshCw, Plus, X, CheckCircle2, XCircle,
  Ban, RotateCcw, ChevronDown, Table2, Wallet, CalendarRange,
  Download, Loader2, AlertTriangle, Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";

// ─── Config statuts ───────────────────────────────────────────────────────────
const STATUS_CFG: Record<
  LeaveStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  PENDING:        { label: "En attente",          color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "bg-amber-400"   },
  PENDING_SECOND: { label: "En att. 2ème valid.", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", dot: "bg-violet-500"  },
  APPROVED:       { label: "Approuvé",            color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", dot: "bg-emerald-500" },
  REJECTED:       { label: "Rejeté",              color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "bg-red-500"     },
  CANCELLED:      { label: "Annulé",              color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", dot: "bg-slate-400"   },
  REVOKED:        { label: "Révoqué (urgence)",   color: "#b45309", bg: "#fff7ed", border: "#fed7aa", dot: "bg-orange-500"  },
};

type TabId         = "requests" | "balances" | "calendar";
type StatusFilter  = "ALL" | LeaveStatus;

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "requests", label: "Demandes",   Icon: Table2       },
  { id: "balances", label: "Soldes",     Icon: Wallet       },
  { id: "calendar", label: "Calendrier", Icon: CalendarRange },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL",            label: "Toutes"          },
  { value: "PENDING",        label: "En attente"      },
  { value: "PENDING_SECOND", label: "2ème validation" },
  { value: "APPROVED",       label: "Approuvées"      },
  { value: "REJECTED",       label: "Rejetées"        },
  { value: "CANCELLED",      label: "Annulées"        },
  { value: "REVOKED",        label: "Révoquées"       },
];

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const p = d.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LeaveStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, onClick, active }: {
  label: string; value: number | string; sub?: string;
  color: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 min-w-[110px] rounded-2xl px-4 py-3 text-left transition-all border-2 ${
        active
          ? "border-current shadow-md scale-[1.02]"
          : "border-transparent bg-white shadow-sm hover:shadow-md hover:scale-[1.01]"
      }`}
      style={{ color, backgroundColor: active ? color + "18" : undefined }}>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5 opacity-75">{label}</p>
      {sub && <p className="text-[9px] opacity-55 mt-0.5">{sub}</p>}
    </button>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function LeavePage() {
  const [tab,          setTab]          = useState<TabId>("requests");
  const [requests,     setRequests]     = useState<LeaveRequest[]>([]);
  const [summary,      setSummary]      = useState<LeaveSummary | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [contractType, setContractType] = useState<ContractType>("INTERNE");
  const [showForm,     setShowForm]     = useState(false);
  const [selected,     setSelected]     = useState<LeaveRequest | null>(null);
  const [filterOpen,   setFilterOpen]   = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const apiStatus = statusFilter !== "ALL" ? statusFilter as LeaveStatus : undefined;
      const [data, sum] = await Promise.all([
        leaveRequestService.getAll({ ...(apiStatus ? { status: apiStatus } : {}) }),
        leaveRequestService.getSummary(),
      ]);
      setRequests(Array.isArray(data) ? data : []);
      setSummary(sum);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.response?.data?.error ?? "Erreur de chargement.";
      setFetchError(msg); setRequests([]);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Export Excel ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
    const token    = localStorage.getItem("access_token");
    fetch(`${BASE_URL}/api/leaves/export/excel/`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a   = document.createElement("a");
        a.href     = URL.createObjectURL(blob);
        a.download = `conges_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
      })
      .catch(() => toast.error("Erreur lors de l'export Excel"));
  };

  const openDetail  = (r: LeaveRequest) => setSelected(r);
  const closeDetail = ()                 => setSelected(null);
  const afterAction = async ()           => { closeDetail(); await fetchAll(); };

  const currentFilterLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "Toutes";

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 sm:px-6 pt-5 pb-3 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-camublue-900 text-white">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-camublue-900">Congés & Absences</h1>
                <p className="text-xs text-slate-400 mt-0.5">Gestion complète des demandes de congé</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle contrat */}
              <div className="flex bg-slate-100 rounded-xl p-0.5 text-xs font-semibold">
                {(["INTERNE", "INTERIM"] as ContractType[]).map((c) => (
                  <button key={c} onClick={() => setContractType(c)}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      contractType === c ? "bg-white text-camublue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {c === "INTERNE" ? "Internes" : "Intérimaires"}
                  </button>
                ))}
              </div>

              <button onClick={handleExport} title="Exporter Excel"
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition">
                <Download className="h-4 w-4" />
              </button>

              <button onClick={fetchAll} disabled={loading} title="Actualiser"
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold transition shadow-sm">
                <Plus className="h-4 w-4" />Nouvelle demande
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          {summary && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
              <KpiCard label="Total"     value={summary.total}    color="#003c71" />
              <KpiCard label="En attente" value={summary.pending} color="#d97706"
                active={statusFilter === "PENDING" || statusFilter === "PENDING_SECOND"}
                onClick={() => setStatusFilter(
                  (statusFilter === "PENDING" || statusFilter === "PENDING_SECOND") ? "ALL" : "PENDING"
                )} />
              <KpiCard label="Approuvés" value={summary.approved} color="#059669"
                sub={`${summary.total_days_approved}j accordés`}
                active={statusFilter === "APPROVED"}
                onClick={() => setStatusFilter(statusFilter === "APPROVED" ? "ALL" : "APPROVED")} />
              <KpiCard label="Rejetés"  value={summary.rejected} color="#dc2626"
                active={statusFilter === "REJECTED"}
                onClick={() => setStatusFilter(statusFilter === "REJECTED" ? "ALL" : "REJECTED")} />
              <KpiCard label="Révoqués" value={summary.revoked ?? 0} color="#b45309"
                active={statusFilter === "REVOKED"}
                onClick={() => setStatusFilter(statusFilter === "REVOKED" ? "ALL" : "REVOKED")} />
            </div>
          )}

          {/* Tabs + filtre */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    tab === id ? "bg-camublue-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                  }`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            {tab === "requests" && (
              <div className="relative" ref={filterRef}>
                <button onClick={() => setFilterOpen((o) => !o)}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium transition">
                  <span className="hidden sm:inline text-xs">{currentFilterLabel}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {filterOpen && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-30">
                      {STATUS_FILTERS.map(({ value, label }) => {
                        const cfg = value === "ALL" ? null : STATUS_CFG[value as LeaveStatus];
                        return (
                          <button key={value}
                            onClick={() => { setStatusFilter(value); setFilterOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${
                              statusFilter === value ? "font-bold bg-slate-50 text-camublue-900" : "text-slate-700 hover:bg-slate-50"
                            }`}>
                            {cfg && <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />}
                            {label}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">

          {/* Tab Demandes */}
          {tab === "requests" && (
            <>
              {loading && (
                <div className="flex flex-col items-center gap-3 text-slate-400 py-24">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <p className="text-sm">Chargement des demandes…</p>
                </div>
              )}

              {!loading && fetchError && (
                <div className="flex flex-col items-center gap-4 py-24">
                  <AlertTriangle className="h-9 w-9 text-red-400" />
                  <p className="text-sm font-medium text-red-500">{fetchError}</p>
                  <button onClick={fetchAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium transition">
                    <RefreshCw className="h-3.5 w-3.5" />Réessayer
                  </button>
                </div>
              )}

              {!loading && !fetchError && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  {requests.length === 0 ? (
                    <div className="py-20 text-center text-slate-400">
                      <CalendarDays className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                      <p className="font-medium text-sm">Aucune demande trouvée</p>
                      {statusFilter !== "ALL" && (
                        <button onClick={() => setStatusFilter("ALL")}
                          className="text-xs mt-2 text-camublue-900 underline underline-offset-2">
                          Afficher toutes les demandes
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            {["Employé", "Type de congé", "Période", "Durée", "Statut", "Actions"].map((h) => (
                              <th key={h}
                                className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {requests.map((r, i) => {
                            const lc = r.leave_type?.color ?? "#6b7280";
                            return (
                              <motion.tr key={r.id}
                                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.12, delay: i * 0.02 }}
                                onClick={() => openDetail(r)}
                                className={`hover:bg-slate-50/80 transition cursor-pointer ${i % 2 !== 0 ? "bg-slate-50/20" : ""}`}>

                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                                      style={{ backgroundColor: lc }}>
                                      {(r.employee?.full_name ?? "??").slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-slate-800 truncate max-w-[150px]">
                                        {r.employee?.full_name ?? "—"}
                                      </p>
                                      <p className="text-xs text-slate-400 truncate max-w-[150px]">
                                        {r.employee?.matricule} · {r.employee?.service ?? "—"}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                                    style={{ backgroundColor: lc + "20", color: lc }}>
                                    {r.leave_type?.label ?? "—"}
                                  </span>
                                </td>

                                <td className="px-5 py-4 text-slate-600 text-xs whitespace-nowrap font-mono">
                                  {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                                </td>

                                <td className="px-5 py-4 font-bold text-slate-800 whitespace-nowrap">
                                  {r.days ?? r.duration_days ?? "—"}j
                                </td>

                                <td className="px-5 py-4">
                                  <StatusBadge status={r.status} />
                                </td>

                                <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {(r.status === "PENDING" || r.status === "PENDING_SECOND") && (
                                      <>
                                        <QuickApproveBtn request={r} onDone={fetchAll} />
                                        <button onClick={() => openDetail(r)}
                                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition whitespace-nowrap">
                                          Rejeter
                                        </button>
                                      </>
                                    )}
                                    {r.status === "APPROVED" && (
                                      <button onClick={() => openDetail(r)}
                                        className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold rounded-lg transition whitespace-nowrap">
                                        Révoquer
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "balances" && <LeaveBalances contractType={contractType} />}
          {tab === "calendar" && <LeaveCalendar />}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selected && <DetailModal request={selected} onClose={closeDetail} onDone={afterAction} />}
      </AnimatePresence>
      <AnimatePresence>
        {showForm && (
          <LeaveRequestForm contractType={contractType}
            onClose={() => setShowForm(false)}
            onSuccess={() => { setShowForm(false); fetchAll(); }} />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

// ─── Bouton d'approbation rapide (inline) ─────────────────────────────────────
function QuickApproveBtn({ request, onDone }: { request: LeaveRequest; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await leaveRequestService.approve(request.id);
      toast.success("Demande approuvée ✓");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'approbation");
    } finally { setLoading(false); }
  };
  return (
    <button onClick={handle} disabled={loading}
      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
      {loading ? <ImSpinner2 className="animate-spin" size={11} /> : <CheckCircle2 className="h-3 w-3" />}
      Approuver
    </button>
  );
}

// ─── Modal Détail + Actions ───────────────────────────────────────────────────
function DetailModal({ request: r, onClose, onDone }: {
  request: LeaveRequest; onClose: () => void; onDone: () => void;
}) {
  const [actionLoading,   setActionLoading]   = useState(false);
  const [rejectReason,    setRejectReason]    = useState("");
  const [secondApproverId,setSecondApproverId]= useState("");
  const [revokeReason,    setRevokeReason]    = useState("");
  const [recallDate,      setRecallDate]      = useState(new Date().toISOString().slice(0, 10));
  const [showRevoke,      setShowRevoke]      = useState(false);

  const run = async (fn: () => Promise<void>, msg: string) => {
    setActionLoading(true);
    try { await fn(); toast.success(msg); onDone(); }
    catch (err: any) { toast.error(err?.response?.data?.error ?? "Erreur"); }
    finally { setActionLoading(false); }
  };

  const handleApprove = (payload?: ApprovePayload) =>
    run(() => leaveRequestService.approve(r.id, payload).then(() => {}), "Demande approuvée ✓");

  const handleReject = () => {
    if (!rejectReason.trim()) { toast.error("Le motif de rejet est obligatoire."); return; }
    run(() => leaveRequestService.reject(r.id, rejectReason).then(() => {}), "Demande rejetée");
  };

  const handleCancel = () =>
    run(() => leaveRequestService.cancel(r.id).then(() => {}), "Demande annulée");

  const handleRevoke = () => {
    if (!revokeReason.trim()) { toast.error("Le motif de révocation est obligatoire."); return; }
    const payload: RevokePayload = { revoke_reason: revokeReason, recall_date: recallDate };
    run(() => leaveRequestService.revoke(r.id, payload).then(() => {}), "Congé révoqué — jours restitués ✓");
  };

  const isPending  = r.status === "PENDING" || r.status === "PENDING_SECOND";
  const lc         = r.leave_type?.color ?? "#6b7280";

  const infoRows: [string, string][] = [
    ["Employé",    r.employee?.full_name ?? "—"],
    ["Matricule",  r.employee?.matricule ?? "—"],
    ["Service",    r.employee?.service ?? "—"],
    ["Manager",    r.employee?.manager ?? "—"],
    ["Fonction",   r.employee?.fonction ?? "—"],
    ["Type",       r.leave_type?.label ?? "—"],
    ["Durée",      `${r.days ?? r.duration_days ?? "—"} jour(s)`],
    ["Du",         fmtDate(r.start_date)],
    ["Au",         fmtDate(r.end_date)],
    ["Soumis le",  fmtDate(r.created_at?.slice(0, 10))],
    ...(r.reviewed_at    ? [["1ère validation", fmtDate(r.reviewed_at.slice(0,10))]] as [string,string][] : []),
    ...(r.reviewed_by    ? [["Validé par",      r.reviewed_by.full_name]]            as [string,string][] : []),
    ...(r.second_reviewer? [["2ème validateur", r.second_reviewer.full_name]]        as [string,string][] : []),
    ...(r.revoked_at     ? [["Révoqué le",      fmtDate(r.revoked_at.slice(0,10))]] as [string,string][] : []),
    ...(r.revoked_by     ? [["Révoqué par",     r.revoked_by.full_name]]             as [string,string][] : []),
    ...(r.days_remaining_at_revocation != null
        ? [["Jours restitués", `${r.days_remaining_at_revocation}j`]] as [string,string][] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-[560px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 pt-5 pb-4 flex items-start justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white"
              style={{ backgroundColor: lc }}>
              {(r.employee?.full_name ?? "??").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-black text-slate-800">{r.employee?.full_name ?? "—"}</p>
              <p className="text-xs text-slate-400">Demande #{r.id}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={r.status} />
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
              style={{ backgroundColor: lc + "20", color: lc }}>
              {r.leave_type?.label}
            </span>
          </div>

          {/* Grille d'infos */}
          <div className="grid grid-cols-2 gap-2">
            {infoRows.map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{k}</p>
                <p className="text-sm font-semibold text-slate-800 truncate" title={v}>{v}</p>
              </div>
            ))}
          </div>

          {/* Motif */}
          {r.motif && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Motif</p>
              <p className="text-sm text-slate-700">{r.motif}</p>
            </div>
          )}

          {/* Reject reason (lecture) */}
          {r.status === "REJECTED" && r.reject_reason && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-[10px] text-red-500 uppercase font-bold mb-1">Motif du rejet</p>
              <p className="text-sm text-red-700">{r.reject_reason}</p>
            </div>
          )}

          {/* Revoke info (lecture) */}
          {r.status === "REVOKED" && r.revoke_reason && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
              <p className="text-[10px] text-orange-500 uppercase font-bold mb-1">Motif de révocation</p>
              <p className="text-sm text-orange-800">{r.revoke_reason}</p>
              {r.days_remaining_at_revocation != null && (
                <p className="text-xs text-emerald-600 font-bold mt-1.5">
                  ✓ {r.days_remaining_at_revocation}j restitués dans le solde
                </p>
              )}
            </div>
          )}

          {/* ── Actions PENDING / PENDING_SECOND ──────────────────────────────── */}
          {isPending && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                  Motif de rejet{" "}
                  <span className="normal-case font-normal text-slate-400">(requis pour rejeter)</span>
                </label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Expliquez la raison du rejet…" rows={2}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 resize-none transition" />
              </div>

              {/* 2ème approbateur uniquement depuis PENDING */}
              {r.status === "PENDING" && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                    2ème approbateur — ID employé{" "}
                    <span className="normal-case font-normal text-slate-400">(laisser vide pour approbation directe)</span>
                  </label>
                  <input type="number" min={1}
                    placeholder="Ex : 12"
                    value={secondApproverId} onChange={(e) => setSecondApproverId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition" />
                </div>
              )}

              <div className="flex gap-2">
                <button disabled={actionLoading || !rejectReason.trim()} onClick={handleReject}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                  {actionLoading ? <ImSpinner2 className="animate-spin" size={13} /> : <XCircle className="h-4 w-4" />}
                  Rejeter
                </button>

                {r.status === "PENDING" && secondApproverId.trim() && (
                  <button disabled={actionLoading}
                    onClick={() => handleApprove({ second_approver_id: parseInt(secondApproverId, 10) })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                    {actionLoading ? <ImSpinner2 className="animate-spin" size={13} /> : <Clock className="h-4 w-4" />}
                    Passer au N+2
                  </button>
                )}

                <button disabled={actionLoading} onClick={() => handleApprove()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                  {actionLoading ? <ImSpinner2 className="animate-spin" size={13} /> : <CheckCircle2 className="h-4 w-4" />}
                  Approuver
                </button>
              </div>
            </div>
          )}

          {/* ── Actions APPROVED ───────────────────────────────────────────────── */}
          {r.status === "APPROVED" && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <button disabled={actionLoading} onClick={handleCancel}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition disabled:opacity-50">
                {actionLoading ? <ImSpinner2 className="animate-spin" size={13} /> : <Ban className="h-4 w-4" />}
                Annuler la demande
              </button>

              {/* Zone révocation */}
              <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-4 space-y-3">
                <button onClick={() => setShowRevoke((v) => !v)}
                  className="flex items-center gap-2 text-orange-700 font-bold text-sm w-full">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Révocation d'urgence
                  <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${showRevoke ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showRevoke && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-3">
                      <p className="text-xs text-orange-700">
                        L'employé est rappelé d'urgence. Les jours restants depuis la date de rappel seront restitués dans son solde de congés.
                      </p>

                      <div>
                        <label className="text-xs font-bold text-orange-700 uppercase block mb-1.5">
                          Date de rappel effectif <span className="text-red-500">*</span>
                        </label>
                        <input type="date" value={recallDate} onChange={(e) => setRecallDate(e.target.value)}
                          min={r.start_date} max={r.end_date}
                          className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 transition bg-white" />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-orange-700 uppercase block mb-1.5">
                          Motif de révocation <span className="text-red-500">*</span>
                        </label>
                        <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)}
                          placeholder="Situation d'urgence nécessitant l'intervention de l'employé…"
                          rows={2}
                          className="w-full border border-orange-200 rounded-xl p-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 resize-none transition bg-white" />
                      </div>

                      <button disabled={actionLoading || !revokeReason.trim()} onClick={handleRevoke}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                        {actionLoading ? <ImSpinner2 className="animate-spin" size={13} /> : <RotateCcw className="h-4 w-4" />}
                        Confirmer la révocation
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
