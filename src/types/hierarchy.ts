export type HierarchyConfigType = 'FLAT' | 'WITH_MANAGERS' | 'FULL';

export type HierarchyLevel = 'CHEF_DEPT' | 'RESPONSABLE' | 'SOUS_RESPONSABLE' | 'EMPLOYE';

export const HIERARCHY_CONFIG_LABELS: Record<HierarchyConfigType, string> = {
  FLAT: 'Structure plate (Chef → Employés)',
  WITH_MANAGERS: 'Avec responsables (Chef → Responsables → Employés)',
  FULL: 'Hiérarchie complète (Chef → Responsable → Sous-resp. → Employés)',
};

export const HIERARCHY_LEVEL_LABELS: Record<HierarchyLevel, string> = {
  CHEF_DEPT: 'Chef de département',
  RESPONSABLE: 'Responsable',
  SOUS_RESPONSABLE: 'Sous-responsable',
  EMPLOYE: 'Employé',
};

// Niveaux disponibles selon la config
export const CONFIG_LEVELS: Record<HierarchyConfigType, HierarchyLevel[]> = {
  FLAT: ['CHEF_DEPT', 'EMPLOYE'],
  WITH_MANAGERS: ['CHEF_DEPT', 'RESPONSABLE', 'EMPLOYE'],
  FULL: ['CHEF_DEPT', 'RESPONSABLE', 'SOUS_RESPONSABLE', 'EMPLOYE'],
};

export interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
  hierarchy_config: HierarchyConfigType;
  is_active: boolean;
  node_count: number;
  created_at: string;
  updated_at: string;
}

export interface HierarchyNode {
  id: number;
  department: number;
  employee: number | null;
  level: HierarchyLevel;
  level_display: string;
  parent: number | null;
  title: string;
  is_active: boolean;
  order: number;
  employee_nom: string | null;
  employee_prenom: string | null;
  employee_matricule: string | null;
  employee_fonction: string | null;
  children_count: number;
}

export interface HierarchyNodeTree extends Omit<HierarchyNode, 'children_count'> {
  children: HierarchyNodeTree[];
}

export interface DepartmentWithTree {
  department: Department;
  tree: HierarchyNodeTree[];
}
