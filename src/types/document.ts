export interface HRDocument {
  id: number;
  title: string;
  description: string;
  document_type: string;
  document_type_label: string;
  file: string;
  file_url: string;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export type DocumentType = 'REGLEMENT' | 'PROCEDURE' | 'POLITIQUE' | 'FORMULAIRE' | 'GUIDE' | 'AUTRE';

export const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'REGLEMENT', label: 'Règlement intérieur' },
  { value: 'PROCEDURE', label: 'Procédure' },
  { value: 'POLITIQUE', label: 'Politique RH' },
  { value: 'FORMULAIRE', label: 'Formulaire' },
  { value: 'GUIDE', label: 'Guide' },
  { value: 'AUTRE', label: 'Autre' },
];
