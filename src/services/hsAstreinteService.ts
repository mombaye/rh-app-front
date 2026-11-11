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
  /** Zone d'intervention (reprise du fichier importé), vide si inconnue */
  zone?: string;
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

export interface HsImportResult {
  dry_run: boolean;
  overwrite: boolean;
  sheet: string;
  sheets: { name: string; start: string; end: string }[];
  sheet_period: { start: string; end: string };
  campaign_period: { start: string; end: string };
  employees_in_file: number;
  matched: number;
  unmatched: string[];
  unmatched_count: number;
  zones_updated: number;
  written: number;
  overwritten: number;
  kept: number;
  same_as_auto: number;
  unknown_codes: number;
  days_off_refused: number;
  out_of_range: number;
  after_exit: number;
}

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

  importFile: async (file: File, campaign: number, opts: { dryRun?: boolean; sheet?: string; overwrite?: boolean } = {}): Promise<HsImportResult> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("campaign", String(campaign));
    fd.append("dry_run", opts.dryRun ? "true" : "false");
    fd.append("overwrite", opts.overwrite ? "true" : "false");
    if (opts.sheet) fd.append("sheet", opts.sheet);
    return (await api.post(`${BASE}/import/`, fd)).data;
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
