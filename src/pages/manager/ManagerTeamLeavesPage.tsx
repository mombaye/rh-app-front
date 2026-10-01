// src/pages/manager/ManagerTeamLeavesPage.tsx
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Users, RefreshCw, Search, X, Clock, Download, Bell } from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/useAuth";
import ManagerLayout from "@/layouts/ManagerLayout";
import { leaveRequestService } from "@/services/leaveService";
import { LeaveRequest, EmployeeHierarchy } from "@/types/leave";
import { employeeHierarchyService } from "@/services/hierarchyService";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import { onEmployeesSynced } from "@/utils/employeeSync";
import {
  MemberCard, MemberDetailModal, approvedLeaveMap, fmtDate, isOngoing,
} from "@/components/leaves/TeamPresence";

function fmtRelative(d: string) {
  const diff = Math.round((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  return `il y a ${diff} j`;
}

// ─── Export Excel : statut et date de départ uniquement ──────────────────────
function exportExcel(members: EmployeeHierarchy[], leaveMap: Map<number, LeaveRequest>) {
  const data = members.map(m => {
    const leave = leaveMap.get(m.id);
    return {
      "Employé":         m.full_name,
      "Matricule":       m.matricule ?? "—",
      "Service":         m.service   ?? "—",
      "Fonction":        m.fonction  ?? "—",
      "Statut":          !leave ? "Disponible" : isOngoing(leave) ? "En congé" : "Congé prévu",
      "Départ en congé": leave ? fmtDate(leave.start_date) : "—",
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Équipe ${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}`);
  XLSX.writeFile(wb, `equipe_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success("Export Excel généré.");
}

// ─── Demande en attente (détails complets dans « Validation demande ») ────────
function PendingNotifCard({ req, index }: { req: LeaveRequest; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl"
    >
      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
        <Clock size={16} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">{req.employee.full_name}</p>
        <p className="text-xs text-gray-600">Demande de congé à partir du {fmtDate(req.start_date)}</p>
      </div>
      <span className="text-[11px] text-gray-400 shrink-0">{fmtRelative(req.created_at)}</span>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ManagerTeamLeavesPage() {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [members,        setMembers]        = useState<EmployeeHierarchy[]>([]);
  const [requests,       setRequests]       = useState<LeaveRequest[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [selectedMember, setSelectedMember] = useState<EmployeeHierarchy | null>(null);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const [hier, reqs] = await Promise.allSettled([
        employeeHierarchyService.getAll({ department_head_id: employeeId }),
        leaveRequestService.getAll({ manager_employee_id: employeeId } as any),
      ]);
      const allHier = hier.status === "fulfilled" ? hier.value : [];
      const allReqs = reqs.status === "fulfilled" ? reqs.value : [];
      // Le backend filtre déjà par n1_manager_id — on exclut juste le manager lui-même
      setMembers(allHier.filter(m => m.id !== employeeId));
      setRequests(allReqs.filter(r => r.employee.id !== employeeId));
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors du chargement de l'équipe.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { return onEmployeesSynced(() => { load(); }); }, [load]);

  // ── Dérivés ────────────────────────────────────────────────────────────────
  const pending  = requests.filter(r => r.status === "PENDING" || r.status === "PENDING_SECOND");
  const leaveMap = approvedLeaveMap(requests);

  const q        = search.trim().toLowerCase();
  const filtered = members.filter(m =>
    !q ||
    m.full_name.toLowerCase().includes(q) ||
    (m.matricule ?? "").toLowerCase().includes(q) ||
    (m.service   ?? "").toLowerCase().includes(q)
  );

  // En congé d'abord, puis congés prévus, puis les autres par nom
  const rank = (id: number) => { const l = leaveMap.get(id); return !l ? 2 : isOngoing(l) ? 0 : 1; };
  const sorted = [...filtered].sort((a, b) => rank(a.id) - rank(b.id) || a.full_name.localeCompare(b.full_name));

  const onLeaveCount = members.filter(m => isOngoing(leaveMap.get(m.id))).length;

  return (
    <ManagerLayout>
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
              <h1 className="text-2xl font-bold text-[#003c71]">Mon équipe</h1>
              <p className="text-gray-500 text-sm mt-0.5">Membres du service · qui est en congé</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => exportExcel(members, leaveMap)}
              disabled={loading || members.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold hover:bg-[#002d56] transition shadow-sm disabled:opacity-40"
            >
              <Download size={15} /> Exporter
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Actualiser
            </button>
          </div>
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

        {/* ── Demandes en attente de validation ───────────────────────────── */}
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
                <span className="font-semibold text-gray-800 text-sm">Demandes en attente de validation</span>
                <Link to="/manager/approvals" className="ml-auto text-xs text-[#003c71] hover:underline">Voir le détail</Link>
                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">
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
          ) : sorted.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Users size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">
                {search ? "Aucun résultat pour cette recherche" : "Aucun membre d'équipe trouvé"}
              </p>
            </motion.div>
          ) : (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sorted.map((member, i) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  leave={leaveMap.get(member.id)}
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
            leave={leaveMap.get(selectedMember.id)}
            onClose={() => setSelectedMember(null)}
          />
        )}
      </AnimatePresence>
    </ManagerLayout>
  );
}
