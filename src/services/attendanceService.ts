import api from "@/api/axios";
import type {
  DailyStatsResponse,
  WeeklyStatsResponse,
  MonthlyStatsResponse,
  EmployeePeriodDetailResponse,
  ShiftDailyStatsResponse,
  ShiftPeriodStatsResponse,
  ShiftTeamKey,
} from "@/types/attendance";

export async function getDailyStats(date: string): Promise<DailyStatsResponse> {
  const { data } = await api.get("/api/attendance/daily-stats/", { params: { date } });
  return data;
}

export async function getWeeklyStats(week: string): Promise<WeeklyStatsResponse> {
  const { data } = await api.get("/api/attendance/weekly-stats/", { params: { week } });
  return data;
}

export async function getMonthlyStats(month: string): Promise<MonthlyStatsResponse> {
  const { data } = await api.get("/api/attendance/monthly-stats/", { params: { month } });
  return data;
}

export async function getEmployeePeriodDetail(params: {
  employee_id: number;
  start: string;
  end: string;
}): Promise<EmployeePeriodDetailResponse> {
  const { data } = await api.get("/api/attendance/employee-period-detail/", { params });
  return data;
}

export async function getShiftDailyStats(params: {
  date: string;
  team?: ShiftTeamKey | null;
}): Promise<ShiftDailyStatsResponse> {
  const cleanParams: Record<string, string> = { date: params.date };
  if (params.team) cleanParams.team = params.team;
  const { data } = await api.get("/api/attendance/shift-daily-stats/", { params: cleanParams });
  return data;
}

export async function getShiftPeriodStats(params: {
  date_from: string;
  date_to: string;
  team?: ShiftTeamKey | null;
  matricule?: string | null;
  status?: string | null;
  department?: string | null;
}): Promise<ShiftPeriodStatsResponse> {
  const cleanParams: Record<string, string> = {
    date_from: params.date_from,
    date_to:   params.date_to,
  };
  if (params.team)       cleanParams.team       = params.team;
  if (params.matricule)  cleanParams.matricule  = params.matricule;
  if (params.status)     cleanParams.status     = params.status;
  if (params.department) cleanParams.department = params.department;
  const { data } = await api.get("/api/attendance/shift-period-stats/", { params: cleanParams });
  return data;
}

// ─── Shift Schedule (horaires partagés entre tous les RH) ─────────────────────

export interface ShiftSchedulePayload {
  context:   string;
  startH:    number;
  startM:    number;
  endH:      number;
  endM:      number;
  breakMin:  number;
  dateStart: string;
  dateEnd:   string;
}

export interface ShiftScheduleResponse extends ShiftSchedulePayload {
  id:         number;
  updatedAt:  string;
  updatedBy:  string | null;
}

export async function getShiftSchedule(): Promise<ShiftScheduleResponse | null> {
  const { data } = await api.get("/api/attendance/shift-schedule/");
  return data ?? null;
}

export async function saveShiftSchedule(payload: ShiftSchedulePayload): Promise<ShiftScheduleResponse> {
  const { data } = await api.post("/api/attendance/shift-schedule/", payload);
  return data;
}

// ─── Shift Planning (planning mensuel importé depuis Excel) ───────────────────

export interface PlanningEntry {
  date:               string;
  shift_type:         string;
  employee_name:      string;
  employee_matricule?: string | null;
  team_id?:           string;
  row_slot?:          number;
}

export interface ShiftPlanningUpload {
  batch_id: string;
  entries:  PlanningEntry[];
}

