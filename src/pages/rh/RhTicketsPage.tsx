import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket as TicketIcon, X, CheckCircle2, RefreshCw,
  Search, ChevronDown, RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import AppLayout from "@/layouts/AppLayout";
import { ticketService } from "@/services/ticketService";
import { Ticket, STATUS_CONFIG, CATEGORY_LABELS } from "@/types/ticket";

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

// ─── Modal résolution ─────────────────────────────────────────────────────────
function ResolveModal({
  ticket, onClose, onDone,
}: { ticket: Ticket; onClose: () => void; onDone: () => void }) {
  const [note, setNote]           = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await ticketService.resolve(ticket.id, note);
      toast.success("Ticket marqué comme résolu.");
      onDone();
      onClose();
    } catch {
      toast.error("Erreur lors de la résolution.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Marquer comme résolu</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <p className="font-semibold text-gray-700">{ticket.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{ticket.employee_nom} · {ticket.category_label}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Note de résolution <span className="text-gray-400 font-normal normal-case">(optionnelle)</span>
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Expliquez comment le problème a été résolu…"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={submit} disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50">
            {submitting ? <ImSpinner2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            Confirmer la résolution
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Carte ticket RH ──────────────────────────────────────────────────────────
function RhTicketCard({
  ticket, index, onResolve, onReopen,
}: {
  ticket: Ticket; index: number;
  onResolve: (t: Ticket) => void;
  onReopen:  (id: number) => void;
}) {
  const cfg = STATUS_CONFIG[ticket.status];
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <button onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-gray-50 transition">
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{ticket.title}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              {ticket.category_label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            <span className="font-medium text-gray-500">{ticket.employee_nom}</span>
            {" · "}{fmt(ticket.created_at)}
          </p>
        </div>
        <ChevronDown size={15} className={`text-gray-400 shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-gray-50 pt-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{ticket.description}</p>

              {ticket.status === "RESOLVED" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">
                    Résolu par {ticket.resolved_by_name}
                    {ticket.resolved_at ? ` · ${fmt(ticket.resolved_at)}` : ""}
                  </p>
                  {ticket.resolution_note && (
                    <p className="text-xs text-emerald-600 italic">"{ticket.resolution_note}"</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {ticket.status !== "RESOLVED" && (
                  <button onClick={() => onResolve(ticket)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition">
                    <CheckCircle2 size={13} /> Marquer résolu
                  </button>
                )}
                {ticket.status === "RESOLVED" && (
                  <button onClick={() => onReopen(ticket.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
                    <RotateCcw size={13} /> Réouvrir
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RhTicketsPage() {
  const [tickets,       setTickets]       = useState<Ticket[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<string>("ALL");
  const [filterCat,     setFilterCat]     = useState<string>("ALL");
  const [resolveTarget, setResolveTarget] = useState<Ticket | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await ticketService.list());
    } catch {
      toast.error("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReopen = async (id: number) => {
    try {
      const updated = await ticketService.reopen(id);
      setTickets(prev => prev.map(t => t.id === id ? updated : t));
      toast.success("Ticket réouvert.");
    } catch {
      toast.error("Erreur.");
    }
  };

  const q = search.trim().toLowerCase();

  const filtered = tickets.filter(t => {
    const matchSearch = !q ||
      t.title.toLowerCase().includes(q) ||
      t.employee_nom.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q);
    const matchStatus = filterStatus === "ALL" || t.status === filterStatus;
    const matchCat    = filterCat    === "ALL" || t.category === filterCat;
    return matchSearch && matchStatus && matchCat;
  });

  const openCount     = tickets.filter(t => t.status === "OPEN").length;
  const progressCount = tickets.filter(t => t.status === "IN_PROGRESS").length;
  const resolvedCount = tickets.filter(t => t.status === "RESOLVED").length;

  return (
    <AppLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-camublue-900 text-white shrink-0">
              <TicketIcon size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-camublue-900">Signalements</h1>
              <p className="text-gray-500 text-sm mt-0.5">Tous les tickets remontés par les collaborateurs</p>
            </div>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </motion.div>

        {/* Stats */}
        {!loading && tickets.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Ouverts",  count: openCount,     dot: "bg-blue-500"    },
              { label: "En cours", count: progressCount, dot: "bg-amber-500"   },
              { label: "Résolus",  count: resolvedCount, dot: "bg-emerald-500" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-camublue-900">{s.count}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Recherche + filtres */}
        <div className="flex items-center gap-3 mb-6 w-full flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher par nom, titre…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-3 border border-gray-200 rounded-2xl text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 bg-white shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap shrink-0">
            {[
              { key: "ALL", label: "Tous" },
              { key: "OPEN", label: "Ouverts" },
              { key: "IN_PROGRESS", label: "En cours" },
              { key: "RESOLVED", label: "Résolus" },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-2.5 rounded-2xl text-xs font-semibold border transition whitespace-nowrap ${
                  filterStatus === f.key
                    ? "bg-camublue-900 text-white border-camublue-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                {f.label}
              </button>
            ))}
            <div className="w-px h-8 bg-gray-200 self-center" />
            {(["ALL", ...Object.keys(CATEGORY_LABELS)] as string[]).map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                className={`px-3 py-2.5 rounded-2xl text-xs font-semibold border transition whitespace-nowrap ${
                  filterCat === cat
                    ? "bg-camublue-900 text-white border-camublue-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                {cat === "ALL" ? "Toutes catégories" : CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-3">
              <ImSpinner2 className="animate-spin text-camublue-900" size={28} />
              <p className="text-gray-400 text-sm">Chargement…</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <TicketIcon size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">
                {tickets.length === 0 ? "Aucun signalement pour l'instant" : "Aucun résultat"}
              </p>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="space-y-3">
              {filtered.map((t, i) => (
                <RhTicketCard
                  key={t.id} ticket={t} index={i}
                  onResolve={setResolveTarget}
                  onReopen={handleReopen}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {resolveTarget && (
          <ResolveModal
            ticket={resolveTarget}
            onClose={() => setResolveTarget(null)}
            onDone={load}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
