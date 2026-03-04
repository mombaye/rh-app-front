import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  Clock, AlertTriangle, UserMinus,
  FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2,
  ChevronDown, Settings2, UserPlus, Check, Users,
} from "lucide-react";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import { getShiftDailyStats } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import type { ShiftDailyStatsResponse, ShiftTeamKey, ShiftRecord } from "@/types/attendance";
import type { Employee } from "@/types/employee";

type StatusFilter = "all" | "ok" | "absent" | "incomplete" | "anomaly" | "late" | "deficit";
type MotifType = "absent" | "not_pointing";
type AssignmentMap = Record<string, ShiftTeamKey | null>;

interface CompensationResult {
  late_min: number;
  overtime_min: number;
  compensated_min: number;
  remaining_min: number;
  is_compensated: boolean;
  has_overtime: boolean;
}

interface FlatRecord {
  employee_id: number;
  matricule: string;
  full_name: string;
  department: string;
  status: "ok" | "absent" | "incomplete" | "anomaly";
  computed_late_minutes: number;
  is_late_api: boolean;
  late_label_api: string | null;
  overtime_minutes: number;
  compensation: CompensationResult;
  deficit_minutes: number;
  in_time: string | null;
  out_time: string | null;
  worked_minutes: number;
  expected_minutes: number;
  email: string | null;
  shift_team: ShiftTeamKey | null;
  shift_team_label: string;
}

const WORKDAY_MIN = 510;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const SHIFT_TEAMS: {
  key: ShiftTeamKey;
  label: string;
  short: string;
  horaire: string;
  dot: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  pillBg: string;
  headerBg: string;
}[] = [
  {
    key: "jour",
    label: "Équipe Journée",
    short: "Journée",
    horaire: "08h – 16h",
    dot: "bg-amber-500",
    activeBg: "bg-amber-50",
    activeText: "text-amber-800",
    activeBorder: "border-amber-400",
    pillBg: "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
    headerBg: "bg-amber-600",
  },
  {
    key: "soir1",
    label: "Équipe Soir 1",
    short: "Soir 1",
    horaire: "16h – 22h",
    dot: "bg-indigo-500",
    activeBg: "bg-indigo-50",
    activeText: "text-indigo-800",
    activeBorder: "border-indigo-400",
    pillBg: "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300",
    headerBg: "bg-indigo-700",
  },
  {
    key: "soir2",
    label: "Équipe Soir 2",
    short: "Soir 2",
    horaire: "22h – 08h",
    dot: "bg-slate-600",
    activeBg: "bg-slate-800",
    activeText: "text-slate-100",
    activeBorder: "border-slate-600",
    pillBg: "bg-slate-800 text-slate-100 ring-1 ring-slate-600",
    headerBg: "bg-slate-800",
  },
];

const QUICK_FILTERS = [
  { key: "all" as StatusFilter, label: "Tous", dotColor: "bg-slate-400", activeText: "text-slate-800", activeBg: "bg-slate-900", activeDot: "bg-white" },
  { key: "ok" as StatusFilter, label: "OK", dotColor: "bg-emerald-400", activeText: "text-emerald-700", activeBg: "bg-emerald-50", activeDot: "bg-emerald-500" },
  { key: "absent" as StatusFilter, label: "Absents", dotColor: "bg-red-400", activeText: "text-red-700", activeBg: "bg-red-50", activeDot: "bg-red-500" },
  { key: "late" as StatusFilter, label: "Retards", dotColor: "bg-orange-400", activeText: "text-orange-700", activeBg: "bg-orange-50", activeDot: "bg-orange-500" },
  { key: "incomplete" as StatusFilter, label: "Incomplets", dotColor: "bg-amber-400", activeText: "text-amber-800", activeBg: "bg-amber-50", activeDot: "bg-amber-500" },
  { key: "anomaly" as StatusFilter, label: "Anomalies", dotColor: "bg-violet-400", activeText: "text-violet-700", activeBg: "bg-violet-50", activeDot: "bg-violet-500" },
  { key: "deficit" as StatusFilter, label: "Heures −", dotColor: "bg-rose-400", activeText: "text-rose-700", activeBg: "bg-rose-50", activeDot: "bg-rose-500" },
];

