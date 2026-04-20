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

// 🧪 Debug function to verify parameters are sent correctly
export async function debugExportParams(date_from: string, date_to: string): Promise<void> {
  try {
    console.log("🔍 DEBUG: Checking what backend receives...");
    const response = await api.get("/api/attendance/debug-params/", {
      params: { date_from, date_to, export_format: "csv" },
    });

    console.log("📦 Backend received:");
    console.log(JSON.stringify(response.data, null, 2));

    alert("✓ Check console for backend response");
  } catch (error) {
    console.error("❌ Debug error:", error);
    alert("❌ Debug failed: " + (error instanceof Error ? error.message : String(error)));
  }
}

// 🧪 Test function to verify download capability
export async function testDownload(): Promise<void> {
  try {
    console.log("=== TEST DOWNLOAD START ===");
    const response = await api.get("/api/attendance/test-download/", {
      responseType: "blob",
    });

    console.log("Test response received:", response.status, response.data.size);

    const blob = response.data as Blob;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "TEST_shifts_export.txt");

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 500);

    console.log("=== TEST DOWNLOAD SUCCESS ===");
  } catch (error) {
    console.error("=== TEST DOWNLOAD ERROR ===", error);
    throw error;
  }
}

export async function downloadShiftExportCSV(params: {
  date_from: string;
  date_to: string;
}): Promise<void> {
  try {
    console.log("=== downloadShiftExportCSV START ===");
    console.log("Params:", params);

    const requestUrl = "/api/attendance/shifts/export/";
    const requestParams = {
      date_from: params.date_from,
      date_to: params.date_to,
      export_format: "csv"
    };

    console.log("Request URL:", requestUrl);
    console.log("Request params:", requestParams);

    const response = await api.get(requestUrl, {
      params: requestParams,
      responseType: "blob",
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);
    console.log("Response data type:", typeof response.data);
    console.log("Response data size:", response.data.size);

    if (!response.data) {
      throw new Error("Response data is empty");
    }

    if (response.data.size === 0) {
      throw new Error("Downloaded file is empty (0 bytes)");
    }

    const blob = response.data as Blob;
    console.log("Blob created, size:", blob.size, "type:", blob.type);

    const url = window.URL.createObjectURL(blob);
    console.log("Object URL created:", url);

    const link = document.createElement("a");
    link.href = url;
    const filename = `shifts_export_${params.date_from}_to_${params.date_to}.txt`;
    link.setAttribute("download", filename);

    console.log("Link element created");
    console.log("Download attribute set to:", filename);

    document.body.appendChild(link);
    console.log("Link appended to body");

    link.click();
    console.log("Link clicked, download should start");

    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
        console.log("Link removed from body");
      }
      window.URL.revokeObjectURL(url);
      console.log("Object URL revoked");
    }, 500);

    console.log("=== downloadShiftExportCSV SUCCESS ===");
  } catch (error) {
    console.error("=== downloadShiftExportCSV ERROR ===");
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Full error:", error);

    if (error instanceof Error && error.message.includes("Network")) {
      console.error("Network error - check backend connectivity");
    }

    throw error;
  }
}
