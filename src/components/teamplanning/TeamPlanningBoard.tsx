import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BarChart3, CalendarRange, ChevronLeft, ChevronRight, FileSpreadsheet, Layers, ListChecks, Loader2, Paintbrush, Search, Settings2, Table2, Upload, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import {
  CellKind, ImportSummary, PlanningCell, PlanningChange, PlanningGrid, PlanningRow, teamPlanningService,
} from "@/services/teamPlanningService";
import ProjectCodesModal from "@/components/teamplanning/ProjectCodesModal";
import BusinessLinesModal from "@/components/teamplanning/BusinessLinesModal";
import FillRatesPanel from "@/components/teamplanning/FillRatesPanel";

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

const KIND_STYLE: Record<CellKind, string> = {
  project: "bg-emerald-50 text-emerald-800",
  weekend: "bg-slate-100 text-slate-400",
  holiday: "bg-amber-50 text-amber-700",
  leave:   "bg-sky-100 text-sky-700",
  empty:   "bg-white border border-dashed border-rose-200 text-rose-300 hover:bg-rose-50",
};
// Projet rempli automatiquement d'après le pointage ou une mission validée (modifiable)
const AUTO_PROJECT_STYLE = "bg-white border border-dashed border-emerald-400 text-emerald-700 italic";
const ABSENT_STYLE = "bg-rose-50 border border-dashed border-rose-300 text-rose-400 hover:bg-rose-100";

function cellStyle(cell: PlanningCell): string {
  if (cell.kind === "project" && cell.auto) return AUTO_PROJECT_STYLE;
  if (cell.kind === "empty" && cell.source === "absent") return ABSENT_STYLE;
  return `${KIND_STYLE[cell.kind]} ${cell.auto ? "" : "font-semibold"}`;
}

function cellTitle(cell: PlanningCell): string {
  if (cell.source === "fixe") return `${cell.value} — code projet fixe, rempli d'office (100 %)`;
  if (cell.source === "forfait") return `${cell.value} — rempli d'office (100 %), aucun code projet à saisir`;
  if (cell.kind === "project" && cell.auto)
    return `${cell.value} — rempli automatiquement (${cell.source === "mission" ? "mission validée" : "a pointé ce jour"}). Cliquez pour changer.`;
  if (cell.kind === "empty" && cell.source === "absent") return "Aucun pointage ce jour : à renseigner";
  if (cell.kind === "empty" && cell.source) return "A pointé ce jour : choisissez le projet";
  return cell.value || "À renseigner";
}

const SHORT: Record<string, string> = { "Week-End": "WE", "Jour férié": "Férié", "Jour congés": "Congé" };

type Picker = { mode: "cell" | "fill"; row: PlanningRow; day?: number; x: number; y: number };

