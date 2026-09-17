import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiDownload, FiSave, FiTrash2, FiCheck, FiBookmark } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import { exportEmployeesExcel } from "@/services/employeeService";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
type ColDef = { key: string; label: string; group: string; locked?: boolean };
type Status = "ALL" | "ACTIVE" | "EXITED";

export type ExportPreset = {
  id: string;
  name: string;
  columns: string[];
  status: Status;
  type_contrat: string;
  createdAt: string;
};

// ── Colonnes disponibles ──────────────────────────────────────────────────────
const COL_DEFS: ColDef[] = [
  { key: "MATRICULE",      label: "Matricule",        group: "Identité",       locked: true },
  { key: "NOM",            label: "Nom",              group: "Identité",       locked: true },
  { key: "PRENOM",         label: "Prénom",           group: "Identité",       locked: true },
  { key: "SEXE",           label: "Sexe",             group: "Identité" },
  { key: "DATE NAISSANCE", label: "Date naissance",   group: "Identité" },
  { key: "AGE",            label: "Âge",              group: "Identité" },
  { key: "STATUTS",        label: "Statut",           group: "Contrat" },
  { key: "CONTRAT",        label: "Type contrat",     group: "Contrat" },
  { key: "DATE EMBAUCHE",  label: "Date d'embauche",  group: "Contrat" },
  { key: "ANCIENETE",      label: "Ancienneté",       group: "Contrat" },
  { key: "FONCTION",       label: "Fonction",         group: "Professionnel" },
  { key: "SERVICE",        label: "Service",          group: "Professionnel" },
  { key: "BUSINESS LINE",  label: "Business Line",    group: "Professionnel" },
  { key: "PROJET",         label: "Projet",           group: "Professionnel" },
  { key: "LINE MANAGER",   label: "Manager",          group: "Professionnel" },
  { key: "LOCALISATION",   label: "Localisation",     group: "Professionnel" },
  { key: "ADRESSE MAIL",   label: "Email",            group: "Contact" },
  { key: "TELEPHONE",      label: "Téléphone",        group: "Contact" },
];

const DEFAULT_COLS = COL_DEFS
  .filter(c => c.locked || ["STATUTS","CONTRAT","FONCTION","SERVICE"].includes(c.key))
  .map(c => c.key);

const GROUPS = [...new Set(COL_DEFS.map(c => c.group))];

// ── LocalStorage ─────────────────────────────────────────────────────────────
const LS_KEY = "erh_export_presets";

