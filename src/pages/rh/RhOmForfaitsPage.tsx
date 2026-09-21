import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, TableProperties, ArrowLeft, FileDown, Settings2, AlertTriangle, X, Plus, Trash2, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/api/axios";
import toast from "react-hot-toast";
import AppLayout from "@/layouts/AppLayout";
// @ts-ignore
import XLSXStyle from "xlsx-js-style";

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

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
  nb_heures_sup: number;
  nb_jours_astreintes: number;
  jours_travailles: number;
  heures_totales: number;
}

interface ServiceRate {
  id?: number;
  service: string;
  forfait_hs: number;       // montant forfait si Y > 0
  astreinte_per_day: number; // montant par jour Z
}

const STORAGE_KEY = (year: number, month: number) =>
  `om_forfaits_comments_${year}_${month}`;

export default function RhOmForfaitsPage() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [rows, setRows] = useState<OmRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("");

  // Tarifs par service
  const [serviceRates, setServiceRates] = useState<ServiceRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  // Edition locale dans le modal
  const [editRates, setEditRates] = useState<ServiceRate[]>([]);
  const [savingRates, setSavingRates] = useState(false);

  // Commentaires
  const [comments, setComments] = useState<Record<number, string>>({});
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Map service → rate pour lookup rapide
  const rateByService = useMemo(() => {
    const m: Record<string, ServiceRate> = {};
    serviceRates.forEach(r => { m[r.service] = r; });
    return m;
  }, [serviceRates]);

  // Services présents dans les données + ceux configurés
  const allServices = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.service) set.add(r.service); });
    serviceRates.forEach(r => set.add(r.service));
    return Array.from(set).sort();
  }, [rows, serviceRates]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY(year, month));
      setComments(saved ? JSON.parse(saved) : {});
    } catch { setComments({}); }
  }, [year, month]);

  function saveComment(employeeId: number, text: string) {
    setComments(prev => {
      const next = { ...prev, [employeeId]: text };
      try { localStorage.setItem(STORAGE_KEY(year, month), JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/attendance/om-pointage/all/?year=${year}&month=${month}`);
      setRows(res.data.rows || []);
    } catch {
      toast.error("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const fetchRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const res = await api.get("/api/attendance/om-service-rates/");
      setServiceRates(res.data || []);
    } catch {
      // silencieux
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); fetchRates(); }, [fetchData, fetchRates]);

  const services = useMemo(
    () => Array.from(new Set(rows.map(r => r.service).filter(Boolean))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    let data = rows;
    if (filterService) data = data.filter(r => r.service === filterService);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        r.nom.toLowerCase().includes(q) ||
        r.prenom.toLowerCase().includes(q) ||
        r.matricule.toLowerCase().includes(q) ||
        (r.service || "").toLowerCase().includes(q)
      );
    }
    return data;
  }, [rows, search, filterService]);

  useEffect(() => { setPage(1); }, [search, filterService, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  function calcForfait(row: OmRow) {
    const rate = rateByService[row.service];
    const forfaitHs = rate && row.nb_heures_sup > 0 ? rate.forfait_hs : 0;
    const montantAstr = rate ? rate.astreinte_per_day * row.nb_jours_astreintes : 0;
    return { forfaitHs, montantAstr, total: forfaitHs + montantAstr, hasRate: !!rate };
  }

  const totals = useMemo(() => filtered.reduce((acc, r) => {
    const f = calcForfait(r);
    return {
      forfaitHs: acc.forfaitHs + f.forfaitHs,
      nbJoursAstr: acc.nbJoursAstr + r.nb_jours_astreintes,
      montantAstr: acc.montantAstr + f.montantAstr,
      total: acc.total + f.total,
    };
  }, { forfaitHs: 0, nbJoursAstr: 0, montantAstr: 0, total: 0 }), [filtered, rateByService]);

  const servicesWithoutRate = useMemo(
    () => services.filter(s => !rateByService[s]),
    [services, rateByService]
  );

  function fmt(n: number) {
    return n === 0 ? "0" : n.toLocaleString("fr-FR");
  }

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  // ── Modal tarifs ────────────────────────────────────────────────────────────

  function openRatesModal() {
    // Initialiser l'édition avec les tarifs existants + les services manquants
    const existing = serviceRates.map(r => ({ ...r }));
    const missingServices = allServices.filter(s => !rateByService[s]);
    const newEntries: ServiceRate[] = missingServices.map(s => ({ service: s, forfait_hs: 0, astreinte_per_day: 0 }));
    setEditRates([...existing, ...newEntries]);
    setShowRatesModal(true);
  }

  function addCustomService() {
    setEditRates(prev => [...prev, { service: "", forfait_hs: 0, astreinte_per_day: 0 }]);
  }

  function removeEditRate(idx: number) {
    setEditRates(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveRates() {
    setSavingRates(true);
    try {
      // Upsert chaque tarif (ignore les lignes avec service vide)
      const valid = editRates.filter(r => r.service.trim());
      for (const r of valid) {
        await api.post("/api/attendance/om-service-rates/upsert/", {
          service: r.service.trim(),
          forfait_hs: r.forfait_hs,
          astreinte_per_day: r.astreinte_per_day,
        });
      }
      await fetchRates();
      setShowRatesModal(false);
      toast.success("Tarifs enregistrés.");
    } catch {
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSavingRates(false);
    }
  }

  async function deleteRate(id: number) {
    try {
      await api.delete(`/api/attendance/om-service-rates/${id}/delete/`);
      setServiceRates(prev => prev.filter(r => r.id !== id));
      setEditRates(prev => prev.filter(r => r.id !== id));
      toast.success("Tarif supprimé.");
    } catch {
      toast.error("Erreur suppression.");
    }
  }

  // ── Export Excel ─────────────────────────────────────────────────────────────

  function exportExcel() {
    const sBorderThin = { border: { top: { style: "thin", color: { rgb: "CCCCCC" } }, bottom: { style: "thin", color: { rgb: "CCCCCC" } }, left: { style: "thin", color: { rgb: "CCCCCC" } }, right: { style: "thin", color: { rgb: "CCCCCC" } } } };
    const sHeader = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
      fill: { fgColor: { rgb: "003C71" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { top: { style: "thin", color: { rgb: "FFFFFF" } }, bottom: { style: "thin", color: { rgb: "FFFFFF" } }, left: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } },
    };
    const sHeaderLeft = { ...sHeader, alignment: { ...sHeader.alignment, horizontal: "left" } };
    const sTotal = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 }, fill: { fgColor: { rgb: "1E293B" } }, alignment: { horizontal: "center" }, ...sBorderThin };
    const sTotalLabel = { ...sTotal, alignment: { horizontal: "left" } };

    const titleRow = [`FORFAITS O&M — ${MONTHS_FR[month - 1].toUpperCase()} ${year}`];
    const headers = ["N°", "MATRICULE", "NOM", "PRENOM", "SERVICE", "QUALIFICATION", "ZONE", "MANAGER N+1",
      "FORFAIT HS", "ASTREINTES / NBR JOURS", "MONTANTS ASTREINTES", "MONTANT TOTAL (HS+Astreinte)", "COMMENTAIRES OU OMISSIONS"];

    const dataRows = filtered.map((row, i) => {
      const f = calcForfait(row);
      return [
        i + 1, row.matricule, row.nom, row.prenom, row.service, row.qualification, row.zone,
        row.n1_manager_name || row.manager,
        f.forfaitHs, row.nb_jours_astreintes, f.montantAstr, f.total,
        comments[row.employee_id] || "",
      ];
    });

    const totalsRow = ["", "TOTAUX", "", "", "", "", "", "",
      totals.forfaitHs, totals.nbJoursAstr, totals.montantAstr, totals.total, ""];

    const wsData = [titleRow, headers, ...dataRows, totalsRow];
    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
    const nCols = headers.length;

    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } }];
    const tc = ws["A1"];
    if (tc) tc.s = { font: { bold: true, sz: 12, color: { rgb: "003C71" } }, alignment: { horizontal: "center", vertical: "center" } };

    for (let c = 0; c < nCols; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: 1, c });
      if (ws[addr]) ws[addr].s = c < 8 ? sHeaderLeft : sHeader;
    }
    for (let r = 2; r < 2 + dataRows.length; r++) {
      for (let c = 0; c < nCols; c++) {
        const addr = XLSXStyle.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        const isAmount = c >= 8 && c <= 11;
        ws[addr].s = {
          font: { sz: 10, bold: isAmount, color: { rgb: isAmount ? "003C71" : "374151" } },
          fill: { fgColor: { rgb: r % 2 === 0 ? "F8FAFC" : "FFFFFF" } },
          alignment: { horizontal: isAmount || c === 0 ? "center" : "left", vertical: "center" },
          ...sBorderThin,
        };
      }
    }
    const totR = 2 + dataRows.length;
    for (let c = 0; c < nCols; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r: totR, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = c === 1 ? sTotalLabel : sTotal;
    }
    ws["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 20 },
      { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 30 },
    ];
    ws["!rows"] = [{ hpt: 28 }, { hpt: 40 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, `Forfaits ${MONTHS_FR[month - 1]} ${year}`);
    XLSXStyle.writeFile(wb, `Forfaits_OM_${MONTHS_FR[month - 1]}_${year}.xlsx`);
    toast.success("Export Excel téléchargé.");
  }

  return (
    <AppLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate("/rh/om-pointage")}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition shrink-0"
                title="Retour au pointage"
              >
                <ArrowLeft size={18} className="text-slate-600" />
              </button>
              <div className="w-10 h-10 rounded-xl bg-[#003c71] flex items-center justify-center shadow shrink-0">
                <TableProperties size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-800">Forfaits O&M</h1>
                <p className="text-xs text-slate-500">HS & Astreintes — {MONTHS_FR[month - 1]} {year}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
              <button
                onClick={openRatesModal}
                disabled={ratesLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <Settings2 size={14} />
                <span className="hidden sm:inline">Tarifs par service</span>
                {servicesWithoutRate.length > 0 && (
                  <span className="ml-1 bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {servicesWithoutRate.length}
                  </span>
                )}
              </button>
              <button
                onClick={exportExcel}
                disabled={loading || filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
              >
                <FileDown size={14} />
                <span className="hidden sm:inline">Exporter Excel</span>
              </button>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-lg transition"><ChevronLeft size={16} /></button>
                <span className="font-semibold text-slate-700 min-w-[110px] text-center text-sm">{MONTHS_FR[month - 1]} {year}</span>
                <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg transition"><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>

          {/* Alerte services sans tarif */}
          {servicesWithoutRate.length > 0 && (
            <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-sm text-orange-700">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                <b>{servicesWithoutRate.length} service{servicesWithoutRate.length > 1 ? "s" : ""} sans tarif</b> : {servicesWithoutRate.join(", ")}.
                {" "}<button onClick={openRatesModal} className="underline font-semibold hover:text-orange-800">Configurer les tarifs</button>
              </span>
            </div>
          )}
        </div>

        {/* ── KPI résumé ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Bénéficiaires HS</p>
            <p className="text-xl font-bold text-[#003c71]">{filtered.filter(r => r.nb_heures_sup > 0).length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Total Forfait HS</p>
            <p className="text-xl font-bold text-amber-600">{fmt(totals.forfaitHs)} <span className="text-sm font-normal text-slate-400">FCFA</span></p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Total Astreintes</p>
            <p className="text-xl font-bold text-purple-600">{fmt(totals.montantAstr)} <span className="text-sm font-normal text-slate-400">FCFA</span></p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Montant Total</p>
            <p className="text-xl font-bold text-slate-800">{fmt(totals.total)} <span className="text-sm font-normal text-slate-400">FCFA</span></p>
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

        {/* ── Tableau ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">Aucune donnée.</div>
        ) : (
          <>
            {/* Vue carte — mobile */}
            <div className="block md:hidden space-y-3">
              {paginated.map(row => {
                const f = calcForfait(row);
                return (
                  <div key={row.employee_id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm truncate">{row.nom} {row.prenom}</p>
                        <p className="text-xs text-slate-400">{row.matricule}{row.service ? ` · ${row.service}` : ""}</p>
                      </div>
                      {!f.hasRate && <AlertTriangle size={14} className="text-orange-400 shrink-0" title="Pas de tarif pour ce service" />}
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Forfait HS</p>
                        <p className={`font-semibold ${f.forfaitHs > 0 ? "text-amber-600" : "text-slate-400"}`}>{fmt(f.forfaitHs)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Jours astr.</p>
                        <p className={`font-semibold ${row.nb_jours_astreintes > 0 ? "text-purple-600" : "text-slate-400"}`}>{row.nb_jours_astreintes}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Montant astr.</p>
                        <p className={`font-semibold ${f.montantAstr > 0 ? "text-purple-600" : "text-slate-400"}`}>{fmt(f.montantAstr)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Total</p>
                        <p className={`font-bold ${f.total > 0 ? "text-slate-800" : "text-slate-400"}`}>{fmt(f.total)}</p>
                      </div>
                    </div>
                    <div className="px-4 pb-3">
                      <textarea
                        value={comments[row.employee_id] || ""}
                        onChange={e => saveComment(row.employee_id, e.target.value)}
                        placeholder="Commentaire / omission..."
                        rows={2}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#003c71]/20 text-slate-700 placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                );
              })}
              <div className="bg-slate-800 text-white rounded-xl px-4 py-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-semibold">
                <span>TOTAUX</span>
                <span className="text-amber-300">{fmt(totals.forfaitHs)} HS</span>
                <span className="text-purple-300">{fmt(totals.montantAstr)} Astr.</span>
                <span>{fmt(totals.total)} total</span>
              </div>
            </div>

            {/* Vue tableau — desktop */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
              <table className="text-xs border-collapse w-full" style={{ minWidth: "900px" }}>
                <thead>
                  <tr className="bg-[#003c71] text-white select-none">
                    <th className="sticky left-0 bg-[#003c71] px-3 py-3 text-left font-semibold min-w-[160px] z-10 border-r border-white/10">Employé</th>
                    <th className="px-3 py-3 text-left font-semibold min-w-[90px]">Service</th>
                    <th className="px-3 py-3 text-left font-semibold min-w-[110px]">Manager</th>
                    <th className="px-3 py-3 text-center font-semibold min-w-[120px]">
                      FORFAIT HS
                      <div className="text-[10px] font-normal text-white/60">si jours Y &gt; 0</div>
                    </th>
                    <th className="px-3 py-3 text-center font-semibold min-w-[100px]">
                      ASTREINTES
                      <div className="text-[10px] font-normal text-white/60">Nbr jours Z</div>
                    </th>
                    <th className="px-3 py-3 text-center font-semibold min-w-[130px]">
                      MONTANT ASTR.
                      <div className="text-[10px] font-normal text-white/60">tarif/j × nb jours</div>
                    </th>
                    <th className="px-3 py-3 text-center font-semibold min-w-[130px]">
                      TOTAL
                      <div className="text-[10px] font-normal text-white/60">HS + Astreinte</div>
                    </th>
                    <th className="px-3 py-3 text-left font-semibold min-w-[200px]">COMMENTAIRES / OMISSIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row, idx) => {
                    const f = calcForfait(row);
                    return (
                      <tr key={row.employee_id} className={`border-t border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} hover:bg-blue-50/20 transition-colors`}>
                        <td className="sticky left-0 px-3 py-2 font-medium text-slate-800 z-10 border-r border-slate-100" style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                          <div className="truncate max-w-[155px]">{row.nom} {row.prenom}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{row.matricule}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-[11px] truncate max-w-[88px]">
                          <div className="flex items-center gap-1">
                            {!f.hasRate && <AlertTriangle size={11} className="text-orange-400 shrink-0" title="Pas de tarif pour ce service" />}
                            {row.service}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-[11px] truncate max-w-[108px]">{row.n1_manager_name || row.manager}</td>
                        <td className="px-3 py-2 text-center font-semibold">
                          <span className={f.forfaitHs > 0 ? "text-amber-600" : "text-slate-300"}>{fmt(f.forfaitHs)}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">
                          <span className={row.nb_jours_astreintes > 0 ? "text-purple-600" : "text-slate-300"}>{row.nb_jours_astreintes}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">
                          <span className={f.montantAstr > 0 ? "text-purple-600" : "text-slate-300"}>{fmt(f.montantAstr)}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-bold">
                          <span className={f.total > 0 ? "text-slate-800" : "text-slate-300"}>{fmt(f.total)}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={comments[row.employee_id] || ""}
                            onChange={e => saveComment(row.employee_id, e.target.value)}
                            placeholder="..."
                            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#003c71]/30 text-slate-700 placeholder:text-slate-300"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white border-t-2 border-slate-400 font-semibold">
                    <td className="sticky left-0 bg-slate-800 px-3 py-2 z-10 text-sm">TOTAUX</td>
                    <td colSpan={2} />
                    <td className="px-3 py-2 text-center text-amber-300">{fmt(totals.forfaitHs)}</td>
                    <td className="px-3 py-2 text-center text-purple-300">{totals.nbJoursAstr}</td>
                    <td className="px-3 py-2 text-center text-purple-300">{fmt(totals.montantAstr)}</td>
                    <td className="px-3 py-2 text-center">{fmt(totals.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────── */}
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
            {filtered.length > pageSize && (
              <div className="flex items-center gap-1 order-1 sm:order-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p); return acc;
                  }, [])
                  .map((p, i) => p === "…"
                    ? <span key={`e-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                    : <button key={p} onClick={() => setPage(p as number)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition ${page === p ? "bg-[#003c71] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                        {p}
                      </button>
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal Tarifs par service ──────────────────────────────────────────── */}
      {showRatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">Tarifs par service</h2>
                <p className="text-xs text-slate-400 mt-0.5">Forfait H.Sup (si jours Y &gt; 0) et tarif Astreinte/jour (jours Z)</p>
              </div>
              <button onClick={() => setShowRatesModal(false)} className="p-2 rounded-xl hover:bg-slate-100 transition">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* Corps du modal */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase">
                    <th className="text-left pb-2 font-semibold">Service</th>
                    <th className="text-center pb-2 font-semibold px-3">
                      <span className="text-amber-600">Forfait H.Sup</span>
                      <div className="text-[10px] text-slate-400 normal-case font-normal">FCFA (si Y &gt; 0)</div>
                    </th>
                    <th className="text-center pb-2 font-semibold px-3">
                      <span className="text-purple-600">Astreinte / jour</span>
                      <div className="text-[10px] text-slate-400 normal-case font-normal">FCFA × nb jours Z</div>
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editRates.map((rate, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-3">
                        {rate.id ? (
                          <span className="font-medium text-slate-700">{rate.service}</span>
                        ) : (
                          <input
                            type="text"
                            value={rate.service}
                            onChange={e => setEditRates(prev => prev.map((r, i) => i === idx ? { ...r, service: e.target.value } : r))}
                            placeholder="Nom du service..."
                            className="w-full px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20"
                          />
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={rate.forfait_hs}
                          onChange={e => setEditRates(prev => prev.map((r, i) => i === idx ? { ...r, forfait_hs: Number(e.target.value) } : r))}
                          className="w-full px-2 py-1 text-sm border border-amber-200 rounded-lg bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-300/40 text-center font-semibold text-amber-700"
                          min={0} step={5000}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={rate.astreinte_per_day}
                          onChange={e => setEditRates(prev => prev.map((r, i) => i === idx ? { ...r, astreinte_per_day: Number(e.target.value) } : r))}
                          className="w-full px-2 py-1 text-sm border border-purple-200 rounded-lg bg-purple-50/40 focus:outline-none focus:ring-2 focus:ring-purple-300/40 text-center font-semibold text-purple-700"
                          min={0} step={1000}
                        />
                      </td>
                      <td className="py-2 pl-2">
                        <button
                          onClick={() => rate.id ? deleteRate(rate.id) : removeEditRate(idx)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {editRates.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Aucun tarif configuré.</p>
              )}

              <button
                onClick={addCustomService}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 transition"
              >
                <Plus size={13} /> Ajouter un service
              </button>
            </div>

            {/* Footer modal */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowRatesModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={saveRates}
                disabled={savingRates}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#003c71] text-white hover:bg-[#003c71]/90 transition shadow-sm disabled:opacity-60"
              >
                {savingRates ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
