import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  Clock, AlertTriangle, UserMinus, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2, ChevronDown,
  Check, Settings, CheckCircle, Lock, CalendarDays,
  TrendingUp, Pencil, Plus, Trash2, Upload, CalendarRange, ArrowLeftRight,
  Table2,
} from "lucide-react";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import {
  getShiftDailyStats, getEmployeePeriodDetail, getWeeklyStats, getMonthlyStats,
  getShiftSchedule, saveShiftSchedule, uploadShiftPlanning, getShiftPlanningForDate,
  getShiftPlanning, deleteSinglePlanningEntry, addSinglePlanningEntry,
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

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

type StatusFilter = "all" | "ok" | "absent" | "incomplete" | "anomaly" | "late" | "deficit" | "pending";
type MotifType = "absent" | "not_pointing";
type AssignmentMap = Record<string, ShiftTeamKey | null>;
type ViewMode = "daily" | "weekly" | "monthly";
type CycleType = "M" | "S" | "N" | "R"; // Matin, Soir, Nuit, Repos

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
  worked_minutes: number; expected_minutes: number; email: string | null;
  shift_team: ShiftTeamKey | null; shift_team_label: string;
  // Planning
  is_scheduled: boolean;         // true if employee is in today's planning
  is_replacement: boolean;       // true if present but NOT in planning (replacement)
  not_scheduled_rest: boolean;   // true if not scheduled (rest day)
  is_shift_pending: boolean;     // true if scheduled but shift hasn't started yet
  team_id: string;               // identifiant d'équipe (ex: "equipe-1")
  replaced_by: string | null;    // nom du remplaçant
}

interface SummaryRecord {
  employee_id: number; matricule: string; full_name: string; department: string; project: string;
  shift_team: ShiftTeamKey | null;
  nb_jours: number; worked_minutes: number;
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
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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
  { key: "all" as StatusFilter, label: "Tous", dotColor: "bg-slate-400", activeDot: "bg-white" },
  { key: "ok" as StatusFilter, label: "OK", dotColor: "bg-emerald-400", activeDot: "bg-emerald-500" },
  { key: "absent" as StatusFilter, label: "Absents", dotColor: "bg-red-400", activeDot: "bg-red-500" },
  { key: "late" as StatusFilter, label: "Retards", dotColor: "bg-orange-400", activeDot: "bg-orange-500" },
  { key: "incomplete" as StatusFilter, label: "Incomplets", dotColor: "bg-amber-400", activeDot: "bg-amber-500" },
  { key: "anomaly" as StatusFilter, label: "Anomalies", dotColor: "bg-violet-400", activeDot: "bg-violet-500" },
  { key: "deficit" as StatusFilter, label: "Heures moins", dotColor: "bg-rose-400", activeDot: "bg-rose-500" },
  { key: "pending" as StatusFilter, label: "En attente", dotColor: "bg-blue-400", activeDot: "bg-blue-500" },
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

function getShiftActiveStatus(shiftKey: ShiftTeamKey): "active" | "upcoming" | "ended" {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (shiftKey === "jour") {
    if (nowMin >= 5 * 60 && nowMin < 16 * 60) return "active";
    if (nowMin < 5 * 60) return "upcoming";
    return "ended";
  }
  if (shiftKey === "soir1") {
    if (nowMin >= 14 * 60 && nowMin < 22 * 60) return "active";
    if (nowMin < 14 * 60) return "upcoming";
    return "ended";
  }
  if (nowMin >= 20 * 60 || nowMin < 8 * 60) return "active";
  return "upcoming";
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

function cycleTypeToShift(type: CycleType): ShiftTeamKey | null {
  switch (type) {
    case "M": return "jour";
    case "S": return "soir1";
    case "N": return "soir2";
    default: return null;
  }
}

function detectTeamCycles(planningEntries: PlanningEntry[]): Map<string, { startDate: string; employees: string[] }> {
  const teamMap = new Map<string, { startDate: string; employees: Set<string> }>();

  for (const entry of planningEntries) {
    if (!entry.team_id || entry.team_id === "_no_team") continue;
    if (!teamMap.has(entry.team_id)) {
      teamMap.set(entry.team_id, { startDate: entry.date, employees: new Set() });
    }
    teamMap.get(entry.team_id)!.employees.add(entry.employee_name);
  }

  const result = new Map<string, { startDate: string; employees: string[] }>();
  for (const [teamId, data] of teamMap) {
    result.set(teamId, {
      startDate: data.startDate,
      employees: Array.from(data.employees)
    });
  }
  return result;
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

async function sendAlertEmail(emp: FlatRecord, motif: MotifType): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 500));
  return { success: !!emp.email };
}

