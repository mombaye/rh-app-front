/**
 * ExitAuthorizationPanel
 * Panneau complet de gestion des autorisations de sortie.
 *  - Stats style dashboard employee
 *  - Modal détail au clic sur une demande
 *  - Modal de rejet séparé
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { exitAuthorizationService } from "@/services/leaveService";
import { ExitAuthorization, ExitAuthStatus } from "@/types/leave";
import { Employee } from "@/types/employee";
import toast from "react-hot-toast";
import {
  Plus, X, CheckCircle2, XCircle, Ban, Loader2, RefreshCw,
  LogOut, Clock, ChevronDown, User, CalendarDays, MessageSquare,
  ShieldCheck, Hash, Search,
} from "lucide-react";

// ─── Config statuts ───────────────────────────────────────────────────────────
const STATUS_CFG: Record<ExitAuthStatus, {
  label: string; color: string; bg: string; border: string;
  dot: string; textColor: string;
}> = {
  PENDING:   { label: "En attente", color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "bg-amber-400",   textColor: "text-amber-700"   },
  APPROVED:  { label: "Approuvé",   color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", dot: "bg-emerald-500", textColor: "text-emerald-700" },
  REJECTED:  { label: "Rejeté",     color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "bg-red-500",     textColor: "text-red-700"     },
  CANCELLED: { label: "Annulé",     color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", dot: "bg-slate-400",   textColor: "text-slate-500"   },
};

function StatusBadge({ status }: { status: ExitAuthStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function fmtDatetime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Modal détail ─────────────────────────────────────────────────────────────
function DetailModal({
  item, onClose, canReview, onApprove, onReject,
}: {
  item: ExitAuthorization;
  onClose: () => void;
  canReview?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.CANCELLED;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
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
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            >
              <X size={16} className="text-white" />
            </button>
            <div className="flex items-center gap-3 pr-10">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <LogOut size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-0.5">
                  Autorisation de sortie
                </p>
                <h2 className="text-white font-bold text-lg leading-tight">Sortie #{item.id}</h2>
              </div>
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Corps */}
          <div className="px-6 py-5 space-y-4">
            {/* Infos employé si disponible */}
            {item.employee_name && (
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2.5">
                <User size={15} className="text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Employé</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {item.employee_name}
                    {item.employee_matricule && (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">#{item.employee_matricule}</span>
                    )}
                    {item.employee_service && (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">— {item.employee_service}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: LogOut,       label: "Sortie le",  value: fmtDatetime(item.datetime_exit)   },
                { icon: LogOut,       label: "Rentrée le", value: fmtDatetime(item.datetime_return) },
                { icon: CalendarDays, label: "Soumis le",  value: fmtDatetime(item.created_at)      },
                ...(item.reviewed_by_name
                  ? [{ icon: User as typeof LogOut, label: "Traité par", value: item.reviewed_by_name }]
                  : []),
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
                  <f.icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chaîne de validation */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-3 tracking-wide">Chaîne de validation</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                    item.reviewed_by_name
                      ? "bg-emerald-500"
                      : item.status === "PENDING" ? "bg-amber-400 animate-pulse" : "bg-slate-300"
                  }`}>
                    {item.reviewed_by_name ? "✓" : "1"}
                  </span>
                  <span className="font-medium text-slate-700">Manager</span>
                  <span className="text-slate-400">—</span>
                  <span className={item.reviewed_by_name ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                    {item.reviewed_by_name
                      ? `${item.reviewed_by_name}${item.reviewed_at ? ` (${new Date(item.reviewed_at).toLocaleDateString("fr")})` : ""}`
                      : "En attente de validation"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                    item.status === "APPROVED" ? "bg-emerald-500" : "bg-slate-300"
                  }`}>
                    {item.status === "APPROVED" ? "✓" : "2"}
                  </span>
                  <span className="font-medium text-slate-700">RH</span>
                  <span className="text-slate-400">—</span>
                  <span className={item.status === "APPROVED" ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                    {item.status === "APPROVED" ? "Transmis à la RH" : "En attente"}
                  </span>
                </div>
              </div>
            </div>

            {/* Motif */}
            <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
              <MessageSquare size={15} className="text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Motif</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {item.motif || <span className="italic text-gray-400">Aucun motif renseigné</span>}
                </p>
              </div>
            </div>

            {/* Motif de rejet */}
            {item.reject_reason && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2.5">
                <XCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-red-400 uppercase font-semibold tracking-wide mb-0.5">Motif de rejet</p>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{item.reject_reason}</p>
                </div>
              </div>
            )}

            {/* Approbation */}
            {item.status === "APPROVED" && item.reviewed_by_name && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-green-500 shrink-0" />
                <p className="text-sm text-green-700 font-medium">
                  Approuvé par <span className="font-bold">{item.reviewed_by_name}</span>
                </p>
              </div>
            )}

            {/* Référence */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Hash size={12} />
              <span>Référence : <span className="font-semibold text-gray-500">#{item.id}</span></span>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-3">
            {/* Boutons manager si demande en attente */}
            {canReview && item.status === "PENDING" && (
              <div className="flex gap-3">
                <button
                  onClick={onApprove}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
                >
                  <CheckCircle2 size={16} />
                  Approuver
                </button>
                <button
                  onClick={onReject}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                >
                  <XCircle size={16} />
                  Rejeter
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
            >
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Modal rejet ──────────────────────────────────────────────────────────────
function RejectModal({
  item,
  managerId,
  onClose,
  onDone,
}: {
  item: ExitAuthorization;
  managerId?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error("Le motif de rejet est obligatoire."); return; }
    setLoading(true);
    try {
      await exitAuthorizationService.reject(item.id, reason.trim(), managerId);
      toast.success("Demande rejetée.");
      onDone();
    } catch {
      toast.error("Erreur lors du rejet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <XCircle size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Rejeter la demande</h3>
              <p className="text-red-100 text-xs">Sortie #{item.id} — {item.employee_name}</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Motif de rejet <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Expliquez la raison du rejet…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 bg-gray-50 resize-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Confirmer le rejet
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  employeeId?:       number;
  currentEmployee?:  Employee | null;
  employees?:        Employee[];
  managerId?:        number;
  canCreate?:        boolean;
  showEmployeeName?: boolean;
  canReview?:        boolean;
  hideHeader?:       boolean;
}

export default function ExitAuthorizationPanel({
  employeeId,
  currentEmployee,
  employees = [],
  managerId,
  canCreate        = true,
  showEmployeeName = true,
  canReview        = false,
  hideHeader       = false,
}: Props) {
  const [items,        setItems]        = useState<ExitAuthorization[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [statusFilter, setStatusFilter] = useState<ExitAuthStatus | "ALL">("ALL");
  const [search,       setSearch]       = useState("");

  const [detailTarget, setDetailTarget] = useState<ExitAuthorization | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ExitAuthorization | null>(null);

  // Formulaire
  const [selectedEmpId,  setSelectedEmpId]  = useState<number | "">(employeeId ?? currentEmployee?.id ?? "");
  const [datetimeExit,   setDatetimeExit]   = useState("");
  const [datetimeReturn, setDatetimeReturn] = useState("");
  const [motif,          setMotif]          = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = employeeId
        ? await exitAuthorizationService.getByEmployee(employeeId)
        : await exitAuthorizationService.getAll(
            managerId ? { manager_employee_id: managerId } : undefined
          );
      setItems(data);
    } catch {
      toast.error("Impossible de charger les autorisations de sortie.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [employeeId, managerId]);

  const handleCreate = async () => {
    if (!selectedEmpId || !datetimeExit || !datetimeReturn || !motif.trim()) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }
    setSubmitting(true);
    try {
      await exitAuthorizationService.create({
        employee_id:     Number(selectedEmpId),
        datetime_exit:   new Date(datetimeExit).toISOString(),
        datetime_return: new Date(datetimeReturn).toISOString(),
        motif:           motif.trim(),
      });
      toast.success("Demande soumise — votre manager va être notifié.");
      setShowForm(false);
      setDatetimeExit(""); setDatetimeReturn(""); setMotif("");
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { datetime_return?: string[] } } })
        ?.response?.data?.datetime_return?.[0];
      toast.error(msg ?? "Erreur lors de la soumission.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await exitAuthorizationService.approve(id, managerId);
      toast.success("Demande approuvée.");
      load();
    } catch {
      toast.error("Erreur lors de l'approbation.");
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await exitAuthorizationService.cancel(id);
      toast.success("Demande annulée.");
      load();
    } catch {
      toast.error("Erreur lors de l'annulation.");
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = items
    .filter(i => statusFilter === "ALL" || i.status === statusFilter)
    .filter(i => !q || [
      i.employee_name,
      i.employee_matricule,
      i.employee_service,
      i.motif,
    ].some(v => v?.toLowerCase().includes(q)));

  const kPending  = items.filter(i => i.status === "PENDING").length;
  const kApproved = items.filter(i => i.status === "APPROVED").length;
  const kRejected = items.filter(i => i.status === "REJECTED").length;
  const kTotal    = items.length;

  const statsData = [
    { label: "En attente", count: kPending,  dot: "bg-amber-400",   status: "PENDING"  as ExitAuthStatus | "ALL" },
    { label: "Approuvées", count: kApproved, dot: "bg-emerald-500", status: "APPROVED" as ExitAuthStatus | "ALL" },
    { label: "Rejetées",   count: kRejected, dot: "bg-red-500",     status: "REJECTED" as ExitAuthStatus | "ALL" },
    { label: "Total",      count: kTotal,    dot: "bg-slate-300",   status: "ALL"                                },
  ];

  return (
    <div className="space-y-4">
      {/* ── En-tête ── */}
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LogOut className="w-5 h-5 text-[#003c71]" />
            <h2 className="text-base font-bold text-[#003c71]">Autorisations de sortie</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {canCreate && (
              <button
                onClick={() => setShowForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#003c71] text-white rounded-xl text-sm font-semibold hover:bg-[#003c71]/90 transition"
              >
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? "Annuler" : "Nouvelle demande"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Stats (style dashboard employé) ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {statsData.map(s => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(s.status)}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
              statusFilter === s.status
                ? "border-[#003c71] ring-2 ring-[#003c71]/20"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-2xl font-bold text-[#003c71]">{loading ? "…" : s.count}</span>
            <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
          </button>
        ))}
      </motion.div>

      {/* ── Formulaire de création ── */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-[#003c71] text-sm">Nouvelle demande d'autorisation</h3>

          {!employeeId && employees.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Employé *</label>
              <div className="relative">
                <select
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(Number(e.target.value) || "")}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white appearance-none pr-8"
                >
                  <option value="">-- Sélectionner un employé --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.nom} {e.prenom} {e.matricule ? `(${e.matricule})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date & heure de sortie *</label>
              <input type="datetime-local" value={datetimeExit}
                onChange={e => setDatetimeExit(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date & heure de rentrée *</label>
              <input type="datetime-local" value={datetimeReturn} min={datetimeExit || undefined}
                onChange={e => setDatetimeReturn(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Motif *</label>
            <textarea rows={3} value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder="Décrivez le motif de la sortie..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white resize-none" />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
              Annuler
            </button>
            <button onClick={handleCreate} disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-[#003c71] text-white rounded-xl text-sm font-semibold hover:bg-[#003c71]/90 disabled:opacity-60 transition">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Soumettre
            </button>
          </div>
        </div>
      )}

      {/* ── Barre de recherche ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, matricule, service, motif…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20 focus:border-[#003c71]/40 transition"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Liste ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#003c71]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">Aucune demande trouvée.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setDetailTarget(item)}
              className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden cursor-pointer"
            >
              {/* Bande couleur statut */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: STATUS_CFG[item.status]?.color ?? "#64748b" }}
              />
              <div className="pl-5 pr-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    {showEmployeeName && (
                      <p className="font-semibold text-slate-800 text-sm">
                        {item.employee_name}
                        {item.employee_matricule && (
                          <span className="ml-2 text-xs text-slate-400 font-normal">#{item.employee_matricule}</span>
                        )}
                        {item.employee_service && (
                          <span className="ml-2 text-xs text-slate-400 font-normal">— {item.employee_service}</span>
                        )}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Sortie : <strong>{fmtDatetime(item.datetime_exit)}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Rentrée : <strong>{fmtDatetime(item.datetime_return)}</strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">Motif : {item.motif}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                {/* Info validation / rejet */}
                {(item.status === "APPROVED" || item.status === "REJECTED") && item.reviewed_by_name && (
                  <p className="text-xs text-slate-400 mt-2">
                    {item.status === "APPROVED" ? "Approuvé" : "Rejeté"} par{" "}
                    <strong>{item.reviewed_by_name}</strong>
                    {item.reviewed_at && <> le {fmtDatetime(item.reviewed_at)}</>}
                  </p>
                )}

                {/* Annulation employé */}
                {item.status === "PENDING" && !canReview && (
                  <div
                    className="flex pt-3 mt-2 border-t border-slate-100"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleCancel(item.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {detailTarget && (
        <DetailModal
          item={detailTarget}
          onClose={() => setDetailTarget(null)}
          canReview={canReview}
          onApprove={() => {
            handleApprove(detailTarget.id);
            setDetailTarget(null);
          }}
          onReject={() => {
            setRejectTarget(detailTarget);
            setDetailTarget(null);
          }}
        />
      )}
      {rejectTarget && (
        <RejectModal
          item={rejectTarget}
          managerId={managerId}
          onClose={() => setRejectTarget(null)}
          onDone={() => { setRejectTarget(null); load(); }}
        />
      )}
    </div>
  );
}
