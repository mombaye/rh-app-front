import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  Clock, AlertTriangle, UserMinus, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2, ChevronDown,
  Check, Settings, CheckCircle, Lock, CalendarDays,
  TrendingUp, Pencil, Plus, Trash2, Filter, Upload, CalendarRange, ArrowLeftRight,
  Table2, UserPlus,
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
  in_time: string | null; out_time: string | null;
  late_label: string | null; computed_late_minutes: number; overtime_minutes: number;
  worked_minutes: number; expected_minutes: number;
  compensation: CompensationResult;
  email: string | null;
  shift_team: ShiftTeamKey | null; shift_team_label: string;
  // Planning
  is_scheduled: boolean;      // true if employee is in today's planning
  is_replacement: boolean;    // true if present but NOT in planning (replacement)
  not_scheduled_rest: boolean; // true if not scheduled (rest day) → hide from absent count
  // Remplacement explicite (depuis ShiftReplacement API)
  replaced_by_id: number | null;          // Si cet employé a été remplacé: id du remplaçant
  replaced_by_name: string | null;        // Nom du remplaçant
  replaced_by_matricule: string | null;   // Matricule du remplaçant
  replaced_by_in_time: string | null;     // Heure d'entrée du remplaçant
  replaced_by_out_time: string | null;    // Heure de sortie du remplaçant
  replaced_by_status: string | null;      // Statut du remplaçant
  replaced_by_worked_minutes: number;     // Minutes travaillées par le remplaçant
  replaced_by_late_label: string | null;  // Label retard du remplaçant
  is_replacement_of_id: number | null;    // Si cet employé est un remplaçant: id de l'original
  is_replacement_of_name: string | null;  // Nom de la personne remplacée
  is_replacement_of_matricule: string | null; // Matricule de la personne remplacée
  is_replacement_of_shift: string | null; // Shift de la personne remplacée
}