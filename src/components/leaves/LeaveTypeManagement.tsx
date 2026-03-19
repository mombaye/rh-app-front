// src/components/leaves/LeaveTypeManagement.tsx
// CRUD des types de congés + déclenchement manuel de l'accrual mensuel

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveTypeService, leaveRequestService } from "@/services/leaveService";
import { LeaveType } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import { FiPlus, FiEdit2, FiTrash2, FiX, FiAlertCircle, FiRefreshCw, FiZap } from "react-icons/fi";
import toast from "react-hot-toast";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";

const EMPTY_FORM = {
  code:                      "",
  label:                     "",
  is_paid:                   true,
  requires_justification:    false,
  justification_grace_days:  "7",
  color:                     "#3b82f6",
  monthly_accrual:           "0",
  max_days_per_request:      "0",
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

export default function LeaveTypeManagement() {
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
  const [accrualLoading,setAccrualLoading]= useState(false);

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

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (t: LeaveType) => {
    setEditTarget(t);
    setForm({
      code:                      t.code,
      label:                     t.label,
      is_paid:                   t.is_paid,
      requires_justification:    t.requires_justification,
      justification_grace_days:  String(t.justification_grace_days ?? 7),
      color:                     t.color,
      monthly_accrual:           t.monthly_accrual ?? "0",
      max_days_per_request:      String(t.max_days_per_request ?? 0),
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
        code:                      form.code.toUpperCase().trim(),
        label:                     form.label.trim(),
        is_paid:                   form.is_paid,
        requires_justification:    form.requires_justification,
        justification_grace_days:  parseInt(form.justification_grace_days) || 7,
        color:                     form.color,
        monthly_accrual:           parseFloat(form.monthly_accrual) || 0,
        max_days_per_request:      parseInt(form.max_days_per_request) || 0,
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

  const handleTriggerAccrual = async () => {
    setAccrualLoading(true);
    try {
      const res = await leaveRequestService.triggerMonthlyCredit();
      toast.success(res.message ?? "Accrual mensuel lancé ✓");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors du lancement");
    } finally {
      setAccrualLoading(false);
    }
  };

  if (loading) return (
    <div className="py-24 flex flex-col items-center gap-3 text-gray-400">
      <ImSpinner2 className="animate-spin" size={26} />
      <p className="text-sm">Chargement des types de congé…</p>
    </div>
  );

  if (fetchError) return (
    <div className="py-24 flex flex-col items-center gap-4">
      <FiAlertCircle size={30} className="text-red-400" />
      <p className="text-sm text-red-500">{fetchError}</p>
      <button onClick={fetchTypes} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium hover:bg-gray-200 transition">
        <FiRefreshCw size={13} /> Réessayer
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Types de congés</h2>
          <p className="text-xs text-gray-500 mt-0.5">Configurez les types, l'accrual mensuel et les limites.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Déclenchement manuel accrual */}
          <button
            onClick={handleTriggerAccrual}
            disabled={accrualLoading}
            title="Déclencher manuellement l'accrual mensuel pour tous les employés actifs"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium transition disabled:opacity-50"
          >
            {accrualLoading
              ? <ImSpinner2 className="animate-spin" size={14} />
              : <FiZap size={14} />
            }
            Accrual mensuel
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <FiPlus size={14} />
            Nouveau type
          </button>
        </div>
      </div>

      {/* Légende accrual */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <strong>Accrual mensuel :</strong> Le 1er de chaque mois, chaque employé actif reçoit automatiquement
        le nombre de jours configuré sur chaque type. Exemple : 2j/mois pour les Congés Payés.
        Vous pouvez aussi déclencher manuellement le calcul via le bouton ci-dessus.
      </div>

      {/* Grille des types */}
      {types.length === 0 ? (
        <div className="py-20 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-sm">Aucun type de congé configuré</p>
          <p className="text-xs mt-1">Créez votre premier type pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {types.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Bandeau couleur */}
              <div className="h-1.5" style={{ backgroundColor: t.color }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: t.color + "20", color: t.color }}
                      >
                        {t.code}
                      </span>
                      {t.is_paid
                        ? <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">Payé</span>
                        : <span className="text-xs text-gray-500 font-medium bg-gray-100 px-1.5 py-0.5 rounded">Non payé</span>
                      }
                    </div>
                    <p className="font-semibold text-gray-900 text-sm truncate">{t.label}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-camublue-900 hover:bg-gray-100 transition"
                      title="Modifier"
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                      title="Supprimer"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Accrual mensuel</span>
                    <span className="font-semibold text-gray-800">
                      {parseFloat(t.monthly_accrual) > 0 ? `+${t.monthly_accrual}j/mois` : "Aucun"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Max par demande</span>
                    <span className="font-semibold text-gray-800">
                      {t.max_days_per_request > 0 ? `${t.max_days_per_request}j` : "Illimité"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Justificatif requis</span>
                    <span className={`font-semibold ${t.requires_justification ? "text-amber-600" : "text-gray-500"}`}>
                      {t.requires_justification ? "Oui" : "Non"}
                    </span>
                  </div>
                  {t.requires_justification && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Délai justificatif</span>
                      <span className="font-semibold text-amber-700">
                        {t.justification_grace_days ?? 7}j après congé
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Modal Formulaire ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeForm}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[500px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start px-6 pt-6 pb-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
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
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">Couleur</label>
                    <div className="flex items-center gap-2">
                      <input type="color" name="color" value={form.color} onChange={handleChange}
                        className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer"
                      />
                      <input
                        name="color" value={form.color} onChange={handleChange}
                        placeholder="#3b82f6"
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 transition"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                    Libellé <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="label" value={form.label}
                    onChange={handleChange}
                    placeholder="Ex : Congés Payés, Congé Maladie…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                      Accrual mensuel (jours)
                    </label>
                    <input
                      type="number" name="monthly_accrual" value={form.monthly_accrual}
                      onChange={handleChange} min={0} step={0.5}
                      placeholder="0 = pas d'accrual"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 transition"
                    />
                    <p className="text-xs text-gray-400 mt-1">2 = 2j crédités le 1er du mois</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                      Max jours / demande
                    </label>
                    <input
                      type="number" name="max_days_per_request" value={form.max_days_per_request}
                      onChange={handleChange} min={0}
                      placeholder="0 = illimité"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 transition"
                    />
                    <p className="text-xs text-gray-400 mt-1">0 = pas de limite</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" name="is_paid" checked={form.is_paid} onChange={handleChange}
                      className="w-4 h-4 rounded accent-camublue-900"
                    />
                    <span className="text-sm text-gray-700 font-medium">Congé payé</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" name="requires_justification" checked={form.requires_justification} onChange={handleChange}
                      className="w-4 h-4 rounded accent-amber-500"
                    />
                    <span className="text-sm text-gray-700 font-medium">Justificatif requis après le congé</span>
                  </label>
                  {form.requires_justification && (
                    <div className="ml-6.5 pl-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                        Délai de dépôt (jours calendaires après fin du congé)
                      </label>
                      <input
                        type="number" name="justification_grace_days"
                        value={form.justification_grace_days}
                        onChange={handleChange} min={1} max={90}
                        className="w-full border border-amber-200 bg-amber-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition"
                      />
                      <p className="text-xs text-amber-600 mt-1">
                        L'employé aura {form.justification_grace_days || 7} jours après la fin de son congé pour soumettre le justificatif. Passé ce délai, le RH peut le marquer absent.
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
                      : editTarget ? "✓ Enregistrer" : "✓ Créer le type"
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Suppression ─────────────────────────────────────────────── */}
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="Supprimer ce type de congé ?"
        message={
          deleteTarget
            ? <><strong>{deleteTarget.label}</strong> ({deleteTarget.code}) sera supprimé. Les demandes existantes référençant ce type ne seront <strong>pas</strong> supprimées. Cette action est irréversible.</>
            : null
        }
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
