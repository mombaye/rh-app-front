import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, MapPin, CheckCircle2, Clock, XCircle,
  AlertCircle, Pencil, Loader2,
  ChevronLeft, ChevronRight, Filter,
  X, Calendar, User, Hash, MessageSquare,
  Trash2, Eye, LayoutGrid, List, ArrowUpDown,
} from "lucide-react";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { useAuth } from "@/contexts/useAuth";
import { missionService, MissionRequest, MissionRequestCreate } from "@/services/missionService";
import toast from "react-hot-toast";

const PAGE_SIZE = 8;

//    Helpers

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const fmt = (d: string) => {
  const dt = new Date(d + "T12:00:00");
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
};
const fmtShort = (d: string) => {
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
};
const nbJours = (d1: string, d2: string) =>
  Math.round((new Date(d2 + "T12:00:00").getTime() - new Date(d1 + "T12:00:00").getTime()) / 86400000) + 1;

//    Status config

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; dot: string;
  Icon: React.ElementType; textColor: string; borderColor: string;
}> = {
  PENDING:  { label: "En attente", color: "#d97706", bg: "#fffbeb", dot: "bg-amber-400",  Icon: Clock,        textColor: "text-amber-700",  borderColor: "border-amber-200"  },
  APPROVED: { label: "Approuvé",   color: "#059669", bg: "#f0fdf4", dot: "bg-green-500",  Icon: CheckCircle2, textColor: "text-green-700",  borderColor: "border-green-200"  },
  REJECTED: { label: "Rejeté",     color: "#dc2626", bg: "#fef2f2", dot: "bg-red-500",    Icon: XCircle,      textColor: "text-red-700",    borderColor: "border-red-200"    },
};

