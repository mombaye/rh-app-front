import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, ArrowRight } from "lucide-react";
import { FaHourglass, FaFileContract, FaBell } from "react-icons/fa";
import { useAlertes } from "@/contexts/AlertesContext";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function DashboardAlertesBar() {
  const navigate = useNavigate();
  const { alertes, loading } = useAlertes();
  const [expanded, setExpanded] = useState(false);

  if (loading || alertes.length === 0) return null;

  const urgents  = alertes.filter((a) => a.jours_restants <= 7);
  const proches  = alertes.filter((a) => a.jours_restants > 7 && a.jours_restants <= 15);
  const preview  = alertes.slice(0, 5);
  const hasMore  = alertes.length > 5;
  const hasUrgents = urgents.length > 0;

  return (
    <div className={`shrink-0 border-t-2 shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.1)] ${
      hasUrgents ? "border-red-400" : "border-amber-400"
    } bg-white`}>

      {/* ── Barre de résumé (toujours visible) ── */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 px-5 md:px-6 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        {/* Icône + badge urgents */}
        <div className={`relative p-2.5 rounded-xl shrink-0 ${hasUrgents ? "bg-red-100" : "bg-amber-100"}`}>
          <FaBell className={hasUrgents ? "text-red-600" : "text-amber-600"} size={18} />
          {urgents.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {urgents.length}
            </span>
          )}
        </div>

        {/* Texte principal */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">
            {hasUrgents
              ? `⚠️ ${urgents.length} alerte${urgents.length > 1 ? "s" : ""} urgente${urgents.length > 1 ? "s" : ""}`
              : "Alertes RH — 30 prochains jours"
            }
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {[
              urgents.length  > 0 && `${urgents.length} urgent${urgents.length > 1 ? "s" : ""} (≤ 7j)`,
              proches.length  > 0 && `${proches.length} proche${proches.length > 1 ? "s" : ""} (8–15j)`,
              alertes.filter(a => a.type_alerte === "PERIODE_ESSAI").length > 0 &&
                `${alertes.filter(a => a.type_alerte === "PERIODE_ESSAI").length} période${alertes.filter(a => a.type_alerte === "PERIODE_ESSAI").length > 1 ? "s" : ""} d'essai`,
              alertes.filter(a => a.type_alerte === "FIN_CDD").length > 0 &&
                `${alertes.filter(a => a.type_alerte === "FIN_CDD").length} fin${alertes.filter(a => a.type_alerte === "FIN_CDD").length > 1 ? "s" : ""} CDD`,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>

        {/* Chips + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {urgents.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {urgents.length} urgent{urgents.length > 1 ? "s" : ""}
            </span>
          )}
          <span className="hidden sm:inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full">
            {alertes.length} au total
          </span>
          <div className="text-slate-400 ml-1">
            {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>
        </div>
      </button>

      {/* ── Panneau déplié ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="px-5 md:px-6 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {preview.map((a) => {
                const isUrgent = a.jours_restants <= 7;
                const isProche = a.jours_restants > 7 && a.jours_restants <= 15;
                return (
                  <button
                    key={`${a.id}-${a.type_alerte}`}
                    onClick={() => navigate("/employees/alertes")}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-left group"
                  >
                    {/* Icône type */}
                    <div className={`p-2 rounded-lg shrink-0 ${
                      a.type_alerte === "PERIODE_ESSAI" ? "bg-violet-100" : "bg-orange-100"
                    }`}>
                      {a.type_alerte === "PERIODE_ESSAI"
                        ? <FaHourglass className="text-violet-600" size={13} />
                        : <FaFileContract className="text-orange-600" size={13} />
                      }
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {a.prenom} {a.nom}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {a.type_alerte === "PERIODE_ESSAI" ? "Période d'essai" : "Fin CDD"}
                        {" · "}{fmtDate(a.date_fin)}
                      </p>
                    </div>

                    {/* Badge jours */}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isUrgent ? "bg-red-100 text-red-700" :
                      isProche ? "bg-amber-100 text-amber-700" :
                                 "bg-green-100 text-green-700"
                    }`}>
                      {a.jours_restants}j
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Lien voir tout */}
            <div className="px-5 md:px-6 pb-4 flex justify-center">
              <button
                onClick={() => navigate("/employees/alertes")}
                className="flex items-center gap-2 text-sm font-semibold text-camublue-900 hover:underline transition"
              >
                {hasMore ? `Voir les ${alertes.length} alertes` : "Voir toutes les alertes"}
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
