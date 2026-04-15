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
}): Promise<ShiftPeriodStatsResponse> {
  const cleanParams: Record<string, string> = {
    date_from: params.date_from,
    date_to:   params.date_to,
  };
  if (params.team)      cleanParams.team      = params.team;
  if (params.matricule) cleanParams.matricule = params.matricule;
  if (params.status)    cleanParams.status    = params.status;
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
  team_id?:           string;   // couleur hex ou identifiant de l'équipe (groupe coloré du planning)
  row_slot?:          number;   // position de la ligne dans le groupe — préserve l'ordre Excel
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

export async function uploadShiftPlanning(payload: ShiftPlanningUpload): Promise<{ created: number; ok: boolean }> {
  const { data } = await api.post("/api/attendance/shift-planning/", payload);
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