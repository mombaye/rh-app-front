// src/components/leaves/LeaveRequestList.tsx
// Gestion complète : PENDING, PENDING_SECOND, APPROVED, REJECTED, CANCELLED, REVOKED

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveRequestService } from "@/services/leaveService";
import { ContractType, LeaveRequest, LeaveStatus } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import {
  FiX, FiAlertCircle, FiRefreshCw, FiChevronDown,
  FiDownload, FiCheck, FiAlertTriangle,
} from "react-icons/fi";
import toast from "react-hot-toast";

const STATUS_CONFIG: Record<
  LeaveStatus,
  { label: string; color: string; bg: string; dotClass: string }
> = {
  PENDING:        { label: "En attente",        color: "#f59e0b", bg: "#fffbeb", dotClass: "bg-amber-400"    },
  PENDING_SECOND: { label: "2ème approbation",  color: "#8b5cf6", bg: "#f5f3ff", dotClass: "bg-violet-500"   },
  APPROVED:       { label: "Approuvé",          color: "#10b981", bg: "#ecfdf5", dotClass: "bg-emerald-500"  },
  REJECTED:       { label: "Rejeté",            color: "#ef4444", bg: "#fef2f2", dotClass: "bg-red-500"      },
  CANCELLED:      { label: "Annulé",            color: "#64748b", bg: "#f8fafc", dotClass: "bg-slate-400"    },
  REVOKED:        { label: "Révoqué (urgence)", color: "#f97316", bg: "#fff7ed", dotClass: "bg-orange-400"   },
};

type StatusFilter = "ALL" | "PENDING" | "PENDING_SECOND" | "APPROVED" | "REJECTED" | "CANCELLED" | "REVOKED";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL",            label: "Toutes les demandes"      },
  { value: "PENDING",        label: "En attente"                },
  { value: "PENDING_SECOND", label: "2ème approbation requise"  },
  { value: "APPROVED",       label: "Approuvées"                },
  { value: "REJECTED",       label: "Rejetées"                  },
  { value: "CANCELLED",      label: "Annulées"                  },
  { value: "REVOKED",        label: "Révoquées"                 },
];

interface Props {
  contractType?: ContractType;
  refreshKey?:   number;
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface ApproveModalState {
  leaveId:          number;
  employeeName:     string;
  status:           LeaveStatus;
  reviewerId:       string;
  secondApproverId: string;
  useSecondLevel:   boolean;
}

interface RevokeModalState {
  leaveId:      number;
  employeeName: string;
  endDate:      string;
  reason:       string;
  revokerIdStr: string;
  recallDate:   string;
}

export default function LeaveRequestList({
  contractType = "INTERNE",
  refreshKey   = 0,
}: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [requests,      setRequests]      = useState<LeaveRequest[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("ALL");
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [selected,      setSelected]      = useState<LeaveRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason,  setRejectReason]  = useState("");
  const [approveModal,  setApproveModal]  = useState<ApproveModalState | null>(null);
  const [revokeModal,   setRevokeModal]   = useState<RevokeModalState | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const apiStatus = statusFilter !== "ALL" ? (statusFilter as LeaveStatus) : undefined;
      const data = await leaveRequestService.getAll({
        ...(apiStatus ? { status: apiStatus } : {}),
        contract_type: contractType,
      });
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.response?.data?.error ?? "Erreur lors du chargement.";
      setFetchError(msg);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, contractType, refreshKey]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const openApproveModal = (r: LeaveRequest) => {
    setApproveModal({
      leaveId:          r.id,
      employeeName:     r.employee?.full_name ?? "Employé",
      status:           r.status,
      reviewerId:       "",
      secondApproverId: "",
      useSecondLevel:   false,
    });
  };

