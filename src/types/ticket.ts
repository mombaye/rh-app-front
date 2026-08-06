export type TicketStatus   = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type TicketCategory = "BLOCAGE" | "ANOMALIE" | "DIFFICULTE" | "AUTRE";

export interface Ticket {
  id:               number;
  title:            string;
  description:      string;
  category:         TicketCategory;
  category_label:   string;
  status:           TicketStatus;
  status_label:     string;
  resolution_note:  string;
  resolved_by_name: string | null;
  resolved_at:      string | null;
  employee:         number;
  employee_nom:     string;
  created_at:       string;
  updated_at:       string;
}

export interface TicketStats {
  open:        number;
  in_progress: number;
  resolved:    number;
  total:       number;
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  BLOCAGE:    "Blocage",
  ANOMALIE:   "Anomalie",
  DIFFICULTE: "Difficulté",
  AUTRE:      "Autre",
};

export const STATUS_CONFIG: Record<TicketStatus, {
  label: string; bg: string; text: string; border: string; dot: string;
}> = {
  OPEN:        { label: "Ouvert",    bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500"   },
  IN_PROGRESS: { label: "En cours",  bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"  },
  RESOLVED:    { label: "Résolu",    bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
};
