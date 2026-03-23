// src/components/leaves/ManagerDelegationManager.tsx
// Gestion des délégations temporaires d'approbation de congés

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { managerDelegationService } from "@/services/leaveService";
import { getEmployees } from "@/services/employeeService";
import { ManagerDelegation, ManagerDelegationCreate } from "@/types/leave";
import { Employee } from "@/types/employee";
import { ImSpinner2 } from "react-icons/im";
import {
  Plus, UserCheck, Calendar, Trash2, Power, PowerOff, X, ChevronRight,
  AlertCircle, CheckCircle2, User,
} from "lucide-react";
import toast from "react-hot-toast";

const fmt = (d: string) => {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

interface Props { employeeId?: number }

export default function ManagerDelegationManager({ employeeId }: Props) {
  const [delegations, setDelegations]   = useState<ManagerDelegation[]>([]);
  const [employees,   setEmployees]     = useState<Employee[]>([]);
  const [loading,     setLoading]       = useState(true);
  const [showForm,    setShowForm]      = useState(false);
  const [saving,      setSaving]        = useState(false);
  const [form,        setForm]          = useState<Partial<ManagerDelegationCreate>>({
    is_active: true,
  });

  const fetchDelegations = async () => {
    setLoading(true);
    try {
      const params = employeeId ? { delegator_id: employeeId } : undefined;
      const data = await managerDelegationService.getAll(params);
      setDelegations(data);
    } catch {
      toast.error("Erreur lors du chargement des délégations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelegations();
    getEmployees({ status: "ACTIVE" }).then(setEmployees).catch(() => {});
  }, [employeeId]);

  const handleCreate = async () => {
    if (!form.delegator_id || !form.delegate_id || !form.start_date || !form.end_date) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (form.delegator_id === form.delegate_id) {
      toast.error("Le délégant et le délégué ne peuvent pas être la même personne.");
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error("La date de fin doit être après la date de début.");
      return;
    }
    setSaving(true);
    try {
      await managerDelegationService.create(form as ManagerDelegationCreate);
      toast.success("Délégation créée avec succès");
      setShowForm(false);
      setForm({ is_active: true });
      fetchDelegations();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await managerDelegationService.deactivate(id);
      toast.success("Délégation désactivée");
      fetchDelegations();
    } catch {
      toast.error("Erreur lors de la désactivation");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette délégation ?")) return;
    try {
      await managerDelegationService.delete(id);
      toast.success("Délégation supprimée");
      fetchDelegations();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const active   = delegations.filter((d) => d.is_currently_active);
  const upcoming = delegations.filter((d) => d.is_active && d.start_date > today && !d.is_currently_active);
  const past     = delegations.filter((d) => !d.is_currently_active && !upcoming.includes(d));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">Délégations d'approbation</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Permettez à un remplaçant d'approuver les congés pendant votre absence
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold rounded-xl transition"
        >
          <Plus size={15} />
          Nouvelle délégation
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700">Nouvelle délégation</h4>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  Manager délégant <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.delegator_id || ""}
                  onChange={(e) => setForm((f) => ({ ...f, delegator_id: Number(e.target.value) || undefined }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20"
                >
                  <option value="">— Sélectionner le manager —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom} {e.prenom} {e.service ? `(${e.service})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  Délégué (remplaçant) <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.delegate_id || ""}
                  onChange={(e) => setForm((f) => ({ ...f, delegate_id: Number(e.target.value) || undefined }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20"
                >
                  <option value="">— Sélectionner le délégué —</option>
                  {employees.filter((e) => e.id !== form.delegator_id).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom} {e.prenom} {e.service ? `(${e.service})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  Date de début <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.start_date || ""}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  Date de fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  min={form.start_date || undefined}
                  value={form.end_date || ""}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Motif (facultatif)
              </label>
              <textarea
                value={form.reason || ""}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Ex: Congé annuel, déplacement professionnel…"
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
              >
                {saving ? <ImSpinner2 className="animate-spin" size={14} /> : <UserCheck size={15} />}
                Créer la délégation
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="py-12 flex items-center justify-center gap-3 text-slate-400">
          <ImSpinner2 className="animate-spin" size={20} />
          <span className="text-sm">Chargement…</span>
        </div>
      )}

      {/* Active delegations */}
      {!loading && active.length > 0 && (
        <section>
          <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 size={13} /> Délégations actives
          </h4>
          <div className="space-y-3">
            {active.map((d) => (
              <DelegationCard key={d.id} delegation={d} onDeactivate={handleDeactivate} onDelete={handleDelete} isActive />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming delegations */}
      {!loading && upcoming.length > 0 && (
        <section>
          <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar size={13} /> À venir
          </h4>
          <div className="space-y-3">
            {upcoming.map((d) => (
              <DelegationCard key={d.id} delegation={d} onDeactivate={handleDeactivate} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {/* Past delegations */}
      {!loading && past.length > 0 && (
        <section>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertCircle size={13} /> Terminées / désactivées
          </h4>
          <div className="space-y-3 opacity-70">
            {past.map((d) => (
              <DelegationCard key={d.id} delegation={d} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {!loading && delegations.length === 0 && (
        <div className="py-16 text-center text-slate-400">
          <UserCheck size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Aucune délégation configurée</p>
          <p className="text-xs mt-1">Créez une délégation pour permettre à un remplaçant d'approuver les congés.</p>
        </div>
      )}
    </div>
  );
}

function DelegationCard({
  delegation, onDeactivate, onDelete, isActive,
}: {
  delegation: ManagerDelegation;
  onDeactivate?: (id: number) => void;
  onDelete: (id: number) => void;
  isActive?: boolean;
}) {
  return (
    <div className={`
      flex items-center gap-4 p-4 rounded-xl border
      ${isActive
        ? "bg-emerald-50 border-emerald-200"
        : delegation.is_active
          ? "bg-amber-50 border-amber-200"
          : "bg-slate-50 border-slate-200"
      }
    `}>
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
        <User size={18} className="text-slate-500" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-slate-800">{delegation.delegator_name}</span>
          <ChevronRight size={13} className="text-slate-400" />
          <span className="text-sm font-semibold text-camublue-900">{delegation.delegate_name}</span>
          {isActive && (
            <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase">
              Active
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {fmt(delegation.start_date)} → {fmt(delegation.end_date)}
          {delegation.reason && ` · ${delegation.reason}`}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isActive && onDeactivate && (
          <button
            onClick={() => onDeactivate(delegation.id)}
            title="Désactiver"
            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 transition"
          >
            <PowerOff size={14} />
          </button>
        )}
        <button
          onClick={() => onDelete(delegation.id)}
          title="Supprimer"
          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
