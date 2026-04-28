// src/services/hierarchyService.ts
// Service pour la gestion de la hiérarchie de validation des congés

import axios from "axios";
import {
  ApprovalRule,
  ApprovalRuleCreate,
  Department,
  DepartmentCreate,
  EmployeeHierarchy,
} from "../types/leave";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
const EMP_API  = `${BASE_URL}/api/employees`;
const LEAVE_API = `${BASE_URL}/api/leaves`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("access_token");
  return { Authorization: `Bearer ${token}` };
};

// ─────────────────────────────────────────────────────────────────────────────
// Department  →  /api/employees/departments/
// ─────────────────────────────────────────────────────────────────────────────
export const departmentService = {
  getAll: async (): Promise<Department[]> => {
    const res = await axios.get(`${EMP_API}/departments/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  create: async (data: DepartmentCreate): Promise<Department> => {
    const res = await axios.post(`${EMP_API}/departments/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  update: async (id: number, data: Partial<DepartmentCreate>): Promise<Department> => {
    const res = await axios.patch(`${EMP_API}/departments/${id}/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await axios.delete(`${EMP_API}/departments/${id}/`, {
      headers: getAuthHeaders(),
    });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Employee Hierarchy  →  /api/employees/hierarchy/
// ─────────────────────────────────────────────────────────────────────────────
export const employeeHierarchyService = {
  getAll: async (params?: { service?: string; search?: string }): Promise<EmployeeHierarchy[]> => {
    const res = await axios.get(`${EMP_API}/hierarchy/`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  },

  update: async (
    id: number,
    data: { n1_manager_id?: number | null; n2_manager_id?: number | null; requires_two_approvals?: boolean }
  ): Promise<EmployeeHierarchy> => {
    const res = await axios.patch(`${EMP_API}/hierarchy/${id}/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  getMyHierarchy: async (): Promise<MyHierarchyChain> => {
    const res = await axios.get(`${EMP_API}/hierarchy/my/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /** POST /api/employees/hierarchy/sync/ — Synchronisation complète hiérarchie → employés → users */
  syncAll: async (): Promise<{ message: string; employees_synced: number; users_checked: number }> => {
    const res = await axios.post(`${EMP_API}/hierarchy/sync/`, {}, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  /**
   * GET /api/employees/hierarchy/by-department/?name=<nom>
   * Retourne les managers N+1 et N+2 pour un département/service/projet donné.
   * Utilisé par le formulaire employé pour auto-remplir la hiérarchie.
   */
  getManagersByDepartment: async (name: string): Promise<DepartmentManagers> => {
    const res = await axios.get(`${EMP_API}/hierarchy/by-department/`, {
      headers: getAuthHeaders(),
      params: { name },
    });
    return res.data;
  },

  /**
   * GET /api/employees/hierarchy/dg/
   * Retourne le DG (Directeur Général) auto-détecté via is_superuser.
   * Permet d'afficher Eduard MAIRET dans l'organigramme sans saisie manuelle.
   */
  getGlobalDG: async (): Promise<{ dg: GlobalDGInfo | null; message?: string }> => {
    const res = await axios.get(`${EMP_API}/hierarchy/dg/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
};

export interface HierarchyMini {
  id: number;
  matricule: string;
  full_name: string;
  fonction: string;
  service: string;
}

export interface DepartmentManagerMini {
  id: number;
  full_name: string;
  email: string;
  fonction: string;
  matricule: string;
}

export interface DepartmentManagers {
  n1_manager: DepartmentManagerMini | null;
  n2_manager: DepartmentManagerMini | null;
}

export interface GlobalDGInfo {
  id: number;
  matricule: string;
  full_name: string;
  fonction: string;
  service: string;
  email: string;
}

export interface ApprovalChainStep {
  step:     number;          // 1-indexed
  label:    string;          // "N+1", "N+2", "N+3"…
  approver: HierarchyMini;
}

export interface MyHierarchyChain {
  employee: HierarchyMini;
  /** Chaîne complète dynamique calculée depuis l'arborescence des départements */
  approval_chain: ApprovalChainStep[];
  total_steps: number;
  /** DG_ONLY = responsable dept racine | SINGLE = 1 validateur | MULTI = N validateurs */
  approval_flow: "DG_ONLY" | "SINGLE" | "MULTI";
  rh_validation: boolean;
  requires_two_approvals: boolean;
  // Rétrocompatibilité (step 1 et 2 uniquement)
  n1_manager: HierarchyMini | null;
  n2_manager: HierarchyMini | null;
  dg_info:    HierarchyMini | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ApprovalRule  →  /api/leaves/approval-rules/
// ─────────────────────────────────────────────────────────────────────────────
export const approvalRuleService = {
  getAll: async (): Promise<ApprovalRule[]> => {
    const res = await axios.get(`${LEAVE_API}/approval-rules/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  getActive: async (): Promise<ApprovalRule[]> => {
    const res = await axios.get(`${LEAVE_API}/approval-rules/active/`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  create: async (data: ApprovalRuleCreate): Promise<ApprovalRule> => {
    const res = await axios.post(`${LEAVE_API}/approval-rules/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  update: async (id: number, data: Partial<ApprovalRuleCreate>): Promise<ApprovalRule> => {
    const res = await axios.patch(`${LEAVE_API}/approval-rules/${id}/`, data, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await axios.delete(`${LEAVE_API}/approval-rules/${id}/`, {
      headers: getAuthHeaders(),
    });
  },

  checkRules: async (params: {
    employee_id: number;
    leave_type_id: number;
    days: number;
  }): Promise<{ triggered_rules: ApprovalRule[]; count: number }> => {
    const res = await axios.post(`${LEAVE_API}/approval-rules/check/`, params, {
      headers: getAuthHeaders(),
    });
    return res.data;
  },
};