const STATUS_CFG = {
  ok: { label: "OK", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  absent: { label: "Absent", dot: "bg-red-500", badge: "bg-red-50 text-red-700 ring-red-200" },
  incomplete: { label: "Incomplet", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  anomaly: { label: "Anomalie", dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 ring-violet-200" },
};

// ── Helpers ──
function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function formatMinutes(min: number): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function computeCompensation(lateMin: number, overtimeMin: number): CompensationResult {
  const compensated = Math.min(lateMin, overtimeMin);
  const remaining = Math.max(0, lateMin - compensated);
  return {
    late_min: lateMin, overtime_min: overtimeMin, compensated_min: compensated,
    remaining_min: remaining, is_compensated: lateMin > 0 && remaining === 0, has_overtime: overtimeMin > 0,
  };
}

function computeDeficitMinutes(worked: number, expected: number): number {
  const exp = expected > 0 ? expected : WORKDAY_MIN;
  return worked > 0 ? Math.max(0, exp - worked) : 0;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function exportCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename + ".csv";
  a.click();
}

async function sendAlertEmail(emp: FlatRecord, motif: MotifType): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 500));
  return { success: !!emp.email };
}

// ── UI components ──
function StatusPill({ status }: { status: keyof typeof STATUS_CFG }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.anomaly;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
      <span className="hidden sm:inline">{c.label}</span>
    </span>
  );
}

function ShiftTeamPill({ teamKey }: { teamKey: ShiftTeamKey | null }) {
  if (!teamKey) return <span className="text-slate-300 text-xs">—</span>;
  const cfg = SHIFT_TEAMS.find((t) => t.key === teamKey);
  if (!cfg) return <span className="text-slate-400 text-xs">{teamKey}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.pillBg}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.short}
    </span>
  );
}

function LateBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 ring-1 ring-orange-300 whitespace-nowrap">
      <Clock className="h-3 w-3 shrink-0" />
      <span className="hidden lg:inline">RETARD · </span>{formatMinutes(minutes)}
    </span>
  );
}

function DeficitBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 ring-1 ring-rose-200 whitespace-nowrap">
      − {formatMinutes(minutes)}
    </span>
  );
}

