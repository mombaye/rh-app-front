import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  Clock, AlertTriangle, UserMinus, Filter, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2, ChevronDown, Settings, CheckCircle,
  CalendarDays, TrendingUp, Lock, Pencil, Plus, Trash2,
} from "lucide-react";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import {
  getDailyStats, getWeeklyStats, getMonthlyStats, getEmployeePeriodDetail, getShiftDailyStats,
} from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import type {
  DailyStatsResponse, WeeklyStatsResponse, MonthlyStatsResponse,
  EmployeePeriodDetailResponse, DayDetail, ShiftTeamKey,
} from "@/types/attendance";
import type { Employee } from "@/types/employee";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = "daily" | "weekly" | "monthly";
type StatusFilter = "all" | "ok" | "absent" | "incomplete" | "anomaly" | "late" | "deficit";
type MotifType = "absent" | "not_pointing";
type WorkContext = "Normale" | "Ramadan" | string;

// ─── Constantes ───────────────────────────────────────────────────────────────
const MAX_WORKDAY_MIN = 8 * 60;
const MAX_WEEKLY_MIN  = 40 * 60;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS_PRESETS_KEY        = "camu_work_schedule_presets";
const LS_ACTIVE_SCHEDULE_KEY = "camu_work_active_schedule";

// ─── Presets horaires ─────────────────────────────────────────────────────────
interface WorkSchedulePreset {
  context: WorkContext;
  startH: number; startM: number;
  endH:   number; endM:   number;
  breakMin: number;
}

const DEFAULT_PRESETS: WorkSchedulePreset[] = [
  { context: "Normale",  startH: 8, startM: 0, endH: 17, endM: 30, breakMin: 60 },
  { context: "Ramadan",  startH: 8, startM: 0, endH: 16, endM: 30, breakMin: 30 },
];

// ─── Config période active ────────────────────────────────────────────────────
interface ActiveSchedule extends WorkSchedulePreset {
  dateStart: string;
  dateEnd:   string;
  locked: boolean;
}

function workDayMinutes(s: WorkSchedulePreset): number {
  return Math.max(0, (s.endH * 60 + s.endM) - (s.startH * 60 + s.startM) - s.breakMin);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isPeriodActive(schedule: ActiveSchedule): boolean {
  const today = todayISO();
  return today >= schedule.dateStart && today <= schedule.dateEnd;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface CompensationResult {
  late_min: number; overtime_min: number; compensated_min: number;
  remaining_min: number; is_compensated: boolean; has_overtime: boolean;
}

interface FlatRecord {
  employee_id: number; matricule: string; full_name: string; department: string; project: string;
  status: "ok" | "absent" | "incomplete" | "anomaly";
  is_late_api: boolean; late_label_api: string | null; late_minutes_api: number;
  computed_late_minutes: number; overtime_minutes: number;
  compensation: CompensationResult; deficit_minutes: number;
  in_time: string | null; out_time: string | null;
  worked_minutes: number; delta_minutes: number; expected_minutes: number;
  email: string | null;
}

interface SummaryRecord {
  employee_id: number; matricule: string; full_name: string; department: string; project: string;
  nb_jours: number; worked_minutes: number;
}

interface Pointage {
  day: string; date: string;
  in_time: string | null; out_time: string | null;
  status: "ok" | "absent" | "incomplete" | "anomaly";
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour:"2-digit", minute:"2-digit", hour12: false }).format(d);
}

function formatMinutes(min: number): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2,"0")}` : `${h}h`;
}

function computeLateMinutes(iso: string | null, thH: number, thM: number): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const t = d.getHours()*60 + d.getMinutes(), th = thH*60 + thM;
  return t > th ? t - th : 0;
}

function computeOvertimeMinutes(iso: string | null, thH: number, thM: number): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const t = d.getHours()*60 + d.getMinutes(), th = thH*60 + thM;
  return t > th ? t - th : 0;
}

function computeWorkedMinutesFromTimes(inIso: string | null, outIso: string | null): number {
  if (!inIso || !outIso) return 0;
  const inD = new Date(inIso), outD = new Date(outIso);
  if (isNaN(inD.getTime()) || isNaN(outD.getTime())) return 0;
  const diff = (outD.getTime() - inD.getTime()) / 60000;
  return diff > 0 ? Math.round(diff) : 0;
}

function computeCompensation(lateMin: number, overtimeMin: number): CompensationResult {
  const compensated = Math.min(lateMin, overtimeMin), remaining = Math.max(0, lateMin - compensated);
  return { late_min: lateMin, overtime_min: overtimeMin, compensated_min: compensated,
    remaining_min: remaining, is_compensated: lateMin > 0 && remaining === 0, has_overtime: overtimeMin > 0 };
}

function computeDeficitMinutes(worked: number, expected: number): number {
  const exp = expected > 0 ? expected : MAX_WORKDAY_MIN;
  return worked > 0 ? Math.max(0, exp - worked) : 0;
}

function isoToday(): string { return todayISO(); }

function isoWeekNow(): string {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const w = Math.ceil((((date.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(w).padStart(2,"0")}`;
}

function yyyyMmToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

// ─── Export XLSX ──────────────────────────────────────────────────────────────
function exportXLSX(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cell]) {
      ws[cell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1E3A5F" } },
        alignment: { horizontal: "center" },
      };
    }
  }
  const colWidths = Object.keys(rows[0]).map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2,
  }));
  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, "Pointages");
  XLSX.writeFile(wb, `${filename}_${isoToday()}.xlsx`);
}

async function sendAlertEmail(emp: FlatRecord, motif: MotifType): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 500));
  return { success: !!emp.email };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  ok:        { label: "OK",       dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  absent:    { label: "Absent",   dot: "bg-red-500",     badge: "bg-red-50 text-red-700 ring-red-200" },
  incomplete:{ label: "Incomplet",dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  anomaly:   { label: "Anomalie", dot: "bg-violet-500",  badge: "bg-violet-50 text-violet-700 ring-violet-200" },
};

const QUICK_FILTERS = [
  { key: "all"       as StatusFilter, label: "Tous",         dotColor: "bg-slate-400",  activeText: "text-slate-800",   activeBg: "bg-slate-900", activeDot: "bg-white"         },
  { key: "ok"        as StatusFilter, label: "OK",           dotColor: "bg-emerald-400",activeText: "text-emerald-700", activeBg: "bg-emerald-50",activeDot: "bg-emerald-500"   },
  { key: "absent"    as StatusFilter, label: "Absents",      dotColor: "bg-red-400",    activeText: "text-red-700",     activeBg: "bg-red-50",    activeDot: "bg-red-500"       },
  { key: "late"      as StatusFilter, label: "Retards",      dotColor: "bg-orange-400", activeText: "text-orange-700",  activeBg: "bg-orange-50", activeDot: "bg-orange-500"    },
  { key: "incomplete"as StatusFilter, label: "Incomplets",   dotColor: "bg-amber-400",  activeText: "text-amber-800",   activeBg: "bg-amber-50",  activeDot: "bg-amber-500"     },
  { key: "anomaly"   as StatusFilter, label: "Anomalies",    dotColor: "bg-violet-400", activeText: "text-violet-700",  activeBg: "bg-violet-50", activeDot: "bg-violet-500"    },
  { key: "deficit"   as StatusFilter, label: "Heures moins", dotColor: "bg-rose-400",   activeText: "text-rose-700",    activeBg: "bg-rose-50",   activeDot: "bg-rose-500"      },
];

// ─── Composants partagés ──────────────────────────────────────────────────────
function StatusPill({ status }: { status: keyof typeof STATUS_CFG }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.anomaly;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{c.label}
    </span>
  );
}

function LateBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 ring-1 ring-orange-300 whitespace-nowrap">
      <Clock className="h-3 w-3 shrink-0" />RETARD · {formatMinutes(minutes)}
    </span>
  );
}

function OvertimeBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 whitespace-nowrap">
      <Clock className="h-3 w-3 shrink-0" />+{formatMinutes(minutes)}
    </span>
  );
}

