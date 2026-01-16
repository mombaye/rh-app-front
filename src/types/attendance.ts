// src/types/attendance.ts

export type AttendanceStatus = "ok" | "absent" | "incomplete" | "anomaly";

export type DailyRecord = {
  employee_id: number;
  matricule?: string | null;
  full_name?: string | null;
  department?: string | null;
  work_date: string; // YYYY-MM-DD
  weekday?: number;
  weekday_label?: string; // Lundi...
  in_time?: string | null;
  out_time?: string | null;
  worked_minutes?: number | null;
  expected_minutes?: number | null;
  delta_minutes?: number | null;
  late_minutes?: number | null;
  early_leave_minutes?: number | null;
  status: AttendanceStatus;
  flags?: Record<string, any>;
  // optionnels si backend les renvoie
  position?: string | null;
  fonction?: string | null;
  job_title?: string | null;
  poste?: string | null;
};

export type DailyStatsResponse = {
  date: string;
  weekday?: number;
  weekday_label?: string;
  kpis: {
    present: number;
    absent: number;
    incomplete: number;
    anomalies: number;
    not_pointing?: number;
    avg_late_minutes: number;
    total_overtime_minutes: number;
  };
  by_department: Array<{
    department: string;
    ok: number;
    absent: number;
    incomplete: number;
    anomaly: number;
  }>;
  late_top: Array<{ full_name: string; late_minutes: number; department?: string | null }>;
  records: DailyRecord[];
};

export type WeeklyDayRow = {
  date: string; // YYYY-MM-DD
  weekday?: number;
  weekday_label?: string;
  worked_minutes: number;
  expected_minutes: number;
  ok_count?: number;
  absent_count?: number;
  incomplete_count?: number;
  anomaly_count?: number;
  not_pointing_count?: number;
};

export type PeriodEmployeeRow = {
  employee_id: number;
  matricule?: string | null;
  nom?: string | null;
  prenom?: string | null;
  full_name?: string | null;
  service?: string | null;

  worked_minutes: number;
  expected_minutes: number;
  worked_hours: number;
  expected_hours: number;
  delta_minutes: number;

  present_days?: number;
  absent_days?: number;
  incomplete_days?: number;
  anomaly_days?: number;
  not_pointing_days?: number;
  days_total?: number;

  total_late_minutes?: number;
  overtime_minutes?: number;

  // optionnels
  position?: string | null;
  fonction?: string | null;
  job_title?: string | null;
  poste?: string | null;
};

export type WeeklyStatsResponse = {
  week: string;
  start?: string; // YYYY-MM-DD
  end?: string;   // YYYY-MM-DD
  expected_minutes: number;
  worked_minutes: number;
  delta_minutes: number;

  present_days: number;
  absent_days: number;
  incomplete_days?: number;
  anomaly_days?: number;
  not_pointing_days?: number;

  by_day: WeeklyDayRow[];
  by_employee: PeriodEmployeeRow[];

  top_absent: Array<{ employee_id?: number; full_name: string; count: number; department?: string | null }>;
  top_late: Array<{ employee_id?: number; full_name: string; late_minutes: number; department?: string | null }>;
};

export type MonthlyWeekRow = {
  week: string; // YYYY-Www
  worked_minutes: number;
  expected_minutes: number;
};

export type MonthlyStatsResponse = {
  month: string; // YYYY-MM
  start?: string;
  end?: string;

  expected_minutes: number;
  worked_minutes: number;
  delta_minutes: number;

  by_week: MonthlyWeekRow[];
  by_employee: PeriodEmployeeRow[];

  top_absent: Array<{ employee_id?: number; full_name: string; count: number; department?: string | null }>;
  top_overtime: Array<{ employee_id?: number; full_name: string; overtime_minutes: number; department?: string | null }>;
};

export type EmployeePeriodDetailDay = {
  date: string; // YYYY-MM-DD
  weekday?: number;
  weekday_label?: string;
  status: AttendanceStatus | "present"; // backend renvoie ok/anomaly/incomplete/absent (et parfois present)
  in_time?: string | null;
  out_time?: string | null;
  worked_minutes?: number;
  expected_minutes?: number;
  reason?: string | null; // missing_row / no_in / no_out / no_in_no_out
  flags?: Record<string, any>;
};

export type EmployeePeriodDetailResponse = {
  employee_id: number;
  start: string;
  end: string;
  days_total: number;
  days: EmployeePeriodDetailDay[];
};
