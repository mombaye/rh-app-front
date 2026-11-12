// Pointage HS & Astreinte : grille jour par jour sur une période de saisie choisie par la RH.
// Codes : X présent, Y heures sup., Z astreinte, C congés, A sortie, M maladie, D Days Off (BL avec l'option).
// Les cases en pointillés sont remplies automatiquement (pointage, congés, sorties) ; une saisie les remplace.
// Accès : la RH voit tout ; un éditeur voit tous les agents des BL qui lui sont attribuées.
//
// Écran volontairement épuré : une carte « période » (choix, 3 étapes, une seule action principale),
// des onglets BL, puis la grille. Les actions rares sont dans le menu « ⋯ ».
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote, CalendarPlus, Check, FileDown, Loader2, Lock, MoreHorizontal, Network, Paintbrush, Pencil,
  MapPin, PlayCircle, RotateCcw, Search, Upload, TableProperties, Trash2, X as XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  CampaignStatus, HsCampaign, HsCell, HsChange, HsCode, HsGrid, HsRow, NO_BL, campaignLabel, frDate,
  hsAstreinteService,
} from "@/services/hsAstreinteService";
import { exportAttendanceXLSX, periodInfo } from "@/utils/attendanceExport";
import CampaignModal from "@/components/hsastreinte/CampaignModal";
import BusinessLinesModal from "@/components/hsastreinte/BusinessLinesModal";
import ImportModal from "@/components/hsastreinte/ImportModal";
import ZoneModal from "@/components/hsastreinte/ZoneModal";

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
const NO_SERVICE = "__none__";
const codesFor = (row: HsRow) => ALL_CODES.filter((c) => c !== "D" || row.days_off_allowed);

const STEPS: { status: CampaignStatus; label: string }[] = [
  { status: "DRAFT", label: "Brouillon" },
  { status: "OPEN", label: "Saisie ouverte" },
  { status: "CLOSED", label: "Clôturée" },
];

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

/** Les trois étapes d'une période ; l'étape en cours est mise en avant. */
function Steps({ status }: { status: CampaignStatus }) {
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex items-center gap-1.5 text-xs">
      {STEPS.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={s.status} className="flex items-center gap-1.5">
            {i > 0 && <span className={`w-5 h-px ${i <= current ? "bg-[#003c71]" : "bg-slate-200"}`} />}
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${
              active ? (s.status === "CLOSED" ? "bg-slate-700 text-white" : s.status === "OPEN" ? "bg-emerald-600 text-white" : "bg-[#003c71] text-white")
                : done ? "text-[#003c71]" : "text-slate-400"}`}>
              {done ? <Check size={12} /> : <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${active ? "bg-white/25" : "border border-current"}`}>{i + 1}</span>}
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function HsAstreinteBoard() {
  const navigate = useNavigate();
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [bl, setBl] = useState("");
  const [search, setSearch] = useState("");
  const [service, setService] = useState("");
  const [grid, setGrid] = useState<HsGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [busy, setBusy] = useState(false);
  const [campaignModal, setCampaignModal] = useState<"new" | "edit" | null>(null);
  const [showBls, setShowBls] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [zoneRow, setZoneRow] = useState<HsRow | null>(null);
  const [zone, setZone] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = await hsAstreinteService.getGrid(campaignId, bl);
      setGrid(g);
      setError("");
      if (g.campaign && g.campaign.id !== campaignId) setCampaignId(g.campaign.id);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Impossible de charger le pointage");
      setGrid(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, bl]);

  useEffect(() => { load(); }, [load]);

  const campaign = grid?.campaign ?? null;
  const isRh = !!grid?.is_rh;
  const showBlGroups = !bl && (grid?.business_lines.length ?? 0) > 1;
  const hasDaysOff = !!grid?.rows.some((r) => r.days_off_allowed || r.nb_days_off > 0);

  // Filtre par service : jamais pour les agents de la BL NOPE (ils restent toujours affichés, sans filtre)
  const isNope = (r: HsRow) => (r.bl || "").toUpperCase() === "NOPE";
  const services = useMemo(() =>
    [...new Set((grid?.rows ?? []).filter((r) => !isNope(r)).map((r) => r.service || ""))].sort((a, b) => a.localeCompare(b, "fr")),
  [grid]);
  const NO_ZONE = "__nozone__";
  const zones = useMemo(() => [...new Set((grid?.rows ?? []).map((r) => r.zone || ""))].sort((a, b) => a.localeCompare(b, "fr", { numeric: true })), [grid]);
  useEffect(() => { if (zone && zone !== NO_ZONE && !zones.includes(zone)) setZone(""); }, [zones, zone]);
  // Le service choisi n'existe plus (autre BL ou autre période) : on retire le filtre
  useEffect(() => { if (service && service !== NO_SERVICE && !services.includes(service)) setService(""); }, [services, service]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = (grid?.rows ?? []).filter((r) =>
      (!service || isNope(r) || (service === NO_SERVICE ? !r.service : r.service === service)) &&
      (!zone || (zone === NO_ZONE ? !r.zone : r.zone === zone)));
    return q ? all.filter((r) => `${r.matricule} ${r.nom} ${r.prenom} ${r.service} ${r.bl}`.toLowerCase().includes(q)) : all;
  }, [grid, search, service, zone]);

  const totals = useMemo(() => rows.reduce((t, r) => ({
    hs: t.hs + r.nb_heures_sup, astr: t.astr + r.nb_jours_astreintes, off: t.off + r.nb_days_off,
  }), { hs: 0, astr: 0, off: 0 }), [rows]);

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
    setMenuOpen(false);
    const msg: Record<CampaignStatus, string> = {
      OPEN: campaign.status === "CLOSED" ? "Rouvrir la saisie pour les éditeurs ?" : "Donner le go ? Les éditeurs des BL pourront remplir le pointage de cette période.",
      CLOSED: "Clôturer la période ? Plus personne ne pourra modifier le pointage.",
      DRAFT: "Repasser en brouillon ? La période ne sera plus visible par les éditeurs.",
    };
    if (!window.confirm(msg[status])) return;
    setBusy(true);
    try {
      await hsAstreinteService.setCampaignStatus(campaign.id, status);
      toast.success(status === "OPEN" ? "C'est parti : la saisie est ouverte." : status === "CLOSED" ? "Période clôturée." : "Période repassée en brouillon.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Modification impossible");
    } finally {
      setBusy(false);
    }
  };

  const removeCampaign = async () => {
    setMenuOpen(false);
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

  // Totaux affichés : l'essentiel (les heures restent dans l'export Excel)
  const totalHeaders = ["Jours", "HS", "Astr.", ...(hasDaysOff ? ["Days Off", "Payées"] : [])];
  const totalValues = (r: HsRow) => [
    r.jours_travailles, r.nb_heures_sup, r.nb_jours_astreintes,
    ...(hasDaysOff ? [r.nb_days_off, Math.max(0, r.nb_jours_astreintes - r.nb_days_off)] : []),
  ];
  const totalCls = (h: string, v: number) => !v ? "text-slate-300"
    : h === "HS" ? "text-amber-600" : h === "Astr." || h === "Payées" ? "text-purple-600" : h === "Days Off" ? "text-teal-600" : "text-slate-700";

  // Une seule action principale selon l'étape
  const primary = !isRh || !campaign ? null
    : campaign.status === "DRAFT" ? { label: "Donner le go", icon: <PlayCircle size={16} />, to: "OPEN" as CampaignStatus, cls: "bg-emerald-600 hover:bg-emerald-700 text-white" }
    : campaign.status === "OPEN" ? { label: "Clôturer", icon: <Lock size={15} />, to: "CLOSED" as CampaignStatus, cls: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" }
    : { label: "Rouvrir", icon: <RotateCcw size={15} />, to: "OPEN" as CampaignStatus, cls: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" };

  const hint = !campaign ? ""
    : campaign.status === "DRAFT" ? "Vérifiez les pointages ci-dessous, puis donnez le go : les éditeurs des BL pourront remplir."
    : campaign.status === "OPEN" ? (grid?.editable ? "Cliquez sur une case pour saisir un code, ou sur le pinceau pour remplir une ligne." : grid?.lock_reason ?? "")
    : "Période clôturée : consultation seulement.";

  let lastGroup = "";

  return (
    <div className="px-4 md:px-6 pb-10">
      {/* Titre + raccourcis */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#003c71] flex items-center justify-center shrink-0">
            <TableProperties size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 leading-tight">Pointage HS &amp; Astreinte</h1>
            {!isRh && !!grid?.my_bls.length && <p className="text-xs text-slate-500">Vos BL : {grid.my_bls.join(", ")}</p>}
          </div>
        </div>
        {isRh && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowBls(true)} title="Éditeurs de chaque BL et option Days Off"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100">
              <Network size={16} /> <span className="hidden xl:inline">Accès BL</span>
            </button>
            <button onClick={() => setShowImport(true)} disabled={!campaignId} title="Importer un fichier de pointage (feuille de la période, zones des employés)"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-50">
              <Upload size={16} /> <span className="hidden xl:inline">Importer</span>
            </button>
            <button onClick={() => navigate("/rh/om-forfaits")} title="Montants, tarifs et plafonds par service"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100">
              <Banknote size={16} /> <span className="hidden xl:inline">Forfaits</span>
            </button>
          </div>
        )}
      </div>

      {/* Carte période */}
      {grid && campaign && (
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="min-w-0 flex-1">
              {grid.campaigns.length > 1 ? (
                <select value={campaignId ?? ""} onChange={(e) => setCampaignId(Number(e.target.value))}
                  className="w-full max-w-md text-base font-bold text-slate-800 bg-transparent -ml-1 pr-6 py-0.5 rounded-lg hover:bg-slate-50 focus:outline-none cursor-pointer truncate">
                  {grid.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{campaignLabel(c)}</option>
                  ))}
                </select>
              ) : (
                <div className="text-base font-bold text-slate-800 truncate">{campaign.label || "Période de saisie"}</div>
              )}
              <div className="text-xs text-slate-500">
                Du {frDate(campaign.start_date)} au {frDate(campaign.end_date)} · {campaign.nb_days} jours
              </div>
            </div>
            <Steps status={campaign.status} />
            {isRh && (
              <div className="flex items-center gap-2">
                {primary && (
                  <button onClick={() => setStatus(primary.to)} disabled={busy}
                    className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-60 ${primary.cls}`}>
                    {busy ? <Loader2 size={15} className="animate-spin" /> : primary.icon} {primary.label}
                  </button>
                )}
                <div className="relative">
                  <button onClick={() => setMenuOpen((o) => !o)} title="Autres actions"
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100">
                    <MoreHorizontal size={18} />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-40 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 text-sm">
                        <button onClick={() => { setMenuOpen(false); setCampaignModal("new"); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700">
                          <CalendarPlus size={15} /> Nouvelle période
                        </button>
                        {campaign.status !== "CLOSED" && (
                          <button onClick={() => { setMenuOpen(false); setCampaignModal("edit"); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700">
                            <Pencil size={14} /> Modifier les dates
                          </button>
                        )}
                        {campaign.status === "OPEN" && (
                          <button onClick={() => setStatus("DRAFT")}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700">
                            <RotateCcw size={14} /> Repasser en brouillon
                          </button>
                        )}
                        <button onClick={exportExcel} disabled={!rows.length}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700 disabled:opacity-40">
                          <FileDown size={15} /> Exporter en Excel
                        </button>
                        {campaign.status === "DRAFT" && (
                          <button onClick={removeCampaign}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-rose-50 text-rose-600 border-t border-slate-100">
                            <Trash2 size={14} /> Supprimer la période
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            {!isRh && (
              <button onClick={exportExcel} disabled={!rows.length} title="Exporter en Excel"
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-40">
                <FileDown size={16} /> Exporter
              </button>
            )}
          </div>
          {hint && (
            <p className={`mt-2 text-xs flex items-center gap-1.5 ${campaign.status === "DRAFT" ? "text-[#003c71]" : "text-slate-500"}`}>
              {!grid.editable && <Lock size={12} className="shrink-0" />} {hint}
            </p>
          )}
        </div>
      )}

      {/* Onglets BL + recherche */}
      {grid && campaign && (
        <div className="flex flex-col xl:flex-row xl:items-center gap-2 mb-3">
          {grid.business_lines.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap">
              {["", ...grid.business_lines].map((b) => (
                <button key={b || "all"} onClick={() => setBl(b)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${bl === b
                    ? "bg-[#003c71] text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  {b ? blLabel(b) : "Toutes"}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            {services.length > 1 && (
              <select value={service} onChange={(e) => setService(e.target.value)} aria-label="Filtrer par service"
                className={`flex-1 min-w-[150px] xl:flex-none xl:max-w-[240px] px-3 py-2 text-sm border rounded-xl bg-white focus:outline-none focus:border-[#003c71] ${service ? "border-[#003c71] text-[#003c71] font-semibold" : "border-slate-200 text-slate-600"}`}>
                <option value="">Tous les services</option>
                {services.map((sv) => sv
                  ? <option key={sv} value={sv}>{sv}</option>
                  : <option key={NO_SERVICE} value={NO_SERVICE}>Sans service</option>)}
              </select>
            )}
            <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Filtrer par zone"
              title={zones.filter(Boolean).length === 0 ? "Aucune zone enregistrée : importez le fichier de pointage ou définissez la zone d'un employé" : undefined}
              className={`flex-1 min-w-[140px] xl:flex-none xl:max-w-[200px] px-3 py-2 text-sm border rounded-xl bg-white focus:outline-none focus:border-[#003c71] ${zone ? "border-[#003c71] text-[#003c71] font-semibold" : "border-slate-200 text-slate-600"}`}>
              <option value="">Toutes les zones</option>
              {zones.map((z) => z
                ? <option key={z} value={z}>{z}</option>
                : <option key={NO_ZONE} value={NO_ZONE}>Sans zone</option>)}
            </select>
            <div className="relative flex-1 min-w-[180px] xl:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un employé…"
                className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white w-full xl:w-56 focus:outline-none focus:border-[#003c71]" />
            </div>
          </div>
        </div>
      )}

      {/* Résumé discret + légende */}
      {grid && campaign && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mb-2">
          <span><b className="text-slate-700">{rows.length}</b> employés</span>
          <span><b className="text-purple-600">{totals.astr}</b> astreintes</span>
          {hasDaysOff && <span><b className="text-teal-600">{totals.off}</b> Days Off</span>}
          <span><b className="text-amber-600">{totals.hs}</b> jours HS</span>
          {saving && <Loader2 size={13} className="animate-spin text-[#003c71]" />}
          <span className="flex items-center gap-2 flex-wrap sm:ml-auto">
            {ALL_CODES.filter((c) => c !== "D" || hasDaysOff).map((c) => (
              <span key={c} className="flex items-center gap-1" title={CODE_META[c].label}>
                <span className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${CODE_META[c].cls}`}>{c}</span>
                <span className="hidden md:inline">{CODE_META[c].label}</span>
              </span>
            ))}
            <span className="flex items-center gap-1" title="Rempli automatiquement (pointage, congés, sorties)">
              <span className="w-4 h-4 rounded border border-dashed border-emerald-500 bg-emerald-50" /> <span className="hidden md:inline">Auto</span>
            </span>
          </span>
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#003c71]" /></div>
      ) : error || !grid ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">{error}</div>
      ) : !campaign ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <CalendarPlus size={28} className="mx-auto text-[#003c71] mb-3" />
          {isRh ? (
            <>
              <p className="font-semibold text-slate-800">Aucune période de saisie</p>
              <p className="text-sm text-slate-500 mt-1 mb-4">Choisissez une date de début et une date de fin pour commencer.</p>
              <button onClick={() => setCampaignModal("new")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold">
                <CalendarPlus size={15} /> Créer une période
              </button>
            </>
          ) : <p className="text-sm text-slate-500">{grid.lock_reason}</p>}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
          Aucun employé pour ce filtre.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-auto max-h-[calc(100vh-17rem)]">
          <table className="text-[11px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-30 bg-slate-50 text-left px-3 py-2 min-w-[210px] border-b border-r border-slate-200 text-slate-500 font-semibold">Employé</th>
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
                  <th key={h} className="px-2 py-1 border-b border-l border-slate-200 bg-slate-50 text-slate-600 font-semibold whitespace-nowrap">{h}</th>
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
                        className="sticky left-0 bg-slate-50/80 px-3 py-1 text-[11px] font-bold text-[#003c71] border-b border-slate-200">
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
                          <div className="text-slate-400 truncate">{row.matricule}{row.service ? ` · ${row.service}` : ""}{row.zone ? ` · ${row.zone}` : ""}</div>
                        </div>
                        <div className="flex items-center shrink-0">
                        {isRh && (
                          <button title={row.zone ? `Zone : ${row.zone} — modifier` : "Définir la zone de cet employé"}
                          aria-label={`Modifier la zone de ${row.nom} ${row.prenom}`}
                          onClick={() => setZoneRow(row)}
                          className="p-1.5 rounded-lg text-slate-300 group-hover:text-slate-500 hover:!text-[#003c71] hover:bg-[#003c71]/10 shrink-0">
                          <MapPin size={14} />
                        </button>
                        )}
                        {grid.editable && (
                          <button title="Remplir les jours vides de cette ligne"
                            onClick={(e) => openPicker("fill", row, e.currentTarget)}
                            className="p-1.5 rounded-lg text-slate-300 group-hover:text-slate-500 hover:!text-[#003c71] hover:bg-[#003c71]/10 shrink-0">
                            <Paintbrush size={14} />
                          </button>
                        )}
                        </div>
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
                      <td key={k} className={`px-2 text-center border-b border-l border-slate-100 tabular-nums font-bold ${totalCls(totalHeaders[k], v)}`}>{v}</td>
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
                Effacer (revenir à l'automatique)
              </button>
            ) : (
              <button onClick={clearRow}
                className="w-full text-left text-xs px-2 py-1.5 mt-1 border-t border-slate-100 text-rose-600 hover:bg-rose-50 rounded-md">
                Vider la ligne
              </button>
            )}
          </div>
        </>
      )}

      {campaignModal && (
        <CampaignModal campaign={campaignModal === "edit" ? campaign : null}
          onClose={() => setCampaignModal(null)} onSaved={onCampaignSaved} />
      )}
      {isRh && zoneRow && (
        <ZoneModal row={zoneRow} zones={zones} onClose={() => setZoneRow(null)}
          onSaved={(id, z) => setGrid((g) => g && { ...g, rows: g.rows.map((r) => r.employee_id === id ? { ...r, zone: z } : r) })} />
      )}
      {showImport && campaignId && <ImportModal campaignId={campaignId} onClose={() => setShowImport(false)} onImported={load} />}
      {showBls && <BusinessLinesModal onClose={() => setShowBls(false)} onSaved={load} />}
    </div>
  );
}
