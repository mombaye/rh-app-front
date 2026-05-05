import api from "@/api/axios";
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StatutQuestionnaire = "envoye" | "complete";

export type QuestionnaireSortieItem = {
  id: number;
  token: string;
  statut: StatutQuestionnaire;
  employee: number;
  employee_nom: string;
  employee_prenom: string;
  employee_matricule: string;
  employee_email: string;
  employee_service: string;
  envoye_par: string;
  date_envoi: string;
  date_reponse: string | null;
  raison_depart: string | null;
  raison_depart_label: string | null;
};

export type QuestionnaireSortieDetail = QuestionnaireSortieItem & {
  employee_fonction: string;
  raison_depart_detail: string | null;
  satisfaction_generale: number | null;
  satisfaction_management: number | null;
  satisfaction_environnement: number | null;
  satisfaction_remuneration: number | null;
  recommandation: boolean | null;
  points_positifs: string | null;
  points_amelioration: string | null;
  commentaires: string | null;
};

export type QuestionnairePublicInfo = {
  token: string;
  employee_nom: string;
  employee_prenom: string;
  employee_matricule: string;
  employee_fonction: string;
  employee_service: string;
  date_sortie: string;
  already_completed: boolean;
  detail?: string;
};

export type RepondrePayload = {
  raison_depart: string;
  raison_depart_detail?: string;
  satisfaction_generale: number;
  satisfaction_management: number;
  satisfaction_environnement: number;
  satisfaction_remuneration: number;
  recommandation: boolean;
  points_positifs?: string;
  points_amelioration?: string;
  commentaires?: string;
};

// ── RH : liste ───────────────────────────────────────────────────────────────
export const getQuestionnaires = async (
  statut?: StatutQuestionnaire
): Promise<{ count: number; results: QuestionnaireSortieItem[] }> => {
  const params: Record<string, string> = {};
  if (statut) params.statut = statut;
  const res = await api.get("/api/questionnaires-sortie/", { params });
  return res.data;
};

// ── RH : détail ───────────────────────────────────────────────────────────────
export const getQuestionnaireDetail = async (
  id: number
): Promise<QuestionnaireSortieDetail> => {
  const res = await api.get(`/api/questionnaires-sortie/${id}/`);
  return res.data;
};

// ── RH : envoyer ─────────────────────────────────────────────────────────────
export const envoyerQuestionnaire = async (
  employeeId: number
): Promise<{ detail: string; token: string }> => {
  const res = await api.post("/api/questionnaires-sortie/envoyer/", {
    employee_id: employeeId,
  });
  return res.data;
};

// ── Public : récupérer le questionnaire par token (sans auth) ─────────────────
export const getQuestionnairePublic = async (
  token: string
): Promise<QuestionnairePublicInfo> => {
  const res = await axios.get(
    `${BASE_URL}/api/questionnaires-sortie/public/${token}/`
  );
  return res.data;
};

// ── Public : soumettre les réponses (sans auth) ───────────────────────────────
export const repondreQuestionnaire = async (
  token: string,
  payload: RepondrePayload
): Promise<{ detail: string }> => {
  const res = await axios.post(
    `${BASE_URL}/api/questionnaires-sortie/public/${token}/repondre/`,
    payload
  );
  return res.data;
};

// ── Constantes affichage ──────────────────────────────────────────────────────
export const RAISONS_DEPART = [
  { value: "opportunite_pro",      label: "Autre opportunité professionnelle" },
  { value: "conditions_travail",   label: "Conditions de travail" },
  { value: "remuneration",         label: "Rémunération insuffisante" },
  { value: "relations_hierarchie", label: "Relations avec la hiérarchie" },
  { value: "raisons_personnelles", label: "Raisons personnelles" },
  { value: "fin_contrat",          label: "Fin de contrat" },
  { value: "retraite",             label: "Retraite" },
  { value: "autre",                label: "Autre" },
] as const;
