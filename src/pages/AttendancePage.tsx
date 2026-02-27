import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppLayout from "@/layouts/AppLayout";
import {
  Users, UserX, Clock, AlertTriangle, UserMinus,
  Filter, FileSpreadsheet, X, ChevronLeft, ChevronRight,
  Search, CalendarDays, RefreshCw, CheckCircle2
} from "lucide-react";

import {
  getDailyStats,
  getWeeklyStats,
  getMonthlyStats,
} from "@/services/attendanceService";

import type {
  DailyStatsResponse,
  WeeklyStatsResponse,
  MonthlyStatsResponse,
} from "@/types/attendance";

type ViewMode = "daily" | "weekly" | "monthly";
type StatusFilter = "all" | "ok" | "absent" | "incomplete" | "anomaly" | "late";

interface FlatRecord {
  employee_id: number;
  matricule: string;
  full_name: string;
  department: string;
  status: "ok" | "absent" | "incomplete" | "anomaly";
  is_late: boolean;
  late_label: string | null;
  late_minutes: number;
  in_time: string | null;
  out_time: string | null;
  delta_minutes: number;
  worked_minutes: number;
  expected_minutes: number;
}

function formatTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function minutesToSigned(min: number): string {
  const v = Math.round(min || 0);
  const sign = v < 0 ? "−" : "+";
  const abs = Math.abs(v);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${String(m).padStart(2, "0")}`;
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoWeekNow(): string {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function yyyyMmToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function exportXLSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename + ".csv";
  a.click();
}

const STATUS_CFG = {
  ok:         { label: "OK",         dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  absent:     { label: "Absent",     dot: "bg-red-500",     badge: "bg-red-50 text-red-700 ring-red-200" },
  incomplete: { label: "Incomplet",  dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  anomaly:    { label: "Anomalie",   dot: "bg-violet-500",  badge: "bg-violet-50 text-violet-700 ring-violet-200" },
};

function StatusPill({ status }: { status: keyof typeof STATUS_CFG }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.anomaly;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function LatePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 ring-1 ring-orange-200">
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  bg: string;
  active?: boolean;
  onClick?: () => void;
}

function KpiCard({ icon, label, value, color, bg, active, onClick }: KpiCardProps) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-4 border transition-all duration-200 ${
        active
          ? `${bg} border-transparent shadow-md ring-2 ring-offset-1 ${color.replace("text-", "ring-")}`
          : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      <div className={`inline-flex p-2 rounded-xl ${bg} mb-3`}>
        <span className={color}>{icon}</span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${active ? color : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1 font-medium">{label}</div>
    </motion.button>
  );
}

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  date: string;
  setDate: (v: string) => void;
  week: string;
  setWeek: (v: string) => void;
  month: string;
  setMonth: (v: string) => void;
  onApply: () => void;
}

function FilterModal({
  open, onClose, viewMode, setViewMode,
  date, setDate, week, setWeek, month, setMonth, onApply
}: FilterModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
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

            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Affichage</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { k: "daily", label: "Journalier", icon: "📅" },
                    { k: "weekly", label: "Hebdomadaire", icon: "📆" },
                    { k: "monthly", label: "Mensuel", icon: "🗓️" },
                  ] as { k: ViewMode; label: string; icon: string }[]).map((v) => (
                    <button
                      key={v.k}
                      onClick={() => setViewMode(v.k)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 text-xs font-semibold transition-all ${
                        viewMode === v.k
                          ? "border-camublue-900 bg-camublue-900/10 text-camublue-900"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-xl">{v.icon}</span>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Période</p>
                {viewMode === "daily" && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Date</label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-camublue-900 focus:ring-camublue-900"
                    />
                  </div>
                )}
                {viewMode === "weekly" && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Semaine (ex: 2026-W09)</label>
                    <Input
                      value={week}
                      onChange={(e) => setWeek(e.target.value)}
                      placeholder="2026-W09"
                      className="rounded-xl border-gray-200 focus:border-camublue-900 focus:ring-camublue-900"
                    />
                  </div>
                )}
                {viewMode === "monthly" && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Mois</label>
                    <Input
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-camublue-900 focus:ring-camublue-900"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose}>
                Annuler
              </Button>
              <Button
                className="flex-1 rounded-2xl bg-camublue-900 hover:bg-camublue-900/90 text-white"
                onClick={() => { onApply(); onClose(); }}
              >
                Appliquer
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── PAGE_SIZE
const PAGE_SIZE = 10;

export default function AttendancePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [date, setDate] = useState(isoToday());
  const [week, setWeek] = useState(isoWeekNow());
  const [month, setMonth] = useState(yyyyMmToday());

  const [daily, setDaily] = useState<DailyStatsResponse | null>(null);
  const [weekly, setWeekly] = useState<WeeklyStatsResponse | null>(null);
  const [monthly, setMonthly] = useState<MonthlyStatsResponse | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "daily") setDaily(await getDailyStats(date));
      if (viewMode === "weekly") setWeekly(await getWeeklyStats(week));
      if (viewMode === "monthly") setMonthly(await getMonthlyStats(month));
    } finally {
      setLoading(false);
    }
  }, [viewMode, date, week, month]);

  useEffect(() => { fetchData(); }, [viewMode]);
  useEffect(() => { setPage(1); }, [statusFilter, searchQ, viewMode, daily, weekly, monthly]);

  const allRecords = useMemo((): FlatRecord[] => {
    if (viewMode === "daily" && daily) {
      return daily.records.map((r) => ({
        employee_id: r.employee_id,
        matricule: r.matricule ?? "",
        full_name: r.full_name,
        department: r.department ?? "—",
        status: r.status,
        is_late: r.is_late,
        late_label: r.late_label,
        late_minutes: r.late_minutes,
        in_time: r.in_time ?? null,
        out_time: r.out_time ?? null,
        delta_minutes: r.delta_minutes,
        worked_minutes: r.worked_minutes,
        expected_minutes: r.expected_minutes,
      }));
    }
    if (viewMode === "weekly" && weekly) {
      return weekly.by_employee.map((r: any) => ({
        employee_id: r.employee_id,
        matricule: r.matricule ?? "",
        full_name: r.full_name ?? `${r.nom ?? ""} ${r.prenom ?? ""}`.trim(),
        department: r.service ?? "—",
        status: r.absent_days > 0 ? "absent" : r.incomplete_days > 0 ? "incomplete" : "ok",
        is_late: (r.late_days ?? 0) > 0,
        late_label: (r.late_days ?? 0) > 0 ? `${r.late_days}j · moy ${r.avg_late_minutes}min` : null,
        late_minutes: r.total_late_minutes ?? 0,
        in_time: null,
        out_time: null,
        delta_minutes: r.delta_minutes,
        worked_minutes: r.worked_minutes,
        expected_minutes: r.expected_minutes,
      }));
    }
    if (viewMode === "monthly" && monthly) {
      return monthly.by_employee.map((r: any) => ({
        employee_id: r.employee_id,
        matricule: r.matricule ?? "",
        full_name: r.full_name ?? `${r.nom ?? ""} ${r.prenom ?? ""}`.trim(),
        department: r.service ?? "—",
        status: r.absent_days > 0 ? "absent" : r.incomplete_days > 0 ? "incomplete" : "ok",
        is_late: (r.late_days ?? 0) > 0,
        late_label: (r.late_days ?? 0) > 0 ? `${r.late_days}j · moy ${r.avg_late_minutes}min` : null,
        late_minutes: r.total_late_minutes ?? 0,
        in_time: null,
        out_time: null,
        delta_minutes: r.delta_minutes,
        worked_minutes: r.worked_minutes,
        expected_minutes: r.expected_minutes,
      }));
    }
    return [];
  }, [viewMode, daily, weekly, monthly]);

  const kpis = useMemo(() => {
    if (viewMode === "daily" && daily) {
      return {
        present: daily.kpis.present,
        absent: daily.kpis.absent,
        late: daily.kpis.late,
        anomaly: daily.kpis.anomalies,
        not_pointing: daily.kpis.not_pointing,
      };
    }
    if (viewMode === "weekly" && weekly) {
      const emp = weekly.by_employee as any[];
      return {
        present: emp.filter(r => r.present_days > 0).length,
        absent: emp.filter(r => r.absent_days > 0).length,
        late: emp.filter(r => (r.late_days ?? 0) > 0).length,
        anomaly: emp.filter(r => r.anomaly_days > 0).length,
        not_pointing: emp.filter(r => r.not_pointing_days > 0).length,
      };
    }
    if (viewMode === "monthly" && monthly) {
      const emp = monthly.by_employee as any[];
      return {
        present: emp.filter(r => r.present_days > 0).length,
        absent: emp.filter(r => r.absent_days > 0).length,
        late: emp.filter(r => (r.late_days ?? 0) > 0).length,
        anomaly: emp.filter(r => r.anomaly_days > 0).length,
        not_pointing: emp.filter(r => r.not_pointing_days > 0).length,
      };
    }
    return { present: 0, absent: 0, late: 0, anomaly: 0, not_pointing: 0 };
  }, [viewMode, daily, weekly, monthly]);

  const filtered = useMemo(() => {
    return allRecords.filter(r => {
      if (statusFilter !== "all" && (statusFilter === "late" ? !r.is_late : r.status !== statusFilter)) return false;
      if (!searchQ) return true;
      const q = searchQ.toLowerCase();
      return r.full_name.toLowerCase().includes(q) || r.matricule.toLowerCase().includes(q) || r.department.toLowerCase().includes(q);
    });
  }, [allRecords, statusFilter, searchQ]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppLayout>
      <div className="relative bg-gray-50/60 p-5 space-y-5">

        {/* ── Header + KPI + Toolbar ── */}
        <div className="sticky top-0 z-20 bg-gray-50/60 backdrop-blur-md p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Pointage Employés</h1>
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir</Button>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={<Users />} label="Présents" value={kpis.present} color="text-emerald-500" bg="bg-emerald-50" />
            <KpiCard icon={<UserMinus />} label="Absents" value={kpis.absent} color="text-red-500" bg="bg-red-50" />
            <KpiCard icon={<Clock />} label="Retardataires" value={kpis.late} color="text-orange-500" bg="bg-orange-50" />
            <KpiCard icon={<AlertTriangle />} label="Anomalies" value={kpis.anomaly} color="text-violet-500" bg="bg-violet-50" />
            <KpiCard icon={<FileSpreadsheet />} label="Non pointés" value={kpis.not_pointing} color="text-gray-500" bg="bg-gray-50" />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Rechercher par nom, matricule, département…"
                className="pl-10 h-11 rounded-2xl border-gray-200 bg-white text-sm focus:border-camublue-900 focus:ring-camublue-900 w-full"
              />
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <Button variant="outline" onClick={() => setFilterOpen(true)}><Filter className="h-4 w-4 mr-1" /> Filtrer</Button>
              <Button variant="outline" onClick={() => exportXLSV("pointage", filtered)}><FileSpreadsheet className="h-4 w-4 mr-1" /> Exporter</Button>
            </div>
          </div>
        </div>

        {/* ── Table scrollable ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
          <table className="min-w-full text-sm">
           <thead className="bg-white sticky top-0 z-10">
  <tr>
    <th className="px-4 py-3 border-b border-camublue-800 text-sm font-semibold text-camublue-900">Matricule</th>
    <th className="px-4 py-3 border-b border-camublue-800 text-sm font-semibold text-camublue-900">Nom</th>
    <th className="px-4 py-3 border-b border-camublue-800 text-sm font-semibold text-camublue-900">Département</th>
    <th className="px-4 py-3 border-b border-camublue-800 text-sm font-semibold text-camublue-900">Statut</th>
    <th className="px-4 py-3 border-b border-camublue-800 text-sm font-semibold text-camublue-900">Retard</th>
    <th className="px-4 py-3 border-b border-camublue-800 text-sm font-semibold text-camublue-900">Entrée</th>
    <th className="px-4 py-3 border-b border-camublue-800 text-sm font-semibold text-camublue-900">Sortie</th>
    <th className="px-4 py-3 border-b border-camublue-800 text-sm font-semibold text-camublue-900">Ecart</th>
  </tr>
</thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">Chargement…</td>
                </tr>
              ) : pageData.length ? (
                pageData.map((r) => (
                  <tr key={r.employee_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">{r.matricule}</td>
                    <td className="px-4 py-3">{r.full_name}</td>
                    <td className="px-4 py-3">{r.department}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-3">{r.is_late && r.late_label ? <LatePill label={r.late_label} /> : "—"}</td>
                    <td className="px-4 py-3">{formatTime(r.in_time)}</td>
                    <td className="px-4 py-3">{formatTime(r.out_time)}</td>
                    <td className="px-4 py-3">{minutesToSigned(r.delta_minutes)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8">Aucun enregistrement</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {filtered.length > 7 && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500">Page {page} / {totalPages}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Filter Modal */}
        <FilterModal
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          viewMode={viewMode}
          setViewMode={setViewMode}
          date={date}
          setDate={setDate}
          week={week}
          setWeek={setWeek}
          month={month}
          setMonth={setMonth}
          onApply={fetchData}
        />
      </div>
    </AppLayout>
  );
}