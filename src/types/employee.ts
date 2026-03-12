export type EmployeeStatus = 'ACTIVE' | 'EXITED' | 'SUSPENDED';
export type ContractType   = 'CDI' | 'CDD' | 'STAGE' | 'INTERIM';
export type SexeType       = 'H' | 'F';
export type TypePiece      = 'CNI' | 'PASSEPORT' | 'SEJOUR' | 'AUTRE';
export type SituationMatrimoniale = 'celibataire' | 'marie' | 'divorce' | 'veuf';

export interface Enfant {
  nom:             string;
  date_naissance:  string;
}

export interface Employee {
  id:            number;
  employee_id?:  number | null;
  username?:     string;
  department?:   string;

  // ── Contrat ──────────────────────────────────────────────
  type_contrat:  ContractType;

  // ── Identité ─────────────────────────────────────────────
  matricule:      string;
  nom:            string;
  prenom:         string;
  sexe?:          SexeType | null;
  date_naissance?: string | null;
  lieu_naissance?: string | null;
  nationalite?:    string | null;
  adresse?:        string | null;

  // ── Pièce d'identité ─────────────────────────────────────
  type_piece?:      TypePiece | null;
  numero_piece?:    string | null;
  date_delivrance?: string | null;
  date_expiration?: string | null;

  // ── Contact d'urgence ────────────────────────────────────
  contact_urgence_nom?:       string | null;
  contact_urgence_telephone?: string | null;

  // ── Famille ──────────────────────────────────────────────
  prenom_pere?:            string | null;
  nom_prenom_mere?:        string | null;
  situation_matrimoniale?: SituationMatrimoniale | null;
  nom_conjoint?:           string | null;
  nombre_enfants?:         number;
  enfants?:                Enfant[];

  // ── Banque ───────────────────────────────────────────────
  rib?:    string | null;
  banque?: string | null;

  // ── Informations professionnelles ─────────────────────────
  fonction?:               string | null;
  categorie?:              string | null;
  date_embauche?:          string | null;
  date_fin_cdd?:           string | null;
  date_fin_periode_essai?: string | null;
  business_line?:          string | null;
  projet?:                 string | null;
  service?:                string | null;
  manager?:                string | null;
  localisation?:           string | null;
  email?:                  string | null;
  telephone?:              string | null;
  anciennete?:             number | null;  // calculé par le backend

  // ── Statut RH ─────────────────────────────────────────────
  status:           EmployeeStatus;
  date_sortie?:     string | null;
  motif_sortie?:    string | null;
  attendance_status?: string | null;
  is_active_employee?: boolean;
  has_user?:           boolean;
}

export interface EmployeeHistoryEntry {
  id:          number;
  modified_by: string;
  modified_at: string;
  changes:     Record<string, { old: unknown; new: unknown }>;
}
