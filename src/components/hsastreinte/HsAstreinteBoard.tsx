// Pointage HS & Astreinte : grille mensuelle façon Team Planning.
// Codes : X présent, Y heures sup., Z astreinte, C congés, A sortie, M maladie.
// Les cases en pointillés sont remplies automatiquement (pointage, congés, sorties) ; une saisie les remplace.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote, ChevronLeft, ChevronRight, FileDown, Loader2, Lock, LockOpen, Paintbrush, PlayCircle,
  Search, TableProperties, X as XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { HsCell, HsChange, HsCode, HsGrid, HsRow, hsAstreinteService } from "@/services/hsAstreinteService";
import { exportAttendanceXLSX, periodInfo } from "@/utils/attendanceExport";

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export const CODE_META: Record<Exclude<HsCode, "">, { label: string; cls: string; dot: string }> = {
  X: { label: "Présent",          cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  Y: { label: "Heures sup.",      cls: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  Z: { label: "Astreinte",        cls: "bg-purple-100 text-purple-700",   dot: "bg-purple-500" },
  C: { label: "Congés",           cls: "bg-sky-100 text-sky-700",         dot: "bg-sky-500" },
  A: { label: "Sortie",           cls: "bg-orange-100 text-orange-700",   dot: "bg-orange-500" },
  M: { label: "Maladie",          cls: "bg-rose-100 text-rose-700",       dot: "bg-rose-500" },
};
const CODES = Object.keys(CODE_META) as Exclude<HsCode, "">[];

const SOURCE_LABEL: Record<string, string> = {
  pointage: "a pointé ce jour", mission: "mission validée", conge: "congé approuvé",
  maladie: "congé maladie approuvé", sortie: "sortie approuvée",
};

function cellClass(cell: HsCell, offDay: boolean): string {
  if (!cell.code) return offDay ? "bg-slate-100 text-slate-300" : "bg-white border border-dashed border-slate-200 text-slate-300 hover:bg-slate-50";
  const base = CODE_META[cell.code as Exclude<HsCode, "">].cls;
  return cell.auto ? `${base} border border-dashed border-current italic opacity-80` : `${base} font-bold`;
}

function cellTitle(cell: HsCell): string {
  const parts: string[] = [];
  if (cell.code) {
    const label = CODE_META[cell.code as Exclude<HsCode, "">].label;
    parts.push(cell.auto ? `${cell.code} — ${label}, rempli automatiquement (${SOURCE_LABEL[cell.source ?? ""] ?? "auto"})` : `${cell.code} — ${label}`);
  } else parts.push("À renseigner");
  if (cell.hint) parts.push(`💡 ${cell.hint}`);
  return parts.join("\n");
}

type Picker = { mode: "cell" | "fill"; row: HsRow; day?: number; x: number; y: number };

export default function HsAstreinteBoard() {
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [filler, setFiller] = useState("");
  const [search, setSearch] = useState("");
  const [grid, setGrid] = useState<HsGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [lockBusy, setLockBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGrid(await hsAstreinteService.getGrid(year, month, filler));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Impossible de charger le pointage");
    } finally {
      setLoading(false);
    }
  }, [year, month, filler]);

  useEffect(() => { load(); }, [load]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const showFillerGroups = !!grid?.is_rh || (grid?.fillers.length ?? 0) > 1;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let all = grid?.rows ?? [];
    if (q) all = all.filter((r) => `${r.matricule} ${r.nom} ${r.prenom} ${r.service}`.toLowerCase().includes(q));
    // Regroupement par responsable de saisie (les employés sans responsable à la fin)
    if (showFillerGroups) {
      all = [...all].sort((a, b) => (a.filler ? 0 : 1) - (b.filler ? 0 : 1) || a.filler.localeCompare(b.filler)
        || a.nom.localeCompare(b.nom));
    }
    return all;
  }, [grid, search, showFillerGroups]);

  const totals = useMemo(() => rows.reduce((t, r) => ({
    jours: t.jours + r.jours_travailles, hs: t.hs + r.nb_heures_sup, astr: t.astr + r.nb_jours_astreintes,
  }), { jours: 0, hs: 0, astr: 0 }), [rows]);

  const offDays = useMemo(() => new Set((grid?.days ?? []).filter((d) => d.weekday >= 5 || d.holiday).map((d) => d.day)), [grid]);

  const applyChanges = async (changes: HsChange[]) => {
    if (!grid || changes.length === 0) return;
    setSaving(true);
    try {
      const res = await hsAstreinteService.save(grid.year, grid.month, changes);
      const updated = new Map(res.rows.map((r) => [r.employee_id, r]));
      setGrid((g) => g && { ...g, rows: g.rows.map((r) => updated.get(r.employee_id) ?? r) });
      if (res.errors.length) toast.error(res.errors.slice(0, 3).join("\n"));
    } catch (e: any) {
      const errs: string[] | undefined = e?.response?.data?.errors;
      toast.error(errs?.length ? errs.slice(0, 3).join("\n") : e?.response?.data?.detail ?? "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const openPicker = (mode: Picker["mode"], row: HsRow, el: HTMLElement, day?: number) => {
    if (!grid?.editable) {
      toast(grid?.lock_reason || "Saisie fermée pour cette période.");
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 240);
    const y = rect.bottom + 320 > window.innerHeight ? Math.max(8, rect.top - 320) : rect.bottom + 4;
    setPicker({ mode, row, day, x, y });
  };

  const choose = (code: HsCode) => {
    if (!picker) return;
    const { row, day, mode } = picker;
    setPicker(null);
    if (mode === "cell" && day) {
      applyChanges([{ employee_id: row.employee_id, day, code }]);
      return;
    }
    // Pinceau : jours vides (hors week-ends / fériés) et jours « présent » remplis automatiquement
    const changes = row.cells
      .map((c, i) => ({ c, day: i + 1 }))
      .filter(({ c, day: d }) => (!c.code && !offDays.has(d)) || (c.auto && c.code === "X"))
      .map(({ day: d }) => ({ employee_id: row.employee_id, day: d, code }));
    if (changes.length === 0) toast("Aucun jour à remplir pour cet employé.");
    else applyChanges(changes);
  };

  const clearRow = () => {
    if (!picker) return;
    const { row } = picker;
    setPicker(null);
    const changes = row.cells
      .map((c, i) => ({ c, day: i + 1 }))
      .filter(({ c }) => c.code && !c.auto)
      .map(({ day }) => ({ employee_id: row.employee_id, day, code: "" as HsCode }));
    if (changes.length === 0) toast("Aucune saisie à effacer sur cette ligne.");
    else if (window.confirm(`Effacer les ${changes.length} saisie(s) de ${row.nom} ${row.prenom} ce mois-ci ?\nLes valeurs automatiques (pointage, congés, sorties) restent.`)) applyChanges(changes);
  };

  const toggleLock = async () => {
    if (!grid) return;
    setLockBusy(true);
    try {
      await hsAstreinteService.setLock(year, month, !grid.lock.rh_locked);
      toast.success(grid.lock.rh_locked ? "Saisie réactivée." : "Saisie désactivée pour cette période.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Modification impossible");
    } finally {
      setLockBusy(false);
    }
  };

  const activateSession = async () => {
    setLockBusy(true);
    try {
      await hsAstreinteService.activateSession(year, month);
      toast.success("Nouvelle session activée — saisie réouverte.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Activation impossible");
    } finally {
      setLockBusy(false);
    }
  };

  const exportExcel = () => {
    if (!grid || rows.length === 0) return;
    const last = String(grid.days.length).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    exportAttendanceXLSX("Pointage_HS_Astreinte", rows.map((r) => ({
      "Matricule": r.matricule,
      "Nom": r.nom,
      "Prénom": r.prenom,
      "Service": r.service,
      "Rempli par (N+1)": r.filler,
      "N+2": r.n2,
      ...Object.fromEntries(r.cells.map((c, i) => [String(i + 1), c.code])),
      "Jours": r.jours_travailles,
      "HS (j)": r.nb_heures_sup,
      "Astr. (j)": r.nb_jours_astreintes,
      "H. normales": r.heures_normales,
      "H. HS": r.heures_sup_effectuees,
      "H. astreinte": r.heures_astreintes,
      "H. total": r.heures_totales,
    })), periodInfo(`${year}-${mm}-01`, `${year}-${mm}-${last}`));
  };

  let lastGroup = "";

  return (
    <div className="px-4 md:px-6 pb-10">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003c71] flex items-center justify-center shadow shrink-0">
            <TableProperties size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap">Pointage HS &amp; Astreinte</h1>
            <p className="text-xs text-slate-500">Présence, heures sup. et astreintes, jour par jour</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl">
            <button onClick={() => shiftMonth(-1)} className="p-2 text-slate-500 hover:text-slate-800"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-slate-700 w-32 text-center">{MONTHS_FR[month - 1]} {year}</span>
            <button onClick={() => shiftMonth(1)} className="p-2 text-slate-500 hover:text-slate-800"><ChevronRight size={16} /></button>
          </div>
          {grid && (grid.is_rh ? grid.fillers.length > 0 : grid.fillers.length > 1) && (
            <select value={filler} onChange={(e) => setFiller(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white max-w-[220px]">
              <option value="">Tous les responsables</option>
              {grid.fillers.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white w-44" />
          </div>
          <button onClick={exportExcel} disabled={!rows.length}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50">
            <FileDown size={15} /> Exporter
          </button>
          {grid?.is_rh && (
            <>
              <button onClick={() => navigate("/rh/om-forfaits")}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-[#003c71] text-white hover:bg-[#002b52]">
                <Banknote size={15} /> Forfaits
              </button>
              {grid.lock.past_deadline && !grid.lock.force_unlock ? (
                <button onClick={activateSession} disabled={lockBusy} title="Rouvrir la saisie après la date limite"
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 disabled:opacity-60">
                  {lockBusy ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />} Nouvelle session
                </button>
              ) : (
                <button onClick={toggleLock} disabled={lockBusy}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border disabled:opacity-60 ${grid.lock.rh_locked
                    ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"}`}>
                  {grid.lock.rh_locked ? <Lock size={15} /> : <LockOpen size={15} />}
                  {grid.lock.rh_locked ? "Saisie fermée" : "Saisie ouverte"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {grid && !grid.editable && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-sm mb-3">
          <Lock size={15} className="shrink-0" /> {grid.lock_reason} Consultation seulement.
        </div>
      )}

      {/* Résumé + légende */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
        <div className="flex gap-2">
          {[["Employés", rows.length, "text-slate-700"], ["Jours travaillés", totals.jours, "text-emerald-700"],
            ["Heures sup. (j)", totals.hs, "text-amber-600"], ["Astreintes (j)", totals.astr, "text-purple-600"]].map(([l, v, c]) => (
            <div key={l as string} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5">
              <div className="text-[10px] text-slate-500">{l}</div>
              <div className={`text-base font-bold ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap md:ml-auto">
          {CODES.map((c) => (
            <span key={c} className="flex items-center gap-1">
              <span className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${CODE_META[c].cls}`}>{c}</span>
              {CODE_META[c].label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded border border-dashed border-emerald-500 bg-emerald-50" /> Automatique
          </span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> HS / astreinte possible</span>
          {saving && <Loader2 size={14} className="animate-spin text-[#003c71]" />}
        </div>
      </div>

      {/* Grille */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#003c71]" /></div>
      ) : !grid || rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          {grid?.is_rh ? "Aucun employé pour ce filtre." : "Aucun employé à remplir pour vous."}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-auto max-h-[calc(100vh-16rem)]">
          <table className="text-[11px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-30 bg-slate-50 text-left px-3 py-2 min-w-[220px] border-b border-r border-slate-200 text-slate-600">Employé</th>
                {grid.days.map((d) => (
                  <th key={d.day} title={d.holiday || undefined}
                    className={`px-0.5 py-1 min-w-[30px] border-b border-slate-200 font-medium ${d.holiday ? "bg-amber-50 text-amber-700" : d.weekday >= 5 ? "bg-slate-100 text-slate-400" : "text-slate-600"}`}>
                    <div>{WEEKDAYS[d.weekday]}</div>
                    <div className="font-bold">{d.day}</div>
                  </th>
                ))}
                {["Jours", "HS(j)", "Astr(j)", "H.norm", "H.HS", "H.Astr", "H.Total"].map((h) => (
                  <th key={h} className="px-2 py-1 border-b border-l border-slate-200 bg-[#003c71] text-white font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const group = row.filler || "Sans responsable";
                const header = showFillerGroups && group !== lastGroup;
                lastGroup = group;
                return [
                  header && (
                    <tr key={`g-${group}`}>
                      <td colSpan={grid.days.length + 8}
                        className="sticky left-0 bg-[#003c71]/5 px-3 py-1.5 text-[11px] font-semibold text-[#003c71] border-b border-slate-200">
                        Rempli par : {group}
                      </td>
                    </tr>
                  ),
                  <tr key={row.employee_id} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-3 py-1 border-b border-r border-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-700 truncate">{row.nom} {row.prenom}</div>
                          <div className="text-slate-400 truncate">{row.matricule}{row.service ? ` · ${row.service}` : ""}</div>
                        </div>
                        {grid.editable && (
                          <button title="Remplir les jours vides avec un code"
                            onClick={(e) => openPicker("fill", row, e.currentTarget)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#003c71] hover:bg-[#003c71]/10 shrink-0">
                            <Paintbrush size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="border-b border-slate-100 p-0.5">
                        <button onClick={(e) => openPicker("cell", row, e.currentTarget, i + 1)} title={cellTitle(cell)}
                          className={`relative w-full h-7 min-w-[26px] rounded ${cellClass(cell, offDays.has(i + 1))} ${grid.editable ? "" : "cursor-default"}`}>
                          {cell.code || "·"}
                          {cell.hint && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        </button>
                      </td>
                    ))}
                    {[row.jours_travailles, row.nb_heures_sup, row.nb_jours_astreintes, row.heures_normales,
                      row.heures_sup_effectuees, row.heures_astreintes, row.heures_totales].map((v, k) => (
                      <td key={k} className={`px-2 text-center border-b border-l border-slate-100 tabular-nums font-semibold ${
                        k === 1 && v ? "text-amber-600" : k === 2 && v ? "text-purple-600" : "text-slate-700"}`}>{v}</td>
                    ))}
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sélecteur de code */}
      {picker && grid && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
          <div className="fixed z-50 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-2" style={{ left: picker.x, top: picker.y }}>
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-[11px] font-semibold text-slate-600 truncate">
                {picker.mode === "fill" ? `Remplir les jours vides · ${picker.row.nom}` : `Le ${picker.day} ${MONTHS_FR[month - 1].toLowerCase()} · ${picker.row.nom}`}
              </span>
              <button onClick={() => setPicker(null)} className="text-slate-400 hover:text-slate-600"><XIcon size={14} /></button>
            </div>
            {picker.mode === "cell" && picker.day && picker.row.cells[picker.day - 1].hint && (
              <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mb-1.5">💡 {picker.row.cells[picker.day - 1].hint}</div>
            )}
            <div className="flex flex-col gap-1">
              {CODES.map((c) => (
                <button key={c} onClick={() => choose(c)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:brightness-95 ${CODE_META[c].cls}`}>
                  <span className="w-5 font-bold text-center">{c}</span>{CODE_META[c].label}
                </button>
              ))}
            </div>
            {picker.mode === "cell" ? (
              <button onClick={() => choose("")}
                className="w-full text-left text-xs px-2 py-1.5 mt-1 border-t border-slate-100 text-rose-600 hover:bg-rose-50 rounded-md">
                Effacer la saisie (revenir à l'automatique)
              </button>
            ) : (
              <button onClick={clearRow}
                className="w-full text-left text-xs px-2 py-1.5 mt-1 border-t border-slate-100 text-rose-600 hover:bg-rose-50 rounded-md">
                Vider la ligne (toutes les saisies du mois)
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
