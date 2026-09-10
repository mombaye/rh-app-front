import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, TableProperties, ArrowLeft, FileDown, Settings2 } from "lucide-react";
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

  // Taux configurables
  const [forfaitHsRate, setForfaitHsRate] = useState(60000);
  const [astreinteRate, setAstreinteRate] = useState(15000);
  const [showRates, setShowRates] = useState(false);

  // Commentaires (sauvegardés localement par employé)
  const [comments, setComments] = useState<Record<number, string>>({});

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Charger commentaires depuis localStorage au changement de période
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

  useEffect(() => { fetchData(); }, [fetchData]);

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

  // Calcul forfait par employé
  function calcForfait(row: OmRow) {
    const forfaitHs = row.nb_heures_sup > 0 ? forfaitHsRate : 0;
    const montantAstr = row.nb_jours_astreintes * astreinteRate;
    const total = forfaitHs + montantAstr;
    return { forfaitHs, montantAstr, total };
  }

  // Totaux généraux (sur filtered)
  const totals = useMemo(() => filtered.reduce((acc, r) => {
    const f = calcForfait(r);
    return {
      forfaitHs: acc.forfaitHs + f.forfaitHs,
      nbJoursAstr: acc.nbJoursAstr + r.nb_jours_astreintes,
      montantAstr: acc.montantAstr + f.montantAstr,
      total: acc.total + f.total,
    };
  }, { forfaitHs: 0, nbJoursAstr: 0, montantAstr: 0, total: 0 }), [filtered, forfaitHsRate, astreinteRate]);

  function fmt(n: number) {
    return n === 0 ? "0" : n.toLocaleString("fr-FR");
  }

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

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

    const titleRow = [`FORFAITS O&M — ${MONTHS_FR[month - 1].toUpperCase()} ${year}  |  Forfait HS : ${fmt(forfaitHsRate)} FCFA  |  Taux astreinte : ${fmt(astreinteRate)} FCFA/j`];
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
                onClick={() => setShowRates(v => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition shadow-sm ${showRates ? "bg-[#003c71] text-white border-[#003c71]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                <Settings2 size={14} />
                <span className="hidden sm:inline">Taux</span>
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

          {/* Panneau taux configurables */}
          {showRates && (
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-slate-600 shrink-0">Taux de calcul :</p>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-600 text-xs whitespace-nowrap">Forfait HS (FCFA)</span>
                <input
                  type="number"
                  value={forfaitHsRate}
                  onChange={e => setForfaitHsRate(Number(e.target.value))}
                  className="w-28 px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20"
                  min={0} step={5000}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-600 text-xs whitespace-nowrap">Taux astreinte / jour (FCFA)</span>
                <input
                  type="number"
                  value={astreinteRate}
                  onChange={e => setAstreinteRate(Number(e.target.value))}
                  className="w-28 px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20"
                  min={0} step={1000}
                />
              </label>
              <p className="text-[11px] text-slate-400">Les taux s'appliquent au calcul en temps réel — non enregistrés.</p>
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
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <p className="font-semibold text-slate-800 text-sm truncate">{row.nom} {row.prenom}</p>
                      <p className="text-xs text-slate-400">{row.matricule}{row.service ? ` · ${row.service}` : ""}</p>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Forfait HS</p>
                        <p className={`font-semibold ${f.forfaitHs > 0 ? "text-amber-600" : "text-slate-400"}`}>{fmt(f.forfaitHs)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Nbr jours astr.</p>
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
                    <th className="px-3 py-3 text-center font-semibold min-w-[110px]">
                      FORFAIT HS
                      <div className="text-[10px] font-normal text-white/60">{fmt(forfaitHsRate)} FCFA/ag.</div>
                    </th>
                    <th className="px-3 py-3 text-center font-semibold min-w-[100px]">
                      ASTREINTES
                      <div className="text-[10px] font-normal text-white/60">Nbr jours</div>
                    </th>
                    <th className="px-3 py-3 text-center font-semibold min-w-[120px]">
                      MONTANT ASTR.
                      <div className="text-[10px] font-normal text-white/60">{fmt(astreinteRate)} FCFA/j</div>
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
                        <td className="px-3 py-2 text-slate-500 text-[11px] truncate max-w-[88px]">{row.service}</td>
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
    </AppLayout>
  );
}
