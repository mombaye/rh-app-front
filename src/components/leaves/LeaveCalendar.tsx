// src/components/leaves/LeaveCalendar.tsx
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveRequestService, holidayService } from "@/services/leaveService";
import { ContractType, LeaveCalendarEntry, PublicHoliday } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { Star, Settings2, ChevronDown } from "lucide-react";
import HolidayManager from "@/components/leaves/HolidayManager";

interface Props {
  contractType?: ContractType;
}

const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function LeaveCalendar({ contractType = "INTERNE" }: Props) {
  const today = new Date();
  const [year,              setYear]              = useState(today.getFullYear());
  const [month,             setMonth]             = useState(today.getMonth() + 1);
  const [entries,           setEntries]           = useState<LeaveCalendarEntry[]>([]);
  const [holidays,          setHolidays]          = useState<PublicHoliday[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [showHolidayPanel,  setShowHolidayPanel]  = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      leaveRequestService.getCalendar(month, year),
      holidayService.getForMonth(month, year),
    ])
      .then(([cal, hols]) => { setEntries(cal); setHolidays(hols); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData, contractType]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIdx = getFirstDayOfMonth(year, month);

  // Map: day → leave entries
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

  // Map: "YYYY-MM-DD" → holiday name
  const holidayMap: Record<string, string> = {};
  holidays.forEach((h) => {
    const hDate = new Date(h.date + "T12:00:00");
    const actualMonth = hDate.getMonth() + 1;
    const actualDay   = hDate.getDate();
    if (actualMonth === month) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
      holidayMap[key] = h.name;
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
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <FiChevronLeft size={18} />
        </button>
        <h2 className="text-base font-bold text-gray-800">{MONTHS[month - 1]} {year}</h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <FiChevronRight size={18} />
        </button>
      </div>

      {/* Grille calendrier */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* En-têtes jours */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-3 uppercase tracking-wide">
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
              const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
              const cellEntries = day ? (dayEntries[day] ?? []) : [];
              const dateKey     = day
                ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                : "";
              const holidayName = dateKey ? (holidayMap[dateKey] ?? null) : null;

              return (
                <div
                  key={idx}
                  className={`min-h-[80px] border-b border-r border-gray-50 p-1.5 relative ${
                    !day ? "bg-gray-50/30" : holidayName ? "bg-amber-50/60" : ""
                  }`}
                >
                  {day && (
                    <>
                      <div className="flex items-start justify-between mb-0.5">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                            isToday
                              ? "bg-[#003c71] text-white"
                              : "text-gray-600"
                          }`}
                        >
                          {day}
                        </span>
                        {holidayName && (
                          <span title={holidayName}>
                            <Star size={11} className="text-amber-500 fill-amber-400 mt-0.5" />
                          </span>
                        )}
                      </div>

                      {/* Bandeau jour férié */}
                      {holidayName && (
                        <div
                          className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 truncate mb-0.5 leading-tight"
                          title={holidayName}
                        >
                          {holidayName}
                        </div>
                      )}

                      <div className="space-y-0.5">
                        {cellEntries.slice(0, 2).map((e, i) => (
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
                        {cellEntries.length > 2 && (
                          <p className="text-[10px] text-gray-400 font-medium pl-1">
                            +{cellEntries.length - 2} autre(s)
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

      {/* Légendes */}
      <div className="space-y-3">
        {/* Légende congés */}
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

        {/* Légende jours fériés */}
        {holidays.length > 0 && (
          <div className="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm px-6 py-4">
            <p className="text-xs font-semibold text-amber-700 uppercase mb-3 flex items-center gap-1.5">
              <Star size={12} className="fill-amber-500 text-amber-500" />
              Jours fériés ce mois
            </p>
            <div className="flex flex-wrap gap-2">
              {holidays.map((h) => {
                const d = new Date(h.date + "T12:00:00");
                return (
                  <span
                    key={h.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700"
                  >
                    <Star size={10} className="fill-amber-500 text-amber-500" />
                    {h.name} ({d.getDate()}/{String(d.getMonth() + 1).padStart(2, "0")})
                    {h.is_recurring && <span className="opacity-60 text-[9px]">↺</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Gestion des jours fériés (panneau repliable) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowHolidayPanel((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Settings2 size={16} className="text-amber-500" />
            Gérer les jours fériés
          </span>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${showHolidayPanel ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {showHolidayPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-gray-100 px-6 py-5">
                <HolidayManager onChanged={loadData} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
