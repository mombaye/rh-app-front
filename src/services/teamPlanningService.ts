import api from "@/api/axios";

export type CellKind = "project" | "weekend" | "holiday" | "leave" | "empty";

export interface PlanningCell {
  value: string;
  kind: CellKind;
  auto: boolean;
}

export interface PlanningRow {
  employee_id: number;
  matricule: string;
  nom: string;
  prenom: string;
  business_line: string;
  line_manager: string;
  cells: PlanningCell[];
}

export interface PlanningGrid {
  year: number;
  month: number;
  is_rh: boolean;
  days: { day: number; weekday: number; holiday: string }[];
  business_lines: string[];
  managers: string[];
  projects: Record<string, string[]>;
  special_values: string[];
  rows: PlanningRow[];
  stats: { total: number; filled: number; pct: number };
}

export interface PlanningFilters {
  year: number;
  month: number;
  business_line?: string;
  manager?: string;
}

export interface PlanningChange {
  employee_id: number;
  day: number;
  value: string;
}

export interface ImportSummary {
  projects: Record<string, number>;
  members: number;
  unknown_employees: string[];
  unknown_managers: string[];
  entries: number;
  ignored_entries: number;
}

const clean = (f: PlanningFilters) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ""));

export const teamPlanningService = {
  getGrid: async (filters: PlanningFilters): Promise<PlanningGrid> =>
    (await api.get("/api/team-planning/grid/", { params: clean(filters) })).data,

  save: async (year: number, month: number, changes: PlanningChange[]): Promise<{ rows: PlanningRow[]; errors: string[] }> =>
    (await api.post("/api/team-planning/save/", { year, month, changes })).data,

  exportExcel: async (filters: PlanningFilters): Promise<Blob> =>
    (await api.get("/api/team-planning/export/", { params: clean(filters), responseType: "blob" })).data,

  importFile: async (file: File): Promise<ImportSummary> => {
    const fd = new FormData();
    fd.append("file", file);
    return (await api.post("/api/team-planning/import/", fd, { headers: { "Content-Type": undefined } })).data;
  },
};
