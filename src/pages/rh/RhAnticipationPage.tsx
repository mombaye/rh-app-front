// src/pages/rh/RhAnticipationPage.tsx
// Page RH — Congés par anticipation (même design que RhExitAuthorizationPage)
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingDown, CheckCircle2, Clock, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, Filter, X, Calendar,
  Hash, Building2, Briefcase, MessageSquare, ShieldCheck,
  Eye, ArrowUpDown, LayoutGrid, List, Search, ThumbsUp, ThumbsDown,
  RefreshCw, User,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import AppLayout from "@/layouts/AppLayout";
import { leaveRequestService } from "@/services/leaveService";
import { LeaveRequest, LeaveStatus } from "@/types/leave";
import toast from "react-hot-toast";

// ─── Config statuts ───────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

type DisplayStatus = "PENDING_RH" | "PENDING" | "PENDING_SECOND" | "APPROVED" | "REJECTED" | "CANCELLED";

const STATUS_CFG: Record<DisplayStatus, {
  label: string; color: string; bg: string; dot: string;
  Icon: React.ElementType; textColor: string; borderColor: string;
}> = {
  PENDING_RH:     { label: "Attente RH",      color: "#7c3aed", bg: "#f5f3ff", dot: "bg-purple-500",  Icon: Clock,        textColor: "text-purple-700", borderColor: "border-purple-200" },
  PENDING:        { label: "Chez le manager",  color: "#d97706", bg: "#fffbeb", dot: "bg-amber-400",   Icon: Clock,        textColor: "text-amber-700",  borderColor: "border-amber-200"  },
  PENDING_SECOND: { label: "2ème validation",  color: "#ea580c", bg: "#fff7ed", dot: "bg-orange-400",  Icon: Clock,        textColor: "text-orange-700", borderColor: "border-orange-200" },
  APPROVED:       { label: "Approuvé",         color: "#059669", bg: "#f0fdf4", dot: "bg-green-500",   Icon: CheckCircle2, textColor: "text-green-700",  borderColor: "border-green-200"  },
  REJECTED:       { label: "Refusé",           color: "#dc2626", bg: "#fef2f2", dot: "bg-red-500",     Icon: XCircle,      textColor: "text-red-700",    borderColor: "border-red-200"    },
  CANCELLED:      { label: "Annulé",           color: "#64748b", bg: "#f8fafc", dot: "bg-gray-400",    Icon: XCircle,      textColor: "text-gray-500",   borderColor: "border-gray-200"   },
};

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}

