// types/employee.ts
export type EmployeeStatus = 'ACTIVE' | 'EXITED' | 'SUSPENDED';
export type ContractType = 'INTERNE' | 'INTERIM'; // Nouveau type

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
  type_contrat: ContractType; // Nouveau champ

  // Backend nouveaux champs
  status: EmployeeStatus;
  date_sortie?: string | null;
  motif_sortie?: string | null;
  is_active_employee?: boolean;

  // champ déjà utilisé dans ton code
  has_user?: boolean;
}
