import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Clock, XCircle, Loader2,
  ChevronLeft, ChevronRight, Filter, X,
  Calendar, User, Hash, MessageSquare, MapPin,
  Eye, ArrowUpDown, LayoutGrid, List, Search,
  ThumbsUp, ThumbsDown,
} from "lucide-react";
import AppLayout from "@/layouts/AppLayout";
import { useAuth } from "@/contexts/useAuth";
import { missionService, MissionRequest } from "@/services/missionService";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;

// ���� Helpers ��������������������������������������������������������������������������������������������������������������������������������������

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function fmt(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}
function fmtShort(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}
function nbJours(d1: string, d2: string) {
  return Math.round((new Date(d2 + "T12:00:00").getTime() - new Date(d1 + "T12:00:00").getTime()) / 86400000) + 1;
}

// ���� Status config ��������������������������������������������������������������������������������������������������������������������������

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string; dot: string;
  Icon: React.ElementType; textColor: string; borderColor: string;
}> = {
  PENDING:  { label: "En attente", color: "#d97706", bg: "#fffbeb", dot: "bg-amber-400",  Icon: Clock,        textColor: "text-amber-700",  borderColor: "border-amber-200"  },
  APPROVED: { label: "Approuvé",   color: "#059669", bg: "#f0fdf4", dot: "bg-green-500",  Icon: CheckCircle2, textColor: "text-green-700",  borderColor: "border-green-200"  },
  REJECTED: { label: "Rejeté",     color: "#dc2626", bg: "#fef2f2", dot: "bg-red-500",    Icon: XCircle,      textColor: "text-red-700",    borderColor: "border-red-200"    },
};

// ���� Modal détail ����������������������������������������������������������������������������������������������������������������������������

// Stepper étape par étape

