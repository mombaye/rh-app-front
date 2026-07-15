import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
const API = `${BASE_URL}/api/employees/passeports`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

export interface PassportFile {
  slug: string;
  file_name: string;
  display_name: string;
  nom_prenom: string;
  poste: string;
  date_embauche: string;
  qr_generated: boolean;
}

export interface PassportFormation {
  date_visite?: string | null;
  apte?: string | null;
  formateur?: string | null;
  date_formation?: string | null;
}

export interface PassportAutreFormation {
  intitule?: string | null;
  date?: string | null;
}

export interface PassportDetail extends PassportFile {
  societe?: string | null;
  adresse?: string | null;
  nom_prenom?: string | null;
  date_naissance?: string | null;
  poste?: string | null;
  ceo?: string | null;
  date_embauche?: string | null;
  contact?: string | null;
  formations?: {
    travail_hauteur: PassportFormation;
    habilitation_elec: PassportFormation;
    premiers_secours: PassportFormation;
    autres_formations: PassportAutreFormation[];
  };
  error?: string;
}

export interface UploadResult {
  extracted: string[];
  skipped: string[];
  files: PassportFile[];
}

export const passportService = {
  getAll: async (): Promise<PassportFile[]> => {
    const res = await axios.get<PassportFile[]>(`${API}/`, { headers: authHeaders() });
    return res.data;
  },

  getDetail: async (slug: string): Promise<PassportDetail> => {
    const res = await axios.get<PassportDetail>(`${API}/${slug}/`, { headers: authHeaders() });
    return res.data;
  },

  upload: async (
    files: File | File[],
    onProgress?: (pct: number) => void
  ): Promise<UploadResult> => {
    const form = new FormData();
    const list = Array.isArray(files) ? files : [files];
    list.forEach((f) => form.append("files", f));
    const res = await axios.post<UploadResult>(`${API}/upload/`, form, {
      headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data;
  },

  getPdfUrl: (slug: string): string =>
    `${API}/${slug}/pdf/`,

  deleteFile: async (slug: string): Promise<void> => {
    await axios.delete(`${API}/${slug}/delete/`, { headers: authHeaders() });
  },

  markQrGenerated: async (slug: string, generated = true): Promise<void> => {
    await axios.post(`${API}/${slug}/mark-qr/`, { generated }, { headers: authHeaders() });
  },

  markQrGeneratedBulk: async (slugs: string[], generated = true): Promise<void> => {
    await axios.post(`${API}/mark-qr-bulk/`, { slugs, generated }, { headers: authHeaders() });
  },
};