// ─── Modal détail ─────────────────────────────────────────────────────────────
function DetailModal({
  req, onClose, onApprove, onReject,
}: {
  req: LeaveRequest;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const cfg  = STATUS_CFG[req.status as DisplayStatus] ?? STATUS_CFG.CANCELLED;
  const Icon = cfg.Icon;
  const days = parseFloat(req.days);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header coloré */}
          <div className="relative px-6 py-5" style={{ backgroundColor: cfg.color }}>
            <button onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
              <X size={16} className="text-white" />
            </button>
            <div className="flex items-center gap-3 pr-10">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <TrendingDown size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-0.5">Congé par anticipation</p>
                <h2 className="text-white font-bold text-lg leading-tight">{req.employee.full_name}</h2>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {cfg.label}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 text-white text-xs font-semibold">
                <TrendingDown size={9} /> Anticipation
              </span>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Infos employé */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Hash,      label: "Matricule",  value: req.employee.matricule ?? "—" },
                { icon: Building2, label: "Service",    value: req.employee.service   ?? "—" },
                { icon: Briefcase, label: "Fonction",   value: req.employee.fonction  ?? "—" },
                { icon: Calendar,  label: "Soumis le",  value: fmt(req.created_at.slice(0, 10)) },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
                  <f.icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Congé */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1.5">Congé</p>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: req.leave_type?.color ?? "#7c3aed" }} />
                <span className="font-semibold">{req.leave_type?.label ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                {fmt(req.start_date)} → {fmt(req.end_date)}
              </div>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md inline-block">
                {days} jour{days > 1 ? "s" : ""}
              </span>
            </div>

            {/* Motif */}
            <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
              <MessageSquare size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Motif</p>
                <p className="text-sm text-gray-700">
                  {req.motif || <span className="italic text-gray-400">Aucun motif renseigné</span>}
                </p>
              </div>
            </div>

            {/* Rejet */}
            {req.reject_reason && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2.5">
                <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-red-400 uppercase font-semibold tracking-wide mb-0.5">Motif de refus</p>
                  <p className="text-sm text-red-700">{req.reject_reason}</p>
                </div>
              </div>
            )}

            {/* Validé RH */}
            {req.hr_reviewer && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-2.5">
                <ShieldCheck size={15} className="text-green-500 shrink-0" />
                <p className="text-sm text-green-700 font-medium">
                  Transmis par <span className="font-bold">{req.hr_reviewer.full_name}</span>
                </p>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Hash size={12} />
              Référence : <span className="font-semibold text-gray-500 ml-1">#{req.id}</span>
            </div>
          </div>

          {/* Actions si PENDING_RH */}
          <div className="px-6 pb-6 flex gap-3">
            {req.status === "PENDING_RH" && onApprove && onReject ? (
              <>
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
                  Fermer
                </button>
                <button onClick={() => { onReject(); onClose(); }}
                  className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition flex items-center justify-center gap-2">
                  <ThumbsDown size={13} /> Refuser
                </button>
                <button onClick={() => { onApprove(); onClose(); }}
                  className="flex-[2] py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition flex items-center justify-center gap-2">
                  <ThumbsUp size={13} /> Transmettre
                </button>
              </>
            ) : (
              <button onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
                Fermer
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Modal rejet ─────────────────────────────────────────────────────────────
function RejectModal({
  req, onConfirm, onClose,
}: { req: LeaveRequest; onConfirm: (r: string) => Promise<void>; onClose: () => void }) {
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <ThumbsDown size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Refuser la demande</h3>
            <p className="text-red-100 text-xs">{req.employee.full_name}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 flex items-center gap-2">
            <Calendar size={13} className="text-gray-400" />
            {req.leave_type?.label} · {fmt(req.start_date)} → {fmt(req.end_date)}
            <span className="ml-auto text-xs font-bold text-gray-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">
              {parseFloat(req.days)} j
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <MessageSquare size={13} className="inline mr-1.5 text-gray-400" />
              Motif du refus <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Expliquez la raison du refus…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              autoFocus
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(reason); setLoading(false); }}
            disabled={loading || !reason.trim()}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <ThumbsDown size={14} />}
            Refuser
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Carte ────────────────────────────────────────────────────────────────────
function AnticipationCard({
  req, onView, compact = false,
}: { req: LeaveRequest; onView: () => void; compact?: boolean }) {
  const cfg  = STATUS_CFG[req.status as DisplayStatus] ?? STATUS_CFG.CANCELLED;
  const Icon = cfg.Icon;
  const days = parseFloat(req.days);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onView}
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer hover:border-gray-200"
    >
      {/* Bande couleur gauche */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: cfg.color }} />

      <div className={`pl-5 pr-4 ${compact ? "py-2.5" : "py-4"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 flex-wrap ${compact ? "mb-0.5" : "mb-1.5"}`}>
              <span className="font-semibold text-gray-800 text-sm truncate">{req.employee.full_name}</span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.textColor} ${cfg.borderColor}`}
                style={{ backgroundColor: cfg.bg }}
              >
                <Icon size={10} />
                {cfg.label}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 font-semibold">
                <TrendingDown size={8} /> Anticipation
              </span>
              {req.employee.matricule && (
                <span className="text-xs text-gray-400 font-mono">{req.employee.matricule}</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar size={12} className="text-gray-400 shrink-0" />
              <span className="font-medium text-gray-700">{req.leave_type?.label ?? "Congé"}</span>
              <span className="text-gray-300">·</span>
              <span>{fmt(req.start_date)} → {fmt(req.end_date)}</span>
              <span className="ml-1 text-[11px] font-bold text-gray-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">
                {days} j
              </span>
            </div>

            {!compact && (
              <>
                {req.employee.service && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Building2 size={10} className="shrink-0" />
                    {req.employee.service}
                    {req.employee.fonction && <><span className="text-gray-300">·</span>{req.employee.fonction}</>}
                  </p>
                )}
                {req.motif && (
                  <p className="text-xs text-gray-400 italic truncate max-w-sm mt-0.5">
                    <MessageSquare size={10} className="inline mr-1" />"{req.motif}"
                  </p>
                )}
                {req.reject_reason && (
                  <div className="flex items-start gap-1.5 mt-1">
                    <XCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-500 truncate max-w-xs">{req.reject_reason}</p>
                  </div>
                )}
                {req.hr_reviewer && req.status !== "PENDING_RH" && (
                  <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Transmis par {req.hr_reviewer.full_name}
                  </p>
                )}
              </>
            )}
          </div>

          <button
            onClick={e => { e.stopPropagation(); onView(); }}
            title="Voir le détail"
            className="p-2 rounded-lg text-gray-400 hover:text-[#003c71] hover:bg-[#003c71]/8 border border-gray-100 hover:border-[#003c71]/20 transition shrink-0"
          >
            <Eye size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function RhAnticipationPage() {
  const { user } = useAuth();

  const [items,        setItems]        = useState<LeaveRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [detailTarget, setDetailTarget] = useState<LeaveRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<DisplayStatus | "ALL">("ALL");
  const [search,       setSearch]       = useState("");
  const [sortOrder,    setSortOrder]    = useState<"recent" | "oldest">("recent");
  const [viewMode,     setViewMode]     = useState<"compact" | "detailed">("detailed");
  const [currentPage,  setCurrentPage]  = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    leaveRequestService.getAll({ is_anticipation: true } as any)
      .then(data => setItems(
        (data as LeaveRequest[]).slice().sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      ))
      .catch(() => toast.error("Impossible de charger les demandes."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = (filterStatus === "ALL" ? items : items.filter(i => i.status === filterStatus))
    .filter(i =>
      !q || [i.employee.full_name, i.employee.matricule, i.employee.service, i.motif]
        .some(v => v?.toLowerCase().includes(q))
    )
    .slice()
    .sort((a, b) =>
      sortOrder === "recent"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const count = (s: string) => items.filter(i => i.status === s).length;

  const statsData = [
    { label: "Total",            status: "ALL" as const,          count: items.length,                             dot: "bg-slate-300"  },
    { label: "Attente RH",       status: "PENDING_RH" as const,   count: count("PENDING_RH"),                      dot: "bg-purple-500" },
    { label: "Chez le manager",  status: "PENDING" as const,      count: count("PENDING") + count("PENDING_SECOND"), dot: "bg-amber-400" },
    { label: "Approuvés",        status: "APPROVED" as const,     count: count("APPROVED"),                         dot: "bg-[#003c71]" },
    { label: "Refusés",          status: "REJECTED" as const,     count: count("REJECTED"),                         dot: "bg-red-400"   },
  ];

  const handleApprove = async (req: LeaveRequest) => {
    try {
      await leaveRequestService.hrValidate(req.id, user?.employee_id);
      toast.success(`Demande de ${req.employee.full_name} transmise au manager.`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la validation.");
    }
  };

  const handleReject = async (req: LeaveRequest, reason: string) => {
    try {
      await leaveRequestService.hrReject(req.id, reason, user?.employee_id);
      toast.success(`Demande de ${req.employee.full_name} refusée.`);
      setRejectTarget(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors du refus.");
    }
  };

  return (
    <AppLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Congés par anticipation</h1>
            <p className="text-gray-500 text-sm mt-0.5">Demandes avec solde potentiellement insuffisant</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </motion.div>

        {/* Stats */}
        {!loading && items.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {statsData.map(s => {
              const active = filterStatus === s.status;
              return (
                <button key={s.label}
                  onClick={() => { setFilterStatus(s.status); setCurrentPage(1); }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
                    active ? "border-[#003c71] ring-2 ring-[#003c71]/20" : "border-gray-200 hover:border-gray-300"
                  }`}>
                  <span className="text-2xl font-bold text-[#003c71]">{s.count}</span>
                  <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}

        {/* Barre de recherche */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Rechercher par nom, matricule, service, motif…"
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-2xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20 focus:border-[#003c71]/40 transition shadow-sm"
          />
          {search && (
            <button onClick={() => { setSearch(""); setCurrentPage(1); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
              <X size={15} />
            </button>
          )}
        </motion.div>

        {/* Liste */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-800 text-sm">Demandes</span>
              {!loading && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold">
                  {filtered.length}
                </span>
              )}
            </div>
            <div className="flex-1" />

            {/* Tri */}
            <div className="relative">
              <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700">
                <option value="recent">Plus récentes</option>
                <option value="oldest">Plus anciennes</option>
              </select>
            </div>

            {/* Filtre statut */}
            <div className="relative">
              <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value as DisplayStatus | "ALL"); setCurrentPage(1); }}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700">
                <option value="ALL">Tous ({items.length})</option>
                {(Object.entries(STATUS_CFG) as [DisplayStatus, typeof STATUS_CFG[DisplayStatus]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} ({count(k)})</option>
                ))}
              </select>
            </div>

            {/* Mode affichage */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              <button onClick={() => setViewMode("detailed")} title="Détaillé"
                className={`p-1.5 rounded-md transition ${viewMode === "detailed" ? "bg-[#003c71] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}>
                <LayoutGrid size={13} />
              </button>
              <button onClick={() => setViewMode("compact")} title="Compact"
                className={`p-1.5 rounded-md transition ${viewMode === "compact" ? "bg-[#003c71] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}>
                <List size={13} />
              </button>
            </div>
          </div>

          {/* Chips filtres actifs */}
          {!loading && (filterStatus !== "ALL" || search) && (
            <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
              {filterStatus !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {STATUS_CFG[filterStatus as DisplayStatus]?.label}
                  <button onClick={() => { setFilterStatus("ALL"); setCurrentPage(1); }}
                    className="hover:bg-blue-100 rounded-full p-0.5 transition"><X size={10} /></button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                  "{search}"
                  <button onClick={() => { setSearch(""); setCurrentPage(1); }}
                    className="hover:bg-gray-100 rounded-full p-0.5 transition"><X size={10} /></button>
                </span>
              )}
            </div>
          )}

          {/* Contenu */}
          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <TrendingDown size={28} className="opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-500">Aucune demande trouvée</p>
              <p className="text-xs mt-1 text-gray-400">
                {filterStatus !== "ALL" || search
                  ? "Aucune demande pour ces critères"
                  : "Aucune demande de congé par anticipation enregistrée"}
              </p>
            </div>
          ) : (
            <>
              <div className={`p-4 ${viewMode === "compact" ? "space-y-1.5" : "space-y-3"}`}>
                {paginated.map(item => (
                  <AnticipationCard
                    key={item.id}
                    req={item}
                    compact={viewMode === "compact"}
                    onView={() => setDetailTarget(item)}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-gray-400">
                  Page {currentPage} / {totalPages} · {filtered.length} demande{filtered.length > 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition ${page === currentPage ? "bg-[#003c71] text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {page}
                    </button>
                  ))}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Modal détail */}
      {detailTarget && (
        <DetailModal
          req={detailTarget}
          onClose={() => setDetailTarget(null)}
          onApprove={detailTarget.status === "PENDING_RH" ? () => { handleApprove(detailTarget); setDetailTarget(null); } : undefined}
          onReject={detailTarget.status === "PENDING_RH" ? () => { setRejectTarget(detailTarget); setDetailTarget(null); } : undefined}
        />
      )}

      {/* Modal rejet */}
      <AnimatePresence>
        {rejectTarget && (
          <RejectModal
            req={rejectTarget}
            onConfirm={(reason) => handleReject(rejectTarget, reason)}
            onClose={() => setRejectTarget(null)}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
