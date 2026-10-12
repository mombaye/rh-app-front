import api from "@/api/axios";

export type HsCode = "" | "X" | "Y" | "Z" | "C" | "A" | "M";

export interface HsCell {
  code: HsCode;
  auto: boolean;
  /** pointage / mission / conge / maladie / sortie : rempli automatiquement */
  source?: string;
  /** suggestion HS / astreinte (jour pointé au-delà de l'horaire ou non ouvré) */
  hint?: string;
}

export interface HsTotals {
  jours_travailles: number;
  jours_normaux: number;
  nb_heures_sup: number;
  nb_jours_astreintes: number;
  heures_normales: number;
  heures_sup_effectuees: number;
  heures_astreintes: number;
  heures_totales: number;
}

export interface HsRow extends HsTotals {
  employee_id: number;
  matricule: string;
  nom: string;
  prenom: string;
  service: string;
  filler: string;
  cells: HsCell[];
}

export interface HsGrid {
  year: number;
  month: number;
  is_rh: boolean;
  editable: boolean;
  lock_reason: string;
  lock: { past_deadline: boolean; rh_locked: boolean; force_unlock: boolean; locked: boolean };
  days: { day: number; weekday: number; holiday: string }[];
  fillers: string[];
  rows: HsRow[];
}

export interface HsChange { employee_id: number; day: number; code: HsCode }

export interface EmpBrief { id: number; matricule: string; nom: string; prenom: string; service: string; n1: string }

const BASE = "/api/attendance/hs-astreinte";
const accessCache = new Map<number | string, Promise<boolean>>();

export const hsAstreinteService = {
  /** Menu visible seulement pour la RH et les personnes qui ont des employés à remplir. */
  hasAccess: (userId: number | string): Promise<boolean> => {
    if (!accessCache.has(userId)) {
      accessCache.set(userId, api.get(`${BASE}/access/`)
        .then((r) => !!r.data?.allowed)
        .catch(() => { accessCache.delete(userId); return false; }));
    }
    return accessCache.get(userId)!;
  },

  getGrid: async (year: number, month: number, filler = ""): Promise<HsGrid> =>
    (await api.get(`${BASE}/grid/`, { params: { year, month, ...(filler ? { filler } : {}) } })).data,

  save: async (year: number, month: number, changes: HsChange[]): Promise<{ rows: HsRow[]; errors: string[] }> =>
    (await api.post(`${BASE}/save/`, { year, month, changes })).data,

  getAssignments: async (): Promise<{ groups: { filler: EmpBrief; employee_ids: number[] }[]; employees: EmpBrief[]; managers: EmpBrief[] }> =>
    (await api.get(`${BASE}/assignments/`)).data,

  setAssignments: async (filler_id: number, employee_ids: number[]) =>
    (await api.post(`${BASE}/assignments/`, { filler_id, employee_ids })).data,

  getBeneficiaries: async (): Promise<{ employee_ids: number[]; employees: EmpBrief[] }> =>
    (await api.get(`${BASE}/beneficiaries/`)).data,

  setBeneficiaries: async (employee_ids: number[]) =>
    (await api.post(`${BASE}/beneficiaries/`, { employee_ids })).data,

  // Verrou de période (RH) — endpoints existants
  setLock: async (year: number, month: number, locked: boolean) =>
    (await api.post("/api/attendance/om-pointage/set-lock/", { year, month, locked })).data,

  activateSession: async (year: number, month: number) =>
    (await api.post("/api/attendance/om-pointage/activate-session/", { year, month })).data,
};
