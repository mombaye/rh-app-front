import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Clock, CalendarDays, ChevronLeft, ChevronRight,
  FileDown, Loader2, CheckCircle2, XCircle, AlertTriangle,
  BarChart3,
} from "lucide-react";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { fetchMyAttendance } from "@/services/employeeService";
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

type ViewMode = "daily" | "weekly" | "monthly";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS_FR    = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAYS_FULL  = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS_FR  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1, 12);
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 12);
}

function formatMinutes(min: number): string {
  if (!min || min <= 0) return "0h00";
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function statusBadge(status: DayRecord["status"]) {
  if (status === "present")    return { label: "Présent",   cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={13} /> };
  if (status === "incomplete") return { label: "Incomplet", cls: "bg-amber-100 text-amber-700", icon: <AlertTriangle size={13} /> };
  return                              { label: "Absent",    cls: "bg-red-100 text-red-600",     icon: <XCircle size={13} /> };
}

// ─── Génération PDF personnalisée ─────────────────────────────────────────────
interface PdfMeta {
  employeeName: string;
  matricule: string;
  period: string;
  generatedAt: string;
}

function buildPdf(days: DayRecord[], meta: PdfMeta, filename: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const primary = [0, 60, 113] as [number, number, number]; // #003c71

  // ── En-tête ────────────────────────────────────────────────────────────────
  doc.setFillColor(...primary);
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Camusat — Relevé de pointage", 14, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Période : ${meta.period}`, 14, 20);
  doc.text(`Généré le ${meta.generatedAt}`, 210 - 14, 20, { align: "right" });

  // ── Bloc employé ───────────────────────────────────────────────────────────
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 33, 182, 20, 3, 3, "F");

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(meta.employeeName, 20, 42);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Matricule : ${meta.matricule}`, 20, 49);

  // ── Statistiques récapitulatives ──────────────────────────────────────────
  const today = new Date();
  const pastDays = days.filter(d => new Date(d.date + "T12:00:00") <= today);
  const presentCount    = pastDays.filter(d => d.status === "present").length;
  const absentCount     = pastDays.filter(d => d.status === "absent").length;
  const incompleteCount = pastDays.filter(d => d.status === "incomplete").length;
  const totalMinutes    = days.reduce((s, d) => s + (d.worked_minutes || 0), 0);

  const stats = [
    { label: "Présents",   value: String(presentCount),              color: [21, 128, 61] as [number, number, number] },
    { label: "Absents",    value: String(absentCount),               color: [220, 38, 38] as [number, number, number] },
    { label: "Incomplets", value: String(incompleteCount),           color: [217, 119, 6] as [number, number, number] },
    { label: "Total heures", value: formatMinutes(totalMinutes),     color: [0, 60, 113]  as [number, number, number] },
  ];

  const boxW = 182 / 4 - 2;
  stats.forEach((s, i) => {
    const x = 14 + i * (boxW + 2.5);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, 58, boxW, 16, 2, 2, "F");
    doc.setTextColor(...s.color);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(s.value, x + boxW / 2, 67, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(s.label, x + boxW / 2, 72, { align: "center" });
  });

  // ── Tableau ────────────────────────────────────────────────────────────────
  const rows = days.map(day => {
    const dt = new Date(day.date + "T12:00:00");
    const bd = statusBadge(day.status);
    return [
      `${DAYS_FULL[dt.getDay()]} ${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`,
      bd.label,
      day.in_time  ?? "—",
      day.out_time ?? "—",
      formatMinutes(day.worked_minutes),
    ];
  });

  autoTable(doc, {
    startY: 80,
    head: [["Date", "Statut", "Arrivée", "Départ", "Durée"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3, font: "helvetica" },
    headStyles: { fillColor: primary, textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 26 },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const v = data.cell.raw as string;
        if (v === "Présent")   data.cell.styles.textColor = [21, 128, 61];
        else if (v === "Absent")    data.cell.styles.textColor = [220, 38, 38];
        else if (v === "Incomplet") data.cell.styles.textColor = [217, 119, 6];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // ── Pied de page ──────────────────────────────────────────────────────────
  const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Document confidentiel — ${meta.employeeName} — ${meta.period} — Page ${i}/${pageCount}`,
      105, 292, { align: "center" }
    );
  }

  doc.save(filename);
}

