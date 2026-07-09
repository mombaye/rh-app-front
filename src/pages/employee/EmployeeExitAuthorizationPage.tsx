import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, CheckCircle2, Clock, XCircle,
  Loader2, ChevronLeft, ChevronRight,
  Filter, X, CalendarDays, User, Hash, MessageSquare, ShieldCheck,
  Trash2, Eye, ArrowUpDown, LayoutGrid, List, LogOut, AlertTriangle,
  GitBranch, Mail,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { exitAuthorizationService } from "@/services/leaveService";
import { ExitAuthorization, ExitAuthStatus } from "@/types/leave";
import toast from "react-hot-toast";

const PAGE_SIZE = 8;

// ── Status config (même charte que Congés) ─────────────────────────────────────
const STATUS_CFG: Record<ExitAuthStatus, {
  label: string; color: string; bg: string; dot: string;
  Icon: React.ElementType; textColor: string; borderColor: string;
}> = {
  PENDING:   { label: "En attente", color: "#d97706", bg: "#fffbeb", dot: "bg-amber-400",  Icon: Clock,        textColor: "text-amber-700",  borderColor: "border-amber-200"  },
  APPROVED:  { label: "Approuvé",   color: "#059669", bg: "#f0fdf4", dot: "bg-green-500",  Icon: CheckCircle2, textColor: "text-green-700",  borderColor: "border-green-200"  },
  REJECTED:  { label: "Rejeté",     color: "#dc2626", bg: "#fef2f2", dot: "bg-red-500",    Icon: XCircle,      textColor: "text-red-700",    borderColor: "border-red-200"    },
  CANCELLED: { label: "Annulé",     color: "#64748b", bg: "#f8fafc", dot: "bg-gray-400",   Icon: XCircle,      textColor: "text-gray-500",   borderColor: "border-gray-200"   },
};

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}
function fmtDatetime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Modal création ─────────────────────────────────────────────────────────────
interface CreateModalProps { employeeId: number; onClose: () => void; onSaved: () => void; }

