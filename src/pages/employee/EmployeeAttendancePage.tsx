import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Clock, CalendarDays, ChevronLeft, ChevronRight,
  FileDown, Loader2, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { fetchMyAttendance } from "@/services/employeeService";
import { useAuth } from "@/contexts/useAuth";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type DayRecord = {
  date: string;
  status: "present" | "absent" | "incomplete";
  in_time: string | null;
  out_time: string | null;
  worked_minutes: number;
  flags: Record<string, unknown>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay(); // 0=Sun
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); // Monday
  return r;
}

function formatMinutes(min: number): string {
  if (!min || min <= 0) return "0h00";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function statusBadge(status: DayRecord["status"]) {
  if (status === "present")    return { label: "Présent",    cls: "bg-green-100 text-green-700",  icon: <CheckCircle2 size={13} /> };
  if (status === "incomplete") return { label: "Incomplet",  cls: "bg-amber-100 text-amber-700",  icon: <AlertTriangle size={13} /> };
  return { label: "Absent", cls: "bg-red-100 text-red-600", icon: <XCircle size={13} /> };
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
function printAttendance(containerRef: React.RefObject<HTMLDivElement | null>, title: string) {
  const el = containerRef.current;
  if (!el) return;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { toast.error("Impossible d'ouvrir la fenêtre d'impression."); return; }
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #222; font-size: 13px; }
        h2  { color: #003c71; margin-bottom: 4px; }
        p.sub { color: #666; margin-bottom: 16px; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #003c71; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
        td { border-bottom: 1px solid #e5e7eb; padding: 7px 10px; }
        tr:nth-child(even) td { background: #f9fafb; }
        .present  { color: #15803d; font-weight: 600; }
        .absent   { color: #dc2626; font-weight: 600; }
        .incomplete { color: #d97706; font-weight: 600; }
        @media print { @page { margin: 12mm; } }
      </style>
    </head>
    <body>
      <h2>${title}</h2>
      <p class="sub">Généré le ${new Date().toLocaleDateString("fr-FR")} — document non modifiable</p>
      ${el.querySelector("#print-table")?.outerHTML ?? ""}
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

// ─── Composant journalier ─────────────────────────────────────────────────────
function DailyView({ date, setDate }: { date: Date; setDate: (d: Date) => void }) {
  const [record, setRecord] = useState<DayRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const str = toDateStr(date);
      const res = await fetchMyAttendance(str, str);
      setRecord(res.days[0] ?? null);
    } catch { toast.error("Erreur lors du chargement des pointages."); setRecord(null); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const badge = record ? statusBadge(record.status) : null;
  const d     = date;
  const title = `Pointage du ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;

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

      {/* Carte */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#003c71]" />
        </div>
      ) : record ? (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4" ref={tableRef}>
            {/* Statut */}
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge?.cls}`}>
                {badge?.icon} {badge?.label}
              </span>
            </div>

            {/* Détails horaires */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Arrivée", value: record.in_time ?? "—", icon: <Clock size={16} className="text-green-500" /> },
                { label: "Départ",  value: record.out_time ?? "—", icon: <Clock size={16} className="text-red-400" /> },
                { label: "Durée",   value: formatMinutes(record.worked_minutes), icon: <CalendarDays size={16} className="text-[#003c71]" /> },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <div className="flex justify-center mb-1">{item.icon}</div>
                  <div className="text-lg font-bold text-gray-800">{item.value}</div>
                  <div className="text-[11px] text-gray-400">{item.label}</div>
                </div>
              ))}
            </div>

            {/* Table cachée pour l'impression */}
            <div id="print-table" className="hidden">
              <table>
                <thead>
                  <tr><th>Date</th><th>Statut</th><th>Arrivée</th><th>Départ</th><th>Durée</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{d.getDate()} {MONTHS_FR[d.getMonth()]} {d.getFullYear()}</td>
                    <td className={record.status}>{badge?.label}</td>
                    <td>{record.in_time ?? "—"}</td>
                    <td>{record.out_time ?? "—"}</td>
                    <td>{formatMinutes(record.worked_minutes)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Export PDF */}
          <button onClick={() => printAttendance(tableRef, title)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#003c71]/20 text-[#003c71] text-sm font-medium hover:bg-[#003c71]/5 transition">
            <FileDown size={15} /> Exporter en PDF
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

// ─── Composant hebdomadaire ───────────────────────────────────────────────────
function WeeklyView({ weekStart, setWeekStart }: { weekStart: Date; setWeekStart: (d: Date) => void }) {
  const [days, setDays] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const weekEnd = addDays(weekStart, 6);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyAttendance(toDateStr(weekStart), toDateStr(weekEnd));
      setDays(res.days);
    } catch { toast.error("Erreur lors du chargement."); setDays([]); }
    finally { setLoading(false); }
  }, [weekStart]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const totalWorked = days.reduce((acc, d) => acc + (d.worked_minutes || 0), 0);
  const presentCount = days.filter(d => d.status === "present").length;

  const title = `Pointages semaine du ${weekStart.getDate()} ${MONTHS_FR[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

  return (
    <div className="space-y-4">
      {/* Navigation semaine */}
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

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Jours présents", value: `${presentCount} / 5`, icon: <CheckCircle2 size={18} className="text-green-500" /> },
          { label: "Heures travaillées", value: formatMinutes(totalWorked), icon: <Clock size={18} className="text-[#003c71]" /> },
          { label: "Absences", value: String(days.filter(d => d.status === "absent" && new Date(d.date) <= new Date()).length), icon: <XCircle size={18} className="text-red-400" /> },
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
          <div ref={tableRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div id="print-table">
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
                      <tr key={day.date} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {DAYS_FR[dt.getDay()]} {dt.getDate()} {MONTHS_FR[dt.getMonth()]}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-semibold ${bd.cls}`}>
                            {bd.icon} {bd.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{day.in_time ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-600">{day.out_time ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 font-medium text-gray-700">{formatMinutes(day.worked_minutes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export PDF */}
          <button onClick={() => printAttendance(tableRef, title)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#003c71]/20 text-[#003c71] text-sm font-medium hover:bg-[#003c71]/5 transition">
            <FileDown size={15} /> Exporter en PDF
          </button>
        </>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
interface Props { layout?: React.ComponentType<{ children: React.ReactNode }>; }

export default function EmployeeAttendancePage({ layout: Layout = EmployeeLayout }: Props) {
  const { user } = useAuth();
  const [view, setView] = useState<"daily" | "weekly">("weekly");
  const [date, setDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(12, 0, 0, 0); return d;
  });
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = startOfWeek(new Date()); d.setHours(12, 0, 0, 0); return d;
  });

  if (!user?.employee_matricule) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 pt-10 text-center">
          <XCircle size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400">Aucune fiche employé liée à ce compte.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 md:px-0 pb-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-[#003c71]">Mes Pointages</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Consultez vos horaires d'arrivée et de départ. L'export PDF garantit l'intégrité des données.
          </p>
        </motion.div>

        {/* Toggle vue */}
        <div className="flex gap-2 mb-5">
          {(["daily", "weekly"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                view === v
                  ? "bg-[#003c71] text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {v === "daily" ? <><Clock size={14} /> Journalier</> : <><CalendarDays size={14} /> Hebdomadaire</>}
            </button>
          ))}
        </div>

        {/* Vue */}
        {view === "daily"
          ? <DailyView date={date} setDate={setDate} />
          : <WeeklyView weekStart={weekStart} setWeekStart={setWeekStart} />
        }
      </div>
    </Layout>
  );
}
