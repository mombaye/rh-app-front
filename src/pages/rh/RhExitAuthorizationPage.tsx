import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Clock, XCircle, Loader2,
  ChevronLeft, ChevronRight, Filter, X,
  CalendarDays, User, Hash, MessageSquare, ShieldCheck,
  Eye, ArrowUpDown, LayoutGrid, List, LogOut, Search,
} from "lucide-react";
import AppLayout from "@/layouts/AppLayout";
import { exitAuthorizationService } from "@/services/leaveService";
import { ExitAuthorization, ExitAuthStatus } from "@/types/leave";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;

const STATUS_CFG: Record<ExitAuthStatus, {
  label: string; color: string; bg: string; dot: string;
  Icon: React.ElementType; textColor: string; borderColor: string;
}> = {
  PENDING:   { label: "En attente", color: "#d97706", bg: "#fffbeb", dot: "bg-amber-400",  Icon: Clock,        textColor: "text-amber-700",  borderColor: "border-amber-200"  },
  APPROVED:  { label: "Approuvé",   color: "#059669", bg: "#f0fdf4", dot: "bg-green-500",  Icon: CheckCircle2, textColor: "text-green-700",  borderColor: "border-green-200"  },
  REJECTED:  { label: "Rejeté",     color: "#dc2626", bg: "#fef2f2", dot: "bg-red-500",    Icon: XCircle,      textColor: "text-red-700",    borderColor: "border-red-200"    },
  CANCELLED: { label: "Annulé",     color: "#64748b", bg: "#f8fafc", dot: "bg-gray-400",   Icon: XCircle,      textColor: "text-gray-500",   borderColor: "border-gray-200"   },
};

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}
function fmtDatetime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Modal détail ───────────────────────────────────────────────────────────────
interface DetailModalProps { item: ExitAuthorization; onClose: () => void; }