// ─── Vue journalière ──────────────────────────────────────────────────────────
function DailyView({
  date, setDate, employeeName, matricule,
}: { date: Date; setDate: (d: Date) => void; employeeName: string; matricule: string }) {
  const [record,  setRecord]  = useState<DayRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const str = toDateStr(date);
      const res = await fetchMyAttendance(str, str);
      setRecord(res.days[0] ?? null);
    } catch { toast.error("Erreur lors du chargement."); setRecord(null); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const badge = record ? statusBadge(record.status) : null;
  const d     = date;

  const handleExport = async () => {
    if (!record) return;
    setExporting(true);
    try {
      const period = `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
      buildPdf(
        [record],
        {
          employeeName,
          matricule,
          period,
          generatedAt: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        },
        `pointage_${toDateStr(date)}_${matricule}.pdf`,
      );
      toast.success("PDF téléchargé !");
    } catch { toast.error("Erreur lors de la génération du PDF."); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
        <button onClick={() => setDate(addDays(date, -1))}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
          <ChevronLeft size={16} />
        </button>
        <span className="font-semibold text-[#003c71] text-sm">
          {DAYS_FR[d.getDay()]} {d.getDate()} {MONTHS_FR[d.getMonth()]} {d.getFullYear()}
        </span>
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= new Date()}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#003c71]" />
        </div>
      ) : record ? (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge?.cls}`}>
                {badge?.icon} {badge?.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Arrivée", value: record.in_time  ?? "—", icon: <Clock size={16} className="text-green-500" /> },
                { label: "Départ",  value: record.out_time ?? "—", icon: <Clock size={16} className="text-red-400" />   },
                { label: "Durée",   value: formatMinutes(record.worked_minutes), icon: <CalendarDays size={16} className="text-[#003c71]" /> },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <div className="flex justify-center mb-1">{item.icon}</div>
                  <div className="text-lg font-bold text-gray-800">{item.value}</div>
                  <div className="text-[11px] text-gray-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-60">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Télécharger en PDF
          </button>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <XCircle size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">Aucun pointage enregistré pour cette journée.</p>
        </div>
      )}
    </div>
  );
}