function loadPresets(): ExportPreset[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch { return []; }
}
function savePresets(p: ExportPreset[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

// ── Composant ─────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
}

export default function ExportModal({ onClose }: Props) {
  const [presets,     setPresets]     = useState<ExportPreset[]>(loadPresets);
  const [selected,    setSelected]    = useState<Set<string>>(new Set(DEFAULT_COLS));
  const [statusFilt,  setStatusFilt]  = useState<Status>("ACTIVE");
  const [contratFilt, setContratFilt] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [saveMode,    setSaveMode]    = useState(false);
  const [saveName,    setSaveName]    = useState("");
  const [activeId,    setActiveId]    = useState<string | null>(null);

  useEffect(() => { savePresets(presets); }, [presets]);

  const toggleCol = (key: string) => {
    const col = COL_DEFS.find(c => c.key === key);
    if (col?.locked) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setActiveId(null);
  };

  const loadPreset = (p: ExportPreset) => {
    setSelected(new Set(p.columns));
    setStatusFilt(p.status);
    setContratFilt(p.type_contrat);
    setActiveId(p.id);
  };

  const deletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresets(prev => prev.filter(p => p.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) { toast.error("Donnez un nom à cette extraction."); return; }
    const newPreset: ExportPreset = {
      id:          crypto.randomUUID(),
      name,
      columns:     [...selected],
      status:      statusFilt,
      type_contrat: contratFilt,
      createdAt:   new Date().toISOString(),
    };
    setPresets(prev => [newPreset, ...prev]);
    setActiveId(newPreset.id);
    setSaveName("");
    setSaveMode(false);
    toast.success("Extraction sauvegardée.");
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const name = presets.find(p => p.id === activeId)?.name ?? "extraction";
      await exportEmployeesExcel({
        status:       statusFilt,
        type_contrat: contratFilt || undefined,
        columns:      [...selected],
        filename:     `${name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      });
      toast.success("Fichier généré.");
    } catch {
      toast.error("Erreur lors de la génération.");
    } finally {
      setLoading(false);
    }
  };

  const allInGroup = (group: string) =>
    COL_DEFS.filter(c => c.group === group && !c.locked).every(c => selected.has(c.key));

  const toggleGroup = (group: string) => {
    const cols = COL_DEFS.filter(c => c.group === group && !c.locked).map(c => c.key);
    const allOn = allInGroup(group);
    setSelected(prev => {
      const next = new Set(prev);
      cols.forEach(k => allOn ? next.delete(k) : next.add(k));
      return next;
    });
    setActiveId(null);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div>
              <h2 className="font-black text-camublue-900 text-base">Extraction des données</h2>
              <p className="text-xs text-slate-400 mt-0.5">Choisissez les colonnes, appliquez des filtres, puis générez ou sauvegardez</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
              <FiX size={18} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

            {/* ── Presets ── */}
            {(presets.length > 0 || true) && (
              <section>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FiBookmark size={11} /> Extractions sauvegardées
                </p>
                <div className="flex flex-wrap gap-2">
                  {presets.map(p => (
                    <button
                      key={p.id}
                      onClick={() => loadPreset(p)}
                      className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition
                        ${activeId === p.id
                          ? "bg-camublue-900 text-white border-camublue-900"
                          : "bg-white text-slate-600 border-slate-200 hover:border-camublue-900/40 hover:text-camublue-900"
                        }`}
                    >
                      {activeId === p.id && <FiCheck size={11} />}
                      {p.name}
                      <span
                        onClick={e => deletePreset(p.id, e)}
                        className={`ml-0.5 rounded-full p-0.5 transition cursor-pointer
                          ${activeId === p.id ? "hover:bg-white/20" : "hover:bg-red-50 text-slate-300 hover:text-red-500"}`}
                      >
                        <FiTrash2 size={10} />
                      </span>
                    </button>
                  ))}
                  {presets.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Aucune extraction sauvegardée</p>
                  )}
                </div>
              </section>
            )}

            {/* ── Filtres ── */}
            <section>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Filtres</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Statut</label>
                  <select
                    value={statusFilt}
                    onChange={e => { setStatusFilt(e.target.value as Status); setActiveId(null); }}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-camublue-900/20"
                  >
                    <option value="ACTIVE">Actifs uniquement</option>
                    <option value="EXITED">Sortis uniquement</option>
                    <option value="ALL">Tous</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Type de contrat</label>
                  <select
                    value={contratFilt}
                    onChange={e => { setContratFilt(e.target.value); setActiveId(null); }}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-camublue-900/20"
                  >
                    <option value="">Tous les contrats</option>
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="INTERIM">Intérimaire</option>
                    <option value="STAGE">Stage</option>
                    <option value="CONSULTANCE">Consultance</option>
                  </select>
                </div>
              </div>
            </section>

            {/* ── Colonnes ── */}
            <section>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Colonnes <span className="normal-case font-normal text-slate-400">({selected.size} sélectionnées)</span>
              </p>
              <div className="space-y-3">
                {GROUPS.map(group => (
                  <div key={group} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500">{group}</span>
                      {COL_DEFS.some(c => c.group === group && !c.locked) && (
                        <button
                          onClick={() => toggleGroup(group)}
                          className="text-[10px] text-camublue-900 hover:underline"
                        >
                          {allInGroup(group) ? "Tout désélect." : "Tout sélect."}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {COL_DEFS.filter(c => c.group === group).map(col => (
                        <button
                          key={col.key}
                          onClick={() => toggleCol(col.key)}
                          disabled={col.locked}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition
                            ${col.locked
                              ? "bg-camublue-900/10 text-camublue-900 border-camublue-900/20 cursor-default"
                              : selected.has(col.key)
                                ? "bg-camublue-900 text-white border-camublue-900"
                                : "bg-white text-slate-500 border-slate-200 hover:border-camublue-900/30 hover:text-camublue-900"
                            }`}
                        >
                          {col.locked && <span className="opacity-60 text-[9px]">🔒</span>}
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Sauvegarder ── */}
            {saveMode ? (
              <section className="rounded-xl border border-slate-200 p-3 bg-slate-50 flex gap-2 items-center">
                <input
                  autoFocus
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  placeholder="Nom de l'extraction…"
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-camublue-900/20"
                />
                <button onClick={handleSave} className="bg-camublue-900 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-camublue-800 transition font-medium">
                  Sauvegarder
                </button>
                <button onClick={() => { setSaveMode(false); setSaveName(""); }} className="text-slate-400 hover:text-slate-600 transition p-1">
                  <FiX size={16} />
                </button>
              </section>
            ) : null}

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={() => setSaveMode(v => !v)}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-camublue-900 transition font-medium"
            >
              <FiSave size={14} /> Enregistrer cette extraction
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
                Annuler
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading || selected.size === 0}
                className="inline-flex items-center gap-2 bg-camublue-900 text-white text-sm px-5 py-2 rounded-xl hover:bg-camublue-800 transition font-semibold disabled:opacity-50"
              >
                {loading ? <ImSpinner2 size={14} className="animate-spin" /> : <FiDownload size={14} />}
                {loading ? "Génération…" : "Générer"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