// ── AbsentsCard ──
function AbsentsCard({ total, absent, loading, delay }: { total: number; absent: number; loading: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="p-2 rounded-xl bg-red-500 text-white"><UserMinus className="h-4 w-4 sm:h-5 sm:w-5" /></div>
      </div>
      {loading ? (
        <div className="space-y-2 mt-1">
          <div className="h-4 w-20 sm:w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-16 sm:w-20 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 truncate">Effectif</span>
            <span className="text-base font-bold text-slate-800 tabular-nums shrink-0">{total}</span>
          </div>
          <div className="w-full h-px bg-slate-100" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-red-600 truncate">Absents</span>
            <span className="text-base font-bold text-red-600 tabular-nums shrink-0">{absent}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, color = "blue", delay = 0, loading = false, active = false, onClick,
}: {
  icon: any; label: string; value: string | number; sub?: string;
  color?: "blue" | "green" | "amber" | "red" | "violet" | "slate" | "orange";
  delay?: number; loading?: boolean; active?: boolean; onClick?: () => void;
}) {
  const palette = {
    blue: { icon: "bg-camublue-900 text-white", text: "text-camublue-900" },
    green: { icon: "bg-emerald-500 text-white", text: "text-emerald-700" },
    amber: { icon: "bg-amber-500 text-white", text: "text-amber-700" },
    red: { icon: "bg-red-500 text-white", text: "text-red-700" },
    violet: { icon: "bg-violet-500 text-white", text: "text-violet-700" },
    slate: { icon: "bg-slate-400 text-white", text: "text-slate-600" },
    orange: { icon: "bg-orange-500 text-white", text: "text-orange-700" },
  };
  const c = palette[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      onClick={onClick}
      className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${onClick ? "cursor-pointer" : ""} ${
        active ? "border-orange-400 ring-2 ring-orange-200 shadow-md" : "border-slate-100 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className={`p-2 rounded-xl ${c.icon}`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div>
        {active && (
          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full ring-1 ring-orange-200">Filtré</span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2 mt-1">
          <div className="h-6 w-16 sm:w-20 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-4 w-20 sm:w-28 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <div className={`text-xl sm:text-2xl font-bold ${c.text} mb-0.5`}>{value}</div>
          <div className="text-xs sm:text-sm font-medium text-slate-700 truncate">{label}</div>
          {sub && <div className="text-xs text-slate-400 mt-1 hidden sm:block">{sub}</div>}
        </>
      )}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Gestion Shifts Modal
// ────────────────────────────────────────────────────────────────────
function GestionShiftsModal({
  open, onClose, employees, assignments, onSave,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  assignments: AssignmentMap;
  onSave: (map: AssignmentMap) => void;
}) {
  const [local, setLocal] = useState<AssignmentMap>({});
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState<ShiftTeamKey | "unassigned" | "all">("all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setLocal({ ...assignments }); setSearch(""); setFilterTeam("all"); }
  }, [open, assignments]);

  const assign = (matricule: string, team: ShiftTeamKey | null) =>
    setLocal((prev) => ({ ...prev, [matricule]: team }));

  const assignAllVisible = (team: ShiftTeamKey) => {
    const next = { ...local };
    filteredEmployees.forEach((e) => { if (e.matricule) next[e.matricule] = team; });
    setLocal(next);
  };

  const clearAllVisible = () => {
    const next = { ...local };
    filteredEmployees.forEach((e) => { if (e.matricule) next[e.matricule] = null; });
    setLocal(next);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    onSave(local);
    setSaving(false);
    onClose();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { jour: 0, soir1: 0, soir2: 0, unassigned: 0 };
    employees.forEach((e) => {
      const t = e.matricule ? (local[e.matricule] ?? null) : null;
      if (t) c[t] = (c[t] ?? 0) + 1;
      else c.unassigned++;
    });
    return c;
  }, [local, employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        `${e.nom ?? ""} ${e.prenom ?? ""}`.toLowerCase().includes(q) ||
        (e.matricule ?? "").toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q);
      const assigned = e.matricule ? (local[e.matricule] ?? null) : null;
      const matchTeam =
        filterTeam === "all" ? true :
        filterTeam === "unassigned" ? !assigned :
        assigned === filterTeam;
      return matchSearch && matchTeam;
    });
  }, [employees, search, filterTeam, local]);

  const changedCount = useMemo(() =>
    Object.entries(local).filter(([mat, team]) => assignments[mat] !== team).length,
    [local, assignments]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative w-full sm:max-w-2xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
            style={{ maxHeight: "calc(100dvh - 0px)" }}
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-camublue-900 text-white">
                  <Settings2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm sm:text-base">Gestion des Shifts</p>
                  <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">Répartition des employés par équipe</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Compteurs par équipe */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 shrink-0">
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {SHIFT_TEAMS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setFilterTeam(filterTeam === t.key ? "all" : t.key)}
                    className={`flex flex-col items-center py-2 px-1 sm:px-2 rounded-xl border-2 transition-all ${
                      filterTeam === t.key
                        ? `${t.activeBorder} ${t.activeBg} ${t.activeText}`
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full mb-1 ${t.dot}`} />
                    <span className="text-sm font-bold tabular-nums">{counts[t.key] ?? 0}</span>
                    <span className="text-[10px] sm:text-xs font-medium text-center leading-tight mt-0.5">{t.short}</span>
                  </button>
                ))}
                <button
                  onClick={() => setFilterTeam(filterTeam === "unassigned" ? "all" : "unassigned")}
                  className={`flex flex-col items-center py-2 px-1 sm:px-2 rounded-xl border-2 transition-all ${
                    filterTeam === "unassigned"
                      ? "border-slate-500 bg-slate-100 text-slate-800"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full mb-1 bg-slate-400" />
                  <span className="text-sm font-bold tabular-nums text-slate-600">{counts.unassigned ?? 0}</span>
                  <span className="text-[10px] sm:text-xs font-medium text-slate-500 text-center leading-tight mt-0.5">Non ass.</span>
                </button>
              </div>
            </div>

            {/* Barre de recherche + actions en masse */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 shrink-0 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher…"
                    className="pl-8 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={clearAllVisible}
                  className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition whitespace-nowrap"
                >
                  Effacer
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 shrink-0">Assigner à :</span>
                {SHIFT_TEAMS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => assignAllVisible(t.key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${t.pillBg} hover:opacity-80`}
                  >
                    <UserPlus className="h-3 w-3" />
                    {t.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Liste des employés */}
            <div className="flex-1 overflow-y-auto">
              {filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Users className="h-10 w-10 mb-2 text-slate-200" />
                  <p className="text-sm">Aucun employé trouvé</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const mat = emp.matricule ?? "";
                    const current = local[mat] ?? null;
                    const fullName = `${emp.prenom ?? ""} ${emp.nom ?? ""}`.trim() || emp.username || mat;
                    const dept = (emp as any).department ?? (emp as any).service ?? "";
                    return (
                      <div key={mat} className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50/80 transition-colors">
                        {/* Avatar */}
                        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                          <span className="text-xs sm:text-sm font-bold text-camublue-900">
                            {fullName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {/* Infos */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{fullName}</p>
                          <p className="text-xs text-slate-400 font-mono truncate">
                            {mat}{dept ? ` · ${dept}` : ""}
                          </p>
                        </div>
                        {/* Boutons d'assignation */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => assign(mat, null)}
                            title="Retirer l'assignation"
                            className={`h-7 w-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                              current === null
                                ? "border-slate-400 bg-slate-100 text-slate-600"
                                : "border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-400"
                            }`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {SHIFT_TEAMS.map((t) => {
                            const isSelected = current === t.key;
                            return (
                              <button
                                key={t.key}
                                onClick={() => assign(mat, t.key)}
                                title={`${t.label} · ${t.horaire}`}
                                className={`h-7 px-1.5 sm:px-2 rounded-lg border-2 flex items-center gap-1 text-xs font-bold transition-all ${
                                  isSelected
                                    ? `${t.activeBorder} ${t.activeBg} ${t.activeText}`
                                    : "border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${t.dot}`} />
                                <span className="hidden sm:inline">{t.short}</span>
                                {isSelected && <Check className="h-3 w-3 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/60">
              <div className="text-xs min-w-0">
                {changedCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-full ring-1 ring-amber-200 truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    {changedCount} modif.
                  </span>
                ) : (
                  <span className="text-slate-400">Aucune modification</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={onClose}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition">
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || changedCount === 0}
                  className="px-4 py-2 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Enregistrement…</span></>
                    : <><Check className="h-4 w-4" /><span>Enregistrer</span></>
                  }
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Alert Modal ──
function AlertModal({
  open, onClose, employee, onConfirm, sending,
}: {
  open: boolean; onClose: () => void; employee: FlatRecord | null;
  onConfirm: (m: MotifType) => void; sending: boolean;
}) {
  const [motif, setMotif] = useState<MotifType>("absent");
  useEffect(() => {
    if (employee) setMotif(employee.status === "absent" ? "absent" : "not_pointing");
  }, [employee]);

  return (
    <AnimatePresence>
      {open && employee && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => !sending && onClose()}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm overflow-hidden z-10"
            initial={{ y: 40, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle on mobile */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-800">Envoyer une alerte</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px] sm:max-w-[230px]">
                  {employee.full_name}
                  {employee.matricule && <span className="font-mono ml-1.5 text-slate-300">· {employee.matricule}</span>}
                </div>
              </div>
              <button onClick={onClose} disabled={sending}
                className="p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-40">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${employee.email ? "bg-slate-50" : "bg-red-50 border border-red-100"}`}>
                <Mail className={`h-4 w-4 shrink-0 ${employee.email ? "text-slate-400" : "text-red-400"}`} />
                {employee.email ? (
                  <span className="text-sm font-mono text-slate-700 truncate">{employee.email}</span>
                ) : (
                  <span className="text-sm text-red-500 font-medium flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />Aucun email
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Motif</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMotif("absent")}
                    className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${
                      motif === "absent" ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}>
                    <div className={`p-2 rounded-xl ${motif === "absent" ? "bg-red-100" : "bg-slate-100"}`}>
                      <UserMinus className="h-4 w-4" />
                    </div>
                    Absence
                  </button>
                  <button onClick={() => setMotif("not_pointing")}
                    className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${
                      motif === "not_pointing" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}>
                    <div className={`p-2 rounded-xl ${motif === "not_pointing" ? "bg-amber-100" : "bg-slate-100"}`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    Non pointage
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
                Email à <strong>{employee.full_name}</strong> pour{" "}
                <strong>{motif === "absent" ? "absence" : "non-pointage"}</strong> du{" "}
                {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}.
              </div>
            </div>
            <div className="px-5 pb-6 flex gap-3">
              <button onClick={onClose} disabled={sending}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">
                Annuler
              </button>
              <button onClick={() => onConfirm(motif)} disabled={sending || !employee.email}
                className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  !employee.email ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-camublue-900 hover:bg-camublue-800 text-white"
                } disabled:opacity-60`}>
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Envoyer</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Table row (desktop + mobile card) ──
function TableRow({ r, isLate, onAlert }: { r: FlatRecord; isLate: boolean; onAlert: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const deficit = r.deficit_minutes > 0;
  const teamCfg = SHIFT_TEAMS.find((t) => t.key === r.shift_team);

  return (
    <>
      {/* Desktop */}
      <tr className={`hidden md:table-row border-b border-slate-100 transition-colors text-sm ${
        isLate ? "bg-orange-50/50 hover:bg-orange-50"
        : deficit ? "bg-rose-50/30 hover:bg-rose-50/60"
        : "hover:bg-slate-50"
      }`}>
        <td className="px-3 lg:px-4 py-3 font-mono text-slate-500 text-xs whitespace-nowrap">{r.matricule || "—"}</td>
        <td className="px-3 lg:px-4 py-3 font-medium text-slate-800 max-w-[140px] lg:max-w-none truncate">{r.full_name}</td>
        <td className="px-3 lg:px-4 py-3 text-slate-600 text-xs max-w-[100px] truncate hidden lg:table-cell">{r.department}</td>
        <td className="px-3 lg:px-4 py-3"><ShiftTeamPill teamKey={r.shift_team} /></td>
        <td className="px-3 lg:px-4 py-3"><StatusPill status={r.status} /></td>
        <td className="px-3 lg:px-4 py-3"><LateBadge minutes={r.computed_late_minutes} /></td>
        <td className={`px-3 lg:px-4 py-3 tabular-nums font-mono text-xs whitespace-nowrap ${r.computed_late_minutes > 0 ? "text-red-600 font-semibold" : "text-slate-700"}`}>
          {formatTime(r.in_time)}
        </td>
        <td className="px-3 lg:px-4 py-3 tabular-nums font-mono text-xs text-slate-700 whitespace-nowrap">{formatTime(r.out_time)}</td>
        <td className="px-3 lg:px-4 py-3 hidden lg:table-cell"><DeficitBadge minutes={r.deficit_minutes} /></td>
        <td className="px-3 lg:px-4 py-3">
          <button
            onClick={onAlert}
            disabled={r.status !== "absent" || !r.email}
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              r.status === "absent" && r.email
                ? "bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
            title={!r.email ? "Email manquant" : ""}
          >
            <Bell className="h-3 w-3" />
            <span className="hidden lg:inline">Alerter</span>
          </button>
        </td>
      </tr>

      {/* Mobile card */}
      <tr className={`md:hidden border-b border-slate-100 ${
        isLate ? "bg-orange-50/40" : deficit ? "bg-rose-50/30" : ""
      }`}>
        <td colSpan={10} className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 text-sm truncate">{r.full_name}</p>
              <p className="text-xs text-slate-400 font-mono">{r.matricule || "—"} · {r.department}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusPill status={r.status} />
              {isLate && <LateBadge minutes={r.computed_late_minutes} />}
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 space-y-2 text-sm"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <ShiftTeamPill teamKey={r.shift_team} />
                {teamCfg && <span className="text-xs text-slate-400 font-mono">{teamCfg.horaire}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-400 mb-0.5">Entrée</p>
                  <p className={`font-mono font-semibold text-sm ${r.computed_late_minutes > 0 ? "text-red-600" : "text-slate-700"}`}>
                    {formatTime(r.in_time)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-400 mb-0.5">Sortie</p>
                  <p className="font-mono font-semibold text-sm text-slate-700">{formatTime(r.out_time)}</p>
                </div>
              </div>
              {r.deficit_minutes > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Déficit :</span>
                  <DeficitBadge minutes={r.deficit_minutes} />
                </div>
              )}
              <button
                onClick={onAlert}
                disabled={r.status !== "absent" || !r.email}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all mt-1 ${
                  r.status === "absent" && r.email
                    ? "bg-red-50 hover:bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Bell className="h-3 w-3" />Alerter
              </button>
            </motion.div>
          )}
        </td>
      </tr>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────
export default function AttendanceShiftsPage() {
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<ShiftTeamKey | null>(null);
  const [shiftData, setShiftData] = useState<ShiftDailyStatsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [emailMap, setEmailMap] = useState<Map<string, string>>(new Map());
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<FlatRecord | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [gestionOpen, setGestionOpen] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentMap>({});

  useEffect(() => {
    getEmployees()
      .then((list: Employee[]) => {
        setAllEmployees(list);
        const m = new Map<string, string>();
        const a: AssignmentMap = {};
        list.forEach((e) => {
          if (e.matricule && e.email) m.set(e.matricule, e.email);
          if (e.matricule && (e as any).shift_team) a[e.matricule] = (e as any).shift_team;
        });
        setEmailMap(m);
        setAssignments(a);
      })
      .catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { date: string; team?: ShiftTeamKey } = { date: isoToday() };
      if (selectedTeam) params.team = selectedTeam;
      setShiftData(await getShiftDailyStats(params));
    } finally {
      setLoading(false);
    }
  }, [selectedTeam]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQ, shiftData, pageSize]);

  const allRecords = useMemo((): FlatRecord[] => {
    if (!shiftData) return [];
    return shiftData.records.map((r: ShiftRecord): FlatRecord => ({
      employee_id: r.employee_id,
      matricule: r.matricule,
      full_name: r.full_name,
      department: r.department ?? "—",
      status: r.status,
      computed_late_minutes: r.late_minutes,
      is_late_api: r.is_late,
      late_label_api: r.late_label,
      overtime_minutes: 0,
      compensation: computeCompensation(r.late_minutes, 0),
      deficit_minutes: computeDeficitMinutes(r.worked_minutes, r.expected_minutes),
      in_time: r.in_time,
      out_time: r.out_time,
      worked_minutes: r.worked_minutes,
      expected_minutes: r.expected_minutes,
      email: emailMap.get(r.matricule) ?? null,
      shift_team: r.shift_team,
      shift_team_label: r.shift_team_label ?? "",
    }));
  }, [shiftData, emailMap]);

  const kpis = useMemo(() => {
    const total = allRecords.length;
    if (!shiftData) return { total: 0, absent: 0, late: 0, anomaly: 0 };
    return {
      total,
      absent: shiftData.kpis.absent,
      late: shiftData.kpis.late,
      anomaly: shiftData.kpis.anomalies,
    };
  }, [shiftData, allRecords]);

  const isLateRecord = (r: FlatRecord) => r.computed_late_minutes > 0;

  const filtered = useMemo(
    () => allRecords.filter((r) => {
      if (statusFilter === "late") { if (!isLateRecord(r)) return false; }
      else if (statusFilter === "deficit") { if (r.deficit_minutes <= 0) return false; }
      else if (statusFilter !== "all") { if (r.status !== statusFilter) return false; }
      if (!searchQ) return true;
      const q = searchQ.toLowerCase();
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.matricule.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        (r.shift_team_label ?? "").toLowerCase().includes(q)
      );
    }),
    [allRecords, statusFilter, searchQ]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const filterCount = (key: StatusFilter) => {
    if (key === "all") return allRecords.length;
    if (key === "late") return allRecords.filter(isLateRecord).length;
    if (key === "deficit") return allRecords.filter((r) => r.deficit_minutes > 0).length;
    return allRecords.filter((r) => r.status === key).length;
  };

  const handleSendAlert = async (motif: MotifType) => {
    if (!selectedEmployee) return;
    setSendingAlert(true);
    const res = await sendAlertEmail(selectedEmployee, motif);
    setSendingAlert(false);
    alert(res.success ? `Alerte envoyée à ${selectedEmployee.email}` : "Échec de l'envoi.");
    setAlertModalOpen(false);
    setSelectedEmployee(null);
  };

  const handleSaveAssignments = (map: AssignmentMap) => {
    setAssignments(map);
    fetchData();
  };

  const unassignedCount = allEmployees.filter((e) => e.matricule && !assignments[e.matricule]).length;
  const activeTeamCfg = SHIFT_TEAMS.find((t) => t.key === selectedTeam);
  const tableHeaders = ["Matricule", "Nom", "Dép.", "Équipe", "Statut", "Retard", "Entrée", "Sortie", "Déficit", ""];

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden gap-2 sm:gap-3 p-3 sm:p-4 md:p-5"
      >
        {/* ── En-tête ── */}
        <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-3 sm:items-start shrink-0">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-camublue-900 truncate">Pointages Shifts</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTeamCfg
                ? <span className="text-indigo-500 font-semibold">{activeTeamCfg.label} · {activeTeamCfg.horaire}</span>
                : "Toutes les équipes"
              }
            </p>
          </div>

          {/* Action bar — scrollable on xs */}
          <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto pb-0.5 sm:pb-0">
            {/* Search */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
                placeholder="Rechercher…"
                className="pl-8 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-camublue-900 text-sm px-3 py-2 w-36 sm:w-44 md:w-52 focus:outline-none"
              />
            </div>

            {/* Gestion Shifts */}
            <button
              onClick={() => setGestionOpen(true)}
              className="relative border-2 px-2.5 sm:px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 bg-white border-camublue-900 text-camublue-900 hover:bg-camublue-900/5 shrink-0"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Gestion Shifts</span>
              {unassignedCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 bg-amber-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
                  {unassignedCount > 9 ? "9+" : unassignedCount}
                </span>
              )}
            </button>

            {/* Export */}
            <button
              onClick={() => exportCSV(`shift_${selectedTeam ?? "all"}_${isoToday()}`, filtered.map((r) => ({
                Matricule: r.matricule, Nom: r.full_name, Département: r.department,
                Équipe: r.shift_team_label || r.shift_team || "—",
                Statut: r.status,
                Retard: r.computed_late_minutes > 0 ? `RETARD · ${formatMinutes(r.computed_late_minutes)}` : "Non",
                Entrée: formatTime(r.in_time), Sortie: formatTime(r.out_time),
                "Heures moins": r.deficit_minutes > 0 ? `−${formatMinutes(r.deficit_minutes)}` : "—",
                Email: r.email ?? "Manquant",
              })))}
              className="bg-white border border-slate-300 px-2.5 sm:px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition flex items-center gap-1.5 shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Exporter</span>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchData}
              className="bg-camublue-900 text-white px-2.5 sm:px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-camublue-800 transition shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Rafraîchir</span>
            </button>
          </div>
        </div>

        {/* ── Sélecteur d'équipe ── */}
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          <button
            onClick={() => setSelectedTeam(null)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${
              selectedTeam === null
                ? "border-camublue-900 bg-camublue-900/10 text-camublue-900"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
            <span className="truncate text-xs sm:text-sm">Toutes</span>
          </button>
          {SHIFT_TEAMS.map((team) => {
            const isActive = selectedTeam === team.key;
            const kpiTeam = shiftData?.kpis.by_team?.[team.key];
            return (
              <button
                key={team.key}
                onClick={() => setSelectedTeam(isActive ? null : team.key)}
                className={`flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${
                  isActive
                    ? `${team.activeBg} ${team.activeText} ${team.activeBorder}`
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${team.dot}`} />
                  <span className="truncate text-xs sm:text-sm">{team.short}</span>
                </div>
                {kpiTeam && (
                  <span className={`text-xs font-bold tabular-nums shrink-0 ${isActive ? team.activeText : "text-slate-500"}`}>
                    {kpiTeam.present}/{kpiTeam.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
          <AbsentsCard total={kpis.total} absent={kpis.absent} loading={loading} delay={0.05} />
          <StatCard
            icon={Clock} label="Retards" value={kpis.late} color="orange" delay={0.1} loading={loading}
            active={statusFilter === "late"} sub="Cliquer pour filtrer"
            onClick={() => setStatusFilter((f) => (f === "late" ? "all" : "late"))}
          />
          <StatCard icon={AlertTriangle} label="Anomalies" value={kpis.anomaly} color="violet" delay={0.15} loading={loading} />
        </div>

        {/* ── Filtres rapides ── */}
        <div className="shrink-0">
          <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100/80 rounded-xl p-1 overflow-x-auto border border-camublue-900/20 shadow-sm scrollbar-none">
            {QUICK_FILTERS.map((f) => {
              const isActive = statusFilter === f.key;
              const count = filterCount(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setPage(1); }}
                  className={`relative inline-flex flex-col items-center justify-center gap-0.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 ${
                    isActive ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? f.activeDot : f.dotColor}`} />
                    {f.label}
                  </span>
                  <span className={`tabular-nums font-bold leading-none text-[10px] sm:text-xs ${isActive ? "text-camublue-900" : "text-slate-400/70"}`}>
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
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Tableau ── */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex-1 overflow-auto rounded-xl border border-slate-200 shadow-sm min-h-0">
            <table className="min-w-full bg-white">
              {/* Desktop header */}
              <thead className={`sticky top-0 z-10 text-white hidden md:table-header-group ${activeTeamCfg?.headerBg ?? "bg-camublue-900"}`}>
                <tr>
                  {tableHeaders.map((h, i) => (
                    <th
                      key={h + i}
                      className={`px-3 lg:px-4 py-3 text-left border-b border-white/20 text-xs font-semibold whitespace-nowrap ${
                        // Hide dept & deficit columns on md, show on lg
                        (h === "Dép." || h === "Déficit") ? "hidden lg:table-cell" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {/* Mobile header */}
              <thead className={`sticky top-0 z-10 text-white md:hidden ${activeTeamCfg?.headerBg ?? "bg-camublue-900"}`}>
                <tr>
                  <th className="px-3 py-3 text-left text-sm font-semibold" colSpan={10}>
                    {activeTeamCfg ? `${activeTeamCfg.short}` : "Tous"} · {filtered.length} enreg.
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-3 lg:px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : pageData.length ? (
                  pageData.map((r) => (
                    <TableRow
                      key={r.employee_id}
                      r={r}
                      isLate={isLateRecord(r)}
                      onAlert={() => { setSelectedEmployee(r); setAlertModalOpen(true); }}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400 text-sm">
                      {statusFilter === "late" ? "Aucun retard."
                        : statusFilter === "deficit" ? "Aucune heure manquante."
                        : "Aucun enregistrement trouvé."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {filtered.length > 0 && (
            <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 px-1 shrink-0">
              {/* Left: count + page size */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</span>
                  {" / "}<strong className="text-slate-700">{filtered.length}</strong>
                </span>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                  <span className="text-xs text-slate-400 hidden sm:inline">Lignes :</span>
                  <div className="flex items-center gap-0.5">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <button key={size} onClick={() => { setPageSize(size); setPage(1); }}
                        className={`min-w-[26px] h-6 rounded text-xs font-semibold transition-all ${
                          pageSize === size ? "bg-camublue-900 text-white" : "text-slate-500 hover:bg-slate-100"
                        }`}>
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: page nav */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <FaAngleDoubleLeft size={11} />
                </button>
                <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-0.5 mx-0.5">
                  {getPageNumbers().map((p, i) =>
                    p === "..." ? (
                      <span key={`e-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p as number)}
                        className={`min-w-[26px] sm:min-w-[30px] h-7 rounded-md text-xs font-medium transition-colors ${
                          page === p ? "bg-camublue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                        }`}>
                        {p}
                      </button>
                    )
                  )}
                </div>
                <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                  <FaAngleDoubleRight size={11} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Modals ── */}
        <GestionShiftsModal
          open={gestionOpen}
          onClose={() => setGestionOpen(false)}
          employees={allEmployees}
          assignments={assignments}
          onSave={handleSaveAssignments}
        />
        <AlertModal
          open={alertModalOpen} onClose={() => setAlertModalOpen(false)}
          employee={selectedEmployee} onConfirm={handleSendAlert} sending={sendingAlert}
        />
      </motion.div>
    </AppLayout>
  );
}