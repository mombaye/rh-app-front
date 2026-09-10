import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, TableProperties, Users, Clock, TrendingUp, Lock, LockOpen, RefreshCw, FileDown, Banknote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/api/axios";
import toast from "react-hot-toast";
import AppLayout from "@/layouts/AppLayout";
// @ts-ignore — xlsx-js-style n'a pas de types TS mais l'API est identique à xlsx
import XLSXStyle from "xlsx-js-style";

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

type DayCode = "X" | "Y" | "Z" | "C" | "A" | "M" | "";

const CODE_META: Record<DayCode, { bg: string; text: string; label: string }> = {
  "":  { bg: "bg-gray-100",    text: "text-gray-300",    label: "—"  },
  X:   { bg: "bg-emerald-100", text: "text-emerald-700", label: "X"  },
  Y:   { bg: "bg-amber-100",   text: "text-amber-700",   label: "Y"  },
  Z:   { bg: "bg-purple-100",  text: "text-purple-700",  label: "Z"  },
  C:   { bg: "bg-sky-100",     text: "text-sky-700",     label: "C"  },
  A:   { bg: "bg-orange-100",  text: "text-orange-700",  label: "A"  },
  M:   { bg: "bg-rose-100",    text: "text-rose-700",    label: "M"  },
};

interface OmRow {
  employee_id: number;
  matricule: string;
  nom: string;
  prenom: string;
  service: string;
  qualification: string;
  manager: string;
  zone: string;
  n1_manager_name: string;
  daily_codes: Record<string, DayCode>;
  days_in_month: number;
  commentaires: string;
  submitted_at: string | null;
  jours_travailles: number;
  nb_heures_sup: number;
  nb_jours_astreintes: number;
  jours_normaux: number;
  heures_normales: number;
  heures_sup_effectuees: number;
  heures_astreintes: number;
  heures_totales: number;
}

