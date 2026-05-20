import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import AlertesPeriodeEssaiPanel from "@/components/employees/AlertesPeriodeEssaiPanel";
import { getAlertesPeriodeEssai } from "@/services/employeeService";
import type { AlertePeriodeEssai, TypeAlerte } from "@/services/employeeService";
import { RefreshCw } from "lucide-react";

// ── KpiCard (même design que /questionnaires) ─────────────────────────────────
function KpiCard({
  label, value, dot, onClick, active,
}: {
  label: string; value: number; dot: string;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
        active
          ? "border-[#003c71] ring-2 ring-[#003c71]/20 shadow-sm"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <span className="text-2xl font-bold text-[#003c71] tabular-nums">{value}</span>
      <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        {label}
      </span>
    </button>
  );
}

type ActiveFilter = "TOUS" | TypeAlerte;

export default function AlertesEmployesPage() {
  const [alertes,    setAlertes]    = useState<AlertePeriodeEssai[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre,     setFiltre]     = useState<ActiveFilter>("TOUS");

  const fetchAlertes = async () => {
    try {
      const r = await getAlertesPeriodeEssai(30);
      setAlertes(r.results);
    } catch {
      setAlertes([]);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAlertes().finally(() => setLoading(false));
  }, []);

  const total      = alertes.length;
  const countPE    = alertes.filter((a) => a.type_alerte === "PERIODE_ESSAI").length;
  const countCDD   = alertes.filter((a) => a.type_alerte === "FIN_CDD").length;
  const countStage = alertes.filter((a) => a.type_alerte === "FIN_STAGE").length;

  // Filtrage par type pour le panneau
  const filtered = filtre === "TOUS"
    ? alertes
    : alertes.filter((a) => a.type_alerte === filtre);

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-camublue-900">
              Alertes RH
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Périodes d'essai, contrats CDD &amp; fins de stage arrivant à échéance dans les 30 prochains jours
            </p>
          </div>
          <button
            onClick={async () => { setRefreshing(true); await fetchAlertes(); setRefreshing(false); }}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>

        {/* ── KPI cards (cliquables = filtre) ── */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          <KpiCard
            label="Total alertes"
            value={total}
            dot="bg-slate-400"
            active={filtre === "TOUS"}
            onClick={() => setFiltre("TOUS")}
          />
          <KpiCard
            label="Période d'essai"
            value={countPE}
            dot="bg-violet-500"
            active={filtre === "PERIODE_ESSAI"}
            onClick={() => setFiltre(filtre === "PERIODE_ESSAI" ? "TOUS" : "PERIODE_ESSAI")}
          />
          <KpiCard
            label="Fin de stage"
            value={countStage}
            dot="bg-blue-500"
            active={filtre === "FIN_STAGE"}
            onClick={() => setFiltre(filtre === "FIN_STAGE" ? "TOUS" : "FIN_STAGE")}
          />
          <KpiCard
            label="Fin CDD"
            value={countCDD}
            dot="bg-orange-400"
            active={filtre === "FIN_CDD"}
            onClick={() => setFiltre(filtre === "FIN_CDD" ? "TOUS" : "FIN_CDD")}
          />
        </div>

        {/* ── Tableau ── */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-slate-100 shadow-sm">
          <AlertesPeriodeEssaiPanel alertes={filtered} loading={loading} />
        </div>
      </motion.div>
    </AppLayout>
  );
}
