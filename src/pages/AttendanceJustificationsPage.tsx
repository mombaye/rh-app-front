import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Loader2,
  X, Clock, CalendarDays, Search, ChevronDown, Send, Eye,
} from "lucide-react";
import { getRhDisputes, resolveDispute, type RhDispute } from "@/services/attendanceService";
import toast from "react-hot-toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
const DAYS_FULL = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return `${DAYS_FULL[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function fmtMinutes(min?: number) {
  if (!min || min <= 0) return "—";
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2,"0")}`;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_CONFIG = {
  pending:  { label: "En attente", cls: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-400",  icon: <AlertTriangle size={12}/> },
  approved: { label: "Approuvée",  cls: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500",  icon: <CheckCircle2 size={12}/> },
  rejected: { label: "Rejetée",    cls: "bg-red-100 text-red-600 border-red-200",        dot: "bg-red-400",    icon: <XCircle size={12}/> },
};

// ─── Modal de résolution ──────────────────────────────────────────────────────
function ResolveModal({
  dispute,
  onClose,
  onResolved,
}: {
  dispute: RhDispute;
  onClose: () => void;
  onResolved: (id: number, status: "approved" | "rejected") => void;
}) {
  const [decision, setDecision] = useState<"approved" | "rejected" | "">("");
  const [note,     setNote]     = useState("");
  const [loading,  setLoading]  = useState(false);

  const ev = dispute.attendance_evidence;

  const handleSubmit = async () => {
    if (!decision) { toast.error("Veuillez choisir une décision."); return; }
    setLoading(true);
    try {
      await resolveDispute(dispute.id, decision, note.trim());
      toast.success(decision === "approved" ? "Justification approuvée." : "Justification rejetée.");
      onResolved(dispute.id, decision);
      onClose();
    } catch {
      toast.error("Erreur lors de la résolution.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity:0, scale:0.96, y:8 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.96, y:8 }} transition={{ duration:0.16 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#003c71]/10 flex items-center justify-center">
              <ShieldAlert size={15} className="text-[#003c71]"/>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Traiter la justification</p>
              <p className="text-xs text-gray-400">{dispute.employee_name} — {fmtDate(dispute.work_date)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <X size={16}/>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">

          {/* Justification de l'employé */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Explication de l'employé</p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 border border-gray-100">
              {dispute.justification_text}
            </div>
          </div>

          {/* Données de pointage enregistrées */}
          {ev && (ev.in_time || ev.out_time || (ev.worked_minutes ?? 0) > 0) ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Données de pointage (preuve)</p>
              <div className="rounded-xl border border-[#003c71]/20 bg-[#003c71]/3 overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-[#003c71]/10">
                  {[
                    { label:"Arrivée",  value: ev.in_time  ?? "—", icon:<Clock size={14} className="text-green-500"/> },
                    { label:"Départ",   value: ev.out_time ?? "—", icon:<Clock size={14} className="text-red-400"/>   },
                    { label:"Durée",    value: fmtMinutes(ev.worked_minutes), icon:<CalendarDays size={14} className="text-[#003c71]"/> },
                  ].map(item => (
                    <div key={item.label} className="px-3 py-3 text-center">
                      <div className="flex justify-center mb-1">{item.icon}</div>
                      <div className="text-sm font-bold text-gray-800">{item.value}</div>
                      <div className="text-[10px] text-gray-400">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-400 text-center border border-gray-100">
              Aucune donnée de pointage enregistrée pour ce jour.
            </div>
          )}

          {/* Décision */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Votre décision</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setDecision("approved")}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${
                  decision === "approved"
                    ? "bg-green-600 border-green-600 text-white shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50"
                }`}>
                <CheckCircle2 size={15}/> Approuver
              </button>
              <button onClick={() => setDecision("rejected")}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${
                  decision === "rejected"
                    ? "bg-red-500 border-red-500 text-white shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50"
                }`}>
                <XCircle size={15}/> Rejeter
              </button>
            </div>
          </div>

          {/* Note de résolution */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
              Note explicative <span className="text-gray-400">(optionnel)</span>
            </label>
            <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Ex : Présence confirmée par le responsable / Absence non justifiée…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 resize-none"/>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading || !decision}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
            Valider la décision
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AttendanceJustificationsPage() {
  const [disputes,     setDisputes]     = useState<RhDispute[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [search,       setSearch]       = useState("");
  const [selected,     setSelected]     = useState<RhDispute | null>(null);

  const load = (sf: StatusFilter) => {
    setLoading(true);
    getRhDisputes(sf === "all" ? undefined : sf)
      .then(setDisputes)
      .catch(() => toast.error("Erreur lors du chargement."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  const handleResolved = (id: number, status: "approved" | "rejected") => {
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  };

  const filtered = disputes.filter(d =>
    d.employee_name.toLowerCase().includes(search.toLowerCase()) ||
    d.employee_matricule.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    pending:  disputes.filter(d => d.status === "pending").length,
    approved: disputes.filter(d => d.status === "approved").length,
    rejected: disputes.filter(d => d.status === "rejected").length,
  };

  const FILTERS: { key: StatusFilter; label: string; count?: number }[] = [
    { key:"pending",  label:"En attente", count: counts.pending  },
    { key:"approved", label:"Approuvées", count: counts.approved },
    { key:"rejected", label:"Rejetées",   count: counts.rejected },
    { key:"all",      label:"Toutes"                              },
  ];

  return (
    <AppLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* Header */}
        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-[#003c71]">Justifications d'absence</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Traitez les demandes de justification soumises par les employés.
          </p>
        </motion.div>

        {/* Filtres + recherche */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  statusFilter === f.key ? "bg-[#003c71] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                {f.label}
                {f.count !== undefined && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                    statusFilter === f.key ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                  }`}>{f.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un employé…"
              className="pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 w-56"/>
          </div>
        </div>

        {/* Tableau */}
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#003c71]"/></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <ShieldAlert size={40} className="mx-auto mb-3 text-gray-200"/>
              <p className="text-gray-400 text-sm">Aucune justification trouvée.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#003c71] text-white text-xs">
                  {["Employé","Date","Justification","Données pointage","Statut","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => {
                  const sc  = STATUS_CONFIG[d.status];
                  const ev  = d.attendance_evidence;
                  const hasEvidence = ev && (ev.in_time || ev.out_time || (ev.worked_minutes ?? 0) > 0);
                  return (
                    <tr key={d.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800 text-xs">{d.employee_name}</p>
                        <p className="text-gray-400 text-[11px]">{d.employee_matricule}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {fmtDate(d.work_date)}
                        <p className="text-[11px] text-gray-300 mt-0.5">Soumis {fmtDateTime(d.created_at)}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-xs text-gray-600 line-clamp-2">{d.justification_text}</p>
                      </td>
                      <td className="px-4 py-3">
                        {hasEvidence ? (
                          <div className="text-xs space-y-0.5">
                            {ev?.in_time  && <p className="text-gray-600"><span className="text-gray-400">Arr.</span> {ev.in_time}</p>}
                            {ev?.out_time && <p className="text-gray-600"><span className="text-gray-400">Dép.</span> {ev.out_time}</p>}
                            {(ev?.worked_minutes ?? 0) > 0 && <p className="text-[#003c71] font-medium">{fmtMinutes(ev?.worked_minutes)}</p>}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-300">Aucune donnée</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.cls}`}>
                          {sc.icon} {sc.label}
                        </span>
                        {d.resolved_by && (
                          <p className="text-[10px] text-gray-300 mt-0.5">par {d.resolved_by}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {d.status === "pending" ? (
                          <button onClick={() => setSelected(d)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#003c71] text-white text-xs font-medium hover:bg-[#003c71]/90 transition">
                            <Eye size={12}/> Traiter
                          </button>
                        ) : (
                          <button onClick={() => setSelected(d)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition">
                            <Eye size={12}/> Voir
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {selected && (
          <ResolveModal
            key="resolve-modal"
            dispute={selected}
            onClose={() => setSelected(null)}
            onResolved={handleResolved}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
