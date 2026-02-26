import { useEffect, useState } from "react";
import AppLayout from "@/layouts/AppLayout";
import { motion } from "framer-motion";
import {
  Users, FileText, Clock, TrendingUp, TrendingDown,
  UserCheck, UserX, AlertTriangle, CheckCircle,
  BarChart2, Hash, ChevronDown
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ─── Mock data (remplace par tes vrais services) ──────────────────────────────

const MOCK_EMPLOYEES = {
  total: 142,
  actifs: 134,
  sortis: 8,
  nouveaux_mois: 5,
  par_service: [
    { name: "Informatique", value: 28 },
    { name: "RH", value: 14 },
    { name: "Finance", value: 19 },
    { name: "Commercial", value: 37 },
    { name: "Opérations", value: 44 },
  ],
  evolution: [
    { mois: "Sep", total: 128 },
    { mois: "Oct", total: 131 },
    { mois: "Nov", total: 135 },
    { mois: "Déc", total: 133 },
    { mois: "Jan", total: 138 },
    { mois: "Fév", total: 142 },
  ],
};

const MOCK_BULLETINS = {
  total_mois: 134,
  masse_salariale: 48_750_000,
  masse_prev_mois: 46_200_000,
  generes: 134,
  en_attente: 0,
  evolution: [
    { mois: "Sep", masse: 42_100_000 },
    { mois: "Oct", masse: 43_500_000 },
    { mois: "Nov", masse: 44_200_000 },
    { mois: "Déc", masse: 47_100_000 },
    { mois: "Jan", masse: 46_200_000 },
    { mois: "Fév", masse: 48_750_000 },
  ],
};

const MOCK_POINTAGE = {
  today_present: 118,
  today_absent: 11,
  today_incomplete: 5,
  taux_presence: 88,
  heures_semaine: 4_870,
  heures_attendues: 5_360,
  semaine: [
    { jour: "Lun", present: 124, absent: 10 },
    { jour: "Mar", present: 121, absent: 13 },
    { jour: "Mer", present: 119, absent: 15 },
    { jour: "Jeu", present: 122, absent: 12 },
    { jour: "Ven", present: 118, absent: 11 },
  ],
};

const PIE_COLORS = ["#1e3a5f", "#2563eb", "#60a5fa", "#93c5fd", "#bfdbfe"];
const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);

// ─── View toggle ─────────────────────────────────────────────────────────────

