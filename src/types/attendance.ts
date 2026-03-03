// ─── Daily ────────────────────────────────────────────────────────────────────

export interface DailyRecord {
  employee_id: number;
  matricule?: string;
  full_name: string;
  department?: string | null;
  work_date: string;
  weekday: number;
  weekday_label: string;
  in_time?: string | null;
  out_time?: string | null;
  worked_minutes: number;
  expected_minutes: number;
  delta_minutes: number;
  late_minutes: number;
  late_label: string | null;
  is_late: boolean;
  early_leave_minutes: number;
  status: "ok" | "absent" | "incomplete" | "anomaly";
  flags: Record<string, unknown>;
  position?: string;
  fonction?: string;
  job_title?: string;
  poste?: string;
}

export interface DailyKpis {
  present: number;
  absent: number;
  incomplete: number;
  anomalies: number;
  late: number;
  not_pointing: number;
  avg_late_minutes: number;
  total_overtime_minutes: number;
}

export interface DepartmentStat {
  department: string;
  ok: number;
  absent: number;
  incomplete: number;
  anomaly: number;
  late: number;
}

export interface LateTopEntry {
  full_name: string;
  late_minutes: number;
  late_label: string;
  department?: string | null;
}

export interface DailyStatsResponse {
  date: string;
  weekday: number;
  weekday_label: string;
  kpis: DailyKpis;
  by_department: DepartmentStat[];
  late_top: LateTopEntry[];
  records: DailyRecord[];
}

// ─── Weekly ───────────────────────────────────────────────────────────────────

export interface WeeklyDayEntry {
  date: string;
  weekday: number;
  weekday_label: string;
  worked_minutes: number;
  expected_minutes: number;
  ok_count: number;
  absent_count: number;
  incomplete_count: number;
  anomaly_count: number;
  late_count: number;
  not_pointing_count: number;
}

export interface PeriodEmployeeRow {
  employee_id: number;
  matricule?: string;
  nom?: string;
  prenom?: string;
  full_name: string;
  service?: string | null;
  attendance_status?: string;
  worked_minutes: number;
  expected_minutes: number;
  worked_hours: number;
  expected_hours: number;
  delta_minutes: number;
  present_days: number;
  anomaly_days: number;
  incomplete_days: number;
  absent_days: number;
  not_pointing_days: number;
  days_total: number;
  total_late_minutes: number;
  late_days: number;
  avg_late_minutes: number;
  overtime_minutes?: number;
  position?: string;
  fonction?: string;
  job_title?: string;
  poste?: string;
}

export interface WeeklyTopEntry {
  employee_id: number;
  full_name: string;
  late_minutes?: number;
  count?: number;
  department?: string | null;
}

export interface WeeklyStatsResponse {
  week: string;
  start: string;
  end: string;
  expected_minutes: number;
  worked_minutes: number;
  delta_minutes: number;
  present_days: number;
  absent_days: number;
  incomplete_days: number;
  anomaly_days: number;
  late_days: number;
  not_pointing_days: number;
  by_day: WeeklyDayEntry[];
  by_employee: PeriodEmployeeRow[];
  top_absent: WeeklyTopEntry[];
  top_late: WeeklyTopEntry[];
}

// ─── Monthly ──────────────────────────────────────────────────────────────────

export interface MonthlyWeekEntry {
  week: string;
  worked_minutes: number;
  expected_minutes: number;
  late_count: number;
}

export interface MonthlyStatsResponse {
  month: string;
  start: string;
  end: string;
  expected_minutes: number;
  worked_minutes: number;
  delta_minutes: number;
  by_week: MonthlyWeekEntry[];
  by_employee: PeriodEmployeeRow[];
  top_absent: WeeklyTopEntry[];
  top_overtime: WeeklyTopEntry[];
  top_late: WeeklyTopEntry[];
}

// ─── Employee Period Detail ───────────────────────────────────────────────────

export interface DayDetail {
  date: string;
  weekday: number;
  weekday_label: string;
  status: "ok" | "absent" | "incomplete" | "anomaly";
  in_time?: string | null;
  out_time?: string | null;
  worked_minutes: number;
  expected_minutes: number;
  late_minutes: number;
  is_late: boolean;
  late_label: string | null;
  reason?: string | null;
  flags: Record<string, unknown>;
}

export interface LateSummary {
  late_days: number;
  total_late_minutes: number;
  avg_late_minutes: number;
}

export interface EmployeePeriodDetailResponse {
  employee_id: number;
  start: string;
  end: string;
  days_total: number;
  late_summary: LateSummary;
  days: DayDetail[];
}

// ─── Shift ────────────────────────────────────────────────────────────────────

export type ShiftTeamKey = "jour" | "soir1" | "soir2";

export interface ShiftTeamInfo {
  label: string;
  horaire: string;
}

export interface ShiftTeamKpi {
  total: number;
  present: number;
  absent: number;
  incomplete: number;
  anomalies: number;
  late: number;
}

export interface ShiftRecord {
  employee_id: number;
  matricule: string;
  full_name: string;
  department: string | null;
  attendance_status: string;
  work_date: string;
  weekday: number;
  weekday_label: string;
  shift_team: ShiftTeamKey | null;
  shift_team_label: string;
  in_time: string | null;
  out_time: string | null;
  worked_minutes: number;
  expected_minutes: number;
  delta_minutes: number;
  late_minutes: number;
  late_label: string | null;
  is_late: boolean;
  early_leave_minutes: number;
  status: "ok" | "absent" | "incomplete" | "anomaly";
  flags: Record<string, any>;
}

export interface ShiftDailyStatsResponse {
  date: string;
  weekday: number;
  weekday_label: string;
  team_filter: ShiftTeamKey | null;
  teams_info: Record<ShiftTeamKey, ShiftTeamInfo>;
  kpis: {
    total: number;
    present: number;
    absent: number;
    incomplete: number;
    anomalies: number;
    late: number;
    by_team: Record<ShiftTeamKey | "unknown", ShiftTeamKpi>;
  };
  records: ShiftRecord[];
}