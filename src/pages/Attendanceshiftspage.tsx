import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { useAuth } from "@/contexts/useAuth";
import {
  Clock, AlertTriangle, UserMinus, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2, ChevronDown,
  Check, Settings, CheckCircle, Lock, CalendarDays, Filter,
  TrendingUp, Pencil, Plus, Trash2, Upload, CalendarRange, ArrowLeftRight, ArrowRight,
  Table2,
} from "lucide-react";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import {
  getShiftDailyStats, getShiftPeriodStats, getEmployeePeriodDetail, getWeeklyStats, getMonthlyStats,
  getShiftSchedule, saveShiftSchedule, uploadShiftPlanning,
  getShiftPlanning, deleteSinglePlanningEntry, addSinglePlanningEntry,
  updateAttendanceRecord, sendAttendanceAlert, getAttendanceMonthlyDetail,
} from "@/services/attendanceService";
import type { MonthlyDetailResponse } from "@/services/attendanceService";
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
import * as XLSX from "xlsx-js-style";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import { onEmployeesSynced } from "@/utils/employeeSync";

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

type StatusFilter = "all" | "ok" | "absent" | "on_leave" | "on_mission" | "incomplete" | "anomaly" | "late" | "deficit";
type MotifType = "absent" | "not_pointing";
type AssignmentMap = Record<string, ShiftTeamKey | null>;
type ViewMode = "daily" | "weekly" | "monthly";
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
  { key: "all"       as StatusFilter, label: "Tous",         dotColor: "bg-slate-400",  activeText: "text-slate-800",   activeBg: "bg-slate-900", activeDot: "bg-white"         },
  { key: "ok"        as StatusFilter, label: "OK",           dotColor: "bg-emerald-400",activeText: "text-emerald-700", activeBg: "bg-emerald-50",activeDot: "bg-emerald-500"   },
  { key: "absent"    as StatusFilter, label: "Absents",      dotColor: "bg-red-400",    activeText: "text-red-700",     activeBg: "bg-red-50",    activeDot: "bg-red-500"       },
  { key: "on_leave"  as StatusFilter, label: "En Congé",    dotColor: "bg-sky-400",    activeText: "text-sky-700",     activeBg: "bg-sky-50",    activeDot: "bg-sky-500"       },
  { key: "on_mission"as StatusFilter, label: "En Mission",   dotColor: "bg-indigo-400", activeText: "text-indigo-700",  activeBg: "bg-indigo-50", activeDot: "bg-indigo-500"    },
  { key: "late"      as StatusFilter, label: "Retards",      dotColor: "bg-orange-400", activeText: "text-orange-700",  activeBg: "bg-orange-50", activeDot: "bg-orange-500"    },
  { key: "incomplete"as StatusFilter, label: "Incomplets",   dotColor: "bg-amber-400",  activeText: "text-amber-800",   activeBg: "bg-amber-50",  activeDot: "bg-amber-500"     },
  { key: "anomaly"   as StatusFilter, label: "Anomalies",    dotColor: "bg-violet-400", activeText: "text-violet-700",  activeBg: "bg-violet-50", activeDot: "bg-violet-500"    },
  { key: "deficit"   as StatusFilter, label: "Heures moins", dotColor: "bg-rose-400",   activeText: "text-rose-700",    activeBg: "bg-rose-50",   activeDot: "bg-rose-500"      },
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
  if (!rows.length) {
    alert("Aucune donnée à exporter.");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const headers = rows[0] ? Object.keys(rows[0]) : [];

  // ── Style en-têtes : fond bleu Camusat, texte blanc, gras, centré ──────────
  const headerStyle = {
    font:      { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill:      { fgColor: { rgb: "003C71" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: false },
    border: {
      bottom: { style: "thin", color: { rgb: "FFFFFF" } },
      right:  { style: "thin", color: { rgb: "FFFFFF" } },
    },
  };

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cell]) ws[cell].s = headerStyle;
  }

  // ── Style lignes de données : alternance blanc / bleu très clair ───────────
  const rowStyleEven = { fill: { fgColor: { rgb: "EBF2FA" } }, font: { sz: 10 } };
  const rowStyleOdd  = { fill: { fgColor: { rgb: "FFFFFF" } }, font: { sz: 10 } };

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = XLSX.utils.encode_cell({ r, c });
      if (ws[cell]) ws[cell].s = r % 2 === 0 ? rowStyleEven : rowStyleOdd;
    }
  }

  // ── Largeur auto des colonnes ──────────────────────────────────────────────
  ws["!cols"] = headers.map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2,
  }));

  XLSX.utils.book_append_sheet(wb, ws, "Pointages");
  XLSX.writeFile(wb, `${filename}_${todayISO()}.xlsx`);
}

// ─── Export mensuel détaillé (2 feuilles) ────────────────────────────────────
const STATUS_LABELS_FR: Record<string, string> = {
  ok:          "Présent",
  absent:      "Absent",
  on_leave:    "En congé",
  on_mission:  "En mission",
  incomplete:  "Incomplet",
  anomaly:     "Anomalie",
  not_working: "Repos",
};

function fmtMin(min: number): string {
  if (!min) return "—";
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  const sign = min < 0 ? "-" : "";
  return `${sign}${h}h${m.toString().padStart(2, "0")}`;
}

function _xlsxApplyTableStyle(
  ws: XLSX.WorkSheet,
  rows: Record<string, any>[],
  headers: string[],
) {
  const headerStyle = {
    font:      { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
    fill:      { fgColor: { rgb: "003C71" } },
    alignment: { horizontal: "center", vertical: "center" },
    border:    { bottom: { style: "thin", color: { rgb: "FFFFFF" } }, right: { style: "thin", color: { rgb: "FFFFFF" } } },
  };
  const even = { fill: { fgColor: { rgb: "EBF2FA" } }, font: { sz: 10 } };
  const odd  = { fill: { fgColor: { rgb: "FFFFFF" } }, font: { sz: 10 } };
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cell]) ws[cell].s = headerStyle;
  }
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = XLSX.utils.encode_cell({ r, c });
      if (ws[cell]) ws[cell].s = r % 2 === 0 ? even : odd;
    }
  }
  ws["!cols"] = headers.map((k) => ({
    wch: Math.max(k.length, ...rows.map((row) => String(row[k] ?? "").length)) + 2,
  }));
}

function exportMonthlyDetailXLSX(data: MonthlyDetailResponse, label: string) {
  const wb = XLSX.utils.book_new();

  // ── Feuille 1 : Récapitulatif ──────────────────────────────────────────────
  const summHeaders = [
    "Matricule", "Nom", "Service",
    "Jours présents", "Jours absents", "Congés", "En mission", "Incomplets", "Anomalies",
    "H. travaillées", "H. attendues", "Delta", "Jours retard",
  ];
  const summRows = data.employees.map((emp) => ({
    "Matricule":       emp.matricule ?? "—",
    "Nom":             emp.full_name,
    "Service":         emp.service ?? "—",
    "Jours présents":  emp.summary.present_days,
    "Jours absents":   emp.summary.absent_days,
    "Congés":          emp.summary.on_leave_days,
    "En mission":      emp.summary.on_mission_days,
    "Incomplets":      emp.summary.incomplete_days,
    "Anomalies":       emp.summary.anomaly_days,
    "H. travaillées":  fmtMin(emp.summary.worked_minutes),
    "H. attendues":    fmtMin(emp.summary.expected_minutes),
    "Delta":           fmtMin(emp.summary.delta_minutes),
    "Jours retard":    emp.days.filter((d) => d.late_minutes > 0).length,
  }));
  const wsSumm = XLSX.utils.json_to_sheet(summRows);
  _xlsxApplyTableStyle(wsSumm, summRows, summHeaders);
  XLSX.utils.book_append_sheet(wb, wsSumm, "Récapitulatif");

  // ── Feuille 2 : Détail journalier ──────────────────────────────────────────
  const detHeaders = [
    "Nom", "Matricule", "Service",
    "Date", "Jour", "Entrée", "Sortie", "Durée", "Retard", "Statut",
  ];
  const detRows: Record<string, any>[] = [];
  for (const emp of data.employees) {
    for (const d of emp.days) {
      detRows.push({
        "Nom":       emp.full_name,
        "Matricule": emp.matricule ?? "—",
        "Service":   emp.service ?? "—",
        "Date":      new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR"),
        "Jour":      d.weekday,
        "Entrée":    d.in_time  ?? "—",
        "Sortie":    d.out_time ?? "—",
        "Durée":     d.worked_minutes > 0 ? fmtMin(d.worked_minutes) : "—",
        "Retard":    d.late_minutes > 0 ? fmtMin(d.late_minutes) : "—",
        "Statut":    STATUS_LABELS_FR[d.status] ?? d.status,
      });
    }
  }
  const wsDet = XLSX.utils.json_to_sheet(detRows);
  _xlsxApplyTableStyle(wsDet, detRows, detHeaders);
  XLSX.utils.book_append_sheet(wb, wsDet, "Détail journalier");

  XLSX.writeFile(wb, `pointages_${label}_${todayISO()}.xlsx`);
}

// ─── Helpers période ─────────────────────────────────────────────────────────
function isoWeekBounds(ws: string) {
  const [y, wn] = ws.split("-W").map(Number);
  const fw = new Date(y, 0, 1);
  fw.setDate(fw.getDate() + (wn - 1) * 7 - fw.getDay() + 1);
  const lw = new Date(fw); lw.setDate(lw.getDate() + 6);
  return { start: fw.toISOString().split("T")[0], end: lw.toISOString().split("T")[0] };
}
function isoMonthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  return { start, end };
}

