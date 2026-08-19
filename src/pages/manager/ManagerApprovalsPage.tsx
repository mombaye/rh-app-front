﻿﻿﻿﻿﻿import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BASE_URL } from "@/api/baseUrl";

async function openLeaveDocument(leaveId: number) {
  const token = localStorage.getItem("access_token");
  try {
    const res = await fetch(`${BASE_URL}/api/leaves/requests/${leaveId}/document/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      alert("Justificatif introuvable ou non encore uploadé pour cette demande.");
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  } catch {
    alert("Impossible d'ouvrir le justificatif.");
  }
}
import {
  ClipboardCheck, CheckCircle2, Clock, XCircle, AlertCircle,
  Calendar, ChevronLeft, ChevronRight, Filter, User,
  MessageSquare, ThumbsUp, ThumbsDown, Search, RefreshCw,
  Hash, Briefcase, Building2, Download, FileText, X, Ban, LogOut, Plane,
  Bell, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import ManagerLayout from "@/layouts/ManagerLayout";
import { leaveRequestService, exitAuthorizationService } from "@/services/leaveService";
import { LeaveRequest, ExitAuthorization } from "@/types/leave";
import { missionService, MissionRequest } from "@/services/missionService";
import ExitAuthorizationPanel from "@/components/leaves/ExitAuthorizationPanel";
import ManagerMissionApprovalsPanel from "@/components/manager/ManagerMissionApprovalsPanel";
import { onEmployeesSynced } from "@/utils/employeeSync";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ������ Helpers ��������������������������������������������������������������������������������������������������������������������������������
const fmt = (d: string) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PAGE_SIZE = 8;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType; textColor: string; borderColor: string }> = {
  PENDING:        { label: "En attente",      color: "#1d4ed8", bg: "#eff6ff", Icon: Clock,        textColor: "text-blue-700",   borderColor: "border-blue-200"  },
  PENDING_SECOND: { label: "2ème validation", color: "#1e40af", bg: "#dbeafe", Icon: Clock,        textColor: "text-blue-800",   borderColor: "border-blue-300"  },
  PENDING_RH:     { label: "Validation RH",   color: "#7c3aed", bg: "#f5f3ff", Icon: Clock,        textColor: "text-purple-700", borderColor: "border-purple-200" },
  APPROVED:       { label: "Approuvé",        color: "#059669", bg: "#f0fdf4", Icon: CheckCircle2, textColor: "text-green-700",  borderColor: "border-green-200"  },
  REJECTED:       { label: "Rejeté",          color: "#dc2626", bg: "#fef2f2", Icon: XCircle,      textColor: "text-red-700",    borderColor: "border-red-200"    },
  CANCELLED:      { label: "Annulé",          color: "#64748b", bg: "#f8fafc", Icon: XCircle,      textColor: "text-gray-500",   borderColor: "border-gray-200"   },
  REVOKED:        { label: "Révoqué",         color: "#7c3aed", bg: "#f5f3ff", Icon: AlertCircle,  textColor: "text-purple-700", borderColor: "border-purple-200" },
};

// ������ Colonnes exportables PDF ������������������������������������������������������������������������������������������������
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
      `Camusat Sénégal RH · Document confidentiel · Page ${i}/${pageCount}`,
      148.5, 207, { align: "center" },
    );
  }

  doc.save(`approbations_${tab}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ������ Modal Export PDF personnalisé ��������������������������������������������������������������������������������������
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
                {tab === "pending" ? "Demandes en attente" : "Historique des décisions"} · {requests.length} ligne{requests.length > 1 ? "s" : ""}
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

// ������ Modal Approbation ����������������������������������������������������������������������������������������������������������������
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
                {isPendingSecond ? "Validation N+2 → Approuver" : "Approuver la demande"}
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
              {fmt(req.start_date)} →  {fmt(req.end_date)}
            </div>
            {req.motif && (
              <p className="text-xs text-gray-400 italic">"{req.motif}"</p>
            )}
          </div>

          {!isPendingSecond && hasN2 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-blue-700 font-medium">Validation en 2 niveaux requise</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Votre approbation (N+1) enverra la demande à <strong>{req.employee.n2_manager_name}</strong> (N+2) pour validation finale.
                </p>
              </div>
            </div>
          )}

          {isPendingSecond && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-blue-700 font-medium">Validation N+2 → Décision finale</p>
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

// ������ Modal Rejet ��������������������������������������������������������������������������������������������������������������������������
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
            <div className="text-xs text-gray-500">{fmt(req.start_date)} →  {fmt(req.end_date)}</div>
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

// ������ Modal Annulation (Manager) ����������������������������������������������������������������������������������������������
function CancelModal({
  req, onConfirm, onClose,
}: {
  req: LeaveRequest;
  onConfirm: (reqId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    await onConfirm(req.id);
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
        <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Ban size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Annuler le congé approuvé</h3>
              <p className="text-gray-300 text-xs">{req.employee.full_name}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-gray-700 font-medium">{req.leave_type.label}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{parseFloat(req.days)} jour{parseFloat(req.days) > 1 ? "s" : ""}</span>
            </div>
            <div className="text-xs text-gray-500">{fmt(req.start_date)} →  {fmt(req.end_date)}</div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={15} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              L'annulation restituera les jours de congé au solde de l'employé. Cette action est irréversible.
            </p>
          </div>

          <p className="text-sm text-gray-600">
            Confirmez-vous l'annulation de ce congé approuvé ?
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition">
            Retour
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-bold hover:bg-gray-900 transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
          >
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <Ban size={15} />}
            Annuler le congé
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ������ Modal Alerte congé en cours ��������������������������������������������������������������������������������������������
function InProgressAlertModal({ req, onClose }: { req: LeaveRequest; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: 20, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-r from-[#003c71] to-blue-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <AlertCircle size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Annulation impossible</h3>
              <p className="text-blue-100 text-xs">{req.employee.full_name}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-gray-700 font-medium">{req.leave_type.label}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{parseFloat(req.days)} jour{parseFloat(req.days) > 1 ? "s" : ""}</span>
            </div>
            <div className="text-xs text-gray-500">{fmt(req.start_date)} →  {fmt(req.end_date)}</div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Congé en cours de consommation</p>
              <p className="text-xs text-blue-600 mt-1">
                Ce congé a déjà débuté et est en cours de consommation. Il ne peut pas être annulé.
                Si vous devez rappeler l'employé en urgence, utilisez la fonctionnalité de <strong>révocation</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-bold hover:bg-[#002d56] transition"
          >
            Compris
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ������ Modal Détails Demande ��������������������������������������������������������������������������������������������������������
function LeaveDetailModal({
  req, onClose, onApprove, onReject,
}: {
  req: LeaveRequest;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const cfg  = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.CANCELLED;
  const Icon = cfg.Icon;
  const days = parseFloat(req.days) || 0;
  const isPending = req.status === "PENDING" || req.status === "PENDING_SECOND";

  const initials = req.employee.full_name
    .split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: 24, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* ���� Header ���� */}
        <div className="bg-gradient-to-r from-[#003c71] to-blue-700 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
            >
              {initials}
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">{req.employee.full_name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: cfg.bg, color: cfg.color }}
                >
                  <Icon size={9} />
                  {cfg.label}
                </span>
                <span className="text-blue-200 text-xs">#{req.id}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* ���� Body scrollable ���� */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Employé */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Employé</p>
            <div className="flex items-center gap-2 text-sm">
              <Hash size={13} className="text-gray-400 shrink-0" />
              <span className="font-semibold text-gray-700">{req.employee.matricule}</span>
            </div>
            {req.employee.fonction && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase size={13} className="text-gray-400 shrink-0" />
                <span className="text-gray-600">{req.employee.fonction}</span>
              </div>
            )}
            {req.employee.service && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={13} className="text-gray-400 shrink-0" />
                <span className="text-gray-600">{req.employee.service}</span>
              </div>
            )}
            {req.employee.n1_manager_name && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <User size={12} className="text-gray-300 shrink-0" />
                Manager N+1 : <span className="font-medium">{req.employee.n1_manager_name}</span>
              </div>
            )}
            {req.employee.n2_manager_name && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <User size={12} className="text-gray-300 shrink-0" />
                Manager N+2 : <span className="font-medium">{req.employee.n2_manager_name}</span>
              </div>
            )}
          </div>

          {/* Congé */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Congé</p>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: req.leave_type.color || "#3b82f6" }}
              />
              <span className="font-semibold text-gray-800 text-sm">{req.leave_type.label}</span>
              <span className="text-xs text-gray-400">({req.leave_type.code})</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={13} className="text-gray-400 shrink-0" />
              {fmt(req.start_date)}
              {req.half_day_start && <span className="text-xs text-gray-400">(après-midi)</span>}
              <span className="text-gray-400">→ </span>
              {fmt(req.end_date)}
              {req.half_day_end && <span className="text-xs text-gray-400">(matin)</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                {days} jour{days > 1 ? "s" : ""}
              </span>
              {!req.leave_type.is_paid && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">Non payé</span>
              )}
            </div>
            {req.motif && (
              <div className="flex items-start gap-2 mt-1 pt-1 border-t border-gray-200">
                <MessageSquare size={13} className="text-gray-400 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500 italic">"{req.motif}"</p>
              </div>
            )}
          </div>

          {/* Workflow */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Workflow d'approbation</p>

            {/* N+1 */}
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                req.reviewed_by ? "bg-green-100" : req.status === "REJECTED" ? "bg-red-100" : "bg-blue-100"
              }`}>
                {req.reviewed_by
                  ? <CheckCircle2 size={13} className="text-green-600" />
                  : req.status === "REJECTED"
                    ? <XCircle size={13} className="text-red-500" />
                    : <Clock size={13} className="text-blue-600" />
                }
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">
                  Validation N+1 {req.reviewed_by ? `· ${req.reviewed_by.full_name}` : req.status === "PENDING" ? "· En attente" : ""}
                </p>
                {req.reviewed_at && (
                  <p className="text-[11px] text-gray-400">{fmt(req.reviewed_at.slice(0, 10))}</p>
                )}
                {req.reject_reason && (
                  <p className="text-[11px] text-red-500 mt-0.5">Motif : {req.reject_reason}</p>
                )}
              </div>
            </div>

            {/* N+2 si applicable */}
            {req.requires_second_approval && (
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  req.second_reviewer ? "bg-green-100" : "bg-blue-100"
                }`}>
                  {req.second_reviewer
                    ? <CheckCircle2 size={13} className="text-green-600" />
                    : <Clock size={13} className="text-blue-600" />
                  }
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">
                    Validation N+2 {req.second_reviewer ? `· ${req.second_reviewer.full_name}` : "· En attente"}
                  </p>
                  {req.second_reviewed_at && (
                    <p className="text-[11px] text-gray-400">{fmt(req.second_reviewed_at.slice(0, 10))}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Justificatif */}
          {req.leave_type.requires_justification && (
            <div className={`rounded-xl p-4 space-y-1.5 ${
              req.justification_document
                ? "bg-emerald-50 border border-emerald-200"
                : req.justification_pending
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-gray-50"
            }`}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Justificatif</p>
              {req.justification_document ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-700">Document soumis</p>
                      {req.justification_validated && (
                        <p className="text-[11px] text-emerald-600">
                          Validé{req.justification_validated_by ? ` par ${req.justification_validated_by.full_name}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); openLeaveDocument(req.id); }}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                  >
                    <FileText size={13} />
                    Voir le justificatif
                  </button>
                </div>
              ) : req.justification_pending ? (
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Justificatif non soumis</p>
                    {req.justification_deadline && (
                      <p className="text-[11px] text-amber-600">Délai : {fmt(req.justification_deadline)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Justificatif à fournir après le congé</p>
              )}
            </div>
          )}

          {/* Document optionnel si pas requis */}
          {!req.leave_type.requires_justification && req.justification_document && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-2">
              <FileText size={14} className="text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-700">Document joint</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); openLeaveDocument(req.id); }}
                className="text-xs text-blue-700 hover:underline flex items-center gap-1 font-medium"
              >
                <FileText size={12} />
                Voir
              </button>
            </div>
          )}

          {/* Date de demande */}
          <p className="text-[11px] text-gray-400 text-right">
            Demande créée le {fmt(req.created_at.slice(0, 10))}
          </p>
        </div>

        {/* ���� Footer ���� */}
        <div className="shrink-0 px-5 pb-5 pt-3 border-t border-gray-100">
          {isPending && onApprove && onReject ? (
            <div className="flex gap-3">
              <button
                onClick={() => { onClose(); onReject(); }}
                className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition flex items-center justify-center gap-2"
              >
                <ThumbsDown size={14} /> Rejeter
              </button>
              <button
                onClick={() => { onClose(); onApprove(); }}
                className="flex-[2] py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition flex items-center justify-center gap-2 shadow-sm"
              >
                <ThumbsUp size={14} /> Approuver
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-bold hover:bg-[#002d56] transition"
            >
              Fermer
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ������ Carte de demande ����������������������������������������������������������������������������������������������������������������
function ApprovalCard({
  req, onApprove, onReject, onCancel, onDetail, isHistory,
}: {
  req: LeaveRequest;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onDetail?: () => void;
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
      onClick={onDetail}
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${onDetail ? "cursor-pointer" : ""}`}
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
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold text-[10px] border border-indigo-300">2ème validation</span>
              )}
              {req.status === "PENDING" && req.employee.n2_manager_id && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-200">2 niveaux requis</span>
              )}
              {req.status === "PENDING_RH" && (
                <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold text-[10px] border border-purple-300">Validation RH</span>
              )}
              {(req.status === "PENDING" || req.status === "PENDING_SECOND") && !isHistory && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[10px] border border-amber-200">Votre validation manager</span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">{req.leave_type.label}</span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={11} className="text-gray-400" />
                {fmt(req.start_date)} →  {fmt(req.end_date)}
              </span>
              <span className="text-xs font-bold text-gray-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md">{days} j</span>
            </div>

            {req.motif && (
              <p className="text-[11px] text-gray-400 italic mt-1.5 truncate max-w-sm">
                <MessageSquare size={10} className="inline mr-1" />"{req.motif}"
              </p>
            )}
            {/* Bandeau N+1 déjà validé � visible uniquement pour PENDING_SECOND */}
            {req.status === "PENDING_SECOND" && req.reviewed_by && (
              <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 size={11} className="text-green-600 shrink-0" />
                <p className="text-[11px] text-green-700 font-medium">
                  Validé par {req.reviewed_by.full_name}
                  {req.reviewed_at && <span className="text-green-500 font-normal"> · {fmt(req.reviewed_at.slice(0, 10))}</span>}
                  {" "}· En attente de votre validation
                </p>
              </div>
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
            {isHistory && req.status === "REVOKED" && (req as any).revoke_reason && (
              <div className="flex items-start gap-1.5 mt-1.5">
                <AlertCircle size={11} className="text-purple-400 mt-0.5 shrink-0" />
                <p className="text-xs text-purple-600">Révoqué : {(req as any).revoke_reason}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {!isHistory && onApprove && onReject && (
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={e => { e.stopPropagation(); onApprove(); }}
                className="flex items-center gap-1.5 text-xs text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg transition font-medium border border-green-200 hover:border-green-400 whitespace-nowrap"
              >
                <ThumbsUp size={12} /> Approuver
              </button>
              <button
                onClick={e => { e.stopPropagation(); onReject(); }}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition font-medium border border-red-200 hover:border-red-400 whitespace-nowrap"
              >
                <ThumbsDown size={12} /> Rejeter
              </button>
            </div>
          )}
          {/* Bouton Annuler pour les congés APPROVED en historique */}
          {isHistory && req.status === "APPROVED" && onCancel && (
            <div className="shrink-0">
              <button
                onClick={e => { e.stopPropagation(); onCancel(); }}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition font-medium border border-gray-200 hover:border-gray-400 whitespace-nowrap"
              >
                <Ban size={12} /> Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ������ Page principale ������������������������������������������������������������������������������������������������������������������
// ── Panneau global des demandes en attente ────────────────────────────────────
// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "pending" | "history";
type SectionTab = "pending_all" | "leaves" | "exits" | "missions";

// ─── Modal Filtre ─────────────────────────────────────────────────────────────
function SectionFilterModal({
  sectionTab, setSectionTab,
  tab, setTab,
  filterType, setFilterType,
  filterStatus, setFilterStatus,
  leaveTypes,
  totalPendingCount, missionPendingCount,
  onClose,
}: {
  sectionTab: SectionTab; setSectionTab: (s: SectionTab) => void;
  tab: Tab; setTab: (t: Tab) => void;
  filterType: string; setFilterType: (v: string) => void;
  filterStatus: string; setFilterStatus: (v: string) => void;
  leaveTypes: { code: string; label: string }[];
  totalPendingCount: number; missionPendingCount: number;
  onClose: () => void;
}) {
  const SECTIONS: { key: SectionTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "pending_all", label: "En attente",  icon: <Bell size={16} />,          badge: totalPendingCount   },
    { key: "leaves",      label: "Conges",       icon: <ClipboardCheck size={16} />                           },
    { key: "exits",       label: "Sorties",      icon: <LogOut size={16} />                                   },
    { key: "missions",    label: "Missions",     icon: <Plane size={16} />,         badge: missionPendingCount },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-r from-[#003c71] to-blue-700 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Filter size={18} className="text-white" />
            </div>
            <h3 className="text-white font-bold text-sm">Filtres & Vue</h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vue</p>
            <div className="grid grid-cols-2 gap-2">
              {SECTIONS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSectionTab(s.key)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                    sectionTab === s.key
                      ? "border-[#003c71] bg-[#003c71]/5 text-[#003c71]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {s.icon}
                  {s.label}
                  {s.badge != null && s.badge > 0 && (
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold ${sectionTab === s.key ? "bg-[#003c71] text-white" : "bg-gray-200 text-gray-600"}`}>
                      {s.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {sectionTab === "leaves" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Onglet</p>
                <div className="flex gap-2">
                  {(["pending", "history"] as Tab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition ${
                        tab === t ? "border-[#003c71] bg-[#003c71]/5 text-[#003c71]" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {t === "pending" ? "En attente" : "Historique"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Type de conge</p>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white"
                >
                  <option value="ALL">Tous les types</option>
                  {leaveTypes.map(lt => (
                    <option key={lt.code} value={lt.code}>{lt.label}</option>
                  ))}
                </select>
              </div>

              {tab === "history" && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Statut</p>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white"
                  >
                    <option value="ALL">Tous les statuts</option>
                    <option value="APPROVED">Approuve</option>
                    <option value="REJECTED">Rejete</option>
                    <option value="PENDING">En attente (N+1)</option>
                    <option value="PENDING_SECOND">En attente (N+2)</option>
                    <option value="PENDING_RH">En attente (RH)</option>
                    <option value="REVOKED">Revoque</option>
                    <option value="CANCELLED">Annule</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-bold hover:bg-[#002d56] transition"
          >
            Appliquer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
type PendingItem =
  | { kind: "leave";   data: LeaveRequest      }
  | { kind: "exit";    data: ExitAuthorization  }
  | { kind: "mission"; data: MissionRequest     };

const fmtDtShort = (s: string | null | undefined) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

function PendingAllPanel({
  items, loading, onGoTo,
}: {
  items: PendingItem[];
  loading: boolean;
  onGoTo: (section: "leaves" | "exits" | "missions") => void;
}) {
  const TYPE_CFG = {
    leave:   { label: "Congé",   dotClass: "bg-blue-500",   badgeClass: "bg-blue-100 text-blue-700 border-blue-200",     section: "leaves"   as const },
    exit:    { label: "Sortie",  dotClass: "bg-orange-500", badgeClass: "bg-orange-100 text-orange-700 border-orange-200", section: "exits"    as const },
    mission: { label: "Mission", dotClass: "bg-violet-500", badgeClass: "bg-violet-100 text-violet-700 border-violet-200", section: "missions" as const },
  };

  if (loading) {
    return (
      <div className="p-5 space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="opacity-40" />
        </div>
        <p className="text-sm font-medium text-gray-500">Aucune demande en attente</p>
        <p className="text-xs mt-1 text-gray-400">Toutes les demandes ont été traitées</p>
      </div>
    );
  }

  const getName = (item: PendingItem) => {
    if (item.kind === "leave")   return item.data.employee.full_name;
    if (item.kind === "exit")    return item.data.employee_name;
    return `${item.data.employee.nom} ${item.data.employee.prenom}`;
  };

  const getSub = (item: PendingItem) => {
    if (item.kind === "leave")   return `${item.data.leave_type.label} · ${fmtDtShort(item.data.start_date)} → ${fmtDtShort(item.data.end_date)}`;
    if (item.kind === "exit")    return `Sortie le ${fmtDtShort(item.data.datetime_exit?.slice(0, 10))} · ${item.data.motif || "—"}`;
    return `Mission : ${item.data.destination} · ${fmtDtShort(item.data.date_debut)}`;
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-4 space-y-2">
      {items.map((item, idx) => {
        const cfg  = TYPE_CFG[item.kind];
        const name = getName(item);
        return (
          <motion.div
            key={`${item.kind}-${item.data.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            onClick={() => onGoTo(cfg.section)}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-100 bg-white hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 ${cfg.dotClass}`}>
              {getInitials(name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="font-semibold text-gray-800 text-sm truncate">{name}</span>
                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${cfg.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{getSub(item)}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[11px] text-gray-400 hidden sm:block">
                {fmtDtShort((item.data as any).created_at?.slice(0, 10))}
              </span>
              <ArrowRight size={14} className="text-gray-300 group-hover:text-[#003c71] transition-colors" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}



interface ManagerApprovalsPageProps {
  layout?: React.ComponentType<{ children: React.ReactNode }>;
  isRh?: boolean;
}

export default function ManagerApprovalsPage({ layout: Layout = ManagerLayout, isRh = false }: ManagerApprovalsPageProps) {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [sectionTab,    setSectionTab]    = useState<SectionTab>("pending_all");
  const [missionPendingCount, setMissionPendingCount] = useState(0);
  const [tab,           setTab]           = useState<Tab>("pending");
  const [requests,      setRequests]      = useState<LeaveRequest[]>([]);
  const [pendingExits,  setPendingExits]  = useState<ExitAuthorization[]>([]);
  const [pendingMissions, setPendingMissions] = useState<MissionRequest[]>([]);
  const [loadingAll,    setLoadingAll]    = useState(true);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterType,    setFilterType]    = useState("ALL");
  const [filterStatus,  setFilterStatus]  = useState("ALL");
  const [currentPage,   setCurrentPage]   = useState(1);
  const [showExport,      setShowExport]      = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [detailTarget,     setDetailTarget]     = useState<LeaveRequest | null>(null);
  const [approveTarget,    setApproveTarget]    = useState<LeaveRequest | null>(null);
  const [rejectTarget,     setRejectTarget]     = useState<LeaveRequest | null>(null);
  const [cancelTarget,     setCancelTarget]     = useState<LeaveRequest | null>(null);
  const [inProgressLeave,  setInProgressLeave]  = useState<LeaveRequest | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) { setLoading(false); setLoadingAll(false); return; }
    setLoading(true);
    setLoadingAll(true);
    try {
      const settle = <T,>(r: PromiseSettledResult<T[]>): T[] => {
        if (r.status === "fulfilled") return r.value;
        console.warn("[ManagerApprovalsPage] Requête échouée :", (r as PromiseRejectedResult).reason);
        return [];
      };

      const [leavesResult, exitsResult, missionsResult, ...rhResults] = await Promise.allSettled([
        leaveRequestService.getAll({ manager_employee_id: employeeId } as any),
        exitAuthorizationService.getAll({ manager_employee_id: employeeId, status: "PENDING" } as any),
        missionService.list({ status: "PENDING" }),
        ...(isRh ? [leaveRequestService.getAll({ status: "PENDING_RH" } as any)] : []),
      ]);

      // Congés
      const allLeaves = [
        ...settle(leavesResult as PromiseSettledResult<LeaveRequest[]>),
        ...rhResults.flatMap(r => settle(r as PromiseSettledResult<LeaveRequest[]>)),
      ];
      const seen = new Set<number>();
      setRequests(
        allLeaves
          .filter(r => r.employee.id !== employeeId)
          .filter(r => seen.has(r.id) ? false : !!seen.add(r.id))
      );

      // Sorties en attente
      const exits = settle(exitsResult as PromiseSettledResult<ExitAuthorization[]>);
      setPendingExits(exits.filter(e => e.employee !== employeeId));

      // Missions en attente dont je suis N+1
      const missions = settle(missionsResult as PromiseSettledResult<MissionRequest[]>);
      setPendingMissions(missions.filter(m => m.employee.n1_manager_id === employeeId));
    } catch (err) {
      console.error("[ManagerApprovalsPage] Erreur inattendue :", err);
      toast.error("Erreur lors du chargement des demandes.");
    } finally {
      setLoading(false);
      setLoadingAll(false);
    }
  }, [employeeId, isRh]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    return onEmployeesSynced(() => { refresh(); });
  }, [refresh]);

  const PENDING_STATUSES = ["PENDING", "PENDING_SECOND", ...(isRh ? ["PENDING_RH"] : [])] as string[];

  const pending = requests.filter(r => PENDING_STATUSES.includes(r.status));

  // Items agrégés pour le panneau "En attente"
  const allPendingItems: PendingItem[] = [
    ...pending.map(d => ({ kind: "leave" as const, data: d })),
    ...pendingExits.map(d => ({ kind: "exit" as const, data: d })),
    ...pendingMissions.map(d => ({ kind: "mission" as const, data: d })),
  ];
  const totalPendingCount = allPendingItems.length;
  // Historique = TOUTES les demandes des subordonnés (tous statuts)
  // comme /employee/leaves montre toutes les demandes d'un employé.
  const history = requests;

  const source = tab === "pending" ? pending : history;

  const filtered = source.filter(r => {
    const matchSearch = search === "" || [
      r.employee.full_name, r.employee.matricule,
      r.employee.service, r.leave_type.label,
    ].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchType   = filterType   === "ALL" || r.leave_type.code === filterType;
    const matchStatus = filterStatus === "ALL" || r.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const leaveTypes = [...new Map(requests.map(r => [r.leave_type.code, r.leave_type])).values()];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeTab = (t: Tab) => { setTab(t); setCurrentPage(1); setSearch(""); setFilterType("ALL"); setFilterStatus("ALL"); };

  const handleApprove = async (reqId: number) => {
    if (!employeeId) return;
    const req = requests.find(r => r.id === reqId);
    try {
      if (isRh && req?.status === "PENDING_RH") {
        // Validation finale RH
        await leaveRequestService.hrValidate(reqId, employeeId);
      } else {
        // Approbation manager (N+1 ou N+2) � même si l'utilisateur est RH
        await leaveRequestService.approve(reqId, { reviewer_id: employeeId });
      }
      toast.success("Demande approuvée !");
      setApproveTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'approbation.");
    }
  };

  const handleReject = async (reqId: number, reason: string) => {
    if (!employeeId) return;
    const req = requests.find(r => r.id === reqId);
    try {
      if (isRh && req?.status === "PENDING_RH") {
        // Rejet RH
        await leaveRequestService.hrReject(reqId, reason, employeeId);
      } else {
        // Rejet manager � même si l'utilisateur est RH
        await leaveRequestService.reject(reqId, reason);
      }
      toast.success("Demande rejetée.");
      setRejectTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors du rejet.");
    }
  };

  const handleCancel = async (reqId: number): Promise<void> => {
    const target = cancelTarget;
    try {
      await leaveRequestService.cancel(reqId);
      toast.success("Congé annulé. Les jours ont été restitués au solde.");
      setCancelTarget(null);
      refresh();
    } catch (e: any) {
      const data = e?.response?.data;
      setCancelTarget(null);
      if (data?.in_progress && target) {
        setInProgressLeave(target);
      } else {
        toast.error(data?.error || "Erreur lors de l'annulation.");
      }
    }
  };

  const statsCards = [
    { label: "En attente",   count: pending.length,                                                                   dot: "bg-amber-400",  tab: "pending" as Tab },
    { label: "Approuvées",   count: requests.filter(r => r.status === "APPROVED").length,                             dot: "bg-green-500",  tab: "history" as Tab },
    { label: "Rejetées",     count: requests.filter(r => r.status === "REJECTED").length,                             dot: "bg-red-500",    tab: "history" as Tab },
    { label: "Total congés", count: requests.length,                                                                   dot: "bg-slate-300",  tab: "history" as Tab },
  ];

  return (
    <Layout>
      <div className="px-4 md:px-6 pb-10">

        {/* ���� Header ���� */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-3 mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#003c71] text-white shrink-0">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#003c71]">
                Mes approbations
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Demandes en attente et historique de vos employés rattachés
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilterModal(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl border border-[#003c71] text-sm font-semibold text-[#003c71] hover:bg-[#003c71]/5 transition"
            >
              <Filter size={15} />
              Filtre
              {totalPendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {totalPendingCount > 9 ? "9+" : totalPendingCount}
                </span>
              )}
            </button>
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Actualiser
            </button>
          </div>
        </motion.div>

        {/* ���� Section Autorisations de sortie ���� */}
        {/* Section En attente globale */}
        {sectionTab === "pending_all" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
              <Bell size={16} className="text-[#003c71]" />
              <span className="font-semibold text-gray-800">Demandes en attente de validation</span>
              {!loadingAll && (
                <span className="text-xs text-gray-400">
                  ({totalPendingCount} demande{totalPendingCount > 1 ? "s" : ""})
                </span>
              )}
            </div>
            <PendingAllPanel
              items={allPendingItems}
              loading={loadingAll}
              onGoTo={(section) => setSectionTab(section)}
            />
          </div>
        )}

        {sectionTab === "exits" && employeeId && (
          <ExitAuthorizationPanel
            managerId={employeeId}
            canCreate={false}
            showEmployeeName
            canReview
            hideHeader
          />
        )}

        {/* Section Missions */}
        {sectionTab === "missions" && employeeId && (
          <ManagerMissionApprovalsPanel
            managerId={employeeId}
            onPendingCountChange={setMissionPendingCount}
          />
        )}

        {/* ���� Section Congés ���� */}
        {sectionTab === "leaves" && (
        <>

        {/* ���� Stats ���� */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {statsCards.map((s, i) => (
            <motion.button
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => changeTab(s.tab)}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border bg-white transition hover:shadow-sm text-center ${
                tab === s.tab
                  ? "border-[#003c71] ring-2 ring-[#003c71]/20"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="text-2xl font-bold text-[#003c71]">{loading ? "⬦" : s.count}</span>
              <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            </motion.button>
          ))}
        </div>


        {/* Barre recherche + export */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Nom, matricule, service..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003c71]/30 bg-white"
            />
          </div>
          {/* Chips filtres actifs */}
          {tab === "history" && (
            <span className="text-xs px-2.5 py-1.5 rounded-full bg-[#003c71]/10 text-[#003c71] font-semibold border border-[#003c71]/20">
              Historique
            </span>
          )}
          {filterType !== "ALL" && (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              {leaveTypes.find(lt => lt.code === filterType)?.label ?? filterType}
              <button onClick={() => setFilterType("ALL")} className="ml-0.5 hover:text-blue-900"><X size={10} /></button>
            </span>
          )}
          {filterStatus !== "ALL" && (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-700 font-semibold border border-gray-200">
              {STATUS_CONFIG[filterStatus]?.label ?? filterStatus}
              <button onClick={() => setFilterStatus("ALL")} className="ml-0.5 hover:text-gray-900"><X size={10} /></button>
            </span>
          )}
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 hover:border-[#003c71] hover:text-[#003c71] transition font-medium whitespace-nowrap"
          >
            <Download size={14} />
            Exporter
          </button>
        </div>


        {/* ���� Liste ���� */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800">
              {tab === "pending" ? "Demandes en attente de validation" : "Toutes les demandes de mes employés"}
            </span>
            {!loading && (
              <span className="text-xs text-gray-400">
                ({filtered.length} résultat{filtered.length > 1 ? "s" : ""}{tab === "history" && requests.length !== filtered.length ? ` / ${history.length} total` : ""})
              </span>
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
                {tab === "pending" ? "Aucune demande en attente" : "Aucune demande trouvée"}
              </p>
              <p className="text-xs mt-1 text-gray-400">
                {search || filterType !== "ALL" || filterStatus !== "ALL"
                  ? "Aucun résultat pour ces filtres"
                  : tab === "pending" ? "Toutes les demandes ont été traitées" : "Vos employés n'ont encore soumis aucune demande"
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
                    onDetail={() => setDetailTarget(req)}
                    onApprove={tab === "pending" ? () => setApproveTarget(req) : undefined}
                    onReject={tab  === "pending" ? () => setRejectTarget(req)  : undefined}
                    onCancel={tab  === "history" && req.status === "APPROVED" ? () => setCancelTarget(req) : undefined}
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
        </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {detailTarget && (
          <LeaveDetailModal
            req={detailTarget}
            onClose={() => setDetailTarget(null)}
            onApprove={(detailTarget.status === "PENDING" || detailTarget.status === "PENDING_SECOND") ? () => { setDetailTarget(null); setApproveTarget(detailTarget); } : undefined}
            onReject={(detailTarget.status === "PENDING" || detailTarget.status === "PENDING_SECOND") ? () => { setDetailTarget(null); setRejectTarget(detailTarget); } : undefined}
          />
        )}
        {showExport && (
          <ExportModal
            onClose={() => setShowExport(false)}
            requests={filtered}
            managerName={user?.employee_name || user?.username || "Manager"}
            tab={tab}
          />
        )}
      {showFilterModal && (
        <SectionFilterModal
          sectionTab={sectionTab}
          setSectionTab={(s) => { setSectionTab(s); setCurrentPage(1); setSearch(""); }}
          tab={tab}
          setTab={(t) => { changeTab(t); }}
          filterType={filterType}
          setFilterType={(v) => { setFilterType(v); setCurrentPage(1); }}
          filterStatus={filterStatus}
          setFilterStatus={(v) => { setFilterStatus(v); setCurrentPage(1); }}
          leaveTypes={leaveTypes}
          totalPendingCount={totalPendingCount}
          missionPendingCount={missionPendingCount}
          onClose={() => setShowFilterModal(false)}
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
        {cancelTarget && (
          <CancelModal
            req={cancelTarget}
            onConfirm={handleCancel}
            onClose={() => setCancelTarget(null)}
          />
        )}
        {inProgressLeave && (
          <InProgressAlertModal
            req={inProgressLeave}
            onClose={() => setInProgressLeave(null)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}

