import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  CalendarDays, ClipboardCheck, CheckCircle2,
  AlertCircle, TrendingUp, ArrowRight, Clock, Users,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import ManagerLayout from "@/layouts/ManagerLayout";
import { leaveBalanceService, leaveRequestService } from "@/services/leaveService";
import { LeaveBalance, LeaveRequest } from "@/types/leave";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

const STATUS_COLOR: Record<string, string> = {
  PENDING:        "bg-amber-100 text-amber-700",
  PENDING_SECOND: "bg-orange-100 text-orange-700",
  APPROVED:       "bg-green-100 text-green-700",
  REJECTED:       "bg-red-100 text-red-700",
  CANCELLED:      "bg-gray-100 text-gray-500",
  REVOKED:        "bg-purple-100 text-purple-700",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING:        "En attente",
  PENDING_SECOND: "2ème validation",
  APPROVED:       "Approuvé",
  REJECTED:       "Rejeté",
  CANCELLED:      "Annulé",
  REVOKED:        "Révoqué",
};

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [balances,        setBalances]        = useState<LeaveBalance[]>([]);
  const [ownRequests,     setOwnRequests]     = useState<LeaveRequest[]>([]);
  const [pendingSubords,  setPendingSubords]  = useState<LeaveRequest[]>([]);
  const [approvedThisMonth, setApprovedThisMonth] = useState(0);
  const [loading,         setLoading]         = useState(true);

  const refresh = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    const year  = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    try {
      const [bal, ownReqs, pending, pendingSecond, approvedAll] = await Promise.all([
        leaveBalanceService.getByEmployee(employeeId, year),
        leaveRequestService.getByEmployee(employeeId),
        leaveRequestService.getAll({ manager_employee_id: employeeId, status: "PENDING" } as any),
        leaveRequestService.getAll({ manager_employee_id: employeeId, status: "PENDING_SECOND" } as any),
        leaveRequestService.getAll({ manager_employee_id: employeeId, status: "APPROVED", year } as any),
      ]);

      setBalances(bal);
      setOwnRequests((ownReqs as LeaveRequest[]).slice(0, 4));

      // Exclure les propres demandes du manager
      const othersP  = (pending        as LeaveRequest[]).filter(r => r.employee.id !== employeeId);
      const othersP2 = (pendingSecond  as LeaveRequest[]).filter(r => r.employee.id !== employeeId);
      setPendingSubords([...othersP, ...othersP2].slice(0, 5));

      // Approuvées ce mois
      const thisMonth = (approvedAll as LeaveRequest[]).filter(r => {
        const d = new Date(r.reviewed_at || r.updated_at);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      setApprovedThisMonth(thisMonth.length);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const totalRemaining = balances.reduce((s, b) => s + parseFloat(b.remaining || "0"), 0);

  const stats = [
    {
      label: "Jours restants",
      value: loading ? "…" : totalRemaining.toFixed(1),
      icon:  <CalendarDays size={22} />,
      color: "bg-blue-50 text-[#003c71]",
      link:  "/manager/leaves",
    },
    {
      label: "En attente",
      value: loading ? "…" : pendingSubords.length,
      icon:  <Clock size={22} />,
      color: "bg-amber-50 text-amber-700",
      link:  "/manager/approvals",
      alert: pendingSubords.length > 0,
    },
    {
      label: "Approuvées ce mois",
      value: loading ? "…" : approvedThisMonth,
      icon:  <CheckCircle2 size={22} />,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Employés en attente",
      value: loading ? "…" : new Set(pendingSubords.map(r => r.employee.id)).size,
      icon:  <Users size={22} />,
      color: "bg-purple-50 text-purple-700",
    },
  ];

  return (
    <ManagerLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl font-bold text-[#003c71]">
            Bonjour, {user?.employee_name?.split(" ")[0] ?? user?.username} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tableau de bord Manager · Niveau {user?.manager_level ?? "—"}
          </p>
        </motion.div>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <StatCard s={s} />
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Approbations en attente ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-[#003c71]" />
                <span className="font-semibold text-gray-800">Approbations en attente</span>
                {pendingSubords.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                    {pendingSubords.length}
                  </span>
                )}
              </div>
              <Link to="/manager/approvals" className="text-xs text-[#003c71] hover:underline flex items-center gap-1">
                Voir tout <ArrowRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : pendingSubords.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-200" />
                <p className="text-sm">Aucune demande en attente</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {pendingSubords.map(req => (
                  <div key={req.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#003c71]/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[#003c71]">
                        {req.employee.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{req.employee.full_name}</p>
                      <p className="text-xs text-gray-500">{req.leave_type.label} · {fmt(req.start_date)} → {fmt(req.end_date)}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLOR[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {pendingSubords.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100">
                <Link to="/manager/approvals" className="block w-full py-2 rounded-xl bg-[#003c71] text-white text-sm font-medium text-center hover:bg-[#003c71]/90 transition">
                  Valider les demandes
                </Link>
              </div>
            )}
          </motion.div>

          {/* ── Mes propres demandes ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-[#003c71]" />
                <span className="font-semibold text-gray-800">Mes dernières demandes</span>
              </div>
              <Link to="/manager/leaves" className="text-xs text-[#003c71] hover:underline flex items-center gap-1">
                Voir tout <ArrowRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : ownRequests.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <CalendarDays size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Aucune demande de congé</p>
                <Link to="/manager/leaves" className="mt-3 inline-flex items-center gap-1 text-xs text-[#003c71] hover:underline">
                  Créer une demande <ArrowRight size={11} />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {ownRequests.map(req => (
                  <div key={req.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{req.leave_type.label}</p>
                      <p className="text-xs text-gray-500">{fmt(req.start_date)} → {fmt(req.end_date)} · {parseFloat(req.days)} j</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLOR[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

        </div>

        {/* ── Soldes ── */}
        {!loading && balances.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-[#003c71]" />
                <span className="font-semibold text-gray-800">Mes soldes {new Date().getFullYear()}</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center py-4">
              <span className="text-6xl font-black text-[#003c71] leading-none">
                {totalRemaining.toFixed(1)}
              </span>
              <span className="text-sm text-gray-400 mt-2">jours restants</span>
            </div>
            <div className="mt-4 flex justify-end">
              <Link to="/manager/leaves" className="text-xs text-[#003c71] hover:underline">
                Voir tout →
              </Link>
            </div>
          </motion.div>
        )}

        {/* Alerte si pas d'employé lié */}
        {!loading && !employeeId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-3">
            <AlertCircle size={20} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700">
              Votre compte n'est pas encore associé à un dossier employé.
              Contactez l'administrateur RH pour activer toutes les fonctionnalités.
            </p>
          </motion.div>
        )}
      </div>
    </ManagerLayout>
  );
}

function StatCard({ s }: { s: { label: string; value: any; icon: React.ReactNode; color: string; link?: string; alert?: boolean } }) {
  const inner = (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all ${
      s.alert ? "border-amber-300 ring-2 ring-amber-100" : "border-gray-100 hover:border-[#003c71]/20"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`inline-flex p-2.5 rounded-xl ${s.color}`}>{s.icon}</div>
        <div className="text-3xl font-black text-gray-800">{s.value}</div>
      </div>
      <div className="text-sm font-medium text-gray-600">{s.label}</div>
    </div>
  );
  return s.link ? <Link to={s.link} className="block">{inner}</Link> : inner;
}
