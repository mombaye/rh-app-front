import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import AlertesPeriodeEssaiPanel from "@/components/employees/AlertesPeriodeEssaiPanel";
import { getAlertesPeriodeEssai } from "@/services/employeeService";
import type { AlertePeriodeEssai, TypeAlerte } from "@/services/employeeService";
import { RefreshCw, FileSpreadsheet, X } from "lucide-react";
import * as XLSX from "xlsx-js-style";

// ── Export XLSX ──────────────────────────────────────────────────────────────
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function exportXLSX(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const keys = Object.keys(rows[0]);
  ws["!cols"] = keys.map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 3,
  }));
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };

  // En-têtes en bleu (#003c71) avec texte blanc en gras
  keys.forEach((_, idx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
    const cell = ws[cellRef];
    if (cell) {
      cell.s = {
        fill: { fgColor: { rgb: "003C71" } },
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { vertical: "center", horizontal: "left" },
      };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, "Alertes");
  XLSX.writeFile(wb, `${filename}_${isoToday()}.xlsx`);
}

const TYPE_ALERTE_LABELS: Record<TypeAlerte, string> = {
  PERIODE_ESSAI: "Période d'essai",
  FIN_STAGE:     "Fin de stage",
  FIN_CDD:       "Fin CDD",
  FIN_INTERIM:   "Fin intérim",
};

const ALERTES_COLS = ["Matricule","Nom","Prénom","Service","Localisation","Type contrat","Type alerte","Date fin","Jours restants"] as const;
type AlerteCol = typeof ALERTES_COLS[number];

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
  const [serviceFiltre,  setServiceFiltre]  = useState<string>("TOUS");
  const [showExportDlg,  setShowExportDlg]  = useState(false);
  const [exportCols,     setExportCols]     = useState<AlerteCol[]>([...ALERTES_COLS]);

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

  // Liste des services disponibles (sur la population filtrée)
  const services = Array.from(
    new Set(byPop.map((a) => (a.service || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Filtrage par type d'alerte
  const byType = filtre === "TOUS"
    ? byPop
    : byPop.filter((a) => a.type_alerte === filtre);

  // Filtrage par service
  const filtered = serviceFiltre === "TOUS"
    ? byType
    : byType.filter((a) => (a.service || "").trim() === serviceFiltre);

  // Export Excel
  const doExport = () => {
    const ALL: Record<AlerteCol, (a: AlertePeriodeEssai) => any> = {
      "Matricule":      (a) => a.matricule,
      "Nom":            (a) => a.nom,
      "Prénom":         (a) => a.prenom,
      "Service":        (a) => a.service || "",
      "Localisation":   (a) => a.localisation || "",
      "Type contrat":   (a) => a.type_contrat || "",
      "Type alerte":    (a) => TYPE_ALERTE_LABELS[a.type_alerte] || a.type_alerte,
      "Date fin":       (a) => a.date_fin,
      "Jours restants": (a) => a.jours_restants,
    };
    exportXLSX("alertes_rh",
      filtered.map((a) => Object.fromEntries(exportCols.map((k) => [k, ALL[k](a)])))
    );
    setShowExportDlg(false);
  };

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

            {/* Exporter */}
            <button
              onClick={() => setShowExportDlg(true)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 bg-camublue-900 text-white px-3 py-2 rounded-xl text-xs font-semibold hover:bg-camublue-800 transition shadow-sm disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exporter</span>
            </button>

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
          <AlertesPeriodeEssaiPanel
            alertes={filtered}
            loading={loading}
            services={services}
            serviceFiltre={serviceFiltre}
            onServiceFiltreChange={setServiceFiltre}
          />
        </div>

        {/* ── Export Dialog ── */}
        <AnimatePresence>
          {showExportDlg && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
              onClick={() => setShowExportDlg(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div>
                    <h2 className="font-black text-camublue-900 text-base">Export personnalisé</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {filtered.length} alerte{filtered.length > 1 ? "s" : ""} · Sélectionnez les colonnes à inclure
                    </p>
                  </div>
                  <button onClick={() => setShowExportDlg(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-semibold text-slate-500">
                      {exportCols.length}/{ALERTES_COLS.length} colonnes sélectionnées
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setExportCols([...ALERTES_COLS])}
                        className="text-xs text-camublue-700 hover:underline font-medium">Tout</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={() => setExportCols([])}
                        className="text-xs text-slate-500 hover:underline font-medium">Aucun</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {ALERTES_COLS.map((col) => {
                      const checked = exportCols.includes(col);
                      return (
                        <label key={col}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border transition text-sm ${
                            checked ? "bg-camublue-50 border-camublue-200 text-camublue-800" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <input type="checkbox" checked={checked} onChange={() => {
                            setExportCols((prev) =>
                              checked ? prev.filter((k) => k !== col) : [...prev, col]
                            );
                          }} className="accent-camublue-700 w-3.5 h-3.5" />
                          <span className="font-medium">{col}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <button onClick={() => setShowExportDlg(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">
                    Annuler
                  </button>
                  <button onClick={doExport} disabled={exportCols.length === 0}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-bold hover:bg-camublue-800 disabled:opacity-50 transition">
                    <FileSpreadsheet className="h-4 w-4" />
                    Télécharger
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
}
