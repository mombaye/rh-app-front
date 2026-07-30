import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Clock, CheckCircle2, XCircle, Calendar,
  Loader2, X, ChevronLeft, ChevronRight, MessageSquare,
  Stethoscope, AlertTriangle, Trash2, Hourglass,
} from "lucide-react";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { useAuth } from "@/contexts/useAuth";
import {
  infirmerieService,
  InfirmerieAppointment,
  SlotInfo,
} from "@/services/infirmerieService";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR   = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

function fmt(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${DAYS_FR[dt.getDay()]} ${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
}

/** Retourne les N prochains mardis à partir d'aujourd'hui (inclus si mardi) */
function getNextTuesdays(count = 8): string[] {
  const result: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(today);
  // Avancer jusqu'au prochain mardi
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  while (result.length < count) {
    result.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return result;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType; textColor: string; borderColor: string }> = {
  PENDING:   { label: "En attente",  color: "#d97706", bg: "#fffbeb", Icon: Clock,        textColor: "text-amber-700",  borderColor: "border-amber-200"  },
  CONFIRMED: { label: "Confirmé",    color: "#059669", bg: "#f0fdf4", Icon: CheckCircle2, textColor: "text-green-700",  borderColor: "border-green-200"  },
  CANCELLED: { label: "Annulé",      color: "#6b7280", bg: "#f9fafb", Icon: XCircle,      textColor: "text-gray-500",   borderColor: "border-gray-200"   },
};

// ── Modal prise de RDV ────────────────────────────────────────────────────────

interface BookingModalProps {
  employeeId: number;
  onClose: () => void;
  onSaved: () => void;
}

function BookingModal({ employeeId, onClose, onSaved }: BookingModalProps) {
  const tuesdays = getNextTuesdays(8);
  const [selectedDate, setSelectedDate] = useState<string>(tuesdays[0]);
  const [slots,        setSlots]        = useState<SlotInfo[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [motif,        setMotif]        = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const loadSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    setError(null);
    try {
      const res = await infirmerieService.slotsDisponibles(date);
      setSlots(res.slots);
    } catch {
      setError("Impossible de charger les créneaux.");
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => { loadSlots(selectedDate); }, [selectedDate, loadSlots]);

  const handleBook = async () => {
    if (!selectedSlot) { setError("Veuillez choisir un créneau."); return; }
    setSaving(true);
    setError(null);
    try {
      await infirmerieService.create({ employee_id: employeeId, date: selectedDate, creneau: selectedSlot, motif });
      toast.success("Rendez-vous pris avec succès !");
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.non_field_errors?.[0]
        || err?.response?.data?.detail
        || err?.response?.data?.creneau?.[0]
        || err?.response?.data?.date?.[0]
        || "Erreur lors de la prise de rendez-vous.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const availableCount = slots.filter(s => s.disponible).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#003c71] to-[#0055a4] px-6 py-5 rounded-t-3xl sm:rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Stethoscope size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Prendre un rendez-vous</h3>
              <p className="text-blue-200 text-xs">Infirmerie — ouverte les mardis uniquement</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Erreur */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              >
                <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Choix du mardi */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Calendar size={14} className="inline mr-1.5 text-[#003c71]" />
              Choisissez un mardi
            </label>
            <div className="grid grid-cols-2 gap-2">
              {tuesdays.map(date => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition text-left ${
                    selectedDate === date
                      ? "bg-[#003c71] text-white border-[#003c71] shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#003c71]/40 hover:bg-[#003c71]/5"
                  }`}
                >
                  {fmt(date)}
                </button>
              ))}
            </div>
          </div>

          {/* Créneaux */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                <Clock size={14} className="inline mr-1.5 text-[#003c71]" />
                Choisissez un créneau
              </label>
              {!loadingSlots && slots.length > 0 && (
                <span className="text-xs text-gray-400">{availableCount} disponible{availableCount > 1 ? "s" : ""}</span>
              )}
            </div>

            {loadingSlots ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={22} className="animate-spin text-[#003c71]" />
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map(s => (
                  <button
                    key={s.creneau}
                    disabled={!s.disponible}
                    onClick={() => { if (s.disponible) { setSelectedSlot(s.creneau); setError(null); } }}
                    className={`py-2 rounded-xl text-sm font-semibold border transition ${
                      !s.disponible
                        ? "bg-red-50 text-red-300 border-red-100 cursor-not-allowed line-through"
                        : selectedSlot === s.creneau
                        ? "bg-[#003c71] text-white border-[#003c71] shadow-sm"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[#003c71]/40 hover:bg-[#003c71]/5"
                    }`}
                  >
                    {s.creneau}
                    {!s.disponible && (
                      <span className="block text-[9px] font-normal text-red-300 mt-0.5">Pris</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Motif */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <MessageSquare size={14} className="inline mr-1.5 text-[#003c71]" />
              Motif <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <textarea
              rows={2}
              value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder="Décrivez brièvement le motif de votre consultation…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 focus:border-[#003c71]/50 bg-gray-50 resize-none"
            />
          </div>

          {/* Récap sélection */}
          {selectedSlot && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="bg-[#003c71]/5 border border-[#003c71]/20 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-[#003c71]/10 flex items-center justify-center shrink-0">
                <Stethoscope size={16} className="text-[#003c71]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#003c71]">{fmt(selectedDate)} à {selectedSlot}</p>
                <p className="text-xs text-gray-500">Infirmerie</p>
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm transition font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleBook}
              disabled={saving || !selectedSlot}
              className="flex-[2] px-4 py-2.5 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Confirmer le rendez-vous
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Carte rendez-vous ─────────────────────────────────────────────────────────

function AppointmentCard({ appt, onCancel }: { appt: InfirmerieAppointment; onCancel: () => void }) {
  const cfg  = STATUS_CFG[appt.status] ?? STATUS_CFG.PENDING;
  const Icon = cfg.Icon;
  const isPast = new Date(appt.date + "T23:59:00") < new Date();
  const canCancel = appt.status === "PENDING" && !isPast;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: cfg.color }} />
      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Date + heure */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="font-bold text-gray-800 text-base">{appt.creneau}</span>
              <span className="text-sm text-gray-500">{fmt(appt.date)}</span>
            </div>
            {/* Statut */}
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.textColor} ${cfg.borderColor}`}
              style={{ backgroundColor: cfg.bg }}
            >
              <Icon size={10} />
              {cfg.label}
            </span>
            {/* Motif */}
            {appt.motif && (
              <p className="text-xs text-gray-400 italic mt-1.5 truncate max-w-sm">"{appt.motif}"</p>
            )}
          </div>

          {/* Icône statut + bouton annuler */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${cfg.color}15` }}
            >
              <Icon size={18} style={{ color: cfg.color }} />
            </div>
            {canCancel && (
              <button
                onClick={e => { e.stopPropagation(); onCancel(); }}
                className="flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg border border-red-200 hover:border-red-400 transition font-medium"
              >
                <Trash2 size={11} />
                Annuler
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

type LayoutComponent = React.ComponentType<{ children: React.ReactNode }>;

export default function EmployeeInfirmeriePage({ layout: Layout = EmployeeLayout }: { layout?: LayoutComponent }) {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [appointments,   setAppointments]   = useState<InfirmerieAppointment[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [cancelTarget,   setCancelTarget]   = useState<InfirmerieAppointment | null>(null);
  const [cancelling,   setCancelling]   = useState(false);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "CONFIRMED" | "CANCELLED">("ALL");
  const [currentPage,  setCurrentPage]  = useState(1);
  const PAGE_SIZE = 6;

  const refresh = useCallback(() => {
    if (!employeeId) return;
    setLoading(true);
    infirmerieService.list()
      .then(data => setAppointments(data))
      .catch(() => toast.error("Erreur lors du chargement des rendez-vous."))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await infirmerieService.cancel(cancelTarget.id);
      toast.success("Rendez-vous annulé.");
      setCancelTarget(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur lors de l'annulation.");
    } finally {
      setCancelling(false);
    }
  };

  const filtered = filterStatus === "ALL"
    ? appointments
    : appointments.filter(a => a.status === filterStatus);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = {
    ALL:       appointments.length,
    PENDING:   appointments.filter(a => a.status === "PENDING").length,
    CONFIRMED: appointments.filter(a => a.status === "CONFIRMED").length,
    CANCELLED: appointments.filter(a => a.status === "CANCELLED").length,
  };

  // Prochain RDV actif
  const nextAppt = appointments
    .filter(a => (a.status === "PENDING" || a.status === "CONFIRMED") && new Date(a.date + "T23:59:00") >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date) || a.creneau.localeCompare(b.creneau))[0];

  return (
    <Layout>
      <div className="px-4 md:px-6 pb-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#003c71]/10 flex items-center justify-center">
              <Stethoscope size={22} className="text-[#003c71]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#003c71]">Infirmerie</h1>
              <p className="text-gray-500 text-sm">Prise de rendez-vous — ouverte les mardis</p>
            </div>
          </div>
          <button
            onClick={() => setShowComingSoon(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition shadow-sm font-semibold"
          >
            <Plus size={16} />
            Prendre un rendez-vous
          </button>
        </motion.div>

        {/* Prochain RDV */}
        {nextAppt && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-r from-[#003c71] to-[#0055a4] rounded-2xl p-5 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Stethoscope size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-0.5">Prochain rendez-vous</p>
              <p className="text-white font-bold text-lg">{nextAppt.creneau} — {fmt(nextAppt.date)}</p>
              {nextAppt.motif && (
                <p className="text-blue-200 text-xs mt-0.5 truncate">"{nextAppt.motif}"</p>
              )}
            </div>
            <span
              className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${
                nextAppt.status === "CONFIRMED" ? "bg-green-400/20 text-green-200" : "bg-amber-400/20 text-amber-200"
              }`}
            >
              {STATUS_CFG[nextAppt.status].label}
            </span>
          </motion.div>
        )}

        {/* Stats */}
        {!loading && appointments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          >
            {(["ALL", "PENDING", "CONFIRMED", "CANCELLED"] as const).map(s => {
              const labels = { ALL: "Total", PENDING: "En attente", CONFIRMED: "Confirmés", CANCELLED: "Annulés" };
              const dots   = { ALL: "bg-slate-300", PENDING: "bg-amber-400", CONFIRMED: "bg-green-500", CANCELLED: "bg-gray-300" };
              const active = filterStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
                    active ? "border-[#003c71] ring-2 ring-[#003c71]/20" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-2xl font-bold text-[#003c71]">{counts[s]}</span>
                  <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${dots[s]}`} />
                    {labels[s]}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}

        {/* Liste */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <span className="font-semibold text-gray-800 text-sm">Mes rendez-vous</span>
            {!loading && (
              <span className="text-xs text-gray-400">({filtered.length})</span>
            )}
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Stethoscope size={28} className="opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                {filterStatus !== "ALL" ? "Aucun rendez-vous pour ce filtre" : "Aucun rendez-vous"}
              </p>
              {filterStatus === "ALL" && (
                <button
                  onClick={() => setShowComingSoon(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/90 transition font-medium"
                >
                  <Plus size={14} /> Prendre un rendez-vous
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="p-4 space-y-3">
                {paginated.map(a => (
                  <AppointmentCard
                    key={a.id}
                    appt={a}
                    onCancel={() => setCancelTarget(a)}
                  />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-400">
                    Page {currentPage} / {totalPages} – {filtered.length} rendez-vous
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition ${
                          page === currentPage
                            ? "bg-[#003c71] text-white shadow-sm"
                            : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>

      {/* Modal bientôt disponible */}
      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="bg-gradient-to-r from-[#003c71] to-[#0055a4] px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Stethoscope size={18} className="text-white" />
                </div>
                <span className="text-white font-bold text-sm">Infirmerie</span>
              </div>
              <button onClick={() => setShowComingSoon(false)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                <X size={14} className="text-white" />
              </button>
            </div>
            <div className="px-6 py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
                <Hourglass size={30} className="text-amber-500" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-2">Fonctionnalité bientôt disponible</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                La prise de rendez-vous en ligne à l'infirmerie sera disponible très prochainement.<br />
                Merci de votre patience.
              </p>
              <button
                onClick={() => setShowComingSoon(false)}
                className="mt-6 w-full px-4 py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-semibold hover:bg-[#003c71]/90 transition"
              >
                Compris
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal confirmation annulation */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center mb-2">
              Annuler ce rendez-vous ?
            </h3>
            <p className="text-sm text-gray-600 text-center mb-1">
              <span className="font-semibold">{cancelTarget.creneau}</span> — {fmt(cancelTarget.date)}
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center mt-4 mb-5">
              Cette action est irréversible. Le créneau sera libéré.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Garder
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {cancelling && <Loader2 size={14} className="animate-spin" />}
                Confirmer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
