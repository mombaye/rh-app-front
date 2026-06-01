// src/pages/employee/EmployeeServiceLeavesPage.tsx
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Calendar, RefreshCw, Search, X, Clock,
  Hash, Building2, Briefcase,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";

type LayoutComponent = React.ComponentType<{ children: React.ReactNode }>;
import { leaveRequestService } from "@/services/leaveService";
import { LeaveRequest } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
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

// ─── Carte ───────────────────────────────────────────────────────────────────
function LeaveCard({ req, index }: { req: LeaveRequest; index: number }) {
  const total     = parseFloat(req.days ?? req.duration_days ?? "0");
  const elapsed   = daysElapsed(req.start_date);
  const remaining = daysRemaining(req.end_date);
  const progress  = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
  const color     = req.leave_type?.color ?? "#003c71";
  const initials  = getInitials(req.employee.full_name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            {/* Nom */}
            <p className="font-bold text-gray-800 text-sm mb-0.5">{req.employee.full_name}</p>

            {/* Matricule · Service · Fonction */}
            <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-2 flex-wrap">
              {req.employee.matricule && (
                <span className="flex items-center gap-1">
                  <Hash size={10} />{req.employee.matricule}
                </span>
              )}
              {req.employee.service && (
                <>
                  <span className="text-gray-200">·</span>
                  <span className="flex items-center gap-1">
                    <Building2 size={10} />{req.employee.service}
                  </span>
                </>
              )}
              {req.employee.fonction && (
                <>
                  <span className="text-gray-200">·</span>
                  <span className="flex items-center gap-1">
                    <Briefcase size={10} />{req.employee.fonction}
                  </span>
                </>
              )}
            </div>

            {/* Type · Dates · Durée */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                {req.leave_type?.label ?? "Congé"}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={11} className="text-gray-400" />
                {fmt(req.start_date)} → {fmt(req.end_date)}
              </span>
              <span className="text-xs font-bold text-gray-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">
                {total} j
              </span>
            </div>

            {/* Barre de progression */}
            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.6, delay: index * 0.04 + 0.2 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock size={9} />
                  {elapsed}j écoulé{elapsed > 1 ? "s" : ""}
                </span>
                <span className={remaining <= 2 ? "text-red-500 font-semibold" : ""}>
                  {remaining}j restant{remaining > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EmployeeServiceLeavesPage({ layout: Layout = EmployeeLayout }: { layout?: LayoutComponent }) {
  const { user } = useAuth();

  const [all,     setAll]     = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  const service = user?.employee_service ?? "";

  const load = useCallback(async () => {
    if (!service) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await leaveRequestService.getAll({
        department: service,
        status: "APPROVED",
      } as any);
      // Exclure l'employé lui-même
      const others = data.filter(
        (r: LeaveRequest) => r.is_in_progress && r.employee.id !== user?.employee_id,
      );
      setAll(others);
    } catch {
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, [service, user?.employee_id]);

  useEffect(() => { load(); }, [load]);

  const q        = search.trim().toLowerCase();
  const filtered = all.filter(r =>
    !q ||
    r.employee.full_name.toLowerCase().includes(q) ||
    (r.employee.matricule ?? "").toLowerCase().includes(q)
  );

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
              <h1 className="text-2xl font-bold text-[#003c71]">
                Service en congé
                {!loading && (
                  <span className="ml-2 text-base font-bold text-white bg-[#003c71] rounded-full px-2.5 py-0.5 align-middle">
                    {all.length}
                  </span>
                )}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {service
                  ? `Collègues actuellement en congé — ${service}`
                  : "Collègues actuellement en congé"}
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

        {/* ── Recherche centrée ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative mb-6 max-w-2xl mx-auto"
        >
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher par nom, matricule…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition bg-white shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
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
              <p className="text-gray-400 text-sm">Chargement…</p>
            </motion.div>
          ) : !service ? (
            <motion.div key="no-service" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Building2 size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">Aucun service associé à votre compte</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Users size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">
                {search ? "Aucun résultat pour cette recherche" : "Aucun collègue en congé en ce moment"}
              </p>
              {!search && <p className="text-sm text-gray-300 mt-1">Tout le service est disponible 🎉</p>}
            </motion.div>
          ) : (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((req, i) => (
                <LeaveCard key={req.id} req={req} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
