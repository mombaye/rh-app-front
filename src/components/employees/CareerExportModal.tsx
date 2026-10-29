// Export de l'historique des employés : par contrat ou par fonction (une ligne par période).
import { useState } from "react";
import { FiBriefcase, FiFileText, FiX } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import { exportCareerHistory } from "@/services/employeeService";

const CHOICES = [
  { kind: "contrat" as const, label: "Export par Contrat", Icon: FiFileText,
    desc: "L'historique des contrats de chaque employé : CDD, renouvellements, CDI… une ligne par contrat." },
  { kind: "fonction" as const, label: "Export par Fonction", Icon: FiBriefcase,
    desc: "L'historique des fonctions de chaque employé : postes occupés et promotions… une ligne par fonction." },
];

export default function CareerExportModal({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState<"contrat" | "fonction" | null>(null);

  const run = async (kind: "contrat" | "fonction") => {
    setBusy(kind);
    try {
      await exportCareerHistory(kind);
      toast.success("Fichier téléchargé");
      onClose();
    } catch {
      toast.error("Export impossible");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="career-export-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 id="career-export-title" className="text-lg font-bold text-camublue-900">Export de l'historique</h2>
            <p className="text-sm text-gray-500">Choisissez ce que vous voulez exporter pour tous les employés.</p>
          </div>
          <button onClick={onClose} disabled={!!busy} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><FiX size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {CHOICES.map(({ kind, label, Icon, desc }) => (
            <button key={kind} onClick={() => run(kind)} disabled={!!busy}
              className="w-full text-left flex items-start gap-3 rounded-xl border border-gray-200 hover:border-camublue-600 hover:bg-camublue-50/40 px-4 py-3 transition disabled:opacity-60">
              <span className="mt-0.5 p-2 rounded-lg bg-camublue-50 text-camublue-700">
                {busy === kind ? <ImSpinner2 className="animate-spin" size={16} /> : <Icon size={16} />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-800">{label}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
