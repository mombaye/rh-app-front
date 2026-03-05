import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  Clock, AlertTriangle, UserMinus, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, RefreshCw, Bell, Mail, XCircle, Send, Loader2, ChevronDown,
  Settings2, Check, Users, Settings, CheckCircle,
} from "lucide-react";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import { getShiftDailyStats, getEmployeePeriodDetail } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import type { ShiftDailyStatsResponse, ShiftTeamKey, ShiftRecord, EmployeePeriodDetailResponse, DayDetail } from "@/types/attendance";
import type { Employee } from "@/types/employee";

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusFilter = "all" | "ok" | "absent" | "incomplete" | "anomaly" | "late" | "deficit";
type MotifType = "absent" | "not_pointing";
type AssignmentMap = Record<string, ShiftTeamKey | null>;

// ─── Work Hours Settings ──────────────────────────────────────────────────────
interface WorkHoursSettings {
  context: string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  breakMin: number;
}

const DEFAULT_WORK_HOURS: WorkHoursSettings = { context: "Normal", startH: 8, startM: 0, endH: 17, endM: 30, breakMin: 60 };
const MAX_WORKDAY_MIN = 8 * 60;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function workDayMinutes(s: WorkHoursSettings): number {
  return Math.max(0, (s.endH * 60 + s.endM) - (s.startH * 60 + s.startM) - s.breakMin);
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface CompensationResult {
  late_min: number; overtime_min: number; compensated_min: number;
  remaining_min: number; is_compensated: boolean; has_overtime: boolean;
}

interface FlatRecord {
  employee_id: number; matricule: string; full_name: string; department: string;
  status: "ok" | "absent" | "incomplete" | "anomaly";
  is_late_api: boolean; late_label_api: string | null;
  computed_late_minutes: number; overtime_minutes: number;
  compensation: CompensationResult; deficit_minutes: number;
  in_time: string | null; out_time: string | null;
  worked_minutes: number; expected_minutes: number; email: string | null;
  shift_team: ShiftTeamKey | null; shift_team_label: string;
}

interface Pointage {
  day: string; date: string;
  in_time: string | null; out_time: string | null;
  status: "ok" | "absent" | "incomplete" | "anomaly";
}

// ─── Shift teams config ───────────────────────────────────────────────────────
const SHIFT_TEAMS: {
  key: ShiftTeamKey; label: string; short: string; horaire: string;
  dot: string; activeBg: string; activeText: string; activeBorder: string; pillBg: string; headerBg: string;
}[] = [
  { key: "jour", label: "Équipe Journée", short: "Journée", horaire: "08h – 16h",
    dot: "bg-amber-500", activeBg: "bg-amber-50", activeText: "text-amber-800", activeBorder: "border-amber-400",
    pillBg: "bg-amber-100 text-amber-800 ring-1 ring-amber-300", headerBg: "bg-amber-600" },
  { key: "soir1", label: "Équipe Soir 1", short: "Soir 1", horaire: "16h – 22h",
    dot: "bg-indigo-500", activeBg: "bg-indigo-50", activeText: "text-indigo-800", activeBorder: "border-indigo-400",
    pillBg: "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300", headerBg: "bg-indigo-700" },
  { key: "soir2", label: "Équipe Soir 2", short: "Soir 2", horaire: "22h – 08h",
    dot: "bg-slate-600", activeBg: "bg-slate-800", activeText: "text-slate-100", activeBorder: "border-slate-600",
    pillBg: "bg-slate-800 text-slate-100 ring-1 ring-slate-600", headerBg: "bg-slate-800" },
];

const QUICK_FILTERS = [
  { key: "all" as StatusFilter, label: "Tous", dotColor: "bg-slate-400", activeDot: "bg-white" },
  { key: "ok" as StatusFilter, label: "OK", dotColor: "bg-emerald-400", activeDot: "bg-emerald-500" },
  { key: "absent" as StatusFilter, label: "Absents", dotColor: "bg-red-400", activeDot: "bg-red-500" },
  { key: "late" as StatusFilter, label: "Retards", dotColor: "bg-orange-400", activeDot: "bg-orange-500" },
  { key: "incomplete" as StatusFilter, label: "Incomplets", dotColor: "bg-amber-400", activeDot: "bg-amber-500" },
  { key: "anomaly" as StatusFilter, label: "Anomalies", dotColor: "bg-violet-400", activeDot: "bg-violet-500" },
  { key: "deficit" as StatusFilter, label: "Heures moins", dotColor: "bg-rose-400", activeDot: "bg-rose-500" },
];

const STATUS_CFG = {
  ok: { label: "OK", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  absent: { label: "Absent", dot: "bg-red-500", badge: "bg-red-50 text-red-700 ring-red-200" },
  incomplete: { label: "Incomplet", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  anomaly: { label: "Anomalie", dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 ring-violet-200" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function formatMinutes(min: number): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function computeLateMinutes(iso: string | null, thH: number, thM: number): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const t = d.getHours() * 60 + d.getMinutes(), th = thH * 60 + thM;
  return t > th ? t - th : 0;
}

function computeOvertimeMinutes(iso: string | null, thH: number, thM: number): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  const t = d.getHours() * 60 + d.getMinutes(), th = thH * 60 + thM;
  return t > th ? t - th : 0;
}

function computeWorkedMinutesFromTimes(inIso: string | null, outIso: string | null): number {
  if (!inIso || !outIso) return 0;
  const inD = new Date(inIso), outD = new Date(outIso);
  if (isNaN(inD.getTime()) || isNaN(outD.getTime())) return 0;
  const diff = (outD.getTime() - inD.getTime()) / 60000;
  return diff > 0 ? Math.round(diff) : 0;
}

function computeCompensation(lateMin: number, overtimeMin: number): CompensationResult {
  const compensated = Math.min(lateMin, overtimeMin), remaining = Math.max(0, lateMin - compensated);
  return { late_min: lateMin, overtime_min: overtimeMin, compensated_min: compensated,
    remaining_min: remaining, is_compensated: lateMin > 0 && remaining === 0, has_overtime: overtimeMin > 0 };
}

function computeDeficitMinutes(worked: number, expected: number): number {
  const exp = expected > 0 ? expected : MAX_WORKDAY_MIN;
  return worked > 0 ? Math.max(0, exp - worked) : 0;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoWeekNow(): string {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const w = Math.ceil((((date.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(w).padStart(2, "0")}`;
}

function exportCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename + ".csv"; a.click();
}

async function sendAlertEmail(emp: FlatRecord, motif: MotifType): Promise<{ success: boolean }> {
  await new Promise((r) => setTimeout(r, 500));
  return { success: !!emp.email };
}

// ─── Badges ───────────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: keyof typeof STATUS_CFG }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.anomaly;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{c.label}
    </span>
  );
}

function ShiftTeamPill({ teamKey }: { teamKey: ShiftTeamKey | null }) {
  if (!teamKey) return <span className="text-slate-300 text-xs">—</span>;
  const cfg = SHIFT_TEAMS.find((t) => t.key === teamKey);
  if (!cfg) return <span className="text-slate-400 text-xs">{teamKey}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.pillBg}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />{cfg.short}
    </span>
  );
}

function LateBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 ring-1 ring-orange-300 whitespace-nowrap">
      <Clock className="h-3 w-3 shrink-0" />RETARD · {formatMinutes(minutes)}
    </span>
  );
}

function OvertimeBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 whitespace-nowrap">
      <Clock className="h-3 w-3 shrink-0" />+{formatMinutes(minutes)}
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

function WorkedTimeBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <span className="text-slate-300 text-xs">—</span>;
  const color = minutes < MAX_WORKDAY_MIN ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 whitespace-nowrap ${color}`}>
      <Clock className="h-3 w-3 shrink-0" />{formatMinutes(minutes)}
    </span>
  );
}

function CompensationCell({ c }: { c: CompensationResult }) {
  if (c.late_min === 0) return <span className="text-slate-300 text-xs">—</span>;
  return c.is_compensated ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 whitespace-nowrap">✓ Compensé</span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 ring-1 ring-red-200 whitespace-nowrap">✗ Non compensé</span>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function AbsentsCard({ total, absent, loading, delay }: { total: number; absent: number; loading: boolean; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2.5 rounded-xl bg-red-500 text-white"><UserMinus className="h-5 w-5" /></div>
      </div>
      {loading ? (
        <div className="space-y-2 mt-1">
          <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Effectif total</span>
            <span className="text-base font-bold text-slate-800 tabular-nums">{total}</span>
          </div>
          <div className="w-full h-px bg-slate-100" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-600">Absents</span>
            <span className="text-base font-bold text-red-600 tabular-nums">{absent}</span>
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
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }} onClick={onClick}
      className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${onClick ? "cursor-pointer" : ""} ${active ? "border-orange-400 ring-2 ring-orange-200 shadow-md" : "border-slate-100 hover:shadow-md"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.icon}`}><Icon className="h-5 w-5" /></div>
        {active && <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full ring-1 ring-orange-200">Filtré</span>}
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

// ─── Modal : Work Hours ───────────────────────────────────────────────────────
function WorkHoursModal({ open, onClose, settings, onSave }: {
  open: boolean; onClose: () => void; settings: WorkHoursSettings; onSave: (s: WorkHoursSettings) => void;
}) {
  const [local, setLocal] = useState<WorkHoursSettings>(settings);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (open) { setLocal(settings); setSaved(false); } }, [open, settings]);

  const plannedMin = workDayMinutes(local);
  const exceedsMax = plannedMin > MAX_WORKDAY_MIN;
  const pad = (n: number) => String(n).padStart(2, "0");

  const handleSave = () => {
    onSave(local); setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-camublue-900" />
                <span className="font-semibold text-gray-900">Gestion des heures de travail</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Contexte / Libellé</label>
                <input type="text" value={local.context}
                  onChange={(e) => setLocal((p) => ({ ...p, context: e.target.value }))}
                  placeholder="ex: Ramadan, Été, Normal…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-camublue-900 focus:ring-2 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Plage horaire</label>
                <div className="grid grid-cols-2 gap-4">
                  {(["start", "end"] as const).map((k) => (
                    <div key={k} className="bg-slate-50 rounded-2xl p-4 space-y-2">
                      <p className="text-xs font-medium text-slate-500">{k === "start" ? "Heure d'entrée" : "Heure de sortie"}</p>
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} max={23}
                          value={k === "start" ? local.startH : local.endH}
                          onChange={(e) => setLocal((p) => ({ ...p, [k === "start" ? "startH" : "endH"]: Math.min(23, Math.max(0, +e.target.value)) }))}
                          className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-camublue-900" />
                        <span className="font-bold text-slate-400">:</span>
                        <input type="number" min={0} max={59}
                          value={k === "start" ? local.startM : local.endM}
                          onChange={(e) => setLocal((p) => ({ ...p, [k === "start" ? "startM" : "endM"]: Math.min(59, Math.max(0, +e.target.value)) }))}
                          className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-camublue-900" />
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        {pad(k === "start" ? local.startH : local.endH)}h{pad(k === "start" ? local.startM : local.endM)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Pause déjeuner</label>
                <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-medium text-slate-500">Durée de la pause (déduite du temps travaillé)</p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={180}
                        value={local.breakMin}
                        onChange={(e) => setLocal((p) => ({ ...p, breakMin: Math.min(180, Math.max(0, +e.target.value)) }))}
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-camublue-900" />
                      <span className="text-sm font-medium text-slate-500">min</span>
                    </div>
                    <div className="flex gap-1.5">
                      {[30, 45, 60, 90].map((v) => (
                        <button key={v} type="button"
                          onClick={() => setLocal((p) => ({ ...p, breakMin: v }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${local.breakMin === v ? "bg-camublue-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                          {v}min
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    {local.breakMin > 0 ? `−${formatMinutes(local.breakMin)} déduit` : "Aucune pause déduite"}
                  </p>
                </div>
              </div>
              <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-3 ${exceedsMax ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-blue-50 border border-blue-100 text-blue-700"}`}>
                {exceedsMax ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" /> : <Clock className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />}
                <div>
                  <p className="font-semibold">Durée effective : {formatMinutes(plannedMin) || "0 min"}</p>
                  {exceedsMax
                    ? <p className="text-xs mt-0.5">⚠️ Dépasse le maximum légal de <strong>8h/jour</strong>.</p>
                    : <p className="text-xs mt-0.5">
                        Retard après <strong>{pad(local.startH)}h{pad(local.startM)}</strong> — HS après <strong>{pad(local.endH)}h{pad(local.endM)}</strong>
                        {local.breakMin > 0 && <> — Pause <strong>{formatMinutes(local.breakMin)}</strong> déduite</>}
                      </p>}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition">Annuler</button>
              <button onClick={handleSave}
                className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 ${saved ? "bg-emerald-500 text-white" : "bg-camublue-900 hover:bg-camublue-800 text-white"}`}>
                {saved ? <><CheckCircle className="h-4 w-4" />Enregistré</> : "Enregistrer"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal : Détail hebdomadaire ──────────────────────────────────────────────
function DetailModal({ open, onClose, employeeId, initialWeek }: {
  open: boolean; onClose: () => void; employeeId: number | null; initialWeek: string;
}) {
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selWeek, setSelWeek] = useState(initialWeek);

  const weekBounds = (ws: string) => {
    const [y, wn] = ws.split("-W").map(Number);
    const fd = new Date(y, 0, 1);
    const fw = new Date(fd);
    fw.setDate(fw.getDate() + (wn - 1) * 7 - fw.getDay() + 1);
    const lw = new Date(fw); lw.setDate(lw.getDate() + 4);
    return { start: fw.toISOString().split("T")[0], end: lw.toISOString().split("T")[0] };
  };

  const fetchPointages = useCallback(async () => {
    if (!employeeId || !open) return;
    setLoading(true);
    try {
      const { start, end } = weekBounds(selWeek);
      const res: EmployeePeriodDetailResponse = await getEmployeePeriodDetail({ employee_id: employeeId, start, end });
      setPointages(
        ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"].map((day, i) => {
          const cur = new Date(start); cur.setDate(cur.getDate() + i);
          const ds = cur.toISOString().split("T")[0];
          const dd = res.days.find((d: DayDetail) => d.date === ds);
          return { day, date: ds, in_time: dd?.in_time ?? null, out_time: dd?.out_time ?? null, status: dd?.status ?? "absent" };
        })
      );
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [employeeId, selWeek, open]);

  useEffect(() => { fetchPointages(); }, [fetchPointages]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-camublue-900">Pointages hebdomadaires</h3>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition"><X className="h-5 w-5 text-slate-500" /></button>
            </div>
            <div className="px-4 sm:px-6 py-3 border-b border-slate-100 shrink-0">
              <label className="block text-sm font-medium text-slate-700 mb-1">Semaine (ex: 2026-W09)</label>
              <div className="flex gap-2">
                <input type="text" value={selWeek} onChange={(e) => setSelWeek(e.target.value)} placeholder="2026-W09"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                <button onClick={fetchPointages}
                  className="px-4 py-2 bg-camublue-900 text-white rounded-lg text-sm hover:bg-camublue-800 transition whitespace-nowrap">Charger</button>
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-10 w-10 border-4 border-camublue-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pointages.length > 0 ? (
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-5 gap-4 p-3 bg-slate-50 rounded-xl font-semibold text-slate-700 text-sm">
                    <span>Jour</span><span>Date</span><span>Statut</span><span>Entrée</span><span>Sortie</span>
                  </div>
                  {pointages.map((p, i) => (
                    <div key={i} className={`rounded-xl border p-3 ${p.status === "ok" ? "bg-white border-slate-100" : "bg-rose-50 border-rose-100"}`}>
                      <div className="hidden sm:grid grid-cols-5 gap-4">
                        <span className="font-medium text-slate-800 text-sm">{p.day}</span>
                        <span className="text-sm text-slate-600">{new Date(p.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                        <span><StatusPill status={p.status} /></span>
                        <span className={`text-sm ${p.in_time ? "text-slate-700" : "text-slate-400"}`}>{p.in_time ? formatTime(p.in_time) : "—"}</span>
                        <span className={`text-sm ${p.out_time ? "text-slate-700" : "text-slate-400"}`}>{p.out_time ? formatTime(p.out_time) : "—"}</span>
                      </div>
                      <div className="sm:hidden flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{p.day}</p>
                          <p className="text-xs text-slate-400">{new Date(p.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</p>
                        </div>
                        <StatusPill status={p.status} />
                        <div className="text-right text-xs font-mono text-slate-600">
                          <div>{p.in_time ? formatTime(p.in_time) : "—"}</div>
                          <div>{p.out_time ? formatTime(p.out_time) : "—"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <AlertTriangle className="h-10 w-10 mb-3 text-slate-300" />
                  <p>Aucun pointage trouvé.</p>
                </div>
              )}
            </div>
            <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
              <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-white bg-camublue-900 rounded-xl hover:bg-camublue-800 transition">Fermer</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal : Gestion Shifts ───────────────────────────────────────────────────
function GestionShiftsModal({ open, onClose, employees, assignments, onSave }: {
  open: boolean; onClose: () => void;
  employees: FlatRecord[];
  assignments: AssignmentMap; onSave: (map: AssignmentMap) => void;
}) {
  const [local, setLocal] = useState<AssignmentMap>({});
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState<ShiftTeamKey | "all">("all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const a: AssignmentMap = {};
      employees.forEach((r) => { if (r.matricule) a[r.matricule] = r.shift_team; });
      setLocal({ ...a, ...assignments });
      setSearch("");
      setFilterTeam("all");
    }
  }, [open, employees, assignments]);

  const assign = (mat: string, team: ShiftTeamKey) =>
    setLocal((prev) => ({ ...prev, [mat]: team }));

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    onSave(local);
    setSaving(false);
    onClose();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { jour: 0, soir1: 0, soir2: 0 };
    employees.forEach((r) => {
      const t = r.matricule ? (local[r.matricule] ?? r.shift_team) : null;
      if (t) c[t] = (c[t] ?? 0) + 1;
    });
    return c;
  }, [local, employees]);

  const filteredEmployees = useMemo(() => employees.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.full_name.toLowerCase().includes(q) ||
      r.matricule.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q);
    const assigned = r.matricule ? (local[r.matricule] ?? r.shift_team) : null;
    return matchSearch && (filterTeam === "all" ? true : assigned === filterTeam);
  }), [employees, search, filterTeam, local]);

  const changedCount = useMemo(() => {
    return Object.entries(local).filter(([mat, team]) => {
      const original = employees.find((r) => r.matricule === mat)?.shift_team ?? assignments[mat];
      return original !== team;
    }).length;
  }, [local, employees, assignments]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div className="relative w-full sm:max-w-2xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
            style={{ maxHeight: "calc(100dvh - 0px)" }}
            initial={{ y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-camublue-900 text-white"><Settings2 className="h-4 w-4" /></div>
                <div>
                  <p className="font-bold text-slate-800 text-sm sm:text-base">Gestion des Shifts</p>
                  <p className="text-xs text-slate-400 mt-0.5">{employees.length} employé{employees.length > 1 ? "s" : ""} en shift</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition"><X className="h-4 w-4 text-slate-500" /></button>
            </div>
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 shrink-0">
              <div className="grid grid-cols-3 gap-2">
                {SHIFT_TEAMS.map((t) => (
                  <button key={t.key}
                    onClick={() => setFilterTeam(filterTeam === t.key ? "all" : t.key)}
                    className={`flex flex-col items-center py-2 px-2 rounded-xl border-2 transition-all ${filterTeam === t.key ? `${t.activeBorder} ${t.activeBg} ${t.activeText}` : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full mb-1 ${t.dot}`} />
                    <span className="text-sm font-bold tabular-nums">{counts[t.key] ?? 0}</span>
                    <span className="text-[10px] sm:text-xs font-medium text-center leading-tight mt-0.5">{t.short}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
                  className="pl-8 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900 focus:outline-none" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Users className="h-10 w-10 mb-2 text-slate-200" />
                  <p className="text-sm">Aucun employé trouvé</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredEmployees.map((r) => {
                    const mat = r.matricule;
                    const current = local[mat] ?? r.shift_team;
                    return (
                      <div key={r.employee_id} className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50/80 transition-colors">
                        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                          <span className="text-xs sm:text-sm font-bold text-camublue-900">{r.full_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{r.full_name}</p>
                          <p className="text-xs text-slate-400 font-mono truncate">{mat}{r.department && r.department !== "—" ? ` · ${r.department}` : ""}</p>
                        </div>
                        <div className="hidden sm:block shrink-0"><StatusPill status={r.status} /></div>
                        <div className="flex items-center gap-1 shrink-0">
                          {SHIFT_TEAMS.map((t) => {
                            const isSelected = current === t.key;
                            return (
                              <button key={t.key} onClick={() => assign(mat, t.key)}
                                title={`${t.label} · ${t.horaire}`}
                                className={`h-7 px-1.5 sm:px-2 rounded-lg border-2 flex items-center gap-1 text-xs font-bold transition-all ${isSelected
                                  ? `${t.activeBorder} ${t.activeBg} ${t.activeText}`
                                  : "border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50"}`}>
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
            <div className="px-4 sm:px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/60">
              <div className="text-xs min-w-0">
                {changedCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-full ring-1 ring-amber-200 truncate">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />{changedCount} modif.
                  </span>
                ) : (
                  <span className="text-slate-400">Aucune modification</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={onClose} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition">Annuler</button>
                <button onClick={handleSave} disabled={saving || changedCount === 0}
                  className="px-4 py-2 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Enregistrement…</span></>
                    : <><Check className="h-4 w-4" /><span>Enregistrer</span></>}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal : Alerte ───────────────────────────────────────────────────────────
function AlertModal({ open, onClose, employee, onConfirm, sending }: {
  open: boolean; onClose: () => void; employee: FlatRecord | null;
  onConfirm: (m: MotifType) => void; sending: boolean;
}) {
  const [motif, setMotif] = useState<MotifType>("absent");
  useEffect(() => { if (employee) setMotif(employee.status === "absent" ? "absent" : "not_pointing"); }, [employee]);
  return (
    <AnimatePresence>
      {open && employee && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => !sending && onClose()}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-sm overflow-hidden z-10"
            initial={{ y: 40, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.97, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 sm:hidden"><div className="h-1 w-10 rounded-full bg-slate-200" /></div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-800">Envoyer une alerte</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px] sm:max-w-[230px]">
                  {employee.full_name}{employee.matricule && <span className="font-mono ml-1.5 text-slate-300">· {employee.matricule}</span>}
                </div>
              </div>
              <button onClick={onClose} disabled={sending} className="p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-40"><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${employee.email ? "bg-slate-50" : "bg-red-50 border border-red-100"}`}>
                <Mail className={`h-4 w-4 shrink-0 ${employee.email ? "text-slate-400" : "text-red-400"}`} />
                {employee.email
                  ? <span className="text-sm font-mono text-slate-700 truncate">{employee.email}</span>
                  : <span className="text-sm text-red-500 font-medium flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" />Aucun email</span>}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Motif</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMotif("absent")}
                    className={`flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${motif === "absent" ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <div className={`p-2 rounded-xl ${motif === "absent" ? "bg-red-100" : "bg-slate-100"}`}><UserMinus className="h-4 w-4" /></div>Absence
                  </button>
                  <button onClick={() => setMotif("not_pointing")}
                    className={`flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border-2 text-sm font-semibold transition-all ${motif === "not_pointing" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <div className={`p-2 rounded-xl ${motif === "not_pointing" ? "bg-amber-100" : "bg-slate-100"}`}><AlertTriangle className="h-4 w-4" /></div>Non pointage
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
                Un email sera envoyé à <strong>{employee.full_name}</strong> pour son{" "}
                <strong>{motif === "absent" ? "absence" : "non-pointage"}</strong> du{" "}
                {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}.
              </div>
            </div>
            <div className="px-5 pb-6 flex gap-3">
              <button onClick={onClose} disabled={sending}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">Annuler</button>
              <button onClick={() => onConfirm(motif)} disabled={sending || !employee.email}
                className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold transition flex items-center justify-center gap-2 ${!employee.email ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-camublue-900 hover:bg-camublue-800 text-white"} disabled:opacity-60`}>
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Envoyer</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── TableRow ─────────────────────────────────────────────────────────────────
function TableRow({ r, isLate, onAlert, onDetail }: {
  r: FlatRecord; isLate: boolean; onAlert: () => void; onDetail: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const deficit = r.deficit_minutes > 0;

  return (
    <>
      {/* Desktop */}
      <tr className={`hidden md:table-row border-b border-slate-100 transition-colors text-sm ${
        isLate ? "bg-orange-50/50 hover:bg-orange-50" : deficit ? "bg-rose-50/30 hover:bg-rose-50/60" : "hover:bg-slate-50"
      }`}>
        <td className="px-4 py-3"><div className="flex justify-center font-mono text-slate-500 text-xs">{r.matricule || "—"}</div></td>
        <td className="px-4 py-3"><div className="flex justify-center font-medium text-slate-800">{r.full_name}</div></td>
        <td className="px-4 py-3"><div className="flex justify-center text-slate-600 text-xs">{r.department}</div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><ShiftTeamPill teamKey={r.shift_team} /></div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><StatusPill status={r.status} /></div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><LateBadge minutes={r.computed_late_minutes} /></div></td>
        <td className="px-4 py-3">
          <div className={`flex justify-center tabular-nums font-mono text-sm ${r.computed_late_minutes > 0 ? "text-red-600 font-semibold" : "text-slate-700"}`}>
            {formatTime(r.in_time)}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className={`flex justify-center tabular-nums font-mono text-sm ${r.overtime_minutes > 0 ? "text-emerald-600 font-semibold" : "text-slate-700"}`}>
            {formatTime(r.out_time)}
          </div>
        </td>
        <td className="px-4 py-3"><div className="flex justify-center"><WorkedTimeBadge minutes={r.worked_minutes} /></div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><OvertimeBadge minutes={r.overtime_minutes} /></div></td>
        <td className="px-4 py-3"><div className="flex justify-center"><CompensationCell c={r.compensation} /></div></td>
        <td className="px-4 py-3">
          <div className="flex gap-2 justify-center">
            <button onClick={onAlert} disabled={r.status !== "absent" || !r.email}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                r.status === "absent" && r.email ? "bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer" : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`} title={!r.email ? "Email manquant" : ""}>
              <Bell className="h-3 w-3" />Alerter
            </button>
            <button onClick={onDetail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition">
              Détail
            </button>
          </div>
        </td>
      </tr>

      {/* Mobile card */}
      <tr className={`md:hidden border-b border-slate-100 ${isLate ? "bg-orange-50/40" : deficit ? "bg-rose-50/30" : ""}`}>
        <td colSpan={12} className="px-3 py-2">
          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm truncate">{r.full_name}</p>
              <p className="text-xs text-slate-400 font-mono">{r.matricule || "—"} · {r.department}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusPill status={r.status} />
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>
          {expanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <ShiftTeamPill teamKey={r.shift_team} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-400 mb-0.5">Entrée</p>
                  <p className={`font-mono font-semibold ${r.computed_late_minutes > 0 ? "text-red-600" : "text-slate-700"}`}>{formatTime(r.in_time)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-400 mb-0.5">Sortie</p>
                  <p className={`font-mono font-semibold ${r.overtime_minutes > 0 ? "text-emerald-600" : "text-slate-700"}`}>{formatTime(r.out_time)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-400 mb-0.5">Travaillé</p>
                  <p className="font-mono font-semibold text-slate-700">{r.worked_minutes > 0 ? formatMinutes(r.worked_minutes) : "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.computed_late_minutes > 0 && <LateBadge minutes={r.computed_late_minutes} />}
                {r.overtime_minutes > 0 && <OvertimeBadge minutes={r.overtime_minutes} />}
                {r.compensation.late_min > 0 && <CompensationCell c={r.compensation} />}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={onAlert} disabled={r.status !== "absent" || !r.email}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    r.status === "absent" && r.email ? "bg-red-50 hover:bg-red-100 text-red-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}>
                  <Bell className="h-3 w-3" />Alerter
                </button>
                <button onClick={onDetail}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-camublue-50 text-camublue-900 hover:bg-camublue-100 ring-1 ring-camublue-200 transition">
                  Détail
                </button>
              </div>
            </motion.div>
          )}
        </td>
      </tr>
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AttendanceShiftsPage() {
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<ShiftTeamKey | null>(null);
  const [shiftData, setShiftData] = useState<ShiftDailyStatsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [emailMap, setEmailMap] = useState<Map<string, string>>(new Map());
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<FlatRecord | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [gestionOpen, setGestionOpen] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentMap>({});
  const [workHours, setWorkHours] = useState<WorkHoursSettings>(DEFAULT_WORK_HOURS);
  const [workHoursOpen, setWorkHoursOpen] = useState(false);
  const [currentWeek] = useState(isoWeekNow());

  useEffect(() => {
    getEmployees().then((list: Employee[]) => {
      const m = new Map<string, string>();
      const a: AssignmentMap = {};
      list.forEach((e) => {
        if (e.matricule && e.email) m.set(e.matricule, e.email);
        if (e.matricule && (e as any).shift_team) a[e.matricule] = (e as any).shift_team;
      });
      setEmailMap(m);
      setAssignments(a);
    }).catch(console.error);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { date: string; team?: ShiftTeamKey } = { date: isoToday() };
      if (selectedTeam) params.team = selectedTeam;
      setShiftData(await getShiftDailyStats(params));
    } finally { setLoading(false); }
  }, [selectedTeam]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQ, shiftData, pageSize]);

  const allRecords = useMemo((): FlatRecord[] => {
    if (!shiftData) return [];
    return shiftData.records.map((r: ShiftRecord): FlatRecord => {
      const workedFromTimes = computeWorkedMinutesFromTimes(r.in_time, r.out_time);
      const workedMin = workedFromTimes > 0 ? workedFromTimes : (r.worked_minutes ?? 0);
      const lateMin = computeLateMinutes(r.in_time, workHours.startH, workHours.startM);
      const overtimeMin = computeOvertimeMinutes(r.out_time, workHours.endH, workHours.endM);
      return {
        employee_id: r.employee_id, matricule: r.matricule, full_name: r.full_name,
        department: r.department ?? "—", status: r.status,
        is_late_api: r.is_late, late_label_api: r.late_label,
        computed_late_minutes: lateMin, overtime_minutes: overtimeMin,
        compensation: computeCompensation(lateMin, overtimeMin),
        deficit_minutes: computeDeficitMinutes(workedMin, r.expected_minutes),
        in_time: r.in_time, out_time: r.out_time, worked_minutes: workedMin,
        expected_minutes: r.expected_minutes, email: emailMap.get(r.matricule) ?? null,
        shift_team: r.shift_team, shift_team_label: r.shift_team_label ?? "",
      };
    });
  }, [shiftData, emailMap, workHours]);

  const kpis = useMemo(() => {
    const total = allRecords.length;
    if (!shiftData) return { total: 0, absent: 0, late: 0, anomaly: 0 };
    return { total, absent: shiftData.kpis.absent,
      late: allRecords.filter((r) => r.computed_late_minutes > 0).length,
      anomaly: shiftData.kpis.anomalies };
  }, [shiftData, allRecords]);

  const isLateRecord = (r: FlatRecord) => r.computed_late_minutes > 0;

  const filtered = useMemo(() => allRecords.filter((r) => {
    if (statusFilter === "late") { if (!isLateRecord(r)) return false; }
    else if (statusFilter === "deficit") { if (r.deficit_minutes <= 0) return false; }
    else if (statusFilter !== "all") { if (r.status !== statusFilter) return false; }
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return r.full_name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) || (r.shift_team_label ?? "").toLowerCase().includes(q);
  }), [allRecords, statusFilter, searchQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const getPageNumbers = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
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
    setAlertModalOpen(false); setSelectedEmployee(null);
  };

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const activeTeamCfg = SHIFT_TEAMS.find((t) => t.key === selectedTeam);

  const tableHeaders = [
    "Matricule", "Nom", "Département", "Équipe", "Statut", "Retard",
    "Entrée", "Sortie", "Heure travaillée", "HS (>départ)", "Compensation", "Actions",
  ];

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6">

        {/* ── En-tête ── */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-start shrink-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-camublue-900">Pointages Shifts</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTeamCfg
                ? <span className="text-indigo-500 font-semibold">{activeTeamCfg.label} · {activeTeamCfg.horaire}</span>
                : <>Toutes les équipes — Contexte : <strong className="text-slate-600">{workHours.context}</strong> — Retard après <strong>{pad2(workHours.startH)}h{pad2(workHours.startM)}</strong> — HS après <strong>{pad2(workHours.endH)}h{pad2(workHours.endM)}</strong></>
              }
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
                placeholder="Nom, matricule, équipe…"
                className="pl-9 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-camublue-900 text-sm px-3 py-2 w-full sm:w-48 md:w-56 focus:outline-none" />
            </div>
            <button onClick={() => setWorkHoursOpen(true)}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition flex items-center gap-1.5 text-camublue-900 font-medium">
              <Settings className="h-4 w-4" /><span className="hidden sm:inline">Heures de travail</span>
            </button>
            <button onClick={() => setGestionOpen(true)}
              className="border-2 px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 bg-white border-camublue-900 text-camublue-900 hover:bg-camublue-900/5">
              <Settings2 className="h-4 w-4" /><span className="hidden sm:inline">Gestion Shifts</span>
            </button>
            <button onClick={() => exportCSV(`shift_${selectedTeam ?? "all"}_${isoToday()}`, filtered.map((r) => ({
              Matricule: r.matricule, Nom: r.full_name, Département: r.department,
              Équipe: r.shift_team_label || r.shift_team || "—", Statut: r.status,
              Retard: r.computed_late_minutes > 0 ? `RETARD · ${formatMinutes(r.computed_late_minutes)}` : "Non",
              Entrée: formatTime(r.in_time), Sortie: formatTime(r.out_time),
              "Heure travaillée": r.worked_minutes > 0 ? formatMinutes(r.worked_minutes) : "—",
              "HS": r.overtime_minutes > 0 ? formatMinutes(r.overtime_minutes) : "—",
              "Heures moins": r.deficit_minutes > 0 ? `−${formatMinutes(r.deficit_minutes)}` : "—",
              Email: r.email ?? "Manquant",
            })))}
              className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /><span className="hidden sm:inline">Exporter</span>
            </button>
            <button onClick={fetchData}
              className="bg-camublue-900 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-camublue-800 transition">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Rafraîchir</span>
            </button>
          </div>
        </div>

        {/* ── Sélecteur d'équipe ── */}
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          <button onClick={() => setSelectedTeam(null)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${
              selectedTeam === null ? "border-camublue-900 bg-camublue-900/10 text-camublue-900" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}>
            <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
            <span className="truncate text-xs sm:text-sm">Toutes</span>
          </button>
          {SHIFT_TEAMS.map((team) => {
            const isActive = selectedTeam === team.key;
            const kpiTeam = shiftData?.kpis.by_team?.[team.key];
            return (
              <button key={team.key} onClick={() => setSelectedTeam(isActive ? null : team.key)}
                className={`flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${
                  isActive ? `${team.activeBg} ${team.activeText} ${team.activeBorder}` : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <AbsentsCard total={kpis.total} absent={kpis.absent} loading={loading} delay={0.05} />
          <StatCard icon={Clock} label="Retards" value={kpis.late} color="orange" delay={0.1} loading={loading}
            active={statusFilter === "late"} sub="Cliquer pour filtrer"
            onClick={() => setStatusFilter((f) => (f === "late" ? "all" : "late"))} />
          <StatCard icon={AlertTriangle} label="Anomalies" value={kpis.anomaly} color="violet" delay={0.15} loading={loading} />
        </div>

        {/* ── Filtres rapides ── */}
        <div className="shrink-0 w-full overflow-x-auto">
          <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 border border-camublue-900/20 shadow-sm min-w-max">
            {QUICK_FILTERS.map((f) => {
              const isActive = statusFilter === f.key;
              const count = filterCount(f.key);
              return (
                <button key={f.key} onClick={() => { setStatusFilter(f.key); setPage(1); }}
                  className={`relative inline-flex flex-col items-center justify-center gap-0.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 ${
                    isActive ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                  }`}>
                  <span className="inline-flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? f.activeDot : f.dotColor}`} />
                    <span className="hidden sm:inline">{f.label}</span>
                    <span className="sm:hidden">{f.label.split(" ")[0]}</span>
                  </span>
                  <span className={`tabular-nums font-bold leading-none ${isActive ? "text-camublue-900" : "text-slate-400/70"}`}>{count}</span>
                </button>
              );
            })}
            {statusFilter !== "all" && (
              <>
                <div className="h-4 w-px bg-slate-300 mx-1 shrink-0" />
                <button onClick={() => setStatusFilter("all")}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-white/60 transition-all shrink-0">
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
              <thead className={`sticky top-0 z-10 text-white hidden md:table-header-group ${activeTeamCfg?.headerBg ?? "bg-camublue-900"}`}>
                <tr>
                  {tableHeaders.map((h) => (
                    <th key={h} className="px-4 py-3 text-center border-b border-white/20 text-sm font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <thead className={`sticky top-0 z-10 text-white md:hidden ${activeTeamCfg?.headerBg ?? "bg-camublue-900"}`}>
                <tr>
                  <th className="px-3 py-3 text-left text-sm font-semibold" colSpan={12}>
                    {activeTeamCfg ? activeTeamCfg.short : "Toutes les équipes"} — {filtered.length} employé{filtered.length > 1 ? "s" : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {[...Array(tableHeaders.length)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : pageData.length ? (
                  pageData.map((r) => (
                    <TableRow key={r.employee_id} r={r} isLate={isLateRecord(r)}
                      onAlert={() => { setSelectedEmployee(r); setAlertModalOpen(true); }}
                      onDetail={() => { setSelectedEmployeeId(r.employee_id); setDetailModalOpen(true); }} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={tableHeaders.length} className="text-center py-12 text-slate-400 text-sm">
                      {statusFilter === "late" ? "Aucun retard." : statusFilter === "deficit" ? "Aucune heure manquante." : "Aucun enregistrement trouvé."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm text-slate-500">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / <strong className="text-slate-700">{filtered.length}</strong>
                  {statusFilter === "late" && <span className="ml-1.5 text-orange-600 font-semibold">· Retards</span>}
                  {statusFilter === "deficit" && <span className="ml-1.5 text-rose-600 font-semibold">· Manquantes</span>}
                </span>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                  <span className="text-xs text-slate-400">Lignes :</span>
                  <div className="flex items-center gap-0.5">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <button key={size} onClick={() => { setPageSize(size); setPage(1); }}
                        className={`min-w-[28px] h-6 rounded text-xs font-semibold transition-all ${pageSize === size ? "bg-camublue-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><FaAngleDoubleLeft size={12} /></button>
                <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="h-4 w-4" /></button>
                <div className="flex items-center gap-0.5 mx-1">
                  {getPageNumbers().map((p, i) =>
                    p === "..." ? (
                      <span key={`e-${i}`} className="px-1 text-slate-400 text-sm">…</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p as number)}
                        className={`min-w-[28px] sm:min-w-[32px] h-7 sm:h-8 rounded-md text-xs sm:text-sm font-medium transition-colors ${page === p ? "bg-camublue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
                        {p}
                      </button>
                    )
                  )}
                </div>
                <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="h-4 w-4" /></button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"><FaAngleDoubleRight size={12} /></button>
              </div>
            </div>
          )}
        </div>

        {/* ── Modals ── */}
        <WorkHoursModal open={workHoursOpen} onClose={() => setWorkHoursOpen(false)}
          settings={workHours} onSave={(s) => { setWorkHours(s); setWorkHoursOpen(false); }} />

        <GestionShiftsModal
          open={gestionOpen}
          onClose={() => setGestionOpen(false)}
          employees={allRecords}
          assignments={assignments}
          onSave={(map) => { setAssignments(map); fetchData(); }}
        />

        <DetailModal open={detailModalOpen} onClose={() => setDetailModalOpen(false)}
          employeeId={selectedEmployeeId} initialWeek={currentWeek} />

        <AlertModal open={alertModalOpen} onClose={() => setAlertModalOpen(false)}
          employee={selectedEmployee} onConfirm={handleSendAlert} sending={sendingAlert} />
      </motion.div>
    </AppLayout>
  );
}