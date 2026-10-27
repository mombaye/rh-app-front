import api from "@/api/axios";

export type CellKind = "project" | "weekend" | "holiday" | "leave" | "empty" | "exited";

export interface PlanningCell {
  value: string;
  kind: CellKind;
  auto: boolean;
  /** pointage / mission : jour travaillé (projet rempli automatiquement) ; absent : jour passé sans pointage */
  source?: "pointage" | "mission" | "absent" | "forfait" | "fixe";
}

export interface PlanningRow {
  /** Toutes les BL de l'employé (ex. BL2/BL3) : il saisit les codes de chacune */
  business_lines?: string[];
  employee_id: number;
  matricule: string;
  nom: string;
  prenom: string;
  business_line: string;
  line_manager: string;
  /** BL remplie d'office (ex. BL5, NOPE) : aucun code projet à saisir */
  auto_filled?: boolean;
  /** Code projet fixe importé : jours remplis d'office avec ce code */
  fixed_code?: string;
  /** Date de sortie (employé sorti) : les jours suivants sont grisés et non modifiables */
  exit_date?: string | null;
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
  dry_run?: boolean;
  // Fichier « Team planning » (codes projets et saisies)
  projects?: Record<string, number>;
  entries?: number;
  ignored_entries?: number;
  bl_to_update?: string[];
  manager_to_update?: string[];
  // Fichier « LISTE AGENTS » (BL et responsables)
  rows?: number;
  bl_updated?: number;
  managers_updated?: number;
  new_business_lines?: number;
  multi_bl?: string[];
  unresolved_managers?: string[];
  exited_employees?: string[];
  exited_kept?: string[];
  fixed_codes?: number;
  fixed_removed?: number;
  bl_changes?: string[];
  fixed_from_bl?: string[];
  managers?: string[];
  // Commun
  unknown_employees: string[];
  new_projects?: number;
}

export interface PlanningProjectCode {
  id: number;
  code: string;
  business_line: string;
  is_active: boolean;
}

export interface BusinessLineInfo {
  code: string;
  label: string;
  active_codes: number;
  inactive_codes: number;
  employees: number;
  created_here: boolean;
}

export interface BlEmployee {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  service: string;
  fonction: string;
  line_manager: string;
  /** candidat : BL écrite dans sa fiche mais non créée sur la plateforme */
  previous_bl?: string;
}

export interface BlEmployees {
  business_line: string;
  members: BlEmployee[];
  /** employés actifs sans Business Line (seuls ajoutables) */
  candidates: BlEmployee[];
}

export interface FillRateRow {
  employee_id: number;
  matricule: string;
  nom: string;
  prenom: string;
  business_line: string;
  line_manager: string;
  /** jours ouvrés hors congés (week-ends et fériés exclus, sauf s'ils portent un projet) */
  total_days: number;
  project_days: number;
  pct: number;
  projects: { code: string; days: number; pct: number }[];
  /** BL comptée d'office à 100 % (ex. BL5, NOPE) */
  forced?: boolean;
  fixed_code?: string;
  exit_date?: string | null;
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

  listBusinessLines: async (): Promise<BusinessLineInfo[]> =>
    (await api.get("/api/team-planning/business-lines/")).data,

  createBusinessLine: async (code: string, label: string): Promise<{ code: string; label: string }> =>
    (await api.post("/api/team-planning/business-lines/", { code, label })).data,

  getBlEmployees: async (bl: string): Promise<BlEmployees> =>
    (await api.get(`/api/team-planning/business-lines/${encodeURIComponent(bl)}/employees/`)).data,

  setBlEmployees: async (bl: string, add: number[], remove: number[]): Promise<BlEmployees & { added: number; removed: number; skipped: number }> =>
    (await api.post(`/api/team-planning/business-lines/${encodeURIComponent(bl)}/employees/`, { add, remove })).data,

  getAllEmployeesBl: async (): Promise<{ business_lines: string[]; employees: (BlEmployee & { business_line: string; bl_unknown?: boolean })[] }> =>
    (await api.get("/api/team-planning/business-lines/all-employees/")).data,

  setEmployeeBl: async (employee_id: number, business_line: string): Promise<BlEmployee & { business_line: string }> =>
    (await api.post("/api/team-planning/business-lines/all-employees/", { employee_id, business_line })).data,

  getFillRates: async (filters: PlanningFilters): Promise<{ year: number; month: number; rows: FillRateRow[] }> =>
    (await api.get("/api/team-planning/fill-rates/", { params: clean(filters) })).data,

  fillReport: async (filters: PlanningFilters): Promise<Blob> =>
    (await api.get("/api/team-planning/fill-report/", { params: clean(filters), responseType: "blob" })).data,

  importFile: async (file: File, dryRun = false): Promise<ImportSummary> => {
    const fd = new FormData();
    fd.append("file", file);
    if (dryRun) fd.append("dry_run", "1");
    return (await api.post("/api/team-planning/import/", fd, { headers: { "Content-Type": undefined } })).data;
  },

  /** Excel des matricules du fichier inconnus de l'application ou sortis (à corriger puis réimporter) */
  exportImportGaps: async (file: File): Promise<Blob> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("export", "1");
    return (await api.post("/api/team-planning/import/", fd, { headers: { "Content-Type": undefined }, responseType: "blob" })).data;
  },
};
