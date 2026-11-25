import api from "@/api/axios";
import { BASE_URL } from "@/api/baseUrl";

const URL_TPL = `${BASE_URL}/api/leaves/attestation-template/`;

export interface AttestationField { key: string; tag: string; label: string; example: string }

export interface AttestationTemplateState {
  is_default: boolean;
  template: { id: number; name: string; uploaded_at: string; uploaded_by: string } | null;
  /** champs {{…}} trouvés dans le modèle actif */
  fields: string[];
  unknown: string[];
  unused: string[];
  available_fields: AttestationField[];
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const attestationTemplateService = {
  get: async (): Promise<AttestationTemplateState> => (await api.get(URL_TPL)).data,

  upload: async (file: File): Promise<AttestationTemplateState> => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post(URL_TPL, form, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },

  resetToDefault: async (): Promise<AttestationTemplateState> => (await api.delete(URL_TPL)).data,

  /** current : le modèle utilisé ; default : le modèle d'exemple fourni avec eRH */
  download: async (which: "current" | "default", name: string) => {
    const res = await api.get(URL_TPL, { params: { download: which }, responseType: "blob" });
    saveBlob(res.data, name);
  },

  /** Aperçu du modèle actif rempli avec des données d'exemple (PDF, ouvert dans un nouvel onglet) */
  preview: async () => {
    const res = await api.get(`${URL_TPL}preview/`, { responseType: "blob" });
    const blob: Blob = res.data;
    if (blob.type === "application/pdf") {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      saveBlob(blob, "apercu_attestation_conge.docx");
    }
  },
};
