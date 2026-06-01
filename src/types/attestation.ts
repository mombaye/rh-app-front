// src/types/attestation.ts

export type AttestationDocumentType =
  | "ATTESTATION_TRAVAIL_CDI"
  | "ATTESTATION_TRAVAIL_CDD"
  | "ATTESTATION_CONGES"
  | "DOMICILIATION_CDI"
  | "DOMICILIATION_CDD";

export type AttestationStatus = "PENDING" | "PROCESSED" | "REJECTED";

export interface AttestationRequest {
  id:                    number;
  document_type:         AttestationDocumentType;
  document_type_display: string;
  status:                AttestationStatus;
  status_display:        string;
  extra_data:            Record<string, string>;
  notes:                 string | null;
  employee:              number;
  employee_nom_complet:  string;
  employee_matricule:    string;
  employee_service:      string;
  employee_fonction:     string;
  pdf_url:               string | null;
  created_at:            string;
  processed_at:          string | null;
  processed_by:          string | null;
}

// Champs supplémentaires requis par type de document
export interface AttestationExtraFields {
  // Attestation de congés
  date_debut_conges?: string;
  date_fin_conges?:   string;
  date_reprise?:      string;
  // Domiciliation (CDI + CDD)
  nom_banque?:          string;
  rib?:                 string;
  salaire_net_lettre?:  string;
  salaire_net_chiffre?: string;
  // Domiciliation CDI
  date_retraite?: string;
  // Domiciliation CDD
  date_fin_cdd?: string;
}

export const DOC_TYPE_LABELS: Record<AttestationDocumentType, string> = {
  ATTESTATION_TRAVAIL_CDI: "Attestation de travail — CDI",
  ATTESTATION_TRAVAIL_CDD: "Attestation de travail — CDD",
  ATTESTATION_CONGES:      "Attestation de congés",
  DOMICILIATION_CDI:       "Domiciliation de salaire — CDI",
  DOMICILIATION_CDD:       "Domiciliation de salaire — CDD",
};

export const DOC_TYPE_DESCRIPTIONS: Record<AttestationDocumentType, string> = {
  ATTESTATION_TRAVAIL_CDI: "Confirme votre emploi en contrat à durée indéterminée",
  ATTESTATION_TRAVAIL_CDD: "Confirme votre emploi en contrat à durée déterminée",
  ATTESTATION_CONGES:      "Atteste votre période de congés payés",
  DOMICILIATION_CDI:       "Ordre irrévocable de domiciliation bancaire — CDI",
  DOMICILIATION_CDD:       "Ordre irrévocable de domiciliation bancaire — CDD",
};

// Champs extra requis par type (à saisir lors de la demande)
export const EXTRA_FIELDS_CONFIG: Record<
  AttestationDocumentType,
  Array<{ key: keyof AttestationExtraFields; label: string; type: "date" | "text"; required: boolean }>
> = {
  ATTESTATION_TRAVAIL_CDI: [],
  ATTESTATION_TRAVAIL_CDD: [],
  ATTESTATION_CONGES: [
    { key: "date_debut_conges", label: "Date de début de congés",   type: "date", required: true },
    { key: "date_fin_conges",   label: "Date de fin de congés",     type: "date", required: true },
    { key: "date_reprise",      label: "Date de reprise de service", type: "date", required: true },
  ],
  DOMICILIATION_CDI: [
    { key: "salaire_net_lettre",  label: "Salaire net (en lettres)",        type: "text", required: true  },
    { key: "salaire_net_chiffre", label: "Salaire net (en chiffres)",       type: "text", required: true  },
    { key: "date_retraite",       label: "Date prévisionnelle de retraite", type: "date", required: false },
  ],
  DOMICILIATION_CDD: [
    { key: "salaire_net_lettre",  label: "Salaire net (en lettres)",  type: "text", required: true },
    { key: "salaire_net_chiffre", label: "Salaire net (en chiffres)", type: "text", required: true },
  ],
};