export async function getShiftPlanning(dateFrom: string, dateTo: string): Promise<PlanningEntry[]> {
  const { data } = await api.get("/api/attendance/shift-planning/", {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return data;
}

export async function uploadShiftPlanning(
  payload: ShiftPlanningUpload,
  onUploadProgress?: (progress: { loaded: number; total?: number; percent: number }) => void,
): Promise<{
  created: number;
  ok: boolean;
  activated?: number;
  planned_matricules?: number;
  date_min?: string | null;
  date_max?: string | null;
  unresolved_names?: string[];
  skipped_invalid_date?: number;
  skipped_invalid_shift?: number;
}> {
  const { data } = await api.post("/api/attendance/shift-planning/", payload, {
    onUploadProgress: (evt) => {
      if (!onUploadProgress) return;
      const total = evt.total ?? (evt as any).event?.total;
      const percent = total ? Math.round((evt.loaded / total) * 100) : 0;
      onUploadProgress({ loaded: evt.loaded, total, percent });
    },
  });
  return data;
}

export interface ShiftPlanningStatus {
  has_planning:        boolean;
  is_active:           boolean;
  total_entries:       number;
  date_min:            string | null;
  date_max:            string | null;
  total_planned:       number;
  resolved_matricules: number;
  unresolved_names:    number;
  active_count:        number;
  pending_count:       number;
}

export async function getShiftPlanningStatus(params?: {
  dateFrom?: string;
  dateTo?:   string;
}): Promise<ShiftPlanningStatus> {
  const query: Record<string, string> = {};
  if (params?.dateFrom) query.date_from = params.dateFrom;
  if (params?.dateTo)   query.date_to   = params.dateTo;
  const { data } = await api.get("/api/attendance/shift-planning/status/", { params: query });
  return data;
}

export interface TeamPlanningGroup {
  shift_type: string;
  employees: { employee_name: string; employee_matricule: string | null }[];
}

export async function getShiftPlanningForDate(date: string): Promise<{
  date: string;
  assignments: { jour: PlanningEntry[]; soir1: PlanningEntry[]; soir2: PlanningEntry[] };
  teams: Record<string, TeamPlanningGroup>;
}> {
  const { data } = await api.get("/api/attendance/shift-planning/date/", { params: { date } });
  return data;
}

/** Supprime une seule entrée du planning (sans toucher aux autres). */
export async function deleteSinglePlanningEntry(
  date: string,
  shift_type: string,
  employee_name: string,
): Promise<{ deleted: number }> {
  const { data } = await api.delete("/api/attendance/shift-planning/entry/", {
    data: { date, shift_type, employee_name },
  });
  return data;
}

/** Ajoute une seule entrée au planning (sans supprimer les autres). */
export async function addSinglePlanningEntry(entry: {
  date: string;
  shift_type: string;
  employee_name: string;
}): Promise<{ created: boolean; employee_matricule: string | null }> {
  const { data } = await api.post("/api/attendance/shift-planning/entry/", entry);
  return data;
}

/** Active (attendance_status=SHIFT) tous les employés présents dans le planning. */
export async function activateShiftPlanning(params?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  activated: number;
  already_shift: number;
  total_planned: number;
  matched: number;
  unmatched: string[];
  missing_matricules: string[];
  matricules: string[];
}> {
  const body: Record<string, string> = {};
  if (params?.dateFrom) body.date_from = params.dateFrom;
  if (params?.dateTo)   body.date_to   = params.dateTo;
  const { data } = await api.post("/api/attendance/shift-planning/activate/", body);
  return data;
}

/** Déplace une entrée du planning (drag & drop) — PATCH. */
export async function moveShiftPlanningEntry(params: {
  date: string;
  shift_type: string;
  employee_name: string;
  new_date?: string;
  new_shift_type?: string;
  new_employee_name?: string;
  new_employee_matricule?: string | null;
}): Promise<{ ok: boolean; date: string; shift_type: string; employee_name: string; employee_matricule: string }> {
  const { data } = await api.patch("/api/attendance/shift-planning/entry/", params);
  return data;
}

/** Correction manuelle d'un pointage (entrée / sortie). */
export async function updateAttendanceRecord(params: {
  employee_id: number;
  date: string;
  in_time: string | null;
  out_time: string | null;
}): Promise<{ ok: boolean; status: string; worked_minutes: number }> {
  const { data } = await api.patch("/api/attendance/record/update/", params);
  return data;
}

/** Envoi manuel d'une alerte (Email ou SMS) à un employé. */
export async function sendAttendanceAlert(params: {
  employee_id: number;
  motif: "absent" | "not_pointing";
  channel: "email" | "sms";
}): Promise<{ ok: boolean; channel: string; recipient?: string; error?: string }> {
  const { data } = await api.post("/api/attendance/alerts/send/", params);
  return data;
}

// ─── Export des Shifts sur une période ──────────────────────────────────────

export interface ShiftEmployee {
  employee_name: string;
  matricule: string;
  in_time: string;
  out_time: string;
  status: string;
}

export interface ShiftGroup {
  shift_type: string;
  shift_label: string;
  employees: ShiftEmployee[];
}

export interface ShiftDateEntry {
  date: string;
  weekday: string;
  shifts: ShiftGroup[];
}

export interface ShiftExportResponse {
  date_from: string;
  date_to: string;
  total_dates: number;
  dates: ShiftDateEntry[];
}

export async function getShiftExportData(params: {
  date_from: string;
  date_to: string;
}): Promise<ShiftExportResponse> {
  const { data } = await api.get("/api/attendance/shifts/export/", {
    params: { date_from: params.date_from, date_to: params.date_to, export_format: "json" },
  });
  return data;
}

export async function downloadShiftExportCSV(params: {
  date_from: string;
  date_to: string;
}): Promise<void> {
  const response = await api.get("/api/attendance/shifts/export/", {
    params: { date_from: params.date_from, date_to: params.date_to, export_format: "csv" },
    responseType: "blob",
  });

  if (!response.data || response.data.size === 0) {
    throw new Error("Fichier vide ou introuvable");
  }

  const url = window.URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `shifts_export_${params.date_from}_to_${params.date_to}.txt`);
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    if (link.parentNode) document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 500);
}

