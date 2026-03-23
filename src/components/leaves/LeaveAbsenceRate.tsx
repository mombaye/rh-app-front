// src/components/leaves/LeaveAbsenceRate.tsx
// Taux d'absence par département + stats par type de congé

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { leaveRequestService } from "@/services/leaveService";
import { AbsenceRateRow } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import { TrendingDown, TrendingUp, Building2, Users } from "lucide-react";

export default function LeaveAbsenceRate() {
  const currentYear = new Date().getFullYear();
  const [year,    setYear]    = useState(currentYear);
  const [rows,    setRows]    = useState<AbsenceRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [byType,  setByType]  = useState<{leave_type__code:string;leave_type__label:string;leave_type__color:string;total:number;total_days:number}[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      leaveRequestService.getAbsenceRate(year),
      leaveRequestService.statsByType(year),
    ]).then(([absenceData, typeData]) => {
      setRows(absenceData);
      setByType(typeData);
    }).catch(() => {
      setRows([]);
      setByType([]);
    }).finally(() => setLoading(false));
  }, [year]);

  const totalDaysAll = rows.reduce((s, r) => s + r.total_days, 0);
  const avgRate = rows.length > 0
    ? (rows.reduce((s, r) => s + r.absence_rate_pct, 0) / rows.length).toFixed(2)
    : "0.00";
  const worstDept = rows.reduce<AbsenceRateRow | null>(
    (max, r) => (!max || r.absence_rate_pct > max.absence_rate_pct) ? r : max,
    null
  );

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center gap-3 text-slate-400">
        <ImSpinner2 className="animate-spin" size={20} />
        <span className="text-sm">Calcul des taux d'absence…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-500 uppercase">Année</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-camublue-900 bg-white"
        >
          {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-blue-100 rounded-2xl p-5">
          <div className="text-blue-500 mb-2"><Building2 size={20} /></div>
          <p className="text-2xl font-bold text-blue-700">{rows.length}</p>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Départements</p>
        </div>
        <div className="bg-white border border-amber-100 rounded-2xl p-5">
          <div className="text-amber-500 mb-2"><TrendingDown size={20} /></div>
          <p className="text-2xl font-bold text-amber-700">{avgRate}%</p>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Taux d'absence moyen</p>
        </div>
        <div className="bg-white border border-emerald-100 rounded-2xl p-5">
          <div className="text-emerald-500 mb-2"><Users size={20} /></div>
          <p className="text-2xl font-bold text-emerald-700">{totalDaysAll.toFixed(0)}</p>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Jours total approuvés</p>
        </div>
        {worstDept && (
          <div className="bg-white border border-red-100 rounded-2xl p-5">
            <div className="text-red-400 mb-2"><TrendingUp size={20} /></div>
            <p className="text-2xl font-bold text-red-600">{worstDept.absence_rate_pct}%</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
              Max : {worstDept.department || "—"}
            </p>
          </div>
        )}
      </div>

      {/* By Department Table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h4 className="text-sm font-bold text-slate-700">Taux d'absence par département</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Département</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Employés</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Demandes</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Jours</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Taux</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const barWidth = Math.min(100, row.absence_rate_pct * 4); // scale
                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-800">{row.department || "—"}</span>
                        </div>
                        {/* Bar */}
                        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-40">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: row.absence_rate_pct > 10 ? "#ef4444" : row.absence_rate_pct > 5 ? "#f59e0b" : "#10b981",
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.employee_count}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.total_requests}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.total_days.toFixed(1)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`
                          font-bold text-sm px-2.5 py-0.5 rounded-full
                          ${row.absence_rate_pct > 10 ? "bg-red-50 text-red-600"
                            : row.absence_rate_pct > 5 ? "bg-amber-50 text-amber-600"
                            : "bg-emerald-50 text-emerald-600"}
                        `}>
                          {row.absence_rate_pct}%
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Leave Type */}
      {byType.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h4 className="text-sm font-bold text-slate-700">Répartition par type de congé</h4>
          </div>
          <div className="p-5 space-y-3">
            {byType.map((t, i) => {
              const maxDays = Math.max(...byType.map((x) => x.total_days || 0), 1);
              const pct = ((t.total_days || 0) / maxDays) * 100;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.leave_type__color }} />
                  <span className="text-sm text-slate-700 font-medium w-40 truncate" title={t.leave_type__label}>
                    {t.leave_type__label}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: t.leave_type__color }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 w-16 text-right">
                    {(t.total_days || 0).toFixed(0)}j
                  </span>
                  <span className="text-xs text-slate-400 w-16 text-right">{t.total} dem.</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 && byType.length === 0 && (
        <div className="py-16 text-center text-slate-400">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm font-medium">Aucune donnée disponible pour {year}</p>
        </div>
      )}
    </div>
  );
}
