import { useEffect, useState, useCallback } from "react";
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
  PENDING_SECOND: { label: "2\u00e8me validation",  color: "text-orange-700", bg: "bg-orange-50 border-orange-200", Icon: Clock         },
  APPROVED:       { label: "Approuv\u00e9",         color: "text-green-700",  bg: "bg-green-50 border-green-200",  Icon: CheckCircle2   },
  REJECTED:       { label: "Rejet\u00e9",           color: "text-red-700",    bg: "bg-red-50 border-red-200",      Icon: XCircle        },
  CANCELLED:      { label: "Annul\u00e9",           color: "text-gray-500",   bg: "bg-gray-50 border-gray-200",    Icon: XCircle        },
  REVOKED:        { label: "R\u00e9voqu\u00e9",          color: "text-purple-700", bg: "bg-purple-50 border-purple-200", Icon: AlertCircle   },
};

const MONTHS_FR = ["Jan","F\u00e9v","Mar","Avr","Mai","Jun","Jul","Ao\u00fb","Sep","Oct","Nov","D\u00e9c"];

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

  // Fetch hierarchy fresh from backend on every mount and on window focus.
  // This ensures that any change made by HR (assign/remove N+1 or N+2)
  // becomes immediately visible to the employee when they return to the tab.
  const fetchHierarchy = useCallback(() => {
    employeeHierarchyService.getMyHierarchy()
      .then(setHierarchy)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchHierarchy();
    window.addEventListener("focus", fetchHierarchy);
    return () => window.removeEventListener("focus", fetchHierarchy);
  }, [fetchHierarchy]);

  const totalRemaining = balances.reduce((s, b) => s + parseFloat(b.remaining || "0"), 0);
  const pendingCount   = requests.filter(r => r.status === "PENDING" || r.status === "PENDING_SECOND").length;
  const approvedCount  = requests.filter(r => r.status === "APPROVED").length;
  const recentRequests = requests.slice(0, 5);

  const statCards = [
    {
      label: "Jours de cong\u00e9 restants",
      value: loading ? "\u2026" : totalRemaining.toFixed(1),
      sub: `Ann\u00e9e ${new Date().getFullYear()}`,
      icon: <CalendarDays size={22} />,
      color: "bg-blue-50 text-camublue-900",
      link: "/employee/leaves",
    },
    {
      label: "Demandes en cours",
      value: loading ? "\u2026" : pendingCount,
      sub: `${approvedCount} approuv\u00e9e(s)`,
      icon: <Clock size={22} />,
      color: "bg-amber-50 text-amber-700",
      link: "/employee/leaves",
    },
    {
      label: "Bulletins disponibles",
      value: loading || bulletinCount === null ? "\u2026" : bulletinCount,
      sub: "Bulletins de salaire",
      icon: <BadgeDollarSign size={22} />,
      color: "bg-green-50 text-green-700",
      link: "/employee/payslips",
    },
    {
      label: "Documents dans mon dossier",
      value: loading || docCount === null ? "\u2026" : docCount,
      sub: "Fichiers accessibles",
      icon: <FolderOpen size={22} />,
      color: "bg-purple-50 text-purple-700",
      link: "/employee/dossier",
    },
  ];

  // Show N+2 when either the flag is set OR a N+2 manager is actually assigned
  const showN2 = hierarchy ? (hierarchy.requires_two_approvals || !!hierarchy.n2_manager) : false;

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
            Bonjour, {user?.employee_name?.split(" ")[0] || user?.username} \uD83D\uDC4B
          </h1>
          <p className="text-gray-500 mt-1">
            Voici un r\u00e9sum\u00e9 de votre situation RH.
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
                <div className={`inline-flex p-2.5 rounded-xl mb-3 ${card.color}`}>
                  {card.icon}
                </div>
                <div className="text-2xl font-bold text-gray-800">{card.value}</div>
                <div className="text-sm font-medium text-gray-700 mt-0.5">{card.label}</div>
                <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Soldes de cong\u00e9s */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp size={18} className="text-camublue-900" />
                Soldes de cong\u00e9s {new Date().getFullYear()}
              </h2>
              <Link to="/employee/leaves" className="text-xs text-camublue-900 hover:underline">
                Voir tout \u2192
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : balances.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Aucun solde disponible</p>
            ) : (
              <div className="space-y-3">
                {balances.map((b) => {
                  const rem  = parseFloat(b.remaining || "0");
                  const acq  = parseFloat(b.acquired || "0");
                  const pct  = acq > 0 ? Math.min(100, (rem / acq) * 100) : 0;
                  return (
                    <div key={b.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{b.leave_type.label}</span>
                        <span className="text-sm font-bold text-camublue-900">{rem.toFixed(1)}j</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-camublue-900 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Acquis : {acq.toFixed(1)}j \u00b7 Pris : {parseFloat(b.taken || "0").toFixed(1)}j
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Derni\u00e8res demandes */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <CalendarDays size={18} className="text-camublue-900" />
                Mes derni\u00e8res demandes
              </h2>
              <Link to="/employee/leaves" className="text-xs text-camublue-900 hover:underline">
                Voir tout \u2192
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
                <p className="text-gray-400 text-sm mb-3">Aucune demande de cong\u00e9</p>
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
                            {MONTHS_FR[d.getMonth()]} {d.getFullYear()} \u00b7 {req.days}j
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

        {/* \u2500\u2500 Arborescence de validation \u2500\u2500 */}
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
                Voir mes cong\u00e9s \u2192
              </Link>
            </div>
            <p className="text-xs text-gray-400 mb-4">Circuit de validation appliqu\u00e9 \u00e0 vos demandes de cong\u00e9</p>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-0 sm:gap-3 justify-center">
              {/* Employ\u00e9 (moi) */}
              <div className="flex flex-col items-center text-center min-w-[140px]">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-2">
                  <User size={22} className="text-blue-700" />
                </div>
                <span className="text-xs font-bold text-blue-800 leading-tight">{hierarchy.employee.full_name}</span>
                <span className="text-[10px] text-blue-500 mt-0.5">{hierarchy.employee.fonction || hierarchy.employee.service}</span>
                <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1">Vous</span>
              </div>

              {/* Connecteur \u2192 */}
              <div className="flex flex-col sm:flex-row items-center justify-center py-1 sm:py-0 sm:pt-5">
                <ArrowDown size={16} className="text-gray-300 sm:hidden" />
                <div className="hidden sm:block w-8 h-0.5 bg-gray-300 rounded" />
                <div className="hidden sm:block w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-gray-300" />
              </div>

              {/* N+1 */}
              <div className="flex flex-col items-center text-center min-w-[140px]">
                <div className={`p-3 rounded-xl mb-2 ${hierarchy.n1_manager ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-200"}`}>
                  <ShieldCheck size={22} className={hierarchy.n1_manager ? "text-amber-700" : "text-gray-400"} />
                </div>
                {hierarchy.n1_manager ? (
                  <>
                    <span className="text-xs font-bold text-amber-800 leading-tight">{hierarchy.n1_manager.full_name}</span>
                    <span className="text-[10px] text-amber-500 mt-0.5">{hierarchy.n1_manager.fonction || hierarchy.n1_manager.service}</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400 italic">Non d\u00e9fini</span>
                )}
                <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1">N+1</span>
              </div>

              {/* N+2 : affich\u00e9 si requires_two_approvals OU si un N+2 est renseign\u00e9 */}
              {showN2 && (
                <>
                  <div className="flex flex-col sm:flex-row items-center justify-center py-1 sm:py-0 sm:pt-5">
                    <ArrowDown size={16} className="text-gray-300 sm:hidden" />
                    <div className="hidden sm:block w-8 h-0.5 bg-gray-300 rounded" />
                    <div className="hidden sm:block w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-gray-300" />
                  </div>

                  <div className="flex flex-col items-center text-center min-w-[140px]">
                    <div className={`p-3 rounded-xl mb-2 ${hierarchy.n2_manager ? "bg-orange-50 border border-orange-200" : "bg-gray-50 border border-gray-200"}`}>
                      <ShieldCheck size={22} className={hierarchy.n2_manager ? "text-orange-700" : "text-gray-400"} />
                    </div>
                    {hierarchy.n2_manager ? (
                      <>
                        <span className="text-xs font-bold text-orange-800 leading-tight">{hierarchy.n2_manager.full_name}</span>
                        <span className="text-[10px] text-orange-500 mt-0.5">{hierarchy.n2_manager.fonction || hierarchy.n2_manager.service}</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Non d\u00e9fini</span>
                    )}
                    <span className="text-[9px] font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded mt-1">N+2</span>
                  </div>
                </>
              )}

              {/* Connecteur \u2192 RH */}
              <div className="flex flex-col sm:flex-row items-center justify-center py-1 sm:py-0 sm:pt-5">
                <ArrowDown size={16} className="text-gray-300 sm:hidden" />
                <div className="hidden sm:block w-8 h-0.5 bg-gray-300 rounded" />
                <div className="hidden sm:block w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-gray-300" />
              </div>

              {/* RH */}
              <div className="flex flex-col items-center text-center min-w-[140px]">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-2">
                  <CheckCircle2 size={22} className="text-emerald-700" />
                </div>
                <span className="text-xs font-bold text-emerald-800 leading-tight">Service RH</span>
                <span className="text-[10px] text-emerald-500 mt-0.5">Validation finale</span>
                <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1">RH</span>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </EmployeeLayout>
  );
}
