import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { useAuth } from "@/contexts/useAuth";
import {
  Clock, AlertTriangle, UserMinus, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2, ChevronDown,
  Check, Settings, CheckCircle, Lock, CalendarDays,
  TrendingUp, Pencil, Plus, Trash2, Upload, CalendarRange, ArrowLeftRight, ArrowRight,
  Table2, Filter,
} from "lucide-react";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import {
  getShiftDailyStats, getShiftPeriodStats, getEmployeePeriodDetail, getWeeklyStats, getMonthlyStats,
  getShiftSchedule, saveShiftSchedule, uploadShiftPlanning,
  getShiftPlanning, deleteSinglePlanningEntry, addSinglePlanningEntry,
  updateAttendanceRecord, sendAttendanceAlert,
} from "@/services/attendanceService";
import type { PlanningEntry } from "@/services/attendanceService";
import { parseNOCPlanningExcel, cellToDateStr, extractMonthYearFromSheetName } from "@/utils/planningParser";
import type { ParsedSheet } from "@/utils/planningParser";
import { getEmployees } from "@/services/employeeService";
import type {
  ShiftDailyStatsResponse, ShiftPeriodStatsResponse, ShiftTeamKey, ShiftRecord,
  EmployeePeriodDetailResponse, DayDetail,
  WeeklyStatsResponse, MonthlyStatsResponse, WeeklyDayEntry,
} from "@/types/attendance";
import type { Employee } from "@/types/employee";
import * as XLSX from "xlsx";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

type StatusFilter = "all" | "ok" | "absent" | "incomplete" | "anomaly" | "late" | "deficit" | "pending" | "replacement";
type MotifType = "absent" | "not_pointing";
type AssignmentMap = Record<string, ShiftTeamKey | null>;
type ViewMode = "daily" | "weekly" | "monthly" | "period";
type CycleType = "M" | "S" | "N" | "R";

interface CompensationResult {
  late_min: number; overtime_min: number; compensated_min: number;
  remaining_min: number; is_compensated: boolean; has_overtime: boolean;
}

interface FlatRecord {
  employee_id: number; matricule: string; full_name: string; department: string; project: string;
  status: "ok" | "absent" | "incomplete" | "anomaly" | "pending" | "not_working";
  is_late_api: boolean; late_label_api: string | null;
  computed_late_minutes: number; overtime_minutes: number;
  compensation: CompensationResult; deficit_minutes: number;
  in_time: string | null; out_time: string | null;
  worked_minutes: number; expected_minutes: number; email: string | null; telephone: string | null;
  shift_team: ShiftTeamKey | null; shift_team_label: string;
  is_scheduled: boolean;
  is_replacement: boolean;
  not_scheduled_rest: boolean;
  is_shift_pending: boolean;
  team_id: string;
  replaced_by: string | null;
  replacement_in_time: string | null;
  replacement_out_time: string | null;
  replacement_worked_minutes: number | null;
  replaces_employee: string | null;
}

interface SummaryRecord {
  employee_id: number; matricule: string; full_name: string; department: string; project: string;
  shift_team: ShiftTeamKey | null;
  nb_jours: number; worked_minutes: number;
  absent_days: number; late_days: number; anomaly_days: number;
  delta_minutes: number; expected_minutes: number;
}

interface Pointage {
  day: string; date: string;
  in_time: string | null; out_time: string | null;
  status: "ok" | "absent" | "incomplete" | "anomaly" | "not_working";
  is_planned?: boolean;
}

interface WorkSchedulePreset {
  context: string;
  startH: number; startM: number;
  endH: number; endM: number;
  breakMin: number;
}

interface ActiveSchedule extends WorkSchedulePreset {
  dateStart: string;
  dateEnd: string;
  locked: boolean;
}