function MissionStepper({ mission }: { mission: MissionRequest }) {
  const steps = [
    {
      label: "Demande soumise",
      desc: fmt(mission.created_at.slice(0, 10)),
      done: true,
      active: false,
      rejected: false,
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
              <div className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                   style={{ backgroundColor: bgColor, border: `2px solid ${color}` }}>
                {icon}
              </div>
              {!isLast && <div className="flex-1 h-0.5" style={{ backgroundColor: step.done ? "#059669" : "#e5e7eb" }} />}
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

interface DetailModalProps {
  mission: MissionRequest;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  currentEmployeeId: number | null;
}

function DetailModal({ mission, onClose, onApprove, onReject, currentEmployeeId }: DetailModalProps) {
  const cfg  = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.PENDING;
  const Icon = cfg.Icon;
  const jours = nbJours(mission.date_debut, mission.date_fin);

  const fields: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: User,     label: "Employé",     value: mission.employee.full_name       },
    { icon: Hash,     label: "Matricule",   value: mission.employee.matricule       },
    { icon: MapPin,   label: "Destination", value: mission.destination              },
    { icon: Calendar, label: "Date début",  value: fmt(mission.date_debut)          },
    { icon: Calendar, label: "Date fin",    value: fmt(mission.date_fin)            },
    { icon: Clock,    label: "Durée",       value: `${jours} jour${jours > 1 ? "s" : ""}` },
    { icon: Calendar, label: "Soumis le",   value: fmt(mission.created_at.slice(0,10)) },
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
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-0.5">Demande de mission</p>
                <h2 className="text-white font-bold text-lg leading-tight">{mission.employee.full_name}</h2>
                <p className="text-white/80 text-xs">{mission.employee.matricule}{mission.employee.service ? ` · ${mission.employee.service}` : ""}</p>
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

            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Hash size={12} />
              <span>Référence : <span className="font-semibold text-gray-500">#{mission.id}</span></span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
            >
              Fermer
            </button>
            {mission.status === "PENDING" && mission.employee.n1_manager_id === currentEmployeeId && (
              <>
                <button
                  onClick={() => { onClose(); onReject(); }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ThumbsDown size={14} /> Rejeter
                </button>
                <button
                  onClick={() => { onClose(); onApprove(); }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ThumbsUp size={14} /> Approuver
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ���� Modal décision (approbation / rejet) ����������������������������������������������������������������������������

interface DecisionModalProps {
  mission: MissionRequest;
  type: "approve" | "reject";
  onClose: () => void;
  onDone: () => void;
}

function DecisionModal({ mission, type, onClose, onDone }: DecisionModalProps) {
  const [text,    setText]    = useState("");
  const [loading, setLoading] = useState(false);
  const isApprove = type === "approve";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (isApprove) {
        await missionService.approve(mission.id, text);
        toast.success("Demande approuvée !");
      } else {
        await missionService.reject(mission.id, text);
        toast.success("Demande rejetée.");
      }
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur lors du traitement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className={`px-6 py-5 ${isApprove ? "bg-gradient-to-r from-emerald-600 to-green-500" : "bg-gradient-to-r from-red-600 to-red-500"}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              {isApprove ? <ThumbsUp size={20} className="text-white" /> : <ThumbsDown size={20} className="text-white" />}
            </div>
            <div>
              <h3 className="text-white font-bold text-base">
                {isApprove ? "Approuver la mission" : "Rejeter la mission"}
              </h3>
              <p className="text-white/70 text-xs">{mission.employee.full_name} � {mission.destination}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isApprove ? "Notes (optionnel)" : "Motif du rejet (optionnel)"}
            </label>
            <textarea
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={isApprove ? "Ajouter une note⬦" : "Expliquer le motif du rejet⬦"}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-gray-50 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium transition"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-[2] px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm ${
                isApprove ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {isApprove ? "Confirmer l'approbation" : "Confirmer le rejet"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ���� Carte mission ��������������������������������������������������������������������������������������������������������������������������

interface MissionCardProps {
  mission: MissionRequest;
  compact?: boolean;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  currentEmployeeId: number | null;
}

function MissionCard({ mission, compact = false, onView, onApprove, onReject, currentEmployeeId }: MissionCardProps) {
  const cfg   = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.PENDING;
  const Icon  = cfg.Icon;
  const jours = nbJours(mission.date_debut, mission.date_fin);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onView}
      className="group relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer border-gray-100 hover:border-gray-200"
    >
      {/* Bande colorée statut */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: cfg.color }} />

      <div className={`pl-5 pr-4 ${compact ? "py-2.5" : "py-4"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">

            {/* Employé + statut */}
            <div className={`flex items-center gap-2 flex-wrap ${compact ? "mb-0.5" : "mb-1.5"}`}>
              <div className="w-6 h-6 rounded-full bg-[#003c71]/10 flex items-center justify-center shrink-0">
                <User size={12} className="text-[#003c71]" />
              </div>
              <span className="font-semibold text-gray-800 text-sm">{mission.employee.full_name}</span>
              <span className="text-xs text-gray-400">{mission.employee.matricule}</span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.textColor} ${cfg.borderColor}`}
                style={{ backgroundColor: cfg.bg }}
              >
                <Icon size={10} />
                {cfg.label}
              </span>
            </div>

            {/* Destination */}
            <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium mb-1">
              <MapPin size={12} className="text-gray-400 shrink-0" />
              {mission.destination}
            </div>

            {/* Période */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar size={11} className="text-gray-400 shrink-0" />
              <span>{compact ? fmtShort(mission.date_debut) : fmt(mission.date_debut)}</span>
              <span className="text-gray-300">� </span>
              <span>{compact ? fmtShort(mission.date_fin) : fmt(mission.date_fin)}</span>
              <span className="ml-1 font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-md">{jours} j</span>
            </div>

            {!compact && (
              <>
                {mission.objet && (
                  <p className="text-xs text-gray-400 italic truncate max-w-sm mt-1">"{mission.objet}"</p>
                )}
                {mission.reject_reason && (
                  <div className="flex items-start gap-1.5 mt-1">
                    <XCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-500 truncate max-w-xs">{mission.reject_reason}</p>
                  </div>
                )}
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

            <button
              onClick={e => { e.stopPropagation(); onView(); }}
              title="Voir le détail"
              className="p-2 rounded-lg text-gray-400 hover:text-[#003c71] hover:bg-[#003c71]/8 border border-gray-100 hover:border-[#003c71]/20 transition"
            >
              <Eye size={14} />
            </button>

            {mission.status === "PENDING" && mission.employee.n1_manager_id === currentEmployeeId && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onReject(); }}
                  title="Rejeter"
                  className={`flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition font-medium border border-red-200 hover:border-red-400 ${compact ? "p-2" : "px-3 py-1.5"}`}
                >
                  <ThumbsDown size={12} />
                  {!compact && <span className="hidden sm:inline">Rejeter</span>}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onApprove(); }}
                  title="Approuver"
                  className={`flex items-center gap-1.5 text-xs text-emerald-700 hover:bg-emerald-50 rounded-lg transition font-medium border border-emerald-200 hover:border-emerald-400 ${compact ? "p-2" : "px-3 py-1.5"}`}
                >
                  <ThumbsUp size={12} />
                  {!compact && <span className="hidden sm:inline">Approuver</span>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ���� Page principale ����������������������������������������������������������������������������������������������������������������������

export default function RhMissionsPage() {
  const { user } = useAuth();
  const currentEmployeeId = user?.employee_id ?? null;
  const [missions,     setMissions]     = useState<MissionRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [search,       setSearch]       = useState("");
  const [sortOrder,    setSortOrder]    = useState<"recent" | "oldest" | "longest">("recent");
  const [viewMode,     setViewMode]     = useState<"compact" | "detailed">("detailed");
  const [currentPage,  setCurrentPage]  = useState(1);
  const [detailTarget, setDetailTarget] = useState<MissionRequest | null>(null);
  const [decision,     setDecision]     = useState<{ mission: MissionRequest; type: "approve" | "reject" } | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    missionService.list()
      .then(data => setMissions(data))
      .catch(() => toast.error("Impossible de charger les demandes."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const q = search.trim().toLowerCase();
  const filtered = (filterStatus === "ALL" ? missions : missions.filter(m => m.status === filterStatus))
    .filter(m =>
      !q || [m.employee.full_name, m.employee.matricule, m.employee.service, m.destination, m.objet]
        .some(v => v?.toLowerCase().includes(q))
    )
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
    { label: "Approuvées", status: "APPROVED", count: missions.filter(m => m.status === "APPROVED").length,    dot: "bg-[#003c71]" },
    { label: "Rejetées",   status: "REJECTED", count: missions.filter(m => m.status === "REJECTED").length,    dot: "bg-slate-400"  },
  ];

  return (
    <AppLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* ���� Header ���� */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Demandes de mission</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gérez les demandes de déplacement professionnel</p>
          </div>
        </motion.div>

        {/* ���� Stats ���� */}
        {!loading && missions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            {statsData.map(s => {
              const active = filterStatus === s.status;
              return (
                <button
                  key={s.label}
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

        {/* ���� Barre de recherche ���� */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="relative mb-4"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Rechercher par nom, matricule, destination, objet⬦"
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-2xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20 focus:border-[#003c71]/40 transition shadow-sm"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setCurrentPage(1); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              <X size={15} />
            </button>
          )}
        </motion.div>

        {/* ���� Liste ���� */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
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
                onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700"
              >
                <option value="ALL">Tous ({missions.length})</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} ({missions.filter(m => m.status === k).length})</option>
                ))}
              </select>
            </div>

            {/* Mode affichage */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              <button
                onClick={() => setViewMode("detailed")}
                title="Détaillé"
                className={`p-1.5 rounded-md transition ${viewMode === "detailed" ? "bg-[#003c71] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setViewMode("compact")}
                title="Compact"
                className={`p-1.5 rounded-md transition ${viewMode === "compact" ? "bg-[#003c71] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
              >
                <List size={13} />
              </button>
            </div>
          </div>

          {/* Chips filtres actifs */}
          {!loading && (filterStatus !== "ALL" || search) && (
            <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
              {filterStatus !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {STATUS_CONFIG[filterStatus]?.label ?? filterStatus}
                  <button onClick={() => { setFilterStatus("ALL"); setCurrentPage(1); }} className="hover:bg-blue-100 rounded-full p-0.5 transition">
                    <X size={10} />
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                  "{search}"
                  <button onClick={() => { setSearch(""); setCurrentPage(1); }} className="hover:bg-gray-100 rounded-full p-0.5 transition">
                    <X size={10} />
                  </button>
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
                <MapPin size={28} className="opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-500">Aucune demande trouvée</p>
              <p className="text-xs mt-1 text-gray-400">
                {filterStatus !== "ALL" || search
                  ? "Aucune demande pour ces critères"
                  : "Aucune demande de mission enregistrée"}
              </p>
            </div>
          ) : (
            <>
              <div className={`p-4 ${viewMode === "compact" ? "space-y-1.5" : "space-y-3"}`}>
                {paginated.map(m => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    compact={viewMode === "compact"}
                    onView={() => setDetailTarget(m)}
                    onApprove={() => setDecision({ mission: m, type: "approve" })}
                    onReject={()  => setDecision({ mission: m, type: "reject"  })}
                    currentEmployeeId={currentEmployeeId}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-gray-400">
                  Page {currentPage} / {totalPages} · {filtered.length} demande{filtered.length > 1 ? "s" : ""}
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

      {/* ���� Modals ���� */}
      {detailTarget && (
        <DetailModal
          mission={detailTarget}
          onClose={() => setDetailTarget(null)}
          onApprove={() => { setDetailTarget(null); setDecision({ mission: detailTarget, type: "approve" }); }}
          onReject={()  => { setDetailTarget(null); setDecision({ mission: detailTarget, type: "reject"  }); }}
          currentEmployeeId={currentEmployeeId}
        />
      )}
      {decision && (
        <DecisionModal
          mission={decision.mission}
          type={decision.type}
          onClose={() => setDecision(null)}
          onDone={() => { setDecision(null); refresh(); }}
        />
      )}
    </AppLayout>
  );
}

