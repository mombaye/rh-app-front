// types/employee.ts
export type EmployeeStatus = 'ACTIVE' | 'EXITED' | 'SUSPENDED';

// ✅ Mise à jour : ajout de CDD, STAGE en plus de CDI et INTERIM
export type ContractType = 'CDI' | 'CDD' | 'STAGE' | 'INTERIM';

export interface Employee {
  id: number;
  matricule: string;
  department: string;
  nom: string;
  username: string;
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
  type_contrat: ContractType;

  // Backend
  status: EmployeeStatus;
  date_sortie?: string | null;
  motif_sortie?: string | null;
  is_active_employee?: boolean;
  has_user?: boolean;
}