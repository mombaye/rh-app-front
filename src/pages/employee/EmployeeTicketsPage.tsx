import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket as TicketIcon, Plus, X, CheckCircle2, Clock,
  AlertCircle, RefreshCw, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { ticketService } from "@/services/ticketService";
import { Ticket, TicketCategory, CATEGORY_LABELS, STATUS_CONFIG } from "@/types/ticket";

type LayoutComponent = React.ComponentType<{ children: React.ReactNode }>;

const CATEGORIES: TicketCategory[] = ["BLOCAGE", "ANOMALIE", "DIFFICULTE", "AUTRE"];

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

// ─── Carte ticket ─────────────────────────────────────────────────────────────
function TicketCard({ ticket, index }: { ticket: Ticket; index: number }) {
  const cfg = STATUS_CONFIG[ticket.status];
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-gray-50 transition"
      >
        <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
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
          <p className="text-xs text-gray-400 mt-0.5">{fmt(ticket.created_at)}</p>
        </div>
        <ChevronDown size={15} className={`text-gray-400 shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3 border-t border-gray-50 pt-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{ticket.description}</p>

              {ticket.status === "RESOLVED" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">
                      Résolu par {ticket.resolved_by_name}
                      {ticket.resolved_at ? ` · ${fmt(ticket.resolved_at)}` : ""}
                    </p>
                    {ticket.resolution_note && (
                      <p className="text-xs text-emerald-600 mt-1 italic">"{ticket.resolution_note}"</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Modal création ───────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState<TicketCategory>("AUTRE");
  const [submitting,  setSubmitting]  = useState(false);

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }
    setSubmitting(true);
    try {
      await ticketService.create({ title: title.trim(), description: description.trim(), category });
      toast.success("Ticket créé avec succès.");
      onCreated();
      onClose();
    } catch {
      toast.error("Erreur lors de la création.");
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
          <h2 className="font-bold text-gray-800">Nouveau signalement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Catégorie */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Catégorie</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    category === cat
                      ? "bg-[#003c71] text-white border-[#003c71]"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Titre */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Titre</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Décrivez brièvement le problème…"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Détaillez le problème rencontré, les étapes pour le reproduire, l'impact…"
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 resize-none"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold hover:bg-[#002d56] transition disabled:opacity-50"
          >
            {submitting ? <ImSpinner2 className="animate-spin" size={14} /> : <Plus size={14} />}
            Envoyer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EmployeeTicketsPage({ layout: Layout = EmployeeLayout }: { layout?: LayoutComponent }) {
  const [tickets,     setTickets]     = useState<Ticket[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await ticketService.list({ self_only: "1" }));
    } catch {
      toast.error("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filterStatus === "ALL"
    ? tickets
    : tickets.filter(t => t.status === filterStatus);

  const openCount     = tickets.filter(t => t.status === "OPEN").length;
  const progressCount = tickets.filter(t => t.status === "IN_PROGRESS").length;
  const resolvedCount = tickets.filter(t => t.status === "RESOLVED").length;

  return (
    <Layout>
      <div className="px-4 md:px-6 pb-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#003c71] text-white shrink-0">
              <TicketIcon size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#003c71]">Mes signalements</h1>
              <p className="text-gray-500 text-sm mt-0.5">Remontez blocages, anomalies et difficultés</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtres statut */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: "ALL",         label: "Tous"     },
                { key: "OPEN",        label: "Ouverts"  },
                { key: "IN_PROGRESS", label: "En cours" },
                { key: "RESOLVED",    label: "Résolus"  },
              ].map(f => (
                <button key={f.key} onClick={() => setFilterStatus(f.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    filterStatus === f.key
                      ? "bg-[#003c71] text-white border-[#003c71]"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="w-px h-7 bg-gray-200" />
            <button onClick={load} disabled={loading}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition disabled:opacity-50 bg-white">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold hover:bg-[#002d56] transition shadow-sm">
              <Plus size={15} /> Nouveau signalement
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        {!loading && tickets.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Ouverts",   count: openCount,     dot: "bg-blue-500"    },
              { label: "En cours",  count: progressCount, dot: "bg-amber-500"   },
              { label: "Résolus",   count: resolvedCount, dot: "bg-emerald-500" },
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

        {/* Contenu */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-3">
              <ImSpinner2 className="animate-spin text-[#003c71]" size={28} />
              <p className="text-gray-400 text-sm">Chargement…</p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                {tickets.length === 0
                  ? <AlertCircle size={28} className="text-gray-300" />
                  : <Clock size={28} className="text-gray-300" />}
              </div>
              <p className="font-semibold text-gray-400 mb-1">
                {tickets.length === 0 ? "Aucun signalement pour l'instant" : "Aucun ticket dans cette catégorie"}
              </p>
              {tickets.length === 0 && (
                <button onClick={() => setShowModal(true)}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold hover:bg-[#002d56] transition">
                  <Plus size={14} /> Créer un signalement
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-3">
              {filtered.map((t, i) => <TicketCard key={t.id} ticket={t} index={i} />)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showModal && (
          <CreateModal onClose={() => setShowModal(false)} onCreated={load} />
        )}
      </AnimatePresence>
    </Layout>
  );
}
