import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft, X, Lock, Plus, Pencil, Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type WorkContext = "Normale" | "Ramadan" | string;

export interface WorkSchedulePreset {
  context: WorkContext;
  startH: number; startM: number;
  endH:   number; endM:   number;
  breakMin: number;
}

export interface ActiveSchedule extends WorkSchedulePreset {
  dateStart: string;
  dateEnd:   string;
  locked: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const MAX_WORKDAY_MIN = 8 * 60;

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function workDayMinutes(s: WorkSchedulePreset): number {
  return Math.max(0, (s.endH * 60 + s.endM) - (s.startH * 60 + s.startM) - s.breakMin);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isPeriodActive(schedule: ActiveSchedule): boolean {
  const today = todayISO();
  return today >= schedule.dateStart && today <= schedule.dateEnd;
}

function isoToday(): string { return todayISO(); }

function formatMinutes(min: number): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2,"0")}` : `${h}h`;
}

// ─── Composant WorkScheduleModal ───────────────────────────────────────────────
export function WorkScheduleModal({
  open, onClose, active, presets, onSave, onPresetsChange,
}: {
  open: boolean; onClose: () => void; active?: ActiveSchedule | null;
  presets: WorkSchedulePreset[];
  onSave: (s: ActiveSchedule) => void;
  onPresetsChange: (p: WorkSchedulePreset[]) => void;
}) {
  const [view, setView]               = useState<"list"|"period"|"form">("list");
  const [selectedPreset, setSelectedPreset] = useState<WorkSchedulePreset | null>(null);
  const [editingPreset,  setEditingPreset]  = useState<WorkSchedulePreset | null>(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState<string | null>(null);
  const [dateStart, setDateStart] = useState(isoToday());
  const [dateEnd,   setDateEnd]   = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0,10);
  });
  const [saved, setSaved] = useState(false);

  const [fContext,  setFContext]  = useState("");
  const [fStartH,   setFStartH]   = useState(8);
  const [fStartM,   setFStartM]   = useState(0);
  const [fEndH,     setFEndH]     = useState(17);
  const [fEndM,     setFEndM]     = useState(30);
  const [fBreakMin, setFBreakMin] = useState(60);
  const [fError,    setFError]    = useState("");

  const isLocked = active ? isPeriodActive(active) : false;
  const pad = (n: number) => String(n).padStart(2,"0");

  useEffect(() => {
    if (open) {
      setView("list");
      setSaved(false);
      setDeleteConfirm(null);
      setEditingPreset(null);
      if (active) {
        const found = presets.find((p) => p.context === active.context);
        setSelectedPreset(found ?? presets[0] ?? null);
        setDateStart(active.dateStart);
        setDateEnd(active.dateEnd);
      } else {
        setSelectedPreset(presets[0] ?? null);
        setDateStart(isoToday());
      }
    }
  }, [open]);

  const openForm = (preset?: WorkSchedulePreset) => {
    if (preset) {
      setFContext(preset.context);
      setFStartH(preset.startH); setFStartM(preset.startM);
      setFEndH(preset.endH);     setFEndM(preset.endM);
      setFBreakMin(preset.breakMin);
      setEditingPreset(preset);
    } else {
      setFContext(""); setFStartH(8); setFStartM(0);
      setFEndH(17);    setFEndM(30);  setFBreakMin(60);
      setEditingPreset(null);
    }
    setFError("");
    setView("form");
  };

  const handleSavePreset = () => {
    const name = fContext.trim();
    if (!name) { setFError("Le nom du contexte est requis."); return; }
    const isDuplicate = presets.some((p) => p.context === name && p.context !== editingPreset?.context);
    if (isDuplicate) { setFError("Ce nom de contexte existe déjà."); return; }
    const effMin = (fEndH*60+fEndM) - (fStartH*60+fStartM) - fBreakMin;
    if (effMin <= 0) { setFError("La durée effective doit être positive."); return; }

    const newPreset: WorkSchedulePreset = {
      context: name, startH: fStartH, startM: fStartM,
      endH: fEndH, endM: fEndM, breakMin: fBreakMin,
    };

    let updated: WorkSchedulePreset[];
    if (editingPreset) {
      updated = presets.map((p) => p.context === editingPreset.context ? newPreset : p);
      if (selectedPreset?.context === editingPreset.context) setSelectedPreset(newPreset);
    } else {
      updated = [...presets, newPreset];
    }
    onPresetsChange(updated);
    setView("list");
    setFError("");
  };

  const handleDeletePreset = (context: string) => {
    if (active && isPeriodActive(active) && active.context === context) return;
    const updated = presets.filter((p) => p.context !== context);
    onPresetsChange(updated);
    if (selectedPreset?.context === context) setSelectedPreset(updated[0] ?? null);
    setDeleteConfirm(null);
  };

  const handleSavePeriod = () => {
    if (!selectedPreset || dateStart > dateEnd) return;
    onSave({
      ...selectedPreset, dateStart, dateEnd,
      locked: isoToday() >= dateStart && isoToday() <= dateEnd,
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  const plannedMin = selectedPreset ? workDayMinutes(selectedPreset) : 0;
  const exceedsMax = plannedMin > MAX_WORKDAY_MIN;
  const formEffMin = (fEndH*60+fEndM) - (fStartH*60+fStartM) - fBreakMin;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                {(view === "form" || view === "period") && (
                  <button onClick={() => setView("list")} className="p-1 rounded-lg hover:bg-slate-100 transition mr-1">
                    <ChevronLeft className="h-4 w-4 text-slate-500" />
                  </button>
                )}
                <span className="font-semibold text-gray-900">
                  {view === "list"   ? "Heures de travail"
                   : view === "period" ? "Assigner une période"
                   : editingPreset ? "Modifier le contexte" : "Nouveau contexte"}
                </span>
                {view === "list" && isLocked && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                    <Lock className="h-3 w-3" />Période active
                  </span>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* ── Vue : Liste des contextes ── */}
            {view === "list" && (
              <>
                <div className="px-4 sm:px-6 py-5 space-y-3 overflow-y-auto flex-1">
                  {isLocked && active && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <Lock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-800">
                          Période active — contexte <strong>{active.context}</strong>
                        </p>
                        <p className="text-amber-700 text-xs mt-0.5">
                          {pad(active.startH)}h{pad(active.startM)} – {pad(active.endH)}h{pad(active.endM)}
                          {active.breakMin > 0 ? ` · Pause ${active.breakMin}min` : ""}
                          {" · jusqu'au "}{new Date(active.dateEnd).toLocaleDateString("fr-FR",{day:"2-digit",month:"long"})}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {presets.length === 0 && (
                      <p className="text-center text-sm text-slate-400 py-6">Aucun contexte horaire. Créez-en un.</p>
                    )}
                    {presets.map((preset) => {
                      const isActive = active?.context === preset.context && isLocked;
                      const effMin = workDayMinutes(preset);
                      return (
                        <div key={preset.context}
                          className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all ${
                            isActive ? "border-amber-300 bg-amber-50/50" : "border-slate-100 bg-white hover:border-slate-200"
                          }`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 text-sm">{preset.context}</span>
                              {isActive && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Actif</span>}
                            </div>
                            <p className="text-xs font-mono text-slate-500 mt-0.5">
                              {pad(preset.startH)}h{pad(preset.startM)} → {pad(preset.endH)}h{pad(preset.endM)}
                              <span className="mx-1 text-slate-300">·</span>
                              Pause {preset.breakMin}min
                              <span className="mx-1 text-slate-300">·</span>
                              <span className="text-emerald-600 font-semibold">{formatMinutes(effMin)}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {deleteConfirm === preset.context ? (
                              <div className="flex items-center gap-1.5 bg-red-50 rounded-xl px-3 py-1.5 border border-red-200">
                                <span className="text-xs text-red-600 font-medium">Confirmer ?</span>
                                <button onClick={() => handleDeletePreset(preset.context)}
                                  className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition">Oui</button>
                                <button onClick={() => setDeleteConfirm(null)}
                                  className="text-xs font-medium text-slate-500 hover:text-slate-700 px-1">Non</button>
                              </div>
                            ) : (
                              <>
                                <button onClick={() => openForm(preset)} title="Modifier"
                                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDeleteConfirm(preset.context)} title="Supprimer"
                                  disabled={isActive}
                                  className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-gray-100 p-4 sm:p-6 shrink-0 flex gap-2">
                  <button onClick={() => openForm()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-camublue-900 text-white font-medium hover:bg-camublue-800 transition">
                    <Plus className="h-4 w-4" />Ajouter
                  </button>
                  {presets.length > 0 && (
                    <button onClick={() => setView("period")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-800 font-medium hover:bg-slate-200 transition">
                      Assigner période
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── Vue : Formulaire ── */}
            {view === "form" && (
              <>
                <div className="px-4 sm:px-6 py-5 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom du contexte</label>
                    <input type="text" value={fContext} onChange={(e) => setFContext(e.target.value)}
                      placeholder="ex. Normale, Ramadan, Été…"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Début</label>
                        <div className="flex gap-1">
                          <input type="number" min="0" max="23" value={fStartH} onChange={(e) => setFStartH(Math.max(0,Math.min(23,Number(e.target.value))))}
                            className="w-16 px-3 py-2.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                          <span className="py-2.5">h</span>
                          <input type="number" min="0" max="59" value={fStartM} onChange={(e) => setFStartM(Math.max(0,Math.min(59,Number(e.target.value))))}
                            className="w-16 px-3 py-2.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                          <span className="py-2.5">min</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fin</label>
                        <div className="flex gap-1">
                          <input type="number" min="0" max="23" value={fEndH} onChange={(e) => setFEndH(Math.max(0,Math.min(23,Number(e.target.value))))}
                            className="w-16 px-3 py-2.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                          <span className="py-2.5">h</span>
                          <input type="number" min="0" max="59" value={fEndM} onChange={(e) => setFEndM(Math.max(0,Math.min(59,Number(e.target.value))))}
                            className="w-16 px-3 py-2.5 border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                          <span className="py-2.5">min</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pause (min)</label>
                      <input type="number" min="0" value={fBreakMin} onChange={(e) => setFBreakMin(Math.max(0,Number(e.target.value)))}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                    </div>
                  </div>

                  {formEffMin > 0 && (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-sm text-blue-900">
                        <strong>Durée effective:</strong> {formatMinutes(formEffMin)}
                        {formEffMin > MAX_WORKDAY_MIN && <span className="ml-2 text-amber-600">⚠️ Dépasse 8h</span>}
                      </p>
                    </div>
                  )}

                  {fError && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm">
                      {fError}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 p-4 sm:p-6 shrink-0 flex gap-2">
                  <button onClick={() => setView("list")} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 font-medium hover:bg-slate-50 transition">Annuler</button>
                  <button onClick={handleSavePreset} className="flex-1 px-4 py-2.5 rounded-xl bg-camublue-900 text-white font-medium hover:bg-camublue-800 transition">Enregistrer</button>
                </div>
              </>
            )}

            {/* ── Vue : Assigner période ── */}
            {view === "period" && selectedPreset && (
              <>
                <div className="px-4 sm:px-6 py-5 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Contexte sélectionné</label>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-sm font-semibold text-slate-800">{selectedPreset.context}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {pad(selectedPreset.startH)}h{pad(selectedPreset.startM)} – {pad(selectedPreset.endH)}h{pad(selectedPreset.endM)} ({formatMinutes(workDayMinutes(selectedPreset))})
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Début</label>
                      <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fin</label>
                      <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                    </div>
                  </div>

                  {plannedMin > MAX_WORKDAY_MIN && (
                    <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-sm">
                      ⚠️ Cette période de travail dépasse 8h/jour ({formatMinutes(plannedMin)})
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 p-4 sm:p-6 shrink-0 flex gap-2">
                  <button onClick={() => setView("list")} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 font-medium hover:bg-slate-50 transition">Annuler</button>
                  <button onClick={handleSavePeriod} disabled={dateStart > dateEnd}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-camublue-900 text-white font-medium hover:bg-camublue-800 disabled:opacity-50 disabled:cursor-not-allowed transition">
                    {saved ? "✓ Enregistré" : "Enregistrer"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
