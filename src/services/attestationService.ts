// src/services/attestationService.ts
import axios from "axios";
import { AttestationRequest, AttestationDocumentType, AttestationTemplate, TemplatePlaceholder, AttestationHistory } from "@/types/attestation";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
const API      = `${BASE_URL}/api/employees/attestations`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

export const attestationService = {
  // ── Lecture ─────────────────────────────────────────────────────────────────
  getAll: async (params?: { status?: string }): Promise<AttestationRequest[]> => {
    const res = await axios.get<AttestationRequest[]>(API + "/", {
      headers: authHeaders(),
      params,
    });
    return res.data;
  },

  getMine: async (): Promise<AttestationRequest[]> => {
    const res = await axios.get<AttestationRequest[]>(API + "/", {
      headers: authHeaders(),
    });
    return res.data;
  },

  // ── Création ─────────────────────────────────────────────────────────────────
  create: async (payload: {
    document_type: AttestationDocumentType;
    extra_data?:   Record<string, string>;
    employee?:     number;   // RH only
  }): Promise<AttestationRequest> => {
    const res = await axios.post<AttestationRequest>(API + "/", payload, {
      headers: authHeaders(),
    });
    return res.data;
  },

  // ── Actions RH ───────────────────────────────────────────────────────────────
  process: async (id: number, notes?: string): Promise<AttestationRequest> => {
    const res = await axios.post<AttestationRequest>(
      `${API}/${id}/process/`,
      { notes: notes || "" },
      { headers: authHeaders() },
    );
    return res.data;
  },

  reject: async (id: number, notes: string): Promise<AttestationRequest> => {
    const res = await axios.post<AttestationRequest>(
      `${API}/${id}/reject/`,
      { notes },
      { headers: authHeaders() },
    );
    return res.data;
  },

  regenerate: async (id: number): Promise<AttestationRequest> => {
    const res = await axios.post<AttestationRequest>(
      `${API}/${id}/regenerate/`,
      {},
      { headers: authHeaders() },
    );
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await axios.delete(`${API}/${id}/`, { headers: authHeaders() });
  },

  getHistory: async (id: number): Promise<AttestationHistory[]> => {
    const res = await axios.get<AttestationHistory[]>(`${API}/${id}/history/`, {
      headers: authHeaders(),
    });
    return res.data;
  },
};

// ── Gestion des templates de documents ──────────────────────────────────────

const TEMPLATE_API = `${BASE_URL}/api/employees/attestation-templates`;

export const templateService = {
  getAll: async (): Promise<AttestationTemplate[]> => {
    const res = await axios.get<AttestationTemplate[]>(TEMPLATE_API + "/", {
      headers: authHeaders(),
    });
    return res.data;
  },

  upload: async (documentType: AttestationDocumentType, file: File): Promise<AttestationTemplate> => {
    const formData = new FormData();
    formData.append("document_type",  documentType);
    formData.append("template_file",  file);
    const res = await axios.post<AttestationTemplate>(TEMPLATE_API + "/", formData, {
      headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await axios.delete(`${TEMPLATE_API}/${id}/`, { headers: authHeaders() });
  },

  getPlaceholders: async (): Promise<TemplatePlaceholder[]> => {
    const res = await axios.get<TemplatePlaceholder[]>(
      `${BASE_URL}/api/employees/attestation-template-placeholders/`,
      { headers: authHeaders() },
    );
    return res.data;
  },
};

// ── Profil employé pour pré-remplissage ──────────────────────────────────────
export interface AttestationProfile {
  prenom:          string;
  nom:             string;
  sexe:            string;
  date_naissance:  string;
  lieu_naissance:  string;
  numero_piece:    string;
  type_contrat:    string;
  date_embauche:   string;
  date_fin_cdd:    string;
  fonction:        string;
  banque:          string;
  rib:             string;
}

export const getAttestationProfile = async (): Promise<AttestationProfile> => {
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
  const res = await axios.get<AttestationProfile>(
    `${BASE_URL}/api/employees/attestation-profile/`,
    { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } },
  );
  return res.data;
};