function WorkedTimeBadge({ minutes, expectedMin }: { minutes: number; expectedMin?: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  const threshold = expectedMin ?? MAX_WORKDAY_MIN;
  const color = minutes < threshold ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 whitespace-nowrap ${color}`}>
      <Clock className="h-3 w-3 shrink-0" />{formatMinutes(minutes)}
    </span>
  );
}

function CompensationCell({ c, viewMode }: { c: CompensationResult; viewMode: string }) {
  if (viewMode !== "daily" || c.late_min === 0) return <span className="text-slate-300 text-xs">—</span>;
  return c.is_compensated
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 whitespace-nowrap">✓ Compensé</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 ring-1 ring-red-200 whitespace-nowrap">✗ Non compensé</span>;
}

// ─── Barre de progression hebdo ───────────────────────────────────────────────
function WeekProgressBar({ minutes, maxMinutes }: { minutes: number; maxMinutes: number }) {
  const pct = Math.min(100, Math.round((minutes / maxMinutes) * 100));
  const over = minutes > maxMinutes;
  const color = pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  const bgColor = pct >= 100 ? "bg-emerald-100" : pct >= 75 ? "bg-blue-100" : pct >= 50 ? "bg-amber-100" : "bg-red-100";
  const textColor = pct >= 100 ? "text-emerald-700" : pct >= 75 ? "text-blue-700" : pct >= 50 ? "text-amber-700" : "text-red-600";
  return (
    <div className="flex items-center gap-2.5 min-w-[180px]">
      <div className={`relative flex-1 h-2 rounded-full overflow-hidden ${bgColor}`}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`absolute inset-y-0 left-0 rounded-full ${color}`} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-9 text-right shrink-0 ${textColor}`}>{pct}%</span>
      {over && (
        <span className="shrink-0 text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
          +{formatMinutes(minutes - maxMinutes)}
        </span>
      )}
    </div>
  );
}

