// src/pages/manager/ManagerTeamContractsPage.tsx
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Search, X, RefreshCw,
  Building2, Briefcase, Calendar, AlertCircle, Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/useAuth";
import ManagerLayout from "@/layouts/ManagerLayout";

type LayoutComponent = React.ComponentType<{ children: React.ReactNode }>;
import { employeeHierarchyService } from "@/services/hierarchyService";
import { EmployeeHierarchy } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONTRACT_LABELS: Record<string, string> = {
  CDI:      "CDI",
  CDD:      "CDD",
  INTERIM:  "Intérimaire",
  STAGE:    "Stagiaire",
  FREELANCE: "Freelance",
};

const CONTRACT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CDI:      { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  CDD:      { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  INTERIM:  { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200"  },
  STAGE:    { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200"    },
  FREELANCE:{ bg: "bg-gray-50",    text: "text-gray-700",    border: "border-gray-200"    },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function daysUntilExpiry(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end   = new Date(dateStr); end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function ContractBadge({ type }: { type: string | null | undefined }) {
  if (!type) return <span className="text-xs text-gray-400 italic">Non renseigné</span>;
  const label  = CONTRACT_LABELS[type] ?? type;
  const colors = CONTRACT_COLORS[type] ?? { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
      {label}
    </span>
  );
}


// ─── Carte membre ─────────────────────────────────────────────────────────────
function MemberCard({ member, index }: { member: EmployeeHierarchy; index: number }) {
  const daysLeft = daysUntilExpiry(member.date_fin_cdd);
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 60;
  const isExpired      = daysLeft !== null && daysLeft < 0;
  const isCdd          = member.type_contrat === "CDD";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
        isExpired      ? "border-red-200 ring-1 ring-red-100" :
        isExpiringSoon ? "border-amber-200 ring-1 ring-amber-100" :
        "border-gray-100"
      }`}
    >
      {/* Header carte */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#003c71]/10 flex items-center justify-center text-xs font-bold text-[#003c71] shrink-0">
          {getInitials(member.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{member.full_name}</p>
          <p className="text-xs text-gray-400 truncate">{member.matricule}</p>
        </div>
        <ContractBadge type={member.type_contrat} />
      </div>

      {/* Détails */}
      <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
        {member.fonction && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Briefcase size={12} className="text-gray-400 shrink-0" />
            <span className="truncate">{member.fonction}</span>
          </div>
        )}
        {member.service && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Building2 size={12} className="text-gray-400 shrink-0" />
            <span className="truncate">{member.service}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Calendar size={12} className="text-gray-400 shrink-0" />
          <span>Embauche : <span className="font-medium text-gray-700">{fmtDate(member.date_embauche)}</span></span>
        </div>

        {isCdd && (
          <div className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 mt-1 ${
            isExpired      ? "bg-red-50 text-red-700" :
            isExpiringSoon ? "bg-amber-50 text-amber-700" :
            "bg-gray-50 text-gray-600"
          }`}>
            {isExpired ? (
              <AlertCircle size={12} className="shrink-0" />
            ) : isExpiringSoon ? (
              <Clock size={12} className="shrink-0" />
            ) : (
              <Calendar size={12} className="text-gray-400 shrink-0" />
            )}
            <span>
              Fin CDD : <span className="font-medium">{fmtDate(member.date_fin_cdd)}</span>
              {daysLeft !== null && (
                <span className="ml-1">
                  {isExpired
                    ? `(expiré il y a ${Math.abs(daysLeft)} j)`
                    : `(dans ${daysLeft} j)`}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ManagerTeamContractsPage({
  layout: Layout = ManagerLayout,
  fetchAll = false,
}: {
  layout?: LayoutComponent;
  fetchAll?: boolean;
}) {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [members, setMembers] = useState<EmployeeHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const load = useCallback(async () => {
    if (!fetchAll && !employeeId) return;
    setLoading(true);
    try {
      const params = fetchAll ? {} : { department_head_id: employeeId };
      const all = await employeeHierarchyService.getAll(params as Parameters<typeof employeeHierarchyService.getAll>[0]);
      setMembers(fetchAll ? all : all.filter(m => m.id !== employeeId));
    } catch {
      toast.error("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, [employeeId, fetchAll]);

  useEffect(() => { load(); }, [load]);

  // ── Dérivés ──────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const filtered = members.filter(m => {
    const matchSearch =
      !q ||
      m.full_name.toLowerCase().includes(q) ||
      (m.matricule ?? "").toLowerCase().includes(q) ||
      (m.service   ?? "").toLowerCase().includes(q) ||
      (m.fonction  ?? "").toLowerCase().includes(q);

    const matchType =
      filterType === "ALL" ||
      (filterType === "EXPIRING" && (() => {
        const d = daysUntilExpiry(m.date_fin_cdd);
        return d !== null && d >= 0 && d <= 60;
      })()) ||
      m.type_contrat === filterType;

    return matchSearch && matchType;
  });

  const sorted = [...filtered].sort((a, b) => {
    // CDD expirant bientôt en premier
    const dA = daysUntilExpiry(a.date_fin_cdd);
    const dB = daysUntilExpiry(b.date_fin_cdd);
    if (dA !== null && dB !== null) return dA - dB;
    if (dA !== null) return -1;
    if (dB !== null) return 1;
    return a.full_name.localeCompare(b.full_name);
  });

  // Stats
  const cddCount        = members.filter(m => m.type_contrat === "CDD").length;
  const cdiCount        = members.filter(m => m.type_contrat === "CDI").length;
  const expiringCount   = members.filter(m => {
    const d = daysUntilExpiry(m.date_fin_cdd);
    return d !== null && d >= 0 && d <= 60;
  }).length;

  const contractTypes = [...new Set(members.map(m => m.type_contrat).filter(Boolean))] as string[];

  return (
    <Layout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#003c71] text-white shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#003c71]">
                {fetchAll ? "Contrats des employés" : "Contrats de l'équipe"}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Type de contrat · date d'embauche · échéance CDD
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

        {/* ── Stats ── */}
        {!loading && members.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            {[
              { label: "Membres",          count: members.length,  dot: "bg-slate-400"  },
              { label: "CDI",              count: cdiCount,        dot: "bg-green-500"  },
              { label: "CDD",              count: cddCount,        dot: "bg-amber-400"  },
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

        {/* ── Alerte CDD expirant ── */}
        <AnimatePresence>
          {!loading && expiringCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4"
            >
              <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{expiringCount} contrat{expiringCount > 1 ? "s" : ""} CDD</span>{" "}
                arrive{expiringCount > 1 ? "nt" : ""} à échéance dans moins de 60 jours.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Recherche + Filtres ── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="flex items-center gap-3 mb-6 w-full"
        >
          {/* Recherche — prend tout l'espace restant */}
          <div className="relative flex-1">
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
          </div>

          {/* Filtres type contrat */}
          <div className="flex gap-2 shrink-0">
            {[
              { key: "ALL",      label: "Tous" },
              { key: "EXPIRING", label: "⚠ Expirant" },
              ...contractTypes.map(t => ({ key: t, label: CONTRACT_LABELS[t] ?? t })),
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-2.5 rounded-2xl text-xs font-semibold border transition whitespace-nowrap ${
                  filterType === f.key
                    ? "bg-[#003c71] text-white border-[#003c71]"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Contenu ── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-3">
              <ImSpinner2 className="animate-spin text-[#003c71]" size={28} />
              <p className="text-gray-400 text-sm">Chargement des contrats…</p>
            </motion.div>
          ) : sorted.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <FileText size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">
                {search || filterType !== "ALL" ? "Aucun résultat" : "Aucun membre d'équipe"}
              </p>
            </motion.div>
          ) : (
            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {sorted.map((member, i) => (
                <MemberCard key={member.id} member={member} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
