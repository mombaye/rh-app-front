import api from "@/api/axios";

export interface HierarchyNode {
  id: number;
  nom: string;
  prenom: string;
  fonction: string;
  service: string;
  business_line: string;
  manager: string;
  localisation: string;
  children: HierarchyNode[];
}

export interface HierarchyResponse {
  tree: HierarchyNode[];
  total: number;
}

export const getHierarchy = async (): Promise<HierarchyResponse> => {
  const res = await api.get("/api/employees/hierarchy/");
  return res.data;
};
