import api from "@/api/axios";

const API = "/api/employees/passeports";

export interface PassportFile {
  slug: string;
  file_name: string;
  display_name: string;
  nom_prenom: string;
  poste: string;
  date_embauche: string;
  qr_generated: boolean;
  // Signatures des 4 formations
  sig_th: boolean;
  sig_el: boolean;
  sig_ps: boolean;
  sig_af: boolean;
  has_photo: boolean;
  signature_count: number;   // 0-4 (TH+EL+PS+AF)
  has_all_signatures: boolean;
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

export interface PassportDetail extends Omit<PassportFile, "nom_prenom" | "poste" | "date_embauche"> {
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
    const res = await api.get<PassportFile[]>(`${API}/`);
    return res.data;
  },

  getDetail: async (slug: string): Promise<PassportDetail> => {
    const res = await api.get<PassportDetail>(`${API}/${slug}/`);
    return res.data;
  },

  upload: async (
    files: File | File[],
    onProgress?: (pct: number) => void
  ): Promise<UploadResult> => {
    const form = new FormData();
    const list = Array.isArray(files) ? files : [files];
    list.forEach((f) => form.append("files", f));
    const res = await api.post<UploadResult>(`${API}/upload/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data;
  },

  getPdfUrl: (slug: string): string => `${API}/${slug}/pdf/`,

  getPhoto: async (slug: string): Promise<Blob> => {
    const res = await api.get(`${API}/${slug}/photo/`, { responseType: "blob" });
    return res.data as Blob;
  },

  uploadPhoto: async (slug: string, photo: File): Promise<void> => {
    const form = new FormData();
    form.append("photo", photo);
    await api.post(`${API}/${slug}/photo/upload/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getCachet: async (): Promise<Blob> => {
    const res = await api.get(`${API}/cachet/`, { responseType: "blob" });
    return res.data as Blob;
  },

  uploadCachet: async (file: File): Promise<void> => {
    const form = new FormData();
    form.append("cachet", file);
    await api.post(`${API}/cachet/upload/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  applyCachetMulti: async (
    slug: string,
    positions: { x_pct: number; y_pct: number; w_pct: number; h_pct: number }[]
  ): Promise<void> => {
    await api.post(`${API}/${slug}/apply-cachet-multi/`, { positions });
  },

  deleteFile: async (slug: string): Promise<void> => {
    await api.delete(`${API}/${slug}/delete/`);
  },

  markQrGenerated: async (slug: string, generated = true): Promise<void> => {
    await api.post(`${API}/${slug}/mark-qr/`, { generated });
  },

  markQrGeneratedBulk: async (slugs: string[], generated = true): Promise<void> => {
    await api.post(`${API}/mark-qr-bulk/`, { slugs, generated });
  },

  resetModified: async (slugs?: string[]): Promise<{ deleted: number; errors: string[] }> => {
    const res = await api.post<{ deleted: number; errors: string[] }>(
      `${API}/reset-modified/`,
      slugs ? { slugs } : {}
    );
    return res.data;
  },

  resetAll: async (): Promise<{ deleted_pdfs: number; errors: string[] }> => {
    const res = await api.post<{ deleted_pdfs: number; errors: string[] }>(`${API}/reset-all/`, {});
    return res.data;
  },

  getPageImage: async (
    slug: string,
    page = 0,
    v = 0
  ): Promise<{ blob: Blob; pageCount: number }> => {
    const res = await api.get(`${API}/${slug}/page-image/`, {
      params: { page, v },
      responseType: "blob",
    });
    const pageCount = parseInt(res.headers["x-page-count"] || "1", 10);
    return { blob: res.data as Blob, pageCount };
  },

  embedPhoto: async (
    slug: string,
    photo: File,
    pos: { x: number; y: number; w: number; h: number }
  ): Promise<void> => {
    const form = new FormData();
    form.append("photo", photo);
    form.append("x_pct", String(pos.x));
    form.append("y_pct", String(pos.y));
    form.append("w_pct", String(pos.w));
    form.append("h_pct", String(pos.h));
    await api.post(`${API}/${slug}/embed-photo/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
