export type HierarchyType = 'FLAT' | 'WITH_MANAGERS' | 'FULL';

export type MemberRole = 'CHEF' | 'RESPONSABLE' | 'SOUS_RESPONSABLE' | 'EMPLOYE';

export interface Department {
  id: number;
  nom: string;
  code: string;
  description: string;
  hierarchy_type: HierarchyType;
  hierarchy_type_display: string;
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface DepartmentMember {
  id: number;
  department: number;
  employee: number;
  employee_nom: string;
  employee_prenom: string;
  employee_matricule: string;
  employee_fonction: string;
  role: MemberRole;
  role_display: string;
  parent: number | null;
  parent_nom: string | null;
  created_at: string;
}

export interface TreeNode {
  id: number;
  employee_id: number;
  matricule: string;
  nom: string;
  prenom: string;
  fonction: string;
  role: MemberRole;
  role_display: string;
  children: TreeNode[];
}

export interface DepartmentTree {
  id: number;
  nom: string;
  code: string;
  description: string;
  hierarchy_type: HierarchyType;
  hierarchy_type_display: string;
  tree: TreeNode[];
}
