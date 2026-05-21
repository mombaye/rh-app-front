import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import AlertesPeriodeEssaiPanel from "@/components/employees/AlertesPeriodeEssaiPanel";
import { getAlertesPeriodeEssai } from "@/services/employeeService";
import type { AlertePeriodeEssai, TypeAlerte } from "@/services/employeeService";
import { RefreshCw } from "lucide-react";

// ── KpiCard ───────────────────────────────────────────────────────────────────
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

type ActiveFilter  = "TOUS" | TypeAlerte;
type PopFilter     = "TOUS" | "INTERNES" | "INTERIMAIRES";

const POP_TABS: { key: PopFilter; label: string }[] = [
  { key: "TOUS",        label: "Tous" },
  { key: "INTERNES",    label: "Internes" },
  { key: "INTERIMAIRES",label: "Intérimaires" },
];

export default function AlertesEmployesPage() {
  const [alertes,    setAlertes]    = useState<AlertePeriodeEssai[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre,     setFiltre]     = useState<ActiveFilter>("TOUS");
  const [popFiltre,  setPopFiltre]  = useState<PopFilter>("TOUS");

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

  // Réinitialiser le filtre de type quand on change de population
  const handlePopFiltre = (p: PopFilter) => {
    setPopFiltre(p);
    setFiltre("TOUS");
  };

  // Filtrage par population
  const byPop = popFiltre === "INTERNES"
    ? alertes.filter((a) => a.type_contrat !== "INTERIM")
    : popFiltre === "INTERIMAIRES"
    ? alertes.filter((a) => a.type_contrat === "INTERIM")
    : alertes;

  // KPI sur la population filtrée
  const total        = byPop.length;
  const countPE      = byPop.filter((a) => a.type_alerte === "PERIODE_ESSAI").length;
  const countCDD     = byPop.filter((a) => a.type_alerte === "FIN_CDD").length;
  const countStage   = byPop.filter((a) => a.type_alerte === "FIN_STAGE").length;
  const countInterim = byPop.filter((a) => a.type_alerte === "FIN_INTERIM").length;

  // Filtrage par type d'alerte
  const filtered = filtre === "TOUS"
    ? byPop
    : byPop.filter((a) => a.type_alerte === filtre);

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
              Périodes d'essai, CDD, stages &amp; intérimaires arrivant à échéance dans les 30 prochains jours
            </p>
          </div>

          {/* Filtre population + Actualiser */}
          <div className="flex items-center gap-2">
            {/* Tabs Internes / Intérimaires */}
            <div className="flex items-center gap-1 bg-camublue-900/8 rounded-xl p-1">
              {POP_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handlePopFiltre(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    popFiltre === tab.key
                      ? "bg-camublue-900 text-white shadow-sm"
                      : "text-camublue-900/70 hover:text-camublue-900 hover:bg-camublue-900/10"
                  }`}
                >
                  {tab.label}
                  {tab.key !== "TOUS" && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      popFiltre === tab.key
                        ? "bg-white/20 text-white"
                        : "bg-camublue-900/10 text-camublue-900"
                    }`}>
                      {tab.key === "INTERNES"
                        ? alertes.filter((a) => a.type_contrat !== "INTERIM").length
                        : alertes.filter((a) => a.type_contrat === "INTERIM").length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Actualiser */}
            <button
              onClick={async () => { setRefreshing(true); await fetchAlertes(); setRefreshing(false); }}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </div>

        {/* ── KPI cards (cliquables = filtre type) ── */}
        <div className={`grid gap-3 shrink-0 ${
          popFiltre === "INTERIMAIRES" ? "grid-cols-2" :
          popFiltre === "INTERNES"     ? "grid-cols-4" :
                                         "grid-cols-5"
        }`}>
          <KpiCard
            label="Total alertes"
            value={total}
            dot="bg-slate-400"
            active={filtre === "TOUS"}
            onClick={() => setFiltre("TOUS")}
          />
          {popFiltre !== "INTERIMAIRES" && (
            <>
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
            </>
          )}
          {popFiltre !== "INTERNES" && (
            <KpiCard
              label="Fin intérim"
              value={countInterim}
              dot="bg-yellow-500"
              active={filtre === "FIN_INTERIM"}
              onClick={() => setFiltre(filtre === "FIN_INTERIM" ? "TOUS" : "FIN_INTERIM")}
            />
          )}
        </div>

        {/* ── Tableau ── */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-slate-100 shadow-sm">
          <AlertesPeriodeEssaiPanel alertes={filtered} loading={loading} />
        </div>
      </motion.div>
    </AppLayout>
  );
}
