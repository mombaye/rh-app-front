import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  Users, Clock, AlertTriangle, UserMinus,
  Filter, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2,
} from "lucide-react";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import {
  getDailyStats,
  getWeeklyStats,
  getMonthlyStats,
  getEmployeePeriodDetail,
} from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import type {
  DailyStatsResponse,
  WeeklyStatsResponse,
  MonthlyStatsResponse,
  EmployeePeriodDetailResponse,
  DayDetail,
} from "@/types/attendance";
import type { Employee } from "@/types/employee";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ViewMode     = "daily" | "weekly" | "monthly";
type StatusFilter = "all" | "ok" | "absent" | "incomplete" | "anomaly" | "late" | "deficit";
type MotifType    = "absent" | "not_pointing";

interface FlatRecord {
  employee_id          : number;
  matricule            : string;
  full_name            : string;
  department           : string;
  status               : "ok" | "absent" | "incomplete" | "anomaly";
  is_late_api          : boolean;
  late_label_api       : string | null;
  late_minutes_api     : number;
  computed_late_minutes: number;
  overtime_minutes     : number;
  compensation         : CompensationResult;
  deficit_minutes      : number;
  in_time              : string | null;
  out_time             : string | null;
  delta_minutes        : number;
  worked_minutes       : number;
  expected_minutes     : number;
  email                : string | null;
}

interface Pointage {
  day: string;
  date: string;
  in_time: string | null;
  out_time: string | null;
  status: "ok" | "absent" | "incomplete" | "anomaly";
}

interface CompensationResult {
  late_min       : number;
  overtime_min   : number;
  compensated_min: number;
  remaining_min  : number;
  is_compensated : boolean;
  has_overtime   : boolean;
}

// ─────────────────────────────────────────────
// Seuils horaires (modifiables)
// ─────────────────────────────────────────────
const LATE_H      = 8;
const LATE_M      = 0;
const OT_H        = 17;
const OT_M        = 30;
const WORKDAY_MIN = 510;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

function formatMinutes(min: number): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function computeLateMinutes(inTimeIso: string | null): number {
  if (!inTimeIso) return 0;
  const d = new Date(inTimeIso);
  if (isNaN(d.getTime())) return 0;
  const totalIn   = d.getHours() * 60 + d.getMinutes();
  const threshold = LATE_H * 60 + LATE_M;
  return totalIn > threshold ? totalIn - threshold : 0;
}

function computeOvertimeMinutes(outTimeIso: string | null): number {
  if (!outTimeIso) return 0;
  const d = new Date(outTimeIso);
  if (isNaN(d.getTime())) return 0;
  const totalOut  = d.getHours() * 60 + d.getMinutes();
  const threshold = OT_H * 60 + OT_M;
  return totalOut > threshold ? totalOut - threshold : 0;
}

function computeCompensation(lateMin: number, overtimeMin: number): CompensationResult {
  const compensated = Math.min(lateMin, overtimeMin);
  const remaining   = Math.max(0, lateMin - compensated);
  return {
    late_min       : lateMin,
    overtime_min   : overtimeMin,
    compensated_min: compensated,
    remaining_min  : remaining,
    is_compensated : lateMin > 0 && remaining === 0,
    has_overtime   : overtimeMin > 0,
  };
}

