// src/components/leaves/LeaveStats.tsx
// Consomme GET /api/leaves/requests/stats/summary/  →  summary() action

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { leaveRequestService } from "@/services/leaveService";
import { ContractType, LeaveSummary } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import {
  FiInbox,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiSlash,
  FiSun,
} from "react-icons/fi";

interface Props {
  contractType?: ContractType;
}

interface StatCard {
  key:      keyof LeaveSummary;
  label:    string;
  icon:     React.ReactNode;
  color:    string;
  bg:       string;
  border:   string;
}

const CARDS: StatCard[] = [
  {
    key:    "total",
    label:  "Total demandes",
    icon:   <FiInbox       size={20} />,
    color:  "text-camublue-900",
    bg:     "bg-camublue-900/5",
    border: "border-camublue-900/20",
  },
  {
    key:    "pending",
    label:  "En attente",
    icon:   <FiClock       size={20} />,
    color:  "text-amber-600",
    bg:     "bg-amber-50",
    border: "border-amber-200",
  },
  {
    key:    "approved",
    label:  "Approuvées",
    icon:   <FiCheckCircle size={20} />,
    color:  "text-emerald-600",
    bg:     "bg-emerald-50",
    border: "border-emerald-200",
  },
  {
    key:    "rejected",
    label:  "Rejetées",
    icon:   <FiXCircle     size={20} />,
    color:  "text-red-500",
    bg:     "bg-red-50",
    border: "border-red-200",
  },
  {
    key:    "cancelled",
    label:  "Annulées",
    icon:   <FiSlash       size={20} />,
    color:  "text-slate-500",
    bg:     "bg-slate-50",
    border: "border-slate-200",
  },
  {
    key:    "total_days_approved",
    label:  "Jours approuvés",
    icon:   <FiSun         size={20} />,
    color:  "text-sky-600",
    bg:     "bg-sky-50",
    border: "border-sky-200",
  },
];

export default function LeaveStats({ contractType = "INTERNE" }: Props) {
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    // GET /api/leaves/requests/stats/summary/
    leaveRequestService.getSummary()
      .then(setSummary)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [contractType]);

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center gap-3 text-gray-400">
        <ImSpinner2 className="animate-spin" size={22} />
        <span className="text-sm">Chargement des statistiques…</span>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="py-20 text-center text-gray-400">
        <p className="text-3xl mb-2">📡</p>
        <p className="text-sm font-medium">Impossible de charger les statistiques.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {CARDS.map((card, i) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className={`rounded-2xl border p-5 flex flex-col gap-3 ${card.bg} ${card.border}`}
          >
            <div className={`${card.color}`}>{card.icon}</div>
            <div>
              <p className={`text-2xl font-bold ${card.color}`}>
                {summary[card.key]}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">{card.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Résumé textuel ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Résumé</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <span>
            <span className="font-semibold text-amber-600">{summary.pending}</span> en attente de traitement
          </span>
          <span>·</span>
          <span>
            <span className="font-semibold text-emerald-600">{summary.approved}</span> approuvée(s) pour{" "}
            <span className="font-semibold text-sky-600">{summary.total_days_approved}</span> jour(s)
          </span>
          <span>·</span>
          <span>
            <span className="font-semibold text-red-500">{summary.rejected}</span> rejetée(s)
          </span>
        </div>
      </div>
    </div>
  );
}