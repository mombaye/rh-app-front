import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTimes, FaBriefcase, FaChevronDown,
  FaArrowUp, FaExchangeAlt, FaRedo, FaSignOutAlt, FaSignInAlt, FaStar, FaLayerGroup,
  FaIdCard,
} from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { Employee } from "@/types/employee";
import { getCareerHistory, CareerHistoryEntry, CareerEventType } from "@/services/employeeService";

const EVENT_CONFIG: Record<CareerEventType, { label: string; dot: string; iconColor: string; Icon: any }> = {
  EMBAUCHE:           { label: "Embauche",               dot: "bg-emerald-500", iconColor: "text-emerald-600", Icon: FaBriefcase },
  PROMOTION:          { label: "Promotion",              dot: "bg-blue-500",    iconColor: "text-blue-600",    Icon: FaArrowUp },
  CHANGEMENT_CONTRAT: { label: "Changement de contrat",  dot: "bg-orange-500",  iconColor: "text-orange-600",  Icon: FaExchangeAlt },
  RENOUVELLEMENT_CDD:   { label: "Renouvellement CDD",    dot: "bg-yellow-500",  iconColor: "text-yellow-600",  Icon: FaRedo        },
  RENOUVELLEMENT_STAGE: { label: "Renouvellement stage",  dot: "bg-cyan-500",    iconColor: "text-cyan-600",    Icon: FaRedo        },
  CHANGEMENT_SERVICE:   { label: "Changement de service", dot: "bg-purple-500",  iconColor: "text-purple-600",  Icon: FaLayerGroup  },
  TITULARISATION:       { label: "Titularisation",        dot: "bg-green-600",   iconColor: "text-green-700",   Icon: FaStar        },
  STAGE_VERS_INTERIM:   { label: "Stage → Intérim",       dot: "bg-amber-500",   iconColor: "text-amber-600",   Icon: FaExchangeAlt },
  SORTIE:               { label: "Sortie",                dot: "bg-red-500",     iconColor: "text-red-600",     Icon: FaSignOutAlt  },
  REINTEGRATION:        { label: "Réintégration",         dot: "bg-teal-500",    iconColor: "text-teal-600",    Icon: FaSignInAlt   },
  AUTRE:                { label: "Autre",                 dot: "bg-slate-400",   iconColor: "text-slate-500",   Icon: FaBriefcase   },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const DETAIL_FIELDS: { key: keyof CareerHistoryEntry; label: string }[] = [
  { key: "type_contrat",  label: "Contrat" },
  { key: "fonction",      label: "Fonction" },
  { key: "categorie",     label: "Catégorie" },
  { key: "service",       label: "Service" },
  { key: "manager",       label: "Manager" },
  { key: "projet",        label: "Projet" },
  { key: "business_line", label: "Business line" },
  { key: "localisation",  label: "Localisation" },
  { key: "date_fin_cdd",  label: "Fin CDD" },
];

function EventRow({ entry }: { entry: CareerHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const cfg = EVENT_CONFIG[entry.event_type] ?? EVENT_CONFIG.AUTRE;
  const { Icon } = cfg;

  const details = DETAIL_FIELDS
    .map(f => ({
      label: f.label,
      value: f.key === "date_fin_cdd"
        ? (entry.date_fin_cdd ? formatDate(entry.date_fin_cdd) : null)
        : (entry[f.key] as string | null),
    }))
    .filter(d => d.value);

  // Un événement est cliquable dès qu'il a du contenu à afficher
  const hasDetails = details.length > 0 || !!entry.description || !!entry.matricule;

  // Style du badge matricule selon le type d'événement
  const matriculeCfg: Record<string, { bg: string; text: string; border: string; label: string }> = {
    EMBAUCHE:           { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Matricule d'embauche" },
    CHANGEMENT_CONTRAT: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  label: "Matricule" },
    TITULARISATION:     { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    label: "Nouveau matricule" },
    PROMOTION:          { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    label: "Matricule" },
    REINTEGRATION:      { bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200",    label: "Matricule" },
  };
  const matStyle = matriculeCfg[entry.event_type] ?? { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", label: "Matricule" };

  return (
    <div className="relative">
      {/* Dot on timeline */}
      <span className={`absolute -left-[22px] top-[14px] w-3 h-3 rounded-full ring-2 ring-white ${cfg.dot}`} />

      {/* Row */}
      <button
        type="button"
        disabled={!hasDetails}
        onClick={() => hasDetails && setOpen(p => !p)}
        className={`w-full flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors text-left ${
          hasDetails ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={`shrink-0 ${cfg.iconColor}`} size={13} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-slate-700 truncate">{cfg.label}</span>
            {/* Badge matricule — visible directement dans la ligne pour tous les événements */}
            {entry.matricule && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 w-fit border ${matStyle.bg} ${matStyle.text} ${matStyle.border}`}>
                <FaIdCard size={8} />
                {entry.matricule}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-xs text-slate-400">{formatDate(entry.event_date)}</span>
          {hasDetails && (
            <FaChevronDown
              size={10}
              className={`text-slate-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </button>

      {/* Details panel */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-3 bg-slate-50 rounded-lg border border-slate-100 px-4 py-3 space-y-2">

              {/* ── Matricule — toujours en tête du panneau ── */}
              {entry.matricule && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${matStyle.bg} ${matStyle.text} ${matStyle.border}`}>
                  <FaIdCard size={11} />
                  <span className="font-medium">{matStyle.label} :</span>
                  <span className="font-bold tracking-wide">{entry.matricule}</span>
                </div>
              )}

              {/* ── Description ── */}
              {entry.description && (
                <p className="text-xs text-slate-600 italic border-b border-slate-100 pb-2">
                  {entry.description}
                </p>
              )}

              {/* ── Champs carrière ── */}
              {details.length > 0 && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {details.map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</p>
                      <p className="text-xs text-slate-700 font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Props {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
}

export default function CareerHistoryModal({ open, employee, onClose }: Props) {
  const [history, setHistory] = useState<CareerHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    setHistory([]);
    setLoading(true);
    getCareerHistory(employee.id)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [open, employee]);

  if (!open || !employee) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-camublue-900/10">
                  <FaBriefcase className="text-camublue-900" size={15} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-sm">Parcours de carrière</h2>
                  <p className="text-xs text-slate-400">
                    {employee.prenom} {employee.nom} · {employee.matricule}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
              >
                <FaTimes size={13} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <ImSpinner2 className="animate-spin text-camublue-900" size={24} />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <FaBriefcase size={28} className="opacity-20" />
                  <p className="text-sm">Aucun événement enregistré</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-100 ml-3 space-y-0.5">
                  {history.map((entry, idx) => (
                    <EventRow key={String(entry.id ?? idx)} entry={entry} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {!loading && history.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 shrink-0 flex justify-between items-center">
                <span className="text-xs text-slate-400">
                  {history.length} événement{history.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
                >
                  Fermer
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
