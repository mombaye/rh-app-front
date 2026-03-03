import api from "@/api/axios";
import type {
  DailyStatsResponse,
  WeeklyStatsResponse,
  MonthlyStatsResponse,
  EmployeePeriodDetailResponse,
  ShiftDailyStatsResponse,
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