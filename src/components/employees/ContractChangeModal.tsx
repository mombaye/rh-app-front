/**
 * ContractChangeModal — Mutation contractuelle d'un employé
 *
 * Permet de :
 *  - Titulariser (CDD/STAGE → CDI)
 *  - Renouveler un CDD (nouvelle date de fin)
 *  - Changer de poste / promotion (fonction, catégorie)
 *  - Transférer vers un autre service / projet
 *  - Toute autre mutation contractuelle
 *
 * La mutation est enregistrée dans le parcours de carrière de l'employé.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaExchangeAlt } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { Employee } from "@/types/employee";
import {
  applyContractChange,
  ContractChangePayload,
  CareerEventType,
} from "@/services/employeeService";
import toast from "react-hot-toast";

// ── Config des types d'événements ─────────────────────────────────────────────
const EVENT_TYPE_OPTIONS: { value: CareerEventType; label: string; description: string }[] = [
  {
    value: "TITULARISATION",
    label: "Titularisation",
    description: "CDD ou stage → CDI permanent",
  },
  {
    value: "RENOUVELLEMENT_CDD",
    label: "Renouvellement CDD",
    description: "Prolongation du contrat à durée déterminée",
  },
  {
    value: "CHANGEMENT_CONTRAT",
    label: "Changement de contrat",
    description: "Autre changement de type de contrat",
  },
  {
    value: "PROMOTION",
    label: "Promotion / Avancement",
    description: "Changement de poste, de catégorie ou de grade",
  },
  {
    value: "CHANGEMENT_SERVICE",
    label: "Transfert / Mutation de service",
    description: "Changement de service, département, projet ou localisation",
  },
  {
    value: "AUTRE",
    label: "Autre mutation",
    description: "Toute autre modification contractuelle",
  },
];

const CONTRACT_TYPES = [
  { value: "CDI",    label: "CDI — Contrat à Durée Indéterminée" },
  { value: "CDD",    label: "CDD — Contrat à Durée Déterminée" },
  { value: "STAGE",  label: "Stage" },
  { value: "INTERIM",label: "Intérim" },
];

// Champs affichés selon le type d'événement
const FIELDS_BY_EVENT: Record<CareerEventType, string[]> = {
  TITULARISATION:     ["type_contrat", "date_embauche", "date_fin_periode_essai", "fonction", "categorie"],
  RENOUVELLEMENT_CDD: ["date_fin_cdd", "date_embauche"],
  CHANGEMENT_CONTRAT: ["type_contrat", "date_embauche", "date_fin_cdd", "date_fin_periode_essai"],
  PROMOTION:          ["fonction", "categorie", "service", "manager", "business_line"],
  CHANGEMENT_SERVICE: ["service", "manager", "projet", "business_line", "localisation"],
  SORTIE:             [],
  REINTEGRATION:      [],
  EMBAUCHE:           [],
  AUTRE:              ["type_contrat", "date_embauche", "date_fin_cdd", "fonction", "categorie", "service", "manager", "projet", "business_line", "localisation"],
};

const FIELD_LABELS: Record<string, string> = {
  type_contrat:           "Nouveau type de contrat",
  date_embauche:          "Nouvelle date d'embauche",
  date_fin_cdd:           "Nouvelle date de fin CDD",
  date_fin_periode_essai: "Date de fin de période d'essai",
  fonction:               "Nouvelle fonction / poste",
  categorie:              "Nouvelle catégorie",
  service:                "Nouveau service",
  manager:                "Nouveau manager",
  projet:                 "Nouveau projet",
  business_line:          "Business line",
  localisation:           "Nouvelle localisation",
};

interface Props {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess: (updatedEmployee: Employee) => void;
}

export default function ContractChangeModal({ open, employee, onClose, onSuccess }: Props) {
  const [eventType, setEventType] = useState<CareerEventType>("TITULARISATION");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const selectedConfig = EVENT_TYPE_OPTIONS.find(o => o.value === eventType);
  const visibleFields = FIELDS_BY_EVENT[eventType] ?? [];

  const handleEventTypeChange = (type: CareerEventType) => {
    setEventType(type);
    // Pré-remplir avec les valeurs actuelles de l'employé
    if (!employee) return;
    const prefill: Record<string, string> = {};
    for (const field of FIELDS_BY_EVENT[type] ?? []) {
      const val = (employee as any)[field];
      if (val) prefill[field] = typeof val === "string" ? val : String(val);
    }
    // Suggestions automatiques selon le type
    if (type === "TITULARISATION") {
      prefill["type_contrat"] = "CDI";
      if (!prefill["date_embauche"]) prefill["date_embauche"] = eventDate;
    }
    if (type === "RENOUVELLEMENT_CDD") {
      if (!prefill["type_contrat"]) prefill["type_contrat"] = "CDD";
    }
    setFields(prefill);
  };

  const setField = (key: string, value: string) =>
    setFields(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!employee) return;
    if (!eventDate) { toast.error("La date d'effet est requise"); return; }

    setLoading(true);
    try {
      const payload: ContractChangePayload = {
        event_type:  eventType,
        event_date:  eventDate,
        description: description.trim(),
      };
      // Ajouter les champs renseignés
      for (const field of visibleFields) {
        const val = fields[field];
        if (val !== undefined) {
          (payload as any)[field] = val === "" ? null : val;
        }
      }

      const result = await applyContractChange(employee.id, payload);
      toast.success(`Mutation enregistrée — ${selectedConfig?.label}`);
      onSuccess(result.employee);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erreur lors de l'enregistrement de la mutation";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!employee) return;
    // Init avec les valeurs actuelles
    setEventType("TITULARISATION");
    handleEventTypeChange("TITULARISATION");
    setEventDate(new Date().toISOString().slice(0, 10));
    setDescription("");
  };

  if (!open || !employee) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-camublue-900/10">
                  <FaExchangeAlt className="text-camublue-900" size={16} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-base">Mutation contractuelle</h2>
                  <p className="text-xs text-slate-400">
                    {employee.prenom} {employee.nom} · {employee.matricule}
                    {employee.type_contrat && (
                      <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 text-[10px] font-medium">
                        Contrat actuel : {employee.type_contrat}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
              >
                <FaTimes size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Type d'événement */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Type de mutation *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EVENT_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleEventTypeChange(opt.value)}
                      className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                        eventType === opt.value
                          ? "border-camublue-900 bg-camublue-900/5"
                          : "border-slate-100 hover:border-slate-200 bg-white"
                      }`}
                    >
                      <p className={`text-sm font-semibold ${eventType === opt.value ? "text-camublue-900" : "text-slate-700"}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date d'effet */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Date d'effet *
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full sm:w-56 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                />
              </div>

              {/* Champs contractuels */}
              {visibleFields.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Nouveaux paramètres
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visibleFields.map(field => (
                      <div key={field}>
                        <label className="block text-xs text-slate-500 mb-1">
                          {FIELD_LABELS[field] ?? field}
                        </label>
                        {field === "type_contrat" ? (
                          <select
                            value={fields[field] ?? ""}
                            onChange={e => setField(field, e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-white"
                          >
                            <option value="">— Sélectionner —</option>
                            {CONTRACT_TYPES.map(ct => (
                              <option key={ct.value} value={ct.value}>{ct.label}</option>
                            ))}
                          </select>
                        ) : field === "date_embauche" || field === "date_fin_cdd" || field === "date_fin_periode_essai" ? (
                          <input
                            type="date"
                            value={fields[field] ?? ""}
                            onChange={e => setField(field, e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                          />
                        ) : (
                          <input
                            type="text"
                            value={fields[field] ?? ""}
                            onChange={e => setField(field, e.target.value)}
                            placeholder={`Valeur actuelle : ${(employee as any)[field] || "—"}`}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Motif / description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Motif / Observations
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Décrivez le contexte de cette mutation (optionnel)…"
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 resize-none"
                />
              </div>

              {/* Récapitulatif */}
              <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Récapitulatif</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                  <span>
                    <span className="font-medium">Événement :</span>{" "}
                    <span className="text-camublue-900 font-semibold">{selectedConfig?.label}</span>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    <span className="font-medium">Date d'effet :</span>{" "}
                    {eventDate ? new Date(eventDate + "T00:00:00").toLocaleDateString("fr-FR", {
                      day: "2-digit", month: "long", year: "numeric"
                    }) : "—"}
                  </span>
                  {fields.type_contrat && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>
                        <span className="font-medium">Nouveau contrat :</span>{" "}
                        <span className="font-semibold text-emerald-700">{fields.type_contrat}</span>
                      </span>
                    </>
                  )}
                  {fields.fonction && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>
                        <span className="font-medium">Fonction :</span> {fields.fonction}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Cette mutation sera enregistrée dans le parcours de carrière de l'employé.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !eventDate}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <><ImSpinner2 className="animate-spin" size={14} />Enregistrement…</>
                ) : (
                  <><FaExchangeAlt size={12} />Valider la mutation</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