type ViewMode = "chiffres" | "graphes";

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
      {(["chiffres", "graphes"] as ViewMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            mode === m
              ? "bg-white text-camublue-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {m === "chiffres" ? <Hash className="h-3.5 w-3.5" /> : <BarChart2 className="h-3.5 w-3.5" />}
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  trendLabel,
  color = "blue",
  delay = 0,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: "blue" | "green" | "amber" | "red";
  delay?: number;
}) {
  const colors = {
    blue: { bg: "bg-camublue-900/8", icon: "bg-camublue-900 text-white", text: "text-camublue-900" },
    green: { bg: "bg-emerald-50", icon: "bg-emerald-500 text-white", text: "text-emerald-700" },
    amber: { bg: "bg-amber-50", icon: "bg-amber-500 text-white", text: "text-amber-700" },
    red: { bg: "bg-red-50", icon: "bg-red-500 text-white", text: "text-red-700" },
  };
  const c = colors[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
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
      <div className={`text-2xl font-bold ${c.text} mb-0.5`}>{value}</div>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </motion.div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="space-y-4"
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [view, setView] = useState<ViewMode>("graphes");
  const [month, setMonth] = useState("Février 2026");

  const deltaMasse = MOCK_BULLETINS.masse_salariale - MOCK_BULLETINS.masse_prev_mois;
  const deltaPct = ((deltaMasse / MOCK_BULLETINS.masse_prev_mois) * 100).toFixed(1);

  return (
    <AppLayout>
      <div className="p-6 space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-camublue-900">Tableau de bord RH</h1>
            <p className="text-slate-500 text-sm mt-1">Vue d'ensemble · Employés, Paie & Pointages</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              {month}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            <ViewToggle mode={view} onChange={setView} />
          </div>
        </motion.div>

        {/* ── EMPLOYÉS ── */}
        <Section title="Employés" icon={Users} delay={0.05}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total employés" value={MOCK_EMPLOYEES.total} sub="Tous statuts confondus" delay={0.1} />
            <StatCard icon={UserCheck} label="Actifs" value={MOCK_EMPLOYEES.actifs} color="green" trend="up" trendLabel="+5 ce mois" delay={0.15} />
            <StatCard icon={UserX} label="Sorties" value={MOCK_EMPLOYEES.sortis} color="red" sub="Ce mois" delay={0.2} />
            <StatCard icon={TrendingUp} label="Nouveaux" value={MOCK_EMPLOYEES.nouveaux_mois} color="amber" sub="Recrutés ce mois" delay={0.25} />
          </div>

          {view === "graphes" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {/* Evolution effectif */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-4">Évolution de l'effectif</p>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_EMPLOYEES.evolution}>
                      <defs>
                        <linearGradient id="empGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                      <Tooltip />
                      <Area type="monotone" dataKey="total" stroke="#1e3a5f" strokeWidth={2} fill="url(#empGrad)" name="Effectif" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Répartition par service */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-4">Répartition par service</p>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={MOCK_EMPLOYEES.par_service} dataKey="value" nameKey="name" outerRadius={80} innerRadius={40}>
                        {MOCK_EMPLOYEES.par_service.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── BULLETINS ── */}
        <Section title="Bulletins de salaire" icon={FileText} delay={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={FileText} label="Bulletins générés" value={MOCK_BULLETINS.generes} sub={month} color="blue" delay={0.15} />
            <StatCard icon={AlertTriangle} label="En attente" value={MOCK_BULLETINS.en_attente} color="amber" sub="À valider" delay={0.2} />
            <StatCard
              icon={TrendingUp}
              label="Masse salariale"
              value={`${fmt(MOCK_BULLETINS.masse_salariale)} F`}
              color={deltaMasse >= 0 ? "blue" : "red"}
              trend={deltaMasse >= 0 ? "up" : "down"}
              trendLabel={`${deltaMasse >= 0 ? "+" : ""}${deltaPct}%`}
              delay={0.25}
            />
            <StatCard
              icon={CheckCircle}
              label="Taux validation"
              value={`${Math.round((MOCK_BULLETINS.generes / MOCK_EMPLOYEES.actifs) * 100)}%`}
              color="green"
              sub="Bulletins / Actifs"
              delay={0.3}
            />
          </div>

          {view === "graphes" && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mt-2">
              <p className="text-sm font-semibold text-slate-700 mb-4">Évolution de la masse salariale (FCFA)</p>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_BULLETINS.evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                    <Tooltip formatter={(v: any) => [`${fmt(v)} F`, "Masse salariale"]} />
                    <Bar dataKey="masse" fill="#2563eb" radius={[6, 6, 0, 0]} name="Masse salariale" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Section>

        {/* ── POINTAGES ── */}
        <Section title="Pointages" icon={Clock} delay={0.15}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={UserCheck} label="Présents aujourd'hui" value={MOCK_POINTAGE.today_present} color="green" sub={`Sur ${MOCK_EMPLOYEES.actifs} actifs`} delay={0.2} />
            <StatCard icon={UserX} label="Absents" value={MOCK_POINTAGE.today_absent} color="red" delay={0.25} />
            <StatCard icon={AlertTriangle} label="Incomplets" value={MOCK_POINTAGE.today_incomplete} color="amber" sub="IN ou OUT manquant" delay={0.3} />
            <StatCard
              icon={Clock}
              label="Taux de présence"
              value={`${MOCK_POINTAGE.taux_presence}%`}
              color={MOCK_POINTAGE.taux_presence >= 90 ? "green" : MOCK_POINTAGE.taux_presence >= 75 ? "amber" : "red"}
              sub="Aujourd'hui"
              delay={0.35}
            />
          </div>

          {view === "graphes" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {/* Présence semaine */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-4">Présence / Absence (cette semaine)</p>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={MOCK_POINTAGE.semaine}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="jour" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend iconType="circle" iconSize={8} />
                      <Bar dataKey="present" name="Présents" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="absent" name="Absents" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Heures travaillées vs attendues */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-3">Heures semaine en cours</p>
                <div className="space-y-4 mt-6">
                  {/* Travaillées */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-600 font-medium">Heures travaillées</span>
                      <span className="font-bold text-camublue-900">{fmt(MOCK_POINTAGE.heures_semaine)} h</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (MOCK_POINTAGE.heures_semaine / MOCK_POINTAGE.heures_attendues) * 100)}%` }}
                        transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                        className="h-3 bg-camublue-900 rounded-full"
                      />
                    </div>
                  </div>
                  {/* Attendues */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-600 font-medium">Heures attendues</span>
                      <span className="font-bold text-slate-500">{fmt(MOCK_POINTAGE.heures_attendues)} h</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-3 bg-slate-300 rounded-full w-full" />
                    </div>
                  </div>
                  {/* Delta */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Écart</span>
                      <span className={`text-sm font-bold ${MOCK_POINTAGE.heures_semaine < MOCK_POINTAGE.heures_attendues ? "text-red-500" : "text-emerald-600"}`}>
                        {MOCK_POINTAGE.heures_semaine < MOCK_POINTAGE.heures_attendues ? "-" : "+"}
                        {fmt(Math.abs(MOCK_POINTAGE.heures_semaine - MOCK_POINTAGE.heures_attendues))} h
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Section>

      </div>
    </AppLayout>
  );
}