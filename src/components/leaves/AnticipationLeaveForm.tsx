// src/components/leaves/AnticipationLeaveForm.tsx
// Formulaire "Congé par anticipation" soumis par l'employé lui-même.
// Flux : PENDING_RH (validation RH) → PENDING (manager) → APPROVED
// Le solde peut devenir négatif.
// Design aligné sur LeaveFormModal (Nouvelle demande).

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  X, AlertTriangle, Calendar, Clock, CheckCircle2,
  TrendingDown, TrendingUp, Info, Loader2,
} from "lucide-react";
import { leaveTypeService, leaveRequestService, leaveBalanceService, holidayService } from "@/services/leaveService";
import { LeaveType, HolidayCheckResult } from "@/types/leave";
import { useAuth } from "@/contexts/useAuth";
import toast from "react-hot-toast";

interface Props {
  onClose:    () => void;
  onSuccess?: () => void;
}

interface FormState {
  leave_type_id: string;
  start_date:    string;
  end_date:      string;
  motif:         string;
}

const EMPTY: FormState = { leave_type_id: "", start_date: "", end_date: "", motif: "" };

export default function AnticipationLeaveForm({ onClose, onSuccess }: Props) {
  const { user } = useAuth();

  const [leaveTypes,   setLeaveTypes]   = useState<LeaveType[]>([]);
  const [form,         setForm]         = useState<FormState>(EMPTY);
  const [loading,      setLoading]      = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [done,         setDone]         = useState(false);

  const [balance,      setBalance]      = useState<number | null>(null);
  const [holidayCheck, setHolidayCheck] = useState<HolidayCheckResult | null>(null);
  const [checkingDays, setCheckingDays] = useState(false);

  // Charger seulement les types qui déduisent du solde (annuels)
  useEffect(() => {
    setLoadingTypes(true);
    leaveTypeService.getAll()
      .then(types => setLeaveTypes(types.filter(t => t.deducts_from_balance)))
      .catch(() => setError("Impossible de charger les types de congé."))
      .finally(() => setLoadingTypes(false));
  }, []);

  // Charger le solde courant
  useEffect(() => {
    setBalance(null);
    if (!user?.employee_id || !form.leave_type_id) return;
    const year = form.start_date ? new Date(form.start_date).getFullYear() : new Date().getFullYear();
    leaveBalanceService.getByEmployee(user.employee_id, year)
      .then(balances => {
        const b = balances.find((bl: any) => String(bl.leave_type?.id) === form.leave_type_id);
        setBalance(b ? Number(b.remaining) : 0);
      })
      .catch(() => setBalance(null));
  }, [user?.employee_id, form.leave_type_id, form.start_date]);

  // Calculer les jours ouvrables
  useEffect(() => {
    if (!form.start_date || !form.end_date) { setHolidayCheck(null); return; }
    const [sy, sm, sd] = form.start_date.split("-").map(Number);
    const [ey, em, ed] = form.end_date.split("-").map(Number);
    if (new Date(ey, em - 1, ed) < new Date(sy, sm - 1, sd)) { setHolidayCheck(null); return; }
    setCheckingDays(true);
    holidayService.checkDays(form.start_date, form.end_date)
      .then(r => setHolidayCheck(r))
      .catch(() => setHolidayCheck(null))
      .finally(() => setCheckingDays(false));
  }, [form.start_date, form.end_date]);

  const effectiveDays    = holidayCheck?.effective_days ?? 0;
  const projectedBalance = balance !== null && effectiveDays > 0 ? balance - effectiveDays : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      setError("Veuillez remplir tous les champs obligatoires."); return;
    }
    if (!effectiveDays || effectiveDays <= 0) {
      setError("La période sélectionnée ne contient aucun jour ouvrable."); return;
    }
    if (!user?.employee_id) { setError("Employé introuvable."); return; }

    setLoading(true); setError(null);
    try {
      await leaveRequestService.create({
        employee_id:    user.employee_id,
        leave_type_id:  parseInt(form.leave_type_id, 10),
        start_date:     form.start_date,
        end_date:       form.end_date,
        days:           effectiveDays,
        motif:          form.motif,
        is_anticipation: true,
      });
      setDone(true);
      toast.success("Demande d'anticipation soumise au RH.");
      onSuccess?.();
    } catch (err: any) {
      const msg = err?.response?.data?.start_date?.[0]
        ?? err?.response?.data?.non_field_errors?.[0]
        ?? err?.response?.data?.detail
        ?? "Une erreur est survenue.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-[500px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
      >
        {/* ── Header ── identique à LeaveFormModal */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#003c71] to-[#0055a4] px-6 py-5 rounded-t-3xl sm:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <TrendingUp size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Congé par anticipation</h3>
                <p className="text-blue-200 text-xs mt-0.5">Validation RH requise avant le circuit manager</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        {done ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-base">Demande soumise avec succès</p>
              <p className="text-gray-500 text-sm mt-1">
                Votre demande est en attente de validation par le service RH. Vous serez notifié de chaque étape.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-bold hover:bg-[#003c71]/90 transition mt-2"
            >
              Fermer
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">

            {/* Bandeau info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <Info size={15} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                Ce type de congé permet d'anticiper sur votre solde futur.
                Il est d'abord examiné par le <strong>service RH</strong>, puis suit le circuit manager habituel.
                Votre solde peut devenir <strong>négatif</strong>.
              </p>
            </div>

            {/* Type de congé */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Type de congé <span className="text-red-400">*</span>
              </label>
              {loadingTypes ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              ) : (
                <select
                  name="leave_type_id"
                  value={form.leave_type_id}
                  onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
                >
                  <option value="">-- Sélectionner un type --</option>
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Solde actuel */}
            {balance !== null && (
              <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm border ${
                balance <= 0 ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-100"
              }`}>
                <Calendar size={14} className={balance <= 0 ? "text-red-400" : "text-blue-400"} />
                <span className={balance <= 0 ? "text-red-700" : "text-blue-700"}>
                  Solde actuel : <strong>{balance >= 0 ? `+${balance}` : balance} j</strong>
                </span>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date début <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={form.start_date}
                  onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date fin <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={form.end_date}
                  onChange={handleChange}
                  min={form.start_date}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50"
                />
              </div>
            </div>

            {/* Durée calculée */}
            {form.start_date && form.end_date && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                {checkingDays ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-blue-400 shrink-0" />
                    <span className="text-sm text-blue-500">Calcul en cours…</span>
                  </>
                ) : effectiveDays > 0 ? (
                  <>
                    <Calendar size={16} className="text-blue-500 shrink-0" />
                    <span className="text-sm text-blue-700 font-semibold">
                      {effectiveDays} jour{effectiveDays > 1 ? "s" : ""} de congé calculé{effectiveDays > 1 ? "s" : ""}
                    </span>
                    {holidayCheck?.holidays_in_range > 0 && (
                      <span className="ml-auto text-xs text-amber-600">{holidayCheck.holidays_in_range} férié(s) exclu(s)</span>
                    )}
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    <span className="text-sm text-amber-600">Aucun jour ouvrable sur cette période</span>
                  </>
                )}
              </div>
            )}

            {/* Solde projeté */}
            {projectedBalance !== null && effectiveDays > 0 && (
              <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm font-medium border ${
                projectedBalance < 0
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-green-50 border-green-200 text-green-700"
              }`}>
                <TrendingDown size={14} className="shrink-0" />
                Solde après congé : <strong className="ml-1">{projectedBalance >= 0 ? `+${projectedBalance}` : projectedBalance} j</strong>
                {projectedBalance < 0 && (
                  <span className="ml-auto text-[11px] font-normal">(solde négatif autorisé)</span>
                )}
              </div>
            )}

            {/* Motif */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Motif <span className="text-gray-400 font-normal text-xs">(recommandé)</span>
              </label>
              <textarea
                name="motif"
                value={form.motif}
                onChange={handleChange}
                rows={2}
                placeholder="Expliquez brièvement la raison de cette anticipation…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 resize-none bg-gray-50"
              />
            </div>

            {/* Avertissement solde négatif */}
            {projectedBalance !== null && projectedBalance < 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Votre solde passera à <strong>{projectedBalance} j</strong> si cette demande est approuvée.
                  Cela sera récupéré sur vos prochaines acquisitions de congés.
                </p>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm transition font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !form.leave_type_id || !form.start_date || !form.end_date || !effectiveDays}
                className="flex-[2] px-4 py-2.5 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
                Soumettre au RH
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