function cellToDateStr(cell: unknown): string {
  if (cell instanceof Date) {
    return `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(cell.getDate()).padStart(2, "0")}`;
  }
  if (typeof cell === "number" && cell > 40000) {
    const d = new Date(Math.round((cell - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof cell === "string" && cell.trim()) {
    const s = cell.trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return "";
}

function detectShiftLabel(label: string): ShiftTeamKey | null {
  const s = label.toUpperCase().replace(/\s/g, "");
  if (s.includes("08") && s.includes("16")) return "jour";
  if (s.includes("16") && s.includes("22")) return "soir1";
  if (s.includes("22") && s.includes("08")) return "soir2";
  return null;
}

function getCellBgHex(ws: XLSX.WorkSheet, r: number, c: number): string | null {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr] as any;
  if (!cell?.s) return null;
  const tryColor = (co: any): string | null => {
    if (!co) return null;
    if (co.rgb && typeof co.rgb === "string" && co.rgb.length >= 6) {
      const rgb = co.rgb.toUpperCase().slice(-6);
      if (rgb === "FFFFFF" || rgb === "000000" || rgb === "000001") return null;
      return rgb;
    }
    return null;
  };
  return tryColor(cell.s.fgColor) ?? tryColor(cell.s.bgColor) ?? null;
}

// Noms de mois français → numéro (1-12)
const FRENCH_MONTHS_MAP: Record<string, number> = {
  jan: 1, janv: 1, janvier: 1,
  fev: 2, févr: 2, fevr: 2, février: 2, fevrier: 2,
  mar: 3, mars: 3,
  avr: 4, avril: 4,
  mai: 5,
  juin: 6,
  juil: 7, juillet: 7,
  aou: 8, aoû: 8, aout: 8, août: 8,
  sep: 9, sept: 9, septembre: 9,
  oct: 10, octobre: 10,
  nov: 11, novembre: 11,
  dec: 12, déc: 12, decembre: 12, décembre: 12,
};

function extractMonthYearFromSheetName(name: string): { month: number; year: number } {
  let month = 0, year = 0;
  const lower = name.toLowerCase().replace(/[_\-]/g, " ");
  for (const [k, v] of Object.entries(FRENCH_MONTHS_MAP)) {
    if (new RegExp(`\\b${k}\\b`).test(lower)) { month = v; break; }
  }
  const ym = name.match(/\b(20\d{2})\b/);
  if (ym) year = parseInt(ym[1]);
  // Format "MM/YYYY" ou "MM-YYYY"
  if (!month) {
    const mmy = name.match(/\b(\d{1,2})[\/\-](20\d{2})\b/);
    if (mmy) { month = parseInt(mmy[1]); year = parseInt(mmy[2]); }
  }
  if (!year) year = new Date().getFullYear();
  return { month, year };
}

function parseOneSheet(ws: XLSX.WorkSheet, sheetName: string = ""): PlanningEntry[] {
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  const entries: PlanningEntry[] = [];
  const headerRow = (rawRows[0] ?? []) as unknown[];

  // Contexte mois/année déduit du nom de l'onglet
  const { month: ctxMonth, year: ctxYear } = extractMonthYearFromSheetName(sheetName);

  // Résolution d'une cellule d'en-tête en date YYYY-MM-DD
  const resolveDate = (cell: unknown): string => {
    const basic = cellToDateStr(cell);
    if (basic) return basic;
    if (typeof cell === "string") {
      const s = cell.trim();
      // Format jj/mm ou jj-mm (sans année)
      const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
      if (m2) {
        const d = parseInt(m2[1]), mo = parseInt(m2[2]);
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12)
          return `${ctxYear}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
      // Jour seul sous forme de texte "11", " 11 "
      const dayStr = s.match(/^\s*(\d{1,2})\s*$/);
      if (dayStr && ctxMonth > 0) {
        const d = parseInt(dayStr[1]);
        if (d >= 1 && d <= 31)
          return `${ctxYear}-${String(ctxMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
    // Nombre entre 1 et 31 → considéré comme jour du mois (pas un serial Excel)
    if (typeof cell === "number" && cell >= 1 && cell < 100 && ctxMonth > 0)
      return `${ctxYear}-${String(ctxMonth).padStart(2, "0")}-${String(cell).padStart(2, "0")}`;
    return "";
  };

  const dates: string[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    dates.push(resolveDate(headerRow[c]));
  }

  let currentShift: ShiftTeamKey | null = null;
  // row_slot counter per (shift_type, team_id) — préserve l'ordre des lignes Excel
  const rowSlotCounters: Record<string, number> = {};

  for (let row = 1; row < rawRows.length; row++) {
    const rowData = rawRows[row] as unknown[];
    const shiftCell = String(rowData[0] ?? "").trim();

    if (shiftCell) {
      const detected = detectShiftLabel(shiftCell);
      if (detected) currentShift = detected;
    }
    if (!currentShift) continue;

    let rowColor: string | null = null;
    for (let c = 1; c < Math.min(rowData.length, 5); c++) {
      const col = getCellBgHex(ws, row, c);
      if (col) { rowColor = col; break; }
    }

    // Stocker la couleur hex directement comme team_id (ex: "#FFFF00")
    const teamId = rowColor ?? "";

    // Calculer le row_slot : compteur de lignes dans ce groupe (shift + couleur)
    const slotKey = `${currentShift}|${teamId}`;
    if (!(slotKey in rowSlotCounters)) rowSlotCounters[slotKey] = 0;
    const rowSlot = rowSlotCounters[slotKey]++;

    for (let c = 1; c < rowData.length; c++) {
      const name = String(rowData[c] ?? "").trim();
      const date = dates[c - 1];
      if (name && date) {
        entries.push({ date, shift_type: currentShift, employee_name: name, team_id: teamId, row_slot: rowSlot });
      }
    }
  }
  return entries;
}

function parsePlanningExcel(buffer: ArrayBuffer): { entries: PlanningEntry[]; sheets: ParsedSheet[] } {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, cellStyles: true });
  const allEntries: PlanningEntry[] = [];
  const sheets: ParsedSheet[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const entries = parseOneSheet(ws, sheetName);
    if (!entries.length) continue;
    const dates = entries.map((e) => e.date).filter(Boolean).sort();
    const teamSet = new Set(entries.map((e) => e.team_id).filter(Boolean));
    sheets.push({
      name: sheetName, count: entries.length,
      dateMin: dates[0], dateMax: dates[dates.length - 1],
      teams: teamSet.size,
    });
    allEntries.push(...entries);
  }

  return { entries: allEntries, sheets };
}

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

// ============================================================================
// COMPOSANT: TodayPlanningPanel
// ============================================================================

function TodayPlanningPanel({
  todayPlanning, allRecords, loading,
}: {
  todayPlanning: {
    jour: { employee_name: string; employee_matricule?: string | null; team_id?: string }[];
    soir1: { employee_name: string; employee_matricule?: string | null; team_id?: string }[];
    soir2: { employee_name: string; employee_matricule?: string | null; team_id?: string }[];
    loaded: boolean;
  };
  allRecords: FlatRecord[];
  loading: boolean;
}) {
  const today = todayISO();
  const total = todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length;

  const recByMat = useMemo(() => new Map(allRecords.filter((r) => r.matricule).map((r) => [r.matricule, r])), [allRecords]);
  const recByName = useMemo(() => new Map(allRecords.map((r) => [r.full_name.toLowerCase().trim(), r])), [allRecords]);

  const getRecord = (emp: { employee_name: string; employee_matricule?: string | null }) => {
    if (emp.employee_matricule) {
      const r = recByMat.get(emp.employee_matricule);
      if (r) return r;
    }
    return recByName.get(emp.employee_name.toLowerCase().trim()) ?? null;
  };

  if (!todayPlanning.loaded || total === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-4">
        <CalendarRange className="h-10 w-10 text-slate-200" />
        <p className="text-xs text-center font-medium">Pas de planning<br />pour aujourd'hui</p>
      </div>
    );
  }

  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 bg-camublue-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-3.5 w-3.5" />
          <span className="text-xs font-bold capitalize">{dateLabel}</span>
        </div>
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">{total} planifiés</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {SHIFT_TEAMS.map((team) => {
          const emps = todayPlanning[team.key as ShiftTeamKey];
          if (!emps || emps.length === 0) return null;

          const shiftStatus = getShiftActiveStatus(team.key as ShiftTeamKey);
          const present = emps.filter((e) => { const r = getRecord(e); return r && r.status !== "absent"; }).length;
          const absent = shiftStatus === "upcoming" ? 0 : emps.length - present;

          return (
            <div key={team.key}>
              <div className={`px-3 py-1.5 flex items-center justify-between ${team.activeBg} border-b ${team.activeBorder}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${team.dot}`} />
                  <span className={`text-[10px] font-bold ${team.activeText}`}>{team.short}</span>
                  <span className={`text-[9px] ${team.activeText} opacity-70`}>{team.horaire}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">{present}✓</span>
                  {absent > 0 && <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">{absent}✗</span>}
                </div>
              </div>
              {emps.map((emp) => {
                const rec = getRecord(emp);
                const effectiveStatus = rec?.status ?? (shiftStatus === "upcoming" ? "pending" : "absent");
                const status = effectiveStatus;
                const isLate = (rec?.computed_late_minutes ?? 0) > 0;
                const pal = (emp.team_id && emp.team_id !== "") ? getTeamPalette(emp.team_id) : null;

                const statusDot =
                  status === "ok" ? "bg-emerald-500" :
                    status === "absent" ? "bg-red-500" :
                      status === "pending" ? "bg-blue-400" :
                        status === "incomplete" ? "bg-amber-500" :
                          "bg-violet-500";

                return (
                  <div key={emp.employee_name}
                    className={`flex items-center gap-2 px-3 py-1.5 text-[10px] border-b border-slate-50 transition-colors ${status === "absent" ? "bg-red-50/50" :
                      status === "pending" ? "bg-blue-50/30" :
                        status === "ok" ? "" :
                          status === "incomplete" ? "bg-amber-50/30" :
                            "bg-violet-50/30"
                      }`}>
                    {pal && <span className={`h-2 w-2 rounded-full shrink-0 ${pal.dot}`} />}
                    <div className="flex-1 min-w-0">
                      {emp.employee_matricule && (
                        <div className="font-mono text-[8px] text-slate-400 leading-none">{emp.employee_matricule}</div>
                      )}
                      <div className={`font-medium truncate leading-tight ${status === "absent" ? "text-red-700" : status === "pending" ? "text-blue-600" : "text-slate-700"}`}
                        title={emp.employee_name}>
                        {emp.employee_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isLate && <Clock className="h-2.5 w-2.5 text-orange-500" />}
                      <span className={`h-2 w-2 rounded-full ${statusDot}`} title={STATUS_CFG[status as keyof typeof STATUS_CFG]?.label} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { dot: "bg-emerald-500", label: "Présent" },
            { dot: "bg-red-500", label: "Absent" },
            { dot: "bg-blue-400", label: "En attente" },
            { dot: "bg-amber-500", label: "Incomplet" },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1 text-[9px] text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${l.dot}`} />{l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPOSANT: WeekProgressBar
// ============================================================================

function WeekProgressBar({ minutes, maxMinutes }: { minutes: number; maxMinutes: number }) {
  const pct = Math.min(100, Math.round((minutes / maxMinutes) * 100));
  const over = minutes > maxMinutes;
  const color = pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  const bgColor = pct >= 100 ? "bg-emerald-100" : pct >= 75 ? "bg-blue-100" : pct >= 50 ? "bg-amber-100" : "bg-red-100";
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

// ============================================================================
// COMPOSANT: SummaryTable
// ============================================================================

function SummaryTable({ rows, mode, isLoading }: {
  rows: SummaryRecord[]; mode: "weekly" | "monthly"; isLoading: boolean;
}) {
  const MAX_MIN = mode === "weekly" ? MAX_WEEKLY_MIN : Math.round(MAX_WEEKLY_MIN * 4.33);
  const maxLabel = mode === "weekly" ? "40h/sem" : `${formatMinutes(MAX_MIN)}/mois`;

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const total = rows.reduce((s, r) => s + r.worked_minutes, 0);
    const avg = Math.round(total / rows.length);
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
          { color: "bg-blue-500", label: "Bon (≥ 75%)" },
          { color: "bg-amber-400", label: "Moyen (≥ 50%)" },
          { color: "bg-red-400", label: "Faible (< 50%)" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />{l.label}</span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COMPOSANT: WorkScheduleModal
// ============================================================================

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
  const [view, setView] = useState<"list" | "period" | "form">("list");
  const [selectedPreset, setSelectedPreset] = useState<WorkSchedulePreset | null>(null);
  const [editingPreset, setEditingPreset] = useState<WorkSchedulePreset | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [dateStart, setDateStart] = useState(todayISO());
  const [dateEnd, setDateEnd] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [saved, setSaved] = useState(false);
  const [fContext, setFContext] = useState("");
  const [fStartH, setFStartH] = useState(8);
  const [fStartM, setFStartM] = useState(0);
  const [fEndH, setFEndH] = useState(17);
  const [fEndM, setFEndM] = useState(30);
  const [fBreakMin, setFBreakMin] = useState(60);
  const [fError, setFError] = useState("");

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
  }, [open, active, presets]);

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
                        { label: "Heure de sortie", H: fEndH, M: fEndM, setH: setFEndH, setM: setFEndM },
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

// ============================================================================
// COMPOSANT: DetailModal
// ============================================================================

function DetailModal({ open, onClose, employeeId, initialWeek }: {
  open: boolean; onClose: () => void; employeeId: number | null; initialWeek: string;
}) {
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selWeek, setSelWeek] = useState(initialWeek);

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
        const ds = cur.toISOString().split("T")[0];
        const dd = res.days.find((d: DayDetail) => d.date === ds);
        const rawStatus = dd?.status ?? "absent";
        const status = rawStatus === "not_working" ? "not_working" : (rawStatus as "ok" | "absent" | "incomplete" | "anomaly");
        return { day, date: ds, in_time: dd?.in_time ?? null, out_time: dd?.out_time ?? null, status, is_planned: (dd as any)?.is_planned ?? true };
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
                      <div key={i} className={`rounded-xl border p-3 grid grid-cols-5 gap-4 ${p.status === "ok" ? "bg-white border-slate-100" :
                        p.status === "not_working" ? "bg-slate-50 border-slate-200 opacity-70" :
                          "bg-rose-50 border-rose-100"
                        }`}>
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

// ============================================================================
// HELPERS COULEUR — pour reproduire exactement les couleurs Excel
// ============================================================================

/** Calcule la luminance relative d'une couleur hex (#RRGGBB ou #RGB) */
function hexLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16) / 255;
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16) / 255;
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Retourne les styles inline pour une ligne de la grille planning.
 * Si team_id est une couleur hex ("#RRGGBB"), l'utilise directement.
 * Sinon, utilise la TEAM_PALETTE (ancien format equipe-N).
 */
function planningRowStyle(teamId: string): { backgroundColor: string; color: string } {
  if (teamId.startsWith("#") && teamId.length >= 4) {
    const lum = hexLuminance(teamId);
    return {
      backgroundColor: teamId,
      color: lum > 0.4 ? "#1a1a1a" : "#ffffff",
    };
  }
  // Fallback: ancien format equipe-N → TEAM_PALETTE
  const idx = parseInt(teamId.replace(/\D/g, "") || "0", 10) - 1;
  const pal = TEAM_PALETTE[Math.max(0, idx) % TEAM_PALETTE.length];
  // On retourne une couleur approximative depuis la classe Tailwind
  const BG_FALLBACKS = ["#fef08a","#bbf7d0","#bae6fd","#fbcfe8","#fed7aa","#e9d5ff","#99f6e4","#fecaca","#c7d2fe","#d9f99d","#fde68a","#a5f3fc"];
  return { backgroundColor: BG_FALLBACKS[Math.max(0, idx) % BG_FALLBACKS.length], color: "#1a1a1a" };
}

// ============================================================================
// COMPOSANT: PlanningUploadModal (modifié pour ajouter colonne matricule)
// ============================================================================

interface PlanningUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  employeeNameToMatricule: Map<string, string>; // nom normalisé -> matricule
}

function PlanningUploadModal({ open, onClose, onSuccess, employeeNameToMatricule }: PlanningUploadModalProps) {
  const [tab, setTab] = useState<"view" | "import">("view");
  const [viewMonth, setViewMonth] = useState(yyyyMmToday());
  const [entries, setEntries] = useState<PlanningEntry[]>([]);
  const [loadingVue, setLoadingVue] = useState(false);
  const [addingCell, setAddingCell] = useState<{ date: string; shift: ShiftTeamKey } | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PlanningEntry[]>([]);
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);

  const loadMonthPlanning = useCallback(async (ym: string) => {
    setLoadingVue(true);
    try {
      const days = daysInMonth(ym);
      const data = await getShiftPlanning(days[0], days[days.length - 1]);
      setEntries(data);
    } catch { } finally { setLoadingVue(false); }
  }, []);

  useEffect(() => {
    if (open && tab === "view") loadMonthPlanning(viewMonth);
  }, [open, tab, viewMonth, loadMonthPlanning]);

  useEffect(() => {
    if (open) { setFile(null); setPreview([]); setParsedSheets([]); setError(""); setUploaded(false); setAddingCell(null); setNewName(""); }
  }, [open]);

  // Grille Excel : shift_type → équipes (dans l'ordre d'apparition) → lignes (row_slot) → date → employé
  const excelGrid = useMemo(() => {
    const SHIFT_ORDER = ["jour", "soir1", "soir2"];
    const shiftTeamOrder: Record<string, string[]> = {};
    const grid: Record<string, Record<string, Record<number, Record<string, string>>>> = {};

    for (const e of entries) {
      const shift = e.shift_type;
      const team  = e.team_id ?? "";
      const slot  = e.row_slot ?? 0;
      const date  = e.date;
      if (!grid[shift]) { grid[shift] = {}; shiftTeamOrder[shift] = []; }
      if (!grid[shift][team]) { grid[shift][team] = {}; shiftTeamOrder[shift].push(team); }
      if (!grid[shift][team][slot]) grid[shift][team][slot] = {};
      // Ne pas écraser : premier employé trouvé gagne (ordre du backend)
      if (!grid[shift][team][slot][date]) grid[shift][team][slot][date] = e.employee_name;
    }

    return SHIFT_ORDER.filter(s => s in grid).map(shift => ({
      shift_type: shift,
      teams: (shiftTeamOrder[shift] ?? []).map(team_id => ({
        team_id,
        rows: Object.entries(grid[shift][team_id])
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([slot, cells]) => ({ row_slot: parseInt(slot), cells })),
      })),
    }));
  }, [entries]);

  const activeDays = useMemo(() => {
    const daysSet = new Set(entries.map((e) => e.date));
    return daysInMonth(viewMonth).filter((d) => daysSet.has(d));
  }, [entries, viewMonth]);

  const hasAnyData = entries.length > 0;

  const handleFile = (f: File | null) => {
    if (!f) { setFile(null); setPreview([]); setParsedSheets([]); return; }
    setFile(f); setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { entries, sheets } = parsePlanningExcel(ev.target!.result as ArrayBuffer);
        // Enrichir avec les matricules
        const enrichedEntries = entries.map(entry => ({
          ...entry,
          employee_matricule: employeeNameToMatricule.get(
            entry.employee_name.trim().toLowerCase().replace(/\s+/g, ' ')
          ) ?? null
        }));
        setPreview(enrichedEntries);
        setParsedSheets(sheets);
      } catch { setError("Erreur lors de la lecture du fichier Excel."); setPreview([]); setParsedSheets([]); }
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
      setTimeout(() => {
        onSuccess(res.created);
        setTab("view");
        loadMonthPlanning(viewMonth);
        setFile(null); setPreview([]); setUploaded(false);
      }, 800);
    } catch { setError("Erreur lors de l'envoi du planning. Réessayez."); } finally { setLoading(false); }
  };

  const handleRemove = async (entry: PlanningEntry) => {
    setEntries((prev) => prev.filter(
      (e) => !(e.date === entry.date && e.shift_type === entry.shift_type && e.employee_name === entry.employee_name)
    ));
    try { await deleteSinglePlanningEntry(entry.date, entry.shift_type, entry.employee_name); }
    catch { loadMonthPlanning(viewMonth); }
  };

  const handleAdd = async () => {
    if (!addingCell || !newName.trim() || saving) return;
    setSaving(true);
    const name = newName.trim();
    const matricule = employeeNameToMatricule.get(name.trim().toLowerCase().replace(/\s+/g, ' ')) ?? null;
    const optimistic: PlanningEntry = {
      date: addingCell.date,
      shift_type: addingCell.shift,
      employee_name: name,
      employee_matricule: matricule
    };
    setEntries((prev) => [...prev, optimistic]);
    setAddingCell(null); setNewName("");
    try { await addSinglePlanningEntry({ date: addingCell.date, shift_type: addingCell.shift, employee_name: name, employee_matricule: matricule }); }
    catch { loadMonthPlanning(viewMonth); } finally { setSaving(false); }
  };

  const initials = (name: string) =>
    name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");

  const stats = useMemo(() => {
    const c: Record<string, number> = { jour: 0, soir1: 0, soir2: 0 };
    preview.forEach((e) => { if (e.shift_type in c) c[e.shift_type]++; });
    const dates = new Set(preview.map((e) => e.date));
    const teams = new Set(preview.map((e) => e.team_id).filter(Boolean));
    return { jour: c.jour, soir1: c.soir1, soir2: c.soir2, dates: dates.size, total: preview.length, teams: teams.size };
  }, [preview]);

  const [y, m] = viewMonth.split("-").map(Number);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative w-full sm:max-w-6xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
            style={{ maxHeight: "calc(100dvh - 2rem)" }}
            initial={{ y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>

            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-600 text-white"><CalendarRange className="h-4 w-4" /></div>
                <p className="font-bold text-slate-800">Planning des Shifts</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="flex gap-1 px-5 pt-3 shrink-0">
              {([
                { id: "view", icon: Table2, label: "Vue du planning" },
                { id: "import", icon: Upload, label: "Importer Excel" },
              ] as const).map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === id ? "bg-camublue-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            {tab === "view" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                  <button onClick={() => setViewMonth(prevMonth(viewMonth))}
                    className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-500 hover:text-slate-700">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-bold text-slate-800 text-base">{MONTHS_FR[m - 1]} {y}</span>
                    {hasAnyData ? (
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        {excelGrid.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {new Set(excelGrid.flatMap(g => g.teams.map(t => t.team_id))).size} équipes
                          </span>
                        )}
                        {excelGrid.map((g) => {
                          const s = SHIFT_KEYS.find(k => k.key === g.shift_type);
                          if (!s) return null;
                          const count = g.teams.reduce((sum, t) => sum + t.rows.reduce((rs, r) => rs + Object.keys(r.cells).length, 0), 0);
                          if (!count) return null;
                          return (
                            <span key={g.shift_type} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text} border ${s.border}`}>
                              {s.label} · {count}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Aucun planning ce mois</span>
                    )}
                  </div>
                  <button onClick={() => setViewMonth(nextMonth(viewMonth))}
                    className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-500 hover:text-slate-700">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-auto">
                  {loadingVue ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…
                    </div>
                  ) : !hasAnyData ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                      <CalendarRange className="h-14 w-14 text-slate-200" />
                      <p className="text-sm font-medium">Aucun planning importé pour ce mois</p>
                      <button onClick={() => setTab("import")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-800 transition">
                        <Upload className="h-4 w-4" />Importer un planning Excel
                      </button>
                    </div>
                  ) : (
                    /* ── Vue Planning identique à l'Excel : dates en colonnes, employés en lignes, couleurs réelles ── */
                    <div style={{ overflowX: "auto" }}>
                      {/* Légende équipes */}
                      {(() => {
                        const teamIds = Array.from(new Set(excelGrid.flatMap(g => g.teams.map(t => t.team_id)).filter(Boolean)));
                        if (!teamIds.length) return null;
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "8px 10px 4px", borderBottom: "1px solid #e2e8f0" }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", alignSelf: "center", marginRight: 4 }}>ÉQUIPES :</span>
                            {teamIds.map((tid) => {
                              const rs = planningRowStyle(tid);
                              return (
                                <span key={tid} style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "2px 8px", borderRadius: 99, fontSize: "10px", fontWeight: 600,
                                  backgroundColor: rs.backgroundColor, color: rs.color,
                                  border: "1px solid rgba(0,0,0,0.12)",
                                }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: rs.color, opacity: 0.5, display: "inline-block" }} />
                                  {tid}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                      <table style={{ borderCollapse: "collapse", fontSize: "11px", tableLayout: "auto", width: "100%" }}>
                        <thead style={{ position: "sticky", top: 0, zIndex: 20 }}>
                          <tr style={{ backgroundColor: "#1b2d50", color: "white" }}>
                            {/* Colonne SHIFT — sticky gauche */}
                            <th style={{
                              position: "sticky", left: 0, zIndex: 30,
                              backgroundColor: "#1b2d50", color: "white",
                              fontWeight: "bold", fontSize: "10px",
                              padding: "6px 10px",
                              border: "1px solid rgba(255,255,255,0.18)",
                              minWidth: "62px", textAlign: "center",
                            }}>SHIFT</th>
                            {/* Colonnes dates */}
                            {activeDays.map((date) => {
                              const d = new Date(date + "T00:00:00");
                              const isToday = date === todayISO();
                              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                              const dd = String(d.getDate()).padStart(2, "0");
                              const mm = String(d.getMonth() + 1).padStart(2, "0");
                              const yy = d.getFullYear().toString().slice(2);
                              return (
                                <th key={date} style={{
                                  backgroundColor: isToday ? "#1d4ed8" : isWeekend ? "#2d3f5a" : "#1b2d50",
                                  color: "white",
                                  fontWeight: 700,
                                  padding: "4px 3px",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  minWidth: "88px",
                                  textAlign: "center",
                                  whiteSpace: "nowrap",
                                }}>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                    <span style={{ fontSize: "9px", textTransform: "uppercase", opacity: 0.75, letterSpacing: "0.04em" }}>{DAYS_FR[d.getDay()]}</span>
                                    <span style={{ fontSize: "13px", fontWeight: 900, lineHeight: 1 }}>{dd}/{mm}</span>
                                    <span style={{ fontSize: "8px", opacity: 0.6 }}>{yy}</span>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const tableRows: React.ReactNode[] = [];
                            const SHIFT_LABELS: Record<string, string> = { jour: "08H – 16H", soir1: "16H – 22H", soir2: "22H – 08H" };
                            const SHIFT_HEADER_COLORS: Record<string, { bg: string; border: string }> = {
                              jour:  { bg: "#166534", border: "#14532d" },
                              soir1: { bg: "#92400e", border: "#78350f" },
                              soir2: { bg: "#581c87", border: "#4c1d95" },
                            };

                            excelGrid.forEach(({ shift_type, teams }, shiftIdx) => {
                              const shiftLabel = SHIFT_LABELS[shift_type] ?? shift_type;
                              const shiftColors = SHIFT_HEADER_COLORS[shift_type] ?? { bg: "#334155", border: "#1e293b" };
                              const totalRows = teams.reduce((sum, t) => sum + t.rows.length, 0);

                              // Ligne séparateur de shift (sauf le premier)
                              if (shiftIdx > 0) {
                                tableRows.push(
                                  <tr key={`sep-${shift_type}`}>
                                    <td colSpan={activeDays.length + 1} style={{
                                      height: "6px",
                                      backgroundColor: "#e2e8f0",
                                      padding: 0,
                                    }} />
                                  </tr>
                                );
                              }

                              // Ligne bannière du shift
                              tableRows.push(
                                <tr key={`banner-${shift_type}`}>
                                  <td colSpan={activeDays.length + 1} style={{
                                    backgroundColor: shiftColors.bg,
                                    color: "white",
                                    fontWeight: 800,
                                    fontSize: "11px",
                                    padding: "5px 12px",
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    borderBottom: `2px solid ${shiftColors.border}`,
                                    position: "sticky",
                                    left: 0,
                                  }}>
                                    ▶ {shiftLabel}
                                  </td>
                                </tr>
                              );

                              let isFirstShiftRow = true;
                              for (const { team_id, rows: teamRows } of teams) {
                                const rowStyle = planningRowStyle(team_id);
                                const teamRowCount = teamRows.length;

                                for (let ri = 0; ri < teamRows.length; ri++) {
                                  const { row_slot, cells } = teamRows[ri];
                                  const showShiftCell = isFirstShiftRow;
                                  const showTeamCell = ri === 0;
                                  isFirstShiftRow = false;

                                  const isLastTeamRow = ri === teamRows.length - 1;
                                  const rowBorderBottom = isLastTeamRow
                                    ? `2px solid rgba(0,0,0,0.18)`
                                    : `1px solid rgba(0,0,0,0.07)`;

                                  tableRows.push(
                                    <tr key={`${shift_type}-${team_id}-${row_slot}`}
                                      style={{ borderBottom: rowBorderBottom }}>
                                      {/* Colonne SHIFT — rowspan sur tout le groupe shift */}
                                      {showShiftCell && (
                                        <td rowSpan={totalRows} style={{
                                          position: "sticky", left: 0, zIndex: 10,
                                          backgroundColor: shiftColors.bg,
                                          color: "white",
                                          fontWeight: "bold",
                                          fontSize: "11px",
                                          padding: "4px 5px",
                                          border: `1px solid ${shiftColors.border}`,
                                          textAlign: "center",
                                          verticalAlign: "middle",
                                          whiteSpace: "nowrap",
                                          writingMode: "vertical-lr",
                                          transform: "rotate(180deg)",
                                          letterSpacing: "0.06em",
                                          minWidth: "48px",
                                          maxWidth: "48px",
                                          boxShadow: "2px 0 6px rgba(0,0,0,0.18)",
                                        }}>
                                          {shiftLabel}
                                        </td>
                                      )}
                                      {/* Cellules dates */}
                                      {activeDays.map((date) => {
                                        const d = new Date(date + "T00:00:00");
                                        const isToday = date === todayISO();
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        const empName = cells[date] ?? "";
                                        const cellBg = empName
                                          ? rowStyle.backgroundColor
                                          : isToday ? "#dbeafe" : isWeekend ? "#f8fafc" : "#ffffff";
                                        const cellColor = empName ? rowStyle.color : "#cbd5e1";
                                        const cellBorderRight = isWeekend
                                          ? "1px solid #cbd5e1"
                                          : "1px solid #e2e8f0";
                                        return (
                                          <td key={date} style={{
                                            backgroundColor: cellBg,
                                            color: cellColor,
                                            padding: "4px 6px",
                                            borderRight: cellBorderRight,
                                            borderBottom: "1px solid #e2e8f0",
                                            fontSize: "11px",
                                            fontWeight: empName ? 600 : 400,
                                            minWidth: "88px",
                                            whiteSpace: "nowrap",
                                            outline: isToday ? "1px inset #3b82f6" : undefined,
                                          }}>
                                            {empName || <span style={{ fontSize: "10px", opacity: 0.3 }}>—</span>}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                }
                              }
                            });
                            return tableRows;
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "import" && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <label className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all ${file ? "border-green-400 bg-green-50" : "border-slate-200 bg-slate-50 hover:border-camublue-900 hover:bg-camublue-900/5"}`}>
                  <Upload className={`h-8 w-8 ${file ? "text-green-600" : "text-slate-300"}`} />
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm font-bold text-green-700">{file.name}</p>
                      <p className="text-xs text-green-600 mt-0.5">
                        {parsedSheets.length} onglet{parsedSheets.length > 1 ? "s" : ""} · {stats.total} assignations lues
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-600">Cliquer pour choisir un fichier Excel</p>
                      <p className="text-xs text-slate-400 mt-1">.xlsx, .xls — Plusieurs onglets supportés</p>
                      <p className="text-xs text-slate-400">Colonne A = shift · Colonnes B+ = dates avec employés</p>
                    </div>
                  )}
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                </label>

                {parsedSheets.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Onglets détectés</p>
                    <div className="grid gap-2">
                      {parsedSheets.map((sheet) => (
                        <div key={sheet.name} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                              <FileSpreadsheet className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{sheet.name}</p>
                              <p className="text-xs text-slate-400 font-mono">{sheet.dateMin} → {sheet.dateMax}</p>
                              {sheet.teams > 0 && (
                                <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                                  {sheet.teams} équipe{sheet.teams > 1 ? "s" : ""} détectée{sheet.teams > 1 ? "s" : ""} par couleur
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                            {sheet.count} lignes
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {preview.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: "Jours couverts", value: stats.dates, color: "bg-blue-50 text-blue-700 border-blue-200" },
                      { label: "Équipes", value: stats.teams, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                      { label: "08H-16H", value: stats.jour, color: "bg-teal-50 text-teal-700 border-teal-200" },
                      { label: "16H-22H", value: stats.soir1, color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                      { label: "22H-08H", value: stats.soir2, color: "bg-orange-50 text-orange-700 border-orange-200" },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-xl px-3 py-2.5 text-center border ${s.color}`}>
                        <p className="text-xl font-black">{s.value}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mt-0.5 opacity-80">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {preview.length > 0 && !uploaded && (
                  <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>
                      <strong>Attention :</strong> l'import va <strong>supprimer et remplacer intégralement</strong> le planning existant.
                      Toutes les assignations précédentes seront effacées.
                    </span>
                  </div>
                )}

                {error && <p className="text-sm text-red-500 font-medium bg-red-50 rounded-xl px-4 py-3 border border-red-100">⚠️ {error}</p>}

                <div className="flex gap-3 pt-1">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">Annuler</button>
                  <button onClick={handleUpload} disabled={!preview.length || loading || uploaded}
                    className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${uploaded ? "bg-emerald-500 text-white" : "bg-camublue-900 hover:bg-camublue-800 text-white"}`}>
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Remplacement en cours…</>
                      : uploaded ? <><CheckCircle className="h-4 w-4" />Planning remplacé avec succès !</>
                        : <><Upload className="h-4 w-4" />Remplacer le planning ({stats.total} assignations)</>}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// COMPOSANT: AlertModal
// ============================================================================

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
                  { id: "absent", icon: <UserMinus className="h-4 w-4" />, label: "Absence", border: "border-red-400 bg-red-50 text-red-700" },
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

// ============================================================================
// COMPOSANT: TableRow
// ============================================================================

function TableRow({ r, isLate, onAlert, onDetail }: {
  r: FlatRecord; isLate: boolean; onAlert: () => void; onDetail: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const deficit = r.deficit_minutes > 0;
  const rowBg = r.is_replacement ? "bg-purple-50/40 hover:bg-purple-50/70"
    : r.not_scheduled_rest ? "bg-slate-50/60 opacity-70 hover:opacity-100"
      : r.is_shift_pending ? "bg-blue-50/40 hover:bg-blue-50/70"
        : isLate ? "bg-orange-50/50 hover:bg-orange-50"
          : deficit ? "bg-rose-50/30 hover:bg-rose-50/60"
            : "hover:bg-slate-50";
  return (
    <>
      <tr className={`hidden md:table-row border-b border-slate-100 transition-colors text-sm ${rowBg}`}>
        <td className="px-4 py-3"><div className="flex justify-center font-mono text-slate-500 text-xs">{r.matricule || "—"}</div></td>
        <td className="px-4 py-3">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              {r.team_id && r.team_id !== "_no_team" && (() => {
                const pal = getTeamPalette(r.team_id);
                return <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${pal.dot}`} title={`Équipe ${r.team_id.replace("equipe-", "")}`} />;
              })()}
              <span className="font-medium text-slate-800">{r.full_name}</span>
            </div>
            {r.replaced_by && (
              <span className="text-[10px] text-purple-600 font-semibold flex items-center gap-1">
                <ArrowLeftRight className="h-2.5 w-2.5" />remplacé par {r.replaced_by}
              </span>
            )}
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
              : r.is_shift_pending
                ? <StatusPill status="pending" />
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
      <tr className={`md:hidden border-b border-slate-100 ${r.is_replacement ? "bg-purple-50/40" : r.not_scheduled_rest ? "bg-slate-50/60 opacity-70" : r.is_shift_pending ? "bg-blue-50/40" : isLate ? "bg-orange-50/40" : deficit ? "bg-rose-50/30" : ""}`}>
        <td colSpan={12} className="px-3 py-2">
          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">{r.full_name}</p>
              <p className="text-xs text-slate-400 font-mono">{r.matricule || "—"} · {r.project !== "—" ? `${r.project} / ` : ""}{r.department}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.not_scheduled_rest
                ? <RestDayBadge />
                : r.is_shift_pending
                  ? <StatusPill status="pending" />
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

// ============================================================================
// COMPOSANT: KPI Cards
// ============================================================================

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
    blue: { icon: "bg-camublue-900 text-white", text: "text-camublue-900" },
    green: { icon: "bg-emerald-500 text-white", text: "text-emerald-700" },
    amber: { icon: "bg-amber-500 text-white", text: "text-amber-700" },
    red: { icon: "bg-red-500 text-white", text: "text-red-700" },
    violet: { icon: "bg-violet-500 text-white", text: "text-violet-700" },
    slate: { icon: "bg-slate-400 text-white", text: "text-slate-600" },
    orange: { icon: "bg-orange-500 text-white", text: "text-orange-700" },
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

// ============================================================================
// COMPOSANT: EnhancedWeeklyPlanningGrid (gardé mais plus utilisé)
// ============================================================================

function EnhancedWeeklyPlanningGrid({
  planningEntries,
  weekDays,
  weekAttendance,
  teamCycles,
  loading,
}: {
  planningEntries: PlanningEntry[];
  weekDays: string[];
  weekAttendance: Record<string, Record<string, string>>;
  teamCycles: Map<string, { startDate: string; employees: string[] }>;
  loading: boolean;
}) {
  const today = todayISO();

  const teamGroups = useMemo(() => {
    const teams = new Map<string, {
      teamId: string;
      employees: { name: string; matricule: string | null }[];
      cycleStart: string;
    }>();

    for (const entry of planningEntries) {
      if (!entry.team_id || entry.team_id === "_no_team") continue;

      if (!teams.has(entry.team_id)) {
        const cycle = teamCycles.get(entry.team_id);
        teams.set(entry.team_id, {
          teamId: entry.team_id,
          employees: [],
          cycleStart: cycle?.startDate || entry.date,
        });
      }

      const team = teams.get(entry.team_id)!;
      if (!team.employees.some(e => e.name === entry.employee_name)) {
        team.employees.push({
          name: entry.employee_name,
          matricule: entry.employee_matricule || null
        });
      }
    }

    return Array.from(teams.values()).sort((a, b) =>
      parseInt(a.teamId.replace(/\D/g, "")) - parseInt(b.teamId.replace(/\D/g, ""))
    );
  }, [planningEntries, teamCycles]);

  const getCycleForTeamAndDate = (teamId: string, date: string): CycleType => {
    const cycle = teamCycles.get(teamId);
    if (!cycle) return "R";
    return getCycleForDate(cycle.startDate, cycle.startDate, date);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Chargement du planning…</span>
      </div>
    );
  }

  if (teamGroups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 py-16">
        <CalendarRange className="h-14 w-14 text-slate-200" />
        <p className="text-sm font-medium">Aucune équipe détectée dans le planning</p>
        <p className="text-xs text-slate-400">Importez un planning avec des couleurs d'équipe.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm bg-white">
      <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b border-slate-200 sticky top-0 z-20 flex-wrap">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cycle 2-2-2-4 :</span>
        {[
          { type: "M", label: "Matin (08H-16H)", style: "bg-teal-200 text-teal-800" },
          { type: "S", label: "Soir (16H-22H)", style: "bg-amber-200 text-amber-800" },
          { type: "N", label: "Nuit (22H-08H)", style: "bg-indigo-200 text-indigo-800" },
          { type: "R", label: "Repos", style: "bg-slate-200 text-slate-600" },
        ].map((item) => (
          <span key={item.type} className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${item.style}`}>
            {item.type} = {item.label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200 sticky top-[33px] z-20 flex-wrap">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Statuts :</span>
        {[
          { label: "✓ Présent (planifié)", style: "bg-emerald-100 text-emerald-800" },
          { label: "🔄 Remplaçant", style: "bg-purple-100 text-purple-800" },
          { label: "✗ Absent", style: "bg-red-100 text-red-700" },
          { label: "— Pas de service", style: "bg-slate-100 text-slate-500" },
        ].map((item) => (
          <span key={item.label} className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${item.style}`}>
            {item.label}
          </span>
        ))}
      </div>

      <table className="min-w-full text-xs border-collapse">
        <thead className="sticky top-[66px] z-10">
          <tr className="bg-camublue-900 text-white">
            <th className="px-4 py-3 text-left font-bold min-w-[180px] sticky left-0 bg-camublue-900 z-20 border-r border-white/20">
              ÉQUIPE / Employés
            </th>
            {weekDays.map((date) => {
              const d = new Date(date + "T00:00:00");
              const isToday = date === today;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <th key={date}
                  className={`px-2 py-3 text-center font-semibold min-w-[100px] border-r border-white/10 last:border-r-0 ${isToday ? "bg-blue-600" : isWeekend ? "bg-camublue-800/70" : ""
                    }`}>
                  <div className="flex flex-col items-center leading-none gap-0.5">
                    <span className="text-[9px] font-bold uppercase">{DAYS_FR[d.getDay()]}</span>
                    <span className="text-base font-black">{d.getDate()}</span>
                    <span className="text-[9px] opacity-70">{MONTHS_SHORT[d.getMonth()]}</span>
                    {isToday && <span className="text-[8px] bg-white/30 px-1 rounded mt-0.5 font-bold">Aujourd'hui</span>}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {teamGroups.map((team) => {
            const pal = getTeamPalette(team.teamId);

            return (
              <React.Fragment key={team.teamId}>
                <tr>
                  <td colSpan={weekDays.length + 1}
                    className={`px-4 py-2 font-bold text-sm border-b-2 ${pal.border} ${pal.bg} sticky left-0`}>
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${pal.dot}`} />
                      <span className={pal.text}>{pal.label}</span>
                      <span className="text-xs font-normal opacity-70">Cycle début {new Date(team.cycleStart).toLocaleDateString("fr-FR")}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pal.chipBg}`}>
                        {team.employees.length} agents
                      </span>
                    </div>
                  </td>
                </tr>

                <tr className="bg-slate-50">
                  <td className="px-4 py-1 text-[9px] font-semibold text-slate-500 sticky left-0 bg-slate-50 border-r border-slate-200">
                    Cycle prévu
                  </td>
                  {weekDays.map((date) => {
                    const cycleType = getCycleForTeamAndDate(team.teamId, date);
                    const cfg = cycleConfig[cycleType];
                    return (
                      <td key={date} className="px-2 py-1 text-center border-r border-slate-200">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${cfg.style}`}>
                          {cfg.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {team.employees.map((emp, idx) => {
                  const dayStatuses = weekDays.map(date => {
                    const cycleType = getCycleForTeamAndDate(team.teamId, date);
                    const isScheduled = cycleType !== "R";

                    if (!isScheduled) {
                      return { status: "not_working", cycleType };
                    }

                    const dayMap = weekAttendance[date] ?? {};
                    const attStatus = dayMap[emp.matricule || emp.name.toLowerCase()];

                    if (attStatus === "ok" || attStatus === "present") {
                      return { status: "present", cycleType };
                    } else if (attStatus === "absent") {
                      return { status: "absent", cycleType };
                    } else if (attStatus === "incomplete") {
                      return { status: "incomplete", cycleType };
                    } else {
                      return { status: "absent", cycleType };
                    }
                  });

                  return (
                    <tr key={emp.name}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                      <td className={`px-3 py-2 sticky left-0 z-10 border-r border-slate-200 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${pal.dot}`} />
                          <div className="min-w-0">
                            {emp.matricule && (
                              <div className="text-[8px] font-mono text-slate-400 leading-none">{emp.matricule}</div>
                            )}
                            <div className="text-[11px] font-semibold text-slate-700 truncate max-w-[130px]" title={emp.name}>
                              {emp.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {dayStatuses.map((dayStatus, i) => {
                        const date = weekDays[i];
                        const cfg = cycleConfig[dayStatus.cycleType];
                        const isToday = date === today;

                        let statusColor = "";
                        let statusIcon = "";

                        if (dayStatus.status === "present") {
                          statusColor = "bg-emerald-100 text-emerald-800";
                          statusIcon = "✓";
                        } else if (dayStatus.status === "absent" && dayStatus.cycleType !== "R") {
                          statusColor = "bg-red-100 text-red-700";
                          statusIcon = "✗";
                        } else if (dayStatus.cycleType === "R") {
                          statusColor = "bg-slate-100 text-slate-500";
                          statusIcon = "—";
                        }

                        return (
                          <td key={date}
                            className={`px-1 py-2 text-center border-r border-slate-100 last:border-r-0 ${isToday ? "bg-blue-50/40" : ""
                              }`}>
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${cfg.style}`}>
                                {cfg.label}
                              </span>
                              {dayStatus.cycleType !== "R" && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${statusColor}`}>
                                  {statusIcon}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// COMPOSANT PRINCIPAL: AttendanceShiftsPage
// ============================================================================

export default function AttendanceShiftsPage() {
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [selectedTeam, setSelectedTeam] = useState<ShiftTeamKey | null>(null);
  const [shiftData, setShiftData] = useState<ShiftDailyStatsResponse | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyStatsResponse | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyStatsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [emailMap, setEmailMap] = useState<Map<string, string>>(new Map());
  const [departmentMap, setDepartmentMap] = useState<Map<string, string>>(new Map());
  const [projectMap, setProjectMap] = useState<Map<string, string>>(new Map());
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<FlatRecord | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [showNotScheduled, setShowNotScheduled] = useState(false);
  const [week, setWeek] = useState(isoWeekNow());
  const [month, setMonth] = useState(yyyyMmToday());
  const currentWeek = isoWeekNow();

  // Liste des employés pour la correspondance nom -> matricule
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);

  // États pour le planning (conservés pour l'import et l'affichage latéral)
  const [planningEntries, setPlanningEntries] = useState<PlanningEntry[]>([]);
  const [loadingPlanning, setLoadingPlanning] = useState(false);
  const [weekAttendance, setWeekAttendance] = useState<Record<string, Record<string, string>>>({});
  const [teamCycles, setTeamCycles] = useState<Map<string, { startDate: string; employees: string[] }>>(new Map());

  const [todayPlanning, setTodayPlanning] = useState<{
    jour: { employee_name: string; employee_matricule?: string | null; team_id?: string }[];
    soir1: { employee_name: string; employee_matricule?: string | null; team_id?: string }[];
    soir2: { employee_name: string; employee_matricule?: string | null; team_id?: string }[];
    loaded: boolean;
  }>({ jour: [], soir1: [], soir2: [], loaded: false });

  const [activeSchedule, setActiveSchedule] = useState<ActiveSchedule | null>(() => {
    try {
      const stored = localStorage.getItem(LS_SHIFT_ACTIVE_SCHEDULE_KEY);
      if (stored) return JSON.parse(stored) as ActiveSchedule;
    } catch { }
    const d = new Date(), end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { ...DEFAULT_PRESETS[0], dateStart: todayISO(), dateEnd: end.toISOString().slice(0, 10), locked: true };
  });

  const [presets, setPresets] = useState<WorkSchedulePreset[]>(() => {
    try {
      const stored = localStorage.getItem(LS_SHIFT_PRESETS_KEY);
      if (stored) return JSON.parse(stored) as WorkSchedulePreset[];
    } catch { }
    return DEFAULT_PRESETS;
  });

  const [assignments, setAssignments] = useState<AssignmentMap>(() => {
    try {
      const stored = localStorage.getItem(LS_SHIFT_ASSIGNMENTS_KEY);
      if (stored) return JSON.parse(stored) as AssignmentMap;
    } catch { }
    return {};
  });

  // Map nom normalisé -> matricule
  const employeeNameToMatricule = useMemo(() => {
    const map = new Map<string, string>();
    employeesList.forEach(emp => {
      if (emp.full_name && emp.matricule) {
        const normalized = emp.full_name.trim().toLowerCase().replace(/\s+/g, ' ');
        map.set(normalized, emp.matricule);
      }
    });
    return map;
  }, [employeesList]);

  useEffect(() => {
    try {
      if (activeSchedule) localStorage.setItem(LS_SHIFT_ACTIVE_SCHEDULE_KEY, JSON.stringify(activeSchedule));
      else localStorage.removeItem(LS_SHIFT_ACTIVE_SCHEDULE_KEY);
    } catch { }
  }, [activeSchedule]);

  useEffect(() => {
    try { localStorage.setItem(LS_SHIFT_PRESETS_KEY, JSON.stringify(presets)); } catch { }
  }, [presets]);

  useEffect(() => {
    try { localStorage.setItem(LS_SHIFT_ASSIGNMENTS_KEY, JSON.stringify(assignments)); } catch { }
  }, [assignments]);

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
      setPresets((prev) => {
        if (prev.some((p) => p.context === remote.context)) return prev;
        return [...prev, { context: remote.context, startH: remote.startH, startM: remote.startM, endH: remote.endH, endM: remote.endM, breakMin: remote.breakMin }];
      });
    }).catch(() => { });

    getShiftPlanningForDate(todayISO()).then((res) => {
      setTodayPlanning({ ...res.assignments, loaded: true });
    }).catch(() => {
      setTodayPlanning((p) => ({ ...p, loaded: true }));
    });
  }, []);

  useEffect(() => {
    getEmployees().then((list: Employee[]) => {
      setEmployeesList(list);
      const m = new Map<string, string>();
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
      setAssignments((prev) => ({ ...apiAssignments, ...prev }));
    }).catch(console.error);
  }, []);

  const effectiveSchedule: WorkSchedulePreset = useMemo(() => {
    if (activeSchedule && isPeriodActive(activeSchedule)) return activeSchedule;
    return presets[0] ?? DEFAULT_PRESETS[0];
  }, [activeSchedule, presets]);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const isActiveLocked = activeSchedule ? isPeriodActive(activeSchedule) : false;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "daily") {
        const [stats, plan] = await Promise.all([
          getShiftDailyStats({ date: todayISO() }),
          getShiftPlanningForDate(todayISO()).catch(() => null),
        ]);
        setShiftData(stats);
        if (plan) setTodayPlanning({ ...plan.assignments, loaded: true });
      }
      if (viewMode === "weekly") setWeeklyData(await getWeeklyStats(week));
      if (viewMode === "monthly") setMonthlyData(await getMonthlyStats(month));
    } finally { setLoading(false); }
  }, [viewMode, week, month]);

  useEffect(() => { fetchData(); }, [viewMode]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQ, shiftData, weeklyData, monthlyData, pageSize]);

  const allRecords = useMemo((): FlatRecord[] => {
    if (!shiftData || viewMode !== "daily") return [];

    const sched = effectiveSchedule;
    const effectiveWorkMin = workDayMinutes(sched);
    const planningLoaded = todayPlanning.loaded;

    const teamEmployees = new Map<string, Set<string>>();
    const employeeToTeam = new Map<string, string>();

    if (planningLoaded) {
      for (const key of (["jour", "soir1", "soir2"] as ShiftTeamKey[])) {
        for (const emp of todayPlanning[key]) {
          if (emp.team_id && emp.team_id !== "_no_team") {
            if (!teamEmployees.has(emp.team_id)) {
              teamEmployees.set(emp.team_id, new Set());
            }
            teamEmployees.get(emp.team_id)!.add(emp.employee_name);
            employeeToTeam.set(emp.employee_name, emp.team_id);
          }
        }
      }
    }

    const presentEmployees = new Map<string, ShiftRecord>();
    for (const r of shiftData.records) {
      if (r.status !== "absent") {
        presentEmployees.set(r.full_name, r);
      }
    }

    const replacements = new Map<string, { absent: string; replacement: string }>();

    for (const [teamId, employees] of teamEmployees) {
      const teamEmployeesList = Array.from(employees);
      const presentInTeam = teamEmployeesList.filter(name => presentEmployees.has(name));
      const absentInTeam = teamEmployeesList.filter(name => !presentEmployees.has(name));

      for (const absent of absentInTeam) {
        const replacement = Array.from(presentEmployees.keys()).find(name =>
          !employeeToTeam.has(name)
        );

        if (replacement) {
          replacements.set(absent, { absent, replacement });
        }
      }
    }

    return shiftData.records.map((r: ShiftRecord): FlatRecord => {
      const workedRaw = computeWorkedMinutesFromTimes(r.in_time, r.out_time) || (r.worked_minutes ?? 0);
      const workedNetMin = Math.max(0, workedRaw - sched.breakMin);
      const lateMin = computeLateMinutes(r.in_time, sched.startH, sched.startM);
      const overtimeMin = computeOvertimeMinutes(r.out_time, sched.endH, sched.endM);

      const employeeTeam = employeeToTeam.get(r.full_name);
      const isScheduled = employeeTeam !== undefined;
      const isPresent = r.status !== "absent";
      const replacement = replacements.get(r.full_name);

      let status = r.status;
      let isReplacement = false;
      let notScheduledRest = false;
      let replacedBy = null;

      if (!isScheduled && isPresent) {
        isReplacement = true;
        status = "ok";
      } else if (isScheduled && !isPresent) {
        status = "absent";
        if (replacement) {
          replacedBy = replacement.replacement;
        }
      } else if (!isScheduled && !isPresent) {
        notScheduledRest = true;
        status = "not_working";
      }

      let shiftTeam: ShiftTeamKey | null = null;
      if (isScheduled) {
        for (const key of (["jour", "soir1", "soir2"] as ShiftTeamKey[])) {
          const found = todayPlanning[key]?.find(e => e.employee_name === r.full_name);
          if (found) {
            shiftTeam = key;
            break;
          }
        }
      } else {
        shiftTeam = detectShiftTeamFromTime(r.in_time);
      }

      return {
        employee_id: r.employee_id,
        matricule: r.matricule,
        full_name: r.full_name,
        department: (r.department ?? "—").toUpperCase(),
        project: (() => {
          const p = (r as any).project ?? (r as any).projet ?? (r as any).project_name ?? (r as any).site ?? null;
          return p ? String(p).toUpperCase() : (projectMap.get(r.matricule) ?? "—");
        })(),
        status: status as any,
        is_late_api: r.is_late,
        late_label_api: r.late_label,
        computed_late_minutes: lateMin,
        overtime_minutes: overtimeMin,
        compensation: computeCompensation(lateMin, overtimeMin),
        deficit_minutes: computeDeficitMinutes(workedNetMin, effectiveWorkMin),
        in_time: r.in_time,
        out_time: r.out_time,
        worked_minutes: workedNetMin,
        expected_minutes: effectiveWorkMin,
        email: emailMap.get(r.matricule) ?? null,
        shift_team: shiftTeam,
        shift_team_label: SHIFT_TEAMS.find((t) => t.key === shiftTeam)?.label ?? "",
        is_scheduled: isScheduled,
        is_replacement: isReplacement,
        not_scheduled_rest: notScheduledRest,
        is_shift_pending: false,
        team_id: employeeTeam || "",
        replaced_by: replacedBy,
      };
    });
  }, [shiftData, emailMap, effectiveSchedule, viewMode, projectMap, todayPlanning]);

  const summaryRecords = useMemo((): SummaryRecord[] => {
    const resolveDept = (r: any) =>
      (r.department ?? r.service ?? departmentMap.get(r.matricule ?? "") ?? "—").toUpperCase();
    const resolveProject = (r: any) => {
      const p = (r as any).project ?? (r as any).projet ?? (r as any).project_name ?? (r as any).site ?? null;
      return p ? String(p).toUpperCase() : (projectMap.get(r.matricule ?? "") ?? "—");
    };
    const mapEmp = (r: any): SummaryRecord => ({
      employee_id: r.employee_id,
      matricule: r.matricule ?? "",
      full_name: r.full_name ?? "",
      department: resolveDept(r),
      project: resolveProject(r),
      shift_team: assignments[r.matricule ?? ""] ?? r.shift_team ?? null,
      nb_jours: r.present_days ?? r.worked_days ?? 0,
      worked_minutes: r.total_worked_minutes ?? r.worked_minutes ?? 0,
    });
    if (viewMode === "weekly" && weeklyData) return weeklyData.by_employee.map(mapEmp);
    if (viewMode === "monthly" && monthlyData) return monthlyData.by_employee.map(mapEmp);
    return [];
  }, [viewMode, weeklyData, monthlyData, assignments, departmentMap, projectMap]);

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

  const isLateRecord = (r: FlatRecord) => r.computed_late_minutes > 0;

  const matchSearch = (r: FlatRecord, q: string) =>
    !q || r.full_name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q) ||
    r.department.toLowerCase().includes(q) || (r.shift_team_label ?? "").toLowerCase().includes(q) ||
    r.project.toLowerCase().includes(q);

  // ── BASE PLANNING : employés du shift sélectionné (planning uniquement) ────
  const shiftPlanningBase = useMemo((): FlatRecord[] => {
    if (!selectedTeam || !todayPlanning.loaded) return [];
    const planEmps = todayPlanning[selectedTeam] ?? [];
    if (planEmps.length === 0) return [];
    const shiftStat = getShiftActiveStatus(selectedTeam);

    return planEmps.map((e) => {
      const rec = allRecords.find((r) =>
        (e.employee_matricule && r.matricule && r.matricule === e.employee_matricule) ||
        r.full_name.toLowerCase().trim() === e.employee_name.toLowerCase().trim()
      );
      if (rec) {
        return {
          ...rec,
          shift_team: selectedTeam,
          is_scheduled: true,
          is_replacement: false,
          not_scheduled_rest: false,
          is_shift_pending: shiftStat === "upcoming" && rec.status === "absent",
        };
      }
      return {
        employee_id: -1,
        matricule: e.employee_matricule ?? "",
        full_name: e.employee_name,
        department: departmentMap.get(e.employee_matricule ?? "") ?? "—",
        project: projectMap.get(e.employee_matricule ?? "") ?? "—",
        status: (shiftStat === "upcoming" ? "pending" : "absent") as any,
        is_late_api: false,
        late_label_api: null,
        computed_late_minutes: 0,
        overtime_minutes: 0,
        compensation: { late_min: 0, overtime_min: 0, compensated_min: 0, remaining_min: 0, is_compensated: false, has_overtime: false },
        deficit_minutes: 0,
        in_time: null,
        out_time: null,
        worked_minutes: 0,
        expected_minutes: workDayMinutes(effectiveSchedule),
        email: emailMap.get(e.employee_matricule ?? "") ?? null,
        shift_team: selectedTeam,
        shift_team_label: SHIFT_TEAMS.find((t) => t.key === selectedTeam)?.label ?? "",
        is_scheduled: true,
        is_replacement: false,
        not_scheduled_rest: false,
        is_shift_pending: shiftStat === "upcoming",
        team_id: e.team_id ?? "",
        replaced_by: null,
      } satisfies FlatRecord;
    });
  }, [selectedTeam, todayPlanning, allRecords, effectiveSchedule, emailMap, departmentMap, projectMap]);

  // ── FILTRE PRINCIPAL ─────────────────────────
  // "Toutes"   → uniquement les pointages temps réel (allRecords)
  // Shift tab  → uniquement les employés du planning pour ce shift/date
  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase();
    const base: FlatRecord[] = selectedTeam ? shiftPlanningBase : allRecords;

    return base.filter((r) => {
      if (!matchSearch(r, q)) return false;
      if (statusFilter === "late") return isLateRecord(r);
      if (statusFilter === "deficit") return r.deficit_minutes > 0;
      if (statusFilter === "absent") return r.status === "absent";
      if (statusFilter !== "all") return r.status === statusFilter;
      return true;
    });
  }, [shiftPlanningBase, allRecords, statusFilter, searchQ, selectedTeam]);

  // ── KPIs des boutons shift ──────────────────────────────────────────
  const planningKpis = useMemo((): Record<ShiftTeamKey, { total: number; present: number; absent: number }> => {
    const empty = { total: 0, present: 0, absent: 0 };
    if (!todayPlanning.loaded) return { jour: empty, soir1: empty, soir2: empty };
    const result = {} as Record<ShiftTeamKey, { total: number; present: number; absent: number }>;
    for (const key of (["jour", "soir1", "soir2"] as ShiftTeamKey[])) {
      const emps = todayPlanning[key] ?? [];
      let present = 0;
      for (const e of emps) {
        const rec = allRecords.find((r) =>
          (e.employee_matricule && r.matricule && r.matricule === e.employee_matricule) ||
          r.full_name.toLowerCase().trim() === e.employee_name.toLowerCase().trim()
        );
        if (rec && rec.status !== "absent") present++;
      }
      result[key] = { total: emps.length, present, absent: emps.length - present };
    }
    return result;
  }, [todayPlanning, allRecords]);

  // ── KPI Cards ───────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (viewMode === "daily" && shiftData) {
      // Base : planning du shift ou pointages temps réel selon le contexte
      const base = selectedTeam ? shiftPlanningBase : allRecords;
      return {
        total: base.length,
        absent: base.filter((r) => r.status === "absent" && !r.is_shift_pending).length,
        late: base.filter(isLateRecord).length,
        anomaly: base.filter((r) => r.status === "anomaly").length,
      };
    }
    const teamRows = selectedTeam ? summaryRecords.filter((r) => r.shift_team === selectedTeam) : summaryRecords;
    return { total: teamRows.length, absent: 0, late: 0, anomaly: 0 };
  }, [viewMode, shiftData, allRecords, shiftPlanningBase, summaryRecords, selectedTeam]);

  const noPlanningToday = viewMode === "daily" && todayPlanning.loaded && (
    selectedTeam
      ? shiftPlanningBase.length === 0
      : todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length === 0
  );

  const notScheduledRows = useMemo(() => {
    const q = searchQ.toLowerCase();
    return allRecords.filter((r) => r.not_scheduled_rest && matchSearch(r, q));
  }, [allRecords, searchQ]);

  const [showPendingShifts, setShowPendingShifts] = useState(true);
  const pendingShiftRows = useMemo(() => {
    const q = searchQ.toLowerCase();
    return allRecords.filter((r) => {
      if (r.not_scheduled_rest) return false;
      if (r.is_shift_pending) return matchSearch(r, q);
      if (!r.in_time && r.status === "absent" && r.shift_team && getShiftActiveStatus(r.shift_team) === "upcoming")
        return matchSearch(r, q);
      return false;
    });
  }, [allRecords, searchQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const filterCount = (key: StatusFilter) => {
    // Même base que filtered, mais sans le filtre de statut (pour les compteurs)
    const base: FlatRecord[] = selectedTeam ? shiftPlanningBase : allRecords;
    if (key === "all") return base.length;
    if (key === "late") return base.filter(isLateRecord).length;
    if (key === "deficit") return base.filter((r) => r.deficit_minutes > 0).length;
    if (key === "absent") return base.filter((r) => r.status === "absent").length;
    if (key === "pending") return base.filter((r) => r.status === "pending").length;
    return base.filter((r) => r.status === key).length;
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

  const activeTeamCfg = SHIFT_TEAMS.find((t) => t.key === selectedTeam);
  const tableHeaders = ["Matricule", "Nom", "Projet/Département", "Service", "Équipe", "Statut", "Retard", "Entrée", "Sortie", "Heure travaillée", "HS (>départ)", "Compensation", "Actions"];

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
              {todayPlanning.loaded && (todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full ring-1 ring-green-200">
                  <CalendarRange className="h-3 w-3" />
                  Planning actif · {todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length} assignés
                </span>
              )}
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
            <button onClick={() => fetchData()}
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
            const isActive = selectedTeam === team.key;
            const pkpi = planningKpis[team.key];
            const hasPlanning = todayPlanning.loaded && pkpi && pkpi.total > 0;
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
                {hasPlanning ? (
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span className={`text-xs font-bold tabular-nums ${isActive ? team.activeText : "text-slate-600"}`}>
                      {pkpi.present}/{pkpi.total}
                    </span>
                    {pkpi.absent > 0 && (
                      <span className="text-[9px] font-bold text-red-500 tabular-nums leading-none">
                        {pkpi.absent} abs
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-300 shrink-0">0/0</span>
                )}
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

            <div className="flex-1 min-h-0 flex gap-3">
              {todayPlanning.loaded && (todayPlanning.jour.length + todayPlanning.soir1.length + todayPlanning.soir2.length) > 0 && (
                <div className="w-60 xl:w-72 shrink-0 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hidden lg:flex">
                  <TodayPlanningPanel todayPlanning={todayPlanning} allRecords={allRecords} loading={loading} />
                </div>
              )}

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
                          : <tr><td colSpan={tableHeaders.length} className="text-center py-16 text-slate-400 text-sm">
                            {noPlanningToday && statusFilter === "all" && !selectedTeam
                              ? <div className="flex flex-col items-center gap-3">
                                <CalendarRange className="h-12 w-12 text-slate-200" />
                                <p className="font-medium text-slate-500">Pas de planning disponible pour aujourd'hui</p>
                                <p className="text-xs text-slate-400">Importez un planning pour voir les assignations de l'équipe.</p>
                                <button onClick={() => setPlanningOpen(true)}
                                  className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-800 transition">
                                  <Upload className="h-4 w-4" /> Importer un planning
                                </button>
                              </div>
                              : noPlanningToday && statusFilter === "all" && selectedTeam
                                ? <div className="flex flex-col items-center gap-3">
                                    <CalendarRange className="h-12 w-12 text-slate-200" />
                                    <p className="font-medium text-slate-500">
                                      Aucun employé planifié pour le shift {SHIFT_TEAMS.find(t => t.key === selectedTeam)?.short} aujourd'hui
                                    </p>
                                    <p className="text-xs text-slate-400">Importez un planning incluant la date d'aujourd'hui.</p>
                                    <button onClick={() => setPlanningOpen(true)}
                                      className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-800 transition">
                                      <Upload className="h-4 w-4" /> Importer un planning
                                    </button>
                                  </div>
                              : statusFilter === "late" ? "Aucun retard." : statusFilter === "deficit" ? "Aucune heure manquante." : "Aucun enregistrement trouvé."}
                          </td></tr>
                      }
                    </tbody>
                  </table>
                </div>

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

                {!selectedTeam && pendingShiftRows.length > 0 && (
                  <div className="shrink-0 rounded-xl border border-blue-200 overflow-hidden shadow-sm">
                    <button
                      onClick={() => setShowPendingShifts((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-sm text-blue-700">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`h-4 w-4 text-blue-400 transition-transform ${showPendingShifts ? "rotate-180" : ""}`} />
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span className="font-semibold text-blue-800">Shifts à venir — En attente de pointage</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-200 text-blue-700">
                          {pendingShiftRows.length}
                        </span>
                        <span className="text-xs text-blue-500">— Non comptés dans les absences</span>
                      </div>
                    </button>
                    {showPendingShifts && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white">
                          <tbody className="divide-y divide-blue-50">
                            {pendingShiftRows.map((r) => (
                              <tr key={r.employee_id} className="bg-blue-50/30 text-sm">
                                <td className="px-4 py-2.5 font-mono text-xs text-slate-400 w-24">{r.matricule || "—"}</td>
                                <td className="px-4 py-2.5 font-medium text-slate-700">{r.full_name}</td>
                                <td className="px-4 py-2.5 text-xs text-slate-500">{r.department !== "—" ? r.department : "—"}</td>
                                <td className="px-4 py-2.5"><ShiftTeamPill teamKey={r.shift_team} /></td>
                                <td className="px-4 py-2.5">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 ring-1 ring-blue-200 whitespace-nowrap">
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />En attente
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <button onClick={() => { setSelectedEmployeeId(r.employee_id); setDetailModalOpen(true); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition">
                                    Détail
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {notScheduledRows.length > 0 && (
                  <div className="shrink-0 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <button
                      onClick={() => setShowNotScheduled((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showNotScheduled ? "rotate-180" : ""}`} />
                        <span className="font-semibold text-slate-700">Non planifiés ce jour</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600">
                          {notScheduledRows.length}
                        </span>
                        <span className="text-xs text-slate-400">— Pas de service · non comptés dans les absences</span>
                      </div>
                    </button>
                    {showNotScheduled && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white">
                          <tbody className="divide-y divide-slate-100">
                            {notScheduledRows.map((r) => (
                              <tr key={r.employee_id} className="bg-slate-50/60 text-sm">
                                <td className="px-4 py-2.5 font-mono text-xs text-slate-400 w-24">{r.matricule || "—"}</td>
                                <td className="px-4 py-2.5 font-medium text-slate-700">{r.full_name}</td>
                                <td className="px-4 py-2.5 text-xs text-slate-500">{r.department !== "—" ? r.department : "—"}</td>
                                <td className="px-4 py-2.5"><ShiftTeamPill teamKey={r.shift_team} /></td>
                                <td className="px-4 py-2.5"><RestDayBadge /></td>
                                <td className="px-4 py-2.5">
                                  <button onClick={() => { setSelectedEmployeeId(r.employee_id); setDetailModalOpen(true); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition">
                                    Détail
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
            getShiftPlanningForDate(todayISO()).then((res) => {
              setTodayPlanning({ ...res.assignments, loaded: true });
            }).catch(console.error);
          }}
          employeeNameToMatricule={employeeNameToMatricule}
        />
      </motion.div>
    </AppLayout>
  );
}