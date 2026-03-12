import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaHistory, FaUser, FaCalendarAlt, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { Employee, EmployeeHistoryEntry } from "@/types/employee";
import { getEmployeeHistory } from "@/services/employeeService";

// ── Traduction des noms de champs ────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  nom:                       "Nom",
  prenom:                    "Prénom",
  matricule:                 "Matricule",
  sexe:                      "Sexe",
  date_naissance:            "Date de naissance",
  lieu_naissance:            "Lieu de naissance",
  nationalite:               "Nationalité",
  adresse:                   "Adresse",
  type_piece:                "Type de pièce",
  numero_piece:              "Numéro de pièce",
  date_delivrance:           "Date de délivrance",
  date_expiration:           "Date d'expiration",
  contact_urgence_nom:       "Contact d'urgence (nom)",
  contact_urgence_telephone: "Contact d'urgence (tél.)",
  prenom_pere:               "Prénom du père",
  nom_prenom_mere:           "Nom/prénom de la mère",
  situation_matrimoniale:    "Situation matrimoniale",
  nom_conjoint:              "Nom du conjoint",
  nombre_enfants:            "Nombre d'enfants",
  enfants:                   "Enfants",
  rib:                       "RIB",
  banque:                    "Banque",
  type_contrat:              "Type de contrat",
  fonction:                  "Fonction",
  categorie:                 "Catégorie",
  date_embauche:             "Date d'embauche",
  date_fin_cdd:              "Date fin CDD",
  date_fin_periode_essai:    "Date fin période d'essai",
  business_line:             "Business Line",
  projet:                    "Projet",
  service:                   "Service",
  manager:                   "Manager",
  localisation:              "Localisation",
  email:                     "Email",
  telephone:                 "Téléphone",
  status:                    "Statut",
  date_sortie:               "Date de sortie",
  motif_sortie:              "Motif de sortie",
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Oui" : "Non";
  if (Array.isArray(val)) {
    if (val.length === 0) return "—";
    return val
      .map((v: any) =>
        typeof v === "object" && v !== null
          ? `${v.nom ?? ""} (${v.date_naissance ?? ""})`
          : String(v)
      )
      .join(", ");
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

interface Props {
  open: boolean;
  employee: Employee | null;
  onClose: () => void;
}

export default function EmployeeHistoryModal({ open, employee, onClose }: Props) {
  const [history, setHistory] = useState<EmployeeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open || !employee) return;
    setHistory([]);
    setExpanded(new Set());
    setLoading(true);
    getEmployeeHistory(employee.id)
      .then((data) => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [open, employee]);

  const toggleEntry = (id: number) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  if (!open || !employee) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-camublue-900/10">
                  <FaHistory className="text-camublue-900" size={16} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 text-base">
                    Historique des modifications
                  </h2>
                  <p className="text-xs text-slate-400">
                    {employee.prenom} {employee.nom} · {employee.matricule}
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
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <ImSpinner2 className="animate-spin text-camublue-900" size={28} />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <FaHistory size={32} className="opacity-30" />
                  <p className="text-sm">Aucune modification enregistrée</p>
                </div>
              ) : (
                <ol className="relative border-l-2 border-slate-100 ml-3 space-y-0">
                  {history.map((entry, idx) => {
                    const isOpen = expanded.has(entry.id);
                    const changedFields = Object.keys(entry.changes);
                    const date = new Date(entry.modified_at);
                    const isFirst = idx === 0;

                    return (
                      <li key={entry.id} className="ml-6 pb-6">
                        {/* Dot */}
                        <span
                          className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                            isFirst ? "bg-camublue-900" : "bg-slate-300"
                          }`}
                        />

                        {/* Card */}
                        <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                          {/* Card header — cliquable */}
                          <button
                            type="button"
                            onClick={() => toggleEntry(entry.id)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <FaCalendarAlt size={10} />
                                  {date.toLocaleDateString("fr-FR", {
                                    day: "2-digit", month: "long", year: "numeric",
                                  })}
                                  {" à "}
                                  {date.toLocaleTimeString("fr-FR", {
                                    hour: "2-digit", minute: "2-digit",
                                  })}
                                </span>
                                <span className="h-3 w-px bg-slate-200" />
                                <span className="flex items-center gap-1">
                                  <FaUser size={10} />
                                  {entry.modified_by}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-slate-700 mt-0.5">
                                {changedFields.length} champ
                                {changedFields.length > 1 ? "s" : ""} modifié
                                {changedFields.length > 1 ? "s" : ""}
                              </p>
                            </div>
                            <span className="text-slate-400 shrink-0 ml-3">
                              {isOpen ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
                            </span>
                          </button>

                          {/* Changes detail */}
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-slate-100 divide-y divide-slate-50">
                                  {changedFields.map((field) => {
                                    const { old: oldVal, new: newVal } = entry.changes[field];
                                    return (
                                      <div
                                        key={field}
                                        className="px-4 py-2.5 grid grid-cols-[1fr_auto_1fr] gap-3 items-start text-xs"
                                      >
                                        {/* Label */}
                                        <div className="col-span-3 font-semibold text-slate-500 text-[11px] uppercase tracking-wider mb-0.5">
                                          {FIELD_LABELS[field] ?? field}
                                        </div>
                                        {/* Old */}
                                        <div className="bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5 text-red-700 break-all">
                                          <span className="block text-[10px] font-medium text-red-400 mb-0.5">Avant</span>
                                          {formatValue(oldVal)}
                                        </div>
                                        {/* Arrow */}
                                        <div className="text-slate-300 self-center text-base">→</div>
                                        {/* New */}
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-md px-2.5 py-1.5 text-emerald-700 break-all">
                                          <span className="block text-[10px] font-medium text-emerald-400 mb-0.5">Après</span>
                                          {formatValue(newVal)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 shrink-0 flex justify-between items-center">
              <span className="text-xs text-slate-400">
                {history.length} entrée{history.length !== 1 ? "s" : ""} au total
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
