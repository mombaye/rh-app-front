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
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { leaveBalanceService, leaveRequestService } from "@/services/leaveService";
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
      <div className="max-w-5xl mx-auto px-4 md:px-0">
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
          {/* Soldes de congés */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp size={18} className="text-camublue-900" />
                Soldes de congés {new Date().getFullYear()}
              </h2>
              <Link to="/employee/leaves" className="text-xs text-camublue-900 hover:underline">
                Voir tout →
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
                        Acquis : {acq.toFixed(1)}j · Pris : {parseFloat(b.taken || "0").toFixed(1)}j
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
      </div>
    </EmployeeLayout>
  );
}
