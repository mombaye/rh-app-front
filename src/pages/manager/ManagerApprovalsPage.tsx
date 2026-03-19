import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, CheckCircle2, Clock, XCircle, AlertCircle,
  Calendar, ChevronLeft, ChevronRight, Filter, User,
  MessageSquare, ThumbsUp, ThumbsDown, Search, RefreshCw,
  Hash, Briefcase, Building2, Download, FileText, X,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import ManagerLayout from "@/layouts/ManagerLayout";
import { leaveRequestService } from "@/services/leaveService";
import { LeaveRequest } from "@/types/leave";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (d: string) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PAGE_SIZE = 8;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType; textColor: string; borderColor: string }> = {
  PENDING:        { label: "En attente",      color: "#d97706", bg: "#fffbeb", Icon: Clock,        textColor: "text-amber-700",  borderColor: "border-amber-200"  },
  PENDING_SECOND: { label: "2ème validation", color: "#ea580c", bg: "#fff7ed", Icon: Clock,        textColor: "text-orange-700", borderColor: "border-orange-200" },
  APPROVED:       { label: "Approuvé",        color: "#059669", bg: "#f0fdf4", Icon: CheckCircle2, textColor: "text-green-700",  borderColor: "border-green-200"  },
  REJECTED:       { label: "Rejeté",          color: "#dc2626", bg: "#fef2f2", Icon: XCircle,      textColor: "text-red-700",    borderColor: "border-red-200"    },
  CANCELLED:      { label: "Annulé",          color: "#64748b", bg: "#f8fafc", Icon: XCircle,      textColor: "text-gray-500",   borderColor: "border-gray-200"   },
  REVOKED:        { label: "Révoqué",         color: "#7c3aed", bg: "#f5f3ff", Icon: AlertCircle,  textColor: "text-purple-700", borderColor: "border-purple-200" },
};

// ─── Colonnes exportables PDF ────────────────────────────────────────────────
type ColKey = "employee" | "matricule" | "service" | "leave_type" | "start_date" | "end_date" | "days" | "motif" | "status" | "reviewed_by" | "reviewed_at" | "second_reviewer" | "reject_reason" | "created_at";

const EXPORT_COLUMNS: { key: ColKey; label: string; get: (r: LeaveRequest) => string }[] = [
  { key: "employee",        label: "Employé",             get: r => r.employee.full_name ?? `${r.employee.nom} ${r.employee.prenom}` },
  { key: "matricule",       label: "Matricule",           get: r => r.employee.matricule ?? "—"                                     },
  { key: "service",         label: "Service",             get: r => r.employee.service   ?? "—"                                     },
  { key: "leave_type",      label: "Type de congé",       get: r => r.leave_type.label                                              },
  { key: "start_date",      label: "Date début",          get: r => fmt(r.start_date)                                               },
  { key: "end_date",        label: "Date fin",            get: r => fmt(r.end_date)                                                 },
  { key: "days",            label: "Jours",               get: r => String(r.days)                                                  },
  { key: "motif",           label: "Motif",               get: r => r.motif || "—"                                                  },
  { key: "status",          label: "Statut",              get: r => STATUS_CONFIG[r.status]?.label ?? r.status                      },
  { key: "reviewed_by",     label: "Validé par (N+1)",    get: r => r.reviewed_by?.full_name     ?? "—"                             },
  { key: "reviewed_at",     label: "Date validation N+1", get: r => r.reviewed_at ? fmt(r.reviewed_at)         : "—"                },
  { key: "second_reviewer", label: "Validé par (N+2)",    get: r => r.second_reviewer?.full_name ?? "—"                             },
  { key: "reject_reason",   label: "Motif de rejet",      get: r => r.reject_reason              ?? "—"                             },
  { key: "created_at",      label: "Date de demande",     get: r => fmt(r.created_at)                                               },
];

const DEFAULT_COLS: ColKey[] = ["employee", "matricule", "service", "leave_type", "start_date", "end_date", "days", "status"];

