import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaExchangeAlt, FaInfoCircle } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { Employee } from "@/types/employee";
import {
  applyContractChange,
  ContractChangePayload,
  CareerEventType,
} from "@/services/employeeService";
import toast from "react-hot-toast";

const EVENT_TYPE_OPTIONS: { value: CareerEventType; label: string }[] = [
  { value: "TITULARISATION",     label: "Titularisation (CDD → CDI)" },
  { value: "RENOUVELLEMENT_CDD", label: "Renouvellement CDD" },
  { value: "CHANGEMENT_CONTRAT", label: "Changement de contrat" },
  { value: "PROMOTION",          label: "Promotion / Avancement" },
  { value: "CHANGEMENT_SERVICE", label: "Transfert de service" },
  { value: "AUTRE",              label: "Autre mutation" },
];

const CONTRACT_TYPES = [
  { value: "CDI",    label: "CDI" },
  { value: "CDD",    label: "CDD" },
  { value: "STAGE",  label: "Stage" },
  { value: "INTERIM",label: "Intérim" },
];

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
  type_contrat:           "Type de contrat",
  date_embauche:          "Date d'embauche",
  date_fin_cdd:           "Date de fin CDD",
  date_fin_periode_essai: "Fin période d'essai",
  fonction:               "Fonction / Poste",
  categorie:              "Catégorie",
  service:                "Service",
  manager:                "Manager",
  projet:                 "Projet",
  business_line:          "Business line",
  localisation:           "Localisation",
};

const DATE_FIELDS = new Set(["date_embauche", "date_fin_cdd", "date_fin_periode_essai"]);

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

  // Détermine le type de contrat effectif pour masquer les champs non pertinents :
  // 1. Ce que l'utilisateur a sélectionné dans le formulaire
  // 2. CDI implicite pour les titularisations
  // 3. Le contrat actuel de l'employé si l'event ne permet pas de le changer
  const effectiveContractType =
    fields["type_contrat"] ||
    (eventType === "TITULARISATION" ? "CDI" : null) ||
    (!(FIELDS_BY_EVENT[eventType] ?? []).includes("type_contrat")
      ? (employee?.type_contrat ?? null)
      : null);

  const visibleFields = (FIELDS_BY_EVENT[eventType] ?? []).filter(
    (f) => !(f === "date_fin_cdd" && (effectiveContractType === "CDI" || effectiveContractType === "INTERIM"))
  );

  const handleTypeChange = (type: CareerEventType) => {
    setEventType(type);
    if (!employee) return;
    const prefill: Record<string, string> = {};
    for (const f of FIELDS_BY_EVENT[type] ?? []) {
      const val = (employee as any)[f];
      if (val) prefill[f] = typeof val === "string" ? val : String(val);
    }
    if (type === "TITULARISATION") prefill["type_contrat"] = "CDI";
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
      for (const f of visibleFields) {
        const val = fields[f];
        if (val !== undefined) (payload as any)[f] = val === "" ? null : val;
      }
      const result = await applyContractChange(employee.id, payload);
      const label = EVENT_TYPE_OPTIONS.find(o => o.value === eventType)?.label ?? eventType;
      toast.success(`Mutation enregistrée — ${label}`);
      onSuccess(result.employee);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
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
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-camublue-900/10">
                  <FaExchangeAlt className="text-camublue-900" size={14} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-sm">Mutation contractuelle</h2>
                  <p className="text-xs text-slate-400">
                    {employee.prenom} {employee.nom} · {employee.matricule}
                    {employee.type_contrat && (
                      <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 text-[10px] font-medium">
                        {employee.type_contrat}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <FaTimes size={13} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Type + Date sur la même ligne */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-medium">Type de mutation *</label>
                  <select
                    value={eventType}
                    onChange={e => handleTypeChange(e.target.value as CareerEventType)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-white"
                  >
                    {EVENT_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-medium">Date d'effet *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                  />
                </div>
              </div>

              {/* Champs dynamiques */}
              {visibleFields.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visibleFields.map(field => (
                    <div key={field}>
                      <label className="block text-xs text-slate-500 mb-1 font-medium">
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
                      ) : DATE_FIELDS.has(field) ? (
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
                          placeholder={(employee as any)[field] || "—"}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Notice basculement intérim → interne */}
              {employee.type_contrat === "INTERIM" &&
               visibleFields.includes("type_contrat") &&
               fields["type_contrat"] &&
               fields["type_contrat"] !== "INTERIM" && (
                <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5 text-xs text-indigo-700">
                  <FaInfoCircle className="shrink-0 mt-0.5 text-indigo-400" size={12} />
                  <span>
                    Ce changement de contrat basculera automatiquement cet employé
                    de la <strong>liste intérimaires</strong> vers la <strong>liste interne</strong>.
                  </span>
                </div>
              )}

              {/* Motif optionnel */}
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium">
                  Motif <span className="text-slate-300 font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Contexte ou observations…"
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 shrink-0 flex justify-end gap-2">
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
                {loading
                  ? <><ImSpinner2 className="animate-spin" size={13} />Enregistrement…</>
                  : <><FaExchangeAlt size={11} />Valider</>
                }
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