export default function RhOmPointagePage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [rows, setRows] = useState<OmRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("");
  const [rhLocked, setRhLocked] = useState(false);
  const [pastDeadline, setPastDeadline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get(`/api/attendance/om-pointage/all/?year=${year}&month=${month}`);
      setRows(res.data.rows || []);
      setRhLocked(res.data.rh_locked ?? false);
      setPastDeadline(res.data.past_deadline ?? false);
      setLastUpdated(new Date());
    } catch {
      if (!silent) toast.error("Impossible de charger les données.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData(false);
    pollRef.current = setInterval(() => fetchData(true), 20_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchData]);

  const services = useMemo(() => Array.from(new Set(rows.map(r => r.service).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    let data = rows;
    if (filterService) data = data.filter(r => r.service === filterService);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.nom.toLowerCase().includes(q) ||
        r.prenom.toLowerCase().includes(q) ||
        r.matricule.toLowerCase().includes(q) ||
        (r.service || "").toLowerCase().includes(q) ||
        (r.n1_manager_name || "").toLowerCase().includes(q)
      );
    }
    return data;
  }, [rows, search, filterService]);

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search, filterService, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    jours_travailles: acc.jours_travailles + r.jours_travailles,
    nb_heures_sup: acc.nb_heures_sup + r.nb_heures_sup,
    nb_jours_astreintes: acc.nb_jours_astreintes + r.nb_jours_astreintes,
    heures_normales: acc.heures_normales + r.heures_normales,
    heures_sup_effectuees: acc.heures_sup_effectuees + r.heures_sup_effectuees,
    heures_astreintes: acc.heures_astreintes + r.heures_astreintes,
    heures_totales: acc.heures_totales + r.heures_totales,
  }), { jours_travailles: 0, nb_heures_sup: 0, nb_jours_astreintes: 0, heures_normales: 0, heures_sup_effectuees: 0, heures_astreintes: 0, heures_totales: 0 }), [filtered]);

  const remplissage = rows.length > 0
    ? Math.round(rows.filter(r => r.jours_travailles > 0).length / rows.length * 100)
    : 0;

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  async function toggleLock() {
    setToggling(true);
    try {
      const newLocked = !rhLocked;
      const res = await api.post("/api/attendance/om-pointage/set-lock/", {
        year, month, locked: newLocked,
      });
      setRhLocked(res.data.rh_locked ?? newLocked);
      toast.success(newLocked ? "Saisie désactivée pour cette période." : "Saisie réactivée.");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Erreur lors de la mise à jour du verrou.");
    } finally {
      setToggling(false);
    }
  }

  const isLocked = rhLocked || pastDeadline;

  function exportExcel() {
    const nDays = new Date(year, month, 0).getDate();

    const sHeader = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
      fill: { fgColor: { rgb: "003C71" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } },
    };
    const sHeaderLeft = { ...sHeader, alignment: { ...sHeader.alignment, horizontal: "left" } };
    const sBorderThin = { border: { top: { style: "thin", color: { rgb: "CCCCCC" } }, bottom: { style: "thin", color: { rgb: "CCCCCC" } }, left: { style: "thin", color: { rgb: "CCCCCC" } }, right: { style: "thin", color: { rgb: "CCCCCC" } } } };
    const sTotal = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 }, fill: { fgColor: { rgb: "1E293B" } }, alignment: { horizontal: "center" }, ...sBorderThin };
    const sTotalLabel = { ...sTotal, alignment: { horizontal: "left" } };

    const CODE_FILL: Record<string, string> = {
      X: "D1FAE5", Y: "FEF3C7", Z: "EDE9FE",
      C: "E0F2FE", A: "FFEDD5", M: "FFE4E6",
    };
    const CODE_TEXT: Record<string, string> = {
      X: "065F46", Y: "92400E", Z: "5B21B6",
      C: "075985", A: "9A3412", M: "9F1239",
    };

    const titleRow = [`POINTAGE O&M — ${MONTHS_FR[month - 1].toUpperCase()} ${year}`];
    const fixedHeaders = ["N°", "MATRICULE", "NOM", "PRENOM", "SERVICE", "QUALIFICATION", "ZONE", "MANAGER N+1"];
    const dayHeaders = Array.from({ length: nDays }, (_, i) => String(i + 1));
    const sumHeaders = ["JOURS TRAVAILLÉS", "NB H. SUP", "NB J. ASTREINTES", "JOURS NORMAUX", "HEURES NORMALES", "HEURES SUP", "HEURES ASTREINTES", "HEURES TOTALES"];
    const headers = [...fixedHeaders, ...dayHeaders, ...sumHeaders];

    const dataRows = filtered.map((row, i) => {
      const days = Array.from({ length: nDays }, (_, d) => row.daily_codes[String(d + 1)] || "");
      return [
        i + 1, row.matricule, row.nom, row.prenom, row.service, row.qualification, row.zone,
        row.n1_manager_name || row.manager, ...days,
        row.jours_travailles, row.nb_heures_sup, row.nb_jours_astreintes, row.jours_normaux,
        row.heures_normales, row.heures_sup_effectuees, row.heures_astreintes, row.heures_totales,
      ];
    });

    const totalsRow = [
      "", "TOTAUX", "", "", "", "", "", "",
      ...Array(nDays).fill(""),
      totals.jours_travailles, totals.nb_heures_sup, totals.nb_jours_astreintes, 0,
      totals.heures_normales, totals.heures_sup_effectuees, totals.heures_astreintes, totals.heures_totales,
    ];

    const wsData = [titleRow, headers, ...dataRows, totalsRow];
    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
    const nCols = headers.length;

    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } }];

    const titleCell = ws["A1"];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 14, color: { rgb: "003C71" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }

    for (let c = 0; c < nCols; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: 1, c });
      if (ws[addr]) ws[addr].s = c < fixedHeaders.length ? sHeaderLeft : sHeader;
    }

    for (let r = 2; r < 2 + dataRows.length; r++) {
      for (let c = 0; c < nCols; c++) {
        const addr = XLSXStyle.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        const isDay = c >= fixedHeaders.length && c < fixedHeaders.length + nDays;
        const code = isDay ? (ws[addr].v as string) : "";
        ws[addr].s = {
          font: { sz: 10, bold: isDay && !!code, color: { rgb: code ? CODE_TEXT[code] : "374151" } },
          fill: code ? { fgColor: { rgb: CODE_FILL[code] } } : { fgColor: { rgb: r % 2 === 0 ? "F8FAFC" : "FFFFFF" } },
          alignment: { horizontal: isDay || c === 0 ? "center" : "left", vertical: "center" },
          ...sBorderThin,
        };
      }
    }

    const totalsRowIdx = 2 + dataRows.length;
    for (let c = 0; c < nCols; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: totalsRowIdx, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = c === 1 ? sTotalLabel : sTotal;
    }

    ws["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 20 },
      ...Array(nDays).fill({ wch: 4 }),
      { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];
    ws["!rows"] = [{ hpt: 28 }, { hpt: 36 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, `${MONTHS_FR[month - 1]} ${year}`);
    XLSXStyle.writeFile(wb, `Pointage_OM_${MONTHS_FR[month - 1]}_${year}.xlsx`);
    toast.success("Export Excel téléchargé.");
  }

  return (
    <AppLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Ligne 1 : titre + actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#003c71] flex items-center justify-center shadow shrink-0">
                <TableProperties size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-800">Pointage O&M</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-slate-500">Vue consolidée — {MONTHS_FR[month - 1]} {year}</p>
                  {lastUpdated && (
                    <span className="text-[10px] text-slate-400">
                      · maj {lastUpdated.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  )}
                  {refreshing && <Loader2 size={11} className="animate-spin text-slate-400" />}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
              <button
                onClick={() => navigate("/rh/om-forfaits")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-[#003c71] text-white hover:bg-[#003c71]/90 transition shadow-sm"
              >
                <Banknote size={14} />
                <span className="hidden sm:inline">Forfaits</span>
              </button>
              <button
                onClick={() => fetchData(false)}
                disabled={loading || refreshing}
                title="Rafraîchir maintenant"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing || loading ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Rafraîchir</span>
              </button>
              <button
                onClick={exportExcel}
                disabled={loading || filtered.length === 0}
                title="Exporter en Excel"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
              >
                <FileDown size={14} />
                <span className="hidden sm:inline">Exporter Excel</span>
              </button>
              <button
                onClick={toggleLock}
                disabled={toggling || pastDeadline}
                title={pastDeadline ? "Date limite dépassée (verrou automatique)" : rhLocked ? "Réactiver la saisie" : "Désactiver la saisie"}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition shadow-sm border ${
                  isLocked
                    ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {toggling ? <Loader2 size={15} className="animate-spin" /> : isLocked ? <Lock size={15} /> : <LockOpen size={15} />}
                <span className="hidden sm:inline">
                  {isLocked ? (pastDeadline && !rhLocked ? "Date limite dépassée" : "Saisie désactivée") : "Saisie active"}
                </span>
              </button>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-lg transition"><ChevronLeft size={16} /></button>
                <span className="font-semibold text-slate-700 min-w-[110px] text-center text-sm">{MONTHS_FR[month - 1]} {year}</span>
                <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg transition"><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>

          {/* Ligne 2 : légendes alignées à droite */}
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            {(["X","Y","Z","C","A","M"] as DayCode[]).map(code => (
              <span key={code} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${CODE_META[code].bg} ${CODE_META[code].text}`}>
                <b>{code}</b> {code==="X"?"Présent":code==="Y"?"H.sup.":code==="Z"?"Astreinte":code==="C"?"Congés":code==="A"?"Sortie":"Maladie"}
              </span>
            ))}
          </div>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Users size={18} className="text-slate-500" /></div>
            <div><p className="text-xs text-slate-500">Effectif</p><p className="text-xl font-bold text-slate-800">{rows.length}</p></div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0"><TrendingUp size={18} className="text-emerald-600" /></div>
            <div><p className="text-xs text-slate-500">Remplissage</p><p className="text-xl font-bold text-emerald-600">{remplissage}%</p></div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><Clock size={18} className="text-amber-600" /></div>
            <div><p className="text-xs text-slate-500">Total H. sup.</p><p className="text-xl font-bold text-amber-600">{totals.heures_sup_effectuees}h</p></div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0"><Clock size={18} className="text-purple-600" /></div>
            <div><p className="text-xs text-slate-500">Astreintes (j)</p><p className="text-xl font-bold text-purple-600">{totals.nb_jours_astreintes}j</p></div>
          </div>
        </div>

        {/* ── Recherche + filtre ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-5">
          <div className="relative flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un employé..."
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20 w-full sm:w-72"
            />
          </div>
          <select
            value={filterService}
            onChange={e => setFilterService(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20"
          >
            <option value="">Tous les services</option>
            {services.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* ── Contenu ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">Aucune donnée.</div>
        ) : (
          <>
            {/* ── Vue carte — mobile (< md) ──────────────────────────────────── */}
            <div className="block md:hidden space-y-3">
              {paginated.map(row => (
                <div key={row.employee_id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* En-tête de la carte */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <p className="font-semibold text-slate-800 text-sm truncate">{row.nom} {row.prenom}</p>
                    <p className="text-xs text-slate-400">{row.matricule}{row.service ? ` · ${row.service}` : ""}</p>
                    {(row.n1_manager_name || row.manager) && (
                      <p className="text-xs text-slate-400">Mgr : {row.n1_manager_name || row.manager}</p>
                    )}
                  </div>

                  {/* Grille des jours (7 par ligne) */}
                  <div className="p-3">
                    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                        const code = (row.daily_codes[String(d)] as DayCode) || "";
                        const m = CODE_META[code];
                        return (
                          <div key={d} className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-slate-400 leading-none">{d}</span>
                            <div className={`w-8 h-8 rounded text-[10px] font-bold flex items-center justify-center ${m.bg} ${m.text}`}>
                              {code || ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Totaux */}
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="font-semibold text-slate-700">{row.jours_travailles}j travaillés</span>
                    <span className="text-amber-600">{row.nb_heures_sup} H.sup</span>
                    <span className="text-purple-600">{row.nb_jours_astreintes} Astr.</span>
                    <span className="text-slate-500">{row.heures_normales}h norm.</span>
                    <span className="font-bold text-slate-800">{row.heures_totales}h total</span>
                  </div>
                </div>
              ))}

              {/* Totaux globaux sur mobile */}
              <div className="bg-slate-800 text-white rounded-xl px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-semibold">
                <span>TOTAUX</span>
                <span>{totals.jours_travailles}j</span>
                <span className="text-amber-300">{totals.nb_heures_sup} HS</span>
                <span className="text-purple-300">{totals.nb_jours_astreintes} Astr.</span>
                <span>{totals.heures_normales}h norm.</span>
                <span className="text-amber-300">{totals.heures_sup_effectuees}h sup.</span>
                <span className="font-bold">{totals.heures_totales}h total</span>
              </div>
            </div>

            {/* ── Vue tableau — desktop (≥ md) ──────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
              <table className="text-xs border-collapse w-full" style={{ minWidth: `${220 + daysInMonth * 30 + 280}px` }}>
                <thead>
                  <tr className="bg-[#003c71] text-white select-none">
                    <th className="sticky left-0 bg-[#003c71] px-3 py-2.5 text-left font-semibold min-w-[160px] z-10 border-r border-white/10">Employé</th>
                    <th className="px-2 py-2.5 text-left font-semibold min-w-[80px]">Service</th>
                    <th className="px-2 py-2.5 text-left font-semibold min-w-[110px]">Manager</th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                      <th key={d} className="w-7 py-2.5 text-center text-[10px] text-white/80 font-medium">{d}</th>
                    ))}
                    <th className="px-2 py-2.5 text-center font-semibold">Jours</th>
                    <th className="px-2 py-2.5 text-center font-semibold">HS(j)</th>
                    <th className="px-2 py-2.5 text-center font-semibold">Astr(j)</th>
                    <th className="px-2 py-2.5 text-center font-semibold">H.norm</th>
                    <th className="px-2 py-2.5 text-center font-semibold">H.HS</th>
                    <th className="px-2 py-2.5 text-center font-semibold">H.Astr</th>
                    <th className="px-2 py-2.5 text-center font-semibold">H.Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row, idx) => (
                    <tr key={row.employee_id} className={`border-t border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-blue-50/30 transition-colors`}>
                      <td className="sticky left-0 px-3 py-2 font-medium text-slate-800 z-10 border-r border-slate-100" style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <div className="truncate max-w-[155px]">{row.nom} {row.prenom}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{row.matricule}</div>
                      </td>
                      <td className="px-2 py-2 text-slate-500 text-[11px] truncate max-w-[78px]">{row.service}</td>
                      <td className="px-2 py-2 text-slate-500 text-[11px] truncate max-w-[108px]">{row.n1_manager_name || row.manager}</td>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                        const code = (row.daily_codes[String(d)] as DayCode) || "";
                        const m = CODE_META[code];
                        return (
                          <td key={d} className="p-0.5 text-center">
                            <div className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center mx-auto ${m.bg} ${m.text}`}>
                              {code || ""}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center font-semibold text-slate-700">{row.jours_travailles}</td>
                      <td className="px-2 py-2 text-center font-semibold text-amber-600">{row.nb_heures_sup}</td>
                      <td className="px-2 py-2 text-center font-semibold text-purple-600">{row.nb_jours_astreintes}</td>
                      <td className="px-2 py-2 text-center text-slate-600">{row.heures_normales}h</td>
                      <td className="px-2 py-2 text-center text-amber-600">{row.heures_sup_effectuees}h</td>
                      <td className="px-2 py-2 text-center text-purple-600">{row.heures_astreintes}h</td>
                      <td className="px-2 py-2 text-center font-bold text-slate-800">{row.heures_totales}h</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white border-t-2 border-slate-400 font-semibold">
                    <td className="sticky left-0 bg-slate-800 px-3 py-2 z-10 text-sm">TOTAUX</td>
                    <td colSpan={2} />
                    <td colSpan={daysInMonth} />
                    <td className="px-2 py-2 text-center">{totals.jours_travailles}</td>
                    <td className="px-2 py-2 text-center text-amber-300">{totals.nb_heures_sup}</td>
                    <td className="px-2 py-2 text-center text-purple-300">{totals.nb_jours_astreintes}</td>
                    <td className="px-2 py-2 text-center">{totals.heures_normales}h</td>
                    <td className="px-2 py-2 text-center text-amber-300">{totals.heures_sup_effectuees}h</td>
                    <td className="px-2 py-2 text-center text-purple-300">{totals.heures_astreintes}h</td>
                    <td className="px-2 py-2 text-center">{totals.heures_totales}h</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
            <div className="flex items-center gap-3 order-2 sm:order-1">
              <p className="text-xs text-slate-500">
                {filtered.length <= pageSize
                  ? `${filtered.length} employé${filtered.length > 1 ? "s" : ""}`
                  : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} sur ${filtered.length}`}
              </p>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#003c71]/20 text-slate-600"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={15} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "…")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                        page === p
                          ? "bg-[#003c71] text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
