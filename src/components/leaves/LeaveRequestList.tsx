// src/components/leaves/LeaveRequestList.tsx

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { leaveRequestService } from "@/services/leaveService";
import { ContractType, LeaveRequest, LeaveStatus } from "@/types/leave";
import { ImSpinner2 } from "react-icons/im";
import { FiX, FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/useAuth";

// ─── Types locaux ─────────────────────────────────────────────────────────────
type StatusFilter = "ALL" | "PENDING" | "APPROVED";

interface Props {
  statusFilter?: StatusFilter;
  contractType?: ContractType;
}

// ─── Config statut ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  LeaveStatus,
  { label: string; color: string; bg: string; dotClass: string }
> = {
  PENDING:        { label: "En attente N+1",      color: "#f59e0b", bg: "#fffbeb", dotClass: "bg-amber-400"   },
  PENDING_SECOND: { label: "En attente N+2",      color: "#7c3aed", bg: "#f5f3ff", dotClass: "bg-violet-500"  },
  PENDING_RH:     { label: "En attente RH",       color: "#2563eb", bg: "#eff6ff", dotClass: "bg-blue-500"    },
  APPROVED:       { label: "Approuvé",            color: "#10b981", bg: "#ecfdf5", dotClass: "bg-emerald-500" },
  REJECTED:       { label: "Rejeté",              color: "#ef4444", bg: "#fef2f2", dotClass: "bg-red-500"     },
  CANCELLED:      { label: "Annulé",              color: "#64748b", bg: "#f8fafc", dotClass: "bg-slate-400"   },
  REVOKED:        { label: "Révoqué",             color: "#b45309", bg: "#fff7ed", dotClass: "bg-orange-500"  },
};

// Convertit le filtre UI → LeaveStatus API
function toApiStatus(sf: StatusFilter): LeaveStatus | undefined {
  if (sf === "PENDING")  return "PENDING";
  if (sf === "APPROVED") return "APPROVED";
  return undefined;
}

// Formate une date "YYYY-MM-DD" en "DD/MM/YYYY"
function fmtDate(d: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ─── Composant ────────────────────────────────────────────────────────────────
export default function LeaveRequestList({
  statusFilter = "ALL",
  contractType = "INTERNE",
}: Props) {
  const { user } = useAuth();
  const [requests,      setRequests]      = useState<LeaveRequest[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [selected,      setSelected]      = useState<LeaveRequest | null>(null);
  const [rejectReason,  setRejectReason]  = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const apiStatus = toApiStatus(statusFilter);
      const data = await leaveRequestService.getAll({
        ...(apiStatus ? { status: apiStatus } : {}),
        // contract_type est retiré côté service avant l'appel API
        contract_type: contractType,
      });

      // data doit être un tableau — sécurisation
      if (Array.isArray(data)) {
        setRequests(data);
      } else {
        console.error("Réponse inattendue de /requests/ :", data);
        setRequests([]);
        setFetchError("Format de réponse inattendu du serveur.");
      }
    } catch (err: any) {
      console.error("Erreur chargement demandes :", err);
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.error  ??
        err?.message                ??
        "Erreur lors du chargement des demandes.";
      setFetchError(msg);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, contractType]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // ── Actions ────────────────────────────────────────────────────────────────

  /** POST approve or hr_validate based on current status */
  const handleApprove = async (id: number) => {
    setActionLoading(true);
    try {
      if (selected?.status === "PENDING_RH") {
        // Validation RH finale
        await leaveRequestService.hrValidate(id);
        toast.success("Demande validée par le RH ✓");
      } else {
        // Validation N+1 ou N+2
        await leaveRequestService.approve(id);
        toast.success("Demande approuvée ✓");
      }
      await fetchRequests();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'approbation");
    } finally {
      setActionLoading(false);
    }
  };

  /** POST reject or hr_reject based on current status */
  const handleReject = async (id: number) => {
    if (!rejectReason.trim()) {
      toast.error("Le motif de rejet est obligatoire.");
      return;
    }
    setActionLoading(true);
    try {
      if (selected?.status === "PENDING_RH") {
        await leaveRequestService.hrReject(id, rejectReason);
        toast.success("Demande rejetée par le RH");
      } else {
        await leaveRequestService.reject(id, rejectReason);
        toast.success("Demande rejetée");
      }
      await fetchRequests();
      setSelected(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors du rejet");
    } finally {
      setActionLoading(false);
    }
  };

  /** POST /api/leaves/requests/<id>/cancel/ */
  const handleCancel = async (id: number) => {
    setActionLoading(true);
    try {
      await leaveRequestService.cancel(id, user?.employee_id ?? undefined);
      toast.success("Demande annulée");
      await fetchRequests();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'annulation");
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = (r: LeaveRequest) => {
    setSelected(r);
    setRejectReason("");
  };
  const closeModal = () => {
    setSelected(null);
    setRejectReason("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // État : chargement
  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center gap-3 text-gray-400">
        <ImSpinner2 className="animate-spin" size={26} />
        <p className="text-sm">Chargement des demandes…</p>
      </div>
    );
  }

  // État : erreur fetch
  if (fetchError) {
    return (
      <div className="py-24 flex flex-col items-center gap-4 text-gray-500">
        <FiAlertCircle size={32} className="text-red-400" />
        <p className="text-sm font-medium text-red-500">{fetchError}</p>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium transition"
        >
          <FiRefreshCw size={14} /> Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Compteur + refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {requests.length} demande{requests.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition"
        >
          <FiRefreshCw size={12} /> Actualiser
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {requests.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-medium text-sm">Aucune demande trouvée</p>
            <p className="text-xs mt-1 text-gray-300">
              {statusFilter !== "ALL"
                ? `Aucune demande au statut "${STATUS_CONFIG[toApiStatus(statusFilter)!]?.label ?? statusFilter}"`
                : "Aucune demande enregistrée"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Employé", "Type de congé", "Période", "Durée", "Statut", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r, i) => {
                  // Sécurisation : s'assurer que status est valide
                  const statusKey  = (r.status in STATUS_CONFIG ? r.status : "PENDING") as LeaveStatus;
                  const st         = STATUS_CONFIG[statusKey];
                  const leaveColor = r.leave_type?.color ?? "#6b7280";
                  const initials   = (r.employee?.full_name ?? "??").slice(0, 2).toUpperCase();

                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.03 }}
                      onClick={() => openDetail(r)}
                      className={`hover:bg-gray-50/80 transition cursor-pointer ${
                        i % 2 !== 0 ? "bg-gray-50/20" : ""
                      }`}
                    >
                      {/* Employé */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: leaveColor }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">
                              {r.employee?.full_name ?? "—"}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {r.employee?.service ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type de congé */}
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{
                            backgroundColor: leaveColor + "20",
                            color:           leaveColor,
                          }}
                        >
                          {r.leave_type?.label ?? "—"}
                          {r.leave_type?.code && (
                            <span className="opacity-60 text-[10px]">({r.leave_type.code})</span>
                          )}
                        </span>
                      </td>

                      {/* Période */}
                      <td className="px-5 py-4 text-gray-600 text-xs whitespace-nowrap">
                        {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                      </td>

                      {/* Durée — days est un DecimalField string côté DRF */}
                      <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">
                        {r.days ?? r.duration_days ?? "—"}j
                      </td>

                      {/* Statut */}
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{ backgroundColor: st.bg, color: st.color }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dotClass}`} />
                          {st.label}
                        </span>
                      </td>

                      {/* Actions rapides inline */}
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {r.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleApprove(r.id)}
                                disabled={actionLoading}
                                title="Approuver"
                                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 whitespace-nowrap"
                              >
                                ✓ Approuver
                              </button>
                              <button
                                onClick={() => openDetail(r)}
                                title="Rejeter (saisir un motif)"
                                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap"
                              >
                                ✗ Rejeter
                              </button>
                            </>
                          )}
                          {r.status === "APPROVED" && (
                            <button
                              onClick={() => handleCancel(r.id)}
                              disabled={actionLoading}
                              title="Annuler"
                              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition disabled:opacity-50 whitespace-nowrap"
                            >
                              Annuler
                            </button>
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

      {/* ── Modal Détail ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{ opacity: 0, scale: 0.97,    y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header modal */}
              <div className="flex justify-between items-start px-8 pt-8 pb-0">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Détail de la demande</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Réf. #{selected.id}</p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100"
                >
                  <FiX size={18} />
                </button>
              </div>

              <div className="px-8 py-6 space-y-4">
                {/* Badge statut en haut */}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold"
                    style={{
                      backgroundColor: STATUS_CONFIG[selected.status]?.bg    ?? "#f8fafc",
                      color:           STATUS_CONFIG[selected.status]?.color  ?? "#64748b",
                    }}
                  >
                    <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selected.status]?.dotClass ?? "bg-slate-400"}`} />
                    {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                  </span>
                  {selected.status_label && selected.status_label !== STATUS_CONFIG[selected.status]?.label && (
                    <span className="text-xs text-gray-400">{selected.status_label}</span>
                  )}
                </div>

                {/* Grille d'informations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    ["Employé",    selected.employee?.full_name ?? "—"],
                    ["Matricule",  selected.employee?.matricule ?? "—"],
                    ["Service",    selected.employee?.service   ?? "—"],
                    ["Manager",    selected.employee?.manager   || "—"],
                    ["Type",       selected.leave_type?.label   ?? "—"],
                    ["Code",       selected.leave_type?.code    ?? "—"],
                    ["Du",         fmtDate(selected.start_date)],
                    ["Au",         fmtDate(selected.end_date)  ],
                    ["Durée",      `${selected.days ?? selected.duration_days ?? "—"} jour(s)`],
                    ["Soumis le",  fmtDate(selected.created_at?.slice(0, 10))],
                    ...(selected.reviewed_at
                      ? [["Traité le", fmtDate(selected.reviewed_at.slice(0, 10))]]
                      : []
                    ),
                    ...(selected.reviewed_by
                      ? [["Traité par", selected.reviewed_by.full_name]]
                      : []
                    ),
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-1 tracking-wide">{k}</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{v}</p>
                    </div>
                  ))}
                </div>

                {/* Motif de la demande */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1 tracking-wide">Motif</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selected.motif || "—"}
                  </p>
                </div>

                {/* ── Chaîne d'approbation hiérarchique ── */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-3 tracking-wide">
                    Chaîne de validation
                  </p>
                  <div className="space-y-2">
                    {/* Étape 1 : N+1 */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                        selected.reviewed_by ? "bg-emerald-500" : selected.status === "PENDING" ? "bg-amber-400 animate-pulse" : "bg-slate-300"
                      }`}>
                        {selected.reviewed_by ? "✓" : "1"}
                      </span>
                      <span className="font-medium text-slate-700">N+1</span>
                      <span className="text-slate-400">—</span>
                      <span className={selected.reviewed_by ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                        {selected.reviewed_by
                          ? `${selected.reviewed_by.full_name} (${selected.reviewed_at ? new Date(selected.reviewed_at).toLocaleDateString("fr") : ""})`
                          : selected.employee?.n1_manager_name ?? "Non défini"}
                      </span>
                    </div>
                    {/* Étape 2 : N+2 (si applicable) */}
                    {(selected.requires_second_approval || selected.second_reviewer || selected.employee?.n2_manager_id) && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                          selected.second_reviewer && selected.second_reviewed_at ? "bg-emerald-500"
                          : selected.status === "PENDING_SECOND" ? "bg-violet-500 animate-pulse"
                          : "bg-slate-300"
                        }`}>
                          {selected.second_reviewer && selected.second_reviewed_at ? "✓" : "2"}
                        </span>
                        <span className="font-medium text-slate-700">N+2</span>
                        <span className="text-slate-400">—</span>
                        <span className={selected.second_reviewer && selected.second_reviewed_at ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                          {selected.second_reviewer
                            ? `${selected.second_reviewer.full_name}${selected.second_reviewed_at ? ` (${new Date(selected.second_reviewed_at).toLocaleDateString("fr")})` : ""}`
                            : selected.employee?.n2_manager_name ?? "Non défini"}
                        </span>
                      </div>
                    )}
                    {/* Étape 3 : RH */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                        selected.hr_reviewer ? "bg-emerald-500"
                        : selected.status === "PENDING_RH" ? "bg-blue-500 animate-pulse"
                        : "bg-slate-300"
                      }`}>
                        {selected.hr_reviewer ? "✓" : "3"}
                      </span>
                      <span className="font-medium text-slate-700">RH</span>
                      <span className="text-slate-400">—</span>
                      <span className={selected.hr_reviewer ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                        {selected.hr_reviewer
                          ? `${selected.hr_reviewer.full_name} (${selected.hr_reviewed_at ? new Date(selected.hr_reviewed_at).toLocaleDateString("fr") : ""})`
                          : "En attente"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Motif de rejet — affiché uniquement si REJECTED */}
                {selected.status === "REJECTED" && selected.reject_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs text-red-400 uppercase font-semibold mb-1 tracking-wide">
                      Motif de rejet
                    </p>
                    <p className="text-sm text-red-700 whitespace-pre-wrap">
                      {selected.reject_reason}
                    </p>
                  </div>
                )}

                {/* Zone saisie motif rejet — pour tout statut en attente */}
                {(selected.status === "PENDING" || selected.status === "PENDING_SECOND" || selected.status === "PENDING_RH") && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5 tracking-wide">
                      Motif de rejet{" "}
                      <span className="normal-case font-normal text-gray-400">
                        (obligatoire pour rejeter)
                      </span>
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

                {/* Boutons d'action modal — pour tout statut en attente */}
                {(selected.status === "PENDING" || selected.status === "PENDING_SECOND" || selected.status === "PENDING_RH") && (
                  <div className="flex gap-3 pt-1">
                    <button
                      disabled={actionLoading || !rejectReason.trim()}
                      onClick={() => handleReject(selected.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      {actionLoading && <ImSpinner2 className="animate-spin" size={13} />}
                      ✗ Rejeter
                    </button>
                    {selected.status === "PENDING_RH" ? (
                      <button
                        disabled={actionLoading}
                        onClick={() => handleApprove(selected.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                      >
                        {actionLoading && <ImSpinner2 className="animate-spin" size={13} />}
                        ✓ Valider (RH)
                      </button>
                    ) : (
                      <button
                        disabled={actionLoading}
                        onClick={() => handleApprove(selected.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                      >
                        {actionLoading && <ImSpinner2 className="animate-spin" size={13} />}
                        ✓ Approuver
                      </button>
                    )}
                  </div>
                )}
                {selected.status === "APPROVED" && (
                  <div className="pt-1">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleCancel(selected.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      {actionLoading && <ImSpinner2 className="animate-spin" size={13} />}
                      Annuler cette demande
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}