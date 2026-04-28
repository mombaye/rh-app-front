import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  BadgeDollarSign,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingUp,
  Building2,
  User,
  ShieldCheck,
  ArrowDown,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { leaveBalanceService, leaveRequestService } from "@/services/leaveService";
import { employeeHierarchyService, MyHierarchyChain } from "@/services/hierarchyService";
import { fetchAvailableBulletins } from "@/services/employeeService";
import { getEmployeeDocuments } from "@/services/employeeService";
import { LeaveBalance, LeaveRequest } from "@/types/leave";
import { Link } from "react-router-dom";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  PENDING:        { label: "En attente",       color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",  Icon: Clock          },
  PENDING_SECOND: { label: "2ème validation",  color: "text-orange-700", bg: "bg-orange-50 border-orange-200", Icon: Clock         },
  APPROVED:       { label: "Approuvé",         color: "text-green-700",  bg: "bg-green-50 border-green-200",  Icon: CheckCircle2   },
  REJECTED:       { label: "Rejeté",           color: "text-red-700",    bg: "bg-red-50 border-red-200",      Icon: XCircle        },
  CANCELLED:      { label: "Annulé",           color: "text-gray-500",   bg: "bg-gray-50 border-gray-200",    Icon: XCircle        },
  REVOKED:        { label: "Révoqué",          color: "text-purple-700", bg: "bg-purple-50 border-purple-200", Icon: AlertCircle   },
};

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const employeeId = user?.employee_id;
  const employeeMatricule = user?.employee_matricule;

  const [balances, setBalances]     = useState<LeaveBalance[]>([]);
  const [requests, setRequests]     = useState<LeaveRequest[]>([]);
  const [bulletinCount, setBulletinCount] = useState<number | null>(null);
  const [docCount, setDocCount]     = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [hierarchy, setHierarchy]   = useState<MyHierarchyChain | null>(null);

  useEffect(() => {
    if (!employeeId) { setLoading(false); return; }

    const year = new Date().getFullYear();
    Promise.all([
      leaveBalanceService.getByEmployee(employeeId, year).catch(() => []),
      leaveRequestService.getByEmployee(employeeId).catch(() => []),
      employeeMatricule
        ? fetchAvailableBulletins(employeeMatricule).catch(() => [])
        : Promise.resolve([]),
      getEmployeeDocuments(employeeId).catch(() => ({ items: [] })),
    ]).then(([bal, reqs, buls, docs]) => {
      setBalances(bal as LeaveBalance[]);
      setRequests((reqs as LeaveRequest[]).slice().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      setBulletinCount(Array.isArray(buls) ? buls.length : 0);
      setDocCount(Array.isArray((docs as any).items) ? (docs as any).items.length : 0);
    }).finally(() => setLoading(false));
  }, [employeeId, employeeMatricule]);

  useEffect(() => {
    employeeHierarchyService.getMyHierarchy()
      .then(setHierarchy)
      .catch(() => {});
  }, []);

  const totalRemaining = balances.reduce((s, b) => s + parseFloat(b.remaining || "0"), 0);
  const pendingCount   = requests.filter(r => r.status === "PENDING" || r.status === "PENDING_SECOND").length;
  const approvedCount  = requests.filter(r => r.status === "APPROVED").length;
  const recentRequests = requests.slice(0, 5);

  const statCards = [
    {
      label: "Jours de congé restants",
      value: loading ? "…" : totalRemaining.toFixed(1),
      sub: `Année ${new Date().getFullYear()}`,
      icon: <CalendarDays size={22} />,
      color: "bg-blue-50 text-camublue-900",
      link: "/employee/leaves",
    },
    {
      label: "Demandes en cours",
      value: loading ? "…" : pendingCount,
      sub: `${approvedCount} approuvée(s)`,
      icon: <Clock size={22} />,
      color: "bg-amber-50 text-amber-700",
      link: "/employee/leaves",
    },
    {
      label: "Bulletins disponibles",
      value: loading || bulletinCount === null ? "…" : bulletinCount,
      sub: "Bulletins de salaire",
      icon: <BadgeDollarSign size={22} />,
      color: "bg-green-50 text-green-700",
      link: "/employee/payslips",
    },
    {
      label: "Documents dans mon dossier",
      value: loading || docCount === null ? "…" : docCount,
      sub: "Fichiers accessibles",
      icon: <FolderOpen size={22} />,
      color: "bg-purple-50 text-purple-700",
      link: "/employee/dossier",
    },
  ];

  return (
    <EmployeeLayout>
      <div className="px-4 md:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-camublue-900">
            Bonjour, {user?.employee_name?.split(" ")[0] || user?.username} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Voici un résumé de votre situation RH.
          </p>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <Link
                to={card.link}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-camublue-900/20 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`inline-flex p-2.5 rounded-xl ${card.color}`}>
                    {card.icon}
                  </div>
                  <div className="text-3xl font-black text-gray-800">{card.value}</div>
                </div>
                <div className="text-sm font-medium text-gray-600">{card.label}</div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Soldes de congés */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp size={18} className="text-camublue-900" />
                Soldes de congés {new Date().getFullYear()}
              </h2>
            </div>
            {loading ? (
              <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ) : balances.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Aucun solde disponible</p>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-4">
                <span className="text-6xl font-black text-camublue-900 leading-none">
                  {totalRemaining.toFixed(1)}
                </span>
                <span className="text-sm text-gray-400 mt-2">jours restants</span>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Link to="/employee/leaves" className="text-xs text-camublue-900 hover:underline">
                Voir tout →
              </Link>
            </div>
          </motion.div>

          {/* Dernières demandes */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <CalendarDays size={18} className="text-camublue-900" />
                Mes dernières demandes
              </h2>
              <Link to="/employee/leaves" className="text-xs text-camublue-900 hover:underline">
                Voir tout →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm mb-3">Aucune demande de congé</p>
                <Link
                  to="/employee/leaves"
                  className="inline-block text-sm text-white bg-camublue-900 px-4 py-2 rounded-lg hover:bg-camublue-900/90 transition"
                >
                  Faire une demande
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRequests.map((req) => {
                  const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.CANCELLED;
                  const Icon = cfg.Icon;
                  const d = new Date(req.start_date);
                  return (
                    <div
                      key={req.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${cfg.bg}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon size={16} className={`shrink-0 ${cfg.color}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">
                            {req.leave_type.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {MONTHS_FR[d.getMonth()]} {d.getFullYear()} · {req.days}j
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ml-2 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Arborescence de validation ── */}
        {hierarchy && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Building2 size={18} className="text-camublue-900" />
                Mon arborescence de validation
              </h2>
              <Link to="/employee/leaves" className="text-xs text-camublue-900 hover:underline">
                Voir mes congés →
              </Link>
            </div>
            <p className="text-xs text-gray-400 mb-4">Circuit de validation appliqué à vos demandes de congé</p>

            {/* Palette de couleurs par niveau (N+1 → N+2 → N+3 → …) */}
            {(() => {
              const STEP_COLORS = [
                { bg: "bg-amber-50",  border: "border-amber-200",  icon: "text-amber-700",  text: "text-amber-800",  sub: "text-amber-500",  badge: "text-amber-700 bg-amber-50"   },
                { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-700", text: "text-orange-800", sub: "text-orange-500", badge: "text-orange-700 bg-orange-50"  },
                { bg: "bg-purple-50", border: "border-purple-200", icon: "text-purple-700", text: "text-purple-800", sub: "text-purple-500", badge: "text-purple-700 bg-purple-50"  },
                { bg: "bg-rose-50",   border: "border-rose-200",   icon: "text-rose-700",   text: "text-rose-800",   sub: "text-rose-500",   badge: "text-rose-700 bg-rose-50"     },
              ];
              const Connector = () => (
                <div className="flex flex-col sm:flex-row items-center justify-center py-1 sm:py-0 sm:pt-5">
                  <ArrowDown size={16} className="text-gray-300 sm:hidden" />
                  <div className="hidden sm:block w-8 h-0.5 bg-gray-300 rounded" />
                  <div className="hidden sm:block w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-gray-300" />
                </div>
              );

              // Utilise approval_chain si disponible, sinon rétrocompat n1/n2
              const chain = hierarchy.approval_chain?.length
                ? hierarchy.approval_chain
                : [
                    ...(hierarchy.n1_manager ? [{ step: 1, label: "N+1", approver: hierarchy.n1_manager }] : []),
                    ...(hierarchy.n2_manager ? [{ step: 2, label: "N+2", approver: hierarchy.n2_manager }] : []),
                  ];

              return (
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-0 sm:gap-3 justify-center flex-wrap">
                  {/* Employé (moi) */}
                  <div className="flex flex-col items-center text-center min-w-[140px]">
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-2">
                      <User size={22} className="text-blue-700" />
                    </div>
                    <span className="text-xs font-bold text-blue-800 leading-tight">{hierarchy.employee.full_name}</span>
                    <span className="text-[10px] text-blue-500 mt-0.5">{hierarchy.employee.fonction || hierarchy.employee.service}</span>
                    <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1">Vous</span>
                  </div>

                  {/* Étapes dynamiques de la chaîne */}
                  {chain.map((step, idx) => {
                    const isDg = hierarchy.approval_flow === "DG_ONLY";
                    const c    = isDg
                      ? { bg: "bg-indigo-50", border: "border-indigo-300", icon: "text-indigo-700", text: "text-indigo-800", sub: "text-indigo-500", badge: "text-indigo-700 bg-indigo-50" }
                      : (STEP_COLORS[idx] ?? STEP_COLORS[STEP_COLORS.length - 1]);
                    return (
                      <div key={step.step} className="flex flex-col sm:flex-row items-center sm:items-start gap-0 sm:gap-3">
                        <Connector />
                        <div className="flex flex-col items-center text-center min-w-[140px]">
                          <div className={`p-3 rounded-xl mb-2 ${c.bg} border ${c.border}`}>
                            <ShieldCheck size={22} className={c.icon} />
                          </div>
                          <span className={`text-xs font-bold leading-tight ${c.text}`}>{step.approver.full_name}</span>
                          <span className={`text-[10px] mt-0.5 ${c.sub}`}>{step.approver.fonction || step.approver.service}</span>
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded mt-1 ${c.badge}`}>
                            {isDg ? "DG" : step.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* RH */}
                  <Connector />
                  <div className="flex flex-col items-center text-center min-w-[140px]">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-2">
                      <CheckCircle2 size={22} className="text-emerald-700" />
                    </div>
                    <span className="text-xs font-bold text-emerald-800 leading-tight">Service RH</span>
                    <span className="text-[10px] text-emerald-500 mt-0.5">Validation finale</span>
                    <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1">RH</span>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

      </div>
    </EmployeeLayout>
  );
}
