export interface Employee {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  fonction: string;
  sexe: "H" | "F" | null;
  date_embauche?: string;
  business_line?: string;
  projet?: string;
  service?: string;
  manager?: string;
  localisation?: string;
  email?: string;
  telephone?: string;
  has_user?: boolean
}