// ─── Colonnes export personnalisé ─────────────────────────────────────────────
const SHIFT_DAILY_COLS  = ["Matricule","Nom","Projet","Département","Statut","Retard","Entrée","Sortie","Heure travaillée","Compensation","Email"] as const;
const SHIFT_SUMM_COLS   = ["Matricule","Nom","Projet","Département","Jours présents","Jours absents","Jours retard","Jours anomalie","Heures travaillées","Heures attendues","Delta","% quota"] as const;
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

// ============================================================================
// COMPOSANT: ExcelPlanningTable
// Reproduit EXACTEMENT le design du fichier Excel Planning_NOC_2026.xlsx :
//   - En-tête vert foncé avec dates DD/MM/YYYY
//   - Colonne SHIFT verticale avec rowspan
//   - Fond jaune #FFFF00 pour équipe jaune, blanc pour équipe blanche
//   - Police Calibri 11px, bordures grises
//   - Blocs de 7 jours séparés
// ============================================================================

function ExcelPlanningTable({ entries, nameToMatricule }: { entries: PlanningEntry[]; nameToMatricule?: Map<string, string> }) {
  const EXCEL_GREEN = "#1a5c2a";
  const EXCEL_BORDER = "#bdbdbd";

  // Construire les blocs de semaine à partir des entrées.
  // On regroupe par blocs de 7 dates consécutives (ordre trié),
  // puis pour chaque bloc, on reconstitue les 3 sections de shifts
  // avec les row_slot pour préserver l'ordre exact de l'Excel.
  const weekBlocks = useMemo(() => {
    // Collecter toutes les dates distinctes triées
    const dateSet = new Set(entries.map(e => e.date));
    const allDates = Array.from(dateSet).sort();
    const chunks: string[][] = [];
    for (let i = 0; i < allDates.length; i += 7) chunks.push(allDates.slice(i, i + 7));

    const SHIFT_ORDER: ShiftTeamKey[] = ["jour", "soir1", "soir2"];
    const SHIFT_LABELS: Record<string, string> = {
      jour: "08H-16H",
      soir1: "16H-22H",
      soir2: "22H-08H",
    };

    return chunks.map(dates => ({
      dates,
      shifts: SHIFT_ORDER.map(shiftKey => {
        // Toutes les entrées de ce shift pour ces dates
        const shiftEntries = entries.filter(e => e.shift_type === shiftKey && dates.includes(e.date));

        // Grouper par row_slot pour reconstruire les lignes
        const slotMap = new Map<number, Map<string, { name: string; bg: string | null }>>();
        for (const e of shiftEntries) {
          const slot = e.row_slot ?? 0;
          if (!slotMap.has(slot)) slotMap.set(slot, new Map());
          const bg = (e.team_id && e.team_id.startsWith("#")) ? e.team_id : null;
          slotMap.get(slot)!.set(e.date, { name: e.employee_name, bg });
        }

        const rows = Array.from(slotMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([, cellMap]) => {
            const cells: Record<string, { name: string; bg: string | null }> = {};
            cellMap.forEach((v, k) => { cells[k] = v; });
            return cells;
          });

        return { shiftKey, label: SHIFT_LABELS[shiftKey] ?? shiftKey, rows };
      }).filter(s => s.rows.length > 0),
    }));
  }, [entries]);

  if (weekBlocks.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>
        Aucune donnée à afficher
      </div>
    );
  }

  // ── Styles inline fidèles à Excel ──
  const base: React.CSSProperties = {
    fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
    fontSize: "11px",
    border: `1px solid ${EXCEL_BORDER}`,
    padding: "3px 8px",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    height: "auto",
    minHeight: "22px",
  };

  const hdrStyle: React.CSSProperties = {
    ...base,
    backgroundColor: EXCEL_GREEN,
    color: "#ffffff",
    fontWeight: 700,
    textAlign: "center",
    minWidth: "140px",
    padding: "5px 8px",
  };

  const cornerStyle: React.CSSProperties = {
    ...base,
    backgroundColor: EXCEL_GREEN,
    color: "#ffffff",
    fontWeight: 700,
    textAlign: "center",
    width: "36px",
    minWidth: "36px",
    padding: "5px 4px",
  };

  const shiftCellStyle: React.CSSProperties = {
    ...base,
    backgroundColor: EXCEL_GREEN,
    color: "#ffffff",
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    width: "36px",
    minWidth: "36px",
    padding: "2px",
    writingMode: "vertical-lr",
    transform: "rotate(180deg)",
    letterSpacing: "0.05em",
    fontSize: "10px",
  };

  const dataStyle = (bg: string | null): React.CSSProperties => ({
    ...base,
    backgroundColor: bg ?? "#ffffff",
    color: "#000000",
    minWidth: "140px",
    height: "auto",
    verticalAlign: "middle",
    padding: "3px 8px",
  });

  const emptyStyle: React.CSSProperties = {
    ...base,
    backgroundColor: "#ffffff",
    minWidth: "140px",
    height: "auto",
  };

  const fmtDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  return (
    <div style={{ padding: "12px 16px", overflowX: "auto", minHeight: "100%" }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "auto" }}>
        <tbody>
          {weekBlocks.map((block, bi) => (
            <React.Fragment key={bi}>
              {/* ── En-tête de bloc : SHIFT | DD/MM/YYYY × 7 ── */}
              <tr>
                <td style={cornerStyle}>SHIFT</td>
                {block.dates.map(date => (
                  <td key={date} style={hdrStyle}>{fmtDate(date)}</td>
                ))}
              </tr>

              {/* ── Lignes par shift ── */}
              {block.shifts.map(({ shiftKey, label, rows }) =>
                rows.map((cells, rowIdx) => (
                  <tr key={`${shiftKey}-${rowIdx}`}>
                    {/* Cellule shift verticale avec rowSpan sur toute la section */}
                    {rowIdx === 0 && (
                      <td rowSpan={rows.length} style={shiftCellStyle}>
                        {label}
                      </td>
                    )}
                    {/* Cellules employés */}
                    {block.dates.map(date => {
                      const cell = cells[date];
                      if (!cell) return <td key={date} style={emptyStyle} />;
                      const mat = nameToMatricule?.get(cell.name.trim().toLowerCase().replace(/\s+/g, ' '));
                      return (
                        <td key={date} style={dataStyle(cell.bg)}>
                          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                            <span style={{ fontWeight: 600, fontSize: "11px" }}>{cell.name}</span>
                            {mat && (
                              <span style={{ fontSize: "9px", color: "#64748b", fontFamily: "monospace", marginTop: "1px" }}>
                                {mat}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}

              {/* Séparateur visuel entre blocs */}
              <tr>
                <td
                  colSpan={block.dates.length + 1}
                  style={{ height: "8px", border: "none", backgroundColor: "#f0f0f0" }}
                />
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
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
    <>
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
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
                <div className="px-6 py-5 space-y-3 max-h-[70vh] sm:max-h-[65vh] overflow-y-auto">
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
                            <button onClick={() => openForm(preset)} title="Modifier" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-camublue-900 transition"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setDeleteConfirm(preset.context)} title="Supprimer" disabled={isActive}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-2 sm:gap-3 shrink-0">
                  <button onClick={() => openForm()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition shrink-0">
                    <Plus className="h-4 w-4" /><span className="hidden xs:inline">Nouveau</span>
                  </button>
                  <button onClick={onClose} className="flex-1 min-w-[80px] rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">Fermer</button>
                  <button onClick={() => setView("period")} disabled={presets.length === 0}
                    className="flex-1 min-w-[120px] rounded-2xl bg-camublue-900 hover:bg-camublue-800 text-white px-3 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <CalendarDays className="h-4 w-4" /><span className="truncate">Assigner une période</span>
                  </button>
                </div>
              </>
            )}

            {view === "period" && (
              <>
                <div className="px-6 py-5 space-y-5 max-h-[70vh] sm:max-h-[65vh] overflow-y-auto">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
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
                <div className="px-6 py-5 space-y-4 max-h-[70vh] sm:max-h-[65vh] overflow-y-auto">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Nom du contexte</label>
                    <input value={fContext} onChange={(e) => setFContext(e.target.value)} placeholder="Ex: Été, Nuit, Hiver…"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none font-semibold" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Horaires</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
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
                <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
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

    <ConfirmDeleteModal
      open={deleteConfirm !== null}
      title="Supprimer ce preset ?"
      message={
        deleteConfirm
          ? <>Le preset <strong>{deleteConfirm}</strong> sera <strong>définitivement supprimé</strong>. Cette action est irréversible.</>
          : null
      }
      onClose={() => setDeleteConfirm(null)}
      onConfirm={() => deleteConfirm && handleDeletePreset(deleteConfirm)}
    />
    </>
  );
}

// ============================================================================
// COMPOSANT: DetailModal
// ============================================================================

const FR_WEEKDAYS_DETAIL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function DetailModal({ open, onClose, employeeId, initialWeek }: {
  open: boolean; onClose: () => void; employeeId: number | null; initialWeek: string;
}) {
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [loading, setLoading] = useState(false);
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [selWeek, setSelWeek] = useState(initialWeek);
  const [selMonth, setSelMonth] = useState(yyyyMmToday());

  const weekBounds = (ws: string) => {
    const [y, wn] = ws.split("-W").map(Number);
    const fw = new Date(y, 0, 1);
    fw.setDate(fw.getDate() + (wn - 1) * 7 - fw.getDay() + 1);
    const lw = new Date(fw); lw.setDate(lw.getDate() + 6); // Lun → Dim
    return { start: fw.toISOString().split("T")[0], end: lw.toISOString().split("T")[0] };
  };

  const monthBounds = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  };

  const fetchPointages = useCallback(async () => {
    if (!employeeId || !open) return;
    setLoading(true);
    try {
      const { start, end } = periodType === "weekly" ? weekBounds(selWeek) : monthBounds(selMonth);
      const res: EmployeePeriodDetailResponse = await getEmployeePeriodDetail({ employee_id: employeeId, start, end });
      const entries: Pointage[] = [];
      const startDate = new Date(start + "T00:00:00");
      const endDate   = new Date(end   + "T00:00:00");
      for (let cur = new Date(startDate); cur <= endDate; cur.setDate(cur.getDate() + 1)) {
        const ds = cur.toISOString().split("T")[0];
        const dd = res.days.find((d: DayDetail) => d.date === ds);
        const dayLabel = periodType === "weekly"
          ? ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][cur.getDay() === 0 ? 6 : cur.getDay() - 1]
          : FR_WEEKDAYS_DETAIL[cur.getDay()];
        const rawStatus = dd?.status ?? "absent";
        const status: Pointage["status"] = rawStatus === "not_working" ? "not_working" : (rawStatus as Pointage["status"]);
        entries.push({ day: dayLabel, date: ds, in_time: dd?.in_time ?? null, out_time: dd?.out_time ?? null, status, is_planned: (dd as any)?.is_planned ?? true });
      }
      setPointages(entries);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [employeeId, selWeek, selMonth, periodType, open]);

  useEffect(() => { fetchPointages(); }, [fetchPointages]);

  const handleExport = () => {
    if (!pointages.length) return;
    const label = periodType === "weekly" ? selWeek : selMonth;
    exportXLSX(`pointages_shift_${label}`, pointages.map((p) => ({
      Jour: p.day,
      Date: new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }),
      Statut: STATUS_CFG[p.status as keyof typeof STATUS_CFG]?.label ?? p.status,
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
              {/* Sélecteur + actions */}
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
                    const rowBg = p.status === "ok" ? "bg-white border-slate-100"
                      : p.status === "not_working" ? "bg-slate-50 border-slate-200 opacity-70"
                      : "bg-rose-50 border-rose-100";
                    return (
                      <div key={i} className={`rounded-xl border p-3 ${rowBg}`}>
                        {/* Desktop */}
                        <div className="hidden sm:grid grid-cols-5 gap-4 items-center">
                          <span className="font-medium text-sm text-slate-800">{p.day}</span>
                          <span className="text-sm text-slate-600">
                            {new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </span>
                          <span><StatusPill status={p.status} /></span>
                          <span className={`text-sm ${p.in_time ? "text-slate-700" : "text-slate-400"}`}>{p.in_time ? formatTime(p.in_time) : "—"}</span>
                          <span className={`text-sm ${p.out_time ? "text-slate-700" : "text-slate-400"}`}>{p.out_time ? formatTime(p.out_time) : "—"}</span>
                        </div>
                        {/* Mobile */}
                        <div className="sm:hidden flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-slate-800">
                            {p.day} · {new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                          </span>
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

// ============================================================================
// COMPOSANT: PlanningUploadModal
// ============================================================================

interface PlanningUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  employeeNameToMatricule: Map<string, string>;
}

function PlanningUploadModal({ open, onClose, onSuccess, employeeNameToMatricule }: PlanningUploadModalProps) {
  const [tab, setTab] = useState<"view" | "import">("view");
  const [viewMonth, setViewMonth] = useState(yyyyMmToday());
  const [entries, setEntries] = useState<PlanningEntry[]>([]);
  const [loadingVue, setLoadingVue] = useState(false);
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
    if (open) { setFile(null); setPreview([]); setParsedSheets([]); setError(""); setUploaded(false); }
  }, [open]);

  const hasAnyData = entries.length > 0;
  const [y, m] = viewMonth.split("-").map(Number);

  const handleFile = (f: File | null) => {
    if (!f) { setFile(null); setPreview([]); setParsedSheets([]); return; }
    setFile(f); setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { entries: parsed, sheets } = parseNOCPlanningExcel(ev.target!.result as ArrayBuffer);
        if (!parsed.length) {
          setError("Aucune entrée valide trouvée. Formats acceptés : grille NOC ou colonnes Date/Shift/Nom.");
          setPreview([]); setParsedSheets([]);
          return;
        }
        const enriched = parsed.map(entry => ({
          ...entry,
          employee_matricule: entry.employee_matricule || employeeNameToMatricule.get(
            entry.employee_name.trim().toLowerCase().replace(/\s+/g, ' ')
          ) || null
        }));
        setPreview(enriched);
        setParsedSheets(sheets);
      } catch (err: any) {
        console.error("[PlanningUploadModal] parse error:", err);
        setError(`Erreur lors de la lecture du fichier Excel${err?.message ? ` : ${err.message}` : ""}.`);
        setPreview([]); setParsedSheets([]);
      }
    };
    reader.onerror = () => {
      console.error("[PlanningUploadModal] FileReader error:", reader.error);
      setError("Impossible de lire le fichier sélectionné.");
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
    } catch (err: any) {
      console.error("[PlanningUploadModal] upload error:", err);
      const detail = err?.response?.data?.detail || err?.message;
      setError(`Erreur lors de l'envoi du planning${detail ? ` : ${detail}` : ""}. Réessayez.`);
    } finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const c: Record<string, number> = { jour: 0, soir1: 0, soir2: 0 };
    preview.forEach((e) => { if (e.shift_type in c) c[e.shift_type]++; });
    const dates = new Set(preview.map((e) => e.date));
    const teams = new Set(preview.map((e) => e.team_id).filter(Boolean));
    return { jour: c.jour, soir1: c.soir1, soir2: c.soir2, dates: dates.size, total: preview.length, teams: teams.size };
  }, [preview]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative w-full sm:max-w-[98vw] bg-white sm:rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
            style={{ maxHeight: "calc(100dvh - 1rem)", height: "calc(100dvh - 1rem)" }}
            initial={{ y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-600 text-white"><CalendarRange className="h-4 w-4" /></div>
                <p className="font-bold text-slate-800">Planning des Shifts</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 pt-3 shrink-0 overflow-x-auto">
              {([
                { id: "view", icon: Table2, label: "Vue du planning" },
                { id: "import", icon: Upload, label: "Importer Excel" },
              ] as const).map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${tab === id ? "bg-camublue-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            {/* ── TAB VUE PLANNING — Design Excel identique ── */}
            {tab === "view" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Navigation mois */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                  <button onClick={() => setViewMonth(prevMonth(viewMonth))}
                    className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-500 hover:text-slate-700">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-bold text-slate-800 text-base">{MONTHS_FR[m - 1]} {y}</span>
                    {hasAnyData
                      ? <span className="text-xs text-slate-400">{new Set(entries.map(e => e.date)).size} jours · {entries.length} assignations</span>
                      : <span className="text-xs text-slate-400">Aucun planning ce mois</span>
                    }
                  </div>
                  <button onClick={() => setViewMonth(nextMonth(viewMonth))}
                    className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-500 hover:text-slate-700">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Corps : tableau Excel */}
                <div className="flex-1 overflow-auto bg-white">
                  {loadingVue ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…
                    </div>
                  ) : !hasAnyData ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                      <CalendarRange className="h-14 w-14 text-slate-200" />
                      <p className="text-sm font-medium">Aucun planning importé pour ce mois</p>
                      <button onClick={() => setTab("import")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-800 transition">
                        <Upload className="h-4 w-4" />Importer un planning Excel
                      </button>
                    </div>
                  ) : (
                    // ── Rendu EXACT du design Excel ──
                    <ExcelPlanningTable entries={entries} nameToMatricule={employeeNameToMatricule} />
                  )}
                </div>
              </div>
            )}

            {/* ── TAB IMPORT ── */}
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
  open: boolean; onClose: () => void; employee: FlatRecord | null;
  onConfirm: (m: MotifType, channel: "email" | "sms") => void; sending: boolean;
}) {
  const [motif,   setMotif]   = useState<MotifType>("absent");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  useEffect(() => {
    if (employee) {
      setMotif(employee.status === "absent" ? "absent" : "not_pointing");
      setChannel(employee.email ? "email" : employee.telephone ? "sms" : "email");
    }
  }, [employee]);

  const canSend = channel === "email" ? !!employee?.email : !!employee?.telephone;

  return (
    <AnimatePresence>
      {open && employee && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !sending && onClose()}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm overflow-hidden z-10 max-h-[90vh] flex flex-col"
            initial={{ y: 40, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.97, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div><div className="font-bold text-slate-800">Envoyer une alerte</div><div className="text-xs text-slate-400 mt-0.5 truncate max-w-[230px]">{employee.full_name}</div></div>
              <button onClick={onClose} disabled={sending} className="p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-40"><X className="h-4 w-4 text-slate-400" /></button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Canal : Email / SMS */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Canal d'envoi</p>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button onClick={() => setChannel("email")}
                    className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${channel === "email" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <div className={`p-2 rounded-xl ${channel === "email" ? "bg-blue-100" : "bg-slate-100"}`}><Mail className="h-4 w-4" /></div>
                    <span>Email</span>
                    {employee.email
                      ? <span className="text-[10px] font-mono truncate max-w-full px-1 opacity-70">{employee.email}</span>
                      : <span className="text-[10px] text-red-400 flex items-center gap-0.5"><XCircle className="h-3 w-3" />Aucun</span>}
                  </button>
                  <button onClick={() => setChannel("sms")}
                    className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${channel === "sms" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <div className={`p-2 rounded-xl ${channel === "sms" ? "bg-emerald-100" : "bg-slate-100"}`}><Bell className="h-4 w-4" /></div>
                    <span>SMS</span>
                    {employee.telephone
                      ? <span className="text-[10px] font-mono truncate max-w-full px-1 opacity-70">{employee.telephone}</span>
                      : <span className="text-[10px] text-red-400 flex items-center gap-0.5"><XCircle className="h-3 w-3" />Aucun</span>}
                  </button>
                </div>
              </div>

              {/* Motif */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <p className="col-span-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Motif</p>
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

            <div className="px-5 pb-6 flex gap-3 shrink-0">
              <button onClick={onClose} disabled={sending} className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">Annuler</button>
              <button onClick={() => onConfirm(motif, channel)} disabled={sending || !canSend}
                className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold transition flex items-center justify-center gap-2 ${!canSend ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-camublue-900 hover:bg-camublue-800 text-white"} disabled:opacity-60`}>
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
// COMPOSANT: EditPointageModal  — correction manuelle in_time / out_time
// ============================================================================

function EditPointageModal({ record, date, onClose, onSaved }: {
  record: FlatRecord;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toHHMM = (iso: string | null) => {
    if (!iso) return "";
    // iso peut être "HH:MM:SS" ou datetime ISO complet
    const t = iso.includes("T") ? iso.split("T")[1] : iso;
    return t.slice(0, 5);
  };
  const [inVal,   setInVal]   = useState(toHHMM(record.in_time));
  const [outVal,  setOutVal]  = useState(toHHMM(record.out_time));
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      await updateAttendanceRecord({
        employee_id: record.employee_id,
        date,
        in_time:  inVal  || null,
        out_time: outVal || null,
      });
      onSaved();
      onClose();
    } catch {
      setErr("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}>
        <motion.div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
          initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800">Modifier le pointage</h2>
              <p className="text-xs text-slate-400 mt-0.5">{record.full_name} · {record.matricule} · {date}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {err && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{err}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Entrée</label>
                <input type="time" value={inVal} onChange={(e) => setInVal(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Sortie</label>
                <input type="time" value={outVal} onChange={(e) => setOutVal(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
              </div>
            </div>
            {inVal && outVal && inVal !== outVal && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700 font-semibold">
                Durée calculée : {(() => {
                  const [ih, im] = inVal.split(":").map(Number);
                  const [oh, om] = outVal.split(":").map(Number);
                  const diff = (oh * 60 + om) - (ih * 60 + im);
                  if (diff <= 0) return "⚠️ Heure de sortie avant l'entrée";
                  return `${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, "0")}`;
                })()}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-[2] bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Check className="h-4 w-4" />Enregistrer</>}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// COMPOSANT: TableRow
// ============================================================================

function TableRow({ r, isLate, onAlert, onDetail, onEdit }: {
  r: FlatRecord; isLate: boolean; onAlert: () => void; onDetail: () => void; onEdit: () => void;
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
        <td className="px-2 py-2 lg:px-4 lg:py-3"><div className="flex justify-center font-mono text-slate-500 text-xs">{r.matricule || "—"}</div></td>
        <td className="px-2 py-2 lg:px-4 lg:py-3">
          <div className="flex flex-col items-center gap-0.5">
            {r.replaced_by ? (
              /* Absent avec remplaçant : affiche Absent → Remplaçant */
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className="font-medium text-red-500 text-xs lg:text-sm line-through">{r.full_name}</span>
                <ArrowRight className="h-3 w-3 text-purple-500 shrink-0" />
                <span className="font-semibold text-purple-700 text-xs lg:text-sm">{r.replaced_by}</span>
              </div>
            ) : r.replaces_employee ? (
              /* Remplaçant : affiche Absent → Remplaçant */
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className="font-medium text-red-400 text-xs lg:text-sm line-through">{r.replaces_employee}</span>
                <ArrowRight className="h-3 w-3 text-purple-500 shrink-0" />
                <span className="font-semibold text-purple-700 text-xs lg:text-sm">{r.full_name}</span>
              </div>
            ) : (
              <span className="font-medium text-slate-800 text-xs lg:text-sm">{r.full_name}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2 lg:px-4 lg:py-3 text-xs">
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-semibold text-camublue-900 text-xs">{r.project !== "—" ? r.project : "—"}</span>
            {r.department && r.department !== "—" && (
              <span className="text-[10px] text-slate-400">{r.department}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2 lg:px-4 lg:py-3">
          <div className="flex justify-center">
            {r.not_scheduled_rest ? <RestDayBadge />
              : r.is_shift_pending ? <StatusPill status="pending" />
                : r.is_replacement ? <ReplacementBadge />
                  : <StatusPill status={r.status} />}
          </div>
        </td>
        <td className="px-2 py-2 lg:px-4 lg:py-3"><div className="flex justify-center"><LateBadge minutes={r.computed_late_minutes} /></div></td>
        <td className={`px-2 py-2 lg:px-4 lg:py-3 tabular-nums font-mono text-xs lg:text-sm ${r.is_shift_pending ? "text-blue-400" : r.status === "absent" && !r.replacement_in_time ? "text-red-400" : r.status === "absent" && r.replacement_in_time ? "text-purple-600" : r.computed_late_minutes > 0 ? "text-orange-500 font-semibold" : "text-slate-700"}`}>
          <div className="flex justify-center">
            {/* Pour le shift 22h-08h : l'entrée réelle est out_time (22h) et la sortie réelle est in_time (08h) */}
            {(() => {
              const isSoir2 = r.shift_team === "soir2";
              const dispIn  = isSoir2 ? r.out_time  : r.in_time;
              const dispRIn = isSoir2 ? r.replacement_out_time : r.replacement_in_time;
              return dispIn ? formatTime(dispIn)
                : dispRIn ? <span className="text-purple-600 font-medium" title="Pointage du remplaçant">{formatTime(dispRIn)}</span>
                : r.is_shift_pending ? <span className="text-[10px] text-blue-400 font-medium">En attente</span>
                : r.status === "absent" ? <span className="text-[10px] text-red-400 font-medium">—</span>
                : "—";
            })()}
          </div>
        </td>
        <td className={`px-2 py-2 lg:px-4 lg:py-3 tabular-nums font-mono text-xs lg:text-sm ${r.status === "absent" && r.replacement_out_time ? "text-purple-600" : r.overtime_minutes > 0 ? "text-emerald-600 font-semibold" : "text-slate-700"}`}>
          <div className="flex justify-center">
            {(() => {
              const isSoir2  = r.shift_team === "soir2";
              const dispOut  = isSoir2 ? r.in_time  : r.out_time;
              const dispROut = isSoir2 ? r.replacement_in_time : r.replacement_out_time;
              return dispOut ? formatTime(dispOut)
                : dispROut ? <span className="text-purple-600 font-medium" title="Pointage du remplaçant">{formatTime(dispROut)}</span>
                : formatTime(dispOut);
            })()}
          </div>
        </td>
        <td className="px-2 py-2 lg:px-4 lg:py-3">
          <div className="flex justify-center">
            {r.worked_minutes > 0 ? <WorkedTimeBadge minutes={r.worked_minutes} expectedMin={r.expected_minutes} />
              : r.replacement_worked_minutes ? <WorkedTimeBadge minutes={r.replacement_worked_minutes} expectedMin={r.expected_minutes} />
                : <WorkedTimeBadge minutes={r.worked_minutes} expectedMin={r.expected_minutes} />}
          </div>
        </td>
        <td className="px-2 py-2 lg:px-4 lg:py-3">
          <div className="flex gap-1 lg:gap-2 justify-center">
            <button onClick={onAlert} disabled={r.status !== "absent" || (!r.email && !r.telephone) || r.not_scheduled_rest}
              title="Alerter"
              className={`inline-flex items-center gap-1 px-2 py-1.5 lg:px-3 rounded-lg text-xs font-semibold transition-all ${r.status === "absent" && (r.email || r.telephone) && !r.not_scheduled_rest ? "bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
              <Bell className="h-3 w-3" /><span className="hidden xl:inline">Alerter</span>
            </button>
            <button onClick={onDetail} title="Détail" className="inline-flex items-center gap-1 px-2 py-1.5 lg:px-3 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition">
              <span className="hidden xl:inline">Détail</span><span className="xl:hidden">···</span>
            </button>
          </div>
        </td>
      </tr>
      <tr className={`md:hidden border-b border-slate-100 ${r.is_replacement ? "bg-purple-50/40" : r.not_scheduled_rest ? "bg-slate-50/60 opacity-70" : r.is_shift_pending ? "bg-blue-50/40" : isLate ? "bg-orange-50/40" : deficit ? "bg-rose-50/30" : ""}`}>
        <td colSpan={12} className="px-3 py-2">
          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
            <div className="min-w-0">
              {r.replaced_by ? (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-semibold text-red-500 text-sm line-through">{r.full_name}</span>
                  <ArrowRight className="h-3 w-3 text-purple-500 shrink-0" />
                  <span className="font-semibold text-purple-700 text-sm">{r.replaced_by}</span>
                </div>
              ) : r.replaces_employee ? (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-semibold text-red-400 text-sm line-through">{r.replaces_employee}</span>
                  <ArrowRight className="h-3 w-3 text-purple-500 shrink-0" />
                  <span className="font-semibold text-purple-700 text-sm">{r.full_name}</span>
                </div>
              ) : (
                <p className="font-semibold text-slate-800 text-sm truncate">{r.full_name}</p>
              )}
              <p className="text-xs text-slate-400 font-mono">{r.matricule || "—"} · {r.project !== "—" ? `${r.project} / ` : ""}{r.department}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.not_scheduled_rest ? <RestDayBadge />
                : r.is_shift_pending ? <StatusPill status="pending" />
                  : r.is_replacement ? <ReplacementBadge />
                    : <StatusPill status={r.status} />}
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>
          {expanded && (
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span><span className="text-slate-400">Shift :</span> <ShiftTeamPill teamKey={r.shift_team} /></span>
                <span><span className="text-slate-400">Entrée :</span> {r.shift_team === "soir2" ? (r.out_time ? formatTime(r.out_time) : r.replacement_out_time ? <span className="text-purple-600">{formatTime(r.replacement_out_time)}</span> : "—") : (r.in_time ? formatTime(r.in_time) : r.replacement_in_time ? <span className="text-purple-600">{formatTime(r.replacement_in_time)}</span> : "—")}</span>
                <span><span className="text-slate-400">Sortie :</span> {r.shift_team === "soir2" ? (r.in_time ? formatTime(r.in_time) : r.replacement_in_time ? <span className="text-purple-600">{formatTime(r.replacement_in_time)}</span> : "—") : (r.out_time ? formatTime(r.out_time) : r.replacement_out_time ? <span className="text-purple-600">{formatTime(r.replacement_out_time)}</span> : formatTime(r.out_time))}</span>
                {r.computed_late_minutes > 0 && <LateBadge minutes={r.computed_late_minutes} />}
                {(r.worked_minutes > 0 || (r.replacement_worked_minutes && r.replacement_worked_minutes > 0)) && (
                  <WorkedTimeBadge minutes={r.worked_minutes > 0 ? r.worked_minutes : (r.replacement_worked_minutes ?? 0)} expectedMin={r.expected_minutes} />
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={onAlert} disabled={r.status !== "absent" || (!r.email && !r.telephone) || r.not_scheduled_rest}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${r.status === "absent" && (r.email || r.telephone) && !r.not_scheduled_rest ? "bg-red-50 hover:bg-red-100 text-red-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  <Bell className="h-3 w-3" />Alerter
                </button>
                <button onClick={onDetail} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition">Détail</button>
                <button onClick={onEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200 transition"><Pencil className="h-3 w-3" />Modifier</button>
              </div>
            </div>
          )}
        </td>
      </tr>
    </>
  );
}

// ============================================================================
// COMPOSANT: ExpandedDayTable — Vue détail par jour (recherche hebdo/mensuel)
// ============================================================================

function ExpandedDayTable({ records, dayDetails, isLoading }: {
  records: SummaryRecord[];
  dayDetails: Map<number, DayDetail[]>;
  isLoading: boolean;
}) {
  const headers = ["Nom", "Matricule", "Projet/Dép.", "Date", "Jour", "Entrée", "Sortie", "Statut", "Retard", "H. Travaillées"];
  const statusLabel: Record<string, { label: string; cls: string }> = {
    ok:         { label: "Présent",    cls: "bg-emerald-50 text-emerald-700" },
    absent:     { label: "Absent",     cls: "bg-red-50 text-red-600" },
    incomplete: { label: "Incomplet",  cls: "bg-orange-50 text-orange-600" },
    anomaly:    { label: "Anomalie",   cls: "bg-violet-50 text-violet-700" },
    on_leave:   { label: "Congé",      cls: "bg-blue-50 text-blue-600" },
    on_mission: { label: "Mission",    cls: "bg-sky-50 text-sky-700" },
  };

  const rows: { emp: SummaryRecord; day: DayDetail }[] = [];
  for (const emp of records) {
    const days = dayDetails.get(emp.employee_id) ?? [];
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    for (const day of sorted) {
      rows.push({ emp, day });
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full table-fixed bg-white">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[8%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-camublue-900 text-white">
          <tr>
            {headers.map(h => (
              <th key={h} className="px-3 py-3 text-center text-xs font-semibold tracking-wide border-b border-camublue-800 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-slate-100">
                {headers.map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="text-center py-16 text-slate-400 text-sm">Aucune donnée disponible</td></tr>
          ) : (
            rows.map(({ emp, day }, idx) => {
              const st = statusLabel[day.status] ?? { label: day.status, cls: "bg-slate-50 text-slate-600" };
              const dateObj = new Date(day.date + "T00:00:00");
              const dateStr = dateObj.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
              const jourStr = day.weekday_label ?? ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"][dateObj.getDay()];
              const isFirstOfEmp = idx === 0 || rows[idx - 1].emp.employee_id !== emp.employee_id;
              return (
                <tr key={`${emp.employee_id}-${day.date}`}
                  className={`border-b border-slate-100 text-sm transition-colors ${isFirstOfEmp ? "border-t-2 border-t-camublue-100" : ""} hover:bg-slate-50`}>
                  <td className="px-3 py-2.5 text-center">
                    <span className="font-semibold text-slate-800 text-xs">{emp.full_name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-500">{emp.matricule || "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-semibold text-camublue-900 text-xs leading-tight">{emp.project !== "—" ? emp.project : emp.department !== "—" ? emp.department : "—"}</span>
                      {emp.project !== "—" && emp.department !== "—" && (
                        <span className="text-[10px] text-slate-400 leading-tight">{emp.department}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-600 tabular-nums">{dateStr}</td>
                  <td className="px-3 py-2.5 text-center text-xs font-medium text-slate-500 capitalize">{jourStr}</td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-slate-700">
                    {day.in_time ? formatTime(day.in_time) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-slate-700">
                    {day.out_time ? formatTime(day.out_time) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {day.late_minutes && day.late_minutes > 0
                      ? <LateBadge minutes={day.late_minutes} />
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {day.worked_minutes > 0
                      ? <span className="font-semibold text-emerald-600 text-xs tabular-nums">{formatMinutes(day.worked_minutes)}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// ============================================================================
// COMPOSANT: SummaryTable — Vue hebdomadaire / mensuelle
// ============================================================================

const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function WeekDayBar({ byDay }: { byDay: WeeklyDayEntry[] }) {
  if (!byDay.length) return null;
  const sorted = [...byDay].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="grid grid-cols-7 gap-0.5 sm:gap-1 shrink-0 mb-1">
      {sorted.map(d => {
        const total = d.ok_count + d.absent_count + d.incomplete_count + d.anomaly_count;
        const dateObj = new Date(d.date + "T00:00:00");
        const dayLabel = DAY_SHORT[dateObj.getDay()];
        const dayNum = String(dateObj.getDate()).padStart(2, "0");
        return (
          <div key={d.date} className="bg-white border border-slate-100 rounded-xl p-1 sm:p-2 shadow-sm flex flex-col gap-0.5 sm:gap-1 min-w-0">
            <div className="flex items-baseline gap-0.5 sm:gap-1">
              <span className="text-[8px] sm:text-[10px] font-semibold text-slate-500 uppercase">{dayLabel}</span>
              <span className="text-[10px] sm:text-xs font-bold text-camublue-900">{dayNum}</span>
            </div>
            <div className="flex flex-col gap-0.5 text-[8px] sm:text-[10px]">
              <span className="text-emerald-600 font-semibold">{d.ok_count} <span className="hidden sm:inline">prés.</span></span>
              {d.absent_count > 0 && <span className="text-red-500 font-semibold">{d.absent_count} <span className="hidden sm:inline">abs.</span></span>}
              {d.late_count > 0 && <span className="text-orange-500">{d.late_count} <span className="hidden sm:inline">retard</span></span>}
              {d.anomaly_count > 0 && <span className="text-violet-500">{d.anomaly_count} <span className="hidden sm:inline">anom.</span></span>}
              {total > 0 && <span className="text-slate-300 text-[7px] sm:text-[9px] mt-0.5">{total}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryTable({ rows, mode, isLoading, byDay, onDetail }: {
  rows: SummaryRecord[];
  mode: "weekly" | "monthly";
  isLoading: boolean;
  byDay?: WeeklyDayEntry[];
  onDetail?: (employeeId: number) => void;
}) {
  const MAX_MIN = mode === "weekly" ? MAX_WEEKLY_MIN : Math.round(MAX_WEEKLY_MIN * 4.33);
  const headers = ["Matricule", "Nom", "Projet/Dép.", "Présent", "Absent", "Retard", "Anomalie", "Heures trav.", "Progression", ""];
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {mode === "weekly" && byDay && byDay.length > 0 && (
        <WeekDayBar byDay={byDay} />
      )}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="min-w-full bg-white">
          <thead className="sticky top-0 z-10 bg-camublue-900 text-white">
            <tr>{headers.map(h => <th key={h} className="px-3 py-3 text-center border-b border-white/20 text-xs font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {headers.map((_, j) => <td key={j} className="px-3 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                </tr>
              ))
              : rows.length === 0
                ? <tr><td colSpan={headers.length} className="text-center py-16 text-slate-400 text-sm">Aucune donnée disponible</td></tr>
                : rows.map(r => {
                  const pct = MAX_MIN > 0 ? Math.min(100, Math.round((r.worked_minutes / MAX_MIN) * 100)) : 0;
                  const barCls = pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
                  return (
                    <tr key={`${r.employee_id}-${r.matricule}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-500 text-center">{r.matricule || "—"}</td>
                      <td className="px-3 py-2.5"><span className="font-medium text-slate-800">{r.full_name}</span></td>
                      <td className="px-3 py-2.5 text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-camublue-900 leading-tight">{r.project !== "—" ? r.project : r.department !== "—" ? r.department : "—"}</span>
                          {r.project !== "—" && <span className="text-[10px] text-slate-400 leading-tight">{r.department}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">{r.nb_jours}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.absent_days > 0
                          ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-red-600 text-xs font-bold">{r.absent_days}</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.late_days > 0
                          ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-50 text-orange-600 text-xs font-bold">{r.late_days}</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.anomaly_days > 0
                          ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-50 text-violet-600 text-xs font-bold">{r.anomaly_days}</span>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-semibold tabular-nums text-sm ${r.worked_minutes > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          {r.worked_minutes > 0 ? formatMinutes(r.worked_minutes) : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-semibold tabular-nums text-slate-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {onDetail && (
                          <button
                            onClick={() => onDetail(r.employee_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition">
                            Détail
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
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

// ─── Modal filtre ─────────────────────────────────────────────────────────────
function buildWeekendShortcuts(): { label: string; d: string }[] {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const yest  = new Date(now); yest.setDate(now.getDate() - 1);
  const dow   = now.getDay();
  const sat   = new Date(now);
  if (dow === 6) { /* today */ } else if (dow === 0) sat.setDate(now.getDate() - 1); else sat.setDate(now.getDate() - dow - 1);
  const sun   = new Date(now);
  if (dow === 0) { /* today */ } else sun.setDate(now.getDate() - dow);
  return [
    { label: "Aujourd'hui", d: today },
    { label: "Hier",        d: yest.toISOString().slice(0, 10) },
    { label: "Samedi",      d: sat.toISOString().slice(0, 10) },
    { label: "Dimanche",    d: sun.toISOString().slice(0, 10) },
  ];
}

// ============================================================================
// MODAL FILTRES
// ============================================================================

function FilterModal({
  open, onClose, viewMode, setViewMode, date, setDate, week, setWeek,
  month, setMonth, statusFilter, setStatusFilter, onApply,
}: {
  open: boolean; onClose: () => void; viewMode: ViewMode; setViewMode: (v: ViewMode) => void;
  date: string; setDate: (v: string) => void; week: string; setWeek: (v: string) => void;
  month: string; setMonth: (v: string) => void; statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void; onApply: () => void;
}) {
  const weekendShortcuts = buildWeekendShortcuts();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-600" />
                <span className="font-semibold text-gray-900">Filtres & Période</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="px-4 sm:px-6 py-5 space-y-6 overflow-y-auto flex-1">
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
              {viewMode === "daily" && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Accès rapide</p>
                  <div className="flex flex-wrap gap-2">
                    {weekendShortcuts.map((s) => (
                      <button key={s.label} onClick={() => setDate(s.d)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          date === s.d
                            ? "bg-camublue-900 text-white border-transparent"
                            : (s.label === "Samedi" || s.label === "Dimanche")
                              ? "bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
              <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">Annuler</button>
              <button onClick={() => { onApply(); onClose(); }} className="flex-1 rounded-2xl bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 text-sm font-medium transition">Appliquer</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// COMPOSANT PRINCIPAL: AttendanceShiftsPage
// ============================================================================

export default function AttendanceShiftsPage() {
  // ── State ────────────────────────────────────────────────────────────────────
  const [loading,    setLoading]    = useState(false);
  const [viewMode,   setViewMode]   = useState<ViewMode>("daily");
  const [date,       setDate]       = useState(todayISO());
  const [week,       setWeek]       = useState(isoWeekNow());
  const [month,      setMonth]      = useState(yyyyMmToday());
  const [shiftData,  setShiftData]  = useState<ShiftDailyStatsResponse | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyStatsResponse | null>(null);
  const [monthlyData,setMonthlyData]= useState<MonthlyStatsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQ,      setSearchQ]      = useState("");
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(10);
  const [emailMap,     setEmailMap]     = useState<Map<string,string>>(new Map());
  const [phoneMap,     setPhoneMap]     = useState<Map<string,string>>(new Map());
  const [departmentMap,setDepartmentMap]= useState<Map<string,string>>(new Map());
  const [projectMap,   setProjectMap]   = useState<Map<string,string>>(new Map());
  const [assignments,  setAssignments]  = useState<AssignmentMap>(() => {
    try { const s = localStorage.getItem(LS_SHIFT_ASSIGNMENTS_KEY); if (s) return JSON.parse(s); } catch {}
    return {};
  });
  const [showExportDlg,       setShowExportDlg]       = useState(false);
  const [exportDetailLoading, setExportDetailLoading] = useState(false);
  const [exportDailyCols,  setExportDailyCols]   = useState<ShiftDailyCol[]>([...SHIFT_DAILY_COLS]);
  const [exportSummaryCols,setExportSummaryCols] = useState<ShiftSummCol[]>([...SHIFT_SUMM_COLS]);
  const [filterOpen,       setFilterOpen]        = useState(false);
  const [alertModalOpen,   setAlertModalOpen]    = useState(false);
  const [detailModalOpen,  setDetailModalOpen]   = useState(false);
  const [selectedEmployee, setSelectedEmployee]  = useState<FlatRecord | null>(null);
  const [selectedEmployeeId,setSelectedEmployeeId]=useState<number|null>(null);
  const [sendingAlert,     setSendingAlert]       = useState(false);
  const [showScheduleModal,setShowScheduleModal]  = useState(false);
  const [empDayDetails,   setEmpDayDetails]      = useState<Map<number, DayDetail[]>>(new Map());
  const [detailsLoading,  setDetailsLoading]      = useState(false);

  const [activeSchedule, setActiveSchedule] = useState<ActiveSchedule | null>(() => {
    try { const s = localStorage.getItem(LS_SHIFT_ACTIVE_SCHEDULE_KEY); if (s) return JSON.parse(s); } catch {}
    const d = new Date(), end = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return { ...DEFAULT_PRESETS[0], dateStart: todayISO(), dateEnd: end.toISOString().slice(0,10), locked: true };
  });

  const [presets, setPresets] = useState<WorkSchedulePreset[]>(() => {
    try { const s = localStorage.getItem(LS_SHIFT_PRESETS_KEY); if (s) return JSON.parse(s); } catch {}
    return DEFAULT_PRESETS;
  });

  // ── Persistence ──────────────────────────────────────────────────────────────
  useEffect(() => {
    try { if (activeSchedule) localStorage.setItem(LS_SHIFT_ACTIVE_SCHEDULE_KEY, JSON.stringify(activeSchedule)); } catch {}
  }, [activeSchedule]);
  useEffect(() => { try { localStorage.setItem(LS_SHIFT_PRESETS_KEY, JSON.stringify(presets)); } catch {} }, [presets]);
  useEffect(() => { try { localStorage.setItem(LS_SHIFT_ASSIGNMENTS_KEY, JSON.stringify(assignments)); } catch {} }, [assignments]);

  // ── Load employees + schedule ─────────────────────────────────────────────────
  const loadEmployees = useCallback(() => {
    getEmployees().then((list: Employee[]) => {
      const m = new Map<string,string>(), ph = new Map<string,string>();
      const dm = new Map<string,string>(), pm = new Map<string,string>();
      const apiAsgn: AssignmentMap = {};
      list.forEach((e) => {
        if (e.matricule && e.email) m.set(e.matricule, e.email);
        if (e.matricule && (e as any).telephone) ph.set(e.matricule, (e as any).telephone);
        if (e.matricule && (e.department ?? (e as any).service))
          dm.set(e.matricule, (e.department ?? (e as any).service).toUpperCase());
        const proj = (e as any).project ?? (e as any).projet ?? (e as any).project_name ?? (e as any).site ?? null;
        if (e.matricule && proj) pm.set(e.matricule, String(proj).toUpperCase());
        if (e.matricule && (e as any).shift_team) apiAsgn[e.matricule] = (e as any).shift_team;
      });
      setEmailMap(m); setPhoneMap(ph); setDepartmentMap(dm); setProjectMap(pm);
      setAssignments((prev) => ({ ...apiAsgn, ...prev }));
    }).catch(console.error);
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { return onEmployeesSynced(() => loadEmployees()); }, [loadEmployees]);

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
    }).catch(() => {});
  }, []);

  const effectiveSchedule: WorkSchedulePreset = useMemo(() => {
    if (activeSchedule && isPeriodActive(activeSchedule)) return activeSchedule;
    return presets[0] ?? DEFAULT_PRESETS[0];
  }, [activeSchedule, presets]);

  // ── Fetch ──────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (viewMode === "daily")   setShiftData(await getShiftDailyStats({ date }));
      if (viewMode === "weekly")  setWeeklyData(await getWeeklyStats(week));
      if (viewMode === "monthly") setMonthlyData(await getMonthlyStats(month));
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  }, [viewMode, date, week, month]);

  useEffect(() => { fetchData(); }, [viewMode, date, week, month]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQ, shiftData, weeklyData, monthlyData, pageSize]);

  // Auto-refresh silencieux en mode journalier
  useEffect(() => {
    if (viewMode !== "daily") return;
    const id = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(id);
  }, [viewMode, fetchData]);

  // ── Détail journalier par employé (mode recherche hebdo/mensuel) ────────────
  useEffect(() => {
    if (!searchQ.trim() || viewMode === "daily") {
      setEmpDayDetails(new Map());
      return;
    }
    const bounds = viewMode === "weekly" ? isoWeekBounds(week) : isoMonthBounds(month);
    setDetailsLoading(true);
    // On attend que filteredSummaryRecords soit non vide pour éviter des appels inutiles
    // mais ce hook dépend de searchQ/viewMode/week/month donc il se déclenche au bon moment
    let cancelled = false;
    (async () => {
      try {
        // On relit les records filtrés depuis weeklyData/monthlyData directement
        const source = viewMode === "weekly" ? weeklyData?.by_employee ?? [] : monthlyData?.by_employee ?? [];
        const q = searchQ.toLowerCase();
        const matched = source.filter(r =>
          (r.full_name ?? "").toLowerCase().includes(q) ||
          (r.matricule ?? "").toLowerCase().includes(q)
        );
        const results = await Promise.all(
          matched.map(r =>
            getEmployeePeriodDetail({ employee_id: r.employee_id, start: bounds.start, end: bounds.end })
              .then(res => [r.employee_id, res.days] as [number, DayDetail[]])
              .catch(() => [r.employee_id, []] as [number, DayDetail[]])
          )
        );
        if (!cancelled) setEmpDayDetails(new Map(results));
      } finally { if (!cancelled) setDetailsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [searchQ, viewMode, week, month, weeklyData, monthlyData]);

  // ── Records journaliers (FlatRecord) ──────────────────────────────────────────
  const allRecords = useMemo((): FlatRecord[] => {
    if (viewMode !== "daily" || !shiftData) return [];
    const now = new Date(), nowMin = now.getHours()*60 + now.getMinutes();
    const shiftNotStarted = (team: ShiftTeamKey | null): boolean => {
      if (!team) return false;
      if (team === "soir2") return nowMin >= 8*60 && nowMin < 20*60;
      const win: Record<string, number> = { jour: 6*60, soir1: 14*60 };
      return nowMin < (win[team] ?? 0);
    };
    const shiftOrder: Record<string, number> = { jour: 0, soir1: 1, soir2: 2 };
    return shiftData.records.map((r): FlatRecord => {
      const proj = (() => {
        const p = (r as any).project ?? (r as any).projet ?? (r as any).project_name ?? (r as any).site ?? null;
        return p ? String(p).toUpperCase() : (projectMap.get(r.matricule) ?? "—");
      })();
      const lateMin = r.late_minutes ?? 0;
      const overtimeMin = r.out_time ? computeOvertimeMinutes(r.out_time, 17, 30) : 0;
      return {
        employee_id: r.employee_id, matricule: r.matricule || "", full_name: r.full_name,
        department: (r.department ?? departmentMap.get(r.matricule) ?? "—").toUpperCase(), project: proj,
        status: (() => {
          if (r.status === "absent" && shiftNotStarted(r.shift_team)) return "pending";
          if (r.status === "anomaly" && r.in_time && r.out_time && r.in_time !== r.out_time) return "ok";
          return r.status as FlatRecord["status"];
        })(),
        is_late_api: r.is_late, late_label_api: r.late_label,
        computed_late_minutes: lateMin, overtime_minutes: overtimeMin,
        compensation: computeCompensation(lateMin, overtimeMin),
        deficit_minutes: computeDeficitMinutes(r.worked_minutes, r.expected_minutes),
        in_time: r.in_time, out_time: r.out_time,
        worked_minutes: r.worked_minutes, expected_minutes: r.expected_minutes,
        email: emailMap.get(r.matricule) ?? (r as any).email ?? null,
        telephone: phoneMap.get(r.matricule) ?? (r as any).telephone ?? null,
        shift_team: r.shift_team,
        shift_team_label: SHIFT_TEAMS.find(t => t.key === r.shift_team)?.label ?? "",
        is_scheduled: r.is_planned, is_replacement: (r as any).is_replacement ?? false,
        not_scheduled_rest: !r.is_planned && r.status === "not_working",
        is_shift_pending: r.status === "absent" && shiftNotStarted(r.shift_team),
        team_id: (r as any).team_id ?? "",
        replaced_by: (r as any).replaced_by ?? null,
        replacement_in_time: (r as any).replacement_in_time ?? null,
        replacement_out_time: (r as any).replacement_out_time ?? null,
        replacement_worked_minutes: (r as any).replacement_worked_minutes ?? null,
        replaces_employee: (r as any).replaces_employee ?? null,
      };
    }).sort((a, b) => {
      const sa = shiftOrder[a.shift_team ?? ""] ?? 3, sb = shiftOrder[b.shift_team ?? ""] ?? 3;
      if (sa !== sb) return sa - sb;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [shiftData, emailMap, phoneMap, viewMode, projectMap, departmentMap]);

  // ── Records synthétiques (hebdo/mensuel) ──────────────────────────────────────
  const summaryRecords = useMemo((): SummaryRecord[] => {
    const dept = (r: any) => (r.department ?? r.service ?? departmentMap.get(r.matricule ?? "") ?? "—").toUpperCase();
    const proj = (r: any) => {
      const p = (r as any).project ?? (r as any).projet ?? (r as any).project_name ?? (r as any).site ?? null;
      return p ? String(p).toUpperCase() : (projectMap.get(r.matricule ?? "") ?? "—");
    };
    const map = (r: any): SummaryRecord => ({
      employee_id: r.employee_id, matricule: r.matricule ?? "", full_name: r.full_name ?? "",
      department: dept(r), project: proj(r),
      shift_team: assignments[r.matricule ?? ""] ?? r.shift_team ?? null,
      nb_jours: r.present_days ?? r.worked_days ?? 0,
      worked_minutes: r.total_worked_minutes ?? r.worked_minutes ?? 0,
      absent_days: r.absent_days ?? 0, late_days: r.late_days ?? 0, anomaly_days: r.anomaly_days ?? 0,
      delta_minutes: r.delta_minutes ?? 0, expected_minutes: r.expected_minutes ?? 0,
    });
    if (viewMode === "weekly"  && weeklyData)  return weeklyData.by_employee.map(map);
    if (viewMode === "monthly" && monthlyData) return monthlyData.by_employee.map(map);
    return [];
  }, [viewMode, weeklyData, monthlyData, assignments, departmentMap, projectMap]);

  const filteredSummaryRecords = useMemo(() => {
    if (!searchQ.trim()) return summaryRecords;
    const q = searchQ.toLowerCase();
    return summaryRecords.filter((r) =>
      r.full_name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) || r.project.toLowerCase().includes(q) ||
      (SHIFT_TEAMS.find(t => t.key === r.shift_team)?.label ?? "").toLowerCase().includes(q)
    );
  }, [summaryRecords, searchQ]);

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (viewMode === "daily" && shiftData) {
      return { total: shiftData.kpis.total, absent: shiftData.kpis.absent, late: shiftData.kpis.late, anomaly: shiftData.kpis.anomalies };
    }
    return { total: summaryRecords.length, absent: 0, late: 0, anomaly: 0 };
  }, [viewMode, shiftData, summaryRecords]);

  // ── Filtrage journalier ───────────────────────────────────────────────────────
  const isLateRecord = (r: FlatRecord) => r.computed_late_minutes > 0;

  const filtered = useMemo((): FlatRecord[] => {
    const q = searchQ.toLowerCase();
    return allRecords.filter((r) => {
      if (q && !(r.full_name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) || (r.shift_team_label ?? "").toLowerCase().includes(q))) return false;
      if (!r.not_scheduled_rest || statusFilter !== "all") {
        if (statusFilter === "late")      return isLateRecord(r);
        if (statusFilter === "deficit")   return r.deficit_minutes > 0;
        if (statusFilter === "absent")    return r.status === "absent" && !r.not_scheduled_rest;
        if (statusFilter === "on_leave")  return r.status === "on_leave";
        if (statusFilter === "on_mission")return r.status === "on_mission";
        if (statusFilter === "incomplete")return r.status === "incomplete";
        if (statusFilter === "anomaly")   return r.status === "anomaly";
        if (statusFilter !== "all")       return r.status === statusFilter;
        if (r.not_scheduled_rest)         return false; // masquer repos non planifiés en vue "Tous"
      }
      return true;
    });
  }, [allRecords, statusFilter, searchQ]);

  const filterCount = (key: StatusFilter) => {
    if (key === "all")     return allRecords.filter(r => !r.not_scheduled_rest).length;
    if (key === "late")    return allRecords.filter(isLateRecord).length;
    if (key === "deficit") return allRecords.filter(r => r.deficit_minutes > 0).length;
    if (key === "absent")  return allRecords.filter(r => r.status === "absent").length;
    if (key === "on_leave") return allRecords.filter(r => r.status === "on_leave").length;
    if (key === "on_mission") return allRecords.filter(r => r.status === "on_mission").length;
    if (key === "incomplete") return allRecords.filter(r => r.status === "incomplete").length;
    if (key === "anomaly") return allRecords.filter(r => r.status === "anomaly").length;
    return allRecords.filter(r => r.status === key).length;
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData   = filtered.slice((page-1)*pageSize, page*pageSize);

  const getPageNumbers = (): (number|"...")[] => {
    const pages: (number|"...")[] = [];
    if (totalPages <= 7) { for (let i=1; i<=totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i=Math.max(2,page-1); i<=Math.min(totalPages-1,page+1); i++) pages.push(i);
      if (page < totalPages-2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSendAlert = async (motif: MotifType, channel: "email"|"sms") => {
    if (!selectedEmployee) return;
    setSendingAlert(true);
    try {
      const res = await sendAttendanceAlert({ employee_id: selectedEmployee.employee_id, motif, channel });
      if (res.ok) {
        alert(`Alerte envoyée via ${channel === "sms" ? "SMS" : "Email"} à ${res.recipient ?? "—"}`);
        setAlertModalOpen(false); setSelectedEmployee(null);
      } else alert(`Échec : ${res.error ?? "Erreur inconnue"}`);
    } catch { alert("Erreur lors de l'envoi de l'alerte."); } finally { setSendingAlert(false); }
  };

  const handleExport = () => setShowExportDlg(true);

  const handleExportMonthlyDetail = async () => {
    if (viewMode !== "monthly") return;
    const { start, end } = isoMonthBounds(month);
    setExportDetailLoading(true);
    try {
      const data = await getAttendanceMonthlyDetail({ start, end });
      exportMonthlyDetailXLSX(data, month);
    } catch (e: any) {
      alert("Erreur lors de l'export : " + (e?.message ?? "inconnue"));
    } finally {
      setExportDetailLoading(false);
    }
  };

  const doExport = () => {
    if (viewMode === "daily") {
      const ALL: Record<ShiftDailyCol, (r: FlatRecord) => any> = {
        "Matricule":        (r) => r.matricule,
        "Nom":              (r) => r.full_name,
        "Projet":           (r) => r.project !== "—" ? r.project : "—",
        "Département":      (r) => r.department !== "—" ? r.department : "—",
        "Statut":           (r) => r.status,
        "Retard":           (r) => r.computed_late_minutes > 0 ? `RETARD · ${formatMinutes(r.computed_late_minutes)}` : "Non",
        "Entrée":           (r) => r.shift_team === "soir2" ? formatTime(r.out_time) : formatTime(r.in_time),
        "Sortie":           (r) => r.shift_team === "soir2" ? formatTime(r.in_time) : formatTime(r.out_time),
        "Heure travaillée": (r) => r.worked_minutes > 0 ? formatMinutes(r.worked_minutes) : "—",
        "Compensation":     (r) => r.compensation.is_compensated ? "Oui" : r.compensation.late_min > 0 ? "Non" : "—",
        "Email":            (r) => r.email ?? "Manquant",
      };
      exportXLSX(`shift_journalier_${date}`, filtered.map(r => Object.fromEntries(exportDailyCols.map(k => [k, ALL[k](r)]))));
    } else {
      const MAX_MIN = viewMode === "weekly" ? MAX_WEEKLY_MIN : Math.round(MAX_WEEKLY_MIN * 4.33);
      const ALL: Record<ShiftSummCol, (r: SummaryRecord) => any> = {
        "Matricule":          (r) => r.matricule,
        "Nom":                (r) => r.full_name,
        "Projet":             (r) => r.project !== "—" ? r.project : "—",
        "Département":        (r) => r.department,
        "Jours présents":     (r) => r.nb_jours,
        "Jours absents":      (r) => r.absent_days,
        "Jours retard":       (r) => r.late_days,
        "Jours anomalie":     (r) => r.anomaly_days,
        "Heures travaillées": (r) => formatMinutes(r.worked_minutes) || "0h",
        "Heures attendues":   (r) => r.expected_minutes > 0 ? formatMinutes(r.expected_minutes) : "—",
        "Delta":              (r) => r.delta_minutes !== 0 ? formatMinutes(Math.abs(r.delta_minutes)) : "0h",
        "% quota":            (r) => `${Math.min(100, Math.round((r.worked_minutes / MAX_MIN) * 100))}%`,
      };
      exportXLSX(`shift_${viewMode === "weekly" ? "hebdo" : "mensuel"}`, filteredSummaryRecords.map(r => Object.fromEntries(exportSummaryCols.map(k => [k, ALL[k](r)]))));
    }
    setShowExportDlg(false);
  };

  // ── JSX ──────────────────────────────────────────────────────────────────────
  const tableHeaders = ["Matricule","Nom","Projet/Dép.","Statut","Retard","Entrée","Sortie","H. Travaillées","Actions"];

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6">

        {/* ── En-tête ── */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-start shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-camublue-900">Pointages Shifts</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setPage(1); }} placeholder="Nom, matricule, équipe…"
                className="pl-9 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-camublue-900 text-sm px-3 py-2 w-full sm:w-80 md:w-96 focus:outline-none" />
            </div>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none flex-1 sm:flex-none">
              <option value="daily">Journalier</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuel</option>
            </select>
            <button onClick={() => setFilterOpen(true)}
              className={`border px-3 py-2 rounded-lg text-sm transition flex items-center gap-1.5 ${statusFilter !== "all" ? "bg-orange-50 border-orange-300 text-orange-700" : "bg-white border-slate-300 hover:bg-slate-50"}`}>
              <Filter className="h-4 w-4" /><span className="hidden sm:inline">Filtrer</span>
              {statusFilter !== "all" && <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold leading-none">1</span>}
            </button>
            <button onClick={handleExport}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-green-600" /><span className="hidden sm:inline">Exporter</span>
            </button>
            {viewMode === "monthly" && (
              <button onClick={handleExportMonthlyDetail} disabled={exportDetailLoading}
                className="bg-white border border-green-400 px-3 py-2 rounded-lg text-sm hover:bg-green-50 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-green-700">
                {exportDetailLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <FileSpreadsheet className="h-4 w-4" />}
                <span className="hidden sm:inline">Export Détaillé</span>
              </button>
            )}
            <button onClick={() => setShowScheduleModal(true)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-slate-500" /><span className="hidden sm:inline">Horaires</span>
            </button>
            <button onClick={() => fetchData(false)}
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
            onClick={() => setStatusFilter(f => f === "late" ? "all" : "late")} />
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
                <table className="w-full table-fixed bg-white">
                  <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[18%]" />
                    <col className="w-[15%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[11%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <thead className="bg-camublue-900 text-white sticky top-0 z-10">
                    <tr>
                      {tableHeaders.map(h => (
                        <th key={h} className="px-3 py-3 text-center text-xs font-semibold tracking-wide border-b border-camublue-800 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
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
                      pageData.map(r => (
                        <TableRow key={`${r.employee_id}-${r.shift_team}`} r={r} isLate={isLateRecord(r)}
                          onAlert={() => { setSelectedEmployee(r); setAlertModalOpen(true); }}
                          onDetail={() => { setSelectedEmployeeId(r.employee_id); setDetailModalOpen(true); }}
                          onEdit={() => {}} />
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
                        {PAGE_SIZE_OPTIONS.map(size => (
                          <button key={size} onClick={() => { setPageSize(size); setPage(1); }}
                            className={`min-w-[28px] h-6 rounded text-xs font-semibold transition-all ${pageSize === size ? "bg-camublue-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button onClick={() => setPage(1)} disabled={page===1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><FaAngleDoubleLeft size={12} /></button>
                    <button onClick={() => setPage(p => Math.max(p-1,1))} disabled={page===1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-4 w-4" /></button>
                    <div className="flex flex-wrap items-center gap-0.5 mx-1">
                      {getPageNumbers().map((p, i) =>
                        p === "..." ? <span key={`e-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                          : <button key={p} onClick={() => setPage(p as number)}
                              className={`min-w-[28px] sm:min-w-[32px] h-7 sm:h-8 rounded-md text-xs sm:text-sm font-medium transition-colors ${page===p ? "bg-camublue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
                              {p}
                            </button>
                      )}
                    </div>
                    <button onClick={() => setPage(p => Math.min(p+1,totalPages))} disabled={page===totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-4 w-4" /></button>
                    <button onClick={() => setPage(totalPages)} disabled={page===totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><FaAngleDoubleRight size={12} /></button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Vue Hebdo / Mensuel ── */
          searchQ.trim() ? (
            /* Recherche active : vue détail par jour, nom répété sur chaque ligne */
            <ExpandedDayTable
              records={filteredSummaryRecords}
              dayDetails={empDayDetails}
              isLoading={loading || detailsLoading}
            />
          ) : (
            /* Vue résumé normale */
            <SummaryTable
              rows={filteredSummaryRecords}
              mode={viewMode as "weekly"|"monthly"}
              isLoading={loading}
              byDay={viewMode === "weekly" ? (weeklyData as any)?.by_day : undefined}
              onDetail={(id) => { setSelectedEmployeeId(id); setDetailModalOpen(true); }}
            />
          )
        )}

        {/* ── Modals ── */}
        <FilterModal
          open={filterOpen} onClose={() => setFilterOpen(false)}
          viewMode={viewMode} setViewMode={setViewMode}
          date={date} setDate={setDate}
          week={week} setWeek={setWeek}
          month={month} setMonth={setMonth}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          onApply={() => fetchData(false)} />

        <DetailModal open={detailModalOpen} onClose={() => setDetailModalOpen(false)}
          employeeId={selectedEmployeeId} initialWeek={week} />

        <AlertModal open={alertModalOpen} onClose={() => setAlertModalOpen(false)}
          employee={selectedEmployee} onConfirm={handleSendAlert} sending={sendingAlert} />

        <WorkScheduleModal
          open={showScheduleModal} onClose={() => setShowScheduleModal(false)}
          active={activeSchedule} presets={presets}
          onSave={(s) => { setActiveSchedule(s); saveShiftSchedule(s).catch(console.error); }}
          onPresetsChange={setPresets} />

        {/* ── Export Dialog ── */}
        <AnimatePresence>
          {showExportDlg && (() => {
            const isDailyMode = viewMode === "daily";
            const availCols = isDailyMode ? SHIFT_DAILY_COLS : SHIFT_SUMM_COLS;
            const selCols   = isDailyMode ? exportDailyCols  : exportSummaryCols;
            const setSelCols = isDailyMode
              ? (v: ShiftDailyCol[]) => setExportDailyCols(v)
              : (v: ShiftSummCol[])  => setExportSummaryCols(v);
            return (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
                <motion.div
                  initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                  className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                      <h2 className="font-black text-camublue-900 text-base">Export personnalisé</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isDailyMode ? `Journalier · ${date}` : viewMode === "weekly" ? `Semaine · ${week}` : `Mensuel · ${month}`}
                        {" · "}Sélectionnez les colonnes à inclure
                      </p>
                    </div>
                    <button onClick={() => setShowExportDlg(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="px-5 py-4">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs font-semibold text-slate-500">{selCols.length}/{availCols.length} colonnes</p>
                      <div className="flex gap-2">
                        <button onClick={() => setSelCols([...availCols] as any)} className="text-xs text-camublue-700 hover:underline font-medium">Tout</button>
                        <span className="text-slate-300">|</span>
                        <button onClick={() => setSelCols([] as any)} className="text-xs text-slate-500 hover:underline font-medium">Aucun</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {availCols.map(col => {
                        const checked = (selCols as string[]).includes(col);
                        return (
                          <label key={col} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border transition text-sm ${checked ? "bg-camublue-50 border-camublue-200 text-camublue-800" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
                            <input type="checkbox" checked={checked} onChange={() => {
                              const next = checked ? (selCols as string[]).filter(k => k !== col) : [...(selCols as string[]), col];
                              setSelCols(next as any);
                            }} className="accent-camublue-700 w-3.5 h-3.5" />
                            <span className="font-medium">{col}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={() => setShowExportDlg(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Annuler</button>
                    <button onClick={doExport} disabled={selCols.length === 0}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-bold hover:bg-camublue-800 disabled:opacity-50 transition">
                      <FileSpreadsheet className="h-4 w-4" />Télécharger
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
}
