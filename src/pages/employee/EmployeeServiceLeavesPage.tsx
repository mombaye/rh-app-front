// src/pages/employee/EmployeeServiceLeavesPage.tsx
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Calendar, RefreshCw, Search, X, Clock,
  Hash, Building2, Briefcase, Bell,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { leaveRequestService, leaveBalanceService } from "@/services/leaveService";
import { LeaveRequest, LeaveBalance } from "@/types/leave";
import { employeeHierarchyService } from "@/services/hierarchyService";
import { EmployeeHierarchy } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtRelative(d: string) {
  const diff = Math.round((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  return `il y a ${diff} j`;
}

function daysRemaining(endDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(endDate); end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
}

function daysElapsed(startDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(startDate); start.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((today.getTime() - start.getTime()) / 86_400_000));
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Carte notification (demande en attente) ──────────────────────────────────
function PendingNotifCard({ req, index }: { req: LeaveRequest; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl"
    >
      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
        <Clock size={16} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-semibold text-gray-800 text-sm">{req.employee.full_name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-semibold border border-amber-300">
            En attente
          </span>
        </div>
        <p className="text-xs text-gray-600">
          {req.leave_type?.label} · {fmt(req.start_date)} → {fmt(req.end_date)}
          <span className="text-gray-400"> · {parseFloat(req.days)} j</span>
        </p>
        {req.motif && (
          <p className="text-[11px] text-gray-400 italic mt-0.5 truncate">"{req.motif}"</p>
        )}
      </div>
      <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{fmtRelative(req.created_at)}</span>
    </motion.div>
  );
}

// ─── Badge solde ──────────────────────────────────────────────────────────────
function BalancePill({ remaining }: { remaining: number | null }) {
  if (remaining === null) {
    return <span className="text-sm font-bold text-gray-300">— j</span>;
  }
  return (
    <span className="text-base font-bold text-blue-600">
      {remaining} j
    </span>
  );
}

// ─── Modal détail membre ──────────────────────────────────────────────────────
function MemberDetailModal({
  member, leave, balance, onClose,
}: {
  member:  EmployeeHierarchy;
  leave:   LeaveRequest | undefined;
  balance: LeaveBalance | undefined;
  onClose: () => void;
}) {
  const isOnLeave = !!leave;
  const remaining = balance ? parseFloat(balance.remaining) : null;
  const color     = isOnLeave ? (leave.leave_type?.color ?? "#f59e0b") : "#003c71";

  const total    = leave ? parseFloat(leave.days ?? leave.duration_days ?? "0") : 0;
  const elapsed  = leave ? daysElapsed(leave.start_date)  : 0;
  const leftover = leave ? daysRemaining(leave.end_date)  : 0;
  const progress = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;

  const initials = getInitials(member.full_name);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: 24, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-center gap-3 justify-between" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/25 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initials}
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">{member.full_name}</h3>
              <p className="text-white/80 text-xs mt-0.5">
                {isOnLeave ? "En congé" : "Disponible"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">

          {/* Infos employé */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Employé</p>
            {member.matricule && (
              <div className="flex items-center gap-2 text-sm">
                <Hash size={13} className="text-gray-400 shrink-0" />
                <span className="font-semibold text-gray-700">{member.matricule}</span>
              </div>
            )}
            {member.fonction && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase size={13} className="text-gray-400 shrink-0" />
                <span className="text-gray-600">{member.fonction}</span>
              </div>
            )}
            {member.service && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={13} className="text-gray-400 shrink-0" />
                <span className="text-gray-600">{member.service}</span>
              </div>
            )}
            {member.n1_manager_name && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Users size={12} className="text-gray-300 shrink-0" />
                Manager N+1 : <span className="font-medium">{member.n1_manager_name}</span>
              </div>
            )}
          </div>

          {/* Solde congé */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">Solde congé restant</p>
            {balance ? (
              <span className="text-2xl font-bold text-blue-600">{remaining ?? "—"} j</span>
            ) : (
              <span className="text-sm text-gray-400 italic">Non renseigné</span>
            )}
          </div>

          {/* Congé en cours */}
          {isOnLeave && leave && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Congé en cours</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800">{leave.leave_type?.label ?? "Congé"}</span>
                <span className="text-xs font-bold text-white bg-orange-400 px-2 py-0.5 rounded-md">{total} j</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Calendar size={13} className="text-gray-400" />
                {fmt(leave.start_date)} → {fmt(leave.end_date)}
              </div>
              {leave.motif && (
                <p className="text-xs text-gray-500 italic">"{leave.motif}"</p>
              )}
              <div className="space-y-1.5">
                <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full bg-orange-400"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>{elapsed}j écoulé{elapsed > 1 ? "s" : ""}</span>
                  <span className={leftover <= 2 ? "text-red-500 font-semibold" : ""}>{leftover}j restant{leftover > 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-bold hover:bg-[#002d56] transition"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Carte membre ─────────────────────────────────────────────────────────────
function MemberCard({
  member, leave, balance, index, onClick,
}: {
  member:  EmployeeHierarchy;
  leave:   LeaveRequest | undefined;
  balance: LeaveBalance | undefined;
  index:   number;
  onClick: () => void;
}) {
  const isOnLeave = !!leave;
  const remaining = balance ? parseFloat(balance.remaining) : null;
  const initials  = getInitials(member.full_name);
  const color     = isOnLeave ? (leave.leave_type?.color ?? "#f59e0b") : "#003c71";

  const total    = leave ? (parseFloat(leave.days ?? leave.duration_days ?? "0")) : 0;
  const elapsed  = leave ? daysElapsed(leave.start_date)   : 0;
  const leftover = leave ? daysRemaining(leave.end_date)   : 0;
  const progress = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>

        {/* Nom */}
        <span className="flex-1 font-semibold text-gray-800 text-sm truncate">{member.full_name}</span>

        {/* Solde CP + badge en congé */}
        <div className="flex items-center gap-2 shrink-0">
          {isOnLeave && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-semibold">
              <Clock size={9} /> En congé
            </span>
          )}
          <BalancePill remaining={remaining} />
        </div>
      </div>

      {/* Barre de progression si en congé */}
      {isOnLeave && leave && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-1.5">
            <span className="font-medium text-gray-600">{leave.leave_type?.label ?? "Congé"}</span>
            <span>·</span>
            <span>{fmt(leave.start_date)} → {fmt(leave.end_date)}</span>
            <span className="ml-auto font-semibold text-gray-500">{total} j</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, delay: index * 0.04 + 0.2 }}
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{elapsed}j écoulés</span>
            <span className={leftover <= 2 ? "text-red-500 font-semibold" : ""}>{leftover}j restants</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EmployeeServiceLeavesPage() {
  const { user } = useAuth();
  const employeeId = user?.employee_id;
  const service    = user?.employee_service ?? "";

  const [members,        setMembers]        = useState<EmployeeHierarchy[]>([]);
  const [requests,       setRequests]       = useState<LeaveRequest[]>([]);
  const [balances,       setBalances]       = useState<LeaveBalance[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [selectedMember, setSelectedMember] = useState<EmployeeHierarchy | null>(null);

  const load = useCallback(async () => {
    if (!service) { setLoading(false); return; }
    setLoading(true);
    try {
      const [hier, reqs, bals] = await Promise.allSettled([
        employeeHierarchyService.getAll({ service }),
        leaveRequestService.getAll({ department: service } as any),
        leaveBalanceService.getAll(currentYear),
      ]);

      const allHier = hier.status === "fulfilled" ? hier.value : [];
      const allReqs = reqs.status === "fulfilled" ? reqs.value : [];
      const allBals = bals.status === "fulfilled" ? bals.value : [];

      const team = allHier.filter(m => m.id !== employeeId);
      setMembers(team);

      const cpBals = allBals.filter(b =>
        (b.leave_type as any)?.code === "CP" || (b.leave_type as any)?.label?.toLowerCase().includes("payé")
      );
      setBalances(cpBals.length > 0 ? cpBals : allBals);
      setRequests(allReqs.filter(r => r.employee.id !== employeeId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [service, employeeId]);

  useEffect(() => { load(); }, [load]);

  // ── Dérivés ────────────────────────────────────────────────────────────────
  const pending    = requests.filter(r => r.status === "PENDING" || r.status === "PENDING_SECOND");
  const inProgress = requests.filter(r => r.is_in_progress && r.status === "APPROVED");

  const inProgressMap = new Map(inProgress.map(r => [r.employee.id, r]));
  const balanceMap    = new Map(balances.map(b => [b.employee, b]));

  const q        = search.trim().toLowerCase();
  const filtered = members.filter(m =>
    !q ||
    m.full_name.toLowerCase().includes(q) ||
    (m.matricule ?? "").toLowerCase().includes(q) ||
    (m.service   ?? "").toLowerCase().includes(q)
  );

  const sorted = [...filtered].sort((a, b) => {
    const aOn = inProgressMap.has(a.id) ? 0 : 1;
    const bOn = inProgressMap.has(b.id) ? 0 : 1;
    if (aOn !== bOn) return aOn - bOn;
    return a.full_name.localeCompare(b.full_name);
  });

  const onLeaveCount = members.filter(m => inProgressMap.has(m.id)).length;

  return (
    <EmployeeLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#003c71] text-white shrink-0">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#003c71]">Mon équipe de service</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {service ? `${service} · solde de congé · statut` : "Membres du service · solde de congé · statut"}
              </p>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </motion.div>

        {/* ── Stats rapides ────────────────────────────────────────────────── */}
        {!loading && members.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            {[
              { label: "Membres",      count: members.length,                dot: "bg-slate-400"  },
              { label: "En congé",     count: onLeaveCount,                  dot: "bg-orange-400" },
              { label: "Disponibles",  count: members.length - onLeaveCount, dot: "bg-green-500"  },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-[#003c71]">{s.count}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Notifications (demandes en attente) ─────────────────────────── */}
        <AnimatePresence>
          {!loading && pending.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-amber-100 flex items-center gap-2">
                <Bell size={15} className="text-amber-500" />
                <span className="font-semibold text-gray-800 text-sm">Demandes en attente dans le service</span>
                <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  {pending.length}
                </span>
              </div>
              <div className="p-4 space-y-2">
                {pending.map((req, i) => (
                  <PendingNotifCard key={req.id} req={req} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Recherche ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="relative mb-6 max-w-2xl mx-auto"
        >
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher par nom, matricule, service…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition bg-white shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </motion.div>

        {/* ── Contenu ─────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-3">
              <ImSpinner2 className="animate-spin text-[#003c71]" size={28} />
              <p className="text-gray-400 text-sm">Chargement de l'équipe…</p>
            </motion.div>
          ) : !service ? (
            <motion.div key="no-service" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Building2 size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">Aucun service associé à votre compte</p>
            </motion.div>
          ) : sorted.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Users size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">
                {search ? "Aucun résultat pour cette recherche" : "Aucun collègue trouvé dans ce service"}
              </p>
            </motion.div>
          ) : (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sorted.map((member, i) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  leave={inProgressMap.get(member.id)}
                  balance={balanceMap.get(member.id)}
                  index={i}
                  onClick={() => setSelectedMember(member)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal détail membre */}
      <AnimatePresence>
        {selectedMember && (
          <MemberDetailModal
            member={selectedMember}
            leave={inProgressMap.get(selectedMember.id)}
            balance={balanceMap.get(selectedMember.id)}
            onClose={() => setSelectedMember(null)}
          />
        )}
      </AnimatePresence>
    </EmployeeLayout>
  );
}
