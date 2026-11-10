import api from "@/api/axios";

/** D = Days Off (seulement pour les BL où l'option est activée, ex. BL4) */
export type HsCode = "" | "X" | "Y" | "Z" | "C" | "A" | "M" | "D";

export interface HsCell {
  code: HsCode;
  auto: boolean;
  /** pointage / mission / conge / maladie / sortie : rempli automatiquement */
  source?: string;
  /** suggestion HS / astreinte (jour pointé au-delà de l'horaire ou non ouvré) */
  hint?: string;
  /** jour après la date de sortie de l'employé : non modifiable */
  locked?: boolean;
}

export interface HsTotals {
  jours_travailles: number;
  jours_normaux: number;
  nb_heures_sup: number;
  nb_jours_astreintes: number;
  nb_days_off: number;
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
  /** BL normalisée (ex. « BL4 »), vide si non renseignée */
  bl: string;
  status: string;
  exit_date: string | null;
  days_off_allowed: boolean;
  n1: string;
  n2: string;
  cells: HsCell[];
}

export type CampaignStatus = "DRAFT" | "OPEN" | "CLOSED";

export interface HsCampaign {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  status: CampaignStatus;
  status_label: string;
  nb_days: number;
  opened_at: string | null;
}

export interface HsDay { date: string; day: number; month: number; weekday: number; holiday: string }

export interface HsGrid {
  is_rh: boolean;
  campaigns: HsCampaign[];
  campaign: HsCampaign | null;
  my_bls: string[];
  days_off_bls: string[];
  editable: boolean;
  lock_reason: string;
  days: HsDay[];
  /** BL présentes dans le périmètre ; NO_BL = « Sans BL » (RH) */
  business_lines: string[];
  rows: HsRow[];
}

export const NO_BL = "__none__";

export interface HsChange { employee_id: number; date: string; code: HsCode }

export interface EmpBrief { id: number; matricule: string; nom: string; prenom: string; service: string; bl?: string; n1: string }

export interface HsBusinessLine {
  code: string;
  nb_agents: number;
  days_off_enabled: boolean;
  editor_ids: number[];
  editors: EmpBrief[];
}

const BASE = "/api/attendance/hs-astreinte";
const accessCache = new Map<number | string, Promise<boolean>>();

export const hsAstreinteService = {
  /** Menu visible seulement pour la RH et les éditeurs d'au moins une BL. */
  hasAccess: (userId: number | string): Promise<boolean> => {
    if (!accessCache.has(userId)) {
      accessCache.set(userId, api.get(`${BASE}/access/`)
        .then((r) => !!r.data?.allowed)
        .catch(() => { accessCache.delete(userId); return false; }));
    }
    return accessCache.get(userId)!;
  },

  getGrid: async (campaign?: number | null, bl = ""): Promise<HsGrid> =>
    (await api.get(`${BASE}/grid/`, { params: { ...(campaign ? { campaign } : {}), ...(bl ? { bl } : {}) } })).data,

  save: async (campaign: number, changes: HsChange[]): Promise<{ rows: HsRow[]; errors: string[] }> =>
    (await api.post(`${BASE}/save/`, { campaign, changes })).data,

  // Périodes de saisie (RH)
  createCampaign: async (data: { label: string; start_date: string; end_date: string }): Promise<HsCampaign> =>
    (await api.post(`${BASE}/campaigns/`, data)).data,

  updateCampaign: async (id: number, data: Partial<{ label: string; start_date: string; end_date: string }>): Promise<HsCampaign> =>
    (await api.patch(`${BASE}/campaigns/${id}/`, data)).data,

  deleteCampaign: async (id: number) =>
    (await api.delete(`${BASE}/campaigns/${id}/`)).data,

  setCampaignStatus: async (id: number, status: CampaignStatus): Promise<HsCampaign> =>
    (await api.post(`${BASE}/campaigns/${id}/status/`, { status })).data,

  // BL : éditeurs et Days Off (RH)
  getBusinessLines: async (): Promise<{ business_lines: HsBusinessLine[]; employees: EmpBrief[] }> =>
    (await api.get(`${BASE}/business-lines/`)).data,

  saveBusinessLine: async (code: string, editor_ids: number[], days_off_enabled: boolean)
    : Promise<{ business_lines: HsBusinessLine[]; employees: EmpBrief[] }> =>
    (await api.post(`${BASE}/business-lines/`, { code, editor_ids, days_off_enabled })).data,

  getBeneficiaries: async (): Promise<{ employee_ids: number[]; employees: EmpBrief[] }> =>
    (await api.get(`${BASE}/beneficiaries/`)).data,

  setBeneficiaries: async (employee_ids: number[]) =>
    (await api.post(`${BASE}/beneficiaries/`, { employee_ids })).data,
};

export function frDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function campaignLabel(c: HsCampaign): string {
  const range = `${frDate(c.start_date)} → ${frDate(c.end_date)}`;
  return c.label ? `${c.label} (${range})` : range;
}
