import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, CalendarDays, ChevronLeft, ChevronRight,
  FileDown, Loader2, CheckCircle2, XCircle, AlertTriangle,
  BarChart3, X, Filter, ShieldAlert, Send, ChevronDown, History,
} from "lucide-react";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { fetchMyAttendance, submitDispute, fetchMyDisputes, AttendanceDispute } from "@/services/employeeService";
import { useAuth } from "@/contexts/useAuth";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ────────────────────────────────────────────────────────────────────
type DayRecord = {
  date: string;
  status: "present" | "absent" | "incomplete";
  in_time: string | null;
  out_time: string | null;
  worked_minutes: number;
  flags: Record<string, unknown>;
};

type ViewMode   = "daily" | "weekly" | "monthly";
type StatusFilter = "all" | "present" | "absent" | "incomplete";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS_FR   = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAYS_FULL = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date): Date {
  const r = new Date(d); const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); return r;
}
function startOfMonth(y: number, m: number): Date { return new Date(y, m, 1, 12); }
function endOfMonth(y: number, m: number):   Date { return new Date(y, m + 1, 0, 12); }
function formatMinutes(min: number): string {
  if (!min || min <= 0) return "0h00";
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2,"0")}`;
}
function statusBadge(status: DayRecord["status"]) {
  if (status === "present")    return { label: "Présent",   cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={13}/> };
  if (status === "incomplete") return { label: "Incomplet", cls: "bg-amber-100 text-amber-700", icon: <AlertTriangle size={13}/> };
  return                              { label: "Absent",    cls: "bg-red-100 text-red-600",     icon: <XCircle size={13}/> };
}

// ─── Génération PDF ───────────────────────────────────────────────────────────
function buildPdf(days: DayRecord[], opts: {
  employeeName: string; matricule: string; period: string;
  docTitle: string; generatedAt: string;
}, filename: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const primary: [number,number,number] = [0, 60, 113];

  // En-tête
  doc.setFillColor(...primary);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(15); doc.setFont("helvetica","bold");
  doc.text("Camusat — Relevé de pointage", 14, 11);
  doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.text(opts.docTitle, 14, 18);
  doc.text(`Généré le ${opts.generatedAt}`, 196, 18, { align: "right" });
  doc.text(`Période : ${opts.period}`, 14, 24);

  // Bloc employé
  doc.setFillColor(245,247,250);
  doc.roundedRect(14, 32, 182, 18, 3, 3, "F");
  doc.setTextColor(30,30,30);
  doc.setFontSize(11); doc.setFont("helvetica","bold");
  doc.text(opts.employeeName, 20, 41);
  doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.setTextColor(100,100,100);
  doc.text(`Matricule : ${opts.matricule}`, 20, 47);

  // Stats
  const today = new Date();
  const past = days.filter(d => new Date(d.date+"T12:00:00") <= today);
  const stats = [
    { label: "Présents",     value: String(past.filter(d=>d.status==="present").length),    color:[21,128,61] as [number,number,number] },
    { label: "Absents",      value: String(past.filter(d=>d.status==="absent").length),     color:[220,38,38] as [number,number,number] },
    { label: "Incomplets",   value: String(past.filter(d=>d.status==="incomplete").length), color:[217,119,6] as [number,number,number] },
    { label: "Total heures", value: formatMinutes(days.reduce((s,d)=>s+(d.worked_minutes||0),0)), color:primary },
  ];
  const bw = 182/4 - 2;
  stats.forEach((s,i) => {
    const x = 14 + i*(bw+2.5);
    doc.setFillColor(248,250,252); doc.roundedRect(x,55,bw,15,2,2,"F");
    doc.setTextColor(...s.color); doc.setFontSize(11); doc.setFont("helvetica","bold");
    doc.text(s.value, x+bw/2, 63, { align:"center" });
    doc.setFontSize(7); doc.setFont("helvetica","normal");
    doc.setTextColor(120,120,120);
    doc.text(s.label, x+bw/2, 68, { align:"center" });
  });

  // Tableau
  autoTable(doc, {
    startY: 76,
    head: [["Date","Statut","Arrivée","Départ","Durée"]],
    body: days.map(day => {
      const dt  = new Date(day.date+"T12:00:00");
      const bd  = statusBadge(day.status);
      return [
        `${DAYS_FULL[dt.getDay()]} ${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`,
        bd.label, day.in_time??"—", day.out_time??"—",
        formatMinutes(day.worked_minutes),
      ];
    }),
    styles: { fontSize:9, cellPadding:3, font:"helvetica" },
    headStyles: { fillColor:primary, textColor:255, fontStyle:"bold", fontSize:9 },
    alternateRowStyles: { fillColor:[248,250,252] },
    columnStyles: { 0:{cellWidth:68}, 1:{cellWidth:26}, 2:{cellWidth:22}, 3:{cellWidth:22}, 4:{cellWidth:22} },
    didParseCell: data => {
      if (data.section === "body" && data.column.index === 1) {
        const v = data.cell.raw as string;
        if (v === "Présent")   data.cell.styles.textColor = [21,128,61];
        else if (v === "Absent")    data.cell.styles.textColor = [220,38,38];
        else if (v === "Incomplet") data.cell.styles.textColor = [217,119,6];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Pied de page
  const pages = (doc as jsPDF & { internal: { getNumberOfPages:()=>number } }).internal.getNumberOfPages();
  for (let i=1; i<=pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(160,160,160);
    doc.text(`Document confidentiel — ${opts.employeeName} — ${opts.period} — Page ${i}/${pages}`, 105, 292, { align:"center" });
  }

  doc.save(filename);
}

// ─── Modal d'export PDF ───────────────────────────────────────────────────────
function ExportModal({
  onClose,
  defaultStart, defaultEnd,
  employeeName, matricule,
}: {
  onClose: () => void;
  defaultStart: string; defaultEnd: string;
  employeeName: string; matricule: string;
}) {
  const now = new Date();
  const [startDate,    setStartDate]    = useState(defaultStart);
  const [endDate,      setEndDate]      = useState(defaultEnd);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [docTitle,     setDocTitle]     = useState("Relevé de pointage");
  const [loading,      setLoading]      = useState(false);

  const STATUS_OPTIONS: { value: StatusFilter; label: string; color: string }[] = [
    { value: "all",        label: "Tous les jours",        color: "text-gray-700"   },
    { value: "present",    label: "Présents uniquement",   color: "text-green-700"  },
    { value: "absent",     label: "Absents uniquement",    color: "text-red-600"    },
    { value: "incomplete", label: "Incomplets uniquement", color: "text-amber-600"  },
  ];

  const handleDownload = async () => {
    if (!startDate || !endDate) { toast.error("Veuillez sélectionner les dates."); return; }
    if (startDate > endDate)    { toast.error("La date de début doit être avant la date de fin."); return; }
    setLoading(true);
    try {
      const res = await fetchMyAttendance(startDate, endDate);
      let days = res.days;
      if (statusFilter !== "all") days = days.filter(d => d.status === statusFilter);
      if (days.length === 0) { toast.error("Aucun pointage pour cette sélection."); setLoading(false); return; }

      const s = new Date(startDate+"T12:00:00");
      const e = new Date(endDate+"T12:00:00");
      const period = startDate === endDate
        ? `${s.getDate()} ${MONTHS_FR[s.getMonth()]} ${s.getFullYear()}`
        : `${s.getDate()} ${MONTHS_FR[s.getMonth()]} ${s.getFullYear()} — ${e.getDate()} ${MONTHS_FR[e.getMonth()]} ${e.getFullYear()}`;

      buildPdf(
        days,
        {
          employeeName, matricule,
          period,
          docTitle: docTitle.trim() || "Relevé de pointage",
          generatedAt: now.toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" }),
        },
        `pointage_${startDate}_${endDate}_${matricule}.pdf`,
      );
      toast.success("PDF téléchargé !");
      onClose();
    } catch { toast.error("Erreur lors de la génération du PDF."); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
         onClick={onClose}>
      <motion.div
        initial={{ opacity:0, scale:0.96, y:8 }}
        animate={{ opacity:1, scale:1,    y:0 }}
        exit={{    opacity:0, scale:0.96, y:8 }}
        transition={{ duration:0.16 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#003c71]/10 flex items-center justify-center">
              <FileDown size={15} className="text-[#003c71]" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Télécharger en PDF</p>
              <p className="text-xs text-gray-400">Personnalisez votre relevé de pointage</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <X size={16} />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4">

          {/* Titre du document */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Titre du document</label>
            <input
              type="text"
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              placeholder="Ex : Relevé de pointage janvier 2026"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30"
            />
          </div>

          {/* Plage de dates */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block flex items-center gap-1">
              <CalendarDays size={12}/> Période
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-gray-400 mb-1">Du</p>
                <input
                  type="date" value={startDate}
                  max={toDateStr(now)}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30"
                />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-1">Au</p>
                <input
                  type="date" value={endDate}
                  max={toDateStr(now)}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30"
                />
              </div>
            </div>
          </div>

          {/* Filtre par statut */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
              <Filter size={12}/> Filtrer par statut
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                    statusFilter === opt.value
                      ? "bg-[#003c71] border-[#003c71] text-white"
                      : "border-gray-200 text-gray-600 hover:border-[#003c71]/30 hover:bg-gray-50"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    opt.value === "all"        ? "bg-gray-400"
                    : opt.value === "present"  ? "bg-green-500"
                    : opt.value === "absent"   ? "bg-red-500"
                    :                            "bg-amber-500"
                  } ${statusFilter === opt.value ? "bg-white/70" : ""}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aperçu du fichier */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
              <FileDown size={15} className="text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">
                {(docTitle.trim() || "Relevé de pointage") || "pointage"}.pdf
              </p>
              <p className="text-[11px] text-gray-400">
                {employeeName} · {matricule}
                {startDate && endDate && startDate !== endDate
                  ? ` · du ${startDate} au ${endDate}`
                  : startDate ? ` · ${startDate}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={handleDownload} disabled={loading || !startDate || !endDate}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Télécharger
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal de justification d'absence ────────────────────────────────────────
function JustifyModal({
  defaultDate,
  disputedDates,
  onClose,
  onSubmitted,
}: {
  defaultDate: string;
  disputedDates: Set<string>;
  onClose: () => void;
  onSubmitted: (date: string) => void;
}) {
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [dayRecord,    setDayRecord]    = useState<DayRecord | null>(null);
  const [loadingRec,   setLoadingRec]   = useState(false);
  const [text,         setText]         = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [showHist,     setShowHist]     = useState(false);
  const [histList,     setHistList]     = useState<AttendanceDispute[]>([]);
  const [loadingHist,  setLoadingHist]  = useState(false);

  const alreadyDisputed = disputedDates.has(selectedDate);

  // Charge l'historique des justifications
  useEffect(() => {
    if (!showHist) return;
    setLoadingHist(true);
    fetchMyDisputes()
      .then(list => setHistList(list as AttendanceDispute[]))
      .catch(() => setHistList([]))
      .finally(() => setLoadingHist(false));
  }, [showHist]);

  function disputeStatusBadge(status: string) {
    if (status === "approved") return { label: "Approuvé",  cls: "bg-green-100 text-green-700", dot: "bg-green-500" };
    if (status === "rejected") return { label: "Rejeté",    cls: "bg-red-100 text-red-600",     dot: "bg-red-500"   };
    return                            { label: "En attente", cls: "bg-amber-100 text-amber-700", dot: "bg-amber-500" };
  }

  // Charge le pointage de l'employé pour la date sélectionnée
  useEffect(() => {
    if (!selectedDate) { setDayRecord(null); return; }
    setLoadingRec(true);
    setDayRecord(null);
    fetchMyAttendance(selectedDate, selectedDate)
      .then(r => setDayRecord(r.days[0] ?? null))
      .catch(() => setDayRecord(null))
      .finally(() => setLoadingRec(false));
  }, [selectedDate]);

  const hasProof = dayRecord && (dayRecord.in_time || dayRecord.out_time || dayRecord.worked_minutes > 0);

  const handleSubmit = async () => {
    if (!selectedDate) { toast.error("Veuillez sélectionner une date."); return; }
    if (!text.trim())  { toast.error("Veuillez saisir une justification."); return; }
    setSubmitting(true);
    try {
      await submitDispute(selectedDate, text.trim());
      toast.success("Justification envoyée au service RH.");
      onSubmitted(selectedDate);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Erreur lors de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
         onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{    opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.16 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#003c71]/10 flex items-center justify-center">
              <ShieldAlert size={15} className="text-[#003c71]" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Justifier une absence</p>
              <p className="text-xs text-gray-400">Vérifiez vos données de pointage et soumettez au RH</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <X size={16} />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4">

          {/* Sélecteur de date */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
              <CalendarDays size={12}/> Date à justifier
            </label>
            <input
              type="date"
              value={selectedDate}
              max={toDateStr(now)}
              onChange={e => { setSelectedDate(e.target.value); setText(""); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30"
            />
            {alreadyDisputed && selectedDate && (
              <p className="mt-1.5 text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200 flex items-center gap-1.5">
                <ShieldAlert size={11}/> Une justification est déjà en cours de traitement pour cette date.
              </p>
            )}
          </div>

          {/* Données de pointage de l'employé — la preuve */}
          {selectedDate && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">
                Vos données de pointage pour cette date
              </p>
              {loadingRec ? (
                <div className="flex justify-center py-5">
                  <Loader2 size={20} className="animate-spin text-[#003c71]" />
                </div>
              ) : hasProof ? (
                <div className="rounded-xl border border-green-200 bg-green-50 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-green-100">
                    <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                    <p className="text-xs font-semibold text-green-700">
                      Données trouvées — seront jointes comme preuve
                    </p>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-green-100">
                    {[
                      { label: "Arrivée",  value: dayRecord!.in_time  ?? "—", icon: <Clock size={13} className="text-green-500"/> },
                      { label: "Départ",   value: dayRecord!.out_time ?? "—", icon: <Clock size={13} className="text-red-400"/>   },
                      { label: "Durée",    value: formatMinutes(dayRecord!.worked_minutes), icon: <CalendarDays size={13} className="text-[#003c71]"/> },
                    ].map(item => (
                      <div key={item.label} className="px-3 py-3 text-center">
                        <div className="flex justify-center mb-1">{item.icon}</div>
                        <div className="text-sm font-bold text-gray-800">{item.value}</div>
                        <div className="text-[10px] text-gray-400">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-400 text-center border border-gray-100">
                  Aucune donnée de pointage trouvée pour cette date.<br/>
                  <span className="text-gray-300">Vous pouvez quand même soumettre une explication écrite.</span>
                </div>
              )}
            </div>
          )}

          {/* Texte justificatif */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Votre explication <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Expliquez pourquoi le RH vous a marqué absent alors que vos données montrent le contraire…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 resize-none"
            />
          </div>
        </div>

        {/* ─ Historique des justifications ─ */}
        <div className="px-5 pb-3">
          <button
            onClick={() => setShowHist(p => !p)}
            className="flex items-center gap-2 text-xs font-medium text-[#003c71] hover:underline transition"
          >
            <History size={13} />
            {showHist ? "Masquer l'historique" : "Voir mes justifications"}
            <ChevronDown size={12} className={`text-[#003c71]/70 transition-transform ${showHist ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {showHist && (
              <motion.div
                key="hist-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{    opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 max-h-52 overflow-y-auto space-y-2 pr-1">
                  {loadingHist ? (
                    <div className="flex justify-center py-4">
                      <Loader2 size={18} className="animate-spin text-[#003c71]" />
                    </div>
                  ) : histList.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-4">Aucune justification envoyée.</p>
                  ) : (
                    histList.map(d => {
                      const badge = disputeStatusBadge(d.status);
                      const dt    = new Date(d.work_date + "T12:00:00");
                      return (
                        <div key={d.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 flex items-start gap-3">
                          <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${badge.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-gray-700">
                                {DAYS_FR[dt.getDay()]} {dt.getDate()} {MONTHS_FR[dt.getMonth()]} {dt.getFullYear()}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 truncate">{d.justification_text}</p>
                            {d.resolution_note && (
                              <p className="text-[10px] text-gray-400 italic mt-0.5 truncate">
                                RH : {d.resolution_note}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !text.trim() || !selectedDate || alreadyDisputed}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Envoyer au RH
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Calendrier mensuel ───────────────────────────────────────────────────────
const CAL_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function AttendanceCalendar({ days, year, month }: { days: DayRecord[]; year: number; month: number }) {
  // Indexer les jours par date string
  const byDate = Object.fromEntries(days.map(d => [d.date, d]));

  // Calcul de la grille (semaines × 7 jours, lundi en 1er)
  const firstDay    = new Date(year, month, 1);
  const lastDay     = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;  // lundi=0 … dimanche=6
  const totalCells  = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isFuture  = (d: Date) => { const c = new Date(d); c.setHours(0,0,0,0); return c > today; };
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const n = i - startOffset + 1;
    cells.push(n >= 1 && n <= lastDay.getDate() ? new Date(year, month, n) : null);
  }
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* En-têtes */}
      <div className="grid grid-cols-7 bg-[#003c71]">
        {CAL_DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-bold text-white/90">{d}</div>
        ))}
      </div>

      {/* Grille */}
      <div className="divide-y divide-gray-100">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-gray-100">
            {week.map((d, di) => {
              /* ── Cellule vide (hors mois) ── */
              if (!d) return <div key={di} className="bg-gray-50/30 min-h-[80px]" />;

              const dateStr = [
                d.getFullYear(),
                String(d.getMonth()+1).padStart(2,"0"),
                String(d.getDate()).padStart(2,"0"),
              ].join("-");

              const rec     = byDate[dateStr];
              const future  = isFuture(d);
              const weekend = isWeekend(d);
              const isToday = d.toDateString() === today.toDateString();

              /* ── Cellule future : affichage neutre ── */
              if (future) {
                return (
                  <div key={di} className={`min-h-[80px] p-1.5 border border-transparent ${weekend ? "bg-gray-100/40" : "bg-gray-50/30"}`}>
                    <span className="text-xs font-semibold text-gray-200">{d.getDate()}</span>
                  </div>
                );
              }

              /* ── Cellule passée ── */
              const bg =
                !rec            ? (weekend ? "bg-gray-100/70 border-gray-100" : "bg-gray-50 border-gray-100") :
                rec.status === "present"    ? "bg-emerald-50 border-emerald-200" :
                rec.status === "absent"     ? "bg-red-50 border-red-200"         :
                                              "bg-amber-50 border-amber-200";

              return (
                <div key={di} className={`min-h-[80px] p-1.5 border flex flex-col ${bg}`}>
                  {/* Numéro du jour */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold leading-none ${
                      isToday
                        ? "w-5 h-5 bg-[#003c71] text-white rounded-full flex items-center justify-center text-[10px]"
                        : "text-gray-600"
                    }`}>
                      {d.getDate()}
                    </span>
                  </div>

                  {/* Contenu */}
                  {rec ? (
                    rec.status === "absent" ? (
                      /* Absent : centré verticalement */
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-red-500 tracking-wide">Absent</span>
                      </div>
                    ) : (
                      /* Présent / Incomplet : horaires */
                      <div className="flex-1 flex flex-col justify-center gap-0.5">
                        <div className="text-[10px] leading-tight text-gray-600">
                          <span className="text-emerald-600 font-bold">↑</span>{" "}
                          <span className="font-medium">{rec.in_time ?? <span className="text-gray-300">—</span>}</span>
                        </div>
                        <div className="text-[10px] leading-tight text-gray-600">
                          <span className="text-red-400 font-bold">↓</span>{" "}
                          <span className="font-medium">{rec.out_time ?? <span className="text-gray-300">—</span>}</span>
                        </div>
                        {rec.worked_minutes > 0 && (
                          <div className="text-[9px] text-gray-400 leading-tight mt-0.5">
                            {formatMinutes(rec.worked_minutes)}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    /* Aucun enregistrement (week-end ou férié) */
                    <div className="flex-1" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-4 flex-wrap">
        {[
          { dot: "bg-emerald-500", label: "Présent"   },
          { dot: "bg-red-400",     label: "Absent"    },
          { dot: "bg-amber-400",   label: "Incomplet" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${l.dot}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tableau commun (vues journalière et hebdomadaire) ────────────────────────
function AttendanceTable({ days }: { days: DayRecord[] }) {
  if (days.length === 0) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <XCircle size={36} className="mx-auto mb-3 text-gray-200" />
      <p className="text-gray-400 text-sm">Aucun pointage pour cette période.</p>
    </div>
  );
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#003c71] text-white text-xs">
            {["Jour","Statut","Arrivée","Départ","Durée"].map(h => (
              <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => {
            const bd = statusBadge(day.status);
            const dt = new Date(day.date+"T12:00:00");
            return (
              <tr key={day.date} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                <td className="px-4 py-2.5 font-medium text-gray-700 text-xs">
                  {DAYS_FR[dt.getDay()]} {dt.getDate()} {MONTHS_FR[dt.getMonth()]}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-semibold ${bd.cls}`}>
                    {bd.icon} {bd.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600 text-xs">{day.in_time  ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-2.5 text-gray-600 text-xs">{day.out_time ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-2.5 font-medium text-gray-700 text-xs">{formatMinutes(day.worked_minutes)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Vue journalière ──────────────────────────────────────────────────────────
function DailyView({ date, setDate }: { date: Date; setDate: (d: Date) => void }) {
  const [record,  setRecord]  = useState<DayRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const d = date;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyAttendance(toDateStr(date), toDateStr(date));
      setRecord(res.days[0] ?? null);
    } catch { toast.error("Erreur lors du chargement."); setRecord(null); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const badge = record ? statusBadge(record.status) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
        <button onClick={() => setDate(addDays(date,-1))}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
          <ChevronLeft size={16}/>
        </button>
        <span className="font-semibold text-[#003c71] text-sm">
          {DAYS_FR[d.getDay()]} {d.getDate()} {MONTHS_FR[d.getMonth()]} {d.getFullYear()}
        </span>
        <button onClick={() => setDate(addDays(date,1))} disabled={date >= new Date()}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
          <ChevronRight size={16}/>
        </button>
      </div>
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#003c71]"/>
        </div>
      ) : record ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge?.cls}`}>
            {badge?.icon} {badge?.label}
          </span>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:"Arrivée", value:record.in_time??"—",  icon:<Clock size={16} className="text-green-500"/> },
              { label:"Départ",  value:record.out_time??"—", icon:<Clock size={16} className="text-red-400"/>   },
              { label:"Durée",   value:formatMinutes(record.worked_minutes), icon:<CalendarDays size={16} className="text-[#003c71]"/> },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                <div className="flex justify-center mb-1">{item.icon}</div>
                <div className="text-lg font-bold text-gray-800">{item.value}</div>
                <div className="text-[11px] text-gray-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <XCircle size={36} className="mx-auto mb-3 text-gray-200"/>
          <p className="text-gray-400 text-sm">Aucun pointage enregistré pour cette journée.</p>
        </div>
      )}
    </div>
  );
}

// ─── Vue hebdomadaire ─────────────────────────────────────────────────────────
function WeeklyView({ weekStart, setWeekStart }: { weekStart: Date; setWeekStart: (d: Date) => void }) {
  const [days, setDays] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const weekEnd = addDays(weekStart, 6);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyAttendance(toDateStr(weekStart), toDateStr(weekEnd));
      setDays(res.days);
    } catch { toast.error("Erreur lors du chargement."); setDays([]); }
    finally { setLoading(false); }
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const today        = new Date();
  const totalWorked  = days.reduce((s,d)=>s+(d.worked_minutes||0),0);
  const presentCount = days.filter(d=>d.status==="present").length;
  const absentCount  = days.filter(d=>d.status==="absent" && new Date(d.date+"T12:00:00")<=today).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
        <button onClick={() => setWeekStart(addDays(weekStart,-7))}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
          <ChevronLeft size={16}/>
        </button>
        <span className="font-semibold text-[#003c71] text-sm">
          {weekStart.getDate()} {MONTHS_FR[weekStart.getMonth()]} — {weekEnd.getDate()} {MONTHS_FR[weekEnd.getMonth()]} {weekEnd.getFullYear()}
        </span>
        <button onClick={() => setWeekStart(addDays(weekStart,7))} disabled={weekStart >= startOfWeek(new Date())}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
          <ChevronRight size={16}/>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Jours présents",     value:`${presentCount} / 5`,     icon:<CheckCircle2 size={18} className="text-green-500"/> },
          { label:"Heures travaillées", value:formatMinutes(totalWorked), icon:<Clock size={18} className="text-[#003c71]"/>        },
          { label:"Absences",           value:String(absentCount),        icon:<XCircle size={18} className="text-red-400"/>        },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="flex justify-center mb-1">{item.icon}</div>
            <div className="text-xl font-bold text-gray-800">{loading ? "…" : item.value}</div>
            <div className="text-[11px] text-gray-400">{item.label}</div>
          </div>
        ))}
      </div>
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#003c71]"/>
        </div>
      ) : (
        /* ── Tableau hebdo avec — pour les jours futurs ── */
        (() => {
          const today   = new Date(); today.setHours(0,0,0,0);
          const byDate  = Object.fromEntries(days.map(d => [d.date, d]));
          // Générer les 7 jours de la semaine
          const weekDays = Array.from({length: 7}, (_, i) => addDays(weekStart, i));

          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003c71] text-white text-xs">
                    {["Jour","Statut","Arrivée","Départ","Durée"].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((d, i) => {
                    const dateStr = toDateStr(d);
                    const rec     = byDate[dateStr];
                    const future  = new Date(d).setHours(0,0,0,0) > today.getTime();
                    const isToday = d.toDateString() === today.toDateString();
                    const bd      = rec ? statusBadge(rec.status) : null;

                    return (
                      <tr key={dateStr} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                        {/* Jour */}
                        <td className={`px-4 py-2.5 font-medium text-xs ${isToday ? "text-[#003c71] font-bold" : future ? "text-gray-300" : "text-gray-700"}`}>
                          {DAYS_FR[d.getDay()]} {d.getDate()} {MONTHS_FR[d.getMonth()]}
                          {isToday && <span className="ml-1.5 text-[9px] bg-[#003c71] text-white px-1.5 py-0.5 rounded-full">Aujourd'hui</span>}
                        </td>
                        {future ? (
                          /* Jours futurs : tirets */
                          <>
                            <td className="px-4 py-2.5 text-gray-200 text-xs">—</td>
                            <td className="px-4 py-2.5 text-gray-200 text-xs">—</td>
                            <td className="px-4 py-2.5 text-gray-200 text-xs">—</td>
                            <td className="px-4 py-2.5 text-gray-200 text-xs">—</td>
                          </>
                        ) : rec ? (
                          /* Jours passés avec données */
                          <>
                            <td className="px-4 py-2.5">
                              <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-semibold ${bd!.cls}`}>
                                {bd!.icon} {bd!.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 text-xs">{rec.in_time  ?? <span className="text-gray-300">—</span>}</td>
                            <td className="px-4 py-2.5 text-gray-600 text-xs">{rec.out_time ?? <span className="text-gray-300">—</span>}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-700 text-xs">{formatMinutes(rec.worked_minutes)}</td>
                          </>
                        ) : (
                          /* Jours passés sans données */
                          <>
                            <td className="px-4 py-2.5 text-gray-300 text-xs">—</td>
                            <td className="px-4 py-2.5 text-gray-300 text-xs">—</td>
                            <td className="px-4 py-2.5 text-gray-300 text-xs">—</td>
                            <td className="px-4 py-2.5 text-gray-300 text-xs">—</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()
      )}
    </div>
  );
}

// ─── Vue mensuelle ────────────────────────────────────────────────────────────
function MonthlyView({ year, month, setMonth }: { year: number; month: number; setMonth: (y:number,m:number)=>void }) {
  const [days, setDays] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyAttendance(toDateStr(startOfMonth(year,month)), toDateStr(endOfMonth(year,month)));
      setDays(res.days);
    } catch { toast.error("Erreur lors du chargement."); setDays([]); }
    finally { setLoading(false); }
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const today         = new Date();
  const past          = days.filter(d=>new Date(d.date+"T12:00:00")<=today);
  const presentCount  = past.filter(d=>d.status==="present").length;
  const absentCount   = past.filter(d=>d.status==="absent").length;
  const incompleteCount = past.filter(d=>d.status==="incomplete").length;
  const totalMinutes  = days.reduce((s,d)=>s+(d.worked_minutes||0),0);

  const prevMonth = () => month===0 ? setMonth(year-1,11) : setMonth(year,month-1);
  const nextMonth = () => { const n=new Date(); if(year>n.getFullYear()||(year===n.getFullYear()&&month>=n.getMonth())) return; month===11?setMonth(year+1,0):setMonth(year,month+1); };
  const nextDisabled = () => { const n=new Date(); return year>n.getFullYear()||(year===n.getFullYear()&&month>=n.getMonth()); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"><ChevronLeft size={16}/></button>
        <span className="font-semibold text-[#003c71] text-sm">{MONTHS_FR[month]} {year}</span>
        <button onClick={nextMonth} disabled={nextDisabled()} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"><ChevronRight size={16}/></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Présents",     value:String(presentCount),    icon:<CheckCircle2 size={18} className="text-green-500"/>,  bg:"bg-green-50"  },
          { label:"Absents",      value:String(absentCount),     icon:<XCircle size={18} className="text-red-400"/>,         bg:"bg-red-50"    },
          { label:"Incomplets",   value:String(incompleteCount), icon:<AlertTriangle size={18} className="text-amber-500"/>, bg:"bg-amber-50"  },
          { label:"Total heures", value:formatMinutes(totalMinutes), icon:<BarChart3 size={18} className="text-[#003c71]"/>, bg:"bg-blue-50"   },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>{item.icon}</div>
            <div className="text-xl font-bold text-gray-800">{loading ? "…" : item.value}</div>
            <div className="text-[11px] text-gray-400">{item.label}</div>
          </div>
        ))}
      </div>
      {loading
        ? <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-[#003c71]"/></div>
        : <AttendanceCalendar days={days} year={year} month={month} />}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
interface Props { layout?: React.ComponentType<{ children: React.ReactNode }>; }

export default function EmployeeAttendancePage({ layout: Layout = EmployeeLayout }: Props) {
  const { user } = useAuth();
  const [view,             setView]            = useState<ViewMode>("daily");
  const [showExport,       setShowExport]       = useState(false);
  const [showJustify,      setShowJustify]      = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target as Node))
        setShowViewDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Disputes ──────────────────────────────────────────────────────────────
  const [disputedDates, setDisputedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchMyDisputes()
      .then(list => setDisputedDates(new Set(list.map((d: AttendanceDispute) => d.work_date))))
      .catch(() => {});
  }, []);

  const handleJustifySubmitted = (date: string) => {
    setDisputedDates(prev => new Set([...prev, date]));
  };

  const now = new Date();
  const [date,      setDate]      = useState<Date>(() => { const d=new Date(); d.setHours(12,0,0,0); return d; });
  const [weekStart, setWeekStart] = useState<Date>(() => { const d=startOfWeek(new Date()); d.setHours(12,0,0,0); return d; });
  const [selYear,   setSelYear]   = useState(now.getFullYear());
  const [selMonth,  setSelMonth]  = useState(now.getMonth());

  const employeeName = user?.employee_name || user?.username || "Employé";
  const matricule    = user?.employee_matricule || "";

  if (!matricule) return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-10 text-center">
        <XCircle size={48} className="mx-auto mb-3 text-gray-200"/>
        <p className="text-gray-400">Aucune fiche employé liée à ce compte.</p>
      </div>
    </Layout>
  );

  // Calcule la plage par défaut selon la vue courante
  const defaultRange = (): { start: string; end: string } => {
    if (view === "daily")   return { start: toDateStr(date),             end: toDateStr(date) };
    if (view === "weekly")  return { start: toDateStr(weekStart),        end: toDateStr(addDays(weekStart,6)) };
    return                         { start: toDateStr(startOfMonth(selYear,selMonth)), end: toDateStr(endOfMonth(selYear,selMonth)) };
  };

  const VIEW_OPTIONS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key:"daily",   label:"Journalier",   icon:<Clock size={14}/> },
    { key:"weekly",  label:"Hebdomadaire", icon:<CalendarDays size={14}/> },
    { key:"monthly", label:"Mensuel",      icon:<BarChart3 size={14}/> },
  ];

  return (
    <Layout>
      <div className="px-4 md:px-6 pb-10">

        {/* Header + filtres + bouton PDF */}
        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
          className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Mes Pointages</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Consultez vos horaires d'arrivée et de départ.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sélecteur de vue — dropdown */}
            <div className="relative" ref={viewDropdownRef}>
              <button
                onClick={() => setShowViewDropdown(p => !p)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                {VIEW_OPTIONS.find(v => v.key === view)?.icon}
                {VIEW_OPTIONS.find(v => v.key === view)?.label}
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${showViewDropdown ? "rotate-180" : ""}`} />
              </button>
              {showViewDropdown && (
                <div className="absolute left-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20">
                  {VIEW_OPTIONS.map(v => (
                    <button
                      key={v.key}
                      onClick={() => { setView(v.key); setShowViewDropdown(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition ${
                        view === v.key
                          ? "bg-[#003c71]/5 text-[#003c71] font-semibold"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {v.icon} {v.label}
                      {view === v.key && <CheckCircle2 size={13} className="ml-auto text-[#003c71]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Séparateur */}
            <div className="w-px h-7 bg-gray-200 mx-1 hidden sm:block" />

            {/* Actions */}
            <button onClick={() => setShowExport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition shrink-0">
              <FileDown size={15} className="text-[#003c71]"/> Télécharger PDF
            </button>

            <button onClick={() => setShowJustify(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition shrink-0">
              <ShieldAlert size={15}/> Justifier une absence
            </button>
          </div>
        </motion.div>

        {/* Contenu */}
        {view === "daily"   && <DailyView   date={date}       setDate={setDate} />}
        {view === "weekly"  && <WeeklyView  weekStart={weekStart} setWeekStart={setWeekStart} />}
        {view === "monthly" && <MonthlyView year={selYear} month={selMonth} setMonth={(y,m)=>{setSelYear(y);setSelMonth(m);}} />}
      </div>

      {/* Modal export */}
      <AnimatePresence>
        {showExport && (
          <ExportModal
            key="export-modal"
            onClose={() => setShowExport(false)}
            defaultStart={defaultRange().start}
            defaultEnd={defaultRange().end}
            employeeName={employeeName}
            matricule={matricule}
          />
        )}
        {showJustify && (
          <JustifyModal
            key="justify-modal"
            defaultDate={defaultRange().start}
            disputedDates={disputedDates}
            onClose={() => setShowJustify(false)}
            onSubmitted={handleJustifySubmitted}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
