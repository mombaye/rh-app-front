import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  Clock, AlertTriangle, UserMinus, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2, ChevronDown,
  Check, Settings, CheckCircle, Lock, CalendarDays,
  TrendingUp, Pencil, Plus, Trash2, Filter, Upload, CalendarRange, ArrowLeftRight,
} from "lucide-react";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import {
  getShiftDailyStats, getEmployeePeriodDetail, getWeeklyStats, getMonthlyStats,
  getShiftSchedule, saveShiftSchedule, uploadShiftPlanning, getShiftPlanningForDate,
} from "@/services/attendanceService";
import type { PlanningEntry } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import type {
  ShiftDailyStatsResponse, ShiftTeamKey, ShiftRecord,
  EmployeePeriodDetailResponse, DayDetail,
  WeeklyStatsResponse, MonthlyStatsResponse,
} from "@/types/attendance";
import type { Employee } from "@/types/employee";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusFilter = "all" | "ok" | "absent" | "incomplete" | "anomaly" | "late" | "deficit";
type MotifType    = "absent" | "not_pointing";
type AssignmentMap = Record<string, ShiftTeamKey | null>;
type ViewMode     = "daily" | "weekly" | "monthly";

// Planning : map date → shift_type → [employee names/matricules]
type DayPlanningMap = Record<string, { employee_name: string; employee_matricule?: string | null }[]>;
// "jour" | "soir1" | "soir2" → DayPlanningMap
type PlanningMap = { jour: DayPlanningMap; soir1: DayPlanningMap; soir2: DayPlanningMap };

// ─── Constantes ───────────────────────────────────────────────────────────────
const MAX_WORKDAY_MIN   = 8  * 60;
const MAX_WEEKLY_MIN    = 40 * 60;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS_SHIFT_ACTIVE_SCHEDULE_KEY = "camu_shift_active_schedule";
const LS_SHIFT_ASSIGNMENTS_KEY     = "camu_shift_assignments";
const LS_SHIFT_PRESETS_KEY         = "camu_shift_work_schedule_presets";

// ─── Presets horaires ─────────────────────────────────────────────────────────
interface WorkSchedulePreset {
  context: string;
  startH: number; startM: number;
  endH:   number; endM:   number;
  breakMin: number;
}

const DEFAULT_PRESETS: WorkSchedulePreset[] = [
  { context: "08H-16H", startH: 8,  startM: 0, endH: 16, endM: 0, breakMin: 60 },
  { context: "16H-22H", startH: 16, startM: 0, endH: 22, endM: 0, breakMin: 30 },
  { context: "22H-08H", startH: 22, startM: 0, endH: 8,  endM: 0, breakMin: 60 },
];

interface ActiveSchedule extends WorkSchedulePreset {
  dateStart: string;
  dateEnd:   string;
  locked:    boolean;
}

function workDayMinutes(s: WorkSchedulePreset): number {
  return Math.max(0, (s.endH * 60 + s.endM) - (s.startH * 60 + s.startM) - s.breakMin);
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isPeriodActive(s: ActiveSchedule): boolean {
  const today = todayISO();
  return today >= s.dateStart && today <= s.dateEnd;
}
function isoWeekNow(): string {
  const d    = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day  = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const w  = Math.ceil((((date.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
}
function yyyyMmToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface CompensationResult {
  late_min: number; overtime_min: number; compensated_min: number;
  remaining_min: number; is_compensated: boolean; has_overtime: boolean;
}

interface FlatRecord {
  employee_id: number; matricule: string; full_name: string; department: string; project: string;
  status: "ok" | "absent" | "incomplete" | "anomaly";
  is_late_api: boolean; late_label_api: string | null;
  computed_late_minutes: number; overtime_minutes: number;
  compensation: CompensationResult; deficit_minutes: number;
  in_time: string | null; out_time: string | null;
  worked_minutes: number; expected_minutes: number; email: string | null;
  shift_team: ShiftTeamKey | null; shift_team_label: string;
  // Planning
  is_scheduled: boolean;      // true if employee is in today's planning
  is_replacement: boolean;    // true if present but NOT in planning (replacement)
  not_scheduled_rest: boolean; // true if not scheduled (rest day) → hide from absent count
}

interface SummaryRecord {
  employee_id: number; matricule: string; full_name: string; department: string; project: string;
  shift_team: ShiftTeamKey | null;
  nb_jours: number; worked_minutes: number;
}

interface Pointage {
  day: string; date: string;
  in_time: string | null; out_time: string | null;
  status: "ok" | "absent" | "incomplete" | "anomaly";
}

// ─── Shift teams config ───────────────────────────────────────────────────────
const SHIFT_TEAMS: {
  key: ShiftTeamKey; label: string; short: string; horaire: string;
  dot: string; activeBg: string; activeText: string; activeBorder: string; pillBg: string; headerBg: string;
}[] = [
  {
    key: "jour", label: "Shift 08H-16H", short: "08H-16H", horaire: "08h – 16h",
    dot: "bg-teal-500", activeBg: "bg-teal-50", activeText: "text-teal-800",
    activeBorder: "border-teal-400", pillBg: "bg-teal-100 text-teal-800 ring-1 ring-teal-300", headerBg: "bg-teal-700",
  },
  {
    key: "soir1", label: "Shift 16H-22H", short: "16H-22H", horaire: "16h – 22h",
    dot: "bg-yellow-500", activeBg: "bg-yellow-50", activeText: "text-yellow-800",
    activeBorder: "border-yellow-400", pillBg: "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300", headerBg: "bg-yellow-600",
  },
  {
    key: "soir2", label: "Shift 22H-08H", short: "22H-08H", horaire: "22h – 08h",
    dot: "bg-orange-500", activeBg: "bg-orange-50", activeText: "text-orange-800",
    activeBorder: "border-orange-400", pillBg: "bg-orange-100 text-orange-800 ring-1 ring-orange-300", headerBg: "bg-orange-700",
  },
];

const STATUS_CFG = {
  ok:         { label: "OK",         dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  absent:     { label: "Absent",     dot: "bg-red-500",     badge: "bg-red-50 text-red-700 ring-red-200"             },
  incomplete: { label: "Incomplet",  dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-800 ring-amber-200"       },
  anomaly:    { label: "Anomalie",   dot: "bg-violet-500",  badge: "bg-violet-50 text-violet-700 ring-violet-200"    },
};

const QUICK_FILTERS = [
  { key: "all"        as StatusFilter, label: "Tous",         dotColor: "bg-slate-400",  activeDot: "bg-white"         },
  { key: "ok"         as StatusFilter, label: "OK",           dotColor: "bg-emerald-400",activeDot: "bg-emerald-500"   },
  { key: "absent"     as StatusFilter, label: "Absents",      dotColor: "bg-red-400",    activeDot: "bg-red-500"       },
  { key: "late"       as StatusFilter, label: "Retards",      dotColor: "bg-orange-400", activeDot: "bg-orange-500"    },
  { key: "incomplete" as StatusFilter, label: "Incomplets",   dotColor: "bg-amber-400",  activeDot: "bg-amber-500"     },
  { key: "anomaly"    as StatusFilter, label: "Anomalies",    dotColor: "bg-violet-400", activeDot: "bg-violet-500"    },
  { key: "deficit"    as StatusFilter, label: "Heures moins", dotColor: "bg-rose-400",   activeDot: "bg-rose-500"      },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
function formatMinutes(min: number): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
function computeLateMinutes(iso: string | null, thH: number, thM: number): number {
  if (!iso) return 0;
  const d = new Date(iso); if (isNaN(d.getTime())) return 0;
  const t = d.getHours() * 60 + d.getMinutes(), th = thH * 60 + thM;
  return t > th ? t - th : 0;
}
function computeOvertimeMinutes(iso: string | null, thH: number, thM: number): number {
  if (!iso) return 0;
  const d = new Date(iso); if (isNaN(d.getTime())) return 0;
  const t = d.getHours() * 60 + d.getMinutes(), th = thH * 60 + thM;
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
  return {
    late_min: lateMin, overtime_min: overtimeMin, compensated_min: compensated,
    remaining_min: remaining, is_compensated: lateMin > 0 && remaining === 0, has_overtime: overtimeMin > 0,
  };
}
function computeDeficitMinutes(worked: number, expected: number): number {
  const exp = expected > 0 ? expected : MAX_WORKDAY_MIN;
  return worked > 0 ? Math.max(0, exp - worked) : 0;
}

// ─── ✅ Détection automatique du shift depuis l'heure d'entrée ────────────────
function detectShiftTeamFromTime(inIso: string | null): ShiftTeamKey | null {
  if (!inIso) return null;
  const d = new Date(inIso);
  if (isNaN(d.getTime())) return null;
  const h = d.getHours();
  // 08H-16H : entrée entre 5h et 14h
  if (h >= 5 && h < 14) return "jour";
  // 16H-22H : entrée entre 14h et 20h
  if (h >= 14 && h < 20) return "soir1";
  // 22H-08H : entrée entre 20h et 5h (nuit)
  return "soir2";
}

// ─── Export XLSX ──────────────────────────────────────────────────────────────
function exportXLSX(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cell]) ws[cell].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A5F" } }, alignment: { horizontal: "center" } };
  }
  ws["!cols"] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2 }));
  XLSX.utils.book_append_sheet(wb, ws, "Pointages");
  XLSX.writeFile(wb, `${filename}_${todayISO()}.xlsx`);
}

async function sendAlertEmail(emp: FlatRecord, motif: MotifType): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 500));
  return { success: !!emp.email };
}

// ─── Badges ───────────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: keyof typeof STATUS_CFG }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.anomaly;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{c.label}
    </span>
  );
}
function ShiftTeamPill({ teamKey }: { teamKey: ShiftTeamKey | null }) {
  if (!teamKey) return <span className="text-slate-300 text-xs">—</span>;
  const cfg = SHIFT_TEAMS.find((t) => t.key === teamKey);
  if (!cfg) return <span className="text-slate-400 text-xs">{teamKey}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.pillBg}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />{cfg.short}
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
function CompensationCell({ c }: { c: CompensationResult }) {
  if (c.late_min === 0) return <span className="text-slate-300 text-xs">—</span>;
  return c.is_compensated
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 whitespace-nowrap">✓ Compensé</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 ring-1 ring-red-200 whitespace-nowrap">✗ Non compensé</span>;
}
function ReplacementBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 ring-1 ring-purple-300 whitespace-nowrap">
      <ArrowLeftRight className="h-3 w-3 shrink-0" />Remplaçant
    </span>
  );
}
function RestDayBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 ring-1 ring-slate-200 whitespace-nowrap">
      Repos
    </span>
  );
}

// ─── Barre de progression ─────────────────────────────────────────────────────
function WeekProgressBar({ minutes, maxMinutes }: { minutes: number; maxMinutes: number }) {
  const pct       = Math.min(100, Math.round((minutes / maxMinutes) * 100));
  const over      = minutes > maxMinutes;
  const color     = pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  const bgColor   = pct >= 100 ? "bg-emerald-100" : pct >= 75 ? "bg-blue-100" : pct >= 50 ? "bg-amber-100" : "bg-red-100";
  const textColor = pct >= 100 ? "text-emerald-700" : pct >= 75 ? "text-blue-700" : pct >= 50 ? "text-amber-700" : "text-red-600";
  return (
    <div className="flex items-center gap-2.5 min-w-[180px]">
      <div className={`relative flex-1 h-2 rounded-full overflow-hidden ${bgColor}`}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }}
          className={`absolute inset-y-0 left-0 rounded-full ${color}`} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-9 text-right shrink-0 ${textColor}`}>{pct}%</span>
      {over && <span className="shrink-0 text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">+{formatMinutes(minutes - maxMinutes)}</span>}
    </div>
  );
}

// ─── Tableau synthétique (Hebdo / Mensuel) ────────────────────────────────────
function SummaryTable({ rows, mode, isLoading }: {
  rows: SummaryRecord[]; mode: "weekly" | "monthly"; isLoading: boolean;
}) {
  const MAX_MIN  = mode === "weekly" ? MAX_WEEKLY_MIN : Math.round(MAX_WEEKLY_MIN * 4.33);
  const maxLabel = mode === "weekly" ? "40h/sem" : `${formatMinutes(MAX_MIN)}/mois`;

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const total   = rows.reduce((s, r) => s + r.worked_minutes, 0);
    const avg     = Math.round(total / rows.length);
    const complet = rows.filter((r) => r.worked_minutes >= MAX_MIN).length;
    return { avg, complet, total, effectif: rows.length };
  }, [rows, MAX_MIN]);

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center gap-3 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Chargement…</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {stats && (
        <div className="grid grid-cols-3 gap-3 shrink-0">
          {[
            { icon: <Clock className="h-4 w-4" />, label: "Moy. heures/employé", value: formatMinutes(stats.avg) || "—", color: "text-blue-600 bg-blue-50" },
            { icon: <CheckCircle className="h-4 w-4" />, label: "Quota atteint", value: `${stats.complet}/${stats.effectif}`, color: "text-emerald-600 bg-emerald-50" },
            { icon: <TrendingUp className="h-4 w-4" />, label: "Total heures", value: formatMinutes(stats.total) || "—", color: "text-purple-600 bg-purple-50" },
          ].map((k) => (
            <div key={k.label} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
              <span className={`p-2 rounded-lg ${k.color}`}>{k.icon}</span>
              <div><p className="text-xs text-gray-400 leading-none mb-0.5">{k.label}</p><p className="text-base font-bold text-gray-800">{k.value}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm min-h-0 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-camublue-900 text-white sticky top-0 z-10">
            <tr>
              {["Matricule", "Nom complet", "Projet/Département", "Service", "Équipe", "Nb jours", "Heures trav."].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wide border-b border-camublue-800">{h}</th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide border-b border-camublue-800 min-w-[220px]">
                <span className="flex items-center gap-1.5">Progression <span className="text-[10px] font-normal opacity-70 bg-white/20 px-1.5 py-0.5 rounded-full">max {maxLabel}</span></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0
              ? <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">Aucune donnée pour cette période.</td></tr>
              : rows.map((row, idx) => {
                const pct = Math.min(100, Math.round((row.worked_minutes / MAX_MIN) * 100));
                const cls = pct >= 100 ? "bg-emerald-50 text-emerald-700" : pct >= 75 ? "bg-blue-50 text-blue-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600";
                return (
                  <motion.tr key={row.employee_id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.015 }} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.matricule}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{row.full_name}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="font-semibold text-camublue-900 text-xs leading-tight tracking-wide">
                        {row.project !== "—" ? row.project : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="font-semibold text-camublue-900 text-xs leading-tight tracking-wide">
                        {row.department !== "—" ? row.department : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5"><ShiftTeamPill teamKey={row.shift_team} /></td>
                    <td className="px-4 py-2.5"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-xs font-bold text-slate-600">{row.nb_jours}</span></td>
                    <td className="px-4 py-2.5"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${cls}`}>{formatMinutes(row.worked_minutes) || "0h"}</span></td>
                    <td className="px-4 py-2.5"><WeekProgressBar minutes={row.worked_minutes} maxMinutes={MAX_MIN} /></td>
                  </motion.tr>
                );
              })
            }
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
          <span key={l.label} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />{l.label}</span>
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
  const [view,           setView]           = useState<"list" | "period" | "form">("list");
  const [selectedPreset, setSelectedPreset] = useState<WorkSchedulePreset | null>(null);
  const [editingPreset,  setEditingPreset]  = useState<WorkSchedulePreset | null>(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState<string | null>(null);
  const [dateStart,      setDateStart]      = useState(todayISO());
  const [dateEnd,        setDateEnd]        = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [saved,     setSaved]     = useState(false);
  const [fContext,  setFContext]  = useState("");
  const [fStartH,   setFStartH]  = useState(8);
  const [fStartM,   setFStartM]  = useState(0);
  const [fEndH,     setFEndH]    = useState(17);
  const [fEndM,     setFEndM]    = useState(30);
  const [fBreakMin, setFBreakMin]= useState(60);
  const [fError,    setFError]   = useState("");

  const isLocked = active ? isPeriodActive(active) : false;
  const pad = (n: number) => String(n).padStart(2, "0");

  useEffect(() => {
    if (open) {
      setView("list"); setSaved(false); setDeleteConfirm(null); setEditingPreset(null);
      if (active) {
        setSelectedPreset(presets.find((p) => p.context === active.context) ?? presets[0] ?? null);
        setDateStart(active.dateStart); setDateEnd(active.dateEnd);
      } else {
        setSelectedPreset(presets[0] ?? null); setDateStart(todayISO());
      }
    }
  }, [open]);

  const openForm = (preset?: WorkSchedulePreset) => {
    if (preset) {
      setFContext(preset.context); setFStartH(preset.startH); setFStartM(preset.startM);
      setFEndH(preset.endH); setFEndM(preset.endM); setFBreakMin(preset.breakMin);
      setEditingPreset(preset);
    } else {
      setFContext(""); setFStartH(8); setFStartM(0); setFEndH(17); setFEndM(30); setFBreakMin(60);
      setEditingPreset(null);
    }
    setFError(""); setView("form");
  };

  const handleSavePreset = () => {
    const name = fContext.trim();
    if (!name) { setFError("Le nom du contexte est requis."); return; }
    if (presets.some((p) => p.context === name && p.context !== editingPreset?.context)) { setFError("Ce nom de contexte existe déjà."); return; }
    const effMin = (fEndH * 60 + fEndM) - (fStartH * 60 + fStartM) - fBreakMin;
    if (effMin <= 0) { setFError("La durée effective doit être positive."); return; }
    const newPreset: WorkSchedulePreset = { context: name, startH: fStartH, startM: fStartM, endH: fEndH, endM: fEndM, breakMin: fBreakMin };
    const updated = editingPreset
      ? presets.map((p) => p.context === editingPreset.context ? newPreset : p)
      : [...presets, newPreset];
    if (editingPreset && selectedPreset?.context === editingPreset.context) setSelectedPreset(newPreset);
    onPresetsChange(updated); setView("list"); setFError("");
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
    onSave({ ...selectedPreset, dateStart, dateEnd, locked: todayISO() >= dateStart && todayISO() <= dateEnd });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  const plannedMin = selectedPreset ? workDayMinutes(selectedPreset) : 0;
  const exceedsMax = plannedMin > MAX_WORKDAY_MIN;
  const formEffMin = (fEndH * 60 + fEndM) - (fStartH * 60 + fStartM) - fBreakMin;

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

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {(view === "form" || view === "period") && (
                  <button onClick={() => setView("list")} className="p-1 rounded-lg hover:bg-slate-100 transition mr-1">
                    <ChevronLeft className="h-4 w-4 text-slate-500" />
                  </button>
                )}
                <Settings className="h-4 w-4 text-camublue-900" />
                <span className="font-semibold text-gray-900">
                  {view === "list" ? "Heures de travail" : view === "period" ? "Assigner une période" : editingPreset ? "Modifier le contexte" : "Nouveau contexte"}
                </span>
                {view === "list" && isLocked && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                    <Lock className="h-3 w-3" />Période active
                  </span>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition"><X className="h-4 w-4 text-gray-500" /></button>
            </div>

            {/* ── Vue : Liste des contextes ── */}
            {view === "list" && (
              <>
                <div className="px-6 py-5 space-y-3 max-h-[65vh] overflow-y-auto">
                  {isLocked && active && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <Lock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-800">Période active — contexte <strong>{active.context}</strong></p>
                        <p className="text-amber-700 text-xs mt-0.5">
                          {pad(active.startH)}h{pad(active.startM)} – {pad(active.endH)}h{pad(active.endM)}
                          {active.breakMin > 0 ? ` · Pause ${active.breakMin}min` : ""}
                          {" · jusqu'au "}{new Date(active.dateEnd).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {presets.length === 0 && <p className="text-center text-sm text-slate-400 py-6">Aucun contexte horaire. Créez-en un.</p>}
                    {presets.map((preset) => {
                      const isActive = active?.context === preset.context && isLocked;
                      return (
                        <div key={preset.context}
                          className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all ${isActive ? "border-amber-300 bg-amber-50/50" : "border-slate-100 bg-white hover:border-slate-200"}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 text-sm">{preset.context}</span>
                              {isActive && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Actif</span>}
                            </div>
                            <p className="text-xs font-mono text-slate-500 mt-0.5">
                              {pad(preset.startH)}h{pad(preset.startM)} → {pad(preset.endH)}h{pad(preset.endM)}
                              <span className="mx-1 text-slate-300">·</span>Pause {preset.breakMin}min
                              <span className="mx-1 text-slate-300">·</span>
                              <span className="text-emerald-600 font-semibold">{formatMinutes(workDayMinutes(preset))}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {deleteConfirm === preset.context ? (
                              <div className="flex items-center gap-1.5 bg-red-50 rounded-xl px-3 py-1.5 border border-red-200">
                                <span className="text-xs text-red-600 font-medium">Confirmer ?</span>
                                <button onClick={() => handleDeletePreset(preset.context)} className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition">Oui</button>
                                <button onClick={() => setDeleteConfirm(null)} className="text-xs font-medium text-slate-500 hover:text-slate-700 px-1">Non</button>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => openForm(preset)} title="Modifier" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-camublue-900 transition"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={() => setDeleteConfirm(preset.context)} title="Supprimer" disabled={isActive}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="h-3.5 w-3.5" /></button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                  <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">Fermer</button>
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
                        <p className="font-semibold text-amber-800">Période active jusqu'au {new Date(active.dateEnd).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
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
                            className={`flex flex-col gap-1.5 p-3 rounded-2xl border-2 text-left transition-all ${isSel ? "border-camublue-900 bg-camublue-900/5" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-bold ${isSel ? "text-camublue-900" : "text-slate-700"}`}>{preset.context}</span>
                              {isSel && <CheckCircle className="h-4 w-4 text-camublue-900" />}
                            </div>
                            <p className="text-xs font-mono text-slate-500">{pad(preset.startH)}h{pad(preset.startM)} → {pad(preset.endH)}h{pad(preset.endM)}</p>
                            <p className="text-xs text-slate-400">Pause {preset.breakMin}min · <span className="text-emerald-600 font-semibold">{formatMinutes(workDayMinutes(preset))}</span></p>
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
                          min={isLocked && active ? new Date(new Date(active.dateEnd).getTime() + 86400000).toISOString().slice(0, 10) : undefined}
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
                  <button onClick={() => setView("list")} className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">Annuler</button>
                  <button onClick={handleSavePeriod} disabled={!selectedPreset || dateStart > dateEnd}
                    className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${saved ? "bg-emerald-500 text-white" : "bg-camublue-900 hover:bg-camublue-800 text-white"}`}>
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
                      {[
                        { label: "Heure d'entrée", H: fStartH, M: fStartM, setH: setFStartH, setM: setFStartM },
                        { label: "Heure de sortie", H: fEndH,  M: fEndM,   setH: setFEndH,   setM: setFEndM   },
                      ].map((f) => (
                        <div key={f.label} className="space-y-1">
                          <label className="text-xs text-slate-400">{f.label}</label>
                          <div className="flex items-center gap-1">
                            <input type="number" min={0} max={23} value={f.H}
                              onChange={(e) => f.setH(Math.min(23, Math.max(0, +e.target.value)))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-center font-mono focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                            <span className="text-slate-400 font-bold">h</span>
                            <input type="number" min={0} max={59} value={f.M}
                              onChange={(e) => f.setM(Math.min(59, Math.max(0, +e.target.value)))}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-center font-mono focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                          </div>
                        </div>
                      ))}
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
                      <p className="font-semibold">{formEffMin <= 0 ? "Durée invalide" : `Durée effective : ${formatMinutes(formEffMin)}`}</p>
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
                  <button onClick={() => { setView("list"); setFError(""); }} className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">Annuler</button>
                  <button onClick={handleSavePreset} disabled={formEffMin <= 0 || !fContext.trim()}
                    className="flex-1 rounded-2xl bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <CheckCircle className="h-4 w-4" />{editingPreset ? "Mettre à jour" : "Créer le contexte"}
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

// ─── Modal : Détail hebdomadaire ──────────────────────────────────────────────
function DetailModal({ open, onClose, employeeId, initialWeek }: {
  open: boolean; onClose: () => void; employeeId: number | null; initialWeek: string;
}) {
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [selWeek,   setSelWeek]   = useState(initialWeek);

  const weekBounds = (ws: string) => {
    const [y, wn] = ws.split("-W").map(Number);
    const fw = new Date(y, 0, 1);
    fw.setDate(fw.getDate() + (wn - 1) * 7 - fw.getDay() + 1);
    const lw = new Date(fw); lw.setDate(lw.getDate() + 4);
    return { start: fw.toISOString().split("T")[0], end: lw.toISOString().split("T")[0] };
  };

  const fetchPointages = useCallback(async () => {
    if (!employeeId || !open) return;
    setLoading(true);
    try {
      const { start, end } = weekBounds(selWeek);
      const res: EmployeePeriodDetailResponse = await getEmployeePeriodDetail({ employee_id: employeeId, start, end });
      setPointages(["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"].map((day, i) => {
        const cur = new Date(start); cur.setDate(cur.getDate() + i);
        const ds  = cur.toISOString().split("T")[0];
        const dd  = res.days.find((d: DayDetail) => d.date === ds);
        return { day, date: ds, in_time: dd?.in_time ?? null, out_time: dd?.out_time ?? null, status: dd?.status ?? "absent" };
      }));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [employeeId, selWeek, open]);

  useEffect(() => { fetchPointages(); }, [fetchPointages]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-camublue-900">Pointages hebdomadaires</h3>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition"><X className="h-5 w-5 text-slate-500" /></button>
            </div>
            <div className="px-4 sm:px-6 py-3 border-b border-slate-100 shrink-0">
              <div className="flex gap-2">
                <input type="text" value={selWeek} onChange={(e) => setSelWeek(e.target.value)} placeholder="2026-W09"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                <button onClick={fetchPointages} className="px-4 py-2 bg-camublue-900 text-white rounded-lg text-sm hover:bg-camublue-800 transition whitespace-nowrap">Charger</button>
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {loading
                ? <div className="flex justify-center py-12"><div className="h-10 w-10 border-4 border-camublue-900 border-t-transparent rounded-full animate-spin" /></div>
                : pointages.length > 0
                  ? <div className="space-y-2">
                      {pointages.map((p, i) => (
                        <div key={i} className={`rounded-xl border p-3 grid grid-cols-5 gap-4 ${p.status === "ok" ? "bg-white border-slate-100" : "bg-rose-50 border-rose-100"}`}>
                          <span className="font-medium text-slate-800 text-sm">{p.day}</span>
                          <span className="text-sm text-slate-600">{new Date(p.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                          <span><StatusPill status={p.status} /></span>
                          <span className={`text-sm ${p.in_time ? "text-slate-700" : "text-slate-400"}`}>{p.in_time ? formatTime(p.in_time) : "—"}</span>
                          <span className={`text-sm ${p.out_time ? "text-slate-700" : "text-slate-400"}`}>{p.out_time ? formatTime(p.out_time) : "—"}</span>
                        </div>
                      ))}
                    </div>
                  : <div className="flex flex-col items-center justify-center py-12 text-slate-400"><AlertTriangle className="h-10 w-10 mb-3 text-slate-300" /><p>Aucun pointage trouvé.</p></div>
              }
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

// ─── Parsing Excel planning ───────────────────────────────────────────────────
function parsePlanningExcel(buffer: ArrayBuffer): PlanningEntry[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];

  const entries: PlanningEntry[] = [];
  const headerRow = rawRows[0] ?? [];

  // Parse date columns (index 1+)
  const dates: string[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    const cell = headerRow[c];
    let ds = "";
    if (cell instanceof Date) {
      ds = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(cell.getDate()).padStart(2, "0")}`;
    } else if (typeof cell === "number" && cell > 40000) {
      // Excel serial date
      const d = new Date(Math.round((cell - 25569) * 86400 * 1000));
      ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    } else if (typeof cell === "string" && cell.trim()) {
      const s = cell.trim();
      // "26/01/2026" → "2026-01-26"
      const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) ds = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    dates.push(ds);
  }

  // Map shift label → shift key
  const detectShift = (label: string): ShiftTeamKey | null => {
    const s = label.toUpperCase().replace(/\s/g, "");
    if (s.includes("08") && s.includes("16")) return "jour";
    if (s.includes("16") && s.includes("22")) return "soir1";
    if (s.includes("22") && s.includes("08")) return "soir2";
    if (s.includes("08H") || s.includes("8H")) return "jour";
    if (s.includes("16H")) return "soir1";
    if (s.includes("22H")) return "soir2";
    return null;
  };

  let currentShift: ShiftTeamKey | null = null;
  for (let row = 1; row < rawRows.length; row++) {
    const rowData = rawRows[row] as any[];
    const shiftCell = String(rowData[0] ?? "").trim();
    if (shiftCell) {
      const detected = detectShift(shiftCell);
      if (detected) currentShift = detected;
    }
    if (!currentShift) continue;

    for (let c = 1; c < rowData.length; c++) {
      const name = String(rowData[c] ?? "").trim();
      const date = dates[c - 1];
      if (name && date) {
        entries.push({ date, shift_type: currentShift, employee_name: name });
      }
    }
  }

  return entries;
}

// ─── Modal : Import Planning Excel ────────────────────────────────────────────
function PlanningUploadModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: (count: number) => void;
}) {
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<PlanningEntry[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => { if (open) { setFile(null); setPreview([]); setError(""); setUploaded(false); } }, [open]);

  const handleFile = (f: File | null) => {
    if (!f) { setFile(null); setPreview([]); return; }
    setFile(f); setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const entries = parsePlanningExcel(ev.target!.result as ArrayBuffer);
        if (!entries.length) { setError("Aucune donnée trouvée dans ce fichier."); setPreview([]); return; }
        setPreview(entries);
      } catch { setError("Erreur lors de la lecture du fichier Excel."); setPreview([]); }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleUpload = async () => {
    if (!preview.length) return;
    setLoading(true); setError("");
    try {
      const batchId = `upload_${Date.now()}`;
      const res = await uploadShiftPlanning({ batch_id: batchId, entries: preview });
      setUploaded(true);
      setTimeout(() => { onSuccess(res.created); onClose(); }, 800);
    } catch { setError("Erreur lors de l'envoi du planning. Réessayez."); } finally { setLoading(false); }
  };

  // Stats by shift
  const stats = useMemo(() => {
    const c: Record<string, number> = { jour: 0, soir1: 0, soir2: 0 };
    preview.forEach((e) => { if (e.shift_type in c) c[e.shift_type]++; });
    const dates = new Set(preview.map((e) => e.date));
    return { jour: c.jour, soir1: c.soir1, soir2: c.soir2, dates: dates.size, total: preview.length };
  }, [preview]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div className="relative w-full sm:max-w-xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90dvh]"
            initial={{ y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-600 text-white"><CalendarRange className="h-4 w-4" /></div>
                <div>
                  <p className="font-bold text-slate-800">Importer un Planning Excel</p>
                  <p className="text-xs text-slate-400 mt-0.5">Format : colonne A = shift, colonnes B+ = dates avec employés</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition"><X className="h-4 w-4 text-slate-500" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Drop zone */}
              <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all ${file ? "border-green-400 bg-green-50" : "border-slate-200 bg-slate-50 hover:border-camublue-900 hover:bg-camublue-900/5"}`}>
                <Upload className={`h-8 w-8 ${file ? "text-green-600" : "text-slate-300"}`} />
                {file
                  ? <><p className="text-sm font-semibold text-green-700">{file.name}</p><p className="text-xs text-green-600">{preview.length} assignations lues</p></>
                  : <><p className="text-sm font-semibold text-slate-600">Cliquer pour choisir un fichier</p><p className="text-xs text-slate-400">.xlsx, .xls</p></>}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              </label>

              {/* Preview stats */}
              {preview.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Jours", value: stats.dates, color: "bg-blue-50 text-blue-700" },
                    { label: "08H-16H", value: stats.jour,  color: "bg-teal-50 text-teal-700"     },
                    { label: "16H-22H", value: stats.soir1, color: "bg-yellow-50 text-yellow-700"  },
                    { label: "22H-08H", value: stats.soir2, color: "bg-orange-50 text-orange-700"  },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-xl px-3 py-2 text-center ${s.color}`}>
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-xs font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview table */}
              {preview.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-camublue-900 text-white px-3 py-2 text-xs font-semibold flex justify-between">
                    <span>Aperçu (5 premiers)</span>
                    <span>{stats.total} lignes au total</span>
                  </div>
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Date", "Shift", "Employé"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-slate-500 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.slice(0, 5).map((e, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5 font-mono">{e.date}</td>
                          <td className="px-3 py-1.5"><ShiftTeamPill teamKey={e.shift_type as ShiftTeamKey} /></td>
                          <td className="px-3 py-1.5 font-medium">{e.employee_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {error && <p className="text-sm text-red-500 font-medium bg-red-50 rounded-xl px-4 py-3 border border-red-100">⚠️ {error}</p>}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button onClick={onClose} className="flex-1 py-2 rounded-2xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">Annuler</button>
              <button onClick={handleUpload} disabled={!preview.length || loading || uploaded}
                className={`flex-1 py-2 rounded-2xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${uploaded ? "bg-emerald-500 text-white" : "bg-camublue-900 hover:bg-camublue-800 text-white"}`}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Import…</>
                 : uploaded ? <><CheckCircle className="h-4 w-4" />Importé !</>
                 : <><Upload className="h-4 w-4" />Importer {stats.total} lignes</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal : Alerte ───────────────────────────────────────────────────────────
function AlertModal({ open, onClose, employee, onConfirm, sending }: {
  open: boolean; onClose: () => void; employee: FlatRecord | null; onConfirm: (m: MotifType) => void; sending: boolean;
}) {
  const [motif, setMotif] = useState<MotifType>("absent");
  useEffect(() => { if (employee) setMotif(employee.status === "absent" ? "absent" : "not_pointing"); }, [employee]);
  return (
    <AnimatePresence>
      {open && employee && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !sending && onClose()}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm overflow-hidden z-10"
            initial={{ y: 40, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.97, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div><div className="font-bold text-slate-800">Envoyer une alerte</div><div className="text-xs text-slate-400 mt-0.5 truncate max-w-[230px]">{employee.full_name}</div></div>
              <button onClick={onClose} disabled={sending} className="p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-40"><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${employee.email ? "bg-slate-50" : "bg-red-50 border border-red-100"}`}>
                <Mail className={`h-4 w-4 shrink-0 ${employee.email ? "text-slate-400" : "text-red-400"}`} />
                {employee.email
                  ? <span className="text-sm font-mono text-slate-700 truncate">{employee.email}</span>
                  : <span className="text-sm text-red-500 font-medium flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" />Aucun email</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "absent",       icon: <UserMinus className="h-4 w-4" />,   label: "Absence",       border: "border-red-400 bg-red-50 text-red-700" },
                  { id: "not_pointing", icon: <AlertTriangle className="h-4 w-4" />, label: "Non pointage", border: "border-amber-400 bg-amber-50 text-amber-700" },
                ].map((btn) => (
                  <button key={btn.id} onClick={() => setMotif(btn.id as MotifType)}
                    className={`flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${motif === btn.id ? btn.border : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <div className={`p-2 rounded-xl ${motif === btn.id ? "bg-current/10" : "bg-slate-100"}`}>{btn.icon}</div>{btn.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 pb-6 flex gap-3">
              <button onClick={onClose} disabled={sending} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">Annuler</button>
              <button onClick={() => onConfirm(motif)} disabled={sending || !employee.email}
                className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold transition flex items-center justify-center gap-2 ${!employee.email ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-camublue-900 hover:bg-camublue-800 text-white"} disabled:opacity-60`}>
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Envoyer</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── TableRow ─────────────────────────────────────────────────────────────────
function TableRow({ r, isLate, onAlert, onDetail }: {
  r: FlatRecord; isLate: boolean; onAlert: () => void; onDetail: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const deficit = r.deficit_minutes > 0;
  // Styling for replacement and rest-day rows
  const rowBg = r.is_replacement ? "bg-purple-50/40 hover:bg-purple-50/70"
    : r.not_scheduled_rest ? "bg-slate-50/60 opacity-70 hover:opacity-100"
    : isLate ? "bg-orange-50/50 hover:bg-orange-50"
    : deficit ? "bg-rose-50/30 hover:bg-rose-50/60"
    : "hover:bg-slate-50";
  return (
    <>
      <tr className={`hidden md:table-row border-b border-slate-100 transition-colors text-sm ${rowBg}`}>
        <td className="px-4 py-3"><div className="flex justify-center font-mono text-slate-500 text-xs">{r.matricule || "—"}</div></td>
        <td className="px-4 py-3">
          <div className="flex justify-center">
            <span className="font-medium text-slate-800">{r.full_name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs">
          <span className="font-semibold text-camublue-900 text-xs leading-tight tracking-wide">
            {r.project !== "—" ? r.project : "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-xs">
          <span className="font-semibold text-camublue-900 text-xs leading-tight tracking-wide">
            {r.department !== "—" ? r.department : "—"}
          </span>
        </td>
        <td className="px-4 py-3"><div className="flex justify-center"><ShiftTeamPill teamKey={r.shift_team} /></div></td>
        <td className="px-4 py-3">
          <div className="flex justify-center">
            {r.not_scheduled_rest
              ? <RestDayBadge />
              : r.is_replacement
                ? <ReplacementBadge />
                : <StatusPill status={r.status} />}
          </div>
        </td>
        <td className="px-4 py-3"><div className="flex justify-center"><LateBadge minutes={r.computed_late_minutes} /></div></td>
        <td className={`px-4 py-3 tabular-nums font-mono text-sm ${r.computed_late_minutes > 0 ? "text-red-600 font-semibold" : "text-slate-700"}`}><div className="flex justify-center">{formatTime(r.in_time)}</div></td>
        <td className={`px-4 py-3 tabular-nums font-mono text-sm ${r.overtime_minutes > 0 ? "text-emerald-600 font-semibold" : "text-slate-700"}`}><div className="flex justify-center">{formatTime(r.out_time)}</div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><WorkedTimeBadge minutes={r.worked_minutes} expectedMin={r.expected_minutes} /></div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><OvertimeBadge minutes={r.overtime_minutes} /></div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><CompensationCell c={r.compensation} /></div></td>
        <td className="px-4 py-3">
          <div className="flex gap-2 justify-center">
            <button onClick={onAlert} disabled={r.status !== "absent" || !r.email || r.not_scheduled_rest}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${r.status === "absent" && r.email && !r.not_scheduled_rest ? "bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
              <Bell className="h-3 w-3" />Alerter
            </button>
            <button onClick={onDetail} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition">Détail</button>
          </div>
        </td>
      </tr>
      <tr className={`md:hidden border-b border-slate-100 ${r.is_replacement ? "bg-purple-50/40" : r.not_scheduled_rest ? "bg-slate-50/60 opacity-70" : isLate ? "bg-orange-50/40" : deficit ? "bg-rose-50/30" : ""}`}>
        <td colSpan={12} className="px-3 py-2">
          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">{r.full_name}</p>
              <p className="text-xs text-slate-400 font-mono">{r.matricule || "—"} · {r.project !== "—" ? `${r.project} / ` : ""}{r.department}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.not_scheduled_rest
                ? <RestDayBadge />
                : r.is_replacement
                  ? <ReplacementBadge />
                  : <StatusPill status={r.status} />}
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
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3"><div className="p-2.5 rounded-xl bg-red-500 text-white"><UserMinus className="h-5 w-5" /></div></div>
      {loading
        ? <div className="space-y-2 mt-1"><div className="h-4 w-28 bg-slate-100 rounded animate-pulse" /><div className="h-4 w-20 bg-slate-100 rounded animate-pulse" /></div>
        : <div className="space-y-1.5">
            <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Effectif total</span><span className="text-base font-bold text-slate-800 tabular-nums">{total}</span></div>
            <div className="w-full h-px bg-slate-100" />
            <div className="flex items-center justify-between"><span className="text-xs font-medium text-red-600">Absents</span><span className="text-base font-bold text-red-600 tabular-nums">{absent}</span></div>
          </div>}
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "blue", delay = 0, loading = false, active = false, onClick }: {
  icon: any; label: string; value: string | number; sub?: string;
  color?: "blue" | "green" | "amber" | "red" | "violet" | "slate" | "orange";
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
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }} onClick={onClick}
      className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${onClick ? "cursor-pointer" : ""} ${active ? "border-orange-400 ring-2 ring-orange-200 shadow-md" : "border-slate-100 hover:shadow-md"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.icon}`}><Icon className="h-5 w-5" /></div>
        {active && <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full ring-1 ring-orange-200">Filtré</span>}
      </div>
      {loading
        ? <div className="space-y-2 mt-1"><div className="h-7 w-20 bg-slate-100 rounded-lg animate-pulse" /><div className="h-4 w-28 bg-slate-100 rounded animate-pulse" /></div>
        : <><div className={`text-2xl font-bold ${c.text} mb-0.5`}>{value}</div><div className="text-sm font-medium text-slate-700">{label}</div>{sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}</>}
    </motion.div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AttendanceShiftsPage() {
  const [loading,      setLoading]      = useState(false);
  const [viewMode,     setViewMode]     = useState<ViewMode>("daily");
  const [selectedTeam, setSelectedTeam] = useState<ShiftTeamKey | null>(null);
  const [shiftData,    setShiftData]    = useState<ShiftDailyStatsResponse | null>(null);
  const [weeklyData,   setWeeklyData]   = useState<WeeklyStatsResponse | null>(null);
  const [monthlyData,  setMonthlyData]  = useState<MonthlyStatsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQ,      setSearchQ]      = useState("");
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(10);
  const [emailMap,      setEmailMap]      = useState<Map<string, string>>(new Map());
  const [departmentMap, setDepartmentMap] = useState<Map<string, string>>(new Map());
  const [projectMap,    setProjectMap]    = useState<Map<string, string>>(new Map());
  const [alertModalOpen,     setAlertModalOpen]     = useState(false);
  const [detailModalOpen,    setDetailModalOpen]    = useState(false);
  const [selectedEmployee,   setSelectedEmployee]   = useState<FlatRecord | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [scheduleOpen,     setScheduleOpen]     = useState(false);
  const [planningOpen,     setPlanningOpen]     = useState(false);
  const [week,  setWeek]  = useState(isoWeekNow());
  const [month, setMonth] = useState(yyyyMmToday());
  const currentWeek = isoWeekNow();

  // ── Planning du jour ───────────────────────────────────────────────────────
  // assignments par shift pour today : { jour: Set<name|mat>, soir1: ..., soir2: ... }
  const [todayPlanning, setTodayPlanning] = useState<{
    jour: { employee_name: string; employee_matricule?: string | null }[];
    soir1: { employee_name: string; employee_matricule?: string | null }[];
    soir2: { employee_name: string; employee_matricule?: string | null }[];
    loaded: boolean;
  }>({ jour: [], soir1: [], soir2: [], loaded: false });

  // ── Horaires actifs (stockés sur le serveur + fallback localStorage) ─────
  const [activeSchedule, setActiveSchedule] = useState<ActiveSchedule | null>(() => {
    try {
      const stored = localStorage.getItem(LS_SHIFT_ACTIVE_SCHEDULE_KEY);
      if (stored) return JSON.parse(stored) as ActiveSchedule;
    } catch {}
    const d = new Date(), end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { ...DEFAULT_PRESETS[0], dateStart: todayISO(), dateEnd: end.toISOString().slice(0, 10), locked: true };
  });

  // Charger le planning du serveur au montage (remplace le localStorage si plus récent)
  useEffect(() => {
    getShiftSchedule().then((remote) => {
      if (!remote) return;
      const sched: ActiveSchedule = {
        context: remote.context, startH: remote.startH, startM: remote.startM,
        endH: remote.endH, endM: remote.endM, breakMin: remote.breakMin,
        dateStart: remote.dateStart, dateEnd: remote.dateEnd,
        locked: todayISO() >= remote.dateStart && todayISO() <= remote.dateEnd,
      };
      setActiveSchedule(sched);
      // Mettre aussi à jour les presets si ce contexte n'existe pas encore
      setPresets((prev) => {
        if (prev.some((p) => p.context === remote.context)) return prev;
        return [...prev, { context: remote.context, startH: remote.startH, startM: remote.startM, endH: remote.endH, endM: remote.endM, breakMin: remote.breakMin }];
      });
    }).catch(() => { /* silencieux – on garde le localStorage */ });

    // Charger le planning du jour
    getShiftPlanningForDate(todayISO()).then((res) => {
      setTodayPlanning({ ...res.assignments, loaded: true });
    }).catch(() => {
      setTodayPlanning((p) => ({ ...p, loaded: true }));
    });
  }, []);

  const [presets, setPresets] = useState<WorkSchedulePreset[]>(() => {
    try {
      const stored = localStorage.getItem(LS_SHIFT_PRESETS_KEY);
      if (stored) return JSON.parse(stored) as WorkSchedulePreset[];
    } catch {}
    return DEFAULT_PRESETS;
  });

  const [assignments, setAssignments] = useState<AssignmentMap>(() => {
    try {
      const stored = localStorage.getItem(LS_SHIFT_ASSIGNMENTS_KEY);
      if (stored) return JSON.parse(stored) as AssignmentMap;
    } catch {}
    return {};
  });

  // ── Persistance automatique ────────────────────────────────────────────────
  useEffect(() => {
    try {
      if (activeSchedule) localStorage.setItem(LS_SHIFT_ACTIVE_SCHEDULE_KEY, JSON.stringify(activeSchedule));
      else localStorage.removeItem(LS_SHIFT_ACTIVE_SCHEDULE_KEY);
    } catch {}
  }, [activeSchedule]);

  useEffect(() => {
    try { localStorage.setItem(LS_SHIFT_PRESETS_KEY, JSON.stringify(presets)); } catch {}
  }, [presets]);

  useEffect(() => {
    try { localStorage.setItem(LS_SHIFT_ASSIGNMENTS_KEY, JSON.stringify(assignments)); } catch {}
  }, [assignments]);

  const effectiveSchedule: WorkSchedulePreset = useMemo(() => {
    if (activeSchedule && isPeriodActive(activeSchedule)) return activeSchedule;
    return presets[0] ?? DEFAULT_PRESETS[0];
  }, [activeSchedule, presets]);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const isActiveLocked = activeSchedule ? isPeriodActive(activeSchedule) : false;

  // ── Chargement employés ────────────────────────────────────────────────────
  useEffect(() => {
    getEmployees().then((list: Employee[]) => {
      const m  = new Map<string, string>();
      const dm = new Map<string, string>();
      const pm = new Map<string, string>();
      const apiAssignments: AssignmentMap = {};
      list.forEach((e) => {
        if (e.matricule && e.email) m.set(e.matricule, e.email);
        if (e.matricule && (e.department ?? (e as any).service))
          dm.set(e.matricule, (e.department ?? (e as any).service).toUpperCase());
        const proj = (e as any).project ?? (e as any).projet ?? (e as any).project_name ?? (e as any).site ?? null;
        if (e.matricule && proj) pm.set(e.matricule, String(proj).toUpperCase());
        if (e.matricule && (e as any).shift_team) apiAssignments[e.matricule] = (e as any).shift_team;
      });
      setEmailMap(m); setDepartmentMap(dm); setProjectMap(pm);
      // localStorage prime sur l'API pour les entrées déjà stockées
      setAssignments((prev) => ({ ...apiAssignments, ...prev }));
    }).catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "daily") {
        const params: { date: string; team?: ShiftTeamKey } = { date: todayISO() };
        if (selectedTeam) params.team = selectedTeam;
        setShiftData(await getShiftDailyStats(params));
      }
      if (viewMode === "weekly")  setWeeklyData(await getWeeklyStats(week));
      if (viewMode === "monthly") setMonthlyData(await getMonthlyStats(month));
    } finally { setLoading(false); }
  }, [viewMode, selectedTeam, week, month]);

  useEffect(() => { fetchData(); }, [viewMode, selectedTeam]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQ, shiftData, weeklyData, monthlyData, pageSize]);

  // ── FlatRecords — vue journalière ─────────────────────────────────────────
  const allRecords = useMemo((): FlatRecord[] => {
    if (!shiftData || viewMode !== "daily") return [];
    const sched            = effectiveSchedule;
    const effectiveWorkMin = workDayMinutes(sched);
    const planningLoaded   = todayPlanning.loaded;

    // Helpers pour le matching planning
    const normName = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
    const isInPlanningForShift = (mat: string, name: string, shift: ShiftTeamKey | null): boolean => {
      if (!planningLoaded || !shift) return false;
      const entries = (todayPlanning as any)[shift] as { employee_name: string; employee_matricule?: string | null }[] | undefined;
      if (!entries?.length) return false;
      return entries.some((e) =>
        (e.employee_matricule && mat && e.employee_matricule === mat) ||
        normName(e.employee_name) === normName(name)
      );
    };
    const hasPlanningData = planningLoaded && (todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length > 0);

    return shiftData.records.map((r: ShiftRecord): FlatRecord => {
      const workedRaw    = computeWorkedMinutesFromTimes(r.in_time, r.out_time) || (r.worked_minutes ?? 0);
      const workedNetMin = Math.max(0, workedRaw - sched.breakMin);
      const lateMin      = computeLateMinutes(r.in_time, sched.startH, sched.startM);
      const overtimeMin  = computeOvertimeMinutes(r.out_time, sched.endH, sched.endM);

      // ✅ Résolution du shift : manuel (localStorage) > API > auto-détection par heure
      const resolvedTeam: ShiftTeamKey | null =
        assignments[r.matricule] ?? r.shift_team ?? detectShiftTeamFromTime(r.in_time);
      const resolvedLabel =
        r.shift_team_label ?? SHIFT_TEAMS.find((t) => t.key === resolvedTeam)?.label ?? "";

      // ── Planning-aware flags ──────────────────────────────────────────────
      const isScheduled = !hasPlanningData || isInPlanningForShift(r.matricule, r.full_name, resolvedTeam);
      // Remplaçant : présent (non absent) mais pas dans le planning
      const isReplacement = hasPlanningData && !isScheduled && r.status !== "absent";
      // Repos : absent mais pas planifié → on ne compte pas comme une vraie absence
      const notScheduledRest = hasPlanningData && !isScheduled && r.status === "absent";

      return {
        employee_id: r.employee_id, matricule: r.matricule, full_name: r.full_name,
        department: (r.department ?? "—").toUpperCase(),
        project: (() => {
          const p = (r as any).project ?? (r as any).projet ?? (r as any).project_name ?? (r as any).site ?? null;
          return p ? String(p).toUpperCase() : (projectMap.get(r.matricule) ?? "—");
        })(),
        status: r.status, is_late_api: r.is_late, late_label_api: r.late_label,
        computed_late_minutes: lateMin, overtime_minutes: overtimeMin,
        compensation: computeCompensation(lateMin, overtimeMin),
        deficit_minutes: computeDeficitMinutes(workedNetMin, effectiveWorkMin),
        in_time: r.in_time, out_time: r.out_time, worked_minutes: workedNetMin,
        expected_minutes: effectiveWorkMin, email: emailMap.get(r.matricule) ?? null,
        shift_team: resolvedTeam,
        shift_team_label: resolvedLabel,
        is_scheduled:       isScheduled,
        is_replacement:     isReplacement,
        not_scheduled_rest: notScheduledRest,
      };
    });
  }, [shiftData, emailMap, effectiveSchedule, viewMode, projectMap, assignments, todayPlanning]);

  // ── SummaryRecords — hebdo/mensuel ────────────────────────────────────────
  const summaryRecords = useMemo((): SummaryRecord[] => {
    const resolveDept = (r: any) =>
      (r.department ?? r.service ?? departmentMap.get(r.matricule ?? "") ?? "—").toUpperCase();
    const resolveProject = (r: any) => {
      const p = (r as any).project ?? (r as any).projet ?? (r as any).project_name ?? (r as any).site ?? null;
      return p ? String(p).toUpperCase() : (projectMap.get(r.matricule ?? "") ?? "—");
    };
    const mapEmp = (r: any): SummaryRecord => ({
      employee_id:    r.employee_id,
      matricule:      r.matricule ?? "",
      full_name:      r.full_name ?? "",
      department:     resolveDept(r),
      project:        resolveProject(r),
      // ✅ Résolution du shift en hebdo/mensuel : même priorité
      shift_team:     assignments[r.matricule ?? ""] ?? r.shift_team ?? null,
      nb_jours:       r.present_days ?? r.worked_days ?? 0,
      worked_minutes: r.total_worked_minutes ?? r.worked_minutes ?? 0,
    });
    if (viewMode === "weekly"  && weeklyData)  return weeklyData.by_employee.map(mapEmp);
    if (viewMode === "monthly" && monthlyData) return monthlyData.by_employee.map(mapEmp);
    return [];
  }, [viewMode, weeklyData, monthlyData, assignments, departmentMap, projectMap]);

  // ── filteredSummaryRecords ────────────────────────────────────────────────
  const filteredSummaryRecords = useMemo((): SummaryRecord[] => {
    let rows = summaryRecords;
    if (selectedTeam) rows = rows.filter((r) => r.shift_team === selectedTeam);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      rows = rows.filter((r) =>
        r.full_name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) || r.project.toLowerCase().includes(q) ||
        (SHIFT_TEAMS.find((t) => t.key === r.shift_team)?.label ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [summaryRecords, selectedTeam, searchQ]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (viewMode === "daily" && shiftData) return {
      total:   allRecords.length,
      // N'inclut pas les employés non planifiés (jours de repos) dans les absents
      absent:  allRecords.filter((r) => r.status === "absent" && !r.not_scheduled_rest).length,
      late:    allRecords.filter((r) => r.computed_late_minutes > 0).length,
      anomaly: allRecords.filter((r) => r.status === "anomaly").length,
    };
    const teamRows = selectedTeam ? summaryRecords.filter((r) => r.shift_team === selectedTeam) : summaryRecords;
    return { total: teamRows.length, absent: 0, late: 0, anomaly: 0 };
  }, [viewMode, shiftData, allRecords, summaryRecords, selectedTeam]);

  const isLateRecord = (r: FlatRecord) => r.computed_late_minutes > 0;

  const filtered = useMemo(() => allRecords.filter((r) => {
    if (statusFilter === "late")   { if (!isLateRecord(r)) return false; }
    else if (statusFilter === "deficit") { if (r.deficit_minutes <= 0) return false; }
    else if (statusFilter !== "all")     { if (r.status !== statusFilter) return false; }
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return r.full_name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q) ||
           r.department.toLowerCase().includes(q) || (r.shift_team_label ?? "").toLowerCase().includes(q) ||
           r.project.toLowerCase().includes(q);
  }), [allRecords, statusFilter, searchQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData   = filtered.slice((page - 1) * pageSize, page * pageSize);

  const filterCount = (key: StatusFilter) => {
    if (key === "all")    return allRecords.length;
    if (key === "late")   return allRecords.filter(isLateRecord).length;
    if (key === "deficit")return allRecords.filter((r) => r.deficit_minutes > 0).length;
    return allRecords.filter((r) => r.status === key).length;
  };

  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
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
      exportXLSX(`shift_${selectedTeam ?? "all"}_journalier`, filtered.map((r) => ({
        Matricule: r.matricule, Nom: r.full_name,
        Projet: r.project !== "—" ? r.project : "—",
        Département: r.department !== "—" ? r.department : "—",
        Équipe: r.shift_team_label || SHIFT_TEAMS.find((t) => t.key === r.shift_team)?.short || r.shift_team || "—",
        Statut: r.status,
        Retard: r.computed_late_minutes > 0 ? `RETARD · ${formatMinutes(r.computed_late_minutes)}` : "Non",
        Entrée: formatTime(r.in_time), Sortie: formatTime(r.out_time),
        "Heure travaillée": r.worked_minutes > 0 ? formatMinutes(r.worked_minutes) : "—",
        "HS": r.overtime_minutes > 0 ? formatMinutes(r.overtime_minutes) : "—",
        Compensation: r.compensation.is_compensated ? "Oui" : r.compensation.late_min > 0 ? "Non" : "—",
        Email: r.email ?? "Manquant",
      })));
    } else {
      exportXLSX(`shift_${viewMode === "weekly" ? "hebdo" : "mensuel"}`, filteredSummaryRecords.map((r) => ({
        Matricule: r.matricule, Nom: r.full_name,
        Projet: r.project !== "—" ? r.project : "—",
        Département: r.department !== "—" ? r.department : "—",
        Équipe: SHIFT_TEAMS.find((t) => t.key === r.shift_team)?.short || r.shift_team || "—",
        "Nb jours": r.nb_jours,
        "Heures travaillées": formatMinutes(r.worked_minutes) || "0h",
        "% quota (40h)": `${Math.min(100, Math.round((r.worked_minutes / (viewMode === "weekly" ? MAX_WEEKLY_MIN : Math.round(MAX_WEEKLY_MIN * 4.33))) * 100))}%`,
      })));
    }
  };

  const activeTeamCfg  = SHIFT_TEAMS.find((t) => t.key === selectedTeam);
  const tableHeaders   = ["Matricule", "Nom", "Projet/Département", "Service", "Équipe", "Statut", "Retard", "Entrée", "Sortie", "Heure travaillée", "HS (>départ)", "Compensation", "Actions"];

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6">

        {/* ── En-tête ── */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-start shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-camublue-900">Pointages Shifts</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${isActiveLocked ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-slate-50 text-slate-500 ring-slate-200"}`}>
                {isActiveLocked ? <Lock className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {effectiveSchedule.context} · {pad2(effectiveSchedule.startH)}h{pad2(effectiveSchedule.startM)} – {pad2(effectiveSchedule.endH)}h{pad2(effectiveSchedule.endM)}
                {effectiveSchedule.breakMin > 0 && ` · Pause ${effectiveSchedule.breakMin}min`}
              </span>
              {activeTeamCfg && <span className="text-indigo-500 font-semibold text-xs">{activeTeamCfg.label} · {activeTeamCfg.horaire}</span>}
              {/* Planning du jour */}
              {todayPlanning.loaded && (todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full ring-1 ring-green-200">
                  <CalendarRange className="h-3 w-3" />
                  Planning actif · {todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length} assignés
                </span>
              )}
              {/* ✅ Légende des plages de détection automatique */}
              <span className="inline-flex items-center gap-2 text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full ring-1 ring-slate-200">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />07h–16h</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />17h–21h</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-600" />22h–06h</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setPage(1); }} placeholder="Nom, matricule, équipe…"
                className="pl-9 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-camublue-900 text-sm px-3 py-2 w-full sm:w-48 md:w-56 focus:outline-none" />
            </div>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none flex-1 sm:flex-none">
              <option value="daily">Journalier</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuel</option>
            </select>
            <button onClick={() => setScheduleOpen(true)}
              className={`border px-3 py-2 rounded-lg text-sm transition flex items-center gap-1.5 font-medium ${isActiveLocked ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100" : "bg-white border-slate-300 text-camublue-900 hover:bg-slate-50"}`}>
              <Settings className="h-4 w-4" /><span className="hidden sm:inline">Heures de travail</span>{isActiveLocked && <Lock className="h-3 w-3" />}
            </button>
            <button onClick={() => setPlanningOpen(true)}
              className={`border px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${todayPlanning.loaded && (todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length) > 0 ? "bg-green-50 border-green-400 text-green-700 hover:bg-green-100" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
              <CalendarRange className="h-4 w-4" /><span className="hidden sm:inline">Planning</span>
              {todayPlanning.loaded && (todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length) > 0 && (
                <span className="text-[10px] font-bold bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full hidden sm:inline">Actif</span>
              )}
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

        {/* ── Sélecteur équipe ── */}
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          <button onClick={() => setSelectedTeam(null)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${selectedTeam === null ? "border-camublue-900 bg-camublue-900/10 text-camublue-900" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
            <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" /><span className="truncate text-xs sm:text-sm">Toutes</span>
          </button>
          {SHIFT_TEAMS.map((team) => {
            const isActive  = selectedTeam === team.key;
            const kpiTeam   = shiftData?.kpis.by_team?.[team.key];
            return (
              <button key={team.key} onClick={() => setSelectedTeam(isActive ? null : team.key)}
                className={`flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${isActive ? `${team.activeBg} ${team.activeText} ${team.activeBorder}` : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                <div className="flex flex-col items-start min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${team.dot}`} />
                    <span className="truncate text-xs sm:text-sm">{team.short}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 pl-3.5 leading-tight">{team.horaire}</span>
                </div>
                {kpiTeam && <span className={`text-xs font-bold tabular-nums shrink-0 ${isActive ? team.activeText : "text-slate-500"}`}>{kpiTeam.present}/{kpiTeam.total}</span>}
              </button>
            );
          })}
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <AbsentsCard total={kpis.total} absent={kpis.absent} loading={loading} delay={0.05} />
          <StatCard icon={Clock} label="Retards" value={kpis.late} color="orange" delay={0.1} loading={loading}
            active={statusFilter === "late"} sub="Cliquer pour filtrer"
            onClick={() => setStatusFilter((f) => f === "late" ? "all" : "late")} />
          <StatCard icon={AlertTriangle} label="Anomalies" value={kpis.anomaly} color="violet" delay={0.15} loading={loading} />
        </div>

        {/* ── Contenu principal ── */}
        {viewMode === "daily" ? (
          <>
            {/* Filtres rapides */}
            <div className="shrink-0 w-full overflow-x-auto">
              <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 border border-camublue-900/20 shadow-sm min-w-max">
                {QUICK_FILTERS.map((f) => {
                  const isActive = statusFilter === f.key;
                  return (
                    <button key={f.key} onClick={() => { setStatusFilter(f.key); setPage(1); }}
                      className={`relative inline-flex flex-col items-center justify-center gap-0.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 ${isActive ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/60"}`}>
                      <span className="inline-flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? f.activeDot : f.dotColor}`} />
                        <span className="hidden sm:inline">{f.label}</span>
                        <span className="sm:hidden">{f.label.split(" ")[0]}</span>
                      </span>
                      <span className={`tabular-nums font-bold leading-none ${isActive ? "text-camublue-900" : "text-slate-400/70"}`}>{filterCount(f.key)}</span>
                    </button>
                  );
                })}
                {statusFilter !== "all" && (
                  <><div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />
                  <button onClick={() => setStatusFilter("all")} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all shrink-0"><X className="h-3 w-3" /></button></>
                )}
              </div>
            </div>

            {/* Tableau journalier */}
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm min-h-0">
                <table className="min-w-full bg-white">
                  <thead className={`sticky top-0 z-10 text-white hidden md:table-header-group ${activeTeamCfg?.headerBg ?? "bg-camublue-900"}`}>
                    <tr>{tableHeaders.map((h) => <th key={h} className="px-4 py-3 text-center border-b border-white/20 text-sm font-semibold whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <thead className={`sticky top-0 z-10 text-white md:hidden ${activeTeamCfg?.headerBg ?? "bg-camublue-900"}`}>
                    <tr><th className="px-3 py-3 text-left text-sm font-semibold" colSpan={12}>{activeTeamCfg ? activeTeamCfg.short : "Toutes les équipes"} — {filtered.length} employé{filtered.length > 1 ? "s" : ""}</th></tr>
                  </thead>
                  <tbody>
                    {loading
                      ? [...Array(5)].map((_, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            {[...Array(tableHeaders.length)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                          </tr>
                        ))
                      : pageData.length
                        ? pageData.map((r) => (
                            <TableRow key={r.employee_id} r={r} isLate={isLateRecord(r)}
                              onAlert={() => { setSelectedEmployee(r); setAlertModalOpen(true); }}
                              onDetail={() => { setSelectedEmployeeId(r.employee_id); setDetailModalOpen(true); }} />
                          ))
                        : <tr><td colSpan={tableHeaders.length} className="text-center py-12 text-slate-400 text-sm">
                            {statusFilter === "late" ? "Aucun retard." : statusFilter === "deficit" ? "Aucune heure manquante." : "Aucun enregistrement trouvé."}
                          </td></tr>
                    }
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filtered.length > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm text-slate-500">
                      {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / <strong className="text-slate-700">{filtered.length}</strong>
                    </span>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                      <span className="text-xs text-slate-400">Lignes :</span>
                      <div className="flex items-center gap-0.5">
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <button key={size} onClick={() => { setPageSize(size); setPage(1); }}
                            className={`min-w-[28px] h-6 rounded text-xs font-semibold transition-all ${pageSize === size ? "bg-camublue-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{size}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><FaAngleDoubleLeft size={12} /></button>
                    <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-4 w-4" /></button>
                    <div className="flex items-center gap-0.5 mx-1">
                      {getPageNumbers().map((p, i) =>
                        p === "..."
                          ? <span key={`e-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                          : <button key={p} onClick={() => setPage(p as number)}
                              className={`min-w-[28px] sm:min-w-[32px] h-7 sm:h-8 rounded-md text-xs sm:text-sm font-medium transition-colors ${page === p ? "bg-camublue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>{p}</button>
                      )}
                    </div>
                    <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-4 w-4" /></button>
                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><FaAngleDoubleRight size={12} /></button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <SummaryTable rows={filteredSummaryRecords} mode={viewMode as "weekly" | "monthly"} isLoading={loading} />
        )}

        {/* ── Modals ── */}
        <WorkScheduleModal
          open={scheduleOpen} onClose={() => setScheduleOpen(false)}
          active={activeSchedule} presets={presets}
          onSave={(s) => {
            setActiveSchedule(s);
            // Persiste sur le serveur (partagé entre tous les RH)
            saveShiftSchedule({
              context: s.context, startH: s.startH, startM: s.startM,
              endH: s.endH, endM: s.endM, breakMin: s.breakMin,
              dateStart: s.dateStart, dateEnd: s.dateEnd,
            }).catch(console.error);
          }}
          onPresetsChange={(p) => setPresets(p)} />
        <DetailModal
          open={detailModalOpen} onClose={() => setDetailModalOpen(false)}
          employeeId={selectedEmployeeId} initialWeek={currentWeek} />
        <AlertModal
          open={alertModalOpen} onClose={() => setAlertModalOpen(false)}
          employee={selectedEmployee} onConfirm={handleSendAlert} sending={sendingAlert} />
        <PlanningUploadModal
          open={planningOpen} onClose={() => setPlanningOpen(false)}
          onSuccess={(count) => {
            // Recharger le planning du jour après l'upload
            getShiftPlanningForDate(todayISO()).then((res) => {
              setTodayPlanning({ ...res.assignments, loaded: true });
            }).catch(console.error);
          }} />
      </motion.div>
    </AppLayout>
  );
}
