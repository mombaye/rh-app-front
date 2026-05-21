// src/components/leaves/LeaveCountModePanel.tsx
// Gestion du mode de décompte des jours par type de congé

import { useEffect, useState, useCallback } from "react";
import { leaveTypeService } from "@/services/leaveService";
import { LeaveType } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import { FiAlertCircle, FiRefreshCw, FiCheck } from "react-icons/fi";
import toast from "react-hot-toast";

const COUNT_MODE_OPTIONS = [
  { value: "WORKABLE", label: "Ouvrables — Lun–Sam", desc: "Le samedi est compté" },
  { value: "WORKING",  label: "Ouvrés — Lun–Ven",   desc: "Sans samedi" },
  { value: "CALENDAR", label: "Calendaires",          desc: "Tous les jours" },
] as const;

type CountMode = (typeof COUNT_MODE_OPTIONS)[number]["value"];

export default function LeaveCountModePanel() {
  const [types,      setTypes]      = useState<LeaveType[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving,     setSaving]     = useState<Record<number, boolean>>({});
  const [saved,      setSaved]      = useState<Record<number, boolean>>({});
  const [local,      setLocal]      = useState<Record<number, CountMode>>({});

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await leaveTypeService.getAll();
      setTypes(data);
      const map: Record<number, CountMode> = {};
      data.forEach((t) => { map[t.id] = (t.count_mode ?? "WORKABLE") as CountMode; });
      setLocal(map);
    } catch {
      setFetchError("Impossible de charger les types de congé.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const handleChange = (id: number, mode: CountMode) => {
    setLocal((prev) => ({ ...prev, [id]: mode }));
    setSaved((prev) => ({ ...prev, [id]: false }));
  };

  const handleSave = async (t: LeaveType) => {
    setSaving((prev) => ({ ...prev, [t.id]: true }));
    try {
      await leaveTypeService.update(t.id, {
        code:                     t.code,
        label:                    t.label,
        is_paid:                  t.is_paid,
        requires_justification:   t.requires_justification,
        justification_grace_days: t.justification_grace_days ?? 7,
        monthly_accrual:          t.monthly_accrual ?? 0,
        max_days_per_request:     t.max_days_per_request ?? 0,
        deducts_from_balance:     t.deducts_from_balance ?? false,
        count_mode:               local[t.id],
      });
      setSaved((prev) => ({ ...prev, [t.id]: true }));
      setTypes((prev) => prev.map((x) => x.id === t.id ? { ...x, count_mode: local[t.id] } : x));
      toast.success(`Décompte mis à jour pour "${t.label}"`);
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setSaving((prev) => ({ ...prev, [t.id]: false }));
    }
  };

  if (loading) return (
    <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
      <ImSpinner2 className="animate-spin" size={24} />
      <p className="text-sm">Chargement…</p>
    </div>
  );

  if (fetchError) return (
    <div className="py-16 flex flex-col items-center gap-4">
      <FiAlertCircle size={28} className="text-red-400" />
      <p className="text-sm text-red-500">{fetchError}</p>
      <button onClick={fetchTypes} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium hover:bg-gray-200 transition">
        <FiRefreshCw size={13} /> Réessayer
      </button>
    </div>
  );

  if (types.length === 0) return (
    <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
      <p className="text-sm">Aucun type de congé configuré.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 mb-4">
        Définissez comment les jours sont comptés pour chaque type de congé. Ce paramètre s'applique automatiquement à toutes les demandes.
      </p>

      {types.map((t) => {
        const accent   = t.color || "#1d4ed8";
        const mode     = local[t.id] ?? "WORKABLE";
        const isSaving = saving[t.id] ?? false;
        const isDirty  = mode !== ((t.count_mode ?? "WORKABLE") as CountMode);
        const isJustSaved = saved[t.id] && !isDirty;

        return (
          <div
            key={t.id}
            className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 hover:shadow-md transition-shadow"
          >
            {/* Pastille couleur */}
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />

            {/* Code */}
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md shrink-0"
              style={{ color: accent, backgroundColor: `${accent}18` }}
            >
              {t.code}
            </span>

            {/* Libellé */}
            <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{t.label}</span>

            {/* Select mode */}
            <select
              value={mode}
              onChange={(e) => handleChange(t.id, e.target.value as CountMode)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition bg-white text-gray-700 shrink-0"
            >
              {COUNT_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.desc})
                </option>
              ))}
            </select>

            {/* Bouton Enregistrer */}
            <button
              onClick={() => handleSave(t)}
              disabled={!isDirty || isSaving}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
                isJustSaved
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default"
                  : isDirty
                  ? "bg-camublue-900 hover:bg-camublue-800 text-white"
                  : "bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <ImSpinner2 className="animate-spin" size={12} />
              ) : isJustSaved ? (
                <><FiCheck size={12} /> Enregistré</>
              ) : (
                "Enregistrer"
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
