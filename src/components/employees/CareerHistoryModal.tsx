import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTimes, FaBriefcase, FaCalendarAlt, FaUser, FaChevronDown, FaChevronUp,
  FaArrowUp, FaExchangeAlt, FaRedo, FaSignOutAlt, FaSignInAlt, FaStar, FaLayerGroup,
} from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { Employee } from "@/types/employee";
import { getCareerHistory, CareerHistoryEntry, CareerEventType } from "@/services/employeeService";

// ── Couleurs et icônes par type d'événement ────────────────────────────────
const EVENT_CONFIG: Record<CareerEventType, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  EMBAUCHE:           { label: "Embauche",                  color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", Icon: FaBriefcase },
  PROMOTION:          { label: "Promotion",                 color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",    Icon: FaArrowUp },
  CHANGEMENT_CONTRAT: { label: "Changement de contrat",     color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200",  Icon: FaExchangeAlt },
  RENOUVELLEMENT_CDD: { label: "Renouvellement CDD",        color: "text-yellow-700",  bg: "bg-yellow-50",   border: "border-yellow-200",  Icon: FaRedo },
  CHANGEMENT_SERVICE: { label: "Changement de service",     color: "text-purple-700",  bg: "bg-purple-50",   border: "border-purple-200",  Icon: FaLayerGroup },
  TITULARISATION:     { label: "Titularisation",            color: "text-green-700",   bg: "bg-green-50",    border: "border-green-200",   Icon: FaStar },
  SORTIE:             { label: "Sortie",                    color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     Icon: FaSignOutAlt },
  REINTEGRATION:      { label: "Réintégration",             color: "text-teal-700",    bg: "bg-teal-50",     border: "border-teal-200",    Icon: FaSignInAlt },
  AUTRE:              { label: "Autre",                     color: "text-slate-700",   bg: "bg-slate-50",    border: "border-slate-200",   Icon: FaBriefcase },
};

const DOT_COLOR: Record<CareerEventType, string> = {
  EMBAUCHE:           "bg-emerald-500",
  PROMOTION:          "bg-blue-500",
  CHANGEMENT_CONTRAT: "bg-orange-500",
  RENOUVELLEMENT_CDD: "bg-yellow-500",
  CHANGEMENT_SERVICE: "bg-purple-500",
  TITULARISATION:     "bg-green-600",
  SORTIE:             "bg-red-500",
  REINTEGRATION:      "bg-teal-500",
  AUTRE:              "bg-slate-400",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function CareerEventCard({ entry, isFirst }: { entry: CareerHistoryEntry; isFirst: boolean }) {
  const [expanded, setExpanded] = useState(isFirst);
  const cfg = EVENT_CONFIG[entry.event_type] ?? EVENT_CONFIG.AUTRE;
  const { Icon } = cfg;

  const details = [
    { label: "Contrat",      value: entry.type_contrat },
    { label: "Fonction",     value: entry.fonction },
    { label: "Catégorie",    value: entry.categorie },
    { label: "Service",      value: entry.service },
    { label: "Manager",      value: entry.manager },
    { label: "Projet",       value: entry.projet },
    { label: "Business line",value: entry.business_line },
    { label: "Localisation", value: entry.localisation },
    { label: "Fin CDD",      value: entry.date_fin_cdd ? formatDate(entry.date_fin_cdd) : null },
  ].filter(d => d.value);

  return (
    <div className={`rounded-xl border ${cfg.border} bg-white shadow-sm overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${cfg.bg}`}>
            <Icon className={cfg.color} size={13} />
          </div>
          <div>
            <p className={`text-sm font-semibold ${cfg.color}`}>{entry.event_type_display}</p>
            {entry.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{entry.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <FaCalendarAlt size={10} />
            {formatDate(entry.event_date)}
          </div>
          {details.length > 0 && (
            <span className="text-slate-300">
              {expanded ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && details.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className={`border-t ${cfg.border} px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2`}>
              {details.map(({ label, value }) => (
                <div key={label} className="text-xs">
                  <span className="text-slate-400 uppercase tracking-wide text-[10px] font-medium block">{label}</span>
                  <span className="text-slate-700 font-medium">{value}</span>
                </div>
              ))}
            </div>
            {entry.created_by && (
              <div className="px-4 pb-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <FaUser size={9} />
                {entry.created_by}
                {entry.created_at && (
                  <span className="ml-1">
                    · {new Date(entry.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            )}
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
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-camublue-900/10">
                  <FaBriefcase className="text-camublue-900" size={16} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-base">
                    Parcours de carrière
                  </h2>
                  <p className="text-xs text-slate-400">
                    {employee.prenom} {employee.nom} · {employee.matricule}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
              >
                <FaTimes size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <ImSpinner2 className="animate-spin text-camublue-900" size={28} />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <FaBriefcase size={32} className="opacity-30" />
                  <p className="text-sm">Aucun événement de carrière enregistré</p>
                  <p className="text-xs text-slate-300">
                    Les modifications futures du dossier apparaîtront automatiquement ici.
                  </p>
                </div>
              ) : (
                <ol className="relative border-l-2 border-slate-100 ml-3 space-y-0">
                  {history.map((entry, idx) => (
                    <li key={String(entry.id ?? idx)} className="ml-6 pb-4">
                      {/* Timeline dot */}
                      <span
                        className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                          DOT_COLOR[entry.event_type] ?? "bg-slate-400"
                        }`}
                      />
                      <CareerEventCard entry={entry} isFirst={idx === 0} />
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 shrink-0 flex justify-between items-center">
              <span className="text-xs text-slate-400">
                {history.length} événement{history.length !== 1 ? "s" : ""} au total
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
