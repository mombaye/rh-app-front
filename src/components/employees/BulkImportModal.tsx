import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { FiUploadCloud, FiDownload, FiX, FiCheckCircle, FiAlertTriangle, FiFileText } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import { importEmployees } from "@/services/employeeService";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  skipped_details?: string[];
};

type View = "upload" | "importing" | "result";

// ── Colonnes du modèle ────────────────────────────────────────────────────────
type ColDef = { key: string; required: boolean; note?: string };

const TEMPLATE_COLS: ColDef[] = [
  { key: "MATRICULE",      required: true,  note: "Identifiant unique (obligatoire)" },
  { key: "NOM",            required: false, note: "Nom de famille" },
  { key: "PRENOM",         required: false, note: "Prénom" },
  { key: "FONCTION",       required: false, note: "Poste / intitulé du poste" },
  { key: "SEXE",           required: false, note: "H ou F" },
  { key: "CONTRAT",        required: false, note: "CDI | CDD | STAGE | INTERIM | CONSULTANCE" },
  { key: "DATE NAISSANCE", required: false, note: "JJ/MM/AAAA ou AAAA-MM-JJ" },
  { key: "DATE EMBAUCHE",  required: false, note: "JJ/MM/AAAA ou AAAA-MM-JJ" },
  { key: "BUSINESS LINE",  required: false },
  { key: "PROJET",         required: false },
  { key: "SERVICE",        required: false, note: "Département / service" },
  { key: "LINE MANAGER",   required: false, note: "Nom complet du manager" },
  { key: "LOCALISATION",   required: false, note: "Région / site" },
  { key: "ADRESSE MAIL",   required: false },
  { key: "TELEPHONE",      required: false },
];

