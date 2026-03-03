import { useEffect, useState } from "react";
import AppLayout from "@/layouts/AppLayout";
import { motion } from "framer-motion";
import {
  Users, FileText, Clock, TrendingUp, TrendingDown,
  UserCheck, UserX, AlertTriangle, CheckCircle,
  BarChart2, Hash, ChevronDown, RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type {
  DailyStatsResponse, WeeklyStatsResponse, MonthlyStatsResponse,
} from "@/types/attendance";
import type { BulletinMonthSummary, Employee, ContractType } from "@/types/employee";
import {
  getEmployees, getEmployeesByContractType, fetchBulletinsSummary,
} from "@/services/employeeService";
import {
  getDailyStats, getWeeklyStats, getMonthlyStats,
} from "@/services/attendanceService";

// ─── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);

const fmtMinutes = (min: number) => {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

const MONTH_NAMES = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const PIE_COLORS = ["#1e3a5f", "#2563eb", "#60a5fa", "#93c5fd", "#bfdbfe"];

const todayStr = () => new Date().toISOString().split("T")[0];
const currentYearMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const currentISOWeek = () => {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};
const currentMonthLabel = () => {
  const d = new Date();
  return `${MONTH_NAMES[d.getMonth() + 1]} ${d.getFullYear()}`;
};
const firstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

// ─── View toggle ────────────────────────────────────────────────────────────────
type ViewMode = "chiffres" | "graphes";

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
      {(["chiffres", "graphes"] as ViewMode[]).map((m) => (
        <button key={m} onClick={() => onChange(m)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === m ? "bg-white text-camublue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {m === "chiffres" ? <Hash className="h-3.5 w-3.5" /> : <BarChart2 className="h-3.5 w-3.5" />}
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ─── Employee Filter Toggle ────────────────────────────────────────────────────
function EmployeeFilterToggle({
  filter,
  onChange,
}: {
  filter: ContractType | "ALL";
  onChange: (f: ContractType | "ALL") => void;
}) {
  const options = [
    { value: "ALL", label: "Tous" },
    { value: "INTERNE", label: "Internes" },
    { value: "INTERIM", label: "Intérimaires" },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value as ContractType | "ALL")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === opt.value
              ? "bg-white text-camublue-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, trend, trendLabel, color = "blue", delay = 0, loading = false }: {
  icon: any; label: string; value: string | number; sub?: string;
  trend?: "up" | "down" | "neutral"; trendLabel?: string;
  color?: "blue" | "green" | "amber" | "red"; delay?: number; loading?: boolean;
}) {
  const colors = {
    blue:  { icon: "bg-camublue-900 text-white", text: "text-camublue-900" },
    green: { icon: "bg-emerald-500 text-white",  text: "text-emerald-700"  },
    amber: { icon: "bg-amber-500 text-white",    text: "text-amber-700"    },
    red:   { icon: "bg-red-500 text-white",      text: "text-red-700"      },
  };
  const c = colors[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.icon}`}><Icon className="h-5 w-5" /></div>
        {trend && trendLabel && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
            trend === "up" ? "bg-emerald-50 text-emerald-700" :
            trend === "down" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
          }`}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
            {trendLabel}
          </div>
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

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, delay = 0 }: {
  title: string; icon: any; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }} className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-camublue-900/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-camublue-900" />
        </div>
        <h2 className="text-base font-bold text-camublue-900">{title}</h2>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      {children}
    </motion.div>
  );
}

// ─── Chart Skeleton ────────────────────────────────────────────────────────────
function ChartSkeleton({ height = 200 }: { height?: number }) {
  return <div className="w-full rounded-xl bg-slate-100 animate-pulse" style={{ height }} />;
}

// ─── Main ───────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [view, setView] = useState<ViewMode>("graphes");
  const [employeeFilter, setEmployeeFilter] = useState<ContractType | "ALL">("ALL");

  // ── Raw data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [daily, setDaily] = useState<DailyStatsResponse | null>(null);
  const [weekly, setWeekly] = useState<WeeklyStatsResponse | null>(null);
  const [monthly, setMonthly] = useState<MonthlyStatsResponse | null>(null);
  const [bulletins, setBulletins] = useState<BulletinMonthSummary[]>([]);

  // ── Loading
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [loadingBulletins, setLoadingBulletins] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch Employees (with filter)
  const fetchEmployees = async (filter: ContractType | "ALL") => {
    setLoadingEmp(true);
    try {
      const data = filter === "ALL"
        ? await getEmployees({ status: "ALL" })
        : await getEmployeesByContractType(filter, "ALL");
      setEmployees(data);
    } catch (error) {
      console.error("Erreur lors de la récupération des employés :", error);
    } finally {
      setLoadingEmp(false);
    }
  };

  // ── Fetch All Data
  const fetchAll = async (silent = false) => {
    if (silent) setRefreshing(true);
    else {
      setLoadingEmp(true);
      setLoadingDaily(true);
      setLoadingWeekly(true);
      setLoadingBulletins(true);
    }

    await Promise.allSettled([
      fetchEmployees(employeeFilter),
      getDailyStats(todayStr())
        .then(setDaily).finally(() => setLoadingDaily(false)),
      getWeeklyStats(currentISOWeek())
        .then(setWeekly).finally(() => setLoadingWeekly(false)),
      getMonthlyStats(currentYearMonth())
        .then(setMonthly).catch(() => {}),
      fetchBulletinsSummary({ start: firstDayOfMonth(), end: todayStr() })
        .then(setBulletins).finally(() => setLoadingBulletins(false)),
    ]);

    if (silent) setRefreshing(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Computed : Employés
  const totalEmployees = employees.length;
  const actifs = employees.filter((e) => e.status === "ACTIVE").length;
  const sortis = employees.filter((e) => e.status === "EXITED").length;
  const nouveauxMois = employees.filter(
    (e) => e.status === "ACTIVE" && e.date_embauche >= firstDayOfMonth()
  ).length;

  const repartitionMap: Record<string, number> = {};
  employees.filter((e) => e.status === "ACTIVE").forEach((e) => {
    const key = e.projet || e.fonction || "Autre";
    repartitionMap[key] = (repartitionMap[key] ?? 0) + 1;
  });
  const repartition = Object.entries(repartitionMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  // ── Computed : Pointage journalier
  const kpis = daily?.kpis;
  const presentAujourdhui = kpis?.present ?? 0;
  const absentAujourdhui = kpis?.absent ?? 0;
  const incompletAujourdhui = kpis?.incomplete ?? 0;
  const tauxPresence = actifs > 0 ? Math.round((presentAujourdhui / actifs) * 100) : 0;

  // ── Computed : Pointage hebdomadaire
  const heuresTravaillees = weekly ? Math.round(weekly.worked_minutes / 60) : 0;
  const heuresAttendues = weekly ? Math.round(weekly.expected_minutes / 60) : 0;
  const deltaMinutes = weekly?.delta_minutes ?? 0;
  const semaineData = (weekly?.by_day ?? []).map((d) => ({
    jour: d.weekday_label?.slice(0, 3) ?? d.date.slice(5),
    present: d.ok_count ?? 0,
    absent: d.absent_count ?? 0,
  }));

  // ── Computed : Bulletins
  const totalBulletins = bulletins.reduce((s, b) => s + (b.total ?? 0), 0);
  const totalEnvoyes = bulletins.reduce((s, b) => s + (b.sent ?? 0), 0);
  const totalEnAttente = bulletins.reduce((s, b) => s + (b.pending ?? 0), 0);
  const tauxValidation = actifs > 0 ? Math.round((totalEnvoyes / actifs) * 100) : 0;
  const bulletinsEvolution = [...bulletins]
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .map((b) => ({ mois: MONTH_NAMES[b.month] ?? `M${b.month}`, envoyes: b.sent, total: b.total }));
  const heuresMensuelles = (monthly?.by_week ?? []).map((w) => ({
    sem: `S${w.week.split("W")[1] ?? ""}`,
    travaillees: Math.round(w.worked_minutes / 60),
    attendues: Math.round(w.expected_minutes / 60),
  }));

  // ── Render
  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-6 p-6"
      >
        {/* ── En-tête (fixe) ── */}
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-camublue-900">Tableau de bord RH</h1>
            <p className="text-slate-500 text-sm mt-1">Vue d'ensemble · Employés, Paie &amp; Pointages</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium text-slate-700">
              {currentMonthLabel()} <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
              title="Actualiser"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <ViewToggle mode={view} onChange={setView} />
          </div>
        </div>

        {/* ── Contenu scrollable ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-8 pb-6">

            {/* ── EMPLOYÉS ── */}
            <Section title="Employés" icon={Users} delay={0.05}>
              <div className="flex justify-between items-center mb-4">
                <EmployeeFilterToggle
                  filter={employeeFilter}
                  onChange={(f) => { setEmployeeFilter(f); fetchEmployees(f); }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Total employés" value={totalEmployees} sub="Tous statuts confondus" delay={0.1} loading={loadingEmp} />
                <StatCard icon={UserCheck} label="Actifs" value={actifs} color="green" trend="up" trendLabel={`+${nouveauxMois} ce mois`} delay={0.15} loading={loadingEmp} />
                <StatCard icon={UserX} label="Sorties" value={sortis} color="red" sub="Total cumulé" delay={0.2} loading={loadingEmp} />
                <StatCard icon={TrendingUp} label="Nouveaux" value={nouveauxMois} color="amber" sub="Recrutés ce mois" delay={0.25} loading={loadingEmp} />
              </div>

              {view === "graphes" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <p className="text-sm font-semibold text-slate-700 mb-4">Répartition par projet / service</p>
                    {loadingEmp ? <ChartSkeleton height={200} /> : repartition.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-16">Aucune donnée</p>
                    ) : (
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={repartition} dataKey="value" nameKey="name" outerRadius={80} innerRadius={40}>
                              {repartition.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip /><Legend iconType="circle" iconSize={8} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <p className="text-sm font-semibold text-slate-700 mb-4">Statut des employés</p>
                    {loadingEmp ? <ChartSkeleton height={200} /> : (
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={[{ name: "Actifs", value: actifs }, { name: "Sortis", value: sortis }]}
                              dataKey="value" nameKey="name" outerRadius={80} innerRadius={40}>
                              <Cell fill="#22c55e" /><Cell fill="#ef4444" />
                            </Pie>
                            <Tooltip /><Legend iconType="circle" iconSize={8} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Section>

            {/* ── BULLETINS ── */}
            <Section title="Bulletins de salaire" icon={FileText} delay={0.1}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={FileText} label="Bulletins générés" value={totalBulletins} sub={currentMonthLabel()} color="blue" delay={0.15} loading={loadingBulletins} />
                <StatCard icon={CheckCircle} label="Envoyés" value={totalEnvoyes} color="green" sub="Ce mois" delay={0.2} loading={loadingBulletins} />
                <StatCard icon={AlertTriangle} label="En attente" value={totalEnAttente} color="amber" sub="À envoyer" delay={0.25} loading={loadingBulletins} />
                <StatCard icon={TrendingUp} label="Taux d'envoi" value={`${tauxValidation}%`} color="blue" sub="Envoyés / Actifs" delay={0.3} loading={loadingBulletins || loadingEmp} />
              </div>

              {view === "graphes" && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-2">
                  <p className="text-sm font-semibold text-slate-700 mb-4">Bulletins envoyés par mois</p>
                  {loadingBulletins ? <ChartSkeleton height={200} /> : bulletinsEvolution.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-16">Aucune donnée disponible</p>
                  ) : (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bulletinsEvolution}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip /><Legend iconType="circle" iconSize={8} />
                          <Bar dataKey="envoyes" name="Envoyés" fill="#2563eb" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="total" name="Générés" fill="#93c5fd" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* ── POINTAGES ── */}
            <Section title="Pointages" icon={Clock} delay={0.15}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={UserCheck} label="Présents aujourd'hui" value={presentAujourdhui} color="green" sub={`Sur ${actifs} actifs`} delay={0.2} loading={loadingDaily} />
                <StatCard icon={UserX} label="Absents" value={absentAujourdhui} color="red" sub="Aujourd'hui" delay={0.25} loading={loadingDaily} />
                <StatCard icon={AlertTriangle} label="Incomplets" value={incompletAujourdhui} color="amber" sub="IN ou OUT manquant" delay={0.3} loading={loadingDaily} />
                <StatCard
                  icon={Clock} label="Taux de présence"
                  value={loadingDaily || loadingEmp ? "—" : `${tauxPresence}%`}
                  color={tauxPresence >= 90 ? "green" : tauxPresence >= 75 ? "amber" : "red"}
                  sub="Aujourd'hui" delay={0.35} loading={loadingDaily || loadingEmp}
                />
              </div>

              {view === "graphes" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <p className="text-sm font-semibold text-slate-700 mb-4">Présence / Absence (cette semaine)</p>
                    {loadingWeekly ? <ChartSkeleton height={200} /> : semaineData.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-16">Aucune donnée disponible</p>
                    ) : (
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={semaineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="jour" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip /><Legend iconType="circle" iconSize={8} />
                            <Bar dataKey="present" name="Présents" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
                            <Bar dataKey="absent" name="Absents" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <p className="text-sm font-semibold text-slate-700 mb-3">Heures semaine en cours</p>
                    {loadingWeekly ? <ChartSkeleton height={160} /> : (
                      <div className="space-y-4 mt-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-slate-600 font-medium">Heures travaillées</span>
                            <span className="font-bold text-camublue-900">{fmt(heuresTravaillees)} h</span>
                          </div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${heuresAttendues > 0 ? Math.min(100, (heuresTravaillees / heuresAttendues) * 100) : 0}%` }}
                              transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                              className="h-3 bg-camublue-900 rounded-full"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-slate-600 font-medium">Heures attendues</span>
                            <span className="font-bold text-slate-500">{fmt(heuresAttendues)} h</span>
                          </div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-3 bg-slate-300 rounded-full w-full" />
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500">Écart</span>
                            <span className={`text-sm font-bold ${deltaMinutes < 0 ? "text-red-500" : "text-emerald-600"}`}>
                              {deltaMinutes < 0 ? "−" : "+"}{fmtMinutes(deltaMinutes)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {view === "graphes" && heuresMensuelles.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700 mb-4">
                    Heures travaillées vs attendues — {currentMonthLabel()}
                  </p>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={heuresMensuelles}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="sem" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} unit=" h" />
                        <Tooltip formatter={(v: any) => [`${fmt(v)} h`]} />
                        <Legend iconType="circle" iconSize={8} />
                        <Bar dataKey="travaillees" name="Travaillées" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="attendues" name="Attendues" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {view === "graphes" && (weekly?.top_absent?.length ?? 0) > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Top absences cette semaine</p>
                  <div className="divide-y divide-slate-100">
                    {weekly!.top_absent.slice(0, 5).map((row, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{row.full_name}</p>
                          {row.department && <p className="text-xs text-slate-400">{row.department}</p>}
                        </div>
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                          {row.count} jour{row.count > 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>

          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
