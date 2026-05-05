export type EmployeeStatus = 'ACTIVE' | 'EXITED' | 'SUSPENDED';
export type ContractType   = 'CDI' | 'CDD' | 'STAGE' | 'INTERIM';
export type SexeType       = 'H' | 'F';
export type TypePiece      = 'CNI' | 'PASSEPORT' | 'SEJOUR' | 'AUTRE';
export type SituationMatrimoniale = 'celibataire' | 'marie' | 'concubinage' | 'divorce' | 'separe' | 'veuf';

export interface Enfant {
  nom:             string;
  prenom:          string;
  sexe:            string;
  date_naissance:  string;
  lieu_naissance:  string;
}

export interface Diplome {
  intitule:       string;   // Diplôme obtenu ou Niveau d'Études
  annee:          string;   // Année d'obtention
  etablissement:  string;   // Nom de l'Établissement
}

export interface Employee {
  id:            number;
  employee_id?:  number | null;
  username?:     string;
  department?:   string;

  // ── Contrat ──────────────────────────────────────────────
  type_contrat:  ContractType;

  // ── Identité ─────────────────────────────────────────────
  matricule:               string;
  nom:                     string;
  prenom:                  string;
  nom_jeune_fille?:        string | null;
  sexe?:                   SexeType | null;
  date_naissance?:         string | null;
  lieu_naissance?:         string | null;
  nationalite?:            string | null;
  numero_securite_sociale?: string | null;
  adresse?:                string | null;

  // ── Pièce d'identité principale ──────────────────────────
  type_piece?:      TypePiece | null;
  numero_piece?:    string | null;
  date_delivrance?: string | null;
  delivre_par?:     string | null;
  date_expiration?: string | null;

  // ── Passeport ────────────────────────────────────────────
  has_passeport?:             boolean;
  passeport_numero?:          string | null;
  passeport_date_delivrance?: string | null;
  passeport_delivre_par?:     string | null;
  passeport_date_expiration?: string | null;

  // ── Permis de conduire ───────────────────────────────────
  has_permis?:             boolean;
  permis_numero?:          string | null;
  permis_date_delivrance?: string | null;
  permis_delivre_par?:     string | null;
  permis_date_expiration?: string | null;

  // ── Travailleur handicapé ────────────────────────────────
  est_travailleur_handicape?: boolean;
  handicap_date_delivrance?:  string | null;
  handicap_categorie?:        string | null;

  // ── Contacts d'urgence ───────────────────────────────────
  contact_urgence_nom?:        string | null;
  contact_urgence_telephone?:  string | null;
  contact_urgence2_nom?:       string | null;
  contact_urgence2_telephone?: string | null;

  // ── Famille ──────────────────────────────────────────────
  prenom_pere?:                 string | null;
  telephone_pere?:              string | null;
  nom_prenom_mere?:             string | null;
  telephone_mere?:              string | null;
  situation_matrimoniale?:      SituationMatrimoniale | null;
  nom_conjoint?:                string | null;
  partenaire_prenom?:           string | null;
  partenaire_date_naissance?:   string | null;
  partenaire_lieu_naissance?:   string | null;
  nombre_enfants?:              number;
  enfants?:                     Enfant[];

  // ── Banque ───────────────────────────────────────────────
  banque?:               string | null;
  adresse_banque?:       string | null;
  nom_beneficiaire?:     string | null;
  adresse_beneficiaire?: string | null;
  iban?:                 string | null;
  bic_swift?:            string | null;
  // RIB décomposé (format français)
  code_banque?:   string | null;
  code_guichet?:  string | null;
  numero_compte?: string | null;
  cle_rib?:       string | null;
  rib?:           string | null;  // conservé pour rétrocompat.

  // ── Diplômes ─────────────────────────────────────────────
  diplomes?: Diplome[];

  // ── Informations professionnelles ─────────────────────────
  fonction?:               string | null;
  categorie?:              string | null;
  date_embauche?:          string | null;
  date_fin_cdd?:             string | null;
  date_fin_periode_essai?:   string | null;
  date_fin_periode_essai_2?: string | null;
  business_line?:          string | null;
  projet?:                 string | null;
  service?:                string | null;
  manager?:                string | null;
  manager_email?:          string | null;
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

  // ── Mission / déplacement professionnel ─────────────────
  on_mission?:     boolean;
  mission_label?:  string | null;
  mission_start?:  string | null;
  mission_end?:    string | null;

  // ── Workflow congés — hiérarchie N+1 / N+2 ──────────────
  requires_two_approvals?: boolean;
  n1_manager?:       number | null;
  n2_manager?:       number | null;
  n1_manager_name?:  string | null;
  n2_manager_name?:  string | null;
  user_id?:          number | null;
  manages_n1_count?: number;
  manages_n2_count?: number;

  // ── Directeur Général (fixe) ─────────────────────────────
  // Un seul employé peut avoir is_dg=True — c'est Edouard MAIRET.
  // Seul le RH/Admin peut modifier ce champ.
  is_dg?: boolean;
}

export interface EmployeeHistoryEntry {
  id:          number;
  modified_by: string;
  modified_at: string;
  changes:     Record<string, { old: unknown; new: unknown }>;
}