/** rhPage : page RH (/rh/team-planning) — Business Lines, Remplissage et rapport n'apparaissent que là */
export default function TeamPlanningBoard({ rhPage = false }: { rhPage?: boolean }) {
  const today = new Date();
  const [year, setYear]       = useState(today.getFullYear());
  const [month, setMonth]     = useState(today.getMonth() + 1);
  const [bl, setBl]           = useState("");
  const [manager, setManager] = useState("");
  const [search, setSearch]   = useState("");
  const [grid, setGrid]       = useState<PlanningGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [picker, setPicker]   = useState<Picker | null>(null);
  const [query, setQuery]     = useState("");
  const [showCodes, setShowCodes] = useState(false);
  const [showBls, setShowBls] = useState(false);
  const [view, setView] = useState<"grid" | "fill">("grid");
  const [showPlatform, setShowPlatform] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filters = useMemo(() => ({ year, month, business_line: bl, manager }), [year, month, bl, manager]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGrid(await teamPlanningService.getGrid(filters));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Impossible de charger le planning");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = grid?.rows ?? [];
    if (!q) return all;
    return all.filter((r) => `${r.matricule} ${r.nom} ${r.prenom}`.toLowerCase().includes(q));
  }, [grid, search]);

  const stats = useMemo(() => {
    const cells = (grid?.rows ?? []).flatMap((r) => r.cells);
    const filled = cells.filter((c) => c.value).length;
    return { total: cells.length, filled, pct: cells.length ? Math.round((filled * 1000) / cells.length) / 10 : 0 };
  }, [grid]);

  const applyChanges = async (changes: PlanningChange[]) => {
    if (!grid || changes.length === 0) return;
    setSaving(true);
    try {
      const res = await teamPlanningService.save(grid.year, grid.month, changes);
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

  const openPicker = (mode: Picker["mode"], row: PlanningRow, el: HTMLElement, day?: number) => {
    const rect = el.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 260);
    const y = rect.bottom + 300 > window.innerHeight ? Math.max(8, rect.top - 300) : rect.bottom + 4;
    setQuery("");
    setPicker({ mode, row, day, x, y });
  };

  const onCellClick = (row: PlanningRow, cell: PlanningCell, day: number, el: HTMLElement) => {
    if (cell.kind === "leave" && cell.auto) {
      toast("Congé approuvé dans Gestion des congés : non modifiable ici.");
      return;
    }
    openPicker("cell", row, el, day);
  };

  const clearRow = () => {
    if (!picker) return;
    const { row } = picker;
    setPicker(null);
    const changes = row.cells
      .map((c, i) => ({ c, day: i + 1 }))
      .filter(({ c }) => !c.auto)
      .map(({ day }) => ({ employee_id: row.employee_id, day, value: "" }));
    if (changes.length === 0) toast("Aucune saisie à effacer sur cette ligne.");
    else if (window.confirm(`Effacer les ${changes.length} saisie(s) de ${row.nom} ${row.prenom} ce mois-ci ?`)) applyChanges(changes);
  };

  const choose = (value: string) => {
    if (!picker) return;
    const { row, day, mode } = picker;
    setPicker(null);
    if (mode === "cell" && day) {
      applyChanges([{ employee_id: row.employee_id, day, value }]);
    } else {
      const changes = row.cells
        .map((c, i) => ({ c, day: i + 1 }))
        .filter(({ c }) => c.kind === "empty" || (c.kind === "project" && c.auto))
        .map(({ day: d }) => ({ employee_id: row.employee_id, day: d, value }));
      if (changes.length === 0) toast("Aucun jour à remplir pour cet employé.");
      else applyChanges(changes);
    }
  };

  const options = useMemo(() => {
    if (!picker || !grid) return [];
    const bls = picker.row.business_lines?.length ? picker.row.business_lines : [picker.row.business_line];
    const codes = [...new Set(bls.flatMap((b) => grid.projects[b] ?? []))];
    const list = picker.mode === "cell" ? [...codes, ...grid.special_values] : codes;
    const q = query.trim().toLowerCase();
    return q ? list.filter((v) => v.toLowerCase().includes(q)) : list;
  }, [picker, grid, query]);

  const fillReport = async () => {
    try {
      const blob = await teamPlanningService.fillReport(filters);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Remplissage_team_planning_${bl || "All_BL"}_${year}-${String(month).padStart(2, "0")}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Rapport impossible");
    }
  };

  // Import en deux temps : aperçu (rien n'est enregistré), puis confirmation
  const [pendingImport, setPendingImport] = useState<{ file: File; summary: ImportSummary } | null>(null);
  const [importing, setImporting] = useState(false);

  const previewImport = async (file: File) => {
    const t = toast.loading("Lecture du fichier…");
    try {
      const summary = await teamPlanningService.importFile(file, true);
      toast.dismiss(t);
      setPendingImport({ file, summary });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Fichier illisible", { id: t });
    }
  };

  const exportGaps = async () => {
    if (!pendingImport) return;
    try {
      const blob = await teamPlanningService.exportImportGaps(pendingImport.file);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Matricules_non_importes.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Export impossible");
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setImporting(true);
    try {
      await importFile(pendingImport.file);
      setPendingImport(null);
    } finally {
      setImporting(false);
    }
  };

  const importFile = async (file: File) => {
    const t = toast.loading("Import du fichier…");
    try {
      const s = await teamPlanningService.importFile(file);
      if (s.rows !== undefined) {
        toast.success("Liste des agents mise à jour — les saisies déjà faites sont conservées", { id: t, duration: 6000 });
        load();
        return;
      }
      const projets = Object.entries(s.projects ?? {}).map(([k, v]) => `${k} : ${v}`).join(", ");
      toast.success(`Fichier importé — ${projets}${s.new_projects ? ` · ${s.new_projects} nouveau(x) code(s) ajouté(s)` : ""}`, { id: t, duration: 6000 });
      if (s.bl_to_update?.length) {
        toast(`${s.bl_to_update.length} employé(s) ont une Business Line différente du fichier dans leur fiche : ${s.bl_to_update.slice(0, 8).join(", ")}${s.bl_to_update.length > 8 ? "…" : ""}`, { duration: 12000 });
      }
      if (s.manager_to_update?.length) {
        toast(`${s.manager_to_update.length} employé(s) ont un N+1 différent du LINE MANAGER du fichier (à corriger dans la fiche employé) : ${s.manager_to_update.slice(0, 6).join(", ")}${s.manager_to_update.length > 6 ? "…" : ""}`, { duration: 15000 });
      }
      if (s.unknown_employees.length) toast(`Matricules du fichier absents de l'application : ${s.unknown_employees.slice(0, 10).join(", ")}`, { duration: 10000 });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Import impossible", { id: t });
    }
  };

  // Regroupement visuel par Business Line + line manager
  let lastGroup = "";

  return (
    <div className="px-4 md:px-6 pb-10">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003c71] flex items-center justify-center shadow shrink-0">
            <CalendarRange size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap">Team Planning</h1>
            <p className="text-xs text-slate-500">Projet (CECO) de chaque employé, jour par jour</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl">
            <button onClick={() => shiftMonth(-1)} className="p-2 text-slate-500 hover:text-slate-800"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-slate-700 w-32 text-center">{MONTHS_FR[month - 1]} {year}</span>
            <button onClick={() => shiftMonth(1)} className="p-2 text-slate-500 hover:text-slate-800"><ChevronRight size={16} /></button>
          </div>
          {rhPage && view === "fill" && (
            <button onClick={() => setView("grid")} title="Revenir à la grille de saisie"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-[#003c71]/10 text-[#003c71] font-semibold hover:bg-[#003c71]/15">
              <ArrowLeft size={14} /> Taux de remplissage · retour au planning
            </button>
          )}
          {grid && grid.business_lines.length > 1 && (
            <select value={bl} onChange={(e) => setBl(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white">
              <option value="">Toutes les BL</option>
              {grid.business_lines.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {grid && grid.managers.length > 1 && (
            <select value={manager} onChange={(e) => setManager(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white max-w-[220px]">
              <option value="">Tous les line managers</option>
              {grid.managers.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white w-44" />
          </div>
          {rhPage && <button onClick={fillReport}
            title="Rapport global : pour chaque employé, chaque code projet avec son pourcentage et le cumul"
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
            <FileSpreadsheet size={15} /> Rapport de remplissage
          </button>}
          {rhPage && grid?.is_rh && (
            <button onClick={() => fileRef.current?.click()}
              title="Importer la liste des agents (BL, responsables, codes projets) sans écraser les saisies"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
              <Upload size={15} /> Importer
            </button>
          )}
          {(rhPage || grid?.is_rh) && (
            <button onClick={() => setShowPlatform(true)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-[#003c71] text-white font-semibold hover:bg-[#002b52]">
              <Settings2 size={15} /> Gestion plateforme
            </button>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) previewImport(f); }} />
        </div>
      </div>

      {rhPage && view === "fill" ? <FillRatesPanel filters={filters} search={search} /> : <>
      {/* Avancement + légende */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
        <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700">
              {stats.pct >= 100 ? "Planning complet" : `Reste ${stats.total - stats.filled} jour(s) à renseigner`}
            </span>
            <span className="text-slate-500">{stats.filled} / {stats.total} — {stats.pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${stats.pct >= 100 ? "bg-emerald-500" : "bg-[#003c71]"}`}
              style={{ width: `${Math.min(stats.pct, 100)}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
          {([["project", "Projet"], ["leave", "Congé (auto)"], ["holiday", "Férié (auto)"], ["weekend", "Week-end (auto)"], ["empty", "À renseigner"]] as [CellKind, string][]).map(([k, l]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded border border-slate-200 ${KIND_STYLE[k]}`} /> {l}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${AUTO_PROJECT_STYLE}`} /> Projet (auto, pointage)
          </span>
          <span className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded ${ABSENT_STYLE}`} /> Sans pointage
          </span>
          {saving && <Loader2 size={14} className="animate-spin text-[#003c71]" />}
        </div>
      </div>

      {/* Grille */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#003c71]" /></div>
      ) : !grid || rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          {!grid?.has_projects
            ? (grid?.is_rh
                ? "Aucun code projet actif. Cliquez sur « Importer le fichier » (fichier Excel Team planning) ou ajoutez des codes avec « Codes projets »."
                : "Le Team Planning n'est pas encore configuré par les RH.")
            : grid?.is_rh
              ? "Aucun employé actif n'a une Business Line correspondant aux codes projets. Renseignez la Business Line (ex. BL1) dans la fiche employé."
              : "Aucun employé de votre équipe (directe ou de vos sous-responsables) n'a de Business Line concernée par le Team Planning."}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-auto max-h-[calc(100vh-15rem)]">
          <table className="text-[11px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-30 bg-slate-50 text-left px-3 py-2 min-w-[230px] border-b border-r border-slate-200 text-slate-600">
                  Employé
                </th>
                {grid.days.map((d) => (
                  <th key={d.day} title={d.holiday || undefined}
                    className={`px-0.5 py-1 min-w-[58px] border-b border-slate-200 font-medium ${d.holiday ? "bg-amber-50 text-amber-700" : d.weekday >= 5 ? "bg-slate-100 text-slate-400" : "text-slate-600"}`}>
                    <div>{WEEKDAYS[d.weekday]}</div>
                    <div className="font-bold">{d.day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const group = `${row.business_line} · ${row.line_manager || "Sans line manager"}`;
                const header = group !== lastGroup;
                lastGroup = group;
                const empty = row.cells.filter((c) => c.kind === "empty").length;
                return [
                  header && (
                    <tr key={`g-${group}`}>
                      <td colSpan={grid.days.length + 1}
                        className="sticky left-0 bg-[#003c71]/5 px-3 py-1.5 text-[11px] font-semibold text-[#003c71] border-b border-slate-200">
                        {group}
                      </td>
                    </tr>
                  ),
                  <tr key={row.employee_id} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-3 py-1 border-b border-r border-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-700 truncate">{row.nom} {row.prenom}</div>
                          <div className="text-slate-400">{row.matricule}{empty > 0 && <span className="ml-1.5 text-rose-500">· {empty} vide(s)</span>}
                            {row.auto_filled && <span className="ml-1.5 text-emerald-600 font-semibold">· {row.fixed_code ? "code fixe" : "100 % d'office"}</span>}</div>
                        </div>
                        {!row.auto_filled && <div className="flex shrink-0">
                          <button title="Remplir les jours vides et automatiques avec un projet"
                            onClick={(e) => openPicker("fill", row, e.currentTarget)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#003c71] hover:bg-[#003c71]/10">
                            <Paintbrush size={14} />
                          </button>
                        </div>}
                      </div>
                    </td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="border-b border-slate-100 p-0.5">
                        <button
                          onClick={(e) => onCellClick(row, cell, i + 1, e.currentTarget)}
                          title={cellTitle(cell)}
                          className={`w-full h-7 rounded truncate px-0.5 ${cellStyle(cell)}`}>
                          {SHORT[cell.value] ?? (cell.value || "·")}
                        </button>
                      </td>
                    ))}
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      </>}

      {/* Sélecteur de projet */}
      {picker && grid && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
          <div className="fixed z-50 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-2" style={{ left: picker.x, top: picker.y }}>
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-[11px] font-semibold text-slate-600 truncate">
                {picker.mode === "fill" ? "Remplir les jours vides" : `Le ${picker.day} ${MONTHS_FR[month - 1].toLowerCase()}`} · {picker.row.business_line}
              </span>
              <button onClick={() => setPicker(null)} className="text-slate-400 hover:text-slate-600"><XIcon size={14} /></button>
            </div>
            <p className="px-1 pb-1.5 text-[10px] text-slate-400">Codes projets de {(picker.row.business_lines?.length ? picker.row.business_lines : [picker.row.business_line]).join(" / ")} uniquement</p>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Code projet ${picker.row.business_line}…`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && options[0]) choose(options[0]);
                if (e.key === "Escape") setPicker(null);
              }}
              className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 mb-1.5 focus:outline-none focus:ring-2 focus:ring-[#003c71]/20" />
            <div className="max-h-56 overflow-auto">
              {options.map((v) => (
                <button key={v} onClick={() => choose(v)}
                  className="w-full text-left text-sm px-2 py-1 rounded-md hover:bg-[#003c71]/10 text-slate-700">
                  {v}
                </button>
              ))}
              {options.length === 0 && <div className="text-xs text-slate-400 px-2 py-2">Aucun code trouvé</div>}
            </div>
            {picker.mode === "cell" ? (
              <button onClick={() => choose("")}
                className="w-full text-left text-xs px-2 py-1.5 mt-1 border-t border-slate-100 text-rose-600 hover:bg-rose-50 rounded-md">
                Effacer la saisie
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
      {pendingImport && (() => {
        const s = pendingImport.summary;
        const agents = s.rows !== undefined;
        const lines: [string, number | undefined][] = agents ? [
          ["Lignes lues dans le fichier", s.rows],
          ["Employés dont la Business Line sera mise à jour", s.bl_updated],
          ["Employés dont le responsable sera mis à jour", s.managers_updated],
          ["Business Lines ajoutées", s.new_business_lines],
          ["Codes projets ajoutés", s.new_projects],
          ["Employés avec un code projet fixe (remplis d'office, 100 %)", s.fixed_codes],
        ] : [
          ["Codes projets ajoutés", s.new_projects],
          ["Saisies importées", s.entries],
          ["Saisies ignorées", s.ignored_entries],
        ];
        const notes: [string, string[] | undefined][] = [
          ["Matricules en motif de sortie dans les fiches employés (ignorés)", s.exited_employees],
          ["Matricules absents de l'application (ignorés)", s.unknown_employees],
          ["Plusieurs BL : l'employé saisit les codes projets de toutes ses BL", s.multi_bl],
          ["Responsables introuvables ou ambigus (non affectés)", s.unresolved_managers],
        ];
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !importing && setPendingImport(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="import-title"
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 id="import-title" className="text-lg font-bold text-[#003c71]">Importer « {pendingImport.file.name} »</h2>
                <p className="text-sm text-slate-500">Rien n'est enregistré avant votre confirmation.</p>
              </div>
              <div className="px-6 py-4 space-y-3 text-sm">
                <ul className="space-y-1.5">
                  {lines.map(([label, n]) => (
                    <li key={label} className="flex justify-between gap-3"><span className="text-slate-600">{label}</span><strong className="text-[#003c71]">{n ?? 0}</strong></li>
                  ))}
                </ul>
                {notes.filter(([, l]) => l?.length).map(([label, l]) => (
                  <details key={label} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <summary className="cursor-pointer font-semibold">{l!.length} — {label}</summary>
                    <p className="mt-1 break-words">{l!.slice(0, 40).join(", ")}{l!.length > 40 ? "…" : ""}</p>
                  </details>
                ))}
                {agents && !!s.managers?.length && (
                  <details className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <summary className="cursor-pointer font-semibold">{s.managers.length} responsable(s) avec leur équipe</summary>
                    <p className="mt-1 break-words">{s.managers.join(", ")}</p>
                  </details>
                )}
                {agents && !!((s.exited_employees?.length ?? 0) + s.unknown_employees.length) && (
                  <button onClick={exportGaps}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-[#003c71]">
                    Exporter les matricules inconnus et sortis (Excel)
                  </button>
                )}
                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  Les saisies du planning, les Business Lines et les codes projets déjà présents sont conservés : l'import ne fait que des ajouts et des mises à jour.
                </p>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
                <button onClick={() => setPendingImport(null)} disabled={importing}
                  className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50">Annuler</button>
                <button onClick={confirmImport} disabled={importing}
                  className="px-4 py-2 text-sm rounded-xl bg-[#003c71] text-white font-semibold hover:bg-[#002b52] disabled:opacity-60">
                  {importing ? "Import…" : "Confirmer l'import"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {showCodes && <ProjectCodesModal onClose={() => setShowCodes(false)} onChanged={load} />}
      {showBls && <BusinessLinesModal onClose={() => setShowBls(false)} onChanged={load} />}
      {showPlatform && (() => {
        const items: { key: string; label: string; desc: string; Icon: typeof Layers; run: () => void; show: boolean }[] = [
          { key: "grid", label: "Planning", desc: "Grille de saisie des projets, jour par jour", Icon: Table2,
            run: () => setView("grid"), show: rhPage },
          { key: "fill", label: "Taux de remplissage", desc: "Pourcentage de chaque code projet et cumul par employé", Icon: BarChart3,
            run: () => setView("fill"), show: rhPage },
          { key: "bl", label: "Business Lines", desc: "Créer une BL, ses codes projets, y rattacher les employés", Icon: Layers,
            run: () => setShowBls(true), show: rhPage && !!grid?.is_rh },
          { key: "codes", label: "Codes projets", desc: "Ajouter, désactiver ou réactiver des codes", Icon: ListChecks,
            run: () => setShowCodes(true), show: !!grid?.is_rh },
          { key: "import", label: "Importer le fichier", desc: "Fichier Excel Team Planning (codes projets et saisies)", Icon: Upload,
            run: () => fileRef.current?.click(), show: !!grid?.is_rh },
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPlatform(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby="platform-title"
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h2 id="platform-title" className="text-lg font-bold text-[#003c71]">Gestion plateforme</h2>
                  <p className="text-sm text-slate-500">Choisissez une fonctionnalité</p>
                </div>
                <button onClick={() => setShowPlatform(false)} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><XIcon size={16} /></button>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.filter((i) => i.show).map(({ key, label, desc, Icon, run }) => {
                  const current = (key === "grid" || key === "fill") && view === key;
                  return (
                    <button key={key} onClick={() => { setShowPlatform(false); run(); }}
                      className={`text-left flex gap-3 p-4 rounded-xl border transition ${current
                        ? "border-[#003c71] bg-[#003c71]/5" : "border-slate-200 hover:border-[#003c71]/40 hover:bg-slate-50"}`}>
                      <span className="w-10 h-10 rounded-xl bg-[#003c71]/10 text-[#003c71] flex items-center justify-center shrink-0"><Icon size={18} /></span>
                      <span>
                        <span className="block font-semibold text-slate-800">{label}{current && <span className="ml-2 text-xs font-normal text-[#003c71]">(affiché)</span>}</span>
                        <span className="block text-sm text-slate-500">{desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