// ─── Vue hebdomadaire ─────────────────────────────────────────────────────────
function WeeklyView({
  weekStart, setWeekStart, employeeName, matricule,
}: { weekStart: Date; setWeekStart: (d: Date) => void; employeeName: string; matricule: string }) {
  const [days, setDays] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const today         = new Date();
  const totalWorked   = days.reduce((s, d) => s + (d.worked_minutes || 0), 0);
  const presentCount  = days.filter(d => d.status === "present").length;
  const absentCount   = days.filter(d => d.status === "absent" && new Date(d.date + "T12:00:00") <= today).length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const period = `Semaine du ${weekStart.getDate()} ${MONTHS_FR[weekStart.getMonth()]} au ${weekEnd.getDate()} ${MONTHS_FR[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
      buildPdf(
        days,
        {
          employeeName,
          matricule,
          period,
          generatedAt: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        },
        `pointage_semaine_${toDateStr(weekStart)}_${matricule}.pdf`,
      );
      toast.success("PDF téléchargé !");
    } catch { toast.error("Erreur lors de la génération du PDF."); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
          <ChevronLeft size={16} />
        </button>
        <span className="font-semibold text-[#003c71] text-sm">
          {weekStart.getDate()} {MONTHS_FR[weekStart.getMonth()]} — {weekEnd.getDate()} {MONTHS_FR[weekEnd.getMonth()]} {weekEnd.getFullYear()}
        </span>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={weekStart >= startOfWeek(new Date())}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Jours présents",    value: `${presentCount} / 5`, icon: <CheckCircle2 size={18} className="text-green-500" /> },
          { label: "Heures travaillées", value: formatMinutes(totalWorked), icon: <Clock size={18} className="text-[#003c71]" /> },
          { label: "Absences",          value: String(absentCount),   icon: <XCircle size={18} className="text-red-400" /> },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="flex justify-center mb-1">{item.icon}</div>
            <div className="text-xl font-bold text-gray-800">{loading ? "…" : item.value}</div>
            <div className="text-[11px] text-gray-400">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#003c71]" />
        </div>
      ) : (
        <>
          <AttendanceTable days={days} />
          <button onClick={handleExport} disabled={exporting || days.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-60">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Télécharger en PDF
          </button>
        </>
      )}
    </div>
  );
}

// ─── Vue mensuelle ────────────────────────────────────────────────────────────
function MonthlyView({
  year, month, setMonth, employeeName, matricule,
}: {
  year: number; month: number;
  setMonth: (y: number, m: number) => void;
  employeeName: string; matricule: string;
}) {
  const [days, setDays] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const mStart = startOfMonth(year, month);
  const mEnd   = endOfMonth(year, month);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyAttendance(toDateStr(mStart), toDateStr(mEnd));
      setDays(res.days);
    } catch { toast.error("Erreur lors du chargement."); setDays([]); }
    finally { setLoading(false); }
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const today         = new Date();
  const pastDays      = days.filter(d => new Date(d.date + "T12:00:00") <= today);
  const presentCount  = pastDays.filter(d => d.status === "present").length;
  const absentCount   = pastDays.filter(d => d.status === "absent").length;
  const incompleteCount = pastDays.filter(d => d.status === "incomplete").length;
  const totalMinutes  = days.reduce((s, d) => s + (d.worked_minutes || 0), 0);

  const prevMonth = () => month === 0 ? setMonth(year - 1, 11) : setMonth(year, month - 1);
  const nextMonth = () => {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return;
    month === 11 ? setMonth(year + 1, 0) : setMonth(year, month + 1);
  };
  const isNextDisabled = () => {
    const now = new Date();
    return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const period = `${MONTHS_FR[month]} ${year}`;
      buildPdf(
        days,
        {
          employeeName,
          matricule,
          period,
          generatedAt: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        },
        `pointage_${MONTHS_FR[month].toLowerCase()}_${year}_${matricule}.pdf`,
      );
      toast.success("PDF téléchargé !");
    } catch { toast.error("Erreur lors de la génération du PDF."); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      {/* Navigation mois */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
        <button onClick={prevMonth}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
          <ChevronLeft size={16} />
        </button>
        <span className="font-semibold text-[#003c71] text-sm">
          {MONTHS_FR[month]} {year}
        </span>
        <button onClick={nextMonth} disabled={isNextDisabled()}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Stats mensuelles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Présents",    value: String(presentCount),    icon: <CheckCircle2 size={18} className="text-green-500" />,  bg: "bg-green-50" },
          { label: "Absents",     value: String(absentCount),     icon: <XCircle size={18} className="text-red-400" />,         bg: "bg-red-50"   },
          { label: "Incomplets",  value: String(incompleteCount), icon: <AlertTriangle size={18} className="text-amber-500" />, bg: "bg-amber-50" },
          { label: "Total heures", value: formatMinutes(totalMinutes), icon: <BarChart3 size={18} className="text-[#003c71]" />, bg: "bg-blue-50" },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <div className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>{item.icon}</div>
            <div className="text-xl font-bold text-gray-800">{loading ? "…" : item.value}</div>
            <div className="text-[11px] text-gray-400">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#003c71]" />
        </div>
      ) : (
        <>
          <AttendanceTable days={days} />
          <button onClick={handleExport} disabled={exporting || days.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-60">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Télécharger en PDF
          </button>
        </>
      )}
    </div>
  );
}

// ─── Tableau commun ───────────────────────────────────────────────────────────
function AttendanceTable({ days }: { days: DayRecord[] }) {
  if (days.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <XCircle size={36} className="mx-auto mb-3 text-gray-200" />
        <p className="text-gray-400 text-sm">Aucun pointage pour cette période.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#003c71] text-white text-xs">
            <th className="px-4 py-3 text-left font-semibold">Jour</th>
            <th className="px-4 py-3 text-left font-semibold">Statut</th>
            <th className="px-4 py-3 text-left font-semibold">Arrivée</th>
            <th className="px-4 py-3 text-left font-semibold">Départ</th>
            <th className="px-4 py-3 text-left font-semibold">Durée</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => {
            const bd = statusBadge(day.status);
            const dt = new Date(day.date + "T12:00:00");
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

// ─── Page principale ──────────────────────────────────────────────────────────
interface Props { layout?: React.ComponentType<{ children: React.ReactNode }>; }

export default function EmployeeAttendancePage({ layout: Layout = EmployeeLayout }: Props) {
  const { user } = useAuth();
  const [view, setView] = useState<ViewMode>("monthly");

  const now = new Date();
  const [date,      setDate]      = useState<Date>(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; });
  const [weekStart, setWeekStart] = useState<Date>(() => { const d = startOfWeek(new Date()); d.setHours(12, 0, 0, 0); return d; });
  const [selYear,   setSelYear]   = useState(now.getFullYear());
  const [selMonth,  setSelMonth]  = useState(now.getMonth());

  const employeeName = user?.employee_name  || user?.username || "Employé";
  const matricule    = user?.employee_matricule || "";

  if (!matricule) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 pt-10 text-center">
          <XCircle size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400">Aucune fiche employé liée à ce compte.</p>
        </div>
      </Layout>
    );
  }

  const VIEW_OPTIONS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: "daily",   label: "Journalier",   icon: <Clock size={14} /> },
    { key: "weekly",  label: "Hebdomadaire", icon: <CalendarDays size={14} /> },
    { key: "monthly", label: "Mensuel",      icon: <BarChart3 size={14} /> },
  ];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 md:px-0 pb-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-[#003c71]">Mes Pointages</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Consultez vos horaires d'arrivée et de départ. Téléchargez le PDF pour un document officiel non modifiable.
          </p>
        </motion.div>

        {/* Toggle vue */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {VIEW_OPTIONS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                view === v.key
                  ? "bg-[#003c71] text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {view === "daily" && (
          <DailyView date={date} setDate={setDate} employeeName={employeeName} matricule={matricule} />
        )}
        {view === "weekly" && (
          <WeeklyView weekStart={weekStart} setWeekStart={setWeekStart} employeeName={employeeName} matricule={matricule} />
        )}
        {view === "monthly" && (
          <MonthlyView
            year={selYear} month={selMonth}
            setMonth={(y, m) => { setSelYear(y); setSelMonth(m); }}
            employeeName={employeeName} matricule={matricule}
          />
        )}
      </div>
    </Layout>
  );
}
