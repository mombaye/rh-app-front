import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import AlertesPeriodeEssaiPanel from "@/components/employees/AlertesPeriodeEssaiPanel";
import { getAlertesPeriodeEssai } from "@/services/employeeService";
import type { AlertePeriodeEssai } from "@/services/employeeService";
import { RefreshCw } from "lucide-react";

export default function AlertesEmployesPage() {
  const [alertes,     setAlertes]     = useState<AlertePeriodeEssai[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAlertes();
    setRefreshing(false);
  };

  const urgents = alertes.filter((a) => a.jours_restants <= 7);

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-camublue-900">
              Alertes — Période d'essai
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Employés dont la période d'essai expire dans les 30 prochains jours
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && alertes.length > 0 && (
              <div className="flex items-center gap-2">
                {urgents.length > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    {urgents.length} urgent{urgents.length > 1 ? "s" : ""}
                  </span>
                )}
                <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {alertes.length} employé{alertes.length > 1 ? "s" : ""}
                </span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </div>

        {/* ── Contenu ── */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-slate-100 shadow-sm">
          <AlertesPeriodeEssaiPanel alertes={alertes} loading={loading} />
        </div>
      </motion.div>
    </AppLayout>
  );
}
