// Pointage HS & Astreinte : grille jour par jour sur une période de saisie choisie par la RH.
// Codes : X présent, Y heures sup., Z astreinte, C congés, A sortie, M maladie, D Days Off (BL avec l'option).
// Les cases en pointillés sont remplies automatiquement (pointage, congés, sorties) ; une saisie les remplace.
// Accès : la RH voit tout ; un éditeur voit tous les agents des BL qui lui sont attribuées.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote, CalendarPlus, CheckCircle2, FileDown, Loader2, Lock, Network, Paintbrush, Pencil, PlayCircle,
  RotateCcw, Search, TableProperties, Trash2, X as XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  CampaignStatus, HsCampaign, HsCell, HsChange, HsCode, HsGrid, HsRow, NO_BL, campaignLabel, frDate,
  hsAstreinteService,
} from "@/services/hsAstreinteService";
import { exportAttendanceXLSX, periodInfo } from "@/utils/attendanceExport";
import CampaignModal from "@/components/hsastreinte/CampaignModal";
import BusinessLinesModal from "@/components/hsastreinte/BusinessLinesModal";

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export const CODE_META: Record<Exclude<HsCode, "">, { label: string; cls: string; dot: string }> = {
  X: { label: "Présent",          cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  Y: { label: "Heures sup.",      cls: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  Z: { label: "Astreinte",        cls: "bg-purple-100 text-purple-700",   dot: "bg-purple-500" },
  C: { label: "Congés",           cls: "bg-sky-100 text-sky-700",         dot: "bg-sky-500" },
  A: { label: "Sortie",           cls: "bg-orange-100 text-orange-700",   dot: "bg-orange-500" },
  M: { label: "Maladie",          cls: "bg-rose-100 text-rose-700",       dot: "bg-rose-500" },
  D: { label: "Days Off",         cls: "bg-teal-100 text-teal-700",       dot: "bg-teal-500" },
};
const ALL_CODES = Object.keys(CODE_META) as Exclude<HsCode, "">[];
const codesFor = (row: HsRow) => ALL_CODES.filter((c) => c !== "D" || row.days_off_allowed);

const STATUS_META: Record<CampaignStatus, { label: string; cls: string }> = {
  DRAFT:  { label: "Brouillon", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  OPEN:   { label: "Saisie ouverte", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CLOSED: { label: "Clôturée", cls: "bg-red-50 text-red-700 border-red-200" },
};

const SOURCE_LABEL: Record<string, string> = {
  pointage: "a pointé ce jour", mission: "mission validée", conge: "congé approuvé",
  maladie: "congé maladie approuvé", sortie: "sortie approuvée",
};

const blLabel = (bl: string) => (bl === NO_BL || !bl ? "Sans BL" : bl);

function cellClass(cell: HsCell, offDay: boolean): string {
  if (cell.locked && !cell.code) return "bg-slate-200/70 text-slate-300 cursor-not-allowed";
  if (!cell.code) return offDay ? "bg-slate-100 text-slate-300" : "bg-white border border-dashed border-slate-200 text-slate-300 hover:bg-slate-50";
  const base = CODE_META[cell.code as Exclude<HsCode, "">].cls;
  return cell.auto ? `${base} border border-dashed border-current italic opacity-80` : `${base} font-bold`;
}

function cellTitle(cell: HsCell, exitDate: string | null): string {
  const parts: string[] = [];
  if (cell.code) {
    const label = CODE_META[cell.code as Exclude<HsCode, "">].label;
    parts.push(cell.auto ? `${cell.code} — ${label}, rempli automatiquement (${SOURCE_LABEL[cell.source ?? ""] ?? "auto"})` : `${cell.code} — ${label}`);
  } else parts.push(cell.locked ? "" : "À renseigner");
  if (cell.locked && exitDate) parts.push(`Sorti le ${frDate(exitDate)}`);
  if (cell.hint) parts.push(`💡 ${cell.hint}`);
  return parts.filter(Boolean).join("\n");
}

type Picker = { mode: "cell" | "fill"; row: HsRow; index?: number; x: number; y: number };

export default function HsAstreinteBoard() {
  const navigate = useNavigate();
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [bl, setBl] = useState("");
  const [search, setSearch] = useState("");
  const [grid, setGrid] = useState<HsGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [busy, setBusy] = useState(false);
  const [campaignModal, setCampaignModal] = useState<"new" | "edit" | null>(null);
  const [showBls, setShowBls] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = await hsAstreinteService.getGrid(campaignId, bl);
      setGrid(g);
      setError("");
      if (g.campaign && g.campaign.id !== campaignId) setCampaignId(g.campaign.id);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? "Impossible de charger le pointage";
      setError(msg);
      setGrid(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, bl]);

  useEffect(() => { load(); }, [load]);

  const campaign = grid?.campaign ?? null;
  const showBlGroups = (grid?.business_lines.length ?? 0) > 1;
  const hasDaysOff = !!grid?.rows.some((r) => r.days_off_allowed || r.nb_days_off > 0);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = grid?.rows ?? [];
    return q ? all.filter((r) => `${r.matricule} ${r.nom} ${r.prenom} ${r.service} ${r.bl}`.toLowerCase().includes(q)) : all;
  }, [grid, search]);

  const totals = useMemo(() => rows.reduce((t, r) => ({
    jours: t.jours + r.jours_travailles, hs: t.hs + r.nb_heures_sup, astr: t.astr + r.nb_jours_astreintes,
    off: t.off + r.nb_days_off,
  }), { jours: 0, hs: 0, astr: 0, off: 0 }), [rows]);

  const offDays = useMemo(() => new Set((grid?.days ?? []).map((d, i) => (d.weekday >= 5 || d.holiday ? i : -1)).filter((i) => i >= 0)), [grid]);

  const applyChanges = async (changes: HsChange[]) => {
    if (!campaign || changes.length === 0) return;
    setSaving(true);
    try {
      const res = await hsAstreinteService.save(campaign.id, changes);
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

  const openPicker = (mode: Picker["mode"], row: HsRow, el: HTMLElement, index?: number) => {
    if (!grid?.editable) {
      toast(grid?.lock_reason || "Saisie fermée pour cette période.");
      return;
    }
    if (index !== undefined && row.cells[index].locked) {
      toast(`${row.nom} ${row.prenom} est sorti le ${frDate(row.exit_date!)}.`);
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 240);
    const y = rect.bottom + 340 > window.innerHeight ? Math.max(8, rect.top - 340) : rect.bottom + 4;
    setPicker({ mode, row, index, x, y });
  };

  const choose = (code: HsCode) => {
    if (!picker || !grid) return;
    const { row, index, mode } = picker;
    setPicker(null);
    if (mode === "cell" && index !== undefined) {
      applyChanges([{ employee_id: row.employee_id, date: grid.days[index].date, code }]);
      return;
    }
    // Pinceau : jours vides (hors week-ends / fériés / après la sortie) et jours « présent » remplis automatiquement
    const changes = row.cells
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => !c.locked && ((!c.code && !offDays.has(i)) || (c.auto && c.code === "X")))
      .map(({ i }) => ({ employee_id: row.employee_id, date: grid.days[i].date, code }));
    if (changes.length === 0) toast("Aucun jour à remplir pour cet employé.");
    else applyChanges(changes);
  };

  const clearRow = () => {
    if (!picker || !grid) return;
    const { row } = picker;
    setPicker(null);
    const changes = row.cells
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.code && !c.auto)
      .map(({ i }) => ({ employee_id: row.employee_id, date: grid.days[i].date, code: "" as HsCode }));
    if (changes.length === 0) toast("Aucune saisie à effacer sur cette ligne.");
    else if (window.confirm(`Effacer les ${changes.length} saisie(s) de ${row.nom} ${row.prenom} sur cette période ?\nLes valeurs automatiques (pointage, congés, sorties) restent.`)) applyChanges(changes);
  };

  const setStatus = async (status: CampaignStatus) => {
    if (!campaign) return;
    const msg: Record<CampaignStatus, string> = {
      OPEN: campaign.status === "CLOSED" ? "Rouvrir la saisie pour les éditeurs ?" : "Donner le go ? Les éditeurs des BL pourront remplir le pointage de cette période.",
      CLOSED: "Clôturer la période ? Plus personne ne pourra modifier le pointage.",
      DRAFT: "Repasser en brouillon ? La période ne sera plus visible par les éditeurs.",
    };
    if (!window.confirm(msg[status])) return;
    setBusy(true);
    try {
      await hsAstreinteService.setCampaignStatus(campaign.id, status);
      toast.success(status === "OPEN" ? "Campagne de saisie lancée." : status === "CLOSED" ? "Période clôturée." : "Période repassée en brouillon.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Modification impossible");
    } finally {
      setBusy(false);
    }
  };

  const removeCampaign = async () => {
    if (!campaign || !window.confirm(`Supprimer la période « ${campaignLabel(campaign)} » ?\nLes saisies déjà faites sur ces dates sont conservées.`)) return;
    setBusy(true);
    try {
      await hsAstreinteService.deleteCampaign(campaign.id);
      toast.success("Période supprimée.");
      setCampaignId(null);
      if (campaignId === null) load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Suppression impossible");
    } finally {
      setBusy(false);
    }
  };

  const onCampaignSaved = (c: HsCampaign) => {
    if (c.id === campaignId) load();
    else setCampaignId(c.id);
  };

  const exportExcel = () => {
    if (!grid || !campaign || rows.length === 0) return;
    exportAttendanceXLSX("Pointage_HS_Astreinte", rows.map((r) => ({
      "Matricule": r.matricule,
      "Nom": r.nom,
      "Prénom": r.prenom,
      "BL": r.bl,
      "Service": r.service,
      "Sortie": r.exit_date ? frDate(r.exit_date) : "",
      "N+1": r.n1,
      ...Object.fromEntries(r.cells.map((c, i) => [frDate(grid.days[i].date).slice(0, 5), c.code])),
      "Jours": r.jours_travailles,
      "HS (j)": r.nb_heures_sup,
      "Astr. (j)": r.nb_jours_astreintes,
      "Days Off": r.nb_days_off,
      "Astr. payées (j)": Math.max(0, r.nb_jours_astreintes - r.nb_days_off),
      "H. normales": r.heures_normales,
      "H. HS": r.heures_sup_effectuees,
      "H. astreinte": r.heures_astreintes,
      "H. total": r.heures_totales,
    })), periodInfo(campaign.start_date, campaign.end_date));
  };

  const totalHeaders = ["Jours", "HS(j)", "Astr(j)", ...(hasDaysOff ? ["Days Off", "Astr. payées"] : []), "H.norm", "H.HS", "H.Astr", "H.Total"];
  const totalValues = (r: HsRow) => [
    r.jours_travailles, r.nb_heures_sup, r.nb_jours_astreintes,
    ...(hasDaysOff ? [r.nb_days_off, Math.max(0, r.nb_jours_astreintes - r.nb_days_off)] : []),
    r.heures_normales, r.heures_sup_effectuees, r.heures_astreintes, r.heures_totales,
  ];
  const totalCls = (h: string, v: number) => !v ? "text-slate-700"
    : h === "HS(j)" ? "text-amber-600" : h === "Astr(j)" || h === "Astr. payées" ? "text-purple-600" : h === "Days Off" ? "text-teal-600" : "text-slate-700";

  let lastGroup = "";
  const isRh = !!grid?.is_rh;

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
            <p className="text-xs text-slate-500">
              {isRh ? "Présence, heures sup. et astreintes, jour par jour" : grid?.my_bls.length ? `Vos BL : ${grid.my_bls.join(", ")}` : "Présence, heures sup. et astreintes"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {grid && grid.campaigns.length > 0 && (
            <select value={campaignId ?? ""} onChange={(e) => setCampaignId(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white max-w-[280px] font-semibold text-slate-700">
              {grid.campaigns.map((c) => (
                <option key={c.id} value={c.id}>{campaignLabel(c)}{c.status !== "OPEN" ? ` · ${STATUS_META[c.status].label}` : ""}</option>
              ))}
            </select>
          )}
          {campaign && (
            <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border ${STATUS_META[campaign.status].cls}`}>
              {STATUS_META[campaign.status].label}
            </span>
          )}
          {grid && grid.business_lines.length > 1 && (
            <select value={bl} onChange={(e) => setBl(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white">
              <option value="">Toutes les BL</option>
              {grid.business_lines.map((b) => <option key={b} value={b}>{blLabel(b)}</option>)}
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
          {isRh && (
            <>
              <button onClick={() => setShowBls(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
                <Network size={15} /> Accès BL
              </button>
              <button onClick={() => navigate("/rh/om-forfaits")}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-[#003c71] text-white hover:bg-[#002b52]">
                <Banknote size={15} /> Forfaits
              </button>
            </>
          )}
        </div>
      </div>

      {/* Actions RH sur la période */}
      {isRh && (
        <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-xl px-3 py-2 mb-3">
          <button onClick={() => setCampaignModal("new")}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#003c71]/5 text-[#003c71] hover:bg-[#003c71]/10 font-semibold">
            <CalendarPlus size={15} /> Nouvelle période
          </button>
          {campaign && campaign.status !== "CLOSED" && (
            <button onClick={() => setCampaignModal("edit")}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50">
              <Pencil size={14} /> Modifier les dates
            </button>
          )}
          {campaign?.status === "DRAFT" && (
            <>
              <button onClick={() => setStatus("OPEN")} disabled={busy}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />} Donner le go
              </button>
              <button onClick={removeCampaign} disabled={busy}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                <Trash2 size={14} /> Supprimer
              </button>
            </>
          )}
          {campaign?.status === "OPEN" && (
            <>
              <button onClick={() => setStatus("CLOSED")} disabled={busy}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-60">
                <Lock size={14} /> Clôturer la saisie
              </button>
              <button onClick={() => setStatus("DRAFT")} disabled={busy}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-60">
                <RotateCcw size={14} /> Repasser en brouillon
              </button>
            </>
          )}
          {campaign?.status === "CLOSED" && (
            <button onClick={() => setStatus("OPEN")} disabled={busy}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-60">
              <RotateCcw size={14} /> Rouvrir la saisie
            </button>
          )}
          {campaign && (
            <span className="text-xs text-slate-500 ml-auto">
              {campaign.nb_days} jours · du {frDate(campaign.start_date)} au {frDate(campaign.end_date)}
            </span>
          )}
        </div>
      )}

      {campaign?.status === "DRAFT" && isRh && (
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 text-sky-800 rounded-xl px-4 py-2.5 text-sm mb-3">
          <CheckCircle2 size={15} className="shrink-0" />
          Brouillon : seuls les RH voient cette période. Vérifiez les pointages, puis cliquez sur « Donner le go » pour ouvrir la saisie aux éditeurs des BL.
        </div>
      )}
      {grid && campaign && !grid.editable && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-sm mb-3">
          <Lock size={15} className="shrink-0" /> {grid.lock_reason} Consultation seulement.
        </div>
      )}

      {/* Résumé + légende */}
      {campaign && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <div className="flex gap-2 flex-wrap">
            {([["Employés", rows.length, "text-slate-700"], ["Jours travaillés", totals.jours, "text-emerald-700"],
              ["Heures sup. (j)", totals.hs, "text-amber-600"], ["Astreintes (j)", totals.astr, "text-purple-600"],
              ...(hasDaysOff ? [["Days Off", totals.off, "text-teal-600"]] : [])] as [string, number, string][]).map(([l, v, c]) => (
              <div key={l} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                <div className="text-[10px] text-slate-500">{l}</div>
                <div className={`text-base font-bold ${c}`}>{v}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap md:ml-auto">
            {ALL_CODES.filter((c) => c !== "D" || hasDaysOff).map((c) => (
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
      )}

      {/* Grille */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#003c71]" /></div>
      ) : error || !grid ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">{error}</div>
      ) : !campaign ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          {isRh ? (
            <>
              <p className="mb-3">Aucune période de saisie. Créez-en une en choisissant la date de début et de fin.</p>
              <button onClick={() => setCampaignModal("new")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003c71] text-white font-semibold">
                <CalendarPlus size={15} /> Nouvelle période
              </button>
            </>
          ) : grid.lock_reason}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Aucun employé pour ce filtre.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-auto max-h-[calc(100vh-18rem)]">
          <table className="text-[11px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-30 bg-slate-50 text-left px-3 py-2 min-w-[220px] border-b border-r border-slate-200 text-slate-600">Employé</th>
                {grid.days.map((d, i) => {
                  const newMonth = i === 0 || d.day === 1;
                  return (
                    <th key={d.date} title={d.holiday || undefined}
                      className={`px-0.5 py-1 min-w-[30px] border-b border-slate-200 font-medium ${newMonth && i > 0 ? "border-l-2 border-l-slate-300" : ""} ${d.holiday ? "bg-amber-50 text-amber-700" : d.weekday >= 5 ? "bg-slate-100 text-slate-400" : "text-slate-600"}`}>
                      <div className="text-[9px] text-[#003c71] font-semibold h-3">{newMonth ? MONTHS_SHORT[d.month - 1] : ""}</div>
                      <div>{WEEKDAYS[d.weekday]}</div>
                      <div className="font-bold">{d.day}</div>
                    </th>
                  );
                })}
                {totalHeaders.map((h) => (
                  <th key={h} className={`px-2 py-1 border-b border-l border-slate-200 text-white font-semibold whitespace-nowrap ${h === "Days Off" ? "bg-teal-700" : "bg-[#003c71]"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const group = blLabel(row.bl);
                const header = showBlGroups && group !== lastGroup;
                lastGroup = group;
                return [
                  header && (
                    <tr key={`g-${group}`}>
                      <td colSpan={grid.days.length + totalHeaders.length + 1}
                        className="sticky left-0 bg-[#003c71]/5 px-3 py-1.5 text-[11px] font-semibold text-[#003c71] border-b border-slate-200">
                        {group}
                      </td>
                    </tr>
                  ),
                  <tr key={row.employee_id} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-3 py-1 border-b border-r border-slate-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-700 truncate">
                            {row.nom} {row.prenom}
                            {row.exit_date && (
                              <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                                Sorti le {frDate(row.exit_date)}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 truncate">
                            {row.matricule}{row.bl ? ` · ${row.bl}` : ""}{row.service ? ` · ${row.service}` : ""}
                          </div>
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
                      <td key={i} className={`border-b border-slate-100 p-0.5 ${i > 0 && grid.days[i].day === 1 ? "border-l-2 border-l-slate-300" : ""}`}>
                        <button onClick={(e) => openPicker("cell", row, e.currentTarget, i)} title={cellTitle(cell, row.exit_date)}
                          className={`relative w-full h-7 min-w-[26px] rounded ${cellClass(cell, offDays.has(i))} ${grid.editable && !cell.locked ? "" : "cursor-default"}`}>
                          {cell.code || "·"}
                          {cell.hint && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        </button>
                      </td>
                    ))}
                    {totalValues(row).map((v, k) => (
                      <td key={k} className={`px-2 text-center border-b border-l border-slate-100 tabular-nums font-semibold ${totalCls(totalHeaders[k], v)}`}>{v}</td>
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
                {picker.mode === "fill" ? `Remplir les jours vides · ${picker.row.nom}` : `Le ${frDate(grid.days[picker.index!].date)} · ${picker.row.nom}`}
              </span>
              <button onClick={() => setPicker(null)} className="text-slate-400 hover:text-slate-600"><XIcon size={14} /></button>
            </div>
            {picker.mode === "cell" && picker.index !== undefined && picker.row.cells[picker.index].hint && (
              <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 mb-1.5">💡 {picker.row.cells[picker.index].hint}</div>
            )}
            <div className="flex flex-col gap-1">
              {codesFor(picker.row).map((c) => (
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
                Vider la ligne (toutes les saisies de la période)
              </button>
            )}
          </div>
        </>
      )}

      {campaignModal && (
        <CampaignModal campaign={campaignModal === "edit" ? campaign : null}
          onClose={() => setCampaignModal(null)} onSaved={onCampaignSaved} />
      )}
      {showBls && <BusinessLinesModal onClose={() => setShowBls(false)} onSaved={load} />}
    </div>
  );
}
