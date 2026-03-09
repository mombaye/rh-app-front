// src/pages/LeavePage.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import LeaveRequestForm from "@/components/leaves/LeaveRequestForm";
import LeaveStats       from "@/components/leaves/LeaveStats";
import LeaveBalances    from "@/components/leaves/LeaveBalances";
import LeaveCalendar    from "@/components/leaves/LeaveCalendar";
import { leaveRequestService } from "@/services/leaveService";
import { ContractType, LeaveRequest, LeaveStatus } from "@/types/leave";
import {
  FiPlus, FiChevronDown, FiX, FiRefreshCw, FiAlertCircle,
  FiList, FiBarChart2, FiCalendar, FiDatabase,
} from "react-icons/fi";
import { FaClipboardList, FaCheckCircle, FaClock } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
type Tab = "requests" | "stats" | "balances" | "calendar";

// ── Constantes ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeaveStatus, { label: string; color: string; bg: string; dotClass: string }> = {
  PENDING:   { label: "En attente", color: "#f59e0b", bg: "#fffbeb", dotClass: "bg-amber-400"   },
  APPROVED:  { label: "Approuvé",   color: "#10b981", bg: "#ecfdf5", dotClass: "bg-emerald-500" },
  REJECTED:  { label: "Rejeté",     color: "#ef4444", bg: "#fef2f2", dotClass: "bg-red-500"     },
  CANCELLED: { label: "Annulé",     color: "#64748b", bg: "#f8fafc", dotClass: "bg-slate-400"   },
};

