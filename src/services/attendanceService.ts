// src/services/apiService.ts
import api from "@/api/axios"; // ton axios instance
import type {
  DailyStatsResponse,
  WeeklyStatsResponse,
  MonthlyStatsResponse,
  EmployeePeriodDetailResponse,
} from "@/types/attendance";

export async function getDailyStats(date: string): Promise<DailyStatsResponse> {
  const { data } = await api.get(`/api/attendance/daily-stats/`, { params: { date } });
  return data;
}

export async function getWeeklyStats(week: string): Promise<WeeklyStatsResponse> {
  const { data } = await api.get(`/api/attendance/weekly-stats/`, { params: { week } });
  return data;
}

export async function getMonthlyStats(month: string): Promise<MonthlyStatsResponse> {
  const { data } = await api.get(`/api/attendance/monthly-stats/`, { params: { month } });
  return data;
}

export async function getEmployeePeriodDetail(params: {
  employee_id: number;
  start: string;
  end: string;
}): Promise<EmployeePeriodDetailResponse> {
  const { data } = await api.get(`/api/attendance/employee-period-detail/`, { params });
  return data;
}
