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
  user_id: number | null;
  user_is_active: boolean | null;
};

export type QuestionnaireSortieDetail = QuestionnaireSortieItem & {
  employee_fonction: string;
  // Anciens champs
  raison_depart_detail: string | null;
  satisfaction_generale: number | null;
  satisfaction_management: number | null;
  satisfaction_environnement: number | null;
  satisfaction_remuneration: number | null;
  recommandation: boolean | null;
  points_positifs: string | null;
  points_amelioration: string | null;
  commentaires: string | null;
  // Section 2
  motifs_depart: string[] | null;
  motifs_commentaires: string | null;
  evenement_declencheur: string | null;
  echange_manager_avant: string | null;
  // Section 3
  motivation_rejoindre: string | null;
  sat_missions: number | null;
  sat_moyens: number | null;
  sat_objectifs: number | null;
  sat_soutien: number | null;
  sat_charge_travail: number | null;
  sat_evolution_carriere: number | null;
  aspect_satisfaisant: string | null;
  aspect_insatisfaisant: string | null;
  competences_developpees: string | null;
  // Section 4
  rel_support_groupe: number | null;
  rel_direction_filiale: number | null;
  rel_manager: number | null;
  rel_collegues: number | null;
  rel_autres_services: number | null;
  rel_clients: number | null;
  rel_fournisseurs: number | null;
  rel_sous_traitants: number | null;
  rel_commentaire: string | null;
  amelioration_environnement: string | null;
  // Section 5
  profil_remplacement: string | null;
  qualites_poste: string | null;
  retravaillerait_camusat: "oui" | "non" | "peut_etre" | null;
  recommande_camusat: "oui" | "non" | "peut_etre" | null;
  nouveau_poste_entreprise: string | null;
  suggestions_commentaires: string | null;
  sat_comments: Record<string, string> | null;
  rel_comments: Record<string, string> | null;
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
  // Section 2
  motifs_depart: string[];
  motifs_commentaires?: string;
  evenement_declencheur?: string;
  echange_manager_avant?: string;
  // Section 3
  motivation_rejoindre?: string;
  sat_missions: number;
  sat_moyens: number;
  sat_objectifs: number;
  sat_soutien: number;
  sat_charge_travail: number;
  sat_evolution_carriere: number;
  aspect_satisfaisant?: string;
  aspect_insatisfaisant?: string;
  competences_developpees?: string;
  // Section 4
  rel_support_groupe: number;
  rel_direction_filiale: number;
  rel_manager: number;
  rel_collegues: number;
  rel_autres_services: number;
  rel_clients: number;
  rel_fournisseurs: number;
  rel_sous_traitants: number;
  rel_commentaire?: string;
  amelioration_environnement?: string;
  // Commentaires libres par question (JSON)
  sat_comments?: Record<string, string>;  // {missions:"...", moyens:"...", ...}
  rel_comments?: Record<string, string>;  // {support:"...", direction:"...", ...}
  // Section 5
  profil_remplacement?: string;
  qualites_poste?: string;
  retravaillerait_camusat: "oui" | "non" | "peut_etre";
  recommande_camusat: "oui" | "non" | "peut_etre";
  nouveau_poste_entreprise?: string;
  suggestions_commentaires?: string;
};

export type MonQuestionnaire = {
  id: number;
  token: string;
  statut: StatutQuestionnaire;
  date_envoi: string;
  date_reponse: string | null;
  date_sortie: string | null;
  employee_nom: string;
  employee_prenom: string;
  employee_matricule: string;
};

// ── RH : activer / désactiver le compte de l'employé ─────────────────────────
export const toggleCompteQuestionnaire = async (
  id: number
): Promise<{ message: string; is_active: boolean }> => {
  const res = await api.post(`/api/questionnaires-sortie/${id}/toggle-compte/`);
  return res.data;
};

// ── Employé : son propre questionnaire ───────────────────────────────────────
export const getMonQuestionnaire = async (): Promise<MonQuestionnaire> => {
  const res = await api.get("/api/questionnaires-sortie/mon-questionnaire/");
  return res.data;
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
  { value: "contenu_poste",       label: "Contenu du poste insatisfaisant" },
  { value: "reprise_etudes",      label: "Reprise des études" },
  { value: "strategie",           label: "Stratégie de l'entreprise" },
  { value: "obligations_famille", label: "Obligations familiales" },
  { value: "ambiance_travail",    label: "Ambiance au travail" },
  { value: "reconversion",        label: "Reconversion professionnelle" },
  { value: "management",          label: "Problèmes de management" },
  { value: "reconnaissance",      label: "Manque de reconnaissance" },
  { value: "remuneration",        label: "Rémunération" },
  { value: "evolution",           label: "Manque de possibilités d'évolution" },
  { value: "autre",               label: "Autres" },
] as const;

export const OUI_NON_LABELS: Record<string, string> = {
  oui:       "Oui",
  non:       "Non",
  peut_etre: "Peut-être",
};

// Emojis + libellés exacts du document Word
export const SAT4_LABELS   = ["Très insatisfait", "Insatisfait", "Satisfait", "Très satisfait"];
export const SAT4_EMOJIS   = ["😢", "😟", "😊", "😄"];
export const REL5_LABELS   = ["Très mauvaise", "Mauvaise", "Bonne", "Très bonne", "N/A"];
export const REL5_EMOJIS   = ["😢", "😟", "😊", "😄", "N/A"];
