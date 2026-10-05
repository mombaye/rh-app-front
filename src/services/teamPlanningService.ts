import api from "@/api/axios";

export type CellKind = "project" | "weekend" | "holiday" | "leave" | "empty";

export interface PlanningCell {
  value: string;
  kind: CellKind;
  auto: boolean;
  /** pointage / mission : jour travaillé (projet rempli automatiquement) ; absent : jour passé sans pointage */
  source?: "pointage" | "mission" | "absent";
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
  has_projects: boolean;
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
  entries: number;
  ignored_entries: number;
  unknown_employees: string[];
  bl_to_update: string[];
  manager_to_update: string[];
  new_projects?: number;
}

export interface PlanningProjectCode {
  id: number;
  code: string;
  business_line: string;
  is_active: boolean;
}

const clean = (f: PlanningFilters) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ""));

// Réponse mise en cache par utilisateur : sinon le menu refait l'appel à chaque changement de page.
const accessCache = new Map<number | string, Promise<boolean>>();

export const teamPlanningService = {
  /** Menu Team Planning : seulement pour les RH et les responsables d'employés concernés. */
  hasAccess: (userId: number | string): Promise<boolean> => {
    if (!accessCache.has(userId)) {
      accessCache.set(userId, api.get("/api/team-planning/access/")
        .then((r) => !!r.data?.allowed)
        .catch(() => { accessCache.delete(userId); return false; }));
    }
    return accessCache.get(userId)!;
  },

  getGrid: async (filters: PlanningFilters): Promise<PlanningGrid> =>
    (await api.get("/api/team-planning/grid/", { params: clean(filters) })).data,

  save: async (year: number, month: number, changes: PlanningChange[]): Promise<{ rows: PlanningRow[]; errors: string[] }> =>
    (await api.post("/api/team-planning/save/", { year, month, changes })).data,

  exportExcel: async (filters: PlanningFilters): Promise<Blob> =>
    (await api.get("/api/team-planning/export/", { params: clean(filters), responseType: "blob" })).data,

  copyPrevious: async (filters: PlanningFilters): Promise<{ filled: number; rows: PlanningRow[] }> =>
    (await api.post("/api/team-planning/copy-previous/", clean(filters))).data,

  listProjects: async (): Promise<{ business_lines: string[]; projects: PlanningProjectCode[] }> =>
    (await api.get("/api/team-planning/projects/")).data,

  addProject: async (code: string, business_line: string): Promise<PlanningProjectCode> =>
    (await api.post("/api/team-planning/projects/", { code, business_line })).data,

  setProjectActive: async (id: number, is_active: boolean): Promise<PlanningProjectCode> =>
    (await api.patch(`/api/team-planning/projects/${id}/`, { is_active })).data,

  importFile: async (file: File): Promise<ImportSummary> => {
    const fd = new FormData();
    fd.append("file", file);
    return (await api.post("/api/team-planning/import/", fd, { headers: { "Content-Type": undefined } })).data;
  },
};
