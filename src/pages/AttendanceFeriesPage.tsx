// src/pages/AttendanceFeriesPage.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Plus, Trash2, Pencil, X, RefreshCw,
  CheckCircle2, RotateCcw, AlertTriangle,
} from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import AppLayout from "@/layouts/AppLayout";
import { holidayService } from "@/services/leaveService";
import type { PublicHoliday } from "@/types/leave";

const MONTHS_FR = ["Janv.","Févr.","Mars","Avr.","Mai","Juin",
                   "Juil.","Août","Sept.","Oct.","Nov.","Déc."];

function fmtDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}

// ─── Modal ajout / édition ────────────────────────────────────────────────────
function HolidayModal({
  initial, onClose, onSaved,
}: {
  initial?: PublicHoliday;
  onClose: () => void;
  onSaved: (h: PublicHoliday) => void;
}) {
  const isEdit = !!initial;
  const [date,        setDate]        = useState(initial?.date ?? "");
  const [name,        setName]        = useState(initial?.name ?? "");
  const [isRecurring, setIsRecurring] = useState(initial?.is_recurring ?? false);
  const [saving,      setSaving]      = useState(false);

  const handleSave = async () => {
    if (!date || !name.trim()) { toast.error("Remplissez tous les champs."); return; }
    setSaving(true);
    try {
      const payload = { date, name: name.trim(), is_recurring: isRecurring };
      const result = isEdit
        ? await holidayService.update(initial!.id, payload)
        : await holidayService.create(payload);
      onSaved(result);
      toast.success(isEdit ? "Jour férié modifié." : "Jour férié ajouté.");
      onClose();
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#003c71] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <CalendarDays size={18} className="text-white" />
            </div>
            <p className="text-white font-bold text-sm">
              {isEdit ? "Modifier le jour férié" : "Ajouter un jour férié"}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
            <X size={14} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date <span className="text-red-400">*</span></label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nom du jour férié <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : Fête du Travail, Tabaski…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition"
            />
          </div>

          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="w-4 h-4 accent-[#003c71]"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">Récurrent chaque année</p>
              <p className="text-xs text-gray-400">Se répète automatiquement les années suivantes</p>
            </div>
            {isRecurring && <RotateCcw size={14} className="text-[#003c71] ml-auto shrink-0" />}
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-[2] bg-[#003c71] hover:bg-[#003c71]/90 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
              {saving ? <ImSpinner2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
              {isEdit ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AttendanceFeriesPage() {
  const currentYear = new Date().getFullYear();
  const [year,       setYear]       = useState(currentYear);
  const [holidays,   setHolidays]   = useState<PublicHoliday[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState<PublicHoliday | undefined>();
  const [delConfirm, setDelConfirm] = useState<number | null>(null);
  const [deleting,   setDeleting]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await holidayService.getAll(year);
      // Trier par date
      setHolidays(data.sort((a, b) => a.date.localeCompare(b.date)));
    } catch {
      toast.error("Erreur chargement des jours fériés.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaved = (h: PublicHoliday) => {
    setHolidays(prev => {
      const without = prev.filter(x => x.id !== h.id);
      return [...without, h].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await holidayService.delete(id);
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast.success("Jour férié supprimé.");
      setDelConfirm(null);
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

  return (
    <AppLayout>
      <div className="space-y-5 pb-10">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Jours fériés</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gérez les jours fériés affichés dans les pointages</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition" title="Rafraîchir">
              <RefreshCw size={16} className="text-gray-500" />
            </button>
            {/* Sélecteur année */}
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 bg-white outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={() => { setEditTarget(undefined); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#003c71] hover:bg-[#003c71]/90 text-white rounded-xl text-sm font-semibold transition"
            >
              <Plus size={15} /> Ajouter un férié
            </button>
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16">
            <ImSpinner2 className="animate-spin text-[#003c71]" size={28} />
          </div>
        ) : holidays.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <CalendarDays size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 font-medium">Aucun jour férié pour {year}</p>
            <p className="text-gray-300 text-sm mt-1">Cliquez sur "Ajouter un férié" pour en créer un.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#003c71] text-white text-xs">
                  <th className="px-5 py-3 text-left font-semibold">Date</th>
                  <th className="px-5 py-3 text-left font-semibold">Nom</th>
                  <th className="px-5 py-3 text-left font-semibold">Récurrent</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {holidays.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-3 font-medium text-gray-700">{fmtDate(h.date)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                        <span className="font-semibold text-purple-700">{h.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {h.is_recurring ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[#003c71] font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                          <RotateCcw size={10} /> Récurrent
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Ponctuel</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {delConfirm === h.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle size={12} /> Confirmer ?
                          </span>
                          <button
                            onClick={() => handleDelete(h.id)}
                            disabled={deleting}
                            className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition disabled:opacity-60"
                          >
                            {deleting ? <ImSpinner2 className="animate-spin" size={11} /> : "Oui"}
                          </button>
                          <button
                            onClick={() => setDelConfirm(null)}
                            className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setEditTarget(h); setShowModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-[#003c71] transition"
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDelConfirm(h.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 text-xs text-gray-400">
              {holidays.length} jour{holidays.length > 1 ? "s" : ""} férié{holidays.length > 1 ? "s" : ""} pour {year}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <HolidayModal
            initial={editTarget}
            onClose={() => { setShowModal(false); setEditTarget(undefined); }}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
