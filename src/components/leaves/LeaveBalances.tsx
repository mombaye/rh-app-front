// src/components/leaves/LeaveBalances.tsx
// Consomme :
//   GET /api/leaves/balances/?year=Y          → getAll (liste globale)
//   GET /api/leaves/balances/employee/<id>/   → getByEmployee
//   PATCH /api/leaves/balances/<id>/adjust/   → adjust  body: { adjusted }
//   GET /api/leaves/balances/<id>/history/    → historique

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { leaveBalanceService } from "@/services/leaveService";
import { ContractType, LeaveBalance } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import { FiEdit3, FiX, FiCheck } from "react-icons/fi";
import { History } from "lucide-react";
import toast from "react-hot-toast";
import { LeaveBalanceHistoryModal } from "./LeaveBalanceHistory";

interface Props {
  contractType?: ContractType;
}

interface EditState {
  id:       number;
  value:    string;
  loading:  boolean;
}

export default function LeaveBalances({ contractType = "INTERNE" }: Props) {
  const currentYear = new Date().getFullYear();
  const [year,        setYear]        = useState(currentYear);
  const [balances,    setBalances]    = useState<LeaveBalance[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [edit,        setEdit]        = useState<EditState | null>(null);
  const [histBalance, setHistBalance] = useState<LeaveBalance | null>(null);

  // GET /api/leaves/balances/?year=Y
  const fetchBalances = async () => {
    setLoading(true);
    try {
      const data = await leaveBalanceService.getAll(year);
      setBalances(data);
    } catch {
      toast.error("Erreur lors du chargement des soldes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBalances(); }, [year, contractType]);

  // PATCH /api/leaves/balances/<id>/adjust/  body: { adjusted }
  const handleAdjustSave = async () => {
    if (!edit) return;
    const adjusted = parseFloat(edit.value);
    if (isNaN(adjusted)) { toast.error("Valeur invalide"); return; }

    setEdit((e) => e ? { ...e, loading: true } : null);
    try {
      await leaveBalanceService.adjust(edit.id, { adjusted });
      toast.success("Solde ajusté avec succès");
      setEdit(null);
      await fetchBalances();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'ajustement");
      setEdit((e) => e ? { ...e, loading: false } : null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Sélecteur année */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{balances.length} solde(s)</p>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900"
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
            <ImSpinner2 className="animate-spin" size={22} />
            <p className="text-sm">Chargement…</p>
          </div>
        ) : balances.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-4xl mb-3">🗂️</p>
            <p className="font-medium">Aucun solde pour {year}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Employé", "Type de congé", "Acquis", "Pris", "Ajustement", "Restant", "Reportés", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balances.map((b, i) => {
                  const remaining = parseFloat(b.remaining);
                  const isLow     = remaining <= 2;
                  const isEdit    = edit?.id === b.id;

                  return (
                    <tr
                      key={b.id}
                      className={`border-b border-gray-50 transition ${
                        i % 2 !== 0 ? "bg-gray-50/30" : ""
                      } ${isLow ? "bg-red-50/40" : ""}`}
                    >
                      {/* Employé */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800 whitespace-nowrap">
                          {b.employee_name}
                        </p>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4">
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{
                            backgroundColor: b.leave_type.color + "20",
                            color:           b.leave_type.color,
                          }}
                        >
                          {b.leave_type.label}
                        </span>
                      </td>

                      {/* Acquis */}
                      <td className="px-5 py-4 text-gray-700 font-medium">
                        {b.acquired}j
                      </td>

                      {/* Pris */}
                      <td className="px-5 py-4 text-gray-700 font-medium">
                        {b.taken}j
                      </td>

                      {/* Ajustement */}
                      <td className="px-5 py-4">
                        {isEdit ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.5"
                              value={edit.value}
                              onChange={(e) =>
                                setEdit((prev) => prev ? { ...prev, value: e.target.value } : null)
                              }
                              className="w-20 border border-camublue-900 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/20"
                              autoFocus
                            />
                            <button
                              onClick={handleAdjustSave}
                              disabled={edit.loading}
                              className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition disabled:opacity-50"
                            >
                              {edit.loading
                                ? <ImSpinner2 className="animate-spin" size={12} />
                                : <FiCheck size={12} />
                              }
                            </button>
                            <button
                              onClick={() => setEdit(null)}
                              className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg transition"
                            >
                              <FiX size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className={`font-medium ${
                            parseFloat(b.adjusted) > 0 ? "text-emerald-600" :
                            parseFloat(b.adjusted) < 0 ? "text-red-500"     : "text-gray-500"
                          }`}>
                            {parseFloat(b.adjusted) > 0 ? "+" : ""}{b.adjusted}j
                          </span>
                        )}
                      </td>

                      {/* Restant — computed par le backend (remaining = acquired + adjusted - taken) */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            isLow
                              ? "bg-red-100 text-red-600"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {isLow && <span>⚠️</span>}
                          {b.remaining}j
                        </span>
                      </td>

                      {/* Reportés */}
                      <td className="px-5 py-4 text-slate-500 font-medium">
                        {parseFloat(b.carried_forward) > 0
                          ? <span className="text-amber-600 font-semibold">+{b.carried_forward}j</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          {!isEdit && (
                            <button
                              onClick={() => setEdit({ id: b.id, value: b.adjusted, loading: false })}
                              className="p-2 text-gray-400 hover:text-camublue-900 hover:bg-camublue-900/5 rounded-lg transition"
                              title="Ajuster le solde"
                            >
                              <FiEdit3 size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setHistBalance(b)}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                            title="Historique du solde"
                          >
                            <History size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History modal */}
      <AnimatePresence>
        {histBalance && (
          <LeaveBalanceHistoryModal
            balance={histBalance}
            onClose={() => setHistBalance(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}