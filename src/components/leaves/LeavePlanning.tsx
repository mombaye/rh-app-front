// src/components/leaves/LeavePlanning.tsx
// Planning prévisionnel des congés approuvés — vue Gantt simplifiée

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { leaveRequestService } from "@/services/leaveService";
import { LeavePlanningEntry } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getDayLabel(day: number, month: number, year: number): string {
  const d = new Date(year, month, day);
  const weekday = ["D","L","M","M","J","V","S"][d.getDay()];
  return weekday;
}

function isWeekend(day: number, month: number, year: number): boolean {
  const d = new Date(year, month, day);
  return d.getDay() === 0 || d.getDay() === 6;
}

export default function LeavePlanning() {
  const today    = new Date();
  const [year,   setYear]        = useState(today.getFullYear());
  const [month,  setMonth]       = useState(today.getMonth());
  const [entries,setEntries]     = useState<LeavePlanningEntry[]>([]);
  const [loading,setLoading]     = useState(true);
  const [department, setDept]    = useState("");
  const [departments, setDepts]  = useState<string[]>([]);

  const daysInMonth = getDaysInMonth(year, month);
  const startStr    = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endStr      = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;

  useEffect(() => {
    setLoading(true);
    leaveRequestService.getPlanning(startStr, endStr, department || undefined)
      .then((data) => {
        setEntries(data);
        // Extract unique departments
        const depts = [...new Set(data.map((e) => e.service).filter(Boolean))].sort();
        setDepts(depts as string[]);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [year, month, department]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  // Group entries by employee
  const employeeMap = new Map<number, { name: string; service: string; entries: LeavePlanningEntry[] }>();
  for (const e of entries) {
    if (!employeeMap.has(e.employee_id)) {
      employeeMap.set(e.employee_id, { name: e.employee_name, service: e.service, entries: [] });
    }
    employeeMap.get(e.employee_id)!.entries.push(e);
  }
  const rows = [...employeeMap.values()];

  // Check if a given day is in a leave entry
  function getDayEntry(empEntries: LeavePlanningEntry[], day: number): LeavePlanningEntry | undefined {
    const d = new Date(year, month, day);
    return empEntries.find((e) => {
      const start = new Date(e.start_date + "T00:00:00");
      const end   = new Date(e.end_date   + "T00:00:00");
      return d >= start && d <= end;
    });
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 transition text-slate-600">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">
            {MONTHS_FR[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-slate-100 transition text-slate-600">
            <ChevronRight size={15} />
          </button>
        </div>

        {departments.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-slate-400" />
            <select
              value={department}
              onChange={(e) => setDept(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-camublue-900 bg-white"
            >
              <option value="">Tous les services</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        <span className="text-xs text-slate-400 ml-auto">
          {entries.length > 0 ? `${rows.length} employé(s) en congé ce mois` : "Aucun congé ce mois"}
        </span>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-3 text-slate-400">
          <ImSpinner2 className="animate-spin" size={20} />
          <span className="text-sm">Chargement du planning…</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm font-medium">Aucun congé approuvé ce mois</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase border-r border-slate-200 min-w-[180px]">
                  Employé / Service
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                  <th
                    key={day}
                    className={`px-0 py-2 text-center font-medium border-r border-slate-100 w-8 ${
                      isWeekend(day, month, year)
                        ? "bg-slate-100 text-slate-400"
                        : day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
                          ? "bg-blue-50 text-blue-600"
                          : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    <div className="text-[10px]">{getDayLabel(day, month, year)}</div>
                    <div className="font-bold">{day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ name, service, entries: empEntries }, rowIdx) => (
                <motion.tr
                  key={rowIdx}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: rowIdx * 0.03 }}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition"
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-slate-200">
                    <p className="font-semibold text-slate-800 truncate">{name}</p>
                    {service && <p className="text-slate-400 text-[10px] truncate">{service}</p>}
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const entry = getDayEntry(empEntries, day);
                    const isWknd = isWeekend(day, month, year);
                    return (
                      <td
                        key={day}
                        title={entry ? `${entry.leave_label} (${entry.days}j)` : undefined}
                        className={`border-r border-slate-100 h-8 w-8 p-0 ${
                          isWknd ? "bg-slate-50/80" : ""
                        }`}
                      >
                        {entry ? (
                          <div
                            className="h-full w-full flex items-center justify-center"
                            style={{ backgroundColor: entry.color + "33", borderLeft: `2px solid ${entry.color}` }}
                          >
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: entry.color }}
                              title={entry.leave_label}
                            />
                          </div>
                        ) : (
                          <div className="h-full w-full" />
                        )}
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {rows.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
          <span className="font-semibold">Légende :</span>
          {[...new Map(entries.map((e) => [e.leave_type_id, { label: e.leave_label, color: e.color }])).values()].map(
            (lt) => (
              <span key={lt.label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: lt.color }} />
                {lt.label}
              </span>
            )
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-200" />
            Week-end
          </span>
        </div>
      )}
    </div>
  );
}