const TEMPLATE_EXAMPLE = [
  "EMP001", "DIALLO", "Amadou", "TECHNICIEN", "H", "CDI",
  "1990-05-15", "2020-01-10", "BL1", "ESCO", "DEPLOIEMENT",
  "PAPA FALL", "Dakar", "amadou.diallo@camusat.com", "771234567",
];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  const headers = TEMPLATE_COLS.map((c) => c.key);

  // ── Feuille principale — 3 lignes : en-têtes, exemple, ligne vide ────────
  const ws = XLSX.utils.aoa_to_sheet([headers, TEMPLATE_EXAMPLE, []]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 6, 20) }));
  XLSX.utils.book_append_sheet(wb, ws, "Employés");

  // ── Feuille instructions ──────────────────────────────────────────────────
  const infoRows: string[][] = [
    ["INSTRUCTIONS D'IMPORT"],
    [""],
    ["Règles générales"],
    ["• Ne pas modifier la première ligne (en-têtes)."],
    ["• Seul le champ MATRICULE est obligatoire."],
    ["• Tous les autres champs peuvent être laissés vides."],
    ["• Si le MATRICULE existe déjà → mise à jour de l'employé."],
    ["• Si le MATRICULE est nouveau → création d'un nouvel employé."],
    [""],
    ["Détail des colonnes", "Obligatoire ?", "Valeurs acceptées"],
    ...TEMPLATE_COLS.map((c) => [
      c.key,
      c.required ? "OUI ✓" : "non",
      c.note ?? "",
    ]),
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
  wsInfo["!cols"] = [{ wch: 25 }, { wch: 14 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Instructions");

  XLSX.writeFile(wb, "modele_import_employes.xlsx");
}

// ── Composant principal ───────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function BulkImportModal({ onClose, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view,        setView]       = useState<View>("upload");
  const [dragOver,    setDragOver]   = useState(false);
  const [result,      setResult]     = useState<ImportResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const processFile = async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      toast.error("Seuls les fichiers .xlsx ou .xls sont acceptés");
      return;
    }
    setView("importing");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await importEmployees(formData);
      setResult({
        created:         res.created        ?? 0,
        updated:         res.updated        ?? 0,
        skipped:         res.skipped        ?? 0,
        skipped_details: res.skipped_details ?? [],
      });
      setView("result");
      onImported();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Erreur lors de l'import";
      toast.error(msg);
      setView("upload");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.96, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-black text-camublue-900 text-base">Ajout d'employés en masse</h2>
              <p className="text-xs text-slate-400 mt-0.5">Importez un fichier Excel pour créer ou mettre à jour plusieurs employés</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
              <FiX size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-6">

            {/* ── Vue upload ── */}
            {(view === "upload" || view === "importing") && (
              <div className="space-y-5">

                {/* Étape 1 — télécharger le modèle */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Étape 1</p>
                  <p className="text-sm text-slate-700 font-medium mb-3">
                    Téléchargez le modèle Excel et remplissez-le
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium"
                  >
                    <FiDownload size={15} className="text-green-600" />
                    Télécharger le modèle (.xlsx)
                  </button>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {TEMPLATE_COLS.map((col) => (
                      <span key={col} className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Étape 2 — importer le fichier rempli */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Étape 2</p>
                  <p className="text-sm text-slate-700 font-medium mb-3">
                    Importez le fichier rempli
                  </p>

                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => view !== "importing" && fileInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center gap-3 py-8 px-4 text-center
                      ${dragOver
                        ? "border-camublue-500 bg-blue-50"
                        : view === "importing"
                        ? "border-slate-200 bg-slate-50 cursor-default"
                        : "border-slate-300 hover:border-camublue-400 hover:bg-blue-50/30"
                      }`}
                  >
                    {view === "importing" ? (
                      <>
                        <ImSpinner2 size={28} className="animate-spin text-camublue-600" />
                        <p className="text-sm font-medium text-camublue-700">Import en cours…</p>
                        <p className="text-xs text-slate-400">Veuillez patienter</p>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                          <FiUploadCloud size={22} className="text-camublue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            Glissez-déposez votre fichier ici
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">ou cliquez pour sélectionner</p>
                        </div>
                        <p className="text-xs text-slate-400">Formats acceptés : .xlsx, .xls</p>
                      </>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>

                <p className="text-xs text-slate-400 text-center">
                  Les employés existants (même matricule) seront mis à jour. Les nouveaux matricules créeront de nouveaux profils.
                </p>
              </div>
            )}

            {/* ── Vue résultat ── */}
            {view === "result" && result && (
              <div className="space-y-4">
                {/* Icône */}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${result.skipped > 0 && result.created === 0 && result.updated === 0 ? "bg-amber-100" : "bg-emerald-100"}`}>
                  {result.skipped > 0 && result.created === 0 && result.updated === 0
                    ? <FiAlertTriangle size={26} className="text-amber-500" />
                    : <FiCheckCircle   size={26} className="text-emerald-500" />
                  }
                </div>

                <h3 className="text-center font-bold text-slate-800 text-base">Import terminé</h3>

                {/* Compteurs */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                    <p className="text-2xl font-black text-emerald-600">{result.created}</p>
                    <p className="text-xs text-emerald-500 font-medium mt-0.5">Créé(s)</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
                    <p className="text-2xl font-black text-blue-600">{result.updated}</p>
                    <p className="text-xs text-blue-500 font-medium mt-0.5">Mis à jour</p>
                  </div>
                  <div className={`rounded-xl border p-3 text-center ${result.skipped > 0 ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"}`}>
                    <p className={`text-2xl font-black ${result.skipped > 0 ? "text-amber-600" : "text-slate-400"}`}>{result.skipped}</p>
                    <p className={`text-xs font-medium mt-0.5 ${result.skipped > 0 ? "text-amber-500" : "text-slate-400"}`}>Ignoré(s)</p>
                  </div>
                </div>

                {/* Détails lignes ignorées */}
                {result.skipped > 0 && result.skipped_details && result.skipped_details.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowDetails((v) => !v)}
                      className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium mx-auto"
                    >
                      <FiFileText size={13} />
                      {showDetails ? "Masquer" : "Voir"} les lignes ignorées ({result.skipped_details.length})
                    </button>
                    {showDetails && (
                      <div className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-amber-50 border border-amber-100 p-3 space-y-1">
                        {result.skipped_details.map((d, i) => (
                          <p key={i} className="text-xs text-amber-700 font-mono">{d}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setView("upload"); setResult(null); setShowDetails(false); }}
                    className="flex-1 border border-slate-300 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-50 transition font-medium"
                  >
                    Nouvel import
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 bg-camublue-900 text-white text-sm py-2.5 rounded-xl hover:bg-camublue-800 transition font-medium"
                  >
                    Terminer
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
