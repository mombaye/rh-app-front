export type HierarchyType = 'FLAT' | 'WITH_RESPONSABLES' | 'COMPLETE';

export type MemberRole = 'CHEF' | 'RESPONSABLE' | 'SOUS_RESPONSABLE' | 'EMPLOYE';

export interface Department {
  id: number;
  name: string;
  description: string;
  hierarchy_type: HierarchyType;
  hierarchy_type_display: string;
  is_active: boolean;
  members_count: number;
  chef: {
    id: number;
    matricule: string;
    nom: string;
    prenom: string;
    fonction: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface DepartmentMember {
  id: number;
  department: number;
  employee: number;
  employee_name: string;
  employee_matricule: string;
  employee_fonction: string;
  role: MemberRole;
  role_display: string;
  reports_to: number | null;
  reports_to_name: string | null;
  subordinates_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgChartNode {
  id: number;
  employee_id: number;
  name: string;
  matricule: string;
  fonction: string;
  role: MemberRole;
  role_display: string;
  children: OrgChartNode[];
}

export interface DepartmentOrgChart {
  department: {
    id: number;
    name: string;
    hierarchy_type: HierarchyType;
  };
  tree: OrgChartNode[];
}

export const HIERARCHY_TYPE_LABELS: Record<HierarchyType, string> = {
  FLAT: 'Structure plate',
  WITH_RESPONSABLES: 'Avec responsables',
  COMPLETE: 'Hi\u00e9rarchie compl\u00e8te',
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  CHEF: 'Chef de d\u00e9partement',
  RESPONSABLE: 'Responsable',
  SOUS_RESPONSABLE: 'Sous-responsable',
  EMPLOYE: 'Employ\u00e9',
};

export const ROLE_COLORS: Record<MemberRole, string> = {
  CHEF: 'bg-blue-100 text-blue-800 border-blue-300',
  RESPONSABLE: 'bg-green-100 text-green-800 border-green-300',
  SOUS_RESPONSABLE: 'bg-orange-100 text-orange-800 border-orange-300',
  EMPLOYE: 'bg-gray-100 text-gray-800 border-gray-300',
};
