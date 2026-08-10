import axios from "axios";
import { DisciplinaryDocument, DisciplinaryDocType } from "@/types/disciplinaryDoc";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8030";
const API = (recordId: number) =>
  `${BASE_URL}/api/employees/disciplinary/${recordId}/documents/`;
const UPLOAD_API = (recordId: number) =>
  `${BASE_URL}/api/employees/disciplinary/${recordId}/documents/uploaded-pdfs/`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

export type DiscDocCategory = "DEMANDE" | "REPONSE" | "NOTIFICATION" | "AUTRE";

export interface UploadedPdf {
  id: number;
  doc_type: DiscDocCategory;
  doc_type_label: string;
  filename: string;
  uploaded_by: string;
  uploaded_at: string;
}

export const disciplinaryDocService = {
  list: async (recordId: number): Promise<DisciplinaryDocument[]> => {
    const res = await axios.get<DisciplinaryDocument[]>(API(recordId), { headers: authHeaders() });
    return res.data;
  },

  save: async (
    recordId: number,
    doc_type: DisciplinaryDocType,
    content: string,
  ): Promise<DisciplinaryDocument> => {
    const res = await axios.post<DisciplinaryDocument>(
      API(recordId),
      { doc_type, content },
      { headers: authHeaders() },
    );
    return res.data;
  },

  pdfUrl: (recordId: number, docId: number): string =>
    `${BASE_URL}/api/employees/disciplinary/${recordId}/documents/${docId}/pdf/`,

  listUploadedPdfs: async (recordId: number): Promise<UploadedPdf[]> => {
    const res = await axios.get<UploadedPdf[]>(UPLOAD_API(recordId), { headers: authHeaders() });
    return res.data;
  },

  uploadPdf: async (recordId: number, file: File, docType: DiscDocCategory = "AUTRE"): Promise<UploadedPdf> => {
    const form = new FormData();
    form.append("pdf", file);
    form.append("doc_type", docType);
    const res = await axios.post<UploadedPdf>(UPLOAD_API(recordId), form, {
      headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  downloadUploadedPdf: (recordId: number, pdfId: number): string =>
    `${BASE_URL}/api/employees/disciplinary/${recordId}/documents/uploaded-pdfs/${pdfId}/`,

  deleteUploadedPdf: async (recordId: number, pdfId: number): Promise<void> => {
    await axios.delete(
      `${UPLOAD_API(recordId)}${pdfId}/`,
      { headers: authHeaders() },
    );
  },
};
