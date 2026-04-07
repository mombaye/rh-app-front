// src/components/leaves/LeaveTypeManagement.tsx
// CRUD des types de congés + déclenchement manuel de l'accrual mensuel

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveTypeService } from "@/services/leaveService";
import { LeaveType } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import { FiEdit2, FiTrash2, FiX, FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import toast from "react-hot-toast";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";

const EMPTY_FORM = {
  code:                     "",
  label:                    "",
  is_paid:                  true,
  requires_justification:   false,
  justification_grace_days: "7",
  monthly_accrual:          "0",
  max_days_per_request:     "0",
  deducts_from_balance:     false,
};

type FormState = typeof EMPTY_FORM;

function parseErrors(data: unknown): string {
  if (!data || typeof data !== "object") return "Une erreur est survenue.";
  const msgs: string[] = [];
  for (const val of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(val)) msgs.push(...val.map(String));
    else if (typeof val === "string") msgs.push(val);
  }
  return msgs.join(" ") || "Une erreur est survenue.";
}

export default function LeaveTypeManagement({ triggerNew = 0 }: { triggerNew?: number }) {
  const [types,         setTypes]         = useState<LeaveType[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [editTarget,    setEditTarget]    = useState<LeaveType | null>(null);
  const [form,          setForm]          = useState<FormState>(EMPTY_FORM);
  const [formLoading,   setFormLoading]   = useState(false);
  const [formError,     setFormError]     = useState<string | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<LeaveType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await leaveTypeService.getAll();
      setTypes(data);
    } catch {
      setFetchError("Impossible de charger les types de congé.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);
  useEffect(() => { if (triggerNew > 0) openCreate(); }, [triggerNew]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (t: LeaveType) => {
    setEditTarget(t);
    setForm({
      code:                     t.code,
      label:                    t.label,
      is_paid:                  t.is_paid,
      requires_justification:   t.requires_justification,
      justification_grace_days: String(t.justification_grace_days ?? 7),
      monthly_accrual:          t.monthly_accrual ?? "0",
      max_days_per_request:     String(t.max_days_per_request ?? 0),
      deducts_from_balance:     t.deducts_from_balance ?? false,
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditTarget(null);
    setFormError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      setFormError("Le code et le libellé sont obligatoires.");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const payload = {
        code:                     form.code.toUpperCase().trim(),
        label:                    form.label.trim(),
        is_paid:                  form.is_paid,
        requires_justification:   form.requires_justification,
        justification_grace_days: parseInt(form.justification_grace_days) || 7,
        monthly_accrual:          parseFloat(form.monthly_accrual) || 0,
        max_days_per_request:     parseInt(form.max_days_per_request) || 0,
        deducts_from_balance:     form.deducts_from_balance,
      };
      if (editTarget) {
        await leaveTypeService.update(editTarget.id, payload);
        toast.success("Type de congé mis à jour ✓");
      } else {
        await leaveTypeService.create(payload);
        toast.success("Type de congé créé ✓");
      }
      closeForm();
      await fetchTypes();
    } catch (err: any) {
      setFormError(parseErrors(err?.response?.data));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await leaveTypeService.delete(deleteTarget.id);
      toast.success(`Type "${deleteTarget.label}" supprimé`);
      setDeleteTarget(null);
      await fetchTypes();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Erreur lors de la suppression");
    } finally {
      setDeleteLoading(false);
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

  return (
    <div className="space-y-3">

      {/* ── Grille des types ── */}
      {types.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
          <p className="text-sm">Aucun type de congé configuré.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {types.map((t) => {
            const accent = t.color || "#1d4ed8";
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Barre de couleur en haut */}
                <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

                <div className="px-4 pt-3 pb-3 flex flex-col gap-2">
                  {/* Code + label */}
                  <div>
                    <span
                      className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-1"
                      style={{ color: accent, backgroundColor: `${accent}18` }}
                    >
                      {t.code}
                    </span>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{t.label}</p>
                  </div>

                  {/* Badges + actions */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {t.is_paid && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                          Payé
                        </span>
                      )}
                      {!t.is_paid && (
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full">
                          Non payé
                        </span>
                      )}
                      {t.requires_justification && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                          Justif.
                        </span>
                      )}
                    </div>
                    {/* Actions (visibles au hover) */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-camublue-900 hover:bg-blue-50 transition"
                        title="Modifier"
                      >
                        <FiEdit2 size={12} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        title="Supprimer"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Modal Formulaire ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={closeForm}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start px-6 pt-6 pb-0">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {editTarget ? "Modifier le type" : "Nouveau type de congé"}
                  </h2>
                  {editTarget && <p className="text-xs text-gray-400 mt-0.5">{editTarget.label}</p>}
                </div>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
                  <FiX size={16} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <AnimatePresence>
                  {formError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
                    >
                      {formError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Code + Libellé */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                      Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="code" value={form.code}
                      onChange={handleChange}
                      placeholder="Ex : CP, RTT, MALADIE"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                      Libellé <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="label" value={form.label}
                      onChange={handleChange}
                      placeholder="Ex : Congés Payés"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
                    />
                  </div>
                </div>

                {/* Accrual + Max jours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                      Accrual mensuel (jours)
                    </label>
                    <input
                      type="number" name="monthly_accrual" value={form.monthly_accrual}
                      onChange={handleChange} min={0} step={0.5}
                      placeholder="0 = pas d'accrual"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 transition"
                    />
                    <p className="text-xs text-gray-400 mt-1">0 = pas d'accrual automatique</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                      Max jours / demande
                    </label>
                    <input
                      type="number" name="max_days_per_request" value={form.max_days_per_request}
                      onChange={handleChange} min={0}
                      placeholder="0 = illimité"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 transition"
                    />
                    <p className="text-xs text-gray-400 mt-1">0 = pas de limite</p>
                  </div>
                </div>

                {/* Cases à cocher */}
                <div className="space-y-2.5 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" name="is_paid" checked={form.is_paid} onChange={handleChange}
                      className="w-4 h-4 rounded accent-camublue-900"
                    />
                    <span className="text-sm text-gray-700 font-medium">Congé payé</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" name="deducts_from_balance" checked={form.deducts_from_balance} onChange={handleChange}
                      className="w-4 h-4 rounded accent-camublue-900"
                    />
                    <span className="text-sm text-gray-700 font-medium">Déduit du solde de congé</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" name="requires_justification" checked={form.requires_justification} onChange={handleChange}
                      className="w-4 h-4 rounded accent-camublue-900"
                    />
                    <span className="text-sm text-gray-700 font-medium">Justificatif requis après le congé</span>
                  </label>
                  {form.requires_justification && (
                    <div className="ml-6 pt-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                        Délai de dépôt (jours après fin du congé)
                      </label>
                      <input
                        type="number" name="justification_grace_days"
                        value={form.justification_grace_days}
                        onChange={handleChange} min={1} max={90}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {form.justification_grace_days || 7} jours calendaires après la fin du congé
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={closeForm} disabled={formLoading}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button onClick={handleSubmit} disabled={formLoading}
                    className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                  >
                    {formLoading
                      ? <><ImSpinner2 className="animate-spin" size={13} /> En cours…</>
                      : editTarget ? "Enregistrer" : "Créer le type"
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Suppression ──────────────────────────────────────────────── */}
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="Supprimer ce type de congé ?"
        message={
          deleteTarget
            ? <><strong>{deleteTarget.label}</strong> ({deleteTarget.code}) sera supprimé. Les demandes existantes ne seront pas supprimées. Cette action est irréversible.</>
            : null
        }
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
