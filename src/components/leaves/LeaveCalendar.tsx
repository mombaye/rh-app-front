// src/components/leaves/LeaveCalendar.tsx
// Consomme GET /api/leaves/requests/calendar/?month=M&year=Y  →  calendar() action
// Retourne les absences APPROVED du mois : { employee_id, employee_name, leave_type, color, start_date, end_date, days }

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { leaveRequestService } from "@/services/leaveService";
import { ContractType, LeaveCalendarEntry } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface Props {
  contractType?: ContractType;
}

const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month est 1-indexé
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sun → converti en lundi=0
  const d = new Date(year, month - 1, 1).getDay();
  return (d === 0 ? 6 : d - 1);
}

export default function LeaveCalendar({ contractType = "INTERNE" }: Props) {
  const today    = new Date();
  const [year,   setYear]   = useState(today.getFullYear());
  const [month,  setMonth]  = useState(today.getMonth() + 1); // 1-12
  const [entries,setEntries]= useState<LeaveCalendarEntry[]>([]);
  const [loading,setLoading]= useState(true);

  // GET /api/leaves/requests/calendar/?month=M&year=Y
  useEffect(() => {
    setLoading(true);
    leaveRequestService.getCalendar(month, year)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month, year, contractType]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  // Construit un map jour → entrées
  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayIdx  = getFirstDayOfMonth(year, month);

  const dayEntries: Record<number, LeaveCalendarEntry[]> = {};
  entries.forEach((e) => {
    const start = new Date(e.start_date);
    const end   = new Date(e.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() + 1 === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!dayEntries[day]) dayEntries[day] = [];
        dayEntries[day].push(e);
      }
    }
  });

  const cells = [
    ...Array(firstDayIdx).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-4">
      {/* Navigation mois */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
        >
          <FiChevronLeft size={18} />
        </button>
        <h2 className="text-base font-bold text-gray-800">
          {MONTHS[month - 1]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
        >
          <FiChevronRight size={18} />
        </button>
      </div>

      {/* Grille calendrier */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* En-têtes jours */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAYS_SHORT.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-gray-400 py-3 uppercase tracking-wide"
            >
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center gap-3 text-gray-400">
            <ImSpinner2 className="animate-spin" size={20} />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() + 1 &&
                year === today.getFullYear();
              const cellEntries = day ? (dayEntries[day] ?? []) : [];

              return (
                <div
                  key={idx}
                  className={`min-h-[80px] border-b border-r border-gray-50 p-1.5 ${
                    !day ? "bg-gray-50/30" : ""
                  }`}
                >
                  {day && (
                    <>
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-1 ${
                          isToday
                            ? "bg-camublue-900 text-white"
                            : "text-gray-600"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {cellEntries.slice(0, 3).map((e, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded truncate"
                            style={{
                              backgroundColor: e.color + "25",
                              color:           e.color,
                            }}
                            title={`${e.employee_name} — ${e.leave_type}`}
                          >
                            {e.employee_name.split(" ")[0]}
                          </motion.div>
                        ))}
                        {cellEntries.length > 3 && (
                          <p className="text-[10px] text-gray-400 font-medium pl-1">
                            +{cellEntries.length - 3} autre(s)
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Légende */}
      {entries.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
            {entries.length} absence(s) ce mois
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(entries.map((e) => e.leave_type))).map((lt) => {
              const first = entries.find((e) => e.leave_type === lt)!;
              return (
                <span
                  key={lt}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: first.color + "20", color: first.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: first.color }} />
                  {lt}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}