// src/components/leaves/HierarchySelectionModal.tsx
// Modal de sélection et affichage de la hiérarchie

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  GitBranch,
  Building2,
  Users,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import HierarchyManagement from "./HierarchyManagement";

type HierarchySection = "orgchart" | "departments" | "employees" | "rules";

interface SectionConfig {
  id: HierarchySection;
  label: string;
  description: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

const SECTIONS: SectionConfig[] = [
  {
    id: "orgchart",
    label: "Organigramme",
    description: "Visualisez la structure hiérarchique complète. Créez et gérez les départements, assignez les managers et visualisez les membres.",
    Icon: GitBranch,
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
  {
    id: "departments",
    label: "Départements",
    description: "Gérez les départements : créer, modifier, supprimer et assigner les responsables et validateurs DG.",
    Icon: Building2,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  {
    id: "employees",
    label: "Hiérarchie employés",
    description: "Configurez la hiérarchie individuelle de chaque employé : manager N+1, N+2 et règles de double validation.",
    Icon: Users,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    id: "rules",
    label: "Règles d'approbation",
    description: "Définissez les règles automatiques d'approbation selon le type de congé, la durée ou le département.",
    Icon: ShieldCheck,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function HierarchySelectionModal({ open, onClose }: Props) {
  const [selected, setSelected] = useState<HierarchySection | null>(null);

  if (!open) return null;

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  const handleBack = () => {
    setSelected(null);
  };

  const selectedSection = SECTIONS.find(s => s.id === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-8 overflow-y-auto">
      <AnimatePresence mode="wait">
        {!selected ? (
          /* ── Vue sélection ─────────────────────────────────────────────── */
          <motion.div
            key="selection"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-camublue-900 text-white p-2 rounded-xl">
                  <GitBranch size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-camublue-900">Hiérarchie</h2>
                  <p className="text-sm text-slate-400">Sélectionnez une section à consulter</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Section cards */}
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SECTIONS.map((section) => {
                const { Icon } = section;
                return (
                  <button
                    key={section.id}
                    onClick={() => setSelected(section.id)}
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md hover:scale-[1.02] ${section.bg} ${section.border}`}
                  >
                    <div className="p-2.5 rounded-xl bg-white shadow-sm flex-shrink-0">
                      <Icon size={20} className={section.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`font-bold text-sm ${section.color}`}>{section.label}</p>
                        <ChevronRight size={14} className={`${section.color} opacity-60 flex-shrink-0`} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {section.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-5 pt-0">
              <p className="text-xs text-slate-400 text-center">
                L'Organigramme permet de tout gérer depuis une seule vue
              </p>
            </div>
          </motion.div>
        ) : (
          /* ── Vue contenu ───────────────────────────────────────────────── */
          <motion.div
            key="content"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mb-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-camublue-900 transition"
                  title="Retour à la sélection"
                >
                  <ArrowLeft size={18} />
                </button>
                {selectedSection && (
                  <>
                    <div className={`p-2 rounded-xl ${selectedSection.bg} flex-shrink-0`}>
                      <selectedSection.Icon size={18} className={selectedSection.color} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-camublue-900">{selectedSection.label}</h2>
                      <p className="text-xs text-slate-400">{selectedSection.description}</p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 max-h-[75vh] overflow-y-auto">
              <HierarchyManagement initialSection={selected} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