  const handleApproveSubmit = async () => {
    if (!approveModal) return;
    setActionLoading(true);
    try {
      await leaveRequestService.approve(approveModal.leaveId, {
        ...(approveModal.reviewerId ? { reviewer_id: parseInt(approveModal.reviewerId) } : {}),
        ...(approveModal.useSecondLevel && approveModal.secondApproverId
          ? { second_approver_id: parseInt(approveModal.secondApproverId) }
          : {}),
      });
      toast.success(
        approveModal.useSecondLevel && approveModal.secondApproverId
          ? "Transmis au 2ème approbateur ✓"
          : "Demande approuvée ✓"
      );
      setApproveModal(null);
      setSelected(null);
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'approbation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: number) => {
    if (!rejectReason.trim()) { toast.error("Le motif de rejet est obligatoire."); return; }
    setActionLoading(true);
    try {
      await leaveRequestService.reject(id, rejectReason);
      toast.success("Demande rejetée");
      setSelected(null);
      setRejectReason("");
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors du rejet");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    setActionLoading(true);
    try {
      await leaveRequestService.cancel(id);
      toast.success("Demande annulée");
      setSelected(null);
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'annulation");
    } finally {
      setActionLoading(false);
    }
  };

  const openRevokeModal = (r: LeaveRequest) => {
    const today = new Date().toISOString().slice(0, 10);
    setRevokeModal({
      leaveId:      r.id,
      employeeName: r.employee?.full_name ?? "Employé",
      endDate:      r.end_date,
      reason:       "",
      revokerIdStr: "",
      recallDate:   today,
    });
  };

  const handleRevokeSubmit = async () => {
    if (!revokeModal) return;
    if (!revokeModal.reason.trim()) { toast.error("Le motif de révocation est obligatoire."); return; }
    setActionLoading(true);
    try {
      const result = await leaveRequestService.revoke(revokeModal.leaveId, {
        revoke_reason: revokeModal.reason,
        ...(revokeModal.revokerIdStr ? { revoker_id: parseInt(revokeModal.revokerIdStr) } : {}),
        recall_date:   revokeModal.recallDate,
      });
      toast.success(`Congé révoqué. ${result.days_restored ?? "0"}j restitués au solde.`);
      setRevokeModal(null);
      setSelected(null);
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la révocation");
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = (r: LeaveRequest) => { setSelected(r); setRejectReason(""); };
  const closeModal = () => { setSelected(null); setRejectReason(""); };

  if (loading) return (
    <div className="py-24 flex flex-col items-center gap-3 text-gray-400">
      <ImSpinner2 className="animate-spin" size={28} />
      <p className="text-sm">Chargement des demandes…</p>
    </div>
  );

  if (fetchError) return (
    <div className="py-24 flex flex-col items-center gap-4">
      <FiAlertCircle size={32} className="text-red-400" />
      <p className="text-sm font-medium text-red-500">{fetchError}</p>
      <button onClick={fetchRequests} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium transition">
        <FiRefreshCw size={14} /> Réessayer
      </button>
    </div>
  );

  const currentFilter = FILTER_OPTIONS.find((o) => o.value === statusFilter)!;

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {requests.length} demande{requests.length !== 1 ? "s" : ""}
          {statusFilter !== "ALL" && <span className="ml-1 text-gray-400">· {currentFilter.label}</span>}
        </p>
        <div className="flex items-center gap-2">
          {/* Filtre statut */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium text-gray-700 transition"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusFilter === "ALL" ? "#9ca3af" : STATUS_CONFIG[statusFilter as LeaveStatus]?.color }}
              />
              {currentFilter.label}
              <FiChevronDown size={12} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-30"
                >
                  {FILTER_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => { setStatusFilter(value); setDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                        statusFilter === value ? "font-semibold bg-gray-50 text-camublue-900" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {value !== "ALL" && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_CONFIG[value as LeaveStatus]?.color ?? "#9ca3af" }} />
                      )}
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={fetchRequests} title="Actualiser" className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition">
            <FiRefreshCw size={14} />
          </button>
          <button
            onClick={() => leaveRequestService.downloadExcel()}
            title="Exporter Excel"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium transition"
          >
            <FiDownload size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {requests.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-medium text-sm">Aucune demande trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Employé", "Type", "Période", "Durée", "Statut", "Validé par", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r, i) => {
                  const statusKey  = (r.status in STATUS_CONFIG ? r.status : "PENDING") as LeaveStatus;
                  const st         = STATUS_CONFIG[statusKey];
                  const leaveColor = r.leave_type?.color ?? "#6b7280";
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.025 }}
                      onClick={() => openDetail(r)}
                      className={`hover:bg-gray-50/80 transition cursor-pointer ${i % 2 !== 0 ? "bg-gray-50/20" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: leaveColor }}>
                            {(r.employee?.full_name ?? "??").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate text-xs">{r.employee?.full_name ?? "—"}</p>
                            <p className="text-xs text-gray-400 truncate">{r.employee?.service ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: leaveColor + "20", color: leaveColor }}>
                          {r.leave_type?.label ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 text-xs whitespace-nowrap">
                        {r.days ?? r.duration_days ?? "—"}j
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: st.bg, color: st.color }}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dotClass}`} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {r.status === "PENDING_SECOND" && r.reviewed_by
                          ? <span className="text-violet-600 font-medium">{r.reviewed_by.full_name}<br /><span className="text-gray-400 font-normal text-[10px]">en attente N+2</span></span>
                          : r.status === "REVOKED" && r.revoked_by
                            ? <span className="text-orange-600 font-medium">{r.revoked_by.full_name}</span>
                            : r.reviewed_by?.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5 flex-wrap">
                          {(r.status === "PENDING" || r.status === "PENDING_SECOND") && (
                            <>
                              <button onClick={() => openApproveModal(r)} disabled={actionLoading} className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 whitespace-nowrap">
                                <FiCheck size={11} className="inline mr-0.5" />Approuver
                              </button>
                              <button onClick={() => openDetail(r)} className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap">
                                Rejeter
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <>
                              <button onClick={() => openRevokeModal(r)} disabled={actionLoading} className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 whitespace-nowrap">
                                <FiAlertTriangle size={11} className="inline mr-0.5" />Révoquer
                              </button>
                              <button onClick={() => handleCancel(r.id)} disabled={actionLoading} className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition disabled:opacity-50 whitespace-nowrap">
                                Annuler
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Détail ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start px-6 pt-6 pb-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Détail de la demande</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Réf. #{selected.id}</p>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
                  <FiX size={16} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: STATUS_CONFIG[selected.status]?.bg ?? "#f8fafc", color: STATUS_CONFIG[selected.status]?.color ?? "#64748b" }}
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selected.status]?.dotClass ?? "bg-slate-400"}`} />
                  {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    ["Employé",   selected.employee?.full_name ?? "—"],
                    ["Matricule", selected.employee?.matricule ?? "—"],
                    ["Service",   selected.employee?.service   ?? "—"],
                    ["Manager",   selected.employee?.manager   || "—"],
                    ["Type",      selected.leave_type?.label   ?? "—"],
                    ["Durée",     `${selected.days ?? selected.duration_days ?? "—"} jour(s)`],
                    ["Du",        fmtDate(selected.start_date)],
                    ["Au",        fmtDate(selected.end_date)],
                    ["Soumis le", fmtDate(selected.created_at?.slice(0, 10))],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-1 tracking-wide">{k}</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Motif</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.motif || "—"}</p>
                </div>

                {selected.reviewed_by && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-xs text-emerald-600 uppercase font-semibold mb-1">1ère approbation</p>
                    <p className="text-sm font-semibold text-emerald-800">{selected.reviewed_by.full_name}</p>
                    {selected.reviewed_at && <p className="text-xs text-emerald-600 mt-0.5">{fmtDate(selected.reviewed_at.slice(0,10))}</p>}
                  </div>
                )}

                {selected.requires_second_approval && (
                  <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                    <p className="text-xs text-violet-600 uppercase font-semibold mb-1">2ème approbation</p>
                    {selected.second_reviewer ? (
                      <>
                        <p className="text-sm font-semibold text-violet-800">{selected.second_reviewer.full_name}</p>
                        {selected.second_reviewed_at && <p className="text-xs text-violet-600 mt-0.5">{fmtDate(selected.second_reviewed_at.slice(0,10))}</p>}
                        {selected.status === "PENDING_SECOND" && <p className="text-xs text-violet-500 mt-0.5 italic">En attente de validation…</p>}
                      </>
                    ) : (
                      <p className="text-sm text-violet-600 italic">Approbateur non encore désigné</p>
                    )}
                  </div>
                )}

                {selected.status === "REVOKED" && (
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-1">
                    <p className="text-xs text-orange-600 uppercase font-semibold">Révocation d'urgence</p>
                    {selected.revoked_by && <p className="text-sm font-semibold text-orange-800">Par : {selected.revoked_by.full_name}</p>}
                    {selected.revoked_at && <p className="text-xs text-orange-600">{fmtDate(selected.revoked_at.slice(0,10))}</p>}
                    {selected.revoke_reason && <p className="text-sm text-orange-700 whitespace-pre-wrap">{selected.revoke_reason}</p>}
                    {selected.days_remaining_at_revocation != null && (
                      <p className="text-sm font-bold text-emerald-700">{selected.days_remaining_at_revocation}j restitués au solde</p>
                    )}
                  </div>
                )}

                {selected.status === "REJECTED" && selected.reject_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs text-red-400 uppercase font-semibold mb-1">Motif de rejet</p>
                    <p className="text-sm text-red-700 whitespace-pre-wrap">{selected.reject_reason}</p>
                  </div>
                )}

                {(selected.status === "PENDING" || selected.status === "PENDING_SECOND") && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                      Motif de rejet <span className="normal-case font-normal text-gray-400">(obligatoire pour rejeter)</span>
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Expliquez la raison du rejet…"
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 resize-none transition"
                    />
                  </div>
                )}

                {(selected.status === "PENDING" || selected.status === "PENDING_SECOND") && (
                  <div className="flex gap-3 pt-1">
                    <button
                      disabled={actionLoading || !rejectReason.trim()}
                      onClick={() => handleReject(selected.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      {actionLoading && <ImSpinner2 className="animate-spin" size={13} />}✗ Rejeter
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => { closeModal(); openApproveModal(selected); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      ✓ Approuver
                    </button>
                  </div>
                )}

                {selected.status === "APPROVED" && (
                  <div className="flex gap-3 pt-1">
                    <button
                      disabled={actionLoading}
                      onClick={() => { closeModal(); openRevokeModal(selected); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      <FiAlertTriangle size={14} />Révoquer (urgence)
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleCancel(selected.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      {actionLoading && <ImSpinner2 className="animate-spin" size={13} />}Annuler
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Approbation ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {approveModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => !actionLoading && setApproveModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-[460px] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-4">
                <h3 className="text-base font-bold text-gray-900">
                  {approveModal.status === "PENDING_SECOND" ? "2ème approbation" : "Approuver la demande"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{approveModal.employeeName}</p>
              </div>
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                    Votre ID employé (validateur) <span className="normal-case font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <input
                    type="number" min={1} value={approveModal.reviewerId}
                    onChange={(e) => setApproveModal((m) => m && ({ ...m, reviewerId: e.target.value }))}
                    placeholder="Ex : 12"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
                  />
                </div>

                {approveModal.status === "PENDING" && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox" checked={approveModal.useSecondLevel}
                        onChange={(e) => setApproveModal((m) => m && ({ ...m, useSecondLevel: e.target.checked }))}
                        className="w-4 h-4 rounded accent-camublue-900"
                      />
                      <span className="text-sm text-gray-700 font-medium">Transmettre à un 2ème approbateur (N+2)</span>
                    </label>
                    <AnimatePresence>
                      {approveModal.useSecondLevel && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                            ID du 2ème approbateur <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number" min={1} value={approveModal.secondApproverId}
                            onChange={(e) => setApproveModal((m) => m && ({ ...m, secondApproverId: e.target.value }))}
                            placeholder="Ex : 7 (ID du manager N+2)"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition"
                          />
                          <p className="text-xs text-gray-400 mt-1">Un email sera envoyé automatiquement au 2ème approbateur.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setApproveModal(null)} disabled={actionLoading} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
                    Annuler
                  </button>
                  <button
                    onClick={handleApproveSubmit}
                    disabled={actionLoading || (approveModal.useSecondLevel && !approveModal.secondApproverId.trim())}
                    className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                  >
                    {actionLoading
                      ? <><ImSpinner2 className="animate-spin" size={13} /> En cours…</>
                      : approveModal.useSecondLevel && approveModal.secondApproverId
                        ? "✓ Transmettre au N+2"
                        : "✓ Approuver définitivement"
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Révocation ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {revokeModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => !actionLoading && setRevokeModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-orange-50 border-b border-orange-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <FiAlertTriangle size={18} className="text-orange-500 shrink-0" />
                  <div>
                    <h3 className="text-base font-bold text-orange-900">Révocation d'urgence</h3>
                    <p className="text-sm text-orange-600 mt-0.5">{revokeModal.employeeName}</p>
                  </div>
                </div>
                <p className="text-xs text-orange-600 mt-2">
                  L'employé sera rappelé de son congé. Les jours restants seront restitués à son solde.
                </p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">Date effective du rappel</label>
                  <input
                    type="date" value={revokeModal.recallDate} max={revokeModal.endDate}
                    onChange={(e) => setRevokeModal((m) => m && ({ ...m, recallDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Les jours du <strong>{revokeModal.recallDate}</strong> au <strong>{fmtDate(revokeModal.endDate)}</strong> seront restitués.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                    Votre ID employé (RH) <span className="normal-case font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <input
                    type="number" min={1} value={revokeModal.revokerIdStr}
                    onChange={(e) => setRevokeModal((m) => m && ({ ...m, revokerIdStr: e.target.value }))}
                    placeholder="Ex : 1"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                    Motif de révocation <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={revokeModal.reason}
                    onChange={(e) => setRevokeModal((m) => m && ({ ...m, reason: e.target.value }))}
                    placeholder="Ex : Urgence opérationnelle, intervention critique requise…"
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none transition"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setRevokeModal(null)} disabled={actionLoading} className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
                    Annuler
                  </button>
                  <button
                    onClick={handleRevokeSubmit}
                    disabled={actionLoading || !revokeModal.reason.trim()}
                    className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                  >
                    {actionLoading
                      ? <><ImSpinner2 className="animate-spin" size={13} /> En cours…</>
                      : <><FiAlertTriangle size={14} /> Confirmer la révocation</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