function computeDeficitMinutes(workedMin: number, expectedMin: number): number {
  const expected = expectedMin > 0 ? expectedMin : WORKDAY_MIN;
  return workedMin > 0 ? Math.max(0, expected - workedMin) : 0;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function isoWeekNow(): string {
  const d    = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day  = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime()-yearStart.getTime())/86400000)+1)/7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2,"0")}`;
}
function yyyyMmToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function exportCSV(filename: string, rows: Record<string,any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h=>esc(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename+".csv";
  a.click();
}

// ─────────────────────────────────────────────
// Mock send (à remplacer par le vrai service)
// ─────────────────────────────────────────────
async function sendAlertEmail(employee: FlatRecord, motif: MotifType): Promise<{ success: boolean }> {
  // Simulation d'un appel API
  await new Promise(res => setTimeout(res, 500));
  if (!employee.email) return { success: false };
  console.log(`Email envoyé à ${employee.email} pour motif: ${motif}`);
  return { success: true };
}

// ─────────────────────────────────────────────
// Config statuts & filtres
// ─────────────────────────────────────────────
const STATUS_CFG = {
  ok        : { label:"OK",        dot:"bg-emerald-500", badge:"bg-emerald-50 text-emerald-700 ring-emerald-200"  },
  absent    : { label:"Absent",    dot:"bg-red-500",     badge:"bg-red-50 text-red-700 ring-red-200"              },
  incomplete: { label:"Incomplet", dot:"bg-amber-500",   badge:"bg-amber-50 text-amber-800 ring-amber-200"        },
  anomaly   : { label:"Anomalie",  dot:"bg-violet-500",  badge:"bg-violet-50 text-violet-700 ring-violet-200"     },
};

const QUICK_FILTERS: {
  key: StatusFilter;
  label: string;
  dotColor: string;
  activeText: string;
  activeBg: string;
  activeDot: string;
}[] = [
  { key:"all",        label:"Tous",          dotColor:"bg-slate-400",   activeText:"text-slate-800",   activeBg:"bg-slate-900",   activeDot:"bg-white"         },
  { key:"ok",         label:"OK",            dotColor:"bg-emerald-400", activeText:"text-emerald-700", activeBg:"bg-emerald-50",  activeDot:"bg-emerald-500"   },
  { key:"absent",     label:"Absents",       dotColor:"bg-red-400",     activeText:"text-red-700",     activeBg:"bg-red-50",      activeDot:"bg-red-500"       },
  { key:"late",       label:"Retards >08h",  dotColor:"bg-orange-400",  activeText:"text-orange-700",  activeBg:"bg-orange-50",   activeDot:"bg-orange-500"    },
  { key:"incomplete", label:"Incomplets",    dotColor:"bg-amber-400",  activeText:"text-amber-800",  activeBg:"bg-amber-50",  activeDot:"bg-amber-500"  },
  { key:"anomaly",    label:"Anomalies",     dotColor:"bg-violet-400", activeText:"text-violet-700", activeBg:"bg-violet-50", activeDot:"bg-violet-500" },
  { key:"deficit",    label:"Heures moins",      dotColor:"bg-rose-400",   activeText:"text-rose-700",   activeBg:"bg-rose-50",   activeDot:"bg-rose-500"   },
];

// ─────────────────────────────────────────────
// Composants UI
// ─────────────────────────────────────────────
function StatusPill({ status }: { status: keyof typeof STATUS_CFG }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.anomaly;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function LateBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 ring-1 ring-orange-300 whitespace-nowrap">
      <Clock className="h-3 w-3 shrink-0" />
      RETARD · {formatMinutes(minutes)}
    </span>
  );
}

function OvertimeBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 whitespace-nowrap">
      <Clock className="h-3 w-3 shrink-0" />
      +{formatMinutes(minutes)}
    </span>
  );
}

function DeficitBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 ring-1 ring-rose-200 whitespace-nowrap">
      − {formatMinutes(minutes)}
    </span>
  );
}

function CompensationCell({ c, viewMode }: { c: CompensationResult; viewMode: string }) {
  if (viewMode !== "daily" || c.late_min === 0) {
    return <span className="text-slate-300 text-xs">—</span>;
  }
  if (c.is_compensated) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 whitespace-nowrap">
        ✓ Compensé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 ring-1 ring-red-200 whitespace-nowrap">
      ✗ Non compensé
    </span>
  );
}

function StatCard({
  icon: Icon, label, value, sub, color="blue", delay=0, loading=false, active=false, onClick,
}: {
  icon: any; label: string; value: string|number; sub?: string;
  color?: "blue"|"green"|"amber"|"red"|"violet"|"slate"|"orange";
  delay?: number; loading?: boolean; active?: boolean; onClick?: ()=>void;
}) {
  const palette = {
    blue  : { icon:"bg-camublue-900 text-white", text:"text-camublue-900" },
    green : { icon:"bg-emerald-500 text-white",  text:"text-emerald-700"  },
    amber : { icon:"bg-amber-500 text-white",    text:"text-amber-700"    },
    red   : { icon:"bg-red-500 text-white",      text:"text-red-700"      },
    violet: { icon:"bg-violet-500 text-white",   text:"text-violet-700"   },
    slate : { icon:"bg-slate-400 text-white",    text:"text-slate-600"    },
    orange: { icon:"bg-orange-500 text-white",   text:"text-orange-700"   },
  };
  const c = palette[color];
  return (
    <motion.div
      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
      transition={{ delay, duration:0.4, ease:"easeOut" }}
      onClick={onClick}
      className={`bg-white rounded-2xl border p-5 shadow-sm transition-all
        ${onClick ? "cursor-pointer" : ""}
        ${active ? "border-orange-400 ring-2 ring-orange-200 shadow-md" : "border-slate-100 hover:shadow-md"}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.icon}`}><Icon className="h-5 w-5" /></div>
        {active && (
          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full ring-1 ring-orange-200">
            Filtré
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2 mt-1">
          <div className="h-7 w-20 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <div className={`text-2xl font-bold ${c.text} mb-0.5`}>{value}</div>
          <div className="text-sm font-medium text-slate-700">{label}</div>
          {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
        </>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// FilterModal
// ─────────────────────────────────────────────
interface FilterModalProps {
  open: boolean; onClose: ()=>void;
  viewMode: ViewMode; setViewMode: (v:ViewMode)=>void;
  date: string; setDate: (v:string)=>void;
  week: string; setWeek: (v:string)=>void;
  month: string; setMonth: (v:string)=>void;
  statusFilter: StatusFilter; setStatusFilter: (v:StatusFilter)=>void;
  onApply: ()=>void;
}
function FilterModal({
  open, onClose, viewMode, setViewMode,
  date, setDate, week, setWeek, month, setMonth,
  statusFilter, setStatusFilter, onApply,
}: FilterModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
            initial={{ y:40, opacity:0, scale:0.97 }} animate={{ y:0, opacity:1, scale:1 }}
            exit={{ y:40, opacity:0, scale:0.97 }}
            transition={{ type:"spring", stiffness:300, damping:30 }}
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-600" />
                <span className="font-semibold text-gray-900">Filtres & Période</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Affichage</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { k:"daily",   label:"Journalier",   icon:"📅" },
                    { k:"weekly",  label:"Hebdomadaire", icon:"📆" },
                    { k:"monthly", label:"Mensuel",      icon:"🗓️" },
                  ] as {k:ViewMode;label:string;icon:string}[]).map((v) => (
                    <button key={v.k} onClick={()=>setViewMode(v.k)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 text-xs font-semibold transition-all ${
                        viewMode===v.k
                          ? "border-camublue-900 bg-camublue-900/10 text-camublue-900"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
                      <span className="text-xl">{v.icon}</span>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Période</p>
                {viewMode==="daily" && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Date</label>
                    <input type="date" value={date} onChange={(e)=>setDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                  </div>
                )}
                {viewMode==="weekly" && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Semaine (ex : 2026-W09)</label>
                    <input value={week} onChange={(e)=>setWeek(e.target.value)} placeholder="2026-W09"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                  </div>
                )}
                {viewMode==="monthly" && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Mois</label>
                    <input type="month" value={month} onChange={(e)=>setMonth(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none" />
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Statut / Type
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_FILTERS.map((f) => (
                    <button key={f.key} onClick={()=>setStatusFilter(f.key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        statusFilter===f.key
                          ? `${f.activeBg} ${f.activeText} border-transparent ring-1 ring-inset ring-current/20`
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusFilter===f.key ? f.activeDot : f.dotColor}`} />
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  ⏰ Le filtre <em>Retards &gt; 08h</em> isole les entrées enregistrées après 08h00.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={onClose}
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={()=>{ onApply(); onClose(); }}
                className="flex-1 rounded-2xl bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 text-sm font-medium transition">
                Appliquer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// DetailModal
