export type HierarchyType = 'FLAT' | 'WITH_RESPONSABLES' | 'FULL';
export type MemberRole = 'CHEF' | 'RESPONSABLE' | 'SOUS_RESPONSABLE' | 'EMPLOYE';

export interface EmployeeMinimal {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  fonction: string;
}

export interface DepartmentMember {
  id: number;
  department: number;
  employee: number;
  employee_detail: EmployeeMinimal;
  role: MemberRole;
  parent: number | null;
  direct_reports: DepartmentMember[];
  created_at: string;
}

export interface Department {
  id: number;
  nom: string;
  description?: string | null;
  code?: string | null;
  hierarchy_type: HierarchyType;
  chef: number | null;
  chef_detail?: EmployeeMinimal | null;
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface DepartmentTree {
  id: number;
  nom: string;
  description?: string | null;
  code?: string | null;
  hierarchy_type: HierarchyType;
  chef: number | null;
  chef_detail?: EmployeeMinimal | null;
  tree: DepartmentMember[];
}
