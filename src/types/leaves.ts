// src/types/leaves.ts

export type HierarchyType = 'FLAT' | 'WITH_RESPONSABLE' | 'FULL';

export type HierarchyRole =
  | 'DIRECTION'
  | 'CHEF'
  | 'RESPONSABLE'
  | 'SOUS_RESPONSABLE'
  | 'EMPLOYE';

export const HIERARCHY_TYPE_LABELS: Record<HierarchyType, string> = {
  FLAT:             'Structure plate (Cas 1)',
  WITH_RESPONSABLE: 'Avec responsables (Cas 2)',
  FULL:             'Hiérarchie complète (Cas 3)',
};

export const HIERARCHY_ROLE_LABELS: Record<HierarchyRole, string> = {
  DIRECTION:        'Direction Générale',
  CHEF:             'Chef de département',
  RESPONSABLE:      'Responsable',
  SOUS_RESPONSABLE: 'Sous-responsable',
  EMPLOYE:          'Employé',
};

export const ROLES_FOR_TYPE: Record<HierarchyType, HierarchyRole[]> = {
  FLAT:             ['CHEF', 'EMPLOYE'],
  WITH_RESPONSABLE: ['CHEF', 'RESPONSABLE', 'EMPLOYE'],
  FULL:             ['CHEF', 'RESPONSABLE', 'SOUS_RESPONSABLE', 'EMPLOYE'],
};

// ─── API response types ───────────────────────────────────────────

export interface EmployeeMini {
  id: number;
  matricule: string;
  full_name: string;
  fonction: string;
  service: string;
  manager: string;
}

export interface DepartmentHierarchyConfig {
  id: number;
  department_name: string;
  hierarchy_type: HierarchyType;
  hierarchy_label: string;
  chef: EmployeeMini | null;
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeeHierarchyRole {
  id: number;
  employee: EmployeeMini;
  role: HierarchyRole;
  role_label: string;
  department_config: number | null;
  department_name: string | null;
  supervisor: EmployeeMini | null;
}

// ─── Tree ────────────────────────────────────────────────────────

export interface HierarchyNode {
  id: number;
  employee_id: number;
  full_name: string;
  matricule: string;
  fonction: string;
  role: HierarchyRole;
  role_label: string;
  children: HierarchyNode[];
}

export interface HierarchyTree {
  department_id: number;
  department_name: string;
  hierarchy_type: HierarchyType;
  hierarchy_label: string;
  chef: { employee_id: number; full_name: string; matricule: string } | null;
  nodes: HierarchyNode[];
}

// ─── from-employees endpoint ──────────────────────────────────────

export interface DepartmentFromEmployees {
  department_name: string;
  configured: boolean;
  config: DepartmentHierarchyConfig | null;
}

// ─── Bulk assign ─────────────────────────────────────────────────

export interface BulkRoleItem {
  employee_id: number;
  role: HierarchyRole;
  supervisor_id?: number | null;
}
