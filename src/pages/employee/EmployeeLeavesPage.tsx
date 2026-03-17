import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, Calendar, CheckCircle2, Clock, XCircle,
  AlertCircle, Pencil, FileDown, ChevronDown, ChevronUp,
  Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 8;
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { leaveBalanceService, leaveRequestService, leaveTypeService } from "@/services/leaveService";
import { LeaveBalance, LeaveRequest, LeaveRequestCreate, LeaveType } from "@/types/leave";
import toast from "react-hot-toast";

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; Icon: React.ElementType }> = {
  PENDING:        { label: "En attente",      color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-400",  Icon: Clock         },
  PENDING_SECOND: { label: "2ème validation", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", dot: "bg-orange-400", Icon: Clock         },
  APPROVED:       { label: "Approuvé",        color: "text-green-700",  bg: "bg-green-50 border-green-200",   dot: "bg-green-500",  Icon: CheckCircle2  },
  REJECTED:       { label: "Rejeté",          color: "text-red-700",    bg: "bg-red-50 border-red-200",       dot: "bg-red-500",    Icon: XCircle       },
  CANCELLED:      { label: "Annulé",          color: "text-gray-500",   bg: "bg-gray-50 border-gray-200",     dot: "bg-gray-400",   Icon: XCircle       },
  REVOKED:        { label: "Révoqué",         color: "text-purple-700", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500", Icon: AlertCircle   },
};

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const fmt = (d: string) => {
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`;
};

// ── PDF export ─────────────────────────────────────────────────────────────────
function exportLeavesPDF(
  requests: LeaveRequest[],
  employeeName: string,
  matricule: string,
  columns: string[]
) {
  const colDefs: Record<string, { label: string; get: (r: LeaveRequest) => string }> = {
    type:       { label: "Type de congé",   get: r => r.leave_type.label },
    debut:      { label: "Date début",      get: r => fmt(r.start_date) },
    fin:        { label: "Date fin",        get: r => fmt(r.end_date) },
    jours:      { label: "Jours",           get: r => r.days },
    statut:     { label: "Statut",          get: r => STATUS_CONFIG[r.status]?.label ?? r.status },
    motif:      { label: "Motif",           get: r => r.motif || "—" },
    validateur: { label: "Validé par",      get: r => r.reviewed_by?.full_name || "—" },
  };

  const selectedCols = columns.map(k => colDefs[k]).filter(Boolean);
  const colW = Math.floor(100 / selectedCols.length);

  const rows = requests.map(r =>
    `<tr>${selectedCols.map(c =>
      `<td style="padding:7px 10px;border:1px solid #e2e8f0;font-size:12px">${c.get(r)}</td>`
    ).join("")}</tr>`
  ).join("");

  const html = `
  <html><head><meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
    h1 { color: #003c71; font-size: 20px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #003c71; color: white; padding: 9px 10px; font-size: 12px; text-align: left; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: right; }
  </style>
  </head><body>
  <h1>Congés — ${employeeName}</h1>
  <div class="meta">Matricule : ${matricule} &nbsp;|&nbsp; Exporté le ${new Date().toLocaleDateString("fr-FR")}</div>
  <table>
    <thead><tr>${selectedCols.map(c => `<th style="width:${colW}%">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Camusat Sénégal RH — Document généré automatiquement</div>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  w.close();
}

// ── Modal de demande / modification ────────────────────────────────────────────
type FormMode = "create" | "edit";
interface LeaveFormProps {
  mode: FormMode;
  initial?: Partial<LeaveRequestCreate & { id: number }>;
  leaveTypes: LeaveType[];
  employeeId: number;
  onClose: () => void;
  onSaved: () => void;
}

function LeaveFormModal({ mode, initial, leaveTypes, employeeId, onClose, onSaved }: LeaveFormProps) {
  const [form, setForm] = useState<Partial<LeaveRequestCreate>>({
    employee_id:   employeeId,
    leave_type_id: initial?.leave_type_id,
    start_date:    initial?.start_date ?? "",
    end_date:      initial?.end_date ?? "",
    days:          initial?.days,
    motif:         initial?.motif ?? "",
  });
  const [saving, setSaving] = useState(false);

  // Auto-calc jours
  useEffect(() => {
    if (form.start_date && form.end_date && form.end_date >= form.start_date) {
      const s = new Date(form.start_date);
      const e = new Date(form.end_date);
      const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
      setForm(p => ({ ...p, days: diff }));
    }
  }, [form.start_date, form.end_date]);

  const handleSave = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date || !form.days) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        await leaveRequestService.create(form as LeaveRequestCreate);
        toast.success("Demande envoyée avec succès.");
      } else {
        await leaveRequestService.updatePending(initial!.id!, form);
        toast.success("Demande modifiée.");
      }
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.non_field_errors?.[0]
        || err?.response?.data?.detail
        || "Erreur lors de l'enregistrement.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-camublue-900 mb-5">
          {mode === "create" ? "Nouvelle demande de congé" : "Modifier la demande"}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de congé *</label>
            <select
              value={form.leave_type_id ?? ""}
              onChange={e => setForm(p => ({ ...p, leave_type_id: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
            >
              <option value="">-- Sélectionner --</option>
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>{lt.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date début *</label>
              <input
                type="date"
                value={form.start_date ?? ""}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date fin *</label>
              <input
                type="date"
                value={form.end_date ?? ""}
                onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de jours</label>
            <input
              type="number"
              min={1}
              value={form.days ?? ""}
              onChange={e => setForm(p => ({ ...p, days: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
            <textarea
              rows={3}
              value={form.motif ?? ""}
              onChange={e => setForm(p => ({ ...p, motif: e.target.value }))}
              placeholder="Motif optionnel…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-camublue-900 text-white text-sm hover:bg-camublue-900/90 transition flex items-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {mode === "create" ? "Envoyer" : "Enregistrer"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Modal d'export PDF ─────────────────────────────────────────────────────────
interface ExportModalProps {
  requests: LeaveRequest[];
  employeeName: string;
  matricule: string;
  onClose: () => void;
}

const ALL_COLUMNS = [
  { key: "type",       label: "Type de congé" },
  { key: "debut",      label: "Date début" },
  { key: "fin",        label: "Date fin" },
  { key: "jours",      label: "Jours" },
  { key: "statut",     label: "Statut" },
  { key: "motif",      label: "Motif" },
  { key: "validateur", label: "Validé par" },
];

function ExportModal({ requests, employeeName, matricule, onClose }: ExportModalProps) {
  const [selected, setSelected] = useState<string[]>(["type","debut","fin","jours","statut"]);
  const [filterStatus, setFilterStatus] = useState("ALL");

  const filtered = filterStatus === "ALL" ? requests : requests.filter(r => r.status === filterStatus);

  const toggle = (k: string) =>
    setSelected(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-camublue-900 mb-5">Exporter en PDF</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrer par statut</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
            >
              <option value="ALL">Tous les statuts ({requests.length})</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label} ({requests.filter(r => r.status === k).length})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Colonnes à inclure</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(col.key)}
                    onChange={() => toggle(col.key)}
                    className="accent-camublue-900"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400">{filtered.length} demande(s) seront exportées.</p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm transition"
          >
            Annuler
          </button>
          <button
            disabled={selected.length === 0 || filtered.length === 0}
            onClick={() => {
              exportLeavesPDF(filtered, employeeName, matricule, selected);
              onClose();
            }}
            className="px-5 py-2 rounded-lg bg-camublue-900 text-white text-sm hover:bg-camublue-900/90 transition flex items-center gap-2 disabled:opacity-50"
          >
            <FileDown size={15} />
            Générer PDF
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function EmployeeLeavesPage() {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [balances, setBalances]       = useState<LeaveBalance[]>([]);
  const [requests, setRequests]       = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes]   = useState<LeaveType[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editTarget, setEditTarget]   = useState<LeaveRequest | null>(null);
  const [showExport, setShowExport]   = useState(false);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [showBalances, setShowBalances] = useState(true);
  const [currentPage, setCurrentPage]   = useState(1);

  const refresh = useCallback(() => {
    if (!employeeId) return;
    const year = new Date().getFullYear();
    Promise.all([
      leaveBalanceService.getByEmployee(employeeId, year),
      leaveRequestService.getByEmployee(employeeId),
      leaveTypeService.getAll(),
    ]).then(([bal, reqs, types]) => {
      setBalances(bal);
      setRequests((reqs as LeaveRequest[]).slice().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      setLeaveTypes(types);
    }).finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered   = filterStatus === "ALL" ? requests : requests.filter(r => r.status === filterStatus);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filter changes
  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const canEdit = (r: LeaveRequest) => r.status === "PENDING" || r.status === "PENDING_SECOND";

  return (
    <EmployeeLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6 flex-wrap gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Mes Congés</h1>
            <p className="text-gray-500 text-sm mt-0.5">Gérez vos demandes de congés</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <FileDown size={16} />
              Exporter PDF
            </button>
            <button
              onClick={() => { setEditTarget(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-camublue-900 text-white text-sm hover:bg-camublue-900/90 transition shadow-sm"
            >
              <Plus size={16} />
              Nouvelle demande
            </button>
          </div>
        </motion.div>

        {/* Soldes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden"
        >
          <button
            onClick={() => setShowBalances(p => !p)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
          >
            <span className="font-semibold text-gray-800 flex items-center gap-2">
              <Calendar size={18} className="text-camublue-900" />
              Mes soldes {new Date().getFullYear()}
            </span>
            {showBalances ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>
          {showBalances && (
            <div className="px-5 pb-5">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
              ) : balances.length === 0 ? (
                <p className="text-gray-400 text-sm py-2">Aucun solde disponible.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {balances.map(b => {
                    const rem = parseFloat(b.remaining || "0");
                    return (
                      <div key={b.id} className="bg-camugray-100 rounded-xl p-3 border border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">{b.leave_type.label}</div>
                        <div className="text-xl font-bold text-camublue-900">{rem.toFixed(1)} j</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Acquis {parseFloat(b.acquired || "0").toFixed(1)} · Pris {parseFloat(b.taken || "0").toFixed(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Filtre + liste */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-gray-800">
              Mes demandes
              {!loading && filtered.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({filtered.length} au total)
                </span>
              )}
            </span>
            <div className="flex-1" />
            <select
              value={filterStatus}
              onChange={e => handleFilterChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
            >
              <option value="ALL">Tous ({requests.length})</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label} ({requests.filter(r => r.status === k).length})</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aucune demande{filterStatus !== "ALL" ? " pour ce statut" : ""}</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {paginated.map(req => {
                  const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.CANCELLED;
                  const Icon = cfg.Icon;
                  const editable = canEdit(req);
                  return (
                    <div key={req.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50/50 transition">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-800 text-sm">{req.leave_type.label}</span>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                              <Icon size={11} />
                              {cfg.label}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {fmt(req.start_date)} → {fmt(req.end_date)} · <b>{req.days} jour(s)</b>
                          </div>
                          {req.motif && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{req.motif}</div>
                          )}
                          {req.reject_reason && (
                            <div className="text-xs text-red-500 mt-0.5">Motif rejet : {req.reject_reason}</div>
                          )}
                        </div>
                      </div>
                      {editable && (
                        <button
                          onClick={() => { setEditTarget(req); setShowForm(true); }}
                          className="shrink-0 flex items-center gap-1.5 text-xs text-camublue-900 hover:bg-camublue-900/10 px-2.5 py-1.5 rounded-lg transition"
                        >
                          <Pencil size={13} />
                          Modifier
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">
                    Page {currentPage} sur {totalPages} · {filtered.length} demande(s)
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
                            ? "bg-camublue-900 text-white shadow-sm"
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

      {/* Modal: compte non lié à un employé */}
      {showForm && !employeeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
          >
            <h3 className="text-lg font-semibold text-camublue-900 mb-3">Compte non lié</h3>
            <p className="text-gray-600 text-sm mb-5">
              Votre compte utilisateur n'est pas encore associé à un dossier employé.
              Veuillez contacter l'administrateur RH pour lier votre compte à votre fiche employé.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-camublue-900 text-white text-sm hover:bg-camublue-900/90 transition"
              >
                Compris
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: formulaire de demande */}
      {showForm && employeeId && (
        <LeaveFormModal
          mode={editTarget ? "edit" : "create"}
          initial={editTarget ? {
            id: editTarget.id,
            leave_type_id: editTarget.leave_type.id,
            start_date: editTarget.start_date,
            end_date: editTarget.end_date,
            days: parseFloat(editTarget.days),
            motif: editTarget.motif,
          } : undefined}
          leaveTypes={leaveTypes}
          employeeId={employeeId}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          onSaved={() => { setShowForm(false); setEditTarget(null); refresh(); }}
        />
      )}

      {showExport && (
        <ExportModal
          requests={requests}
          employeeName={user?.employee_name || user?.username || ""}
          matricule={user?.employee_matricule || ""}
          onClose={() => setShowExport(false)}
        />
      )}
    </EmployeeLayout>
  );
}