// Stepper étape par étape
function MissionStepper({ mission }: { mission: MissionRequest }) {
  const steps = [
    {
      label: "Demande soumise",
      desc: fmt(mission.created_at.slice(0, 10)),
      done: true,
      active: false,
    },
    {
      label: "Validation N+1",
      desc: mission.status === "PENDING"
        ? "En cours d'examen"
        : mission.status === "APPROVED"
        ? `Approuvé le ${mission.reviewed_at ? fmt(mission.reviewed_at.slice(0,10)) : ""}`
        : `Rejeté le ${mission.reviewed_at ? fmt(mission.reviewed_at.slice(0,10)) : ""}`,
      done: mission.status !== "PENDING",
      active: mission.status === "PENDING",
      rejected: mission.status === "REJECTED",
    },
    {
      label: "Résultat final",
      desc: mission.status === "APPROVED"
        ? "Mission approuvée"
        : mission.status === "REJECTED"
        ? "Mission rejetée"
        : "En attente de décision",
      done: mission.status !== "PENDING",
      active: false,
      rejected: mission.status === "REJECTED",
    },
  ];

  return (
    <div className="flex items-start gap-0 w-full">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const color = step.rejected ? "#dc2626" : step.done ? "#059669" : step.active ? "#d97706" : "#9ca3af";
        const bgColor = step.rejected ? "#fef2f2" : step.done ? "#f0fdf4" : step.active ? "#fffbeb" : "#f9fafb";
        const icon = step.rejected
          ? <XCircle size={14} style={{ color }} />
          : step.done
          ? <CheckCircle2 size={14} style={{ color }} />
          : step.active
          ? <Clock size={14} style={{ color }} />
          : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />;

        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                style={{ backgroundColor: bgColor, border: `2px solid ${color}` }}
              >
                {icon}
              </div>
              {!isLast && (
                <div
                  className="flex-1 h-0.5"
                  style={{ backgroundColor: step.done ? "#059669" : "#e5e7eb" }}
                />
              )}
            </div>
            <div className="mt-1.5 text-center px-1">
              <p className="text-[10px] font-semibold" style={{ color }}>{step.label}</p>
              <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{step.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

//    Modal de création / modification

interface MissionFormModalProps {
  mode: "create" | "edit";
  initial?: Partial<MissionRequestCreate & { id: number }>;
  employeeId: number;
  onClose: () => void;
  onSaved: () => void;
}

function MissionFormModal({ mode, initial, employeeId, onClose, onSaved }: MissionFormModalProps) {
  const [form, setForm] = useState<Partial<MissionRequestCreate>>({
    employee_id: employeeId,
    destination: initial?.destination ?? "",
    objet:       initial?.objet       ?? "",
    date_debut:  initial?.date_debut  ?? "",
    date_fin:    initial?.date_fin    ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!form.destination?.trim()) { setError("Veuillez renseigner la destination."); return; }
    if (!form.objet?.trim())       { setError("Veuillez renseigner l'objet de la mission."); return; }
    if (!form.date_debut)          { setError("Veuillez renseigner la date de début."); return; }
    if (!form.date_fin)            { setError("Veuillez renseigner la date de fin."); return; }
    if (form.date_fin < form.date_debut!) { setError("La date de fin doit être postérieure à la date de début."); return; }

    setSaving(true);
    try {
      await missionService.create(form as MissionRequestCreate);
      toast.success("Demande de mission envoyée !");
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.detail
        || err?.response?.data?.non_field_errors?.[0]
        || "Erreur lors de la création.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const jours = form.date_debut && form.date_fin && form.date_fin >= form.date_debut
    ? nbJours(form.date_debut, form.date_fin)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-[500px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#003c71] to-[#0055a4] px-6 py-5 rounded-t-3xl sm:rounded-t-2xl">
          <h3 className="text-white font-bold text-lg">
            {mode === "create" ? "Nouvelle demande de mission" : "Modifier la demande"}
          </h3>
          <p className="text-blue-200 text-xs mt-0.5">
            {mode === "create" ? "Remplissez le formulaire ci-dessous" : "Modifiez les informations de votre demande"}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Erreur */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              >
                <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Destination <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex : Dakar, Thiès, Paris…"
              value={form.destination ?? ""}
              onChange={e => { setError(null); setForm(p => ({ ...p, destination: e.target.value })); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
            />
          </div>

          {/* Objet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Objet de la mission <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Décrivez le but de la mission…"
              value={form.objet ?? ""}
              onChange={e => { setError(null); setForm(p => ({ ...p, objet: e.target.value })); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50 resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Date début <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.date_debut ?? ""}
                onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Date fin <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.date_fin ?? ""}
                min={form.date_debut || undefined}
                onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-gray-50"
              />
            </div>
          </div>

          {/* Résumé durée */}
          <AnimatePresence>
            {jours !== null && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2"
              >
                <Calendar size={16} className="text-blue-500 shrink-0" />
                <span className="text-sm text-blue-700 font-semibold">
                  {jours} jour{jours > 1 ? "s" : ""} de mission
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm transition font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] px-4 py-2.5 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {mode === "create" ? "✈ Envoyer la demande" : "Enregistrer"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

//    Modal de détail

interface MissionDetailModalProps {
  mission: MissionRequest;
  onClose: () => void;
}

function MissionDetailModal({ mission, onClose }: MissionDetailModalProps) {
  const cfg  = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.PENDING;
  const Icon = cfg.Icon;
  const jours = nbJours(mission.date_debut, mission.date_fin);

  const fields = [
    { icon: MapPin,    label: "Destination", value: mission.destination                   },
    { icon: Calendar,  label: "Date début",  value: fmt(mission.date_debut)               },
    { icon: Calendar,  label: "Date fin",    value: fmt(mission.date_fin)                 },
    { icon: Clock,     label: "Durée",       value: `${jours} jour${jours > 1 ? "s" : ""}` },
    { icon: Calendar,  label: "Soumis le",   value: fmt(mission.created_at.slice(0,10))   },
    ...(mission.reviewed_by
      ? [{ icon: User as React.ElementType, label: "Traité par", value: mission.reviewed_by.full_name }]
      : []
    ),
  ];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: 30, scale: 0.97 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header coloré selon statut */}
          <div className="relative px-6 py-5" style={{ backgroundColor: cfg.color }}>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            >
              <X size={16} className="text-white" />
            </button>
            <div className="flex items-center gap-3 pr-10">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-0.5">Demande de mission</p>
                <h2 className="text-white font-bold text-lg leading-tight">{mission.destination}</h2>
              </div>
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Stepper */}
          <div className="px-6 pt-4 pb-2">
            <MissionStepper mission={mission} />
          </div>

          {/* Corps */}
          <div className="px-6 py-4 space-y-4">
            {/* Grille d'infos */}
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

            {/* Objet */}
            <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
              <MessageSquare size={15} className="text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Objet</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{mission.objet}</p>
              </div>
            </div>

            {/* Motif de rejet */}
            {mission.reject_reason && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2.5">
                <XCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-red-400 uppercase font-semibold tracking-wide mb-0.5">Motif de rejet</p>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{mission.reject_reason}</p>
                </div>
              </div>
            )}

            {/* Approbation */}
            {mission.status === "APPROVED" && mission.reviewed_by && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                <p className="text-sm text-green-700 font-medium">
                  Approuvé par <span className="font-bold">{mission.reviewed_by.full_name}</span>
                </p>
              </div>
            )}

            {/* Notes RH */}
            {mission.notes && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-[10px] text-blue-400 uppercase font-semibold tracking-wide mb-0.5">Notes RH</p>
                <p className="text-sm text-blue-700 whitespace-pre-wrap">{mission.notes}</p>
              </div>
            )}

            {/* Référence */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Hash size={12} />
              <span>Référence : <span className="font-semibold text-gray-500">#{mission.id}</span></span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
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

//    Carte de demande

interface MissionCardProps {
  mission: MissionRequest;
  onView: () => void;
  onCancel: () => void;
  compact?: boolean;
}

function MissionCard({ mission, onView, onCancel, compact = false }: MissionCardProps) {
  const cfg  = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.PENDING;
  const Icon = cfg.Icon;
  const jours = nbJours(mission.date_debut, mission.date_fin);
  const canCancel = mission.status === "PENDING";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onView}
      className="group relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer border-gray-100 hover:border-gray-200"
    >
      {/* Bande de couleur statut */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: cfg.color }}
      />

      <div className={`pl-5 pr-4 ${compact ? "py-2.5" : "py-4"}`}>
        <div className="flex items-center justify-between gap-3">
          {/* Infos principales */}
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 flex-wrap ${compact ? "mb-0.5" : "mb-1.5"}`}>
              <span className="font-semibold text-gray-800 text-sm truncate flex items-center gap-1.5">
                <MapPin size={13} className="text-gray-400 shrink-0" />
                {mission.destination}
              </span>
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
              <Calendar size={12} className="text-gray-400 shrink-0" />
              <span>{compact ? fmtShort(mission.date_debut) : fmt(mission.date_debut)}</span>
              <span className="text-gray-300">→</span>
              <span>{compact ? fmtShort(mission.date_fin) : fmt(mission.date_fin)}</span>
              <span className="ml-1 font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-md">
                {jours} j
              </span>
            </div>

            {!compact && (
              <>
                {/* Objet (tronqué) */}
                {mission.objet && (
                  <p className="text-xs text-gray-400 italic truncate max-w-sm mt-1">"{mission.objet}"</p>
                )}
                {/* Motif de rejet */}
                {mission.reject_reason && (
                  <div className="flex items-start gap-1.5 mt-1">
                    <XCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-500 truncate max-w-xs">{mission.reject_reason}</p>
                  </div>
                )}
                {/* Validateur */}
                {mission.reviewed_by && mission.status === "APPROVED" && (
                  <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Approuvé par {mission.reviewed_by.full_name}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Badge jours */}
            {!compact && (
              <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 rounded-xl border-2 border-gray-100 bg-gray-50 shrink-0">
                <span className="text-lg font-bold text-gray-700 leading-none">{jours}</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-wide">jours</span>
              </div>
            )}

            {/* Voir */}
            <button
              onClick={e => { e.stopPropagation(); onView(); }}
              title="Voir le détail"
              className="p-2 rounded-lg text-gray-400 hover:text-[#003c71] hover:bg-[#003c71]/8 border border-gray-100 hover:border-[#003c71]/20 transition"
            >
              <Eye size={14} />
            </button>

            {/* Annuler */}
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

//    Main page

interface EmployeeMissionsPageProps {
  layout?: React.ComponentType<{ children: React.ReactNode }>;
  selfOnly?: boolean;
}

export default function EmployeeMissionsPage({ layout: Layout = EmployeeLayout, selfOnly = false }: EmployeeMissionsPageProps) {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [missions,      setMissions]      = useState<MissionRequest[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [detailTarget,  setDetailTarget]  = useState<MissionRequest | null>(null);
  const [cancelTarget,  setCancelTarget]  = useState<MissionRequest | null>(null);
  const [cancelling,    setCancelling]    = useState(false);
  const [filterStatus,  setFilterStatus]  = useState("ALL");
  const [sortOrder,     setSortOrder]     = useState<"recent" | "oldest" | "longest">("recent");
  const [viewMode,      setViewMode]      = useState<"compact" | "detailed">("detailed");
  const [currentPage,   setCurrentPage]   = useState(1);

  const refresh = useCallback(() => {
    if (!employeeId) return;
    setLoading(true);
    missionService.list(selfOnly ? { employee_id: employeeId } : undefined)
      .then(data => setMissions(data))
      .catch(() => toast.error("Erreur lors du chargement des missions."))
      .finally(() => setLoading(false));
  }, [employeeId, selfOnly]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await missionService.delete(cancelTarget.id);
      toast.success("Demande annulée.");
      setCancelTarget(null);
      refresh();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || "Erreur lors de l'annulation.";
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  };

  const filtered = (filterStatus === "ALL" ? missions : missions.filter(m => m.status === filterStatus))
    .slice()
    .sort((a, b) => {
      if (sortOrder === "recent")  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === "oldest")  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return nbJours(b.date_debut, b.date_fin) - nbJours(a.date_debut, a.date_fin);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statsData = [
    { label: "Total",      status: "ALL",      count: missions.length,                                          dot: "bg-slate-300"  },
    { label: "En attente", status: "PENDING",  count: missions.filter(m => m.status === "PENDING").length,     dot: "bg-amber-400"  },
    { label: "Approuvées", status: "APPROVED", count: missions.filter(m => m.status === "APPROVED").length,    dot: "bg-[#003c71]"  },
    { label: "Rejetées",   status: "REJECTED", count: missions.filter(m => m.status === "REJECTED").length,    dot: "bg-slate-400"  },
  ];

  return (
    <Layout>
      <div className="px-4 md:px-6 pb-10">

        {/*    Header    */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4 flex-wrap gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Mes Missions</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gérez vos demandes de déplacement professionnel</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition shadow-sm font-medium"
            >
              <Plus size={16} />
              Nouvelle demande
            </button>
          </div>
        </motion.div>

        {/*    Stats rapides    */}
        {!loading && missions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            {statsData.map(s => {
              const active = filterStatus === s.status;
              return (
                <button
                  key={s.label}
                  onClick={() => handleFilterChange(s.status)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
                    active
                      ? "border-[#003c71] ring-2 ring-[#003c71]/20"
                      : "border-gray-200 hover:border-gray-300"
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

        {/*    Liste des demandes    */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
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
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700"
              >
                <option value="recent">Plus récentes</option>
                <option value="oldest">Plus anciennes</option>
                <option value="longest">Durée décroissante</option>
              </select>
            </div>

            {/* Filtre statut */}
            <div className="relative">
              <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={filterStatus}
                onChange={e => handleFilterChange(e.target.value)}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700"
              >
                <option value="ALL">Tous ({missions.length})</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} ({missions.filter(m => m.status === k).length})</option>
                ))}
              </select>
            </div>

            {/* Mode d'affichage */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                onClick={() => setViewMode("detailed")}
                title="Affichage détaillé"
                className={`p-1.5 rounded-md transition ${viewMode === "detailed" ? "bg-[#003c71] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode("compact")}
                title="Affichage compact"
                className={`p-1.5 rounded-md transition ${viewMode === "compact" ? "bg-[#003c71] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
              >
                <List size={13} />
              </button>
            </div>
          </div>

          {/* Chips actifs */}
          {!loading && (filterStatus !== "ALL" || sortOrder !== "recent") && (
            <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
              {filterStatus !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {STATUS_CONFIG[filterStatus]?.label ?? filterStatus}
                  <button onClick={() => handleFilterChange("ALL")} className="hover:bg-blue-100 rounded-full p-0.5 transition">
                    <X size={10} />
                  </button>
                </span>
              )}
              {sortOrder !== "recent" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                  Tri : {sortOrder === "oldest" ? "Plus anciennes" : "Durée décroissante"}
                  <button onClick={() => setSortOrder("recent")} className="hover:bg-gray-100 rounded-full p-0.5 transition">
                    <X size={10} />
                  </button>
                </span>
              )}
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
                <MapPin size={28} className="opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-500">Aucune demande trouvée</p>
              <p className="text-xs mt-1 text-gray-400">
                {filterStatus !== "ALL"
                  ? `Aucune demande pour le statut "${STATUS_CONFIG[filterStatus]?.label ?? filterStatus}"`
                  : "Créez votre première demande de mission"}
              </p>
              {filterStatus === "ALL" && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition font-medium"
                >
                  <Plus size={15} /> Nouvelle demande
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`p-4 ${viewMode === "compact" ? "space-y-1.5" : "space-y-3"}`}>
                {paginated.map(m => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    onView={() => setDetailTarget(m)}
                    onCancel={() => setCancelTarget(m)}
                    compact={viewMode === "compact"}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-gray-400">
                  Page {currentPage} / {totalPages} – {filtered.length} demande{filtered.length > 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition ${
                        page === currentPage
                          ? "bg-[#003c71] text-white shadow-sm"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/*    Modal compte non lié    */}
      {showForm && !employeeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">Compte non lié</h3>
            <p className="text-gray-500 text-sm mb-5 text-center">
              Votre compte n'est pas encore associé à un dossier employé.
              Contactez l'administrateur RH pour lier votre compte.
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition font-medium"
              >
                Compris
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/*    Modal formulaire    */}
      {showForm && employeeId && (
        <MissionFormModal
          mode="create"
          employeeId={employeeId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refresh(); }}
        />
      )}

      {/*    Modal détail    */}
      {detailTarget && (
        <MissionDetailModal
          mission={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/*    Modal confirmation annulation    */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-1">
              Annuler cette demande ?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              <span className="font-medium text-gray-700">{cancelTarget.destination}</span>
            </p>
            <p className="text-xs text-gray-400 text-center mb-5">
              {cancelTarget.date_debut} – {cancelTarget.date_fin}
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center mb-5">
              Cette action est irréversible. La demande sera supprimée.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Garder
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {cancelling && <Loader2 size={14} className="animate-spin" />}
                Confirmer l'annulation
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
