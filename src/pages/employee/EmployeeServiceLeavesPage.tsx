// src/pages/employee/EmployeeServiceLeavesPage.tsx
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, RefreshCw, Search, X, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { leaveRequestService } from "@/services/leaveService";
import { LeaveRequest, EmployeeHierarchy } from "@/types/leave";
import { employeeHierarchyService } from "@/services/hierarchyService";
import { ImSpinner2 } from "react-icons/im";
import { MemberCard, MemberDetailModal, approvedLeaveMap, isOngoing } from "@/components/leaves/TeamPresence";

type LayoutComponent = React.ComponentType<{ children: React.ReactNode }>;

export default function EmployeeServiceLeavesPage({ layout: Layout = EmployeeLayout }: { layout?: LayoutComponent }) {
  const { user } = useAuth();
  const employeeId = user?.employee_id;
  const service    = user?.employee_service ?? "";

  const [members,        setMembers]        = useState<EmployeeHierarchy[]>([]);
  const [requests,       setRequests]       = useState<LeaveRequest[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [selectedMember, setSelectedMember] = useState<EmployeeHierarchy | null>(null);

  const load = useCallback(async () => {
    if (!service) { setLoading(false); return; }
    setLoading(true);
    try {
      const [hier, reqs] = await Promise.allSettled([
        employeeHierarchyService.getAll({ service }),
        leaveRequestService.getAll({ department: service, status: "APPROVED", active_or_upcoming: 1 } as any),
      ]);
      const allHier = hier.status === "fulfilled" ? hier.value : [];
      const allReqs = reqs.status === "fulfilled" ? reqs.value : [];
      setMembers(allHier.filter(m => m.id !== employeeId));
      setRequests(allReqs.filter(r => r.employee.id !== employeeId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [service, employeeId]);

  useEffect(() => { load(); }, [load]);

  // ── Dérivés ────────────────────────────────────────────────────────────────
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
    <Layout>
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
                {service ? `${service} · qui est en congé` : "Membres du service · qui est en congé"}
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
    </Layout>
  );
}
