export type EmployeeStatus = 'ACTIVE' | 'EXITED' | 'SUSPENDED';

export interface Employee {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  fonction: string;
  sexe?: 'H' | 'F' | null;
  date_embauche?: string | null;
  business_line?: string | null;
  projet?: string | null;
  service?: string | null;
  manager?: string | null;
  localisation?: string | null;
  email?: string | null;
  telephone?: string | null;

  // Backend nouveaux champs
  status: EmployeeStatus;
  date_sortie?: string | null;
  motif_sortie?: string | null;
  is_active_employee?: boolean;

  // Type de contrat
  type_contrat?: string | null;

  // ── Mission / Déplacement professionnel ──────────────────
  on_mission?:      boolean;
  mission_label?:   string | null;
  mission_start?:   string | null;
  mission_end?:     string | null;

  // champ déjà utilisé dans ton code (si tu l'as côté backend)
  has_user?: boolean;
}
