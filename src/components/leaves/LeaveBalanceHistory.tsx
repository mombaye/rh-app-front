// src/components/leaves/LeaveBalanceHistory.tsx
// Historique des mouvements de solde + gestion du report d'année

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveBalanceService } from "@/services/leaveService";
import { LeaveBalance, LeaveBalanceHistory as HistoryItem } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import {
  History, TrendingUp, TrendingDown, ArrowRightLeft,
  RefreshCw, X, ChevronRight, ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";

const OPERATION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  ACCRUAL:     { label: "Acquisition",      color: "text-emerald-700", bg: "bg-emerald-50", icon: <TrendingUp size={12} /> },
  DEDUCTION:   { label: "Déduction",        color: "text-red-600",     bg: "bg-red-50",     icon: <TrendingDown size={12} /> },
  RESTORATION: { label: "Restitution",      color: "text-blue-600",    bg: "bg-blue-50",    icon: <TrendingUp size={12} /> },
  ADJUSTMENT:  { label: "Ajustement RH",   color: "text-purple-600",  bg: "bg-purple-50",  icon: <ArrowRightLeft size={12} /> },
  CARRYOVER:   { label: "Report d'année",  color: "text-amber-700",   bg: "bg-amber-50",   icon: <ArrowRight size={12} /> },
  IMPORT:      { label: "Import",           color: "text-slate-600",   bg: "bg-slate-50",   icon: <RefreshCw size={12} /> },
};

interface Props {
  balance: LeaveBalance;
  onClose: () => void;
}

export function LeaveBalanceHistoryModal({ balance, onClose }: Props) {
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const load = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const data = await leaveBalanceService.getHistory(balance.id);
      setHistory(data);
      setLoaded(true);
    } catch {
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  if (!loaded && !loading) { load(); }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <History size={16} className="text-camublue-900" />
              <h3 className="text-base font-bold text-slate-800">
                Historique du solde
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {balance.employee_name} · {balance.leave_type.label} · {balance.year}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <X size={16} />
          </button>
        </div>

        {/* Balance summary */}
        <div className="grid grid-cols-4 gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100">
          {[
            { label: "Acquis", value: balance.acquired, color: "text-emerald-600" },
            { label: "Pris", value: balance.taken, color: "text-red-500" },
            { label: "Ajusté", value: balance.adjusted, color: "text-purple-600" },
            { label: "Restant", value: balance.remaining, color: "text-camublue-900" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-lg font-bold ${color}`}>{value}j</p>
              <p className="text-[10px] text-slate-400 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* History list */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {loading && (
            <div className="py-12 flex items-center justify-center gap-3 text-slate-400">
              <ImSpinner2 className="animate-spin" size={18} />
              <span className="text-sm">Chargement…</span>
            </div>
          )}
          {!loading && history?.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <History size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun mouvement enregistré</p>
            </div>
          )}
          {!loading && history && history.map((item, i) => {
            const cfg = OPERATION_CONFIG[item.operation] ?? OPERATION_CONFIG.ADJUSTMENT;
            const isPositive = parseFloat(item.delta) > 0;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg} border-slate-100`}
              >
                <div className={`${cfg.color} ${cfg.bg} p-1.5 rounded-lg shrink-0`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    {item.performed_by_name && (
                      <span className="text-[10px] text-slate-400">par {item.performed_by_name}</span>
                    )}
                  </div>
                  {item.note && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.note}</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-0.5">{fmt(item.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
                    {isPositive ? "+" : ""}{parseFloat(item.delta).toFixed(1)}j
                  </p>
                  <p className="text-[10px] text-slate-400">→ {parseFloat(item.balance_after).toFixed(1)}j</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

// ── Carryover Panel ──────────────────────────────────────────────────────────
interface CarryoverProps { onDone?: () => void }

export function LeaveCarryoverPanel({ onDone }: CarryoverProps) {
  const currentYear = new Date().getFullYear();
  const [yearFrom,  setYearFrom]  = useState(currentYear - 1);
  const [yearTo,    setYearTo]    = useState(currentYear);
  const [empId,     setEmpId]     = useState<string>("");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<{
    processed: number; skipped: number; total_days_carried: number;
  } | null>(null);

  const handleCarryover = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await leaveBalanceService.carryover(
        yearFrom, yearTo, empId ? parseInt(empId, 10) : undefined
      );
      setResult(res);
      toast.success(`Report effectué : ${res.processed} soldes mis à jour`);
      onDone?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors du report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
      <div>
        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <ArrowRight size={15} className="text-amber-500" />
          Report de soldes d'une année à l'autre
        </h4>
        <p className="text-xs text-slate-500 mt-1">
          Transfère automatiquement les jours restants (dans la limite du paramètre
          "Jours reportables" de chaque type de congé).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Année source</label>
          <select
            value={yearFrom}
            onChange={(e) => setYearFrom(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-camublue-900"
          >
            {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end justify-center pb-2">
          <ChevronRight size={20} className="text-slate-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Année cible</label>
          <select
            value={yearTo}
            onChange={(e) => setYearTo(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-camublue-900"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
        <strong>Note :</strong> Cette opération est idempotente — si le report a déjà été effectué pour une paire
        solde/année, il ne sera pas appliqué à nouveau. Seuls les types de congé avec "Jours reportables &gt; 0"
        sont traités.
      </div>

      <button
        onClick={handleCarryover}
        disabled={loading || yearTo !== yearFrom + 1}
        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
      >
        {loading
          ? <><ImSpinner2 className="animate-spin" size={14} /> Report en cours…</>
          : <><ArrowRight size={15} /> Lancer le report {yearFrom} → {yearTo}</>
        }
      </button>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 space-y-1"
          >
            <p className="font-bold">Report terminé ✓</p>
            <p>✔ {result.processed} solde(s) mis à jour · {result.total_days_carried.toFixed(1)} jours reportés</p>
            <p className="text-xs text-emerald-500">⚠ {result.skipped} solde(s) ignoré(s) (déjà fait, aucun restant, ou type sans report)</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
