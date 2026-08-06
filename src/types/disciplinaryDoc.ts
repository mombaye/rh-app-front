export type DisciplinaryDocType =
  | "DEMANDE_EXPLICATION"
  | "REPONSE_EXPLICATION"
  | "NOTIFICATION_SANCTION";

export interface DisciplinaryDocument {
  id: number;
  doc_type: DisciplinaryDocType;
  doc_type_label: string;
  content: string;
  pdf_path: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const DOC_TYPE_CONFIG: Record<DisciplinaryDocType, { label: string; color: string; dot: string }> = {
  DEMANDE_EXPLICATION:  { label: "Demande d'explications",  color: "bg-blue-50 text-blue-700 border-blue-200",   dot: "bg-blue-500"   },
  REPONSE_EXPLICATION:  { label: "Réponse aux explications", color: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  NOTIFICATION_SANCTION: { label: "Notification de sanction", color: "bg-red-50 text-red-700 border-red-200",       dot: "bg-red-500"    },
};

export const DOC_TYPES: DisciplinaryDocType[] = [
  "DEMANDE_EXPLICATION",
  "REPONSE_EXPLICATION",
  "NOTIFICATION_SANCTION",
];
