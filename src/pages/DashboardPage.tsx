import { useEffect, useState, useCallback, useRef } from "react";
import AppLayout from "@/layouts/AppLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, FileText, Clock, TrendingUp,
  UserCheck, UserX, AlertTriangle, CheckCircle,
  RefreshCw, Calendar, Award,
  ArrowUp, ArrowDown, Minus, LogIn, LogOut, Star,
  ChevronDown, Download, X,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from "recharts";
import type {
  DailyStatsResponse, WeeklyStatsResponse, MonthlyStatsResponse, DailyRecord,
} from "@/types/attendance";
import type { Employee, ContractType } from "@/types/employee";
import type { BulletinMonthSummary } from "@/services/employeeService";
import {
  getEmployees, getEmployeesByContractType, fetchBulletinsSummary,
} from "@/services/employeeService";
import {
  getDailyStats, getWeeklyStats, getMonthlyStats,
} from "@/services/attendanceService";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);

const fmtMinutes = (min: number) => {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

const MONTH_NAMES = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MONTH_FULL  = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const PIE_COLORS  = ["#1e3a5f", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];

const todayStr = () => new Date().toISOString().split("T")[0];

const isoWeekFromDate = (d: Date) => {
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const yearMonthStr        = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const firstDayOfYearMonth = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;

// ─── Types ───────────────────────────────────────────────────────────────────
type EmpFilter  = ContractType | "ALL";
type SectionKey = "employees" | "pointages" | "bulletins" | "conges";
interface MonthYear { month: number; year: number }

// ─── Helpers Top Présents ────────────────────────────────────────────────────
const ARRIVAL_CUTOFF  = 8 * 60;
const DEPARTURE_FLOOR = 17 * 60 + 30;

const timeToMinutes = (t?: string | null): number => {
  if (!t) return -1;
  const parts = t.split(":").map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return -1;
  return parts[0] * 60 + parts[1];
};

const fmtTime = (t?: string | null): string => {
  if (!t) return "—";
  const parts = t.split(":");
  return `${parseInt(parts[0], 10)}h${parts[1]}`;
};

const presenceScore = (inTime?: string | null, outTime?: string | null): number => {
  const arrMin = timeToMinutes(inTime);
  const depMin = timeToMinutes(outTime);
  if (arrMin < 0 || depMin < 0) return 0;
  const arrScore = Math.max(0, Math.min(50, ((9 * 60) - arrMin) / 60 * 25));
  const depScore = Math.max(0, Math.min(50, (depMin - 17 * 60) / 60 * 25));
  return Math.round(arrScore + depScore);
};

const computeTopPresents = (records: DailyRecord[]): DailyRecord[] =>
  records
    .filter((r) => {
      if (r.status !== "ok") return false;
      const arrMin = timeToMinutes(r.in_time);
      const depMin = timeToMinutes(r.out_time);
      if (arrMin < 0 || depMin < 0) return false;
      return arrMin <= ARRIVAL_CUTOFF && depMin >= DEPARTURE_FLOOR;
    })
    .sort((a, b) => {
      const scoreDiff = presenceScore(b.in_time, b.out_time) - presenceScore(a.in_time, a.out_time);
      if (scoreDiff !== 0) return scoreDiff;
      return b.worked_minutes - a.worked_minutes;
    })
    .slice(0, 10);

// ─── Section Tabs ─────────────────────────────────────────────────────────────
const SECTION_TABS: { key: SectionKey; label: string; shortLabel: string; icon: any }[] = [
  { key: "employees", label: "Employés",            shortLabel: "Emp.",   icon: Users    },
  { key: "pointages", label: "Pointages",            shortLabel: "Point.", icon: Clock    },
  { key: "bulletins", label: "Bulletins de salaire", shortLabel: "Bull.",  icon: FileText },
  { key: "conges",    label: "Congés",               shortLabel: "Congés", icon: Calendar },
];

function SectionTabs({
  active, onChange,
}: {
  active: SectionKey;
  onChange: (s: SectionKey) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto">
      {SECTION_TABS.map(({ key, label, shortLabel, icon: Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
              ${isActive
                ? "bg-camublue-900 text-white shadow-sm"
                : "text-slate-500 hover:text-camublue-900 hover:bg-slate-100"
              }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Month Picker ─────────────────────────────────────────────────────────────
function MonthPicker({ value, onChange }: { value: MonthYear; onChange: (m: MonthYear) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();
  const months: MonthYear[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
      >
        <Calendar className="h-4 w-4 text-camublue-900" />
        <span className="hidden sm:inline">{MONTH_FULL[value.month]}</span>
        <span className="sm:hidden">{MONTH_NAMES[value.month]}</span>
        <span>{value.year}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 max-h-72 overflow-y-auto"
          >
            {months.map((m) => {
              const active = m.month === value.month && m.year === value.year;
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  onClick={() => { onChange(m); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors
                    ${active ? "bg-camublue-900 text-white font-semibold" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  <span>{MONTH_FULL[m.month]}</span>
                  <span className={active ? "text-blue-200" : "text-slate-400"}>{m.year}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Date Range Picker ────────────────────────────────────────────────────────
function DateRangePicker({
  draft, onDraftChange, onApply,
}: {
  draft: { start: string; end: string };
  onDraftChange: (v: { start: string; end: string }) => void;
  onApply: () => void;
}) {
  const maxDate = new Date().toISOString().split("T")[0];
  return (
    <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
      <input
        type="date"
        value={draft.start}
        max={draft.end}
        onChange={(e) => onDraftChange({ ...draft, start: e.target.value })}
        className="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer w-32"
      />
      <span className="text-slate-400 text-xs font-medium">→</span>
      <input
        type="date"
        value={draft.end}
        min={draft.start}
        max={maxDate}
        onChange={(e) => onDraftChange({ ...draft, end: e.target.value })}
        className="text-sm font-medium text-slate-700 bg-transparent outline-none cursor-pointer w-32"
      />
      <button
        onClick={onApply}
        className="ml-1 px-3 py-1 rounded-lg bg-camublue-900 text-white text-xs font-semibold hover:bg-camublue-800 transition shadow-sm whitespace-nowrap"
      >
        Appliquer
      </button>
    </div>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────
type ExportSection = "employes" | "pointages_jour" | "pointages_semaine" | "pointages_mois" | "bulletins";

function ExportModal({
  open, onClose, rangeLabel,
  employees, daily, weekly, monthly, bulletins,
}: {
  open: boolean; onClose: () => void; rangeLabel: string;
  employees: Employee[];
  daily: DailyStatsResponse | null;
  weekly: WeeklyStatsResponse | null;
  monthly: MonthlyStatsResponse | null;
  bulletins: BulletinMonthSummary[];
}) {
  const [selected, setSelected] = useState<Set<ExportSection>>(
    new Set(["employes", "pointages_jour", "pointages_semaine", "pointages_mois", "bulletins"])
  );

  const toggleSection = (s: ExportSection) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    if (selected.has("employes")) {
      const rows = employees.map((e) => ({
        Matricule:       e.matricule ?? "",
        "Nom complet":   `${e.prenom ?? ""} ${e.nom ?? ""}`.trim(),
        Statut:          e.status ?? "",
        "Type contrat":  e.type_contrat ?? "",
        Département:     (e as any).departement ?? (e as any).service ?? "",
        Genre:           e.sexe === "H" ? "Homme" : e.sexe === "F" ? "Femme" : "",
        "Date embauche": e.date_embauche ?? "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Employés");
    }

    if (selected.has("pointages_jour") && daily) {
      const rows = (daily.records ?? []).map((r) => ({
        "Nom complet":  r.full_name,
        Département:    r.department ?? "",
        Date:           r.work_date,
        Statut:         r.status,
        Entrée:         r.in_time ?? "",
        Sortie:         r.out_time ?? "",
        "Min travaillés":  r.worked_minutes,
        "Min attendus":    r.expected_minutes,
        "Retard (min)":    r.late_minutes,
        "En retard":       r.is_late ? "Oui" : "Non",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Pointages Jour");
    }

    if (selected.has("pointages_semaine") && weekly) {
      const rows = (weekly.by_day ?? []).map((d) => ({
        Date:           d.date,
        Jour:           d.weekday_label,
        Présents:       d.ok_count,
        Absents:        d.absent_count,
        Incomplets:     d.incomplete_count,
        "En retard":    d.late_count,
        "Min travaillés": d.worked_minutes,
        "Min attendus":   d.expected_minutes,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Pointages Semaine");
    }

    if (selected.has("pointages_mois") && monthly) {
      const rows = (monthly.by_week ?? []).map((w) => ({
        Semaine:          w.week,
        "Min travaillés": w.worked_minutes,
        "Min attendus":   w.expected_minutes,
        "H travaillées":  Math.round(w.worked_minutes / 60),
        "H attendues":    Math.round(w.expected_minutes / 60),
        "Nb retards":     w.late_count,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Pointages Mois");
    }

    if (selected.has("bulletins") && bulletins.length > 0) {
      const rows = bulletins.map((b) => ({
        Année:     b.year,
        Mois:      MONTH_FULL[b.month],
        Générés:   b.total,
        Envoyés:   b.sent,
        "Non envoyés": Math.max(0, (b.total ?? 0) - (b.sent ?? 0)),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Bulletins");
    }

    if (wb.SheetNames.length === 0) return;
    XLSX.writeFile(wb, `dashboard_rh_${rangeLabel.replace(/\//g, "-").replace(/ /g, "_")}.xlsx`);
    onClose();
  };

  const SECTIONS: { key: ExportSection; label: string; available: boolean }[] = [
    { key: "employes",          label: "Employés",                available: employees.length > 0   },
    { key: "pointages_jour",    label: "Pointages du jour",       available: !!daily                },
    { key: "pointages_semaine", label: "Présence — Semaine",      available: !!weekly               },
    { key: "pointages_mois",    label: "Heures — Mois (par sem.)", available: !!monthly             },
    { key: "bulletins",         label: "Bulletins de salaire",    available: bulletins.length > 0   },
  ];

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Exporter les données</h3>
            <p className="text-xs text-slate-400 mt-0.5">Période : {rangeLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3 font-medium">Sélectionnez les données à inclure :</p>
        <div className="space-y-2">
          {SECTIONS.map(({ key, label, available }) => (
            <label
              key={key}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all
                ${!available ? "opacity-40 cursor-not-allowed" : ""}
                ${selected.has(key) && available
                  ? "border-camublue-900 bg-camublue-900/5"
                  : "border-slate-100 hover:border-slate-200 bg-slate-50"
                }`}
            >
              <input
                type="checkbox"
                checked={selected.has(key) && available}
                disabled={!available}
                onChange={() => available && toggleSection(key)}
                className="accent-camublue-900 w-4 h-4 shrink-0"
              />
              <span className="text-xs font-medium text-slate-700">{label}</span>
              {!available && <span className="ml-auto text-[10px] text-slate-400">Aucune donnée</span>}
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0}
            className="flex-1 py-2 rounded-xl bg-camublue-900 text-white text-xs font-semibold hover:bg-camublue-800 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter XLSX
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Employee filter ──────────────────────────────────────────────────────────
function EmpFilterToggle({ filter, onChange }: { filter: EmpFilter; onChange: (f: EmpFilter) => void }) {
  const opts = [
    { value: "ALL",     label: "Tous"    },
    { value: "CDI",     label: "CDI"     },
    { value: "CDD",     label: "CDD"     },
    { value: "STAGE",   label: "Stage"   },
    { value: "INTERIM", label: "Intérim" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {opts.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value as EmpFilter)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all
            ${filter === opt.value
              ? "bg-camublue-900 text-white border-camublue-900 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:border-camublue-900 hover:text-camublue-900"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  icon: Icon, label, value, sub, delta, deltaLabel,
  color = "blue", delay = 0, loading = false,
}: {
  icon: any; label: string; value: string | number; sub?: string;
  delta?: number; deltaLabel?: string;
  color?: "blue" | "green" | "amber" | "red" | "purple" | "slate";
  delay?: number; loading?: boolean;
}) {
  const palette = {
    blue:   { bg: "bg-camublue-900/10", icon: "text-camublue-900", val: "text-camublue-900" },
    green:  { bg: "bg-emerald-50",      icon: "text-emerald-600",  val: "text-emerald-700"  },
    amber:  { bg: "bg-amber-50",        icon: "text-amber-500",    val: "text-amber-700"    },
    red:    { bg: "bg-red-50",          icon: "text-red-500",      val: "text-red-700"      },
    purple: { bg: "bg-purple-50",       icon: "text-purple-600",   val: "text-purple-700"   },
    slate:  { bg: "bg-slate-100",       icon: "text-slate-500",    val: "text-slate-700"    },
  };
  const c = palette[color];
  const isUp   = delta !== undefined && delta > 0;
  const isDown = delta !== undefined && delta < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${c.bg}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
        {delta !== undefined && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-lg
            ${isUp ? "bg-emerald-50 text-emerald-700" : isDown ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
            {isUp ? <ArrowUp className="h-2.5 w-2.5" /> : isDown ? <ArrowDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
            {deltaLabel ?? Math.abs(delta)}
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-16 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-3.5 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <div className={`text-2xl font-bold ${c.val} leading-none mb-1`}>{value}</div>
          <div className="text-xs font-semibold text-slate-600 leading-snug">{label}</div>
          {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
        </>
      )}
    </motion.div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, delay = 0, action }: {
  title: string; icon: any; children: React.ReactNode; delay?: number; action?: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }} className="space-y-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-camublue-900 flex items-center justify-center shadow-sm shrink-0">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </motion.section>
  );
}

// ─── Chart card ───────────────────────────────────────────────────────────────
function ChartCard({ title, sub, children, loading, minH = 220 }: {
  title: string; sub?: string; children: React.ReactNode; loading?: boolean; minH?: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm h-full">
      <div className="mb-3">
        <p className="text-sm font-bold text-slate-700">{title}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {loading
        ? <div className="animate-pulse bg-slate-100 rounded-xl" style={{ height: minH }} />
        : <div style={{ minHeight: minH }}>{children}</div>
      }
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 mt-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-700">{fmt(p.value)}{p.unit ?? ""}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = "#1e3a5f", label, valueLabel }: {
  value: number; max: number; color?: string; label: string; valueLabel: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="font-bold text-slate-700">{valueLabel}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ delay: 0.4, duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full" style={{ background: color }}
        />
      </div>
    </div>
  );
}

// ─── Skeleton grid ────────────────────────────────────────────────────────────
function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 h-24 animate-pulse">
          <div className="w-8 h-8 rounded-xl bg-slate-100 mb-3" />
          <div className="w-16 h-5 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Top Absents list ─────────────────────────────────────────────────────────
function TopAbsentList({ items }: {
  items: { full_name: string; department?: string | null; count: number }[];
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
        <CheckCircle className="h-8 w-8 text-emerald-200" />
        <p className="text-xs text-slate-400">Aucune absence cette semaine 🎉</p>
      </div>
    );
  }
  const maxCount = items[0]?.count ?? 1;
  return (
    <div className="space-y-0.5 mt-1">
      {items.map((row, i) => {
        const pct      = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
        const isTop3   = i < 3;
        const rankCls  = isTop3 ? "bg-red-100 text-red-700"  : "bg-slate-100 text-slate-500";
        const badgeCls = isTop3 ? "bg-red-50 text-red-600"   : "bg-slate-100 text-slate-600";
        const barColor = isTop3 ? "#ef4444"                  : "#fca5a5";
        return (
          <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-slate-50 last:border-0">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${rankCls}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <p className="text-xs font-semibold text-slate-700 truncate">{row.full_name}</p>
                <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-lg ${badgeCls}`}>
                  {row.count}j
                </span>
              </div>
              {row.department && (
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-slate-400 truncate w-16 shrink-0">{row.department}</p>
                  <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Top Présents list ────────────────────────────────────────────────────────
function TopPresentList({ records }: { records: DailyRecord[] }) {
  const MEDALS    = ["🥇", "🥈", "🥉"];
  const qualified = computeTopPresents(records);
  const scoreMax  = 100;

  if (qualified.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
          <Award className="h-6 w-6 text-amber-300" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600">Aucun résultat aujourd'hui</p>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            Critères : arrivée{" "}
            <span className="font-bold text-blue-500">≤ 08h00</span>
            {" "}et départ{" "}
            <span className="font-bold text-violet-500">≥ 17h30</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 mt-1">
      {qualified.map((row, i) => {
        const isTop3  = i < 3;
        const score   = presenceScore(row.in_time, row.out_time);
        const arrMin  = timeToMinutes(row.in_time);
        const depMin  = timeToMinutes(row.out_time);
        const earlyIn = arrMin >= 0 && arrMin <= ARRIVAL_CUTOFF;
        const lateOut = depMin >= 0 && depMin >= DEPARTURE_FLOOR;

        return (
          <motion.div
            key={row.employee_id}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.045, duration: 0.25 }}
            className={`rounded-xl p-2 border transition-all
              ${isTop3
                ? "bg-gradient-to-r from-emerald-50/80 to-white border-emerald-100"
                : "bg-white border-slate-50 hover:border-slate-100"
              }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                ${isTop3 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {i < 3 ? MEDALS[i] : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{row.full_name}</p>
                  <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-lg
                    ${isTop3 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {fmtMinutes(row.worked_minutes)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {row.department && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[56px]">{row.department}</span>
                  )}
                  <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                    ${earlyIn ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"}`}>
                    <LogIn className="h-2.5 w-2.5" />{fmtTime(row.in_time)}
                  </span>
                  <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                    ${lateOut ? "bg-violet-50 text-violet-600" : "bg-slate-50 text-slate-400"}`}>
                    <LogOut className="h-2.5 w-2.5" />{fmtTime(row.out_time)}
                  </span>
                  {isTop3 && (
                    <span className="ml-auto flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{score}pts
                    </span>
                  )}
                </div>
                <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (score / scoreMax) * 100)}%` }}
                    transition={{ delay: 0.3 + i * 0.045, duration: 0.6, ease: "easeOut" }}
                    className={`h-full rounded-full ${isTop3 ? "bg-emerald-400" : "bg-slate-300"}`}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-3 justify-center">
        {[
          { icon: <LogIn  className="h-2.5 w-2.5 text-blue-500"                 />, label: "Arrivée ≤ 08h00"   },
          { icon: <LogOut className="h-2.5 w-2.5 text-violet-500"               />, label: "Départ ≥ 17h30"    },
          { icon: <Star   className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />, label: "Score ponctualité" },
        ].map((leg) => (
          <div key={leg.label} className="flex items-center gap-1 text-[9px] text-slate-400">
            {leg.icon}<span>{leg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section Congés (placeholder) ────────────────────────────────────────────
function CongesSection({ monthLabel }: { monthLabel: string }) {
  return (
    <Section title="Congés" icon={Calendar} delay={0.05}
      action={<span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">{monthLabel}</span>}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Calendar}    label="Demandes"   value="—" sub="Ce mois"    color="blue"  delay={0.08} />
        <KPICard icon={CheckCircle} label="Approuvés"  value="—" sub="Ce mois"    color="green" delay={0.12} />
        <KPICard icon={Clock}       label="En attente" value="—" sub="À traiter"  color="amber" delay={0.16} />
        <KPICard icon={UserX}       label="Refusés"    value="—" sub="Ce mois"    color="red"   delay={0.20} />
      </div>
      <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm py-20 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Calendar className="h-7 w-7 text-camublue-900 opacity-30" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-600">Module Congés</p>
          <p className="text-xs text-slate-400 mt-1">La gestion des congés sera disponible prochainement.</p>
        </div>
      </div>
    </Section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const now = new Date();
  const defaultStart = firstDayOfYearMonth(now.getFullYear(), now.getMonth() + 1);
  const defaultEnd   = todayStr();

  const [activeSection,  setActiveSection]  = useState<SectionKey>("employees");
  const [empFilter,      setEmpFilter]      = useState<EmpFilter>("ALL");
  const [selectedMonth,  setSelectedMonth]  = useState<MonthYear>({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [dateStart,      setDateStart]      = useState(defaultStart);
  const [dateEnd,        setDateEnd]        = useState(defaultEnd);
  const [draft,          setDraft]          = useState({ start: defaultStart, end: defaultEnd });
  const [refreshing,     setRefreshing]     = useState(false);
  const [showExport,     setShowExport]     = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [daily,     setDaily]     = useState<DailyStatsResponse | null>(null);
  const [weekly,    setWeekly]    = useState<WeeklyStatsResponse | null>(null);
  const [monthly,   setMonthly]   = useState<MonthlyStatsResponse | null>(null);
  const [bulletins, setBulletins] = useState<BulletinMonthSummary[]>([]);

  const [loadEmp,      setLoadEmp]      = useState(true);
  const [loadDaily,    setLoadDaily]    = useState(true);
  const [loadWeekly,   setLoadWeekly]   = useState(true);
  const [loadMonthly,  setLoadMonthly]  = useState(true);
  const [loadBulletin, setLoadBulletin] = useState(true);

  const fetchEmployees = useCallback(async (filter: EmpFilter) => {
    setLoadEmp(true);
    try {
      const data = filter === "ALL"
        ? await getEmployees({ status: "ALL" })
        : await getEmployeesByContractType(filter as ContractType, "ALL");
      setEmployees(data);
    } catch (e) { console.error(e); }
    finally { setLoadEmp(false); }
  }, []);

  const fetchAttendance = useCallback(async (start: string, end: string) => {
    const weekStr = isoWeekFromDate(new Date(start));
    const ymStr   = start.slice(0, 7);

    setLoadDaily(true); setLoadWeekly(true); setLoadMonthly(true); setLoadBulletin(true);
    await Promise.allSettled([
      getDailyStats(start)    .then(setDaily)    .finally(() => setLoadDaily(false)),
      getWeeklyStats(weekStr) .then(setWeekly)   .finally(() => setLoadWeekly(false)),
      getMonthlyStats(ymStr)  .then(setMonthly)  .finally(() => setLoadMonthly(false)),
      fetchBulletinsSummary({ start, end })
        .then(setBulletins).finally(() => setLoadBulletin(false)),
    ]);
  }, []);

  useEffect(() => { fetchEmployees(empFilter); fetchAttendance(dateStart, dateEnd); }, []);
  useEffect(() => { fetchAttendance(dateStart, dateEnd); }, [dateStart, dateEnd]);
  useEffect(() => { fetchEmployees(empFilter); }, [empFilter]);

  const handleMonthChange = (m: MonthYear) => {
    setSelectedMonth(m);
    const firstDay = firstDayOfYearMonth(m.year, m.month);
    const lastDay  = `${m.year}-${String(m.month).padStart(2, "0")}-${new Date(m.year, m.month, 0).getDate()}`;
    const isCurrent = m.month === now.getMonth() + 1 && m.year === now.getFullYear();
    const end = isCurrent ? todayStr() : lastDay;
    setDraft({ start: firstDay, end });
    setDateStart(firstDay);
    setDateEnd(end);
  };

  const handleApplyRange = () => {
    if (draft.start && draft.end) {
      setDateStart(draft.start);
      setDateEnd(draft.end);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([fetchEmployees(empFilter), fetchAttendance(dateStart, dateEnd)]);
    setRefreshing(false);
  };

  // ── Derived: Employees ──────────────────────────────────────────────────────
  const total    = employees.length;
  const actifs   = employees.filter((e) => e.status === "ACTIVE").length;
  const sortis   = employees.filter((e) => e.status === "EXITED").length;
  const hommes   = employees.filter((e) => e.status === "ACTIVE" && e.sexe === "H").length;
  const femmes   = employees.filter((e) => e.status === "ACTIVE" && e.sexe === "F").length;
  const nouveaux = employees.filter(
    (e) => e.status === "ACTIVE" &&
      (e.date_embauche ?? "") >= dateStart &&
      (e.date_embauche ?? "") <= dateEnd
  ).length;

  const contratMap: Record<string, number> = {};
  employees.filter((e) => e.status === "ACTIVE").forEach((e) => {
    const k = e.type_contrat ?? "Autre"; contratMap[k] = (contratMap[k] ?? 0) + 1;
  });
  const contratData = Object.entries(contratMap).map(([name, value]) => ({ name, value }));

  const projetMap: Record<string, number> = {};
  employees.filter((e) => e.status === "ACTIVE").forEach((e) => {
    const k = e.projet || "Non assigné"; projetMap[k] = (projetMap[k] ?? 0) + 1;
  });
  const projetData = Object.entries(projetMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  const sexeData = [
    { name: "Hommes", value: hommes },
    { name: "Femmes", value: femmes },
  ].filter((d) => d.value > 0);

  // ── Derived: Daily ──────────────────────────────────────────────────────────
  const kpis          = daily?.kpis;
  const present       = kpis?.present    ?? 0;
  const absent        = kpis?.absent     ?? 0;
  const incomplete    = kpis?.incomplete ?? 0;
  const late          = kpis?.late       ?? 0;
  const totalPointing = present + absent + incomplete;
  const tauxPresence  = totalPointing > 0 ? Math.round((present / totalPointing) * 100) : 0;

  const attendanceDonut = [
    { name: "Présents",   value: present,    fill: "#22c55e" },
    { name: "Absents",    value: absent,     fill: "#ef4444" },
    { name: "Incomplets", value: incomplete, fill: "#f59e0b" },
    { name: "En retard",  value: late,       fill: "#8b5cf6" },
  ].filter((d) => d.value > 0);

  const dailyRecords = daily?.records ?? [];

  // ── Derived: Weekly ─────────────────────────────────────────────────────────
  const heuresTrav  = weekly ? Math.round(weekly.worked_minutes / 60) : 0;
  const heuresAtt   = weekly ? Math.round(weekly.expected_minutes / 60) : 0;
  const deltaMin    = weekly?.delta_minutes ?? 0;
  const semaineData = (weekly?.by_day ?? []).map((d) => ({
    jour:    d.weekday_label?.slice(0, 3) ?? d.date.slice(5),
    present: d.ok_count     ?? 0,
    absent:  d.absent_count ?? 0,
    retard:  d.late_count   ?? 0,
  }));

  const topAbsents = (weekly?.top_absent ?? []).slice(0, 10).map((e) => ({
    full_name:  e.full_name,
    department: e.department,
    count:      e.count ?? 0,
  }));

  // ── Derived: Monthly ────────────────────────────────────────────────────────
  const heuresMens = (monthly?.by_week ?? []).map((w) => ({
    sem:         `S${w.week.split("W")[1] ?? ""}`,
    travaillees: Math.round(w.worked_minutes / 60),
    attendues:   Math.round(w.expected_minutes / 60),
  }));

  // ── Derived: Bulletins ──────────────────────────────────────────────────────
  const totalBulletins = bulletins.reduce((s, b) => s + (b.total ?? 0), 0);
  const totalEnvoyes   = bulletins.reduce((s, b) => s + (b.sent  ?? 0), 0);
  const tauxEnvoi      = actifs > 0 ? Math.round((totalEnvoyes / actifs) * 100) : 0;
  const bulletinsChart = [...bulletins]
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .map((b) => ({ mois: MONTH_NAMES[b.month], envoyes: b.sent, total: b.total }));

  const fmtDateFr = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };
  const rangeLabel = dateStart === dateEnd
    ? fmtDateFr(dateStart)
    : `${fmtDateFr(dateStart)} – ${fmtDateFr(dateEnd)}`;
  const monthLabel = rangeLabel;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">

        {/* ── Top bar ── */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-4 md:px-6 py-3 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-camublue-900 leading-tight">Tableau de bord RH</h1>
              <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">Vue d'ensemble · {monthLabel}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <MonthPicker value={selectedMonth} onChange={handleMonthChange} />
              <DateRangePicker
                draft={draft}
                onDraftChange={setDraft}
                onApply={handleApplyRange}
              />
              <button
                onClick={() => setShowExport(true)}
                className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm"
              >
                <Download className="h-3.5 w-3.5 text-camublue-900" />
                <span className="hidden sm:inline">Exporter</span>
              </button>
              <button
                onClick={handleRefresh} disabled={refreshing}
                className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            </div>
          </div>
          {/* Navigation par onglets */}
          <SectionTabs active={activeSection} onChange={setActiveSection} />
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 md:px-6 py-5 pb-12">
            <AnimatePresence mode="wait">

              {/* ════ EMPLOYÉS ════ */}
              {activeSection === "employees" && (
                <motion.div key="employees"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }} className="space-y-10"
                >
                  <Section title="Employés" icon={Users} delay={0.05}
                    action={<EmpFilterToggle filter={empFilter} onChange={setEmpFilter} />}
                  >
                    {loadEmp ? <SkeletonGrid count={4} /> : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <KPICard icon={Users}      label="Effectif total" value={fmt(total)}    sub="Tous statuts"                              color="blue"  delay={0.08} />
                        <KPICard icon={UserCheck}  label="Actifs"         value={fmt(actifs)}   delta={nouveaux} deltaLabel={`+${nouveaux} ce mois`} color="green" delay={0.12} />
                        <KPICard icon={UserX}      label="Sortis"         value={fmt(sortis)}   sub="Total cumulé"                             color="red"   delay={0.16} />
                        <KPICard icon={TrendingUp} label="Recrutements"   value={fmt(nouveaux)} sub={monthLabel}                               color="amber" delay={0.20} />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <ChartCard title="Types de contrats" sub="Employés actifs" loading={loadEmp} minH={200}>
                        {contratData.length === 0
                          ? <p className="text-xs text-slate-400 text-center pt-16">Aucune donnée</p>
                          : (
                            <ResponsiveContainer width="100%" height={200}>
                              <PieChart>
                                <Pie data={contratData} dataKey="value" nameKey="name" outerRadius={70} innerRadius={42} paddingAngle={3}>
                                  {contratData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                              </PieChart>
                            </ResponsiveContainer>
                          )
                        }
                      </ChartCard>

                      <ChartCard title="Répartition par genre" sub="Employés actifs" loading={loadEmp} minH={200}>
                        {sexeData.length === 0
                          ? <p className="text-xs text-slate-400 text-center pt-16">Aucune donnée genre</p>
                          : (
                            <>
                              <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                  <Pie data={sexeData} dataKey="value" nameKey="name" outerRadius={65} innerRadius={40} paddingAngle={3}>
                                    <Cell fill="#2563eb" />
                                    <Cell fill="#ec4899" />
                                  </Pie>
                                  <Tooltip content={<CustomTooltip />} />
                                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                                </PieChart>
                              </ResponsiveContainer>
                              {!loadEmp && actifs > 0 && (
                                <div className="flex gap-4 justify-center mt-2">
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-blue-700">{hommes}</div>
                                    <div className="text-[10px] text-slate-400">Hommes · {Math.round(hommes / actifs * 100)}%</div>
                                  </div>
                                  <div className="w-px bg-slate-100" />
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-pink-600">{femmes}</div>
                                    <div className="text-[10px] text-slate-400">Femmes · {Math.round(femmes / actifs * 100)}%</div>
                                  </div>
                                </div>
                              )}
                            </>
                          )
                        }
                      </ChartCard>

                      <ChartCard title="Projets / Services" sub="Top 6 actifs" loading={loadEmp} minH={200}>
                        {projetData.length === 0
                          ? <p className="text-xs text-slate-400 text-center pt-16">Aucune donnée</p>
                          : (
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={projetData} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                                <XAxis type="number" tick={{ fontSize: 10 }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" name="Employés" radius={[0, 4, 4, 0]}>
                                  {projetData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          )
                        }
                      </ChartCard>
                    </div>
                  </Section>
                </motion.div>
              )}

              {/* ════ POINTAGES ════ */}
              {activeSection === "pointages" && (
                <motion.div key="pointages"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }} className="space-y-10"
                >
                  <Section title="Pointages" icon={Clock} delay={0.05}
                    action={<span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">{monthLabel}</span>}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ChartCard title="Pointage aujourd'hui" sub={`Effectif suivi : ${totalPointing}`} loading={loadDaily} minH={220}>
                        {attendanceDonut.length === 0
                          ? <p className="text-xs text-slate-400 text-center pt-20">Aucun pointage enregistré</p>
                          : (
                            <>
                              <ResponsiveContainer width="100%" height={150}>
                                <PieChart>
                                  <Pie data={attendanceDonut} dataKey="value" outerRadius={62} innerRadius={40} paddingAngle={2}>
                                    {attendanceDonut.map((d, i) => <Cell key={i} fill={d.fill} />)}
                                  </Pie>
                                  <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="grid grid-cols-2 gap-1.5 mt-1">
                                {attendanceDonut.map((d) => (
                                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                                    <span className="text-slate-500 truncate">{d.name}</span>
                                    <span className="font-bold text-slate-700 ml-auto">{d.value}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 pt-2 border-t border-slate-100">
                                <ProgressBar
                                  value={present} max={actifs || totalPointing}
                                  color="#22c55e"
                                  label={`Présents / Effectif (${actifs || totalPointing})`}
                                  valueLabel={`${tauxPresence}%`}
                                />
                              </div>
                            </>
                          )
                        }
                      </ChartCard>

                      <ChartCard title="Présence — Semaine en cours" sub="Par jour de la semaine" loading={loadWeekly} minH={220}>
                        {semaineData.length === 0
                          ? <p className="text-xs text-slate-400 text-center pt-20">Aucune donnée</p>
                          : (
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={semaineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="jour" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                                <Bar dataKey="present" name="Présents"  fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={26} />
                                <Bar dataKey="absent"  name="Absents"   fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={26} />
                                <Bar dataKey="retard"  name="En retard" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={26} />
                              </BarChart>
                            </ResponsiveContainer>
                          )
                        }
                      </ChartCard>

                      <ChartCard title="Heures — Semaine en cours" sub="Travaillées vs attendues" loading={loadWeekly} minH={220}>
                        <div className="space-y-3 mt-2">
                          <ProgressBar value={heuresTrav} max={Math.max(heuresAtt, heuresTrav)} color="#1e3a5f" label="Travaillées" valueLabel={`${fmt(heuresTrav)} h`} />
                          <ProgressBar value={heuresAtt}  max={Math.max(heuresAtt, heuresTrav)} color="#cbd5e1" label="Attendues"   valueLabel={`${fmt(heuresAtt)} h`} />
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-xs text-slate-500 font-medium">Écart semaine</span>
                            <span className={`text-sm font-bold flex items-center gap-0.5 ${deltaMin < 0 ? "text-red-500" : "text-emerald-600"}`}>
                              {deltaMin < 0 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                              {fmtMinutes(deltaMin)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            {[
                              { label: "Présents",   value: present,    cls: "text-emerald-700 bg-emerald-50" },
                              { label: "Absents",    value: absent,     cls: "text-red-700 bg-red-50"         },
                              { label: "Incomplets", value: incomplete, cls: "text-amber-700 bg-amber-50"     },
                            ].map((s) => (
                              <div key={s.label} className={`rounded-xl p-2 text-center ${s.cls}`}>
                                <div className="text-lg font-bold">{s.value}</div>
                                <div className="text-[10px] font-semibold">{s.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </ChartCard>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ChartCard title={`Heures — ${monthLabel}`} sub="Travaillées vs attendues par semaine" loading={loadMonthly} minH={220}>
                        {heuresMens.length === 0
                          ? <p className="text-xs text-slate-400 text-center pt-20">Aucune donnée mensuelle</p>
                          : (
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={heuresMens} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="sem" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 10 }} unit="h" />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                                <Bar dataKey="travaillees" name="Travaillées" fill="#1e3a5f" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                <Bar dataKey="attendues"   name="Attendues"   fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={30} />
                              </BarChart>
                            </ResponsiveContainer>
                          )
                        }
                      </ChartCard>

                      <ChartCard title="Top 10 absents" sub="Semaine en cours" loading={loadWeekly} minH={220}>
                        <TopAbsentList items={topAbsents} />
                      </ChartCard>

                      <ChartCard title="Top 10 présents" sub="Aujourd'hui · Arrivée ≤ 08h00 · Départ ≥ 17h30" loading={loadDaily} minH={220}>
                        <TopPresentList records={dailyRecords} />
                      </ChartCard>
                    </div>
                  </Section>
                </motion.div>
              )}

              {/* ════ BULLETINS ════ */}
              {activeSection === "bulletins" && (
                <motion.div key="bulletins"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }} className="space-y-10"
                >
                  <Section title="Bulletins de salaire" icon={FileText} delay={0.05}
                    action={<span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">{monthLabel}</span>}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <KPICard icon={FileText}      label="Générés"      value={totalBulletins}                     color="blue"  delay={0.08} loading={loadBulletin} sub={monthLabel} />
                      <KPICard icon={CheckCircle}   label="Envoyés"      value={totalEnvoyes}                       color="green" delay={0.11} loading={loadBulletin} sub="Ce mois" />
                      <KPICard icon={AlertTriangle} label="Non envoyés"  value={Math.max(0, actifs - totalEnvoyes)} color="amber" delay={0.14} loading={loadBulletin || loadEmp} sub="Actifs sans bulletin" />
                      <KPICard icon={TrendingUp}    label="Taux d'envoi" value={`${tauxEnvoi}%`}
                        color={tauxEnvoi >= 90 ? "green" : tauxEnvoi >= 60 ? "amber" : "red"}
                        delay={0.17} loading={loadBulletin || loadEmp} sub="Envoyés / Actifs"
                      />
                    </div>
                    <ChartCard title="Bulletins — Historique" sub="Envoyés vs générés par mois" loading={loadBulletin} minH={200}>
                      {bulletinsChart.length === 0
                        ? <p className="text-xs text-slate-400 text-center pt-20">Aucune donnée</p>
                        : (
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={bulletinsChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                              <Bar dataKey="envoyes" name="Envoyés" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
                              <Bar dataKey="total"   name="Générés" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={32} />
                            </BarChart>
                          </ResponsiveContainer>
                        )
                      }
                    </ChartCard>
                  </Section>
                </motion.div>
              )}

              {/* ════ CONGÉS ════ */}
              {activeSection === "conges" && (
                <motion.div key="conges"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <CongesSection monthLabel={monthLabel} />
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {showExport && (
          <ExportModal
            open={showExport}
            onClose={() => setShowExport(false)}
            rangeLabel={rangeLabel}
            employees={employees}
            daily={daily}
            weekly={weekly}
            monthly={monthly}
            bulletins={bulletins}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