function CreateModal({ employeeId, onClose, onSaved }: CreateModalProps) {
  // Date unique + heure départ + heure retour (même journée obligatoire)
  const todayIso = new Date().toISOString().slice(0, 10);
  const [date,        setDate]        = useState(todayIso);
  const [heureDepart, setHeureDepart] = useState("");
  const [heureRetour, setHeureRetour] = useState("");
  const [motif,       setMotif]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);
    if (!date)        { setFormError("Veuillez renseigner la date de la sortie."); return; }
    if (!heureDepart) { setFormError("Veuillez renseigner l'heure de départ."); return; }
    if (!heureRetour) { setFormError("Veuillez renseigner l'heure de retour."); return; }
    if (heureRetour <= heureDepart) { setFormError("L'heure de retour doit être après l'heure de départ."); return; }
    if (!motif.trim()) { setFormError("Veuillez indiquer le motif de la sortie."); return; }

    const datetimeExit   = `${date}T${heureDepart}:00`;
    const datetimeReturn = `${date}T${heureRetour}:00`;

    setSaving(true);
    try {
      await exitAuthorizationService.create({
        employee_id:     employeeId,
        datetime_exit:   new Date(datetimeExit).toISOString(),
        datetime_return: new Date(datetimeReturn).toISOString(),
        motif:           motif.trim(),
      });
      toast.success("Demande de sortie soumise — votre manager N+1 va être notifié.");
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.datetime_return?.[0] || err?.response?.data?.detail || "Erreur lors de la soumission.";
      setFormError(msg);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#003c71] to-[#0055a4] px-6 py-5 rounded-t-3xl sm:rounded-t-2xl flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Nouvelle demande de sortie</h3>
            <p className="text-blue-200 text-xs mt-0.5">Votre manager N+1 sera notifié automatiquement</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <AnimatePresence>
            {formError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{formError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Date unique */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <CalendarDays size={14} className="inline mr-1.5 text-[#003c71]" />
              Date de la sortie <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setFormError(null); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
            />
          </div>

          {/* Heures côte à côte */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <LogOut size={13} className="inline mr-1.5 text-[#003c71]" />
                Heure de départ <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={heureDepart}
                onChange={e => { setHeureDepart(e.target.value); setFormError(null); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <LogOut size={13} className="inline mr-1.5 rotate-180 text-[#003c71]" />
                Heure de retour <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={heureRetour}
                min={heureDepart || undefined}
                onChange={e => { setHeureRetour(e.target.value); setFormError(null); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
              />
            </div>
          </div>

          {/* Récap visuel si les deux heures sont renseignées */}
          {heureDepart && heureRetour && heureRetour > heureDepart && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-[#003c71]/5 border border-[#003c71]/20 rounded-xl px-4 py-2.5"
            >
              <Clock size={15} className="text-[#003c71] shrink-0" />
              <span className="text-sm font-medium text-[#003c71]">
                {heureDepart} → {heureRetour}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {(() => {
                  const [dh, dm] = heureDepart.split(":").map(Number);
                  const [rh, rm] = heureRetour.split(":").map(Number);
                  const diff = (rh * 60 + rm) - (dh * 60 + dm);
                  const h = Math.floor(diff / 60);
                  const m = diff % 60;
                  return h > 0 ? `${h}h${m > 0 ? `${String(m).padStart(2,"0")}` : ""}` : `${m} min`;
                })()}
              </span>
            </motion.div>
          )}

          {/* Motif */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <MessageSquare size={13} className="inline mr-1.5 text-[#003c71]" />
              Motif de la sortie <span className="text-red-400">*</span>
            </label>
            <textarea rows={3} value={motif}
              onChange={e => { setMotif(e.target.value); setFormError(null); }}
              placeholder="Décrivez le motif de la sortie..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm transition font-medium">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-[2] px-4 py-2.5 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition flex items-center justify-center gap-2 disabled:opacity-50 font-semibold shadow-sm">
              {saving && <Loader2 size={15} className="animate-spin" />}
              Envoyer la demande
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Circuit de validation (sorties) ───────────────────────────────────────────
function ExitValidationChain({ item }: { item: ExitAuthorization }) {
  const fmtDt = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : null;

  type StepStatus = "done" | "waiting" | "rejected" | "pending" | "cancelled";
  interface Step {
    label:  string;
    name?:  string | null;
    email?: string | null;
    date?:  string | null;
    note?:  string | null;
    status: StepStatus;
  }

  // Nom du N+1 : après validation on prend le validateur réel, sinon le N+1 de l'arborescence
  const n1Name  = item.reviewed_by_name ?? item.n1_manager_name  ?? null;
  const n1Email = item.n1_manager_email ?? null;

  const steps: Step[] = [
    {
      label:  "Demande soumise",
      name:   item.employee_name || null,
      date:   fmtDt(item.created_at),
      status: "done",
    },
    {
      label:  "Validation Manager N+1",
      name:   n1Name,
      email:  item.status !== "PENDING" ? n1Email : null,
      date:   fmtDt(item.reviewed_at),
      note:   item.status === "REJECTED" ? (item.reject_reason || null) : null,
      status: item.status === "APPROVED"
        ? "done"
        : item.status === "REJECTED"
        ? "rejected"
        : item.status === "CANCELLED"
        ? "cancelled"
        : "waiting",
    },
  ];

  const dot: Record<StepStatus, string> = {
    done:      "bg-emerald-500 border-emerald-300 shadow-emerald-200",
    waiting:   "bg-amber-400  border-amber-300   shadow-amber-200   animate-pulse",
    pending:   "bg-slate-200  border-slate-200",
    rejected:  "bg-red-500    border-red-300     shadow-red-200",
    cancelled: "bg-slate-300  border-slate-200",
  };
  const line: Record<StepStatus, string> = {
    done: "bg-emerald-200", waiting: "bg-amber-200", pending: "bg-slate-100",
    rejected: "bg-red-200", cancelled: "bg-slate-100",
  };
  const badgeStyle: Record<StepStatus, string> = {
    done:      "bg-emerald-50 text-emerald-700 border-emerald-200",
    waiting:   "bg-amber-50   text-amber-700   border-amber-200",
    pending:   "bg-slate-50   text-slate-400   border-slate-200",
    rejected:  "bg-red-50     text-red-700     border-red-200",
    cancelled: "bg-slate-50   text-slate-400   border-slate-200",
  };
  const badgeText: Record<StepStatus, string> = {
    done: "✓ Validé", waiting: "En attente…", pending: "Non démarré",
    rejected: "✗ Rejeté", cancelled: "Annulé",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
          Circuit de validation
        </p>
      </div>
      <div>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center pt-0.5">
                <div className={`w-3 h-3 rounded-full border-2 shrink-0 shadow-sm ${dot[step.status]}`} />
                {!isLast && <div className={`w-0.5 flex-1 min-h-[28px] my-1.5 rounded-full ${line[step.status]}`} />}
              </div>
              <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-4"}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">{step.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${badgeStyle[step.status]}`}>
                    {badgeText[step.status]}
                  </span>
                  {step.date && <span className="text-[10px] text-slate-400">{step.date}</span>}
                </div>
                {(step.name || step.email) && step.status !== "pending" && (
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    {step.name  && <span className="text-xs text-slate-600 font-medium">{step.name}</span>}
                    {step.email && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <Mail className="h-2.5 w-2.5 shrink-0" />
                        {step.email}
                      </span>
                    )}
                  </div>
                )}
                {step.note && (
                  <div className="mt-1.5 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 border bg-red-50 border-red-100">
                    <XCircle className="h-3 w-3 shrink-0 mt-0.5 text-red-400" />
                    <p className="text-[11px] leading-snug text-red-600">{step.note}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal détail ───────────────────────────────────────────────────────────────
interface DetailModalProps { item: ExitAuthorization; onClose: () => void; }

function DetailModal({ item, onClose }: DetailModalProps) {
  const cfg  = STATUS_CFG[item.status] ?? STATUS_CFG.CANCELLED;
  const Icon = cfg.Icon;

  const fields: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: LogOut,      label: "Sortie le",     value: fmtDatetime(item.datetime_exit)   },
    { icon: LogOut,      label: "Rentrée le",    value: fmtDatetime(item.datetime_return) },
    { icon: CalendarDays, label: "Soumis le",    value: fmt(item.created_at.slice(0, 10)) },
    ...(item.reviewed_by_name ? [{ icon: User as React.ElementType, label: "Traité par", value: item.reviewed_by_name }] : []),
    ...(item.reviewed_at ? [{ icon: CalendarDays as React.ElementType, label: "Traité le", value: fmt(item.reviewed_at.slice(0, 10)) }] : []),
  ];

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
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-0.5">Demande de sortie</p>
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
            <div className="grid grid-cols-2 gap-3">
              {fields.map(f => (
                <div key={f.label} className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
                  <f.icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Circuit de validation */}
            <ExitValidationChain item={item} />

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

          <div className="px-6 pb-6">
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Carte demande (même design que RequestCard des Congés) ─────────────────────
interface CardProps { item: ExitAuthorization; onView: () => void; onCancel: () => void; compact?: boolean; }

function ExitCard({ item, onView, onCancel, compact = false }: CardProps) {
  const cfg       = STATUS_CFG[item.status] ?? STATUS_CFG.CANCELLED;
  const Icon      = cfg.Icon;
  const canCancel = item.status === "PENDING";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onView}
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer hover:border-gray-200"
    >
      {/* Bande couleur statut */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: cfg.color }} />

      <div className={`pl-5 pr-4 ${compact ? "py-2.5" : "py-4"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 flex-wrap ${compact ? "mb-0.5" : "mb-1.5"}`}>
              <span className="font-semibold text-gray-800 text-sm truncate">Demande de sortie</span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.textColor} ${cfg.borderColor}`}
                style={{ backgroundColor: cfg.bg }}
              >
                <Icon size={10} />
                {cfg.label}
              </span>
            </div>

            {/* Période */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <LogOut size={12} className="text-gray-400 shrink-0" />
              <span>{fmtDatetime(item.datetime_exit)}</span>
              <span className="text-gray-300">→</span>
              <span>{fmtDatetime(item.datetime_return)}</span>
            </div>

            {!compact && (
              <>
                {item.motif && (
                  <p className="text-xs text-gray-400 italic truncate max-w-sm mt-1">"{item.motif}"</p>
                )}
                {item.reject_reason && (
                  <div className="flex items-start gap-1.5 mt-1">
                    <XCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-500 truncate max-w-xs">{item.reject_reason}</p>
                  </div>
                )}
                {item.reviewed_by_name && item.status === "APPROVED" && (
                  <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Approuvé par {item.reviewed_by_name}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onView(); }}
              title="Voir le détail"
              className="p-2 rounded-lg text-gray-400 hover:text-[#003c71] hover:bg-[#003c71]/8 border border-gray-100 hover:border-[#003c71]/20 transition"
            >
              <Eye size={14} />
            </button>
            {canCancel && (
              <button
                onClick={e => { e.stopPropagation(); onCancel(); }}
                title="Annuler la demande"
                className={`flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition font-medium border border-red-200 hover:border-red-400 ${compact ? "p-2" : "px-3 py-1.5"}`}
              >
                <Trash2 size={12} />
                {!compact && <span className="hidden sm:inline">Annuler</span>}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
interface EmployeeExitAuthorizationPageProps {
  layout?: React.ComponentType<{ children: React.ReactNode }>;
}

export default function EmployeeExitAuthorizationPage({ layout: Layout = EmployeeLayout }: EmployeeExitAuthorizationPageProps) {
  const { user }   = useAuth();
  const employeeId = user?.employee_id;

  const [items,         setItems]         = useState<ExitAuthorization[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showCreate,    setShowCreate]    = useState(false);
  const [detailTarget,  setDetailTarget]  = useState<ExitAuthorization | null>(null);
  const [cancelTarget,  setCancelTarget]  = useState<ExitAuthorization | null>(null);
  const [cancelling,    setCancelling]    = useState(false);
  const [filterStatus,  setFilterStatus]  = useState<ExitAuthStatus | "ALL">("ALL");
  const [sortOrder,     setSortOrder]     = useState<"recent" | "oldest">("recent");
  const [viewMode,      setViewMode]      = useState<"compact" | "detailed">("detailed");
  const [currentPage,   setCurrentPage]   = useState(1);

  const load = useCallback(() => {
    if (!employeeId) return;
    setLoading(true);
    exitAuthorizationService.getByEmployee(employeeId)
      .then(data => setItems(data.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())))
      .catch(() => toast.error("Impossible de charger les demandes."))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const filtered = (filterStatus === "ALL" ? items : items.filter(i => i.status === filterStatus))
    .slice()
    .sort((a, b) =>
      sortOrder === "recent"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statsData = [
    { label: "Total",      status: "ALL" as const,       count: items.length,                                         dot: "bg-slate-300"  },
    { label: "En attente", status: "PENDING" as const,   count: items.filter(i => i.status === "PENDING").length,     dot: "bg-amber-400"  },
    { label: "Approuvées", status: "APPROVED" as const,  count: items.filter(i => i.status === "APPROVED").length,    dot: "bg-[#003c71]" },
    { label: "Rejetées",   status: "REJECTED" as const,  count: items.filter(i => i.status === "REJECTED").length,    dot: "bg-slate-400"  },
  ];

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await exitAuthorizationService.cancel(cancelTarget.id);
      toast.success("Demande annulée.");
      setCancelTarget(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors de l'annulation.");
    } finally { setCancelling(false); }
  };

  return (
    <Layout>
      <div className="px-4 md:px-6 pb-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Demandes de sortie</h1>
            <p className="text-gray-500 text-sm mt-0.5">Autorisations de sortie temporaire</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition shadow-sm font-medium"
          >
            <Plus size={16} />
            Nouvelle demande
          </button>
        </motion.div>

        {/* Stats */}
        {!loading && items.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {statsData.map(s => {
              const active = filterStatus === s.status;
              return (
                <button key={s.label}
                  onClick={() => { setFilterStatus(s.status); setCurrentPage(1); }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
                    active ? "border-[#003c71] ring-2 ring-[#003c71]/20" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
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

        {/* Liste */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-800 text-sm">Mes demandes</span>
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
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as ExitAuthStatus | "ALL"); setCurrentPage(1); }}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700">
                <option value="ALL">Tous ({items.length})</option>
                {(Object.entries(STATUS_CFG) as [ExitAuthStatus, typeof STATUS_CFG[ExitAuthStatus]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} ({items.filter(i => i.status === k).length})</option>
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

          {/* Chip filtre actif */}
          {!loading && filterStatus !== "ALL" && (
            <div className="px-5 pt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {STATUS_CFG[filterStatus as ExitAuthStatus]?.label}
                <button onClick={() => { setFilterStatus("ALL"); setCurrentPage(1); }}
                  className="hover:bg-blue-100 rounded-full p-0.5 transition">
                  <X size={10} />
                </button>
              </span>
            </div>
          )}

          {/* Contenu */}
          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <LogOut size={28} className="opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-500">Aucune demande trouvée</p>
              <p className="text-xs mt-1 text-gray-400">
                {filterStatus !== "ALL" ? "Aucune demande pour ce statut" : "Créez votre première demande de sortie"}
              </p>
              {filterStatus === "ALL" && (
                <button onClick={() => setShowCreate(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition font-medium">
                  <Plus size={15} /> Nouvelle demande
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`p-4 ${viewMode === "compact" ? "space-y-1.5" : "space-y-3"}`}>
                {paginated.map(item => (
                  <ExitCard key={item.id} item={item} compact={viewMode === "compact"}
                    onView={() => setDetailTarget(item)}
                    onCancel={() => setCancelTarget(item)} />
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

      {/* Modals */}
      {showCreate && employeeId && (
        <CreateModal employeeId={employeeId} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {detailTarget && (
        <DetailModal item={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Annuler cette demande ?</h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              <span className="font-medium text-gray-700">Sortie #{cancelTarget.id}</span>
            </p>
            <p className="text-xs text-gray-400 text-center mb-5">
              {fmtDatetime(cancelTarget.datetime_exit)} → {fmtDatetime(cancelTarget.datetime_return)}
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center mb-5">
              Cette action est irréversible. La demande passera au statut Annulé.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelTarget(null)} disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
                Garder
              </button>
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
                {cancelling && <Loader2 size={14} className="animate-spin" />}
                Confirmer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
