  import { useEffect, useMemo, useState } from "react";
  import { motion, AnimatePresence } from "framer-motion";
  import { Card, CardContent } from "@/components/ui/card";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { AlertCircle, CalendarDays, RefreshCw, Users, X } from "lucide-react";
  import { Cell, Legend } from "recharts";

  import {
    getDailyStats,
    getWeeklyStats,
    getMonthlyStats,
    getEmployeePeriodDetail,
  } from "@/services/attendanceService";

  import type {
    DailyStatsResponse,
    WeeklyStatsResponse,
    MonthlyStatsResponse,
    PeriodEmployeeRow,
    EmployeePeriodDetailResponse,
  } from "@/types/attendance";

  import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
  } from "recharts";

  type StatusFilter = "all" | "ok" | "absent" | "incomplete" | "anomaly";
  type TopMode = "most_worked" | "least_worked" | "absent" | "not_pointing";
  type PeriodTopMode = "most_worked" | "least_worked";
  type PeriodSortKey = "worked" | "name" | "service";

  const STATUS_STYLE: Record<
    "ok" | "absent" | "incomplete" | "anomaly",
    { badge: string; dot: string; label: string }
  > = {
    ok: {
      badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      dot: "bg-emerald-500",
      label: "OK",
    },
    absent: {
      badge: "bg-red-50 text-red-700 ring-1 ring-red-200",
      dot: "bg-red-500",
      label: "Absent",
    },
    incomplete: {
      badge: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
      dot: "bg-amber-500",
      label: "Incomplet",
    },
    anomaly: {
      badge: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
      dot: "bg-purple-500",
      label: "Anomalie",
    },
  };

  function StatusBadge({ status }: { status: "ok" | "absent" | "incomplete" | "anomaly" }) {
    const s = STATUS_STYLE[status] ?? STATUS_STYLE.anomaly;
    return (
      <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg font-medium ${s.badge}`}>
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  }


  const PIE_COLORS = ["#2563eb", "#ef4444", "#f59e0b", "#a855f7"];
  const BAR_COLORS = ["#2563eb", "#06b6d4", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];

  function minutesToHHMM(min: number) {
    const h = Math.floor((min || 0) / 60);
    const m = (min || 0) % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
  }

  function downloadCSV(filename: string, rows: Record<string, any>[]) {
    if (!rows.length) return;

    const headers = Object.keys(rows[0]);
    const esc = (v: any) => {
      const s = String(v ?? "");
      const needs = /[",\n]/.test(s);
      const out = s.replaceAll('"', '""');
      return needs ? `"${out}"` : out;
    };

    const csv = [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function isoToday() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function yyyyMmToday() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${mm}`;
  }

  function isoWeekNow() {
    const d = new Date();
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

 

  function formatTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";

  // 24h garanti
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}


function minutesToSignedHHMM(min: number) {
  const v = Math.round(min || 0);
  const sign = v < 0 ? "-" : "+";
  const abs = Math.abs(v);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}


  function getFunctionLabel(r: any) {
    return r.fonction || r.position || r.job_title || r.poste || "-";
  }

  function ProgressExpected({
    workedHours,
    expectedHours,
    label,
  }: {
    workedHours: number;
    expectedHours: number;
    label?: string;
  }) {
    const base = expectedHours > 0 ? expectedHours : 40;
    const pct = Math.max(0, Math.min(100, (workedHours / base) * 100));
    const ok = workedHours >= base;

    return (
      <div className="w-full">
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            className={`h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-camublue-900"}`}
          />
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          {workedHours.toFixed(1)}h / {base.toFixed(0)}h {ok ? "✅" : ""} {label ? `· ${label}` : ""}
        </div>
      </div>
    );
  }

  export default function AttendancePage() {
    const [tab, setTab] = useState<"daily" | "weekly" | "monthly">("daily");
    const [loading, setLoading] = useState(false);

    const [date, setDate] = useState(isoToday());
    const [week, setWeek] = useState(isoWeekNow());
    const [month, setMonth] = useState(yyyyMmToday());

    const [daily, setDaily] = useState<DailyStatsResponse | null>(null);
    const [weekly, setWeekly] = useState<WeeklyStatsResponse | null>(null);
    const [monthly, setMonthly] = useState<MonthlyStatsResponse | null>(null);

    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [q, setQ] = useState("");
    const [topMode, setTopMode] = useState<TopMode>("most_worked");
    const [topN, setTopN] = useState(10);

    // weekly/monthly table controls
    const [periodTopMode, setPeriodTopMode] = useState<PeriodTopMode>("most_worked");
    const [periodTopN, setPeriodTopN] = useState(10);
    const [periodQ, setPeriodQ] = useState("");
    const [periodService, setPeriodService] = useState("all");
    const [periodSort, setPeriodSort] = useState<PeriodSortKey>("worked");
    const [periodPage, setPeriodPage] = useState(1);
    const [periodPageSize, setPeriodPageSize] = useState(20);

    // modal detail
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailErr, setDetailErr] = useState<string | null>(null);
    const [detailData, setDetailData] = useState<EmployeePeriodDetailResponse | null>(null);
    const [detailOnlyIssues, setDetailOnlyIssues] = useState(true);

    const fetchData = async () => {
      setLoading(true);
      try {
        if (tab === "daily") setDaily(await getDailyStats(date));
        if (tab === "weekly") setWeekly(await getWeeklyStats(week));
        if (tab === "monthly") setMonthly(await getMonthlyStats(month));
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchData();
      // eslint-disable-next-line
    }, [tab]);

    // reset pagination when filters change
    useEffect(() => {
      setPeriodPage(1);
    }, [periodQ, periodService, periodSort, tab, weekly, monthly]);

    // DAILY filtered (important: la table doit utiliser dailyFiltered/toHandleList)
    const dailyFiltered = useMemo(() => {
      const recs = daily?.records ?? [];
      const ql = q.trim().toLowerCase();

      return recs.filter((r) => {
        const okStatus = statusFilter === "all" ? true : r.status === statusFilter;
        const text = [r.full_name, r.matricule, r.department].filter(Boolean).join(" ").toLowerCase();
        const okQ = !ql ? true : text.includes(ql);
        return okStatus && okQ;
      });
    }, [daily, statusFilter, q]);

    const toHandleList = useMemo(() => {
      return dailyFiltered.filter(
        (r) => r.status === "absent" || r.status === "incomplete" || r.status === "anomaly"
      );
    }, [dailyFiltered]);

    // Pie daily
    const pieDaily = useMemo(() => {
      if (!daily) return [];
      return [
        { name: "Présents", value: daily.kpis.present },
        { name: "Absents", value: daily.kpis.absent },
        { name: "Incomplets", value: daily.kpis.incomplete },
        { name: "Anomalies", value: daily.kpis.anomalies },
      ];
    }, [daily]);

    // daily top chart
    const topEmployeesData = useMemo(() => {
      const recs = daily?.records ?? [];
      const nameOf = (r: any) => r.full_name || r.matricule || String(r.employee_id);

      if (topMode === "absent") {
        return recs.filter(r => r.status === "absent").slice(0, topN).map(r => ({ name: nameOf(r), value: 1, label: "Absent" }));
      }
      if (topMode === "not_pointing") {
        return recs.filter(r => r.status === "absent" || r.status === "incomplete").slice(0, topN).map(r => ({ name: nameOf(r), value: 1, label: r.status }));
      }

      const presentLike = recs.filter(r => r.status !== "absent");
      const sorted = [...presentLike].sort((a, b) => (a.worked_minutes || 0) - (b.worked_minutes || 0));
      const picked = topMode === "least_worked" ? sorted.slice(0, topN) : sorted.slice(-topN).reverse();

      return picked.map(r => ({
        name: nameOf(r),
        value: Math.round(((r.worked_minutes || 0) / 60) * 10) / 10,
        label: minutesToHHMM(r.worked_minutes || 0),
      }));
    }, [daily, topMode, topN]);

    // PERIOD rows
    const periodRows: PeriodEmployeeRow[] = useMemo(() => {
      if (tab === "weekly") return (weekly?.by_employee ?? []) as any;
      if (tab === "monthly") return (monthly?.by_employee ?? []) as any;
      return [];
    }, [tab, weekly, monthly]);

    const periodServices = useMemo(() => {
      const set = new Set<string>();
      for (const r of periodRows) {
        const s = (r.service || "").trim();
        if (s) set.add(s);
      }
      return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [periodRows]);

    const periodEmployees = useMemo(() => {
      const ql = periodQ.trim().toLowerCase();

      let out = periodRows.filter((r: any) => {
        const okService =
          periodService === "all"
            ? true
            : String(r.service || "").toLowerCase() === String(periodService).toLowerCase();

        const text = `${r.matricule ?? ""} ${r.nom ?? ""} ${r.prenom ?? ""} ${r.service ?? ""} ${getFunctionLabel(r)}`.toLowerCase();
        const okQ = !ql ? true : text.includes(ql);
        return okService && okQ;
      });

      out = [...out].sort((a: any, b: any) => {
        if (periodSort === "worked") return (b.worked_minutes || 0) - (a.worked_minutes || 0);
        if (periodSort === "service") return String(a.service || "").localeCompare(String(b.service || ""));
        return `${a.nom ?? ""} ${a.prenom ?? ""}`.localeCompare(`${b.nom ?? ""} ${b.prenom ?? ""}`);
      });

      return out;
    }, [periodRows, periodQ, periodService, periodSort]);

    const periodTopData = useMemo(() => {
      const sorted = [...periodEmployees].sort((a: any, b: any) => (a.worked_minutes || 0) - (b.worked_minutes || 0));
      const picked = periodTopMode === "least_worked" ? sorted.slice(0, periodTopN) : sorted.slice(-periodTopN).reverse();

      return picked.map((r: any) => ({
        name: `${r.nom ?? ""} ${r.prenom ?? ""}`.trim() || r.matricule || String(r.employee_id),
        value: Math.round(((r.worked_minutes || 0) / 60) * 10) / 10,
        label: minutesToHHMM(r.worked_minutes || 0),
      }));
    }, [periodEmployees, periodTopMode, periodTopN]);

    // weekly by_day chart label with weekday
    const barWeekly = useMemo(() => {
      if (!weekly) return [];
      return weekly.by_day.map((d: any) => ({
        label: `${(d.weekday_label || "").slice(0, 3)} ${d.date.slice(5)}`,
        worked_h: Math.round((d.worked_minutes / 60) * 10) / 10,
        expected_h: Math.round((d.expected_minutes / 60) * 10) / 10,
        not_pointing: d.not_pointing_count ?? 0,
      }));
    }, [weekly]);

    const barMonthly = useMemo(() => {
      if (!monthly) return [];
      return monthly.by_week.map((w: any) => ({
        week: w.week,
        worked_h: Math.round((w.worked_minutes / 60) * 10) / 10,
        expected_h: Math.round((w.expected_minutes / 60) * 10) / 10,
      }));
    }, [monthly]);

    // pagination for period table
    const periodTotal = periodEmployees.length;
    const periodTotalPages = Math.max(1, Math.ceil(periodTotal / periodPageSize));
    const periodPageSafe = Math.min(periodPage, periodTotalPages);
    const periodSlice = useMemo(() => {
      const start = (periodPageSafe - 1) * periodPageSize;
      const end = start + periodPageSize;
      return periodEmployees.slice(start, end);
    }, [periodEmployees, periodPageSafe, periodPageSize]);

    const openDetail = async (employee_id: number) => {
      const start = tab === "weekly" ? weekly?.start : monthly?.start;
      const end = tab === "weekly" ? weekly?.end : monthly?.end;
      if (!start || !end) return;

      setDetailErr(null);
      setDetailData(null);
      setDetailOpen(true);
      setDetailLoading(true);
      try {
        const data = await getEmployeePeriodDetail({ employee_id, start, end });
        setDetailData(data);
      } catch (e: any) {
        setDetailErr(e?.message || "Erreur chargement détail");
      } finally {
        setDetailLoading(false);
      }
    };

    const detailDays = useMemo(() => {
      const days = detailData?.days ?? [];
      if (!detailOnlyIssues) return days;
      return days.filter((d: any) => d.status === "absent" || d.status === "incomplete" || d.status === "anomaly");
    }, [detailData, detailOnlyIssues]);

    return (
      <div className="p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-camublue-900/10 flex items-center justify-center">
              <CalendarDays className="text-camublue-900" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-camublue-900">Pointages</h2>
              <p className="text-gray-500">Suivi simple et visuel : daily, weekly (40h) et monthly.</p>
            </div>
            <div className="flex-1" />
            <Button onClick={fetchData} className="rounded-xl bg-camublue-900 text-white hover:bg-camublue-900/90" disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { k: "daily", label: "Daily" },
            { k: "weekly", label: "Weekly" },
            { k: "monthly", label: "Monthly" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={`px-4 py-2 rounded-xl font-medium border transition ${
                tab === t.k
                  ? "bg-camublue-900 text-white border-camublue-900 shadow"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-camublue-900/10 hover:text-camublue-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card className="rounded-2xl border-gray-200">
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
            {tab === "daily" && (
              <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Date</span>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[180px]" />
                  <Button variant="outline" className="rounded-xl" onClick={fetchData} disabled={loading}>
                    Appliquer
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                  >
                    <option value="all">Tous</option>
                    <option value="ok">OK</option>
                    <option value="absent">Absent</option>
                    <option value="incomplete">Incomplete</option>
                    <option value="anomaly">Anomaly</option>
                  </select>

                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Rechercher (nom, matricule, dept...)"
                    className="w-[280px]"
                  />

                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      const rows = dailyFiltered.map((r) => ({
                        date: r.work_date,
                        jour: r.weekday_label ?? "",
                        matricule: r.matricule ?? "",
                        nom: r.full_name ?? "",
                        department: r.department ?? "",
                        status: r.status,
                        in: r.in_time ? formatTime(r.in_time) : "",
                        out: r.out_time ? formatTime(r.out_time) : "",
                        worked_h: ((r.worked_minutes ?? 0) / 60).toFixed(2),
                        expected_h: ((r.expected_minutes ?? 0) / 60).toFixed(2),
                        delta_minutes: r.delta_minutes ?? 0,
                      }));
                      downloadCSV(`pointage_${date}_${statusFilter}.csv`, rows);
                    }}
                    disabled={!dailyFiltered.length}
                  >
                    Export CSV
                  </Button>
                </div>

                <div className="flex-1" />
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{dailyFiltered.length} ligne(s) (filtrées)</span>
                </div>
              </div>
            )}

            {tab === "weekly" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Semaine</span>
                <Input value={week} onChange={(e) => setWeek(e.target.value)} className="w-[160px]" placeholder="2026-W02" />
                <Button variant="outline" className="rounded-xl" onClick={fetchData} disabled={loading}>
                  Appliquer
                </Button>
                <span className="text-xs text-gray-400">Format: YYYY-Www</span>
              </div>
            )}

            {tab === "monthly" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Mois</span>
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[180px]" />
                <Button variant="outline" className="rounded-xl" onClick={fetchData} disabled={loading}>
                  Appliquer
                </Button>
              </div>
            )}

            <div className="flex-1" />
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Vue synthèse + anomalies actionnables</span>
            </div>
          </CardContent>
        </Card>

        {/* DAILY */}
        {tab === "daily" && daily && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Kpi title="Présents" value={daily.kpis.present} hint={`le ${daily.date} · ${daily.weekday_label ?? ""}`} />
              <Kpi title="Absents" value={daily.kpis.absent} hint="pas de IN/OUT" />
              <Kpi title="Incomplets" value={daily.kpis.incomplete} hint="IN ou OUT manquant" />
              <Kpi title="Retard moyen" value={`${daily.kpis.avg_late_minutes} min`} hint="sur les OK" />
            </div>

            <Card className="rounded-2xl border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-camublue-900 mb-2">Répartition du jour</h3>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieDaily} dataKey="value" nameKey="name" outerRadius={90}>
                        {pieDaily.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-500 mt-2">Objectif : identifier rapidement absences & anomalies.</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-gray-200 lg:col-span-3">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                  <h3 className="font-semibold text-camublue-900">Top employés</h3>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Mode</span>
                    <select
                      value={topMode}
                      onChange={(e) => setTopMode(e.target.value as any)}
                      className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                    >
                      <option value="most_worked">Travaille le plus</option>
                      <option value="least_worked">Travaille le moins</option>
                      <option value="absent">Absents</option>
                      <option value="not_pointing">Not pointing</option>
                    </select>

                    <span className="text-sm text-gray-600">Top</span>
                    <Input
                      type="number"
                      value={topN}
                      min={5}
                      max={50}
                      onChange={(e) => setTopN(Number(e.target.value || 10))}
                      className="w-[90px]"
                    />
                  </div>

                  <div className="flex-1" />
                  <p className="text-xs text-gray-500">
                    {topMode.includes("worked") ? "Valeur = heures travaillées" : "Liste des personnes concernées"}
                  </p>
                </div>

                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topEmployeesData} layout="vertical" margin={{ left: 40, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={220} />
                      <Tooltip formatter={(v: any, _n: any, p: any) => (p?.payload?.label ? p.payload.label : v)} />
                      <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                        {topEmployeesData.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Daily table uses toHandleList (filtrée) */}
            <div className="lg:col-span-3">
              <Card className="rounded-2xl border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="text-camublue-900" />
                    <h3 className="font-semibold text-camublue-900">À traiter (absents / incomplets / anomalies)</h3>
                    <span className="text-sm text-gray-500">({toHandleList.length})</span>
                  </div>

                  <div className="overflow-auto rounded-xl border border-slate-300">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-white z-10 border-b border-slate-400">
                        <tr className="text-left">
                          <th className="px-3 py-2">Employé</th>
                          <th className="px-3 py-2">Département</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Entrée</th>
                          <th className="px-3 py-2">Sortie</th>
                          <th className="px-3 py-2">Écart</th>
                        </tr>
                      </thead>
                      <tbody>
                        {toHandleList.map((r) => (
                          <tr key={`${r.employee_id}-${r.work_date}`} className="border-b border-slate-300">
                            <td className="px-3 py-2 font-medium text-gray-800">{r.full_name || r.matricule || r.employee_id}</td>
                            <td className="px-3 py-2 text-gray-600">{r.department || "-"}</td>
                            <td className="px-3 py-2">
                              <StatusBadge status={r.status as any} />
                            </td>
                            <td className="px-3 py-2 text-gray-600">{r.in_time ? formatTime(r.in_time) : "-"}</td>
                            <td className="px-3 py-2 text-gray-600">{r.out_time ? formatTime(r.out_time) : "-"}</td>
                            <td className="px-3 py-2 text-gray-700 font-medium">
                                {minutesToSignedHHMM(r.delta_minutes ?? 0)}
                              </td>

                          </tr>
                        ))}
                        {toHandleList.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                              Aucun cas à traiter sur cette date ✅
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* WEEKLY */}
        {tab === "weekly" && weekly && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Kpi title="Worked" value={`${Math.round((weekly.worked_minutes / 60) * 10) / 10} h`} hint={`semaine ${weekly.week}`} />
              <Kpi title="Expected" value={`${Math.round((weekly.expected_minutes / 60) * 10) / 10} h`} hint="Standard ~40h" />
              <Kpi title="Not pointing" value={weekly.not_pointing_days ?? 0} hint="absent + incomplete (employee-days)" />
              <Kpi title="Période" value={`${weekly.start ?? "—"} → ${weekly.end ?? "—"}`} hint="dates" />
            </div>

            <Card className="rounded-2xl border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-camublue-900 mb-2">Worked vs Expected (jours)</h3>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barWeekly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="expected_h" fill="#94a3b8" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="worked_h" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-500 mt-2">Les labels incluent le jour (Lun, Mar...).</p>
              </CardContent>
            </Card>

            {/* Top employees weekly */}
            <Card className="rounded-2xl border-gray-200 lg:col-span-3">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                  <h3 className="font-semibold text-camublue-900">Top employés (semaine)</h3>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Mode</span>
                    <select
                      value={periodTopMode}
                      onChange={(e) => setPeriodTopMode(e.target.value as any)}
                      className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                    >
                      <option value="most_worked">Travaille le plus</option>
                      <option value="least_worked">Travaille le moins</option>
                    </select>

                    <span className="text-sm text-gray-600">Top</span>
                    <Input
                      type="number"
                      value={periodTopN}
                      min={5}
                      max={50}
                      onChange={(e) => setPeriodTopN(Number(e.target.value || 10))}
                      className="w-[90px]"
                    />
                  </div>
                </div>

                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={periodTopData} layout="vertical" margin={{ left: 40, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={220} />
                      <Tooltip formatter={(v: any, _n: any, p: any) => (p?.payload?.label ? p.payload.label : v)} />
                      <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                        {periodTopData.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Table weekly */}
            <Card className="rounded-2xl border-gray-200 lg:col-span-3">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <h3 className="font-semibold text-camublue-900">Synthèse employés (semaine)</h3>
                  <div className="flex-1" />

                  <Input
                    value={periodQ}
                    onChange={(e) => setPeriodQ(e.target.value)}
                    placeholder="Search (matricule, nom, service, fonction...)"
                    className="w-[280px]"
                  />

                  <select
                    value={periodService}
                    onChange={(e) => setPeriodService(e.target.value)}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                  >
                    {periodServices.map((s) => (
                      <option key={s} value={s}>
                        {s === "all" ? "Tous services" : s}
                      </option>
                    ))}
                  </select>

                  <select
                    value={periodSort}
                    onChange={(e) => setPeriodSort(e.target.value as any)}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                  >
                    <option value="worked">Trier: heures</option>
                    <option value="name">Trier: nom</option>
                    <option value="service">Trier: service</option>
                  </select>

                  <select
                    value={String(periodPageSize)}
                    onChange={(e) => setPeriodPageSize(Number(e.target.value))}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}/page
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      const rows = periodEmployees.map((r: any) => ({
                        week: weekly.week,
                        start: weekly.start ?? "",
                        end: weekly.end ?? "",
                        matricule: r.matricule ?? "",
                        nom: r.nom ?? "",
                        prenom: r.prenom ?? "",
                        service: r.service ?? "",
                        fonction: getFunctionLabel(r),
                        worked_h: ((r.worked_minutes ?? 0) / 60).toFixed(2),
                        expected_h: ((r.expected_minutes ?? 0) / 60).toFixed(2),
                        absent_days: r.absent_days ?? 0,
                        incomplete_days: r.incomplete_days ?? 0,
                        not_pointing_days: r.not_pointing_days ?? 0,
                        delta: minutesToSignedHHMM(r.delta_minutes ?? 0),

                      }));
                      downloadCSV(`weekly_${weekly.week}_employees.csv`, rows);
                    }}
                    disabled={!periodEmployees.length}
                  >
                    Export CSV
                  </Button>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>
                    {periodTotal} résultat(s) · page {periodPageSafe}/{periodTotalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-xl" disabled={periodPageSafe <= 1} onClick={() => setPeriodPage(p => Math.max(1, p - 1))}>
                      Prev
                    </Button>
                    <Button variant="outline" className="rounded-xl" disabled={periodPageSafe >= periodTotalPages} onClick={() => setPeriodPage(p => Math.min(periodTotalPages, p + 1))}>
                      Next
                    </Button>
                  </div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-300">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white z-10 border-b border-slate-400">
                      <tr className="text-left">
                        <th className="px-3 py-2">Matricule</th>
                        <th className="px-3 py-2">Nom</th>
                        <th className="px-3 py-2">Prénom</th>
                        <th className="px-3 py-2">Service</th>
                        <th className="px-3 py-2">Fonction</th>
                        <th className="px-3 py-2">Heures</th>
                        <th className="px-3 py-2">Absent</th>
                        <th className="px-3 py-2">Incomp.</th>
                        <th className="px-3 py-2">Not point.</th>
                        <th className="px-3 py-2">Progress</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodSlice.map((r: any) => {
                        const workedH = (r.worked_minutes ?? 0) / 60;
                        const expectedH = (r.expected_minutes ?? 0) / 60;
                        return (
                          <tr key={r.employee_id} className="border-b border-slate-300">
                            <td className="px-3 py-2 font-medium">{r.matricule ?? "-"}</td>
                            <td className="px-3 py-2">{r.nom ?? "-"}</td>
                            <td className="px-3 py-2">{r.prenom ?? "-"}</td>
                            <td className="px-3 py-2 text-slate-600">{r.service ?? "-"}</td>
                            <td className="px-3 py-2 text-slate-600">{getFunctionLabel(r)}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800">{workedH.toFixed(1)} h</td>
                            <td className="px-3 py-2">{r.absent_days ?? 0}</td>
                            <td className="px-3 py-2">{r.incomplete_days ?? 0}</td>
                            <td className="px-3 py-2">{r.not_pointing_days ?? 0}</td>
                            <td className="px-3 py-2 w-[220px]">
                              <ProgressExpected workedHours={workedH} expectedHours={40} label="objectif 40h" />
                            </td>
                            <td className="px-3 py-2">
                              <Button variant="outline" className="rounded-xl" onClick={() => openDetail(r.employee_id)}>
                                Détails
                              </Button>
                            </td>
                          </tr>
                        );
                      })}

                      {periodSlice.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                            Aucun résultat
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MONTHLY */}
        {tab === "monthly" && monthly && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Kpi title="Worked" value={`${Math.round((monthly.worked_minutes / 60) * 10) / 10} h`} hint={`mois ${monthly.month}`} />
              <Kpi title="Expected" value={`${Math.round((monthly.expected_minutes / 60) * 10) / 10} h`} hint="attendu (STANDARD)" />
              <Kpi title="Delta" value={`${Math.round((monthly.delta_minutes / 60) * 10) / 10} h`} hint="worked - expected" />
              <Kpi title="Période" value={`${monthly.start ?? "—"} → ${monthly.end ?? "—"}`} hint="dates" />
            </div>

            <Card className="rounded-2xl border-gray-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-camublue-900 mb-2">Worked vs Expected (semaines)</h3>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barMonthly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="expected_h" fill="#94a3b8" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="worked_h" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-500 mt-2">Vue exécutive : semaines faibles / fortes.</p>
              </CardContent>
            </Card>

            {/* Top employees monthly */}
            <Card className="rounded-2xl border-gray-200 lg:col-span-3">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                  <h3 className="font-semibold text-camublue-900">Top employés (mois)</h3>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Mode</span>
                    <select
                      value={periodTopMode}
                      onChange={(e) => setPeriodTopMode(e.target.value as any)}
                      className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                    >
                      <option value="most_worked">Travaille le plus</option>
                      <option value="least_worked">Travaille le moins</option>
                    </select>

                    <span className="text-sm text-gray-600">Top</span>
                    <Input
                      type="number"
                      value={periodTopN}
                      min={5}
                      max={50}
                      onChange={(e) => setPeriodTopN(Number(e.target.value || 10))}
                      className="w-[90px]"
                    />
                  </div>
                </div>

                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={periodTopData} layout="vertical" margin={{ left: 40, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={220} />
                      <Tooltip formatter={(v: any, _n: any, p: any) => (p?.payload?.label ? p.payload.label : v)} />
                      <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                        {periodTopData.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Table monthly */}
            <Card className="rounded-2xl border-gray-200 lg:col-span-3">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <h3 className="font-semibold text-camublue-900">Synthèse employés (mois)</h3>
                  <div className="flex-1" />

                  <Input
                    value={periodQ}
                    onChange={(e) => setPeriodQ(e.target.value)}
                    placeholder="Search (matricule, nom, service, fonction...)"
                    className="w-[280px]"
                  />

                  <select
                    value={periodService}
                    onChange={(e) => setPeriodService(e.target.value)}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                  >
                    {periodServices.map((s) => (
                      <option key={s} value={s}>
                        {s === "all" ? "Tous services" : s}
                      </option>
                    ))}
                  </select>

                  <select
                    value={periodSort}
                    onChange={(e) => setPeriodSort(e.target.value as any)}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                  >
                    <option value="worked">Trier: heures</option>
                    <option value="name">Trier: nom</option>
                    <option value="service">Trier: service</option>
                  </select>

                  <select
                    value={String(periodPageSize)}
                    onChange={(e) => setPeriodPageSize(Number(e.target.value))}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-camublue-900"
                  >
                    {[10, 20, 50, 100].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}/page
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      const rows = periodEmployees.map((r: any) => ({
                        month: monthly.month,
                        start: monthly.start ?? "",
                        end: monthly.end ?? "",
                        matricule: r.matricule ?? "",
                        nom: r.nom ?? "",
                        prenom: r.prenom ?? "",
                        service: r.service ?? "",
                        fonction: getFunctionLabel(r),
                        worked_h: ((r.worked_minutes ?? 0) / 60).toFixed(2),
                        expected_h: ((r.expected_minutes ?? 0) / 60).toFixed(2),
                        absent_days: r.absent_days ?? 0,
                        incomplete_days: r.incomplete_days ?? 0,
                        not_pointing_days: r.not_pointing_days ?? 0,
                        overtime_minutes: r.overtime_minutes ?? 0,
                        delta_minutes: r.delta_minutes ?? 0,
                      }));
                      downloadCSV(`monthly_${monthly.month}_employees.csv`, rows);
                    }}
                    disabled={!periodEmployees.length}
                  >
                    Export CSV
                  </Button>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>
                    {periodTotal} résultat(s) · page {periodPageSafe}/{periodTotalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-xl" disabled={periodPageSafe <= 1} onClick={() => setPeriodPage(p => Math.max(1, p - 1))}>
                      Prev
                    </Button>
                    <Button variant="outline" className="rounded-xl" disabled={periodPageSafe >= periodTotalPages} onClick={() => setPeriodPage(p => Math.min(periodTotalPages, p + 1))}>
                      Next
                    </Button>
                  </div>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-300">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white z-10 border-b border-slate-400">
                      <tr className="text-left">
                        <th className="px-3 py-2">Matricule</th>
                        <th className="px-3 py-2">Nom</th>
                        <th className="px-3 py-2">Prénom</th>
                        <th className="px-3 py-2">Service</th>
                        <th className="px-3 py-2">Fonction</th>
                        <th className="px-3 py-2">Heures</th>
                        <th className="px-3 py-2">Absent</th>
                        <th className="px-3 py-2">Incomp.</th>
                        <th className="px-3 py-2">Not point.</th>
                        <th className="px-3 py-2">Progress</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodSlice.map((r: any) => {
                        const workedH = (r.worked_minutes ?? 0) / 60;
                        const expectedH = (r.expected_minutes ?? 0) / 60;
                        return (
                          <tr key={r.employee_id} className="border-b border-slate-300">
                            <td className="px-3 py-2 font-medium">{r.matricule ?? "-"}</td>
                            <td className="px-3 py-2">{r.nom ?? "-"}</td>
                            <td className="px-3 py-2">{r.prenom ?? "-"}</td>
                            <td className="px-3 py-2 text-slate-600">{r.service ?? "-"}</td>
                            <td className="px-3 py-2 text-slate-600">{getFunctionLabel(r)}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800">{workedH.toFixed(1)} h</td>
                            <td className="px-3 py-2">{r.absent_days ?? 0}</td>
                            <td className="px-3 py-2">{r.incomplete_days ?? 0}</td>
                            <td className="px-3 py-2">{r.not_pointing_days ?? 0}</td>
                            <td className="px-3 py-2 w-[220px]">
                              <ProgressExpected workedHours={workedH} expectedHours={expectedH} label="mois" />
                            </td>
                            <td className="px-3 py-2">
                              <Button variant="outline" className="rounded-xl" onClick={() => openDetail(r.employee_id)}>
                                Détails
                              </Button>
                            </td>
                          </tr>
                        );
                      })}

                      {periodSlice.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                            Aucun résultat
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* MODAL DETAIL */}
        <AnimatePresence>
          {detailOpen && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailOpen(false)}
            >
              <motion.div
                className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-slate-200"
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                  <h3 className="font-semibold text-camublue-900 flex-1">Détail période</h3>
                  <Button variant="outline" className="rounded-xl" onClick={() => setDetailOnlyIssues((v) => !v)}>
                    {detailOnlyIssues ? "Voir tout" : "Voir anomalies"}
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => setDetailOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="p-4">
                  {detailLoading && <div className="text-sm text-slate-600">Chargement…</div>}
                  {detailErr && <div className="text-sm text-red-600">{detailErr}</div>}

                  {detailData && (
                    <>
                      <div className="text-xs text-slate-500 mb-3">
                        {detailData.start} → {detailData.end} · {detailData.days_total} jour(s)
                      </div>

                      <div className="overflow-auto rounded-xl border border-slate-300">
                        <table className="min-w-full text-sm">
                          <thead className="sticky top-0 bg-white z-10 border-b border-slate-400">
                            <tr className="text-left">
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Jour</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">IN</th>
                              <th className="px-3 py-2">OUT</th>
                              <th className="px-3 py-2">Raison</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailDays.map((d: any) => (
                              <tr key={d.date} className="border-b border-slate-300">
                                <td className="px-3 py-2 font-medium">{d.date}</td>
                                <td className="px-3 py-2 text-slate-600">{d.weekday_label ?? "-"}</td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-1 rounded-lg bg-camublue-900/10 text-camublue-900 font-medium">
                                    {d.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{formatTime(d.in_time)}</td>
                                <td className="px-3 py-2 text-slate-600">{formatTime(d.out_time)}</td>
                                <td className="px-3 py-2 text-slate-500">{d.reason ?? "-"}</td>
                              </tr>
                            ))}

                            {detailDays.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                                  Aucun cas à afficher ✅
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-3">
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            const rows = (detailData.days ?? []).map((d: any) => ({
                              date: d.date,
                              jour: d.weekday_label ?? "",
                              status: d.status,
                              in: formatTime(d.in_time),
                              out: formatTime(d.out_time),
                              reason: d.reason ?? "",
                            }));
                            downloadCSV(`detail_${detailData.employee_id}_${detailData.start}_${detailData.end}.csv`, rows);
                          }}
                        >
                          Export détail CSV
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  function Kpi({ title, value, hint }: { title: string; value: any; hint?: string }) {
    return (
      <Card className="rounded-2xl border-gray-200">
        <CardContent className="p-4">
          <div className="text-sm text-gray-500">{title}</div>
          <div className="text-2xl font-bold text-camublue-900 mt-1">{value}</div>
          {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
        </CardContent>
      </Card>
    );
  }
