export type EmployeeStatus = 'ACTIVE' | 'EXITED' | 'SUSPENDED';

export type ContractType = 'CDI' | 'CDD' | 'STAGE' | 'INTERIM';

export interface Employee {
  id: number;
  employee_id: Int16Array;
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
  status: EmployeeStatus;
  date_sortie?: string | null;
  motif_sortie?: string | null;
  is_active_employee?: boolean;
  has_user?: boolean;
}