interface ParsedSheet {
  name: string;
  count: number;
  dateMin: string;
  dateMax: string;
  teams: number;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const MAX_WORKDAY_MIN = 8 * 60;
const MAX_WEEKLY_MIN = 40 * 60;
const PAGE_SIZE_OPTIONS = [10, 20, 30];

const LS_SHIFT_ACTIVE_SCHEDULE_KEY = "camu_shift_active_schedule";
const LS_SHIFT_ASSIGNMENTS_KEY = "camu_shift_assignments";
const LS_SHIFT_PRESETS_KEY = "camu_shift_work_schedule_presets";

const DEFAULT_PRESETS: WorkSchedulePreset[] = [
  { context: "08H-16H", startH: 8, startM: 0, endH: 16, endM: 0, breakMin: 60 },
  { context: "16H-22H", startH: 16, startM: 0, endH: 22, endM: 0, breakMin: 30 },
  { context: "22H-08H", startH: 22, startM: 0, endH: 8, endM: 0, breakMin: 60 },
];

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
  ok: { label: "OK", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  absent: { label: "Absent", dot: "bg-red-500", badge: "bg-red-50 text-red-700 ring-red-200" },
  incomplete: { label: "Incomplet", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  anomaly: { label: "Anomalie", dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 ring-violet-200" },
  not_working: { label: "Repos", dot: "bg-slate-400", badge: "bg-slate-50 text-slate-500 ring-slate-200" },
  pending: { label: "En attente", dot: "bg-blue-400", badge: "bg-blue-50 text-blue-600 ring-blue-200" },
};

const QUICK_FILTERS = [
  { key: "all"        as StatusFilter, label: "Tous",         dotColor: "bg-slate-400",  activeText: "text-slate-800",   activeBg: "bg-slate-900",  activeDot: "bg-white"        },
  { key: "ok"         as StatusFilter, label: "OK",           dotColor: "bg-emerald-400",activeText: "text-emerald-700", activeBg: "bg-emerald-50", activeDot: "bg-emerald-500"  },
  { key: "absent"     as StatusFilter, label: "Absents",      dotColor: "bg-red-400",    activeText: "text-red-700",     activeBg: "bg-red-50",     activeDot: "bg-red-500"      },
  { key: "late"       as StatusFilter, label: "Retards",      dotColor: "bg-orange-400", activeText: "text-orange-700",  activeBg: "bg-orange-50",  activeDot: "bg-orange-500"   },
  { key: "incomplete" as StatusFilter, label: "Incomplets",   dotColor: "bg-amber-400",  activeText: "text-amber-800",   activeBg: "bg-amber-50",   activeDot: "bg-amber-500"    },
  { key: "anomaly"    as StatusFilter, label: "Anomalies",    dotColor: "bg-violet-400", activeText: "text-violet-700",  activeBg: "bg-violet-50",  activeDot: "bg-violet-500"   },
  { key: "deficit"    as StatusFilter, label: "Heures moins", dotColor: "bg-rose-400",   activeText: "text-rose-700",    activeBg: "bg-rose-50",    activeDot: "bg-rose-500"     },
  { key: "pending"     as StatusFilter, label: "En attente",   dotColor: "bg-blue-400",   activeText: "text-blue-700",    activeBg: "bg-blue-50",     activeDot: "bg-blue-500"     },
  { key: "replacement" as StatusFilter, label: "Remplaçants",  dotColor: "bg-purple-400", activeText: "text-purple-700",  activeBg: "bg-purple-50",  activeDot: "bg-purple-500"   },
];

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const SHIFT_KEYS: { key: ShiftTeamKey; label: string; bg: string; text: string; border: string; addBtn: string }[] = [
  { key: "jour", label: "08H-16H", bg: "bg-teal-50", text: "text-teal-800", border: "border-teal-200", addBtn: "bg-teal-500 hover:bg-teal-600 text-white" },
  { key: "soir1", label: "16H-22H", bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200", addBtn: "bg-amber-400 hover:bg-amber-500 text-amber-950" },
  { key: "soir2", label: "22H-08H", bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-200", addBtn: "bg-orange-500 hover:bg-orange-600 text-white" },
];

const TEAM_PALETTE = [
  { bg: "bg-yellow-100", text: "text-yellow-900", border: "border-yellow-400", header: "bg-yellow-400", dot: "bg-yellow-500", chipBg: "bg-yellow-200", label: "Équipe 1" },
  { bg: "bg-green-100", text: "text-green-900", border: "border-green-400", header: "bg-green-500", dot: "bg-green-600", chipBg: "bg-green-200", label: "Équipe 2" },
  { bg: "bg-sky-100", text: "text-sky-900", border: "border-sky-400", header: "bg-sky-500", dot: "bg-sky-600", chipBg: "bg-sky-200", label: "Équipe 3" },
  { bg: "bg-pink-100", text: "text-pink-900", border: "border-pink-400", header: "bg-pink-500", dot: "bg-pink-600", chipBg: "bg-pink-200", label: "Équipe 4" },
  { bg: "bg-orange-100", text: "text-orange-900", border: "border-orange-400", header: "bg-orange-500", dot: "bg-orange-600", chipBg: "bg-orange-200", label: "Équipe 5" },
  { bg: "bg-purple-100", text: "text-purple-900", border: "border-purple-400", header: "bg-purple-500", dot: "bg-purple-600", chipBg: "bg-purple-200", label: "Équipe 6" },
  { bg: "bg-teal-100", text: "text-teal-900", border: "border-teal-400", header: "bg-teal-500", dot: "bg-teal-600", chipBg: "bg-teal-200", label: "Équipe 7" },
  { bg: "bg-red-100", text: "text-red-900", border: "border-red-400", header: "bg-red-500", dot: "bg-red-600", chipBg: "bg-red-200", label: "Équipe 8" },
  { bg: "bg-indigo-100", text: "text-indigo-900", border: "border-indigo-400", header: "bg-indigo-500", dot: "bg-indigo-600", chipBg: "bg-indigo-200", label: "Équipe 9" },
  { bg: "bg-lime-100", text: "text-lime-900", border: "border-lime-400", header: "bg-lime-500", dot: "bg-lime-600", chipBg: "bg-lime-200", label: "Équipe 10" },
  { bg: "bg-amber-100", text: "text-amber-900", border: "border-amber-400", header: "bg-amber-500", dot: "bg-amber-600", chipBg: "bg-amber-200", label: "Équipe 11" },
  { bg: "bg-cyan-100", text: "text-cyan-900", border: "border-cyan-400", header: "bg-cyan-500", dot: "bg-cyan-600", chipBg: "bg-cyan-200", label: "Équipe 12" },
];

const cycleConfig = {
  M: { shift: "jour", label: "M", style: "bg-teal-200 text-teal-800 border-teal-300", full: "Matin 08H-16H" },
  S: { shift: "soir1", label: "S", style: "bg-amber-200 text-amber-800 border-amber-300", full: "Soir 16H-22H" },
  N: { shift: "soir2", label: "N", style: "bg-indigo-200 text-indigo-800 border-indigo-300", full: "Nuit 22H-08H" },
  R: { shift: null, label: "R", style: "bg-slate-200 text-slate-600 border-slate-300", full: "Repos" },
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yyyyMmToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoWeekNow(): string {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const w = Math.ceil((((date.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
}

function weekDaysFromISO(isoWeek: string): string[] {
  const [yearStr, weekStr] = isoWeek.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek = new Date(jan4);
  startOfWeek.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setUTCDate(startOfWeek.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function daysInMonth(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  const days: string[] = [];
  const last = new Date(y, m, 0).getDate();
  for (let d = 1; d <= last; d++)
    days.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return days;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

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

function workDayMinutes(s: WorkSchedulePreset): number {
  return Math.max(0, (s.endH * 60 + s.endM) - (s.startH * 60 + s.startM) - s.breakMin);
}

function isPeriodActive(s: ActiveSchedule): boolean {
  const today = todayISO();
  return today >= s.dateStart && today <= s.dateEnd;
}

function computeLateMinutes(iso: string | null, thH: number, thM: number): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const t = d.getHours() * 60 + d.getMinutes(), th = thH * 60 + thM;
  return t > th ? t - th : 0;
}

function computeOvertimeMinutes(iso: string | null, thH: number, thM: number): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
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

function detectShiftTeamFromTime(inIso: string | null): ShiftTeamKey | null {
  if (!inIso) return null;
  const d = new Date(inIso);
  if (isNaN(d.getTime())) return null;
  const h = d.getHours();
  if (h >= 5 && h < 14) return "jour";
  if (h >= 14 && h < 20) return "soir1";
  return "soir2";
}


function getTeamPalette(teamId: string) {
  const idx = parseInt(teamId.replace(/\D/g, "") || "0", 10) - 1;
  return TEAM_PALETTE[Math.max(0, idx) % TEAM_PALETTE.length];
}

function getCycleForDate(baseDate: string, cycleStartDate: string, date: string): CycleType {
  const start = new Date(cycleStartDate + "T00:00:00");
  const target = new Date(date + "T00:00:00");
  const daysSinceStart = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const cyclePosition = ((daysSinceStart % 8) + 8) % 8;
  if (cyclePosition < 2) return "M";
  if (cyclePosition < 4) return "S";
  if (cyclePosition < 6) return "N";
  return "R";
}

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

// ─── Colonnes export personnalisé ─────────────────────────────────────────────
const SHIFT_DAILY_COLS  = ["Matricule","Nom","Projet","Département","Équipe","Statut","Retard","Entrée","Sortie","Heure travaillée","HS","Compensation","Email"] as const;
const SHIFT_SUMM_COLS   = ["Matricule","Nom","Projet","Département","Équipe","Jours présents","Jours absents","Jours retard","Jours anomalie","Heures travaillées","Heures attendues","Delta","% quota"] as const;
const SHIFT_PERIOD_COLS = ["Date","Jour","Matricule","Nom","Équipe","Statut","Retard","Entrée","Sortie","Heures travaillées","Remplacé par","Remplaçant de"] as const;
type ShiftDailyCol  = typeof SHIFT_DAILY_COLS[number];
type ShiftSummCol   = typeof SHIFT_SUMM_COLS[number];
type ShiftPeriodCol = typeof SHIFT_PERIOD_COLS[number];



// ============================================================================
// COMPOSANTS BADGES
// ============================================================================

function StatusPill({ status }: { status: keyof typeof STATUS_CFG | string }) {
  const c = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.anomaly;
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
      Pas de service
    </span>
  );
}