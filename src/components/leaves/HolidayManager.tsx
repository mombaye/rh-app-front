// src/components/leaves/HolidayManager.tsx
// Gestion CRUD des jours fériés — vue RH/Admin

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { holidayService } from "@/services/leaveService";
import { PublicHoliday } from "@/types/leave";
import {
  Star, Plus, Pencil, Trash2, X, Loader2, CheckCircle2,
  RefreshCw, Info,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Jours fériés Sénégalais par défaut ──────────────────────────────────────
const DEFAULT_HOLIDAYS: Omit<PublicHoliday, "id">[] = [
  { date: "2024-01-01", name: "Nouvel An",                       is_recurring: true,  description: "1er janvier" },
  { date: "2024-04-04", name: "Fête de l'Indépendance",          is_recurring: true,  description: "4 avril" },
  { date: "2024-05-01", name: "Fête du Travail",                 is_recurring: true,  description: "1er mai" },
  { date: "2024-08-15", name: "Assomption",                      is_recurring: true,  description: "15 août" },
  { date: "2024-11-01", name: "Toussaint",                       is_recurring: true,  description: "1er novembre" },
  { date: "2024-12-25", name: "Noël",                            is_recurring: true,  description: "25 décembre" },
  { date: "2024-02-18", name: "Gamou (Maouloud)",                is_recurring: false, description: "Naissance du Prophète (date variable)" },
];

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Modal ajout/édition ──────────────────────────────────────────────────────
function HolidayFormModal({
  initial, onSave, onClose,
}: {
  initial?: PublicHoliday;
  onSave: (h: PublicHoliday) => void;
  onClose: () => void;
}) {
  const [date,         setDate]         = useState(initial?.date         ?? "");
  const [name,         setName]         = useState(initial?.name         ?? "");
  const [isRecurring,  setIsRecurring]  = useState(initial?.is_recurring ?? false);
  const [description,  setDescription]  = useState(initial?.description  ?? "");
  const [saving,       setSaving]       = useState(false);

  const handleSave = async () => {
    if (!date || !name.trim()) { toast.error("Date et nom requis."); return; }
    setSaving(true);
    try {
      const payload = { date, name: name.trim(), is_recurring: isRecurring, description };
      const result = initial
        ? await holidayService.update(initial.id, payload)
        : await holidayService.create(payload);
      onSave(result);
      toast.success(initial ? "Jour férié modifié." : "Jour férié ajouté.");
      onClose();
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
         onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{    opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.16 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Star size={15} className="text-amber-500 fill-amber-400" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">
              {initial ? "Modifier le jour férié" : "Ajouter un jour férié"}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Nom du jour férié</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex : Korite, Tabaski, Fête du Travail…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
          </div>

          {/* Récurrent */}
          <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="pt-0.5">
              <button
                onClick={() => setIsRecurring(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors flex items-center ${isRecurring ? "bg-amber-500" : "bg-gray-300"}`}
              >
                <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${isRecurring ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">Récurrent chaque année</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Si activé, ce jour sera automatiquement férié chaque année à cette même date (mois/jour).
                À désactiver pour les fêtes islamiques dont la date varie.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Description (optionnel)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex : Fête islamique de fin de Ramadan"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
          </div>
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving || !date || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {initial ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function HolidayManager() {
  const [holidays,    setHolidays]    = useState<PublicHoliday[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<PublicHoliday | undefined>(undefined);
  const [deletingId,  setDeletingId]  = useState<number | null>(null);
  const [filterYear,  setFilterYear]  = useState<number>(new Date().getFullYear());
  const [seeding,     setSeeding]     = useState(false);

  const load = () => {
    setLoading(true);
    holidayService.getAll(filterYear)
      .then(setHolidays)
      .catch(() => toast.error("Erreur lors du chargement."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await holidayService.delete(id);
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast.success("Jour férié supprimé.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    let created = 0;
    for (const h of DEFAULT_HOLIDAYS) {
      try { await holidayService.create(h); created++; } catch { /* already exists */ }
    }
    toast.success(`${created} jour(s) férié(s) ajouté(s).`);
    load();
    setSeeding(false);
  };

  const openAdd  = () => { setEditing(undefined); setShowForm(true); };
  const openEdit = (h: PublicHoliday) => { setEditing(h); setShowForm(true); };

  // Séparer récurrents / année spécifique
  const recurring = holidays.filter(h => h.is_recurring);
  const specific  = holidays.filter(h => !h.is_recurring);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + 1 - i);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <Star size={18} className="text-amber-500 fill-amber-400" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">Jours fériés</p>
            <p className="text-xs text-gray-400">Ces jours ne sont pas décomptés des congés</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {holidays.length === 0 && !loading && (
            <button onClick={handleSeed} disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-50 transition disabled:opacity-50">
              {seeding ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Charger les fériés sénégalais
            </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition">
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Les jours fériés récurrents (↺) s'appliquent automatiquement chaque année au même mois/jour.
          Pour les fêtes islamiques à date variable (Korite, Tabaski…), désactivez "Récurrent" et créez une entrée par année.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-amber-400" />
        </div>
      ) : holidays.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Star size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">Aucun jour férié configuré pour {filterYear}.</p>
          <button onClick={handleSeed} disabled={seeding}
            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition mx-auto disabled:opacity-50">
            {seeding ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Charger les fériés sénégalais par défaut
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Jours récurrents */}
          {recurring.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1.5">
                  <RefreshCw size={11} /> Jours récurrents ({recurring.length})
                </p>
              </div>
              {recurring.map((h, i) => (
                <HolidayRow
                  key={h.id} holiday={h}
                  isLast={i === recurring.length - 1}
                  onEdit={() => openEdit(h)}
                  onDelete={() => handleDelete(h.id)}
                  deleting={deletingId === h.id}
                />
              ))}
            </div>
          )}

          {/* Jours spécifiques à une année */}
          {specific.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
                  <Star size={11} /> Jours spécifiques {filterYear} ({specific.length})
                </p>
              </div>
              {specific.map((h, i) => (
                <HolidayRow
                  key={h.id} holiday={h}
                  isLast={i === specific.length - 1}
                  onEdit={() => openEdit(h)}
                  onDelete={() => handleDelete(h.id)}
                  deleting={deletingId === h.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showForm && (
          <HolidayFormModal
            key="holiday-form"
            initial={editing}
            onSave={h => {
              setHolidays(prev =>
                editing
                  ? prev.map(x => x.id === h.id ? h : x)
                  : [...prev, h]
              );
            }}
            onClose={() => { setShowForm(false); setEditing(undefined); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Ligne de jour férié ──────────────────────────────────────────────────────
function HolidayRow({
  holiday, isLast, onEdit, onDelete, deleting,
}: {
  holiday: PublicHoliday;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition ${!isLast ? "border-b border-gray-50" : ""}`}>
      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
        <Star size={16} className="text-amber-400 fill-amber-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1.5">
          {holiday.name}
          {holiday.is_recurring && (
            <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
              <RefreshCw size={9} /> Récurrent
            </span>
          )}
        </p>
        <p className="text-xs text-gray-400">
          {formatDate(holiday.date)}
          {holiday.description && <span className="ml-1.5 text-gray-300">· {holiday.description}</span>}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-[#003c71]/10 hover:text-[#003c71] transition">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} disabled={deleting}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-50">
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  );
}