function DetailModal({ item, onClose }: DetailModalProps) {
  const cfg  = STATUS_CFG[item.status] ?? STATUS_CFG.CANCELLED;
  const Icon = cfg.Icon;

  const fields: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: User,        label: "Employé",       value: item.employee_name },
    { icon: Hash,        label: "Matricule",      value: item.employee_matricule },
    { icon: LogOut,      label: "Sortie le",      value: fmtDatetime(item.datetime_exit)   },
    { icon: LogOut,      label: "Rentrée le",     value: fmtDatetime(item.datetime_return) },
    { icon: CalendarDays, label: "Soumis le",     value: fmt(item.created_at.slice(0, 10)) },
    ...(item.reviewed_by_name ? [{ icon: User as React.ElementType, label: "Traité par", value: item.reviewed_by_name }] : []),
    ...(item.reviewed_at ? [{ icon: CalendarDays as React.ElementType, label: "Traité le", value: fmt(item.reviewed_at.slice(0, 10)) }] : []),
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="relative px-6 py-5" style={{ backgroundColor: cfg.color }}>
            <button onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
              <X size={16} className="text-white" />
            </button>
            <div className="flex items-center gap-3 pr-10">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-0.5">Demande d'autorisation</p>
                <h2 className="text-white font-bold text-lg leading-tight">{item.employee_name}</h2>
              </div>
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {cfg.label}
              </span>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {fields.map(f => (
                <div key={f.label} className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
                  <f.icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
              <MessageSquare size={15} className="text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-0.5">Motif</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {item.motif || <span className="italic text-gray-400">Aucun motif renseigné</span>}
                </p>
              </div>
            </div>

            {item.reject_reason && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2.5">
                <XCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-red-400 uppercase font-semibold tracking-wide mb-0.5">Motif de rejet</p>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{item.reject_reason}</p>
                </div>
              </div>
            )}

            {item.status === "APPROVED" && item.reviewed_by_name && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-green-500 shrink-0" />
                <p className="text-sm text-green-700 font-medium">
                  Approuvé par <span className="font-bold">{item.reviewed_by_name}</span>
                </p>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Hash size={12} />
              <span>Référence : <span className="font-semibold text-gray-500">#{item.id}</span></span>
            </div>
          </div>

          <div className="px-6 pb-6">
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Carte (même design que RequestCard des Congés) ─────────────────────────────
interface CardProps { item: ExitAuthorization; onView: () => void; compact?: boolean; }

function ExitCard({ item, onView, compact = false }: CardProps) {
  const cfg  = STATUS_CFG[item.status] ?? STATUS_CFG.CANCELLED;
  const Icon = cfg.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onView}
      className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer hover:border-gray-200"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: cfg.color }} />

      <div className={`pl-5 pr-4 ${compact ? "py-2.5" : "py-4"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 flex-wrap ${compact ? "mb-0.5" : "mb-1.5"}`}>
              <span className="font-semibold text-gray-800 text-sm truncate">{item.employee_name}</span>
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.textColor} ${cfg.borderColor}`}
                style={{ backgroundColor: cfg.bg }}
              >
                <Icon size={10} />
                {cfg.label}
              </span>
              {item.employee_matricule && (
                <span className="text-xs text-gray-400 font-mono">{item.employee_matricule}</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <LogOut size={12} className="text-gray-400 shrink-0" />
              <span>{fmtDatetime(item.datetime_exit)}</span>
              <span className="text-gray-300">→</span>
              <span>{fmtDatetime(item.datetime_return)}</span>
            </div>

            {!compact && (
              <>
                {item.motif && (
                  <p className="text-xs text-gray-400 italic truncate max-w-sm mt-1">"{item.motif}"</p>
                )}
                {item.reject_reason && (
                  <div className="flex items-start gap-1.5 mt-1">
                    <XCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-500 truncate max-w-xs">{item.reject_reason}</p>
                  </div>
                )}
                {item.reviewed_by_name && item.status === "APPROVED" && (
                  <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Approuvé par {item.reviewed_by_name}
                  </p>
                )}
              </>
            )}
          </div>

          <button
            onClick={e => { e.stopPropagation(); onView(); }}
            title="Voir le détail"
            className="p-2 rounded-lg text-gray-400 hover:text-[#003c71] hover:bg-[#003c71]/8 border border-gray-100 hover:border-[#003c71]/20 transition shrink-0"
          >
            <Eye size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page RH ───────────────────────────────────────────────────────────────────
export default function RhExitAuthorizationPage() {
  const [items,        setItems]        = useState<ExitAuthorization[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [detailTarget, setDetailTarget] = useState<ExitAuthorization | null>(null);
  const [filterStatus, setFilterStatus] = useState<ExitAuthStatus | "ALL">("ALL");
  const [search,       setSearch]       = useState("");
  const [sortOrder,    setSortOrder]    = useState<"recent" | "oldest">("recent");
  const [viewMode,     setViewMode]     = useState<"compact" | "detailed">("detailed");
  const [currentPage,  setCurrentPage]  = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    exitAuthorizationService.getAll()
      .then(data => setItems(data.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())))
      .catch(() => toast.error("Impossible de charger les demandes."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = (filterStatus === "ALL" ? items : items.filter(i => i.status === filterStatus))
    .filter(i =>
      !q || [i.employee_name, i.employee_matricule, i.employee_service, i.motif]
        .some(v => v?.toLowerCase().includes(q))
    )
    .slice()
    .sort((a, b) =>
      sortOrder === "recent"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statsData = [
    { label: "Total",      status: "ALL" as const,      count: items.length,                                       dot: "bg-slate-300"  },
    { label: "En attente", status: "PENDING" as const,  count: items.filter(i => i.status === "PENDING").length,   dot: "bg-amber-400"  },
    { label: "Approuvées", status: "APPROVED" as const, count: items.filter(i => i.status === "APPROVED").length,  dot: "bg-[#003c71]" },
    { label: "Rejetées",   status: "REJECTED" as const, count: items.filter(i => i.status === "REJECTED").length,  dot: "bg-slate-400"  },
  ];

  return (
    <AppLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Demandes d'autorisation</h1>
            <p className="text-gray-500 text-sm mt-0.5">Autorisations de sortie de tous les employés</p>
          </div>
        </motion.div>

        {/* Stats */}
        {!loading && items.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {statsData.map(s => {
              const active = filterStatus === s.status;
              return (
                <button key={s.label}
                  onClick={() => { setFilterStatus(s.status); setCurrentPage(1); }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
                    active ? "border-[#003c71] ring-2 ring-[#003c71]/20" : "border-gray-200 hover:border-gray-300"
                  }`}>
                  <span className="text-2xl font-bold text-[#003c71]">{s.count}</span>
                  <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}

        {/* Barre de recherche */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Rechercher par nom, matricule, service, motif…"
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-2xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#003c71]/20 focus:border-[#003c71]/40 transition shadow-sm"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setCurrentPage(1); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              <X size={15} />
            </button>
          )}
        </motion.div>

        {/* Liste */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-800 text-sm">Demandes</span>
              {!loading && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold">
                  {filtered.length}
                </span>
              )}
            </div>
            <div className="flex-1" />

            {/* Tri */}
            <div className="relative">
              <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700">
                <option value="recent">Plus récentes</option>
                <option value="oldest">Plus anciennes</option>
              </select>
            </div>

            {/* Filtre statut */}
            <div className="relative">
              <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as ExitAuthStatus | "ALL"); setCurrentPage(1); }}
                className="pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white text-gray-700">
                <option value="ALL">Tous ({items.length})</option>
                {(Object.entries(STATUS_CFG) as [ExitAuthStatus, typeof STATUS_CFG[ExitAuthStatus]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} ({items.filter(i => i.status === k).length})</option>
                ))}
              </select>
            </div>

            {/* Mode affichage */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              <button onClick={() => setViewMode("detailed")} title="Détaillé"
                className={`p-1.5 rounded-md transition ${viewMode === "detailed" ? "bg-[#003c71] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}>
                <LayoutGrid size={13} />
              </button>
              <button onClick={() => setViewMode("compact")} title="Compact"
                className={`p-1.5 rounded-md transition ${viewMode === "compact" ? "bg-[#003c71] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}>
                <List size={13} />
              </button>
            </div>
          </div>

          {/* Chips filtres actifs */}
          {!loading && (filterStatus !== "ALL" || search) && (
            <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
              {filterStatus !== "ALL" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {STATUS_CFG[filterStatus as ExitAuthStatus]?.label}
                  <button onClick={() => { setFilterStatus("ALL"); setCurrentPage(1); }} className="hover:bg-blue-100 rounded-full p-0.5 transition"><X size={10} /></button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                  "{search}"
                  <button onClick={() => { setSearch(""); setCurrentPage(1); }} className="hover:bg-gray-100 rounded-full p-0.5 transition"><X size={10} /></button>
                </span>
              )}
            </div>
          )}

          {/* Contenu */}
          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <LogOut size={28} className="opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-500">Aucune demande trouvée</p>
              <p className="text-xs mt-1 text-gray-400">
                {filterStatus !== "ALL" || search ? "Aucune demande pour ces critères" : "Aucune demande d'autorisation enregistrée"}
              </p>
            </div>
          ) : (
            <>
              <div className={`p-4 ${viewMode === "compact" ? "space-y-1.5" : "space-y-3"}`}>
                {paginated.map(item => (
                  <ExitCard key={item.id} item={item} compact={viewMode === "compact"}
                    onView={() => setDetailTarget(item)} />
                ))}
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-gray-400">
                  Page {currentPage} / {totalPages} · {filtered.length} demande{filtered.length > 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition ${page === currentPage ? "bg-[#003c71] text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {page}
                    </button>
                  ))}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {detailTarget && <DetailModal item={detailTarget} onClose={() => setDetailTarget(null)} />}
    </AppLayout>
  );
}