const FILTER_OPTIONS: {
  value:       StatusFilter;
  label:       string;
  icon:        React.ReactNode;
  activeClass: string;
  btnClass:    string;
}[] = [
  {
    value: "ALL",
    label: "Toutes les demandes",
    icon:        <FaClipboardList size={13} className="text-gray-400" />,
    activeClass: "text-camublue-900 bg-camublue-900/5",
    btnClass:    "bg-white border-gray-300 text-gray-700 hover:bg-gray-50",
  },
  {
    value: "PENDING",
    label: "En attente",
    icon:        <FaClock size={13} className="text-amber-500" />,
    activeClass: "text-amber-700 bg-amber-50",
    btnClass:    "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100",
  },
  {
    value: "APPROVED",
    label: "Approuvées",
    icon:        <FaCheckCircle size={13} className="text-emerald-500" />,
    activeClass: "text-emerald-700 bg-emerald-50",
    btnClass:    "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100",
  },
  {
    value: "REJECTED",
    label: "Rejetées",
    icon:        <FaClipboardList size={13} className="text-red-400" />,
    activeClass: "text-red-700 bg-red-50",
    btnClass:    "bg-red-50 border-red-300 text-red-700 hover:bg-red-100",
  },
  {
    value: "CANCELLED",
    label: "Annulées",
    icon:        <FaClipboardList size={13} className="text-slate-400" />,
    activeClass: "text-slate-700 bg-slate-50",
    btnClass:    "bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100",
  },
];

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "requests", label: "Demandes",     icon: <FiList      size={15} /> },
  { id: "stats",    label: "Statistiques", icon: <FiBarChart2 size={15} /> },
  { id: "balances", label: "Soldes",       icon: <FiDatabase  size={15} /> },
  { id: "calendar", label: "Calendrier",   icon: <FiCalendar  size={15} /> },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function LeavePage() {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tabs
  const [activeTab,     setActiveTab]     = useState<Tab>("requests");
  const [contractType,  setContractType]  = useState<ContractType>("INTERNE");

  // Liste demandes
  const [requests,      setRequests]      = useState<LeaveRequest[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("ALL");
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [showForm,      setShowForm]      = useState(false);

  // Modal détail
  const [selected,      setSelected]      = useState<LeaveRequest | null>(null);
  const [rejectReason,  setRejectReason]  = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const currentFilter = FILTER_OPTIONS.find((o) => o.value === statusFilter)!;

  // Fermer le dropdown au clic externe
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch demandes ── GET /api/leaves/requests/
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const apiStatus = statusFilter !== "ALL" ? statusFilter : undefined;
      const data = await leaveRequestService.getAll({
        ...(apiStatus ? { status: apiStatus } : {}),
        contract_type: contractType,
      });
      setRequests(Array.isArray(data) ? data : []);
      if (!Array.isArray(data)) setFetchError("Format de réponse inattendu.");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.error ??
        "Erreur lors du chargement.";
      setFetchError(msg);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, contractType]);

  useEffect(() => {
    if (activeTab === "requests") fetchRequests();
  }, [fetchRequests, activeTab]);

  // ── Actions approve / reject / cancel ────────────────────────────────────

  const handleApprove = async (id: number) => {
    setActionLoading(true);
    try {
      await leaveRequestService.approve(id);
      toast.success("Demande approuvée ✓");
      await fetchRequests();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'approbation");
    } finally { setActionLoading(false); }
  };

  const handleReject = async (id: number) => {
    if (!rejectReason.trim()) { toast.error("Le motif de rejet est obligatoire."); return; }
    setActionLoading(true);
    try {
      await leaveRequestService.reject(id, rejectReason);
      toast.success("Demande rejetée");
      await fetchRequests();
      setSelected(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors du rejet");
    } finally { setActionLoading(false); }
  };

  const handleCancel = async (id: number) => {
    setActionLoading(true);
    try {
      await leaveRequestService.cancel(id);
      toast.success("Demande annulée");
      await fetchRequests();
      setSelected(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'annulation");
    } finally { setActionLoading(false); }
  };

  const openDetail  = (r: LeaveRequest) => { setSelected(r); setRejectReason(""); };
  const closeModal  = () => { setSelected(null); setRejectReason(""); };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <motion.div
        key={contractType}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6"
      >
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-camublue-900">
              Congés & Absences
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestion des demandes de congés et suivi des soldes
            </p>
          </div>

          {activeTab === "requests" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtre statut */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border shadow-sm font-medium transition ${currentFilter.btnClass}`}
                >
                  {currentFilter.icon}
                  {currentFilter.label}
                  <FiChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-30"
                    >
                      {FILTER_OPTIONS.map(({ value, label, icon, activeClass }) => (
                        <button
                          key={value}
                          onClick={() => { setStatusFilter(value); setDropdownOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                            statusFilter === value
                              ? `font-semibold ${activeClass}`
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {icon}
                          {label}
                          {statusFilter === value && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actualiser */}
              <button
                onClick={fetchRequests}
                disabled={loading}
                title="Actualiser"
                className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-500 transition disabled:opacity-50"
              >
                <FiRefreshCw size={15} className={loading ? "animate-spin" : ""} />
              </button>

              {/* Nouvelle demande */}
              <button
                onClick={() => setShowForm(true)}
                className="bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm font-medium"
              >
                <FiPlus size={15} />
                Nouvelle demande
              </button>
            </div>
          )}
        </div>

        {/* ── Onglets ── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 shrink-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex-1 justify-center ${
                activeTab === tab.id
                  ? "bg-white text-camublue-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Contenu ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* ── Onglet Demandes ── */}
            {activeTab === "requests" && (
              <motion.div
                key="requests"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Info compteur */}
                {!loading && !fetchError && (
                  <p className="text-sm text-gray-500 mb-3">
                    {requests.length} demande{requests.length !== 1 ? "s" : ""}
                    {statusFilter !== "ALL" && (
                      <>
                        {" "}· filtre :{" "}
                        <span className="font-medium">{currentFilter.label}</span>
                        <button
                          onClick={() => setStatusFilter("ALL")}
                          className="ml-2 text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition"
                        >
                          Réinitialiser
                        </button>
                      </>
                    )}
                  </p>
                )}

                {loading && (
                  <div className="py-24 flex flex-col items-center gap-3 text-gray-400">
                    <ImSpinner2 className="animate-spin" size={26} />
                    <p className="text-sm">Chargement des demandes…</p>
                  </div>
                )}

                {!loading && fetchError && (
                  <div className="py-24 flex flex-col items-center gap-4">
                    <FiAlertCircle size={32} className="text-red-400" />
                    <p className="text-sm font-medium text-red-500">{fetchError}</p>
                    <button
                      onClick={fetchRequests}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium transition"
                    >
                      <FiRefreshCw size={14} /> Réessayer
                    </button>
                  </div>
                )}

                {!loading && !fetchError && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {requests.length === 0 ? (
                      <div className="py-20 text-center text-gray-400">
                        <p className="text-4xl mb-3">📭</p>
                        <p className="font-medium text-sm">Aucune demande trouvée</p>
                        {statusFilter !== "ALL" && (
                          <p className="text-xs mt-1 text-gray-300">
                            Aucune demande «{currentFilter.label}»
                          </p>
                        )}
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
                              const statusKey = (r.status in STATUS_CONFIG ? r.status : "PENDING") as LeaveStatus;
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
                                  <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                                        style={{ backgroundColor: leaveColor }}
                                      >
                                        {(r.employee?.full_name ?? "??").slice(0, 2).toUpperCase()}
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

                                  <td className="px-5 py-4">
                                    <span
                                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                                      style={{ backgroundColor: leaveColor + "20", color: leaveColor }}
                                    >
                                      {r.leave_type?.label ?? "—"}
                                    </span>
                                  </td>

                                  <td className="px-5 py-4 text-gray-600 text-xs whitespace-nowrap">
                                    {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                                  </td>

                                  <td className="px-5 py-4 font-semibold text-gray-800 whitespace-nowrap">
                                    {r.days ?? r.duration_days ?? "—"}j
                                  </td>

                                  <td className="px-5 py-4">
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                                      style={{ backgroundColor: st.bg, color: st.color }}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dotClass}`} />
                                      {st.label}
                                    </span>
                                  </td>

                                  <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-2">
                                      {r.status === "PENDING" && (
                                        <>
                                          <button
                                            onClick={() => handleApprove(r.id)}
                                            disabled={actionLoading}
                                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 whitespace-nowrap"
                                          >
                                            ✓ Approuver
                                          </button>
                                          <button
                                            onClick={() => openDetail(r)}
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
                )}
              </motion.div>
            )}

            {/* ── Onglet Statistiques ── GET /api/leaves/requests/stats/summary/ */}
            {activeTab === "stats" && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <LeaveStats contractType={contractType} />
              </motion.div>
            )}

            {/* ── Onglet Soldes ── GET /api/leaves/balances/?year=Y */}
            {activeTab === "balances" && (
              <motion.div
                key="balances"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <LeaveBalances contractType={contractType} />
              </motion.div>
            )}

            {/* ── Onglet Calendrier ── GET /api/leaves/requests/calendar/?month=M&year=Y */}
            {activeTab === "calendar" && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <LeaveCalendar contractType={contractType} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Modal Détail demande ── */}
      <AnimatePresence>
        {selected && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start px-4 sm:px-8 pt-6 sm:pt-8 pb-0">
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

              <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-4">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold"
                  style={{
                    backgroundColor: STATUS_CONFIG[selected.status]?.bg ?? "#f8fafc",
                    color:           STATUS_CONFIG[selected.status]?.color ?? "#64748b",
                  }}
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selected.status]?.dotClass ?? "bg-slate-400"}`} />
                  {STATUS_CONFIG[selected.status]?.label ?? selected.status}
                </span>

                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["Employé",    selected.employee?.full_name ?? "—"],
                    ["Matricule",  selected.employee?.matricule ?? "—"],
                    ["Service",    selected.employee?.service   ?? "—"],
                    ["Manager",    selected.employee?.manager   ?? "—"],
                    ["Type",       selected.leave_type?.label   ?? "—"],
                    ["Durée",      `${selected.days ?? selected.duration_days ?? "—"}j`],
                    ["Du",         fmtDate(selected.start_date)],
                    ["Au",         fmtDate(selected.end_date)],
                    ["Soumis le",  fmtDate(selected.created_at?.slice(0, 10))],
                    ...(selected.reviewed_at
                      ? [["Traité le", fmtDate(selected.reviewed_at.slice(0, 10))]]
                      : []
                    ),
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-1">{k}</p>
                      <p className="text-sm font-semibold text-gray-800 truncate">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Motif</p>
                  <p className="text-sm text-gray-700">{selected.motif || "—"}</p>
                </div>

                {selected.status === "REJECTED" && selected.reject_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs text-red-400 uppercase font-semibold mb-1">Motif de rejet</p>
                    <p className="text-sm text-red-700">{selected.reject_reason}</p>
                  </div>
                )}

                {selected.status === "PENDING" && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
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

                {selected.status === "PENDING" && (
                  <div className="flex gap-3 pt-1">
                    <button
                      disabled={actionLoading || !rejectReason.trim()}
                      onClick={() => handleReject(selected.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      {actionLoading && <ImSpinner2 className="animate-spin" size={13} />}
                      ✗ Rejeter
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleApprove(selected.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                    >
                      {actionLoading && <ImSpinner2 className="animate-spin" size={13} />}
                      ✓ Approuver
                    </button>
                  </div>
                )}

                {selected.status === "APPROVED" && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleCancel(selected.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-semibold rounded-xl transition disabled:opacity-50"
                  >
                    {actionLoading && <ImSpinner2 className="animate-spin" size={13} />}
                    Annuler cette demande
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Nouvelle demande ── */}
      <AnimatePresence>
        {showForm && (
          <LeaveRequestForm
            contractType={contractType}
            onClose={() => setShowForm(false)}
            onSuccess={() => { setShowForm(false); fetchRequests(); }}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