// ─── Justifications d'absence — vue RH ───────────────────────────────────────
export type RhDispute = {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_matricule: string;
  work_date: string;
  justification_text: string;
  attendance_evidence: {
    status?: string;
    in_time?: string | null;
    out_time?: string | null;
    worked_minutes?: number;
    late_minutes?: number;
    delta_minutes?: number;
  } | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string;
};

export async function getRhDisputes(status?: string): Promise<RhDispute[]> {
  const params = status ? { status } : {};
  const { data } = await api.get("/api/attendance/rh-disputes/", { params });
  return data;
}

export async function resolveDispute(id: number, status: "approved" | "rejected", resolution_note: string): Promise<void> {
  await api.patch("/api/attendance/rh-disputes/", { id, status, resolution_note });
}

// ── Export mensuel détaillé (jour par jour) ────────────────────────────────────

export interface MonthlyDetailDay {
  date:            string;
  weekday:         string;
  in_time:         string | null;
  out_time:        string | null;
  worked_minutes:  number;
  late_minutes:    number;
  status:          string;
}

export interface MonthlyDetailEmployee {
  employee_id: number;
  full_name:   string;
  matricule:   string;
  service:     string | null;
  days:        MonthlyDetailDay[];
  summary: {
    worked_minutes:   number;
    expected_minutes: number;
    delta_minutes:    number;
    present_days:     number;
    absent_days:      number;
    on_leave_days:    number;
    on_mission_days:  number;
    incomplete_days:  number;
    anomaly_days:     number;
  };
}

export interface MonthlyDetailResponse {
  start:     string;
  end:       string;
  employees: MonthlyDetailEmployee[];
}

export async function getAttendanceMonthlyDetail(
  params: { start: string; end: string }
): Promise<MonthlyDetailResponse> {
  const { data } = await api.get("/api/attendance/export-monthly-detail/", { params });
  return data;
}
