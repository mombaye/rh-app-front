import axios from "axios";
import { DisciplinaryDocument, DisciplinaryDocType } from "@/types/disciplinaryDoc";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8030";
const API = (recordId: number) =>
  `${BASE_URL}/api/employees/disciplinary/${recordId}/documents/`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

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
};