// ─────────────────────────────────────────────
interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: number | null;
  initialWeek: string;
}

function DetailModal({ open, onClose, employeeId, initialWeek }: DetailModalProps) {
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);

  const getWeekStartAndEnd = (weekStr: string) => {
    const [year, weekNum] = weekStr.split("-W").map(Number);
    const firstDayOfYear = new Date(year, 0, 1);
    const firstWeekDay = new Date(firstDayOfYear);
    firstWeekDay.setDate(firstWeekDay.getDate() + (weekNum - 1) * 7 - firstWeekDay.getDay() + 1);

    const lastWeekDay = new Date(firstWeekDay);
    lastWeekDay.setDate(lastWeekDay.getDate() + 4);

    return {
      start: firstWeekDay.toISOString().split("T")[0],
      end: lastWeekDay.toISOString().split("T")[0],
    };
  };

  const fetchPointages = useCallback(async () => {
    if (!employeeId || !open) return;

    setLoading(true);
    try {
      const { start, end } = getWeekStartAndEnd(selectedWeek);
      const response: EmployeePeriodDetailResponse = await getEmployeePeriodDetail({
        employee_id: employeeId,
        start,
        end,
      });

      const daysOfWeek = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
      const pointagesData: Pointage[] = daysOfWeek.map((day, index) => {
        const currentDate = new Date(start);
        currentDate.setDate(currentDate.getDate() + index);
        const dateStr = currentDate.toISOString().split("T")[0];

        const dayDetail = response.days.find((dayDetail: DayDetail) =>
          dayDetail.date === dateStr
        );

        return {
          day,
          date: dateStr,
          in_time: dayDetail?.in_time || null,
          out_time: dayDetail?.out_time || null,
          status: dayDetail?.status || "absent",
        };
      });

      setPointages(pointagesData);
    } catch (error) {
      console.error("Erreur lors de la récupération des pointages :", error);
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedWeek, open]);

  useEffect(() => {
    fetchPointages();
  }, [fetchPointages]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-camublue-900">Pointages hebdomadaires</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Sélecteur de semaine */}
            <div className="px-6 py-3 border-b border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Sélectionner une semaine (ex: 2026-W09)
              </label>
              <input
                type="text"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                placeholder="2026-W09"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none"
              />
              <button
                onClick={fetchPointages}
                className="mt-2 px-4 py-2 bg-camublue-900 text-white rounded-lg text-sm hover:bg-camublue-800 transition"
              >
                Charger
              </button>
            </div>

            {/* Contenu */}
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-10 w-10 border-4 border-camublue-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pointages.length > 0 ? (
                <div className="space-y-2">
                  {/* En-tête du tableau */}
                  <div className="grid grid-cols-5 gap-4 p-3 bg-slate-50 rounded-xl font-semibold text-slate-700">
                    <span>Jour</span>
                    <span>Date</span>
                    <span>Statut</span>
                    <span>Entrée</span>
                    <span>Sortie</span>
                  </div>

                  {/* Lignes de pointages */}
                  {pointages.map((p, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-5 gap-4 p-3 rounded-xl border transition-colors ${
                        p.status === "ok"
                          ? "bg-white border-slate-100 hover:shadow-sm"
                          : "bg-rose-50 border-rose-100"
                      }`}
                    >
                      <span className="font-medium text-slate-800">{p.day}</span>
                      <span className="text-sm text-slate-600">
                        {new Date(p.date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-sm">
                        <StatusPill status={p.status} />
                      </span>
                      <span className={`text-sm ${p.in_time ? "text-slate-700" : "text-slate-400"}`}>
                        {p.in_time ? formatTime(p.in_time) : "—"}
                      </span>
                      <span className={`text-sm ${p.out_time ? "text-slate-700" : "text-slate-400"}`}>
                        {p.out_time ? formatTime(p.out_time) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <AlertTriangle className="h-10 w-10 mb-3 text-slate-300" />
                  <p className="text-center">Aucun pointage trouvé pour cette semaine.</p>
                </div>
              )}
            </div>

            {/* Pied */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 text-sm font-medium text-white bg-camublue-900 rounded-xl hover:bg-camublue-800 transition"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// AlertModal
// ─────────────────────────────────────────────
function AlertModal({
  open,
  onClose,
  employee,
  onConfirm,
  sending,
}: {
  open: boolean;
  onClose: () => void;
  employee: FlatRecord | null;
  onConfirm: (motif: MotifType) => void;
  sending: boolean;
}) {
  const [motif, setMotif] = useState<MotifType>("absent");

  useEffect(() => {
    if (employee) setMotif(employee.status === "absent" ? "absent" : "not_pointing");
  }, [employee]);

  return (
    <AnimatePresence>
      {open && employee && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => !sending && onClose()}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden z-10"
            initial={{ y: 40, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-800">Envoyer une alerte</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[230px]">
                  {employee.full_name}
                  {employee.matricule && <span className="font-mono ml-1.5 text-slate-300">· {employee.matricule}</span>}
                </div>
              </div>
              <button onClick={onClose} disabled={sending} className="p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-40">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${employee.email ? "bg-slate-50" : "bg-red-50 border border-red-100"}`}>
                <Mail className={`h-4 w-4 shrink-0 ${employee.email ? "text-slate-400" : "text-red-400"}`} />
                {employee.email
                  ? <span className="text-sm font-mono text-slate-700 truncate">{employee.email}</span>
                  : <span className="text-sm text-red-500 font-medium flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" /> Aucun email enregistré</span>
                }
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Motif de l'alerte</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMotif("absent")}
                    className={`flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${motif === "absent" ? "border-red-400 bg-red-50 text-red-700 shadow-sm" : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
                    <div className={`p-2 rounded-xl ${motif === "absent" ? "bg-red-100" : "bg-slate-100"}`}><UserMinus className="h-4 w-4" /></div>
                    Absence
                  </button>
                  <button onClick={() => setMotif("not_pointing")}
                    className={`flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${motif === "not_pointing" ? "border-amber-400 bg-amber-50 text-amber-700 shadow-sm" : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
                    <div className={`p-2 rounded-xl ${motif === "not_pointing" ? "bg-amber-100" : "bg-slate-100"}`}><AlertTriangle className="h-4 w-4" /></div>
                    Non pointage
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
                Un email de rappel sera envoyé à <strong>{employee.full_name}</strong>{" "}
                concernant son <strong>{motif === "absent" ? "absence" : "non-pointage"}</strong> du{" "}
                {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}.
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={onClose} disabled={sending}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">
                Annuler
              </button>
              <button onClick={() => onConfirm(motif)} disabled={sending || !employee.email}
                className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold transition flex items-center justify-center gap-2 ${!employee.email ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-camublue-900 hover:bg-camublue-800 text-white"} disabled:opacity-60`}>
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</> : <><Send className="h-4 w-4" /> Envoyer</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────
const PAGE_SIZE = 10;

export default function AttendancePage() {
  const [viewMode, setViewMode]     = useState<ViewMode>("daily");
  const [loading, setLoading]       = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<FlatRecord | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);

  const [date,  setDate]  = useState(isoToday());
  const [week,  setWeek]  = useState(isoWeekNow());
  const [month, setMonth] = useState(yyyyMmToday());

  const [daily,   setDaily]   = useState<DailyStatsResponse   | null>(null);
  const [weekly,  setWeekly]  = useState<WeeklyStatsResponse  | null>(null);
  const [monthly, setMonthly] = useState<MonthlyStatsResponse | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQ, setSearchQ]           = useState("");
  const [page, setPage]                 = useState(1);

  // Map matricule → email depuis la liste des employés
  const [emailMap, setEmailMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    getEmployees().then((list: Employee[]) => {
      const map = new Map<string, string>();
      list.forEach(emp => {
        if (emp.matricule && emp.email) {
          map.set(emp.matricule, emp.email);
        }
      });
      setEmailMap(map);
    }).catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "daily")   setDaily  (await getDailyStats(date));
      if (viewMode === "weekly")  setWeekly (await getWeeklyStats(week));
      if (viewMode === "monthly") setMonthly(await getMonthlyStats(month));
    } finally {
      setLoading(false);
    }
  }, [viewMode, date, week, month]);

  useEffect(() => { fetchData(); }, [viewMode]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQ, viewMode, daily, weekly, monthly]);

  const allRecords = useMemo((): FlatRecord[] => {
    const map = (r: any, daily: boolean): FlatRecord => {
      const matricule = r.matricule ?? "";
      return {
        employee_id          : r.employee_id,
        matricule            : matricule,
        full_name            : r.full_name ?? `${r.nom ?? ""} ${r.prenom ?? ""}`.trim(),
        department           : r.department ?? r.service ?? "—",
        status               : daily
          ? r.status
          : (r.absent_days > 0 ? "absent" : r.incomplete_days > 0 ? "incomplete" : "ok"),
        is_late_api          : r.is_late ?? ((r.late_days ?? 0) > 0),
        late_label_api       : r.late_label ?? (r.late_days > 0 ? `${r.late_days}j · moy ${r.avg_late_minutes}min` : null),
        late_minutes_api     : r.late_minutes ?? r.total_late_minutes ?? 0,
        computed_late_minutes: daily ? computeLateMinutes(r.in_time ?? null) : (r.total_late_minutes ?? 0),
        overtime_minutes     : daily ? computeOvertimeMinutes(r.out_time ?? null) : 0,
        compensation         : daily
          ? computeCompensation(
              computeLateMinutes(r.in_time ?? null),
              computeOvertimeMinutes(r.out_time ?? null)
            )
          : computeCompensation(r.total_late_minutes ?? 0, 0),
        deficit_minutes      : computeDeficitMinutes(r.worked_minutes ?? 0, r.expected_minutes ?? 0),
        in_time              : r.in_time ?? null,
        out_time             : r.out_time ?? null,
        delta_minutes        : r.delta_minutes ?? 0,
        worked_minutes       : r.worked_minutes ?? 0,
        expected_minutes     : r.expected_minutes ?? 0,
        email                : r.email ?? emailMap.get(matricule) ?? null,
      };
    };

    if (viewMode === "daily"   && daily)   return daily.records.map(r => map(r, true));
    if (viewMode === "weekly"  && weekly)  return weekly.by_employee.map((r:any) => map(r, false));
    if (viewMode === "monthly" && monthly) return monthly.by_employee.map((r:any) => map(r, false));
    return [];
  }, [viewMode, daily, weekly, monthly, emailMap]);

  const kpis = useMemo(() => {
    if (viewMode === "daily" && daily) {
      return {
        present     : daily.kpis.present,
        absent      : daily.kpis.absent,
        late        : allRecords.filter(r => r.computed_late_minutes > 0).length,
        anomaly     : daily.kpis.anomalies,
        not_pointing: daily.kpis.not_pointing,
      };
    }
    const emp = (viewMode === "weekly" ? weekly?.by_employee : monthly?.by_employee) as any[] | undefined;
    if (emp) {
      return {
        present     : emp.filter(r => r.present_days > 0).length,
        absent      : emp.filter(r => r.absent_days  > 0).length,
        late        : emp.filter(r => (r.late_days ?? 0) > 0).length,
        anomaly     : emp.filter(r => r.anomaly_days > 0).length,
        not_pointing: emp.filter(r => r.not_pointing_days > 0).length,
      };
    }
    return { present:0, absent:0, late:0, anomaly:0, not_pointing:0 };
  }, [viewMode, daily, weekly, monthly, allRecords]);

  const isLateRecord = useCallback((r: FlatRecord) =>
    viewMode === "daily" ? r.computed_late_minutes > 0 : r.is_late_api,
  [viewMode]);

  const filtered = useMemo(() => allRecords.filter(r => {
    if (statusFilter === "late")    { if (!isLateRecord(r)) return false; }
    else if (statusFilter === "deficit") { if (r.deficit_minutes <= 0) return false; }
    else if (statusFilter !== "all") { if (r.status !== statusFilter) return false; }
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return r.full_name.toLowerCase().includes(q)
        || r.matricule.toLowerCase().includes(q)
        || r.department.toLowerCase().includes(q);
  }), [allRecords, statusFilter, searchQ, isLateRecord]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const getPageNumbers = (): (number|"...")[] => {
    const pages: (number|"...")[] = [];
    if (totalPages <= 7) { for (let i=1;i<=totalPages;i++) pages.push(i); }
    else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i=Math.max(2,page-1);i<=Math.min(totalPages-1,page+1);i++) pages.push(i);
      if (page < totalPages-2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const filterCount = (key: StatusFilter) => {
    if (key === "all")     return allRecords.length;
    if (key === "late")    return allRecords.filter(isLateRecord).length;
    if (key === "deficit") return allRecords.filter(r => r.deficit_minutes > 0).length;
    return allRecords.filter(r => r.status === key).length;
  };

  const handleSendAlert = async (motif: MotifType) => {
    if (!selectedEmployee) return;
    setSendingAlert(true);
    const res = await sendAlertEmail(selectedEmployee, motif);
    setSendingAlert(false);
    if (res.success) {
      // Optionnel : afficher une notification de succès
      alert(`Alerte envoyée avec succès à ${selectedEmployee.email}`);
    } else {
      alert("Échec de l'envoi de l'alerte.");
    }
    setAlertModalOpen(false);
    setSelectedEmployee(null);
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }}
        transition={{ duration:0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-4 p-6"
      >
        {/* En-tête */}
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-camublue-900">Pointage Employés</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Seuil retard : arrivée après <strong>08h00</strong> — calculé sur l'heure d'entrée
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
                placeholder="Nom, matricule, département…"
                className="pl-9 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-camublue-900 text-sm px-3 py-2 w-56 focus:outline-none"
              />
            </div>
            <select value={viewMode} onChange={(e)=>setViewMode(e.target.value as ViewMode)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none">
              <option value="daily">Journalier</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuel</option>
            </select>
            <button onClick={()=>setFilterOpen(true)}
              className={`border px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
                statusFilter !== "all"
                  ? "bg-orange-50 border-orange-300 text-orange-700"
                  : "bg-white border-slate-300 hover:bg-slate-50"}`}>
              <Filter className="h-4 w-4" />
              Filtrer
              {statusFilter !== "all" && (
                <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold leading-none">1</span>
              )}
            </button>
            <button
              onClick={() => exportCSV("pointage", filtered.map(r => ({
                Matricule    : r.matricule,
                Nom          : r.full_name,
                Département  : r.department,
                Statut       : r.status,
                Retard       : r.computed_late_minutes > 0
                  ? `RETARD · ${formatMinutes(r.computed_late_minutes)}`
                  : "Non",
                Entrée       : formatTime(r.in_time),
                Sortie       : formatTime(r.out_time),
                "HS >17h30"  : r.overtime_minutes > 0 ? `+${formatMinutes(r.overtime_minutes)}` : "—",
                Compensation : viewMode === "daily"
                  ? (r.compensation.late_min > 0
                      ? (r.compensation.is_compensated ? "Compensé" : `Non compensé · reste ${formatMinutes(r.compensation.remaining_min)}`)
                      : "—")
                  : "—",
                "Heures moins"   : r.deficit_minutes > 0 ? `−${formatMinutes(r.deficit_minutes)}` : "—",
                Email           : r.email ?? "Manquant",
              })))}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Exporter
            </button>
            <button onClick={fetchData}
              className="bg-camublue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-camublue-800 transition">
              <RefreshCw className="h-4 w-4" /> Rafraîchir
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
          <StatCard icon={Users}           label="Présents"          value={kpis.present}      color="green"  delay={0.05} loading={loading} />
          <StatCard icon={UserMinus}       label="Absents"           value={kpis.absent}       color="red"    delay={0.10} loading={loading} />
          <StatCard
            icon={Clock}
            label="Retards > 08h"
            value={kpis.late}
            color="orange"
            delay={0.15}
            loading={loading}
            active={statusFilter === "late"}
            sub="Cliquer pour filtrer"
            onClick={() => setStatusFilter(f => f === "late" ? "all" : "late")}
          />
          <StatCard icon={AlertTriangle}   label="Anomalies"         value={kpis.anomaly}      color="violet" delay={0.20} loading={loading} />
          <StatCard icon={FileSpreadsheet} label="Non pointés"       value={kpis.not_pointing} color="slate"  delay={0.25} loading={loading} />
        </div>

        {/* Barre de filtres rapides */}
        <div className="shrink-0">
          <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
            {QUICK_FILTERS.map((f) => {
              const isActive = statusFilter === f.key;
              const count    = filterCount(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setPage(1); }}
                  className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
                    isActive ? f.activeDot : f.dotColor
                  }`} />
                  {f.label}
                  <span className={`text-xs tabular-nums font-bold transition-colors ${
                    isActive ? "text-slate-400" : "text-slate-400/70"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
            {statusFilter !== "all" && (
              <>
                <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />
                <button
                  onClick={() => setStatusFilter("all")}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all shrink-0"
                  title="Effacer le filtre"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tableau */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm min-h-0">
            <table className="min-w-full bg-white">
              <thead className="bg-camublue-900 text-white sticky top-0 z-10">
                <tr>
                  {[
                    "Matricule", "Nom", "Département", "Statut", "Retard (> 08h00)",
                    "Entrée", "Sortie", "HS (>17h30)", "Compensation", "Heures moins", "Actions"
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left border-b border-camublue-800 text-sm font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_,i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {[...Array(11)].map((_,j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pageData.length ? pageData.map((r) => {
                  const late   = isLateRecord(r);
                  const deficit = r.deficit_minutes > 0;
                  return (
                    <tr key={r.employee_id}
                      className={`border-b border-slate-100 transition-colors text-sm ${
                        late    ? "bg-orange-50/50 hover:bg-orange-50" :
                        deficit ? "bg-rose-50/30 hover:bg-rose-50/60"  :
                                  "hover:bg-slate-50"}`}>
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">{r.matricule || "—"}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{r.department}</td>
                      <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                      <td className="px-4 py-3">
                        {viewMode === "daily" ? (
                          <LateBadge minutes={r.computed_late_minutes} />
                        ) : r.is_late_api && r.late_label_api ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 ring-1 ring-orange-300">
                            <Clock className="h-3 w-3" />{r.late_label_api}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 tabular-nums font-mono ${r.computed_late_minutes > 0 ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                        {formatTime(r.in_time)}
                      </td>
                      <td className={`px-4 py-3 tabular-nums font-mono ${r.overtime_minutes > 0 ? "text-emerald-600 font-semibold" : "text-slate-700"}`}>
                        {formatTime(r.out_time)}
                      </td>
                      <td className="px-4 py-3">
                        <OvertimeBadge minutes={r.overtime_minutes} />
                      </td>
                      <td className="px-4 py-3">
                        <CompensationCell c={r.compensation} viewMode={viewMode} />
                      </td>
                      <td className="px-4 py-3">
                        <DeficitBadge minutes={r.deficit_minutes} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (r.status === "absent") {
                                setSelectedEmployee(r);
                                setAlertModalOpen(true);
                              }
                            }}
                            disabled={r.status !== "absent" || !r.email}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              r.status === "absent" && r.email
                                ? "bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                            title={!r.email ? "Email manquant" : ""}
                          >
                            <Bell className="h-3 w-3" />
                            Alerter
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEmployeeId(r.employee_id);
                              setDetailModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition"
                          >
                            Détail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400 text-sm">
                      {statusFilter === "late"    ? "✅ Aucun retard après 08h00."      :
                       statusFilter === "deficit" ? "✅ Aucune heure manquante."        :
                                                    "Aucun enregistrement trouvé."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-1 shrink-0">
              <span className="text-sm text-slate-500">
                {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} sur{" "}
                <strong className="text-slate-700">{filtered.length}</strong> employés
                {statusFilter === "late"    && <span className="ml-2 text-orange-600 font-semibold">· Retards après 08h</span>}
                {statusFilter === "deficit" && <span className="ml-2 text-rose-600 font-semibold">· Heures manquantes</span>}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={()=>setPage(1)} disabled={page===1}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <FaAngleDoubleLeft size={12} />
                </button>
                <button onClick={()=>setPage(p=>Math.max(p-1,1))} disabled={page===1}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1 mx-1">
                  {getPageNumbers().map((p,i) =>
                    p === "..." ? (
                      <span key={`e-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                    ) : (
                      <button key={p} onClick={()=>setPage(p as number)}
                        className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors ${
                          page===p ? "bg-camublue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
                        {p}
                      </button>
                    )
                  )}
                </div>
                <button onClick={()=>setPage(p=>Math.min(p+1,totalPages))} disabled={page===totalPages}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={()=>setPage(totalPages)} disabled={page===totalPages}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <FaAngleDoubleRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <FilterModal
          open={filterOpen} onClose={()=>setFilterOpen(false)}
          viewMode={viewMode}   setViewMode={setViewMode}
          date={date}           setDate={setDate}
          week={week}           setWeek={setWeek}
          month={month}         setMonth={setMonth}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          onApply={fetchData}
        />

        <DetailModal
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          employeeId={selectedEmployeeId}
          initialWeek={week}
        />

        <AlertModal
          open={alertModalOpen}
          onClose={() => setAlertModalOpen(false)}
          employee={selectedEmployee}
          onConfirm={handleSendAlert}
          sending={sendingAlert}
        />
      </motion.div>
    </AppLayout>
  );
}