// ─── Tableau synthétique (Hebdo / Mensuel) ────────────────────────────────────
function SummaryTable({
  rows, mode, isLoading, searchQ = "",
}: { rows: SummaryRecord[]; mode: "weekly" | "monthly"; isLoading: boolean; searchQ?: string }) {
  const MAX_MIN = mode === "weekly" ? MAX_WEEKLY_MIN : Math.round(MAX_WEEKLY_MIN * 4.33);
  const maxLabel = mode === "weekly" ? "40h/sem" : `${formatMinutes(MAX_MIN)}/mois`;

  const displayed = useMemo(() => {
    if (!searchQ.trim()) return rows;
    const q = searchQ.toLowerCase();
    return rows.filter((r) =>
      r.full_name.toLowerCase().includes(q) ||
      r.matricule.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      r.project.toLowerCase().includes(q)
    );
  }, [rows, searchQ]);

  const stats = useMemo(() => {
    if (!displayed.length) return null;
    const total = displayed.reduce((s, r) => s + r.worked_minutes, 0);
    const avg = Math.round(total / displayed.length);
    const complet = displayed.filter((r) => r.worked_minutes >= MAX_MIN).length;
    return { avg, complet, total, effectif: displayed.length };
  }, [displayed, MAX_MIN]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Chargement…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {stats && (
        <div className="grid grid-cols-3 gap-3 shrink-0">
          {[
            { icon: <Clock className="h-4 w-4"/>, label: "Moy. heures/employé", value: formatMinutes(stats.avg), color: "text-blue-600 bg-blue-50" },
            { icon: <CheckCircle className="h-4 w-4"/>, label: "Quota atteint", value: `${stats.complet}/${stats.effectif}`, color: "text-emerald-600 bg-emerald-50" },
            { icon: <TrendingUp className="h-4 w-4"/>, label: "Total heures", value: formatMinutes(stats.total), color: "text-purple-600 bg-purple-50" },
          ].map((k) => (
            <div key={k.label} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
              <span className={`p-2 rounded-lg ${k.color}`}>{k.icon}</span>
              <div>
                <p className="text-xs text-gray-400 leading-none mb-0.5">{k.label}</p>
                <p className="text-base font-bold text-gray-800">{k.value || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm min-h-0 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-camublue-900 text-white sticky top-0 z-10">
            <tr>
              {["Matricule","Nom complet","Projet / Service","Nb jours","Heures trav."].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wide border-b border-camublue-800">{h}</th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide border-b border-camublue-800 min-w-[220px]">
                <span className="flex items-center gap-1.5">
                  Progression
                  <span className="text-[10px] font-normal opacity-70 bg-white/20 px-1.5 py-0.5 rounded-full">max {maxLabel}</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayed.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Aucune donnée pour cette période.</td></tr>
            ) : displayed.map((row, idx) => (
              <motion.tr key={row.employee_id}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.015 }}
                className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.matricule}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{row.full_name}</td>
                <td className="px-4 py-2.5 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-camublue-900 text-xs leading-tight tracking-wide">
                      {row.project !== "—" ? row.project : row.department || "—"}
                    </span>
                    {row.project !== "—" && (
                      <span className="text-[10px] text-slate-400 leading-tight">{row.department || "—"}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-bold text-slate-600">{row.nb_jours}</span>
                </td>
                <td className="px-4 py-2.5">
                  {(() => {
                    const pct = Math.min(100, Math.round((row.worked_minutes / MAX_MIN) * 100));
                    const cls = pct >= 100 ? "bg-emerald-50 text-emerald-700" : pct >= 75 ? "bg-blue-50 text-blue-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600";
                    return (
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${cls}`}>
                        {formatMinutes(row.worked_minutes) || "0h"}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-2.5">
                  <WeekProgressBar minutes={row.worked_minutes} maxMinutes={MAX_MIN} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400 px-1 shrink-0 flex-wrap">
        {[
          { color: "bg-emerald-500", label: "Quota atteint (≥ 100%)" },
          { color: "bg-blue-500",    label: "Bon (≥ 75%)" },
          { color: "bg-amber-400",   label: "Moyen (≥ 50%)" },
          { color: "bg-red-400",     label: "Faible (< 50%)" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />{l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Modal : Gestion des horaires de travail ──────────────────────────────────
function WorkScheduleModal({
  open, onClose, active, presets, onSave, onPresetsChange,
}: {
  open: boolean;
  onClose: () => void;
  active: ActiveSchedule | null;
  presets: WorkSchedulePreset[];
  onSave: (s: ActiveSchedule) => void;
  onPresetsChange: (p: WorkSchedulePreset[]) => void;
}) {
  const [view, setView]               = useState<"list"|"period"|"form">("list");
  const [selectedPreset, setSelectedPreset] = useState<WorkSchedulePreset | null>(null);
  const [editingPreset,  setEditingPreset]  = useState<WorkSchedulePreset | null>(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState<string | null>(null);
  const [dateStart, setDateStart] = useState(isoToday());
  const [dateEnd,   setDateEnd]   = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0,10);
  });
  const [saved, setSaved] = useState(false);

  const [fContext,  setFContext]  = useState("");
  const [fStartH,   setFStartH]   = useState(8);
  const [fStartM,   setFStartM]   = useState(0);
  const [fEndH,     setFEndH]     = useState(17);
  const [fEndM,     setFEndM]     = useState(30);
  const [fBreakMin, setFBreakMin] = useState(60);
  const [fError,    setFError]    = useState("");

  const isLocked = active ? isPeriodActive(active) : false;
  const pad = (n: number) => String(n).padStart(2,"0");

  useEffect(() => {
    if (open) {
      setView("list");
      setSaved(false);
      setDeleteConfirm(null);
      setEditingPreset(null);
      if (active) {
        const found = presets.find((p) => p.context === active.context);
        setSelectedPreset(found ?? presets[0] ?? null);
        setDateStart(active.dateStart);
        setDateEnd(active.dateEnd);
      } else {
        setSelectedPreset(presets[0] ?? null);
        setDateStart(isoToday());
      }
    }
  }, [open]);

  const openForm = (preset?: WorkSchedulePreset) => {
    if (preset) {
      setFContext(preset.context);
      setFStartH(preset.startH); setFStartM(preset.startM);
      setFEndH(preset.endH);     setFEndM(preset.endM);
      setFBreakMin(preset.breakMin);
      setEditingPreset(preset);
    } else {
      setFContext(""); setFStartH(8); setFStartM(0);
      setFEndH(17);    setFEndM(30);  setFBreakMin(60);
      setEditingPreset(null);
    }
    setFError("");
    setView("form");
  };

  const handleSavePreset = () => {
    const name = fContext.trim();
    if (!name) { setFError("Le nom du contexte est requis."); return; }
    const isDuplicate = presets.some((p) => p.context === name && p.context !== editingPreset?.context);
    if (isDuplicate) { setFError("Ce nom de contexte existe déjà."); return; }
    const effMin = (fEndH*60+fEndM) - (fStartH*60+fStartM) - fBreakMin;
    if (effMin <= 0) { setFError("La durée effective doit être positive."); return; }

    const newPreset: WorkSchedulePreset = {
      context: name, startH: fStartH, startM: fStartM,
      endH: fEndH, endM: fEndM, breakMin: fBreakMin,
    };

    let updated: WorkSchedulePreset[];
    if (editingPreset) {
      updated = presets.map((p) => p.context === editingPreset.context ? newPreset : p);
      if (selectedPreset?.context === editingPreset.context) setSelectedPreset(newPreset);
    } else {
      updated = [...presets, newPreset];
    }
    onPresetsChange(updated);
    setView("list");
    setFError("");
  };

  const handleDeletePreset = (context: string) => {
    if (active && isPeriodActive(active) && active.context === context) return;
    const updated = presets.filter((p) => p.context !== context);
    onPresetsChange(updated);
    if (selectedPreset?.context === context) setSelectedPreset(updated[0] ?? null);
    setDeleteConfirm(null);
  };

  const handleSavePeriod = () => {
    if (!selectedPreset || dateStart > dateEnd) return;
    onSave({
      ...selectedPreset, dateStart, dateEnd,
      locked: isoToday() >= dateStart && isoToday() <= dateEnd,
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  const plannedMin = selectedPreset ? workDayMinutes(selectedPreset) : 0;
  const exceedsMax = plannedMin > MAX_WORKDAY_MIN;
  const formEffMin = (fEndH*60+fEndM) - (fStartH*60+fStartM) - fBreakMin;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {(view === "form" || view === "period") && (
                  <button onClick={() => setView("list")} className="p-1 rounded-lg hover:bg-slate-100 transition mr-1">
                    <ChevronLeft className="h-4 w-4 text-slate-500" />
                  </button>
                )}
                <Settings className="h-4 w-4 text-camublue-900" />
                <span className="font-semibold text-gray-900">
                  {view === "list"   ? "Heures de travail"
                   : view === "period" ? "Assigner une période"
                   : editingPreset ? "Modifier le contexte" : "Nouveau contexte"}
                </span>
                {view === "list" && isLocked && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                    <Lock className="h-3 w-3" />Période active
                  </span>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* ── Vue : Liste des contextes ── */}
            {view === "list" && (
              <>
                <div className="px-6 py-5 space-y-3 max-h-[65vh] overflow-y-auto">
                  {isLocked && active && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <Lock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-800">
                          Période active — contexte <strong>{active.context}</strong>
                        </p>
                        <p className="text-amber-700 text-xs mt-0.5">
                          {pad(active.startH)}h{pad(active.startM)} – {pad(active.endH)}h{pad(active.endM)}
                          {active.breakMin > 0 ? ` · Pause ${active.breakMin}min` : ""}
                          {" · jusqu'au "}{new Date(active.dateEnd).toLocaleDateString("fr-FR",{day:"2-digit",month:"long"})}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {presets.length === 0 && (
                      <p className="text-center text-sm text-slate-400 py-6">Aucun contexte horaire. Créez-en un.</p>
                    )}
                    {presets.map((preset) => {
                      const isActive = active?.context === preset.context && isLocked;
                      const effMin = workDayMinutes(preset);
                      return (
                        <div key={preset.context}
                          className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all ${
                            isActive ? "border-amber-300 bg-amber-50/50" : "border-slate-100 bg-white hover:border-slate-200"
                          }`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 text-sm">{preset.context}</span>
                              {isActive && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Actif</span>}
                            </div>
                            <p className="text-xs font-mono text-slate-500 mt-0.5">
                              {pad(preset.startH)}h{pad(preset.startM)} → {pad(preset.endH)}h{pad(preset.endM)}
                              <span className="mx-1 text-slate-300">·</span>
                              Pause {preset.breakMin}min
                              <span className="mx-1 text-slate-300">·</span>
                              <span className="text-emerald-600 font-semibold">{formatMinutes(effMin)}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {deleteConfirm === preset.context ? (
                              <div className="flex items-center gap-1.5 bg-red-50 rounded-xl px-3 py-1.5 border border-red-200">
                                <span className="text-xs text-red-600 font-medium">Confirmer ?</span>
                                <button onClick={() => handleDeletePreset(preset.context)}
                                  className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition">Oui</button>
                                <button onClick={() => setDeleteConfirm(null)}
                                  className="text-xs font-medium text-slate-500 hover:text-slate-700 px-1">Non</button>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => openForm(preset)} title="Modifier"
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-camublue-900 transition">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDeleteConfirm(preset.context)} title="Supprimer"
                                  disabled={isActive}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition disabled:opacity-30 disabled:cursor-not-allowed">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button onClick={() => openForm()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-camublue-900 hover:text-camublue-900 transition-all text-sm font-medium">
                  <Plus className="h-4 w-4" />Ajouter un contexte
                </button>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                  <button onClick={onClose}
                    className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">
                    Fermer
                  </button>
                  <button onClick={() => setView("period")} disabled={presets.length === 0}
                    className="flex-1 rounded-2xl bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <CalendarDays className="h-4 w-4" />Assigner une période
                  </button>
                </div>
              </>
            )}

            {/* ── Vue : Assigner une période ── */}
            {view === "period" && (
              <>
                <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
                  {isLocked && active && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <Lock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-800">Période active jusqu'au {new Date(active.dateEnd).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}</p>
                        <p className="text-amber-600 text-xs mt-1">Pour modifier, définissez une nouvelle période après la date de fin actuelle.</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contexte horaire</p>
                    <div className="grid grid-cols-2 gap-2">
                      {presets.map((preset) => {
                        const isSel = selectedPreset?.context === preset.context;
                        return (
                          <button key={preset.context} onClick={() => setSelectedPreset(preset)}
                            className={`flex flex-col gap-1.5 p-3 rounded-2xl border-2 text-left transition-all ${
                              isSel ? "border-camublue-900 bg-camublue-900/5" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            }`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-bold ${isSel ? "text-camublue-900" : "text-slate-700"}`}>{preset.context}</span>
                              {isSel && <CheckCircle className="h-4 w-4 text-camublue-900" />}
                            </div>
                            <p className="text-xs font-mono text-slate-500">
                              {pad(preset.startH)}h{pad(preset.startM)} → {pad(preset.endH)}h{pad(preset.endM)}
                            </p>
                            <p className="text-xs text-slate-400">
                              Pause {preset.breakMin}min · <span className="text-emerald-600 font-semibold">{formatMinutes(workDayMinutes(preset))}</span>
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      <CalendarDays className="inline h-3.5 w-3.5 mr-1 mb-0.5" />Période de validité
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-medium">Date de début</label>
                        <input type="date" value={dateStart}
                          min={isLocked && active ? new Date(new Date(active.dateEnd).getTime()+86400000).toISOString().slice(0,10) : undefined}
                          onChange={(e) => setDateStart(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500 font-medium">Date de fin</label>
                        <input type="date" value={dateEnd} min={dateStart}
                          onChange={(e) => setDateEnd(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                      </div>
                    </div>
                    {dateStart > dateEnd && <p className="text-xs text-red-500 mt-1.5">⚠️ La date de début doit être antérieure à la date de fin.</p>}
                  </div>

                  {selectedPreset && (
                    <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-3 ${exceedsMax ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-blue-50 border border-blue-100 text-blue-700"}`}>
                      {exceedsMax ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" /> : <Clock className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />}
                      <div>
                        <p className="font-semibold">Durée effective : {formatMinutes(plannedMin) || "0 min"}</p>
                        {exceedsMax
                          ? <p className="text-xs mt-0.5">⚠️ Dépasse le maximum légal de <strong>8h/jour</strong>.</p>
                          : <p className="text-xs mt-0.5">
                              Retard après <strong>{pad(selectedPreset.startH)}h{pad(selectedPreset.startM)}</strong> —
                              HS après <strong>{pad(selectedPreset.endH)}h{pad(selectedPreset.endM)}</strong>
                              {selectedPreset.breakMin > 0 && <> — Pause <strong>{selectedPreset.breakMin}min</strong> déduite</>}
                            </p>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                  <button onClick={() => setView("list")}
                    className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">Annuler</button>
                  <button onClick={handleSavePeriod} disabled={!selectedPreset || dateStart > dateEnd}
                    className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      saved ? "bg-emerald-500 text-white" : "bg-camublue-900 hover:bg-camublue-800 text-white"
                    }`}>
                    {saved ? <><CheckCircle className="h-4 w-4" />Enregistré</> : <><Pencil className="h-4 w-4" />Valider la période</>}
                  </button>
                </div>
              </>
            )}

            {/* ── Vue : Formulaire preset ── */}
            {view === "form" && (
              <>
                <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Nom du contexte</label>
                    <input value={fContext} onChange={(e) => setFContext(e.target.value)} placeholder="Ex: Été, Nuit, Hiver…"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none font-semibold" />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Horaires</label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Heure d'entrée</label>
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} max={23} value={fStartH}
                            onChange={(e) => setFStartH(Math.min(23, Math.max(0, +e.target.value)))}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-center font-mono focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                          <span className="text-slate-400 font-bold">h</span>
                          <input type="number" min={0} max={59} value={fStartM}
                            onChange={(e) => setFStartM(Math.min(59, Math.max(0, +e.target.value)))}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-center font-mono focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">Heure de sortie</label>
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} max={23} value={fEndH}
                            onChange={(e) => setFEndH(Math.min(23, Math.max(0, +e.target.value)))}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-center font-mono focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                          <span className="text-slate-400 font-bold">h</span>
                          <input type="number" min={0} max={59} value={fEndM}
                            onChange={(e) => setFEndM(Math.min(59, Math.max(0, +e.target.value)))}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-center font-mono focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Pause (minutes)</label>
                    <div className="flex items-center gap-3">
                      <input type="number" min={0} max={120} value={fBreakMin}
                        onChange={(e) => setFBreakMin(Math.min(120, Math.max(0, +e.target.value)))}
                        className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm text-center font-mono focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                      <div className="flex gap-2">
                        {[0, 30, 45, 60].map((v) => (
                          <button key={v} onClick={() => setFBreakMin(v)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${fBreakMin === v ? "bg-camublue-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                            {v === 0 ? "Aucune" : `${v}min`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-3 ${formEffMin <= 0 ? "bg-red-50 border border-red-200 text-red-700" : formEffMin > MAX_WORKDAY_MIN ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-blue-50 border border-blue-100 text-blue-700"}`}>
                    {formEffMin <= 0 ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                     : formEffMin > MAX_WORKDAY_MIN ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                     : <Clock className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />}
                    <div>
                      <p className="font-semibold">
                        {formEffMin <= 0 ? "Durée invalide" : `Durée effective : ${formatMinutes(formEffMin)}`}
                      </p>
                      <p className="text-xs mt-0.5">
                        {pad(fStartH)}h{pad(fStartM)} → {pad(fEndH)}h{pad(fEndM)}
                        {fBreakMin > 0 ? ` · Pause ${fBreakMin}min déduite` : ""}
                        {formEffMin > MAX_WORKDAY_MIN ? " · ⚠️ Dépasse 8h légales" : ""}
                      </p>
                    </div>
                  </div>

                  {fError && <p className="text-xs text-red-500 font-medium">⚠️ {fError}</p>}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                  <button onClick={() => { setView("list"); setFError(""); }}
                    className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">Annuler</button>
                  <button onClick={handleSavePreset} disabled={formEffMin <= 0 || !fContext.trim()}
                    className="flex-1 rounded-2xl bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <CheckCircle className="h-4 w-4" />
                    {editingPreset ? "Mettre à jour" : "Créer le contexte"}
                  </button>
                </div>
              </>
            )}

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal filtre ─────────────────────────────────────────────────────────────
function FilterModal({
  open, onClose, viewMode, setViewMode, date, setDate, week, setWeek,
  month, setMonth, statusFilter, setStatusFilter, onApply,
}: {
  open: boolean; onClose: () => void; viewMode: ViewMode; setViewMode: (v: ViewMode) => void;
  date: string; setDate: (v: string) => void; week: string; setWeek: (v: string) => void;
  month: string; setMonth: (v: string) => void; statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void; onApply: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-600" />
                <span className="font-semibold text-gray-900">Filtres & Période</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Affichage</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { k: "daily"   as ViewMode, label: "Journalier",   icon: "📅" },
                    { k: "weekly"  as ViewMode, label: "Hebdomadaire", icon: "📆" },
                    { k: "monthly" as ViewMode, label: "Mensuel",      icon: "🗓️" },
                  ].map((v) => (
                    <button key={v.k} onClick={() => setViewMode(v.k)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 text-xs font-semibold transition-all ${
                        viewMode === v.k ? "border-camublue-900 bg-camublue-900/10 text-camublue-900" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}>
                      <span className="text-xl">{v.icon}</span>{v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Période</p>
                {viewMode === "daily"   && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none" />}
                {viewMode === "weekly"  && <input value={week} onChange={(e) => setWeek(e.target.value)} placeholder="2026-W09" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none" />}
                {viewMode === "monthly" && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Statut / Type</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_FILTERS.map((f) => (
                    <button key={f.key} onClick={() => setStatusFilter(f.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        statusFilter === f.key ? `${f.activeBg} ${f.activeText} border-transparent` : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusFilter === f.key ? f.activeDot : f.dotColor}`} />{f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">Annuler</button>
              <button onClick={() => { onApply(); onClose(); }} className="flex-1 rounded-2xl bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 text-sm font-medium transition">Appliquer</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal détail ─────────────────────────────────────────────────────────────
const FR_WEEKDAYS = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

function DetailModal({ open, onClose, employeeId, initialWeek }: {
  open: boolean; onClose: () => void; employeeId: number | null; initialWeek: string;
}) {
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selWeek, setSelWeek] = useState(initialWeek);
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [selMonth, setSelMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });

  const weekBounds = (ws: string) => {
    const [y, wn] = ws.split("-W").map(Number);
    const fd = new Date(y, 0, 1);
    const fw = new Date(fd);
    fw.setDate(fw.getDate() + (wn - 1) * 7 - fw.getDay() + 1);
    const lw = new Date(fw); lw.setDate(lw.getDate() + 6); // Lun → Dim
    return { start: fw.toISOString().split("T")[0], end: lw.toISOString().split("T")[0] };
  };

  const monthBounds = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2,"0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    return { start, end };
  };

  const fetchPointages = useCallback(async () => {
    if (!employeeId || !open) return;
    setLoading(true);
    try {
      const { start, end } = periodType === "weekly" ? weekBounds(selWeek) : monthBounds(selMonth);
      const res: EmployeePeriodDetailResponse = await getEmployeePeriodDetail({ employee_id: employeeId, start, end });

      const entries: Pointage[] = [];
      const startDate = new Date(start);
      const endDate   = new Date(end);
      for (let cur = new Date(startDate); cur <= endDate; cur.setDate(cur.getDate() + 1)) {
        const ds  = cur.toISOString().split("T")[0];
        const dd  = res.days.find((d: DayDetail) => d.date === ds);
        const day = periodType === "weekly"
          ? ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"][cur.getDay() === 0 ? 6 : cur.getDay() - 1]
          : FR_WEEKDAYS[cur.getDay()];
        entries.push({ day, date: ds, in_time: dd?.in_time ?? null, out_time: dd?.out_time ?? null, status: dd?.status ?? "absent" });
      }
      setPointages(entries);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [employeeId, selWeek, selMonth, periodType, open]);

  useEffect(() => { fetchPointages(); }, [fetchPointages]);

  const handleExport = () => {
    if (!pointages.length) return;
    const label = periodType === "weekly" ? selWeek : selMonth;
    exportXLSX(`pointages_${label}`, pointages.map((p) => ({
      Jour: p.day,
      Date: new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric" }),
      Statut: STATUS_CFG[p.status]?.label ?? p.status,
      Entrée: p.in_time ? formatTime(p.in_time) : "—",
      Sortie: p.out_time ? formatTime(p.out_time) : "—",
    })));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-camublue-900">Pointages</h3>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition"><X className="h-5 w-5 text-slate-500" /></button>
            </div>

            {/* Contrôles période */}
            <div className="px-4 sm:px-6 py-3 border-b border-slate-100 shrink-0 space-y-3">
              {/* Toggle Hebdo / Mensuel */}
              <div className="flex gap-2">
                {([
                  { k: "weekly"  as const, label: "Hebdomadaire" },
                  { k: "monthly" as const, label: "Mensuel" },
                ]).map(({ k, label }) => (
                  <button key={k} onClick={() => setPeriodType(k)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      periodType === k
                        ? "bg-camublue-900 text-white border-camublue-900"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Sélecteur de période + actions */}
              <div className="flex gap-2">
                {periodType === "weekly" ? (
                  <input type="text" value={selWeek} onChange={(e) => setSelWeek(e.target.value)} placeholder="2026-W09"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                ) : (
                  <input type="month" value={selMonth} onChange={(e) => setSelMonth(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                )}
                <button onClick={fetchPointages}
                  className="px-4 py-2 bg-camublue-900 text-white rounded-lg text-sm hover:bg-camublue-800 transition whitespace-nowrap">
                  Charger
                </button>
                <button onClick={handleExport} disabled={!pointages.length}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="hidden sm:inline">Exporter</span>
                </button>
              </div>
            </div>

            {/* Contenu */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {loading ? (
                <div className="flex justify-center py-12"><div className="h-10 w-10 border-4 border-camublue-900 border-t-transparent rounded-full animate-spin" /></div>
              ) : pointages.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="hidden sm:grid grid-cols-5 gap-4 px-3 py-2 bg-slate-50 rounded-xl font-semibold text-slate-700 text-xs uppercase tracking-wide">
                    <span>Jour</span><span>Date</span><span>Statut</span><span>Entrée</span><span>Sortie</span>
                  </div>
                  {pointages.map((p, i) => {
                    const rowBg = p.status === "ok" ? "bg-white border-slate-100" : "bg-rose-50 border-rose-100";
                    return (
                      <div key={i} className={`rounded-xl border p-3 ${rowBg}`}>
                        <div className="hidden sm:grid grid-cols-5 gap-4 items-center">
                          <span className="font-medium text-sm text-slate-800">{p.day}</span>
                          <span className="text-sm text-slate-600">
                            {new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"})}
                          </span>
                          <span><StatusPill status={p.status} /></span>
                          <span className={`text-sm ${p.in_time ? "text-slate-700" : "text-slate-400"}`}>{p.in_time ? formatTime(p.in_time) : "—"}</span>
                          <span className={`text-sm ${p.out_time ? "text-slate-700" : "text-slate-400"}`}>{p.out_time ? formatTime(p.out_time) : "—"}</span>
                        </div>
                        {/* Mobile */}
                        <div className="sm:hidden flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-slate-800">{p.day} · {new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})}</span>
                          <StatusPill status={p.status} />
                          <span className="text-xs text-slate-500">{p.in_time ? formatTime(p.in_time) : "—"} → {p.out_time ? formatTime(p.out_time) : "—"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <AlertTriangle className="h-10 w-10 mb-3 text-slate-300" /><p>Aucun pointage trouvé.</p>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
              <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-white bg-camublue-900 rounded-xl hover:bg-camublue-800 transition">Fermer</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal alerte ─────────────────────────────────────────────────────────────
function AlertModal({ open, onClose, employee, onConfirm, sending }: {
  open: boolean; onClose: () => void; employee: FlatRecord | null;
  onConfirm: (m: MotifType) => void; sending: boolean;
}) {
  const [motif, setMotif] = useState<MotifType>("absent");
  useEffect(() => { if (employee) setMotif(employee.status === "absent" ? "absent" : "not_pointing"); }, [employee]);

  return (
    <AnimatePresence>
      {open && employee && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !sending && onClose()}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden z-10"
            initial={{ y: 40, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.97, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-800">Envoyer une alerte</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[230px]">{employee.full_name}</div>
              </div>
              <button onClick={onClose} disabled={sending} className="p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-40"><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${employee.email ? "bg-slate-50" : "bg-red-50 border border-red-100"}`}>
                <Mail className={`h-4 w-4 shrink-0 ${employee.email ? "text-slate-400" : "text-red-400"}`} />
                {employee.email ? <span className="text-sm font-mono text-slate-700 truncate">{employee.email}</span>
                  : <span className="text-sm text-red-500 font-medium flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" />Aucun email</span>}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Motif</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMotif("absent")}
                    className={`flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${motif === "absent" ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <div className={`p-2 rounded-xl ${motif === "absent" ? "bg-red-100" : "bg-slate-100"}`}><UserMinus className="h-4 w-4" /></div>Absence
                  </button>
                  <button onClick={() => setMotif("not_pointing")}
                    className={`flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${motif === "not_pointing" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <div className={`p-2 rounded-xl ${motif === "not_pointing" ? "bg-amber-100" : "bg-slate-100"}`}><AlertTriangle className="h-4 w-4" /></div>Non pointage
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={onClose} disabled={sending} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">Annuler</button>
              <button onClick={() => onConfirm(motif)} disabled={sending || !employee.email}
                className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
                  !employee.email ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-camublue-900 hover:bg-camublue-800 text-white"
                }`}>
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Envoyer</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── TableRow (vue journalière) ───────────────────────────────────────────────
function TableRow({ r, isLate, viewMode, onAlert, onDetail }: {
  r: FlatRecord; isLate: boolean; viewMode: ViewMode; onAlert: () => void; onDetail: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // ✅ Badge Service — badge violet avec truncate + tooltip natif sur hover
  const ServiceBadge = ({ service }: { service: string }) => {
    if (!service || service === "—") return <span className="text-slate-300 text-xs">—</span>;
    return (
      <span
        title={service}
        className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 max-w-[160px] truncate whitespace-nowrap"
      >
        {service}
      </span>
    );
  };

  return (
    <>
      <tr className={`hidden md:table-row border-b border-slate-100 transition-colors text-sm ${isLate ? "bg-orange-50/50 hover:bg-orange-50" : "hover:bg-slate-50"}`}>
        <td className="px-4 py-3 font-mono text-slate-500 text-xs"><div className="flex justify-center">{r.matricule || "—"}</div></td>
        <td className="px-4 py-3 font-medium text-slate-800"><div className="flex justify-center">{r.full_name}</div></td>
        <td className="px-4 py-3 text-xs">
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-semibold text-camublue-900 text-xs leading-tight tracking-wide">
              {r.project !== "—" ? r.project : r.department}
            </span>
            {r.project !== "—" && (
              <span className="text-[10px] text-slate-400 leading-tight">{r.department || "—"}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <ServiceBadge service={r.department} />
        </td>
        <td className="px-4 py-3"><div className="flex justify-center"><StatusPill status={r.status} /></div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><LateBadge minutes={r.computed_late_minutes} /></div></td>
        <td className={`px-4 py-3 tabular-nums font-mono text-sm ${r.computed_late_minutes > 0 ? "text-red-600 font-semibold" : "text-slate-700"}`}>
          <div className="flex justify-center">{formatTime(r.in_time)}</div>
        </td>
        <td className={`px-4 py-3 tabular-nums font-mono text-sm ${r.overtime_minutes > 0 ? "text-emerald-600 font-semibold" : "text-slate-700"}`}>
          <div className="flex justify-center">{formatTime(r.out_time)}</div>
        </td>
        <td className="px-4 py-3"><div className="flex justify-center"><WorkedTimeBadge minutes={r.worked_minutes} expectedMin={r.expected_minutes} /></div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><OvertimeBadge minutes={r.overtime_minutes} /></div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><CompensationCell c={r.compensation} viewMode={viewMode} /></div></td>
        <td className="px-4 py-3">
          <div className="flex gap-2 justify-center">
            <button onClick={onAlert} disabled={r.status !== "absent" || !r.email}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${r.status === "absent" && r.email ? "bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
              <Bell className="h-3 w-3" />Alerter
            </button>
            <button onClick={onDetail} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition">
              Détail
            </button>
          </div>
        </td>
      </tr>
      <tr className={`md:hidden border-b border-slate-100 ${isLate ? "bg-orange-50/40" : ""}`}>
        <td colSpan={11} className="px-3 py-2">
          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">{r.full_name}</p>
              <p className="text-xs text-slate-400 font-mono">{r.matricule || "—"} · {r.project !== "—" ? `${r.project} / ` : ""}{r.department}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusPill status={r.status} />
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function AbsentsCard({ total, absent, loading, delay }: { total: number; absent: number; loading: boolean; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl bg-red-500 text-white"><UserMinus className="h-5 w-5" /></div>
      </div>
      {loading ? (
        <div className="space-y-2 mt-1"><div className="h-4 w-28 bg-slate-100 rounded animate-pulse" /><div className="h-4 w-20 bg-slate-100 rounded animate-pulse" /></div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Effectif total</span>
            <span className="text-base font-bold text-slate-800 tabular-nums">{total}</span>
          </div>
          <div className="w-full h-px bg-slate-100" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-600">Absents</span>
            <span className="text-base font-bold text-red-600 tabular-nums">{absent}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "blue", delay = 0, loading = false, active = false, onClick }: {
  icon: any; label: string; value: string | number; sub?: string;
  color?: "blue"|"green"|"amber"|"red"|"violet"|"slate"|"orange";
  delay?: number; loading?: boolean; active?: boolean; onClick?: () => void;
}) {
  const palette = {
    blue:   { icon: "bg-camublue-900 text-white", text: "text-camublue-900" },
    green:  { icon: "bg-emerald-500 text-white",  text: "text-emerald-700"  },
    amber:  { icon: "bg-amber-500 text-white",    text: "text-amber-700"    },
    red:    { icon: "bg-red-500 text-white",       text: "text-red-700"      },
    violet: { icon: "bg-violet-500 text-white",   text: "text-violet-700"   },
    slate:  { icon: "bg-slate-400 text-white",    text: "text-slate-600"    },
    orange: { icon: "bg-orange-500 text-white",   text: "text-orange-700"   },
  };
  const c = palette[color];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }} onClick={onClick}
      className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${onClick ? "cursor-pointer" : ""} ${active ? "border-orange-400 ring-2 ring-orange-200 shadow-md" : "border-slate-100 hover:shadow-md"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.icon}`}><Icon className="h-5 w-5" /></div>
        {active && <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full ring-1 ring-orange-200">Filtré</span>}
      </div>
      {loading ? <div className="space-y-2 mt-1"><div className="h-7 w-20 bg-slate-100 rounded-lg animate-pulse" /><div className="h-4 w-28 bg-slate-100 rounded animate-pulse" /></div>
        : <><div className={`text-2xl font-bold ${c.text} mb-0.5`}>{value}</div><div className="text-sm font-medium text-slate-700">{label}</div>{sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}</>}
    </motion.div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AttendanceNormalesPage() {
  const [viewMode,   setViewMode]   = useState<ViewMode>("daily");
  const [loading,    setLoading]    = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [alertModalOpen,  setAlertModalOpen]  = useState(false);
  const [scheduleOpen,    setScheduleOpen]    = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedEmployee,   setSelectedEmployee]   = useState<FlatRecord | null>(null);
  const [sendingAlert,       setSendingAlert]        = useState(false);

  const [date,  setDate]  = useState(isoToday());
  const [week,  setWeek]  = useState(isoWeekNow());
  const [month, setMonth] = useState(yyyyMmToday());

  const [daily,   setDaily]   = useState<DailyStatsResponse   | null>(null);
  const [weekly,  setWeekly]  = useState<WeeklyStatsResponse  | null>(null);
  const [monthly, setMonthly] = useState<MonthlyStatsResponse | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQ,      setSearchQ]      = useState("");
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(10);
  const [emailMap,      setEmailMap]      = useState<Map<string,string>>(new Map());
  const [departmentMap, setDepartmentMap] = useState<Map<string,string>>(new Map());
  const [projectMap,    setProjectMap]    = useState<Map<string,string>>(new Map());
  const [shiftMatricules, setShiftMatricules] = useState<Set<string>>(new Set());

  // ── Horaires actifs — persistés dans localStorage ─────────────────────────
  const [presets, setPresets] = useState<WorkSchedulePreset[]>(() => {
    try {
      const stored = localStorage.getItem(LS_PRESETS_KEY);
      if (stored) return JSON.parse(stored) as WorkSchedulePreset[];
    } catch {}
    return DEFAULT_PRESETS;
  });

  const [activeSchedule, setActiveSchedule] = useState<ActiveSchedule | null>(() => {
    try {
      const stored = localStorage.getItem(LS_ACTIVE_SCHEDULE_KEY);
      if (stored) return JSON.parse(stored) as ActiveSchedule;
    } catch {}
    // Valeur par défaut : Normale, période = mois courant
    const d = new Date();
    const end = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return {
      ...DEFAULT_PRESETS[0],
      dateStart: isoToday(),
      dateEnd: end.toISOString().slice(0,10),
      locked: true,
    };
  });

  // ── Persistance automatique dans localStorage ─────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(LS_PRESETS_KEY, JSON.stringify(presets));
    } catch {}
  }, [presets]);

  useEffect(() => {
    try {
      if (activeSchedule) {
        localStorage.setItem(LS_ACTIVE_SCHEDULE_KEY, JSON.stringify(activeSchedule));
      } else {
        localStorage.removeItem(LS_ACTIVE_SCHEDULE_KEY);
      }
    } catch {}
  }, [activeSchedule]);

  // Le schedule effectif = activeSchedule si en période, sinon premier preset par défaut
  const effectiveSchedule: WorkSchedulePreset = useMemo(() => {
    if (activeSchedule && isPeriodActive(activeSchedule)) return activeSchedule;
    return presets[0] ?? DEFAULT_PRESETS[0];
  }, [activeSchedule, presets]);

  const pad2 = (n: number) => String(n).padStart(2,"0");

  useEffect(() => {
    getEmployees()
      .then((list: Employee[]) => {
        const m  = new Map<string,string>();
        const dm = new Map<string,string>();
        const pm = new Map<string,string>();
        list.forEach((e) => {
          if (e.matricule && e.email)       m.set(e.matricule, e.email);
          if (e.matricule && (e.department ?? (e as any).service))
            dm.set(e.matricule, (e.department ?? (e as any).service).toUpperCase());
          const proj = (e as any).project ?? (e as any).projet ?? (e as any).project_name ?? (e as any).site ?? null;
          if (e.matricule && proj)
            pm.set(e.matricule, String(proj).toUpperCase());
        });
        setEmailMap(m);
        setDepartmentMap(dm);
        setProjectMap(pm);
      }).catch(console.error);

    getShiftDailyStats({ date: isoToday() })
      .then((res) => {
        const set = new Set<string>(res.records.map((r: { matricule: string }) => r.matricule));
        setShiftMatricules(set);
      }).catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "daily")   setDaily(await getDailyStats(date));
      if (viewMode === "weekly")  setWeekly(await getWeeklyStats(week));
      if (viewMode === "monthly") setMonthly(await getMonthlyStats(month));
    } finally { setLoading(false); }
  }, [viewMode, date, week, month]);

  useEffect(() => { fetchData(); }, [viewMode]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQ, viewMode, daily, weekly, monthly, pageSize]);

  // ── Transformation → FlatRecord (vue journalière) ─────────────────────────
  const allRecords = useMemo((): FlatRecord[] => {
    const sched = effectiveSchedule;
    const effectiveWorkMin = workDayMinutes(sched);
    const isNormal = (r: any) => !shiftMatricules.has(r.matricule ?? "");

    const map = (r: any, isDaily: boolean): FlatRecord => {
      const mat = r.matricule ?? "";
      const inTime  = r.in_time  ?? null;
      const outTime = r.out_time ?? null;
      const workedRaw = computeWorkedMinutesFromTimes(inTime, outTime) || (r.worked_minutes ?? 0);
      const workedMin = isDaily ? Math.max(0, workedRaw - sched.breakMin) : workedRaw;
      const lateMin     = isDaily ? computeLateMinutes(inTime,  sched.startH, sched.startM) : (r.total_late_minutes ?? 0);
      const overtimeMin = isDaily ? computeOvertimeMinutes(outTime, sched.endH, sched.endM) : 0;
      return {
        employee_id: r.employee_id,
        matricule: mat,
        full_name: r.full_name ?? `${r.nom ?? ""} ${r.prenom ?? ""}`.trim(),
        department: (r.department ?? r.service ?? "—").toUpperCase(),
        project: (() => {
          const p = (r as any).project ?? (r as any).projet ?? (r as any).project_name ?? (r as any).site ?? null;
          return p ? String(p).toUpperCase() : (projectMap.get(mat) ?? "—");
        })(),
        status: isDaily ? r.status : r.absent_days > 0 ? "absent" : r.incomplete_days > 0 ? "incomplete" : "ok",
        is_late_api: r.is_late ?? r.late_days > 0,
        late_label_api: r.late_label ?? (r.late_days > 0 ? `${r.late_days}j · moy ${r.avg_late_minutes}min` : null),
        late_minutes_api: r.late_minutes ?? r.total_late_minutes ?? 0,
        computed_late_minutes: lateMin,
        overtime_minutes: overtimeMin,
        compensation: computeCompensation(lateMin, overtimeMin),
        deficit_minutes: computeDeficitMinutes(workedMin, isDaily ? effectiveWorkMin : (r.expected_minutes ?? 0)),
        in_time: inTime, out_time: outTime,
        worked_minutes: workedMin,
        delta_minutes: r.delta_minutes ?? 0,
        expected_minutes: isDaily ? effectiveWorkMin : (r.expected_minutes ?? 0),
        email: r.email ?? emailMap.get(mat) ?? null,
      };
    };

    if (viewMode === "daily"   && daily)   return daily.records.filter(isNormal).map((r) => map(r, true));
    if (viewMode === "weekly"  && weekly)  return weekly.by_employee.filter(isNormal).map((r: any) => map(r, false));
    if (viewMode === "monthly" && monthly) return monthly.by_employee.filter(isNormal).map((r: any) => map(r, false));
    return [];
  }, [viewMode, daily, weekly, monthly, emailMap, effectiveSchedule, shiftMatricules, projectMap]);

  // ── Transformation → SummaryRecord (hebdo / mensuel) ─────────────────────
  const summaryRecords = useMemo((): SummaryRecord[] => {
    const isNormal = (r: any) => !shiftMatricules.has(r.matricule ?? "");
    const resolveDept = (r: any) =>
      (r.department ?? r.service ?? departmentMap.get(r.matricule ?? "") ?? "—").toUpperCase();
    const resolveProject = (r: any) => {
      const p = (r as any).project ?? (r as any).projet ?? (r as any).project_name ?? (r as any).site ?? null;
      return p ? String(p).toUpperCase() : (projectMap.get(r.matricule ?? "") ?? "—");
    };

    if (viewMode === "weekly" && weekly) {
      return weekly.by_employee.filter(isNormal).map((r: any) => ({
        employee_id:    r.employee_id,
        matricule:      r.matricule ?? "",
        full_name:      r.full_name ?? "",
        department:     resolveDept(r),
        project:        resolveProject(r),
        nb_jours:       r.present_days ?? r.worked_days ?? 0,
        worked_minutes: r.total_worked_minutes ?? r.worked_minutes ?? 0,
      }));
    }
    if (viewMode === "monthly" && monthly) {
      return monthly.by_employee.filter(isNormal).map((r: any) => ({
        employee_id:    r.employee_id,
        matricule:      r.matricule ?? "",
        full_name:      r.full_name ?? "",
        department:     resolveDept(r),
        project:        resolveProject(r),
        nb_jours:       r.present_days ?? r.worked_days ?? 0,
        worked_minutes: r.total_worked_minutes ?? r.worked_minutes ?? 0,
      }));
    }
    return [];
  }, [viewMode, weekly, monthly, shiftMatricules, departmentMap, projectMap]);

  const kpis = useMemo(() => {
    const total = allRecords.length;
    if (viewMode === "daily" && daily) {
      const absent = allRecords.filter((r) => r.status === "absent").length;
      return { total, absent, late: allRecords.filter((r) => r.computed_late_minutes > 0).length, anomaly: daily.kpis.anomalies };
    }
    const emp = (viewMode === "weekly" ? weekly?.by_employee : monthly?.by_employee) as any[] | undefined;
    if (emp) {
      const absent = allRecords.filter((r) => r.status === "absent").length;
      return { total, absent, late: emp.filter((r) => (r.late_days ?? 0) > 0).length, anomaly: emp.filter((r) => r.anomaly_days > 0).length };
    }
    return { total: 0, absent: 0, late: 0, anomaly: 0 };
  }, [viewMode, daily, weekly, monthly, allRecords]);

  const isLateRecord = useCallback((r: FlatRecord) => viewMode === "daily" ? r.computed_late_minutes > 0 : r.is_late_api, [viewMode]);

  const filtered = useMemo(() => allRecords.filter((r) => {
    if (statusFilter === "late")    { if (!isLateRecord(r)) return false; }
    else if (statusFilter === "deficit") { if (r.deficit_minutes <= 0) return false; }
    else if (statusFilter !== "all")  { if (r.status !== statusFilter) return false; }
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return r.full_name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q) || r.department.toLowerCase().includes(q) || r.project.toLowerCase().includes(q);
  }), [allRecords, statusFilter, searchQ, isLateRecord]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData   = filtered.slice((page-1)*pageSize, page*pageSize);

  const filterCount = (key: StatusFilter) => {
    if (key === "all")    return allRecords.length;
    if (key === "late")   return allRecords.filter(isLateRecord).length;
    if (key === "deficit")return allRecords.filter((r) => r.deficit_minutes > 0).length;
    return allRecords.filter((r) => r.status === key).length;
  };

  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) { for (let i=1; i<=totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page-1); i <= Math.min(totalPages-1, page+1); i++) pages.push(i);
      if (page < totalPages-2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const handleSendAlert = async (motif: MotifType) => {
    if (!selectedEmployee) return;
    setSendingAlert(true);
    const res = await sendAlertEmail(selectedEmployee, motif);
    setSendingAlert(false);
    alert(res.success ? `Alerte envoyée à ${selectedEmployee.email}` : "Échec de l'envoi.");
    setAlertModalOpen(false); setSelectedEmployee(null);
  };

  const handleExport = () => {
    if (viewMode === "daily") {
      exportXLSX("pointage_normaux_journalier", filtered.map((r) => ({
        Matricule: r.matricule, Nom: r.full_name, Projet: r.project !== "—" ? r.project : "", Service: r.department, Statut: r.status,
        Retard: r.computed_late_minutes > 0 ? `RETARD · ${formatMinutes(r.computed_late_minutes)}` : "Non",
        Entrée: formatTime(r.in_time), Sortie: formatTime(r.out_time),
        "Heure travaillée": r.worked_minutes > 0 ? formatMinutes(r.worked_minutes) : "—",
        "Compensation": r.compensation.is_compensated ? "Oui" : r.compensation.late_min > 0 ? "Non" : "—",
        Email: r.email ?? "Manquant",
      })));
    } else {
      exportXLSX(`pointage_normaux_${viewMode === "weekly" ? "hebdo" : "mensuel"}`, summaryRecords.map((r) => ({
        Matricule: r.matricule, Nom: r.full_name, Projet: r.project !== "—" ? r.project : "", Service: r.department,
        "Nb jours": r.nb_jours,
        "Heures travaillées": formatMinutes(r.worked_minutes) || "0h",
        "% quota (40h)": `${Math.min(100, Math.round((r.worked_minutes / (viewMode === "weekly" ? MAX_WEEKLY_MIN : Math.round(MAX_WORKDAY_MIN*4.33))) * 100))}%`,
      })));
    }
  };

  const tableHeaders = ["Matricule","Nom","Projet/Département","Service","Statut","Retard","Entrée","Sortie","Heure travaillée","HS (>départ)","Compensation","Actions"];
  const isActiveLocked = activeSchedule ? isPeriodActive(activeSchedule) : false;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6">

        {/* ── En-tête ── */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-start shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-camublue-900">Pointages Normaux</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${
                isActiveLocked ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-slate-50 text-slate-500 ring-slate-200"
              }`}>
                {isActiveLocked ? <Lock className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {effectiveSchedule.context} ·
                {pad2(effectiveSchedule.startH)}h{pad2(effectiveSchedule.startM)} – {pad2(effectiveSchedule.endH)}h{pad2(effectiveSchedule.endM)}
                {effectiveSchedule.breakMin > 0 && ` · Pause ${effectiveSchedule.breakMin}min`}
              </span>
              {activeSchedule && isActiveLocked && (
                <span className="text-xs text-slate-400">
                  jusqu'au {new Date(activeSchedule.dateEnd).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"})}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setPage(1); }} placeholder="Nom, matricule…"
                className="pl-9 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-camublue-900 text-sm px-3 py-2 w-full sm:w-48 md:w-56 focus:outline-none" />
            </div>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none flex-1 sm:flex-none">
              <option value="daily">Journalier</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuel</option>
            </select>

            {/* Bouton horaires */}
            <button onClick={() => setScheduleOpen(true)}
              className={`border px-3 py-2 rounded-lg text-sm transition flex items-center gap-1.5 font-medium ${
                isActiveLocked ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100" : "bg-white border-slate-300 text-camublue-900 hover:bg-slate-50"
              }`}>
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Heures de travail</span>
              {isActiveLocked && <Lock className="h-3 w-3" />}
            </button>

            <button onClick={() => setFilterOpen(true)}
              className={`border px-3 py-2 rounded-lg text-sm transition flex items-center gap-1.5 ${statusFilter !== "all" ? "bg-orange-50 border-orange-300 text-orange-700" : "bg-white border-slate-300 hover:bg-slate-50"}`}>
              <Filter className="h-4 w-4" /><span className="hidden sm:inline">Filtrer</span>
              {statusFilter !== "all" && <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold leading-none">1</span>}
            </button>

            <button onClick={handleExport}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-green-600" /><span className="hidden sm:inline">Exporter</span>
            </button>

            <button onClick={fetchData}
              className="bg-camublue-900 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-camublue-800 transition">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Rafraîchir</span>
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <AbsentsCard total={kpis.total} absent={kpis.absent} loading={loading} delay={0.05} />
          <StatCard icon={Clock} label="Retards" value={kpis.late} color="orange" delay={0.1} loading={loading}
            active={statusFilter === "late"} sub="Cliquer pour filtrer"
            onClick={() => setStatusFilter((f) => f === "late" ? "all" : "late")} />
          <StatCard icon={AlertTriangle} label="Anomalies" value={kpis.anomaly} color="violet" delay={0.15} loading={loading} />
        </div>

        {/* ── Contenu principal — switch journalier / synthétique ── */}
        {viewMode === "daily" ? (
          <>
            {/* Filtres rapides */}
            <div className="shrink-0 w-full overflow-x-auto">
              <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 border border-camublue-900/20 shadow-sm min-w-max">
                {QUICK_FILTERS.map((f) => {
                  const isActive = statusFilter === f.key;
                  const count = filterCount(f.key);
                  return (
                    <button key={f.key} onClick={() => { setStatusFilter(f.key); setPage(1); }}
                      className={`relative inline-flex flex-col items-center justify-center gap-0.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 ${isActive ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/60"}`}>
                      <span className="inline-flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? f.activeDot : f.dotColor}`} />
                        <span className="hidden sm:inline">{f.label}</span>
                        <span className="sm:hidden">{f.label.split(" ")[0]}</span>
                      </span>
                      <span className={`tabular-nums font-bold leading-none ${isActive ? "text-camublue-900" : "text-slate-400/70"}`}>{count}</span>
                    </button>
                  );
                })}
                {statusFilter !== "all" && (
                  <>
                    <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />
                    <button onClick={() => setStatusFilter("all")} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Tableau journalier */}
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm min-h-0">
                <table className="min-w-max w-full bg-white">
                  <thead className="bg-camublue-900 text-white sticky top-0 z-10">
                    <tr>
                      {tableHeaders.map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wide border-b border-camublue-800 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <thead className="sticky top-0 z-10 bg-camublue-900 text-white md:hidden">
                    <tr><th className="px-3 py-3 text-left text-sm font-semibold" colSpan={12}>Employés ({filtered.length})</th></tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          {[...Array(tableHeaders.length)].map((_, j) => (
                            <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                          ))}
                        </tr>
                      ))
                    ) : pageData.length ? (
                      pageData.map((r) => (
                        <TableRow key={r.employee_id} r={r} isLate={isLateRecord(r)} viewMode={viewMode}
                          onAlert={() => { setSelectedEmployee(r); setAlertModalOpen(true); }}
                          onDetail={() => { setSelectedEmployeeId(r.employee_id); setDetailModalOpen(true); }} />
                      ))
                    ) : (
                      <tr><td colSpan={tableHeaders.length} className="text-center py-12 text-slate-400 text-sm">
                        {statusFilter === "late" ? "Aucun retard." : statusFilter === "deficit" ? "Aucune heure manquante." : "Aucun enregistrement trouvé."}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filtered.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm text-slate-500">
                      {(page-1)*pageSize+1}–{Math.min(page*pageSize, filtered.length)} / <strong className="text-slate-700">{filtered.length}</strong>
                    </span>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                      <span className="text-xs text-slate-400">Lignes :</span>
                      <div className="flex items-center gap-0.5">
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <button key={size} onClick={() => { setPageSize(size); setPage(1); }}
                            className={`min-w-[28px] h-6 rounded text-xs font-semibold transition-all ${pageSize === size ? "bg-camublue-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(1)} disabled={page===1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><FaAngleDoubleLeft size={12} /></button>
                    <button onClick={() => setPage((p) => Math.max(p-1,1))} disabled={page===1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-4 w-4" /></button>
                    <div className="flex items-center gap-0.5 mx-1">
                      {getPageNumbers().map((p, i) =>
                        p === "..." ? <span key={`e-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                          : <button key={p} onClick={() => setPage(p as number)}
                              className={`min-w-[28px] sm:min-w-[32px] h-7 sm:h-8 rounded-md text-xs sm:text-sm font-medium transition-colors ${page===p ? "bg-camublue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
                              {p}
                            </button>
                      )}
                    </div>
                    <button onClick={() => setPage((p) => Math.min(p+1,totalPages))} disabled={page===totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-4 w-4" /></button>
                    <button onClick={() => setPage(totalPages)} disabled={page===totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><FaAngleDoubleRight size={12} /></button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Vue Hebdo / Mensuel : tableau synthétique ── */
          <SummaryTable rows={summaryRecords} mode={viewMode as "weekly"|"monthly"} isLoading={loading} searchQ={searchQ} />
        )}

        {/* ── Modals ── */}
        <WorkScheduleModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          active={activeSchedule}
          presets={presets}
          onSave={(s) => setActiveSchedule(s)}
          onPresetsChange={(p) => setPresets(p)}
        />
        <FilterModal open={filterOpen} onClose={() => setFilterOpen(false)}
          viewMode={viewMode} setViewMode={setViewMode}
          date={date} setDate={setDate} week={week} setWeek={setWeek}
          month={month} setMonth={setMonth}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          onApply={fetchData} />
        <DetailModal open={detailModalOpen} onClose={() => setDetailModalOpen(false)}
          employeeId={selectedEmployeeId} initialWeek={week} />
        <AlertModal open={alertModalOpen} onClose={() => setAlertModalOpen(false)}
          employee={selectedEmployee} onConfirm={handleSendAlert} sending={sendingAlert} />
      </motion.div>
    </AppLayout>
  );
}