function exportManagerPDF(
  requests: LeaveRequest[],
  managerName: string,
  tab: "pending" | "history",
  columns: ColKey[],
) {
  const cols = EXPORT_COLUMNS.filter(c => columns.includes(c.key));
  const doc  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // En-tête
  doc.setFillColor(0, 60, 113);
  doc.rect(0, 0, 297, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(tab === "pending" ? "Demandes en attente d'approbation" : "Historique des décisions", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Manager : ${managerName}`, 14, 20);
  doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")}`, 283, 20, { align: "right" });

  autoTable(doc, {
    head: [cols.map(c => c.label)],
    body: requests.map(r => cols.map(c => c.get(r))),
    startY: 34,
    headStyles: { fillColor: [0, 60, 113], textColor: 255, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { cellPadding: 3, overflow: "linebreak" },
    margin: { left: 14, right: 14 },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Camusat Sénégal RH — Document confidentiel — Page ${i}/${pageCount}`,
      148.5, 207, { align: "center" },
    );
  }

  doc.save(`approbations_${tab}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Modal Export PDF personnalisé ───────────────────────────────────────────
function ExportModal({
  onClose, requests, managerName, tab,
}: {
  onClose: () => void;
  requests: LeaveRequest[];
  managerName: string;
  tab: "pending" | "history";
}) {
  const [selected, setSelected] = useState<Set<ColKey>>(new Set(DEFAULT_COLS));

  const toggle = (key: ColKey) =>
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const allSelected = selected.size === EXPORT_COLUMNS.length;
  const toggleAll   = () => setSelected(allSelected ? new Set(DEFAULT_COLS) : new Set(EXPORT_COLUMNS.map(c => c.key)));

  const handleExport = () => {
    if (selected.size === 0) { toast.error("Sélectionnez au moins une colonne."); return; }
    exportManagerPDF(requests, managerName, tab, [...selected] as ColKey[]);
    toast.success("PDF généré !");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: 20, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#003c71] to-blue-700 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Export PDF personnalisé</h3>
              <p className="text-blue-200 text-xs">
                {tab === "pending" ? "Demandes en attente" : "Historique des décisions"} — {requests.length} ligne{requests.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Colonnes à inclure</p>
            <button onClick={toggleAll} className="text-xs text-[#003c71] font-semibold hover:underline">
              {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {EXPORT_COLUMNS.map(col => (
              <label
                key={col.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition select-none ${
                  selected.has(col.key)
                    ? "border-[#003c71] bg-[#003c71]/5 text-[#003c71]"
                    : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input type="checkbox" className="hidden" checked={selected.has(col.key)} onChange={() => toggle(col.key)} />
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${selected.has(col.key) ? "border-[#003c71] bg-[#003c71]" : "border-gray-300"}`}>
                  {selected.has(col.key) && (
                    <svg viewBox="0 0 10 8" fill="none" className="w-2 h-2">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-xs leading-tight">{col.label}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">
            {selected.size} colonne{selected.size > 1 ? "s" : ""} · {requests.length} ligne{requests.length > 1 ? "s" : ""} dans le PDF
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0}
            className="flex-1 py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-bold hover:bg-[#002d56] transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
          >
            <Download size={14} />
            Télécharger PDF
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal Approbation ────────────────────────────────────────────────────────
function ApproveModal({
  req, reviewerId, onConfirm, onClose,
}: {
  req: LeaveRequest;
  reviewerId: number;
  onConfirm: (reqId: number) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    await onConfirm(req.id);
    setLoading(false);
  };

  const isPendingSecond = req.status === "PENDING_SECOND";
  const hasN2 = !!req.employee.n2_manager_id;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: 20, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ThumbsUp size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">
                {isPendingSecond ? "Validation N+2 — Approuver" : "Approuver la demande"}
              </h3>
              <p className="text-green-100 text-xs">{req.employee.full_name}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-gray-700 font-medium">{req.leave_type.label}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{parseFloat(req.days)} jour{parseFloat(req.days) > 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar size={12} className="text-gray-300" />
              {fmt(req.start_date)} → {fmt(req.end_date)}
            </div>
            {req.motif && (
              <p className="text-xs text-gray-400 italic">"{req.motif}"</p>
            )}
          </div>

          {!isPendingSecond && hasN2 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-amber-700 font-medium">Validation en 2 niveaux requise</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Votre approbation (N+1) enverra la demande à <strong>{req.employee.n2_manager_name}</strong> (N+2) pour validation finale.
                </p>
              </div>
            </div>
          )}

          {isPendingSecond && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-blue-700 font-medium">Validation N+2 — Décision finale</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  La demande a déjà été approuvée par le N+1
                  {req.reviewed_by ? ` (${req.reviewed_by.full_name})` : ""}.
                  Votre approbation sera définitive.
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600">
            Confirmez-vous l'approbation de cette demande de congé ?
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
          >
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <ThumbsUp size={15} />}
            {isPendingSecond ? "Approuver (final)" : hasN2 ? "Approuver (N+1)" : "Approuver"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal Rejet ─────────────────────────────────────────────────────────────
function RejectModal({
  req, onConfirm, onClose,
}: {
  req: LeaveRequest;
  onConfirm: (reqId: number, reason: string) => void;
  onClose: () => void;
}) {
  const [reason,  setReason]  = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!reason.trim()) { toast.error("Veuillez indiquer un motif de rejet."); return; }
    setLoading(true);
    await onConfirm(req.id, reason.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: 20, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ThumbsDown size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Rejeter la demande</h3>
              <p className="text-red-100 text-xs">{req.employee.full_name}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-gray-700 font-medium">{req.leave_type.label}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{parseFloat(req.days)} j</span>
            </div>
            <div className="text-xs text-gray-500">{fmt(req.start_date)} → {fmt(req.end_date)}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <MessageSquare size={13} className="inline mr-1.5 text-gray-400" />
              Motif du rejet <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Expliquez la raison du rejet..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={handle}
            disabled={loading || !reason.trim()}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
          >
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <ThumbsDown size={15} />}
            Rejeter
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Carte de demande ────────────────────────────────────────────────────────
function ApprovalCard({
  req, onApprove, onReject, isHistory,
}: {
  req: LeaveRequest;
  onApprove?: () => void;
  onReject?: () => void;
  isHistory?: boolean;
}) {
  const cfg  = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.CANCELLED;
  const Icon = cfg.Icon;
  const days = parseFloat(req.days) || 0;

  const initials = req.employee.full_name
    .split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: cfg.color }}
          >
            {initials}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-bold text-gray-800 text-sm">{req.employee.full_name}</span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cfg.textColor} ${cfg.borderColor}`}
                style={{ backgroundColor: cfg.bg }}
              >
                <Icon size={9} />
                {cfg.label}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-gray-400 mb-2 flex-wrap">
              <span className="flex items-center gap-1"><Hash size={10} />{req.employee.matricule}</span>
              {req.employee.service && (
                <><span className="text-gray-200">·</span><span className="flex items-center gap-1"><Building2 size={10} />{req.employee.service}</span></>
              )}
              {req.employee.fonction && (
                <><span className="text-gray-200">·</span><span className="flex items-center gap-1"><Briefcase size={10} />{req.employee.fonction}</span></>
              )}
              {req.status === "PENDING_SECOND" && (
                <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold text-[10px] border border-orange-200">Validation N+2</span>
              )}
              {req.status === "PENDING" && req.employee.n2_manager_id && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[10px] border border-amber-200">2 niveaux requis</span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">{req.leave_type.label}</span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={11} className="text-gray-400" />
                {fmt(req.start_date)} → {fmt(req.end_date)}
              </span>
              <span className="text-xs font-bold text-gray-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">{days} j</span>
            </div>

            {req.motif && (
              <p className="text-[11px] text-gray-400 italic mt-1.5 truncate max-w-sm">
                <MessageSquare size={10} className="inline mr-1" />"{req.motif}"
              </p>
            )}
            {req.reject_reason && (
              <div className="flex items-start gap-1.5 mt-1.5">
                <XCircle size={11} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-500">{req.reject_reason}</p>
              </div>
            )}
            {isHistory && req.reviewed_by && (
              <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                <User size={10} />
                Traité par {req.reviewed_by.full_name}
                {req.reviewed_at && ` · ${fmt(req.reviewed_at.slice(0, 10))}`}
              </p>
            )}
          </div>

          {/* Actions */}
          {!isHistory && onApprove && onReject && (
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={onApprove}
                className="flex items-center gap-1.5 text-xs text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg transition font-medium border border-green-200 hover:border-green-400 whitespace-nowrap"
              >
                <ThumbsUp size={12} /> Approuver
              </button>
              <button
                onClick={onReject}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition font-medium border border-red-200 hover:border-red-400 whitespace-nowrap"
              >
                <ThumbsDown size={12} /> Rejeter
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
type Tab = "pending" | "history";

export default function ManagerApprovalsPage() {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [tab,          setTab]          = useState<Tab>("pending");
  const [requests,     setRequests]     = useState<LeaveRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterType,   setFilterType]   = useState("ALL");
  const [currentPage,  setCurrentPage]  = useState(1);
  const [showExport,   setShowExport]   = useState(false);

  const [approveTarget, setApproveTarget] = useState<LeaveRequest | null>(null);
  const [rejectTarget,  setRejectTarget]  = useState<LeaveRequest | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [pending, pendingSecond, approved, rejected] = await Promise.all([
        leaveRequestService.getAll({ manager_employee_id: employeeId, status: "PENDING"        } as any),
        leaveRequestService.getAll({ manager_employee_id: employeeId, status: "PENDING_SECOND" } as any),
        leaveRequestService.getAll({ manager_employee_id: employeeId, status: "APPROVED"       } as any),
        leaveRequestService.getAll({ manager_employee_id: employeeId, status: "REJECTED"       } as any),
      ]);
      const exclude = (list: LeaveRequest[]) => list.filter(r => r.employee.id !== employeeId);
      setRequests([
        ...exclude(pending as LeaveRequest[]),
        ...exclude(pendingSecond as LeaveRequest[]),
        ...exclude(approved as LeaveRequest[]),
        ...exclude(rejected as LeaveRequest[]),
      ]);
    } catch {
      toast.error("Erreur lors du chargement des demandes.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const pending = requests.filter(r => r.status === "PENDING" || r.status === "PENDING_SECOND");
  const history = requests.filter(r => r.status === "APPROVED" || r.status === "REJECTED");

  const source = tab === "pending" ? pending : history;

  const filtered = source.filter(r => {
    const matchSearch = search === "" || [
      r.employee.full_name, r.employee.matricule,
      r.employee.service, r.leave_type.label,
    ].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchType = filterType === "ALL" || r.leave_type.code === filterType;
    return matchSearch && matchType;
  });

  const leaveTypes = [...new Map(requests.map(r => [r.leave_type.code, r.leave_type])).values()];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeTab = (t: Tab) => { setTab(t); setCurrentPage(1); setSearch(""); setFilterType("ALL"); };

  const handleApprove = async (reqId: number) => {
    if (!employeeId) return;
    try {
      await leaveRequestService.approve(reqId, { reviewer_id: employeeId });
      toast.success("Demande approuvée !");
      setApproveTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'approbation.");
    }
  };

  const handleReject = async (reqId: number, reason: string) => {
    if (!employeeId) return;
    try {
      await leaveRequestService.reject(reqId, reason);
      toast.success("Demande rejetée.");
      setRejectTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors du rejet.");
    }
  };

  const statsCards = [
    { label: "En attente",    count: pending.length,                                     color: "text-amber-600", bg: "bg-amber-50",  border: "border-amber-100",  tab: "pending" as Tab },
    { label: "Approuvées",    count: history.filter(r => r.status === "APPROVED").length, color: "text-green-600", bg: "bg-green-50",  border: "border-green-100",  tab: "history" as Tab },
    { label: "Rejetées",      count: history.filter(r => r.status === "REJECTED").length, color: "text-red-600",   bg: "bg-red-50",    border: "border-red-100",    tab: "history" as Tab },
    { label: "Total traités", count: history.length,                                      color: "text-gray-600",  bg: "bg-gray-50",   border: "border-gray-100",   tab: "history" as Tab },
  ];

  return (
    <ManagerLayout>
      <div className="px-4 md:px-6 pb-10">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between flex-wrap gap-3 mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold text-[#003c71] flex items-center gap-2">
              <ClipboardCheck size={22} />
              Approbations Congés
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Validez les demandes de congé de vos employés</p>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </motion.div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {statsCards.map((s, i) => (
            <motion.button
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => changeTab(s.tab)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition hover:shadow-sm text-center ${s.bg} ${s.border}`}
            >
              <span className={`text-2xl font-bold ${s.color}`}>{loading ? "…" : s.count}</span>
              <span className={`text-xs mt-0.5 font-medium ${s.color} opacity-80`}>{s.label}</span>
            </motion.button>
          ))}
        </div>

        {/* ── Barre filtres + tabs + export ── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">

          {/* Recherche (gauche, flex-1) */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Nom, matricule, service…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white"
            />
          </div>

          {/* Filtre type de congé */}
          <div className="relative">
            <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
              className="pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white"
            >
              <option value="ALL">Tous les types</option>
              {leaveTypes.map(lt => (
                <option key={lt.code} value={lt.code}>{lt.label}</option>
              ))}
            </select>
          </div>

          {/* Tabs (En attente | Historique) */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {([["pending", "En attente", pending.length], ["history", "Historique", history.length]] as const).map(([t, label, count]) => (
              <button
                key={t}
                onClick={() => changeTab(t)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  tab === t ? "bg-white shadow-sm text-[#003c71]" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
                {(count as number) > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t ? "bg-[#003c71] text-white" : "bg-gray-200 text-gray-600"}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Bouton Export */}
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 hover:border-[#003c71] hover:text-[#003c71] transition font-medium whitespace-nowrap"
          >
            <Download size={14} />
            Exporter
          </button>
        </div>

        {/* ── Liste ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <span className="font-semibold text-gray-800">
              {tab === "pending" ? "Demandes en attente" : "Historique des décisions"}
            </span>
            {!loading && filtered.length > 0 && (
              <span className="text-xs text-gray-400">({filtered.length} résultat{filtered.length > 1 ? "s" : ""})</span>
            )}
          </div>

          {/* Contenu */}
          {loading ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                {tab === "pending" ? <Clock size={28} className="opacity-40" /> : <CheckCircle2 size={28} className="opacity-40" />}
              </div>
              <p className="text-sm font-medium text-gray-500">
                {tab === "pending" ? "Aucune demande en attente" : "Aucun historique"}
              </p>
              <p className="text-xs mt-1 text-gray-400">
                {search || filterType !== "ALL"
                  ? "Aucun résultat pour cette recherche"
                  : tab === "pending" ? "Toutes les demandes ont été traitées" : "Vous n'avez pas encore traité de demandes"
                }
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 space-y-3">
                {paginated.map(req => (
                  <ApprovalCard
                    key={req.id}
                    req={req}
                    isHistory={tab === "history"}
                    onApprove={tab === "pending" ? () => setApproveTarget(req) : undefined}
                    onReject={tab  === "pending" ? () => setRejectTarget(req)  : undefined}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-gray-400">
                  {filtered.length} demande{filtered.length > 1 ? "s" : ""}
                  {totalPages > 1 && ` · Page ${currentPage} / ${totalPages}`}
                </span>
                {totalPages > 1 && (
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
                          page === currentPage ? "bg-[#003c71] text-white shadow-sm" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
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
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showExport && (
          <ExportModal
            onClose={() => setShowExport(false)}
            requests={filtered}
            managerName={user?.employee_name || user?.username || "Manager"}
            tab={tab}
          />
        )}
        {approveTarget && (
          <ApproveModal
            req={approveTarget}
            reviewerId={employeeId!}
            onConfirm={handleApprove}
            onClose={() => setApproveTarget(null)}
          />
        )}
        {rejectTarget && (
          <RejectModal
            req={rejectTarget}
            onConfirm={handleReject}
            onClose={() => setRejectTarget(null)}
          />
        )}
      </AnimatePresence>
    </ManagerLayout>
  );
}
