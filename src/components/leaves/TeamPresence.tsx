// Affichage commun des pages « Équipe de service » (employé, manager, RH) :
// on indique seulement qu'un collègue est / part en congé et à partir de quand.
// Pas de solde, pas de date de retour, pas de nombre de jours, pas de type ni de motif.
import { motion } from "framer-motion";
import { Briefcase, Building2, Calendar, Clock, Hash, Users, X } from "lucide-react";
import { EmployeeHierarchy, LeaveRequest } from "@/types/leave";

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function toDay(d: string) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Congé validé en cours ou à venir, par employé (le plus proche s'il y en a plusieurs). */
export function approvedLeaveMap(requests: LeaveRequest[]): Map<number, LeaveRequest> {
  const today = startOfToday();
  const map = new Map<number, LeaveRequest>();
  requests
    .filter((r) => r.status === "APPROVED" && toDay(r.end_date) >= today)
    .sort((a, b) => toDay(a.start_date).getTime() - toDay(b.start_date).getTime())
    .forEach((r) => { if (!map.has(r.employee.id)) map.set(r.employee.id, r); });
  return map;
}

export function isOngoing(leave: LeaveRequest | undefined): boolean {
  return !!leave && toDay(leave.start_date) <= startOfToday();
}

export function leaveText(leave: LeaveRequest): string {
  return isOngoing(leave) ? `En congé depuis le ${fmtDate(leave.start_date)}` : `Part en congé le ${fmtDate(leave.start_date)}`;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function StatusBadge({ leave }: { leave: LeaveRequest | undefined }) {
  if (!leave) return null;
  return isOngoing(leave) ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-semibold">
      <Clock size={9} /> En congé
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 font-semibold">
      <Calendar size={9} /> Congé prévu
    </span>
  );
}

export function MemberCard({ member, leave, index, onClick }: {
  member: EmployeeHierarchy;
  leave: LeaveRequest | undefined;
  index: number;
  onClick: () => void;
}) {
  const color = isOngoing(leave) ? "#f59e0b" : leave ? "#0ea5e9" : "#003c71";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer px-4 py-3 flex items-center gap-3"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: color }}>
        {initials(member.full_name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">{member.full_name}</p>
        {leave && <p className="text-[11px] text-gray-500 truncate">{leaveText(leave)}</p>}
      </div>
      <StatusBadge leave={leave} />
    </motion.div>
  );
}

export function MemberDetailModal({ member, leave, onClose }: {
  member: EmployeeHierarchy;
  leave: LeaveRequest | undefined;
  onClose: () => void;
}) {
  const color = isOngoing(leave) ? "#f59e0b" : leave ? "#0ea5e9" : "#003c71";
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-6 py-5 flex items-center gap-3 justify-between" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/25 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initials(member.full_name)}
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">{member.full_name}</h3>
              <p className="text-white/80 text-xs mt-0.5">{leave ? leaveText(leave) : "Disponible"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition"><X size={18} /></button>
        </div>

        <div className="p-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
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
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-bold hover:bg-[#002d56] transition">
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
