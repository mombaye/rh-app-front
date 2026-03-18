// src/pages/LeavePage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import LeaveRequestForm from "@/components/leaves/LeaveRequestForm";
import LeaveCalendar from "@/components/leaves/LeaveCalendar";
import LeaveTypeManagement from "@/components/leaves/LeaveTypeManagement";
import { leaveRequestService, leaveTypeService, leaveBalanceService } from "@/services/leaveService";
import { getEmployees } from "@/services/employeeService";
import { Employee } from "@/types/employee";
import {
  ContractType, LeaveRequest, LeaveStatus, LeaveSummary, LeaveType,
  ApprovePayload, RevokePayload, LeaveBalance,
} from "@/types/leave";
import {
  CalendarDays, RefreshCw, Plus, X, CheckCircle2, XCircle,
  Ban, RotateCcw, ChevronDown, Table2, CalendarRange,
  Download, Loader2, AlertTriangle, Clock, Pencil, Paperclip,
  FileCheck, Upload, ExternalLink, Users, Settings2, Wallet,
  Search, History, Info, Filter, Trash2, Send, FileSpreadsheet,
  CheckCircle, XOctagon,
} from "lucide-react";
import * as XLSX from "xlsx";
import { ExportColumnKey, ExportColumnDef } from "@/types/leave";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";

// ─── Config statuts ───────────────────────────────────────────────────────────
const STATUS_CFG: Record<
  LeaveStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  PENDING:        { label: "En attente",          color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "bg-amber-400"   },
  PENDING_SECOND: { label: "En att. 2ème valid.", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", dot: "bg-violet-500"  },
  APPROVED:       { label: "Approuvé",            color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", dot: "bg-emerald-500" },
  REJECTED:       { label: "Rejeté",              color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "bg-red-500"     },
  CANCELLED:      { label: "Annulé",              color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", dot: "bg-slate-400"   },
  REVOKED:        { label: "Révoqué (urgence)",   color: "#b45309", bg: "#fff7ed", border: "#fed7aa", dot: "bg-orange-500"  },
};

// ─── Colonnes disponibles pour l'export personnalisé ─────────────────────────
const EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: "id",                 label: "ID"                    },
  { key: "employee",           label: "Employé"               },
  { key: "matricule",          label: "Matricule"             },
  { key: "service",            label: "Service"               },
  { key: "leave_type",         label: "Type de congé"         },
  { key: "start_date",         label: "Date début"            },
  { key: "end_date",           label: "Date fin"              },
  { key: "days",               label: "Jours"                 },
  { key: "motif",              label: "Motif"                 },
  { key: "status",             label: "Statut"                },
  { key: "reviewed_by",        label: "Validé par (N+1)"      },
  { key: "reviewed_at",        label: "Date validation N+1"   },
  { key: "second_reviewer",    label: "Validé par (N+2)"      },
  { key: "second_reviewed_at", label: "Date validation N+2"   },
  { key: "reject_reason",      label: "Motif de rejet"        },
  { key: "revoke_reason",      label: "Motif de révocation"   },
  { key: "created_at",         label: "Date de demande"       },
];

// Sélection par défaut pour l'export
const DEFAULT_EXPORT_COLUMNS: ExportColumnKey[] = [
  "employee", "matricule", "service", "leave_type",
  "start_date", "end_date", "days", "status",
];

type TabId        = "requests" | "calendar" | "balances";
type StatusFilter = "ALL" | LeaveStatus;

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "requests", label: "Demandes",    Icon: Table2       },
  { id: "calendar", label: "Calendrier",  Icon: CalendarRange },
  { id: "balances", label: "Soldes",      Icon: Wallet       },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL",            label: "Toutes"          },
  { value: "PENDING",        label: "En attente"      },
  { value: "PENDING_SECOND", label: "2ème validation" },
  { value: "APPROVED",       label: "Approuvées"      },
  { value: "REJECTED",       label: "Rejetées"        },
  { value: "CANCELLED",      label: "Annulées"        },
  { value: "REVOKED",        label: "Révoquées"       },
];

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const p = d.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LeaveStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, onClick, active }: {
  label: string; value: number | string; sub?: string;
  color: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 min-w-[110px] rounded-2xl px-4 py-3 text-left transition-all border-2 ${
        active ? "border-current shadow-md scale-[1.02]" : "border-transparent bg-white shadow-sm hover:shadow-md hover:scale-[1.01]"
      }`}
      style={{ color, backgroundColor: active ? color + "18" : undefined }}>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5 opacity-75">{label}</p>
      {sub && <p className="text-[9px] opacity-55 mt-0.5">{sub}</p>}
    </button>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function LeavePage() {
  const [tab,          setTab]          = useState<TabId>("requests");
  const [requests,     setRequests]     = useState<LeaveRequest[]>([]);
  const [summary,      setSummary]      = useState<LeaveSummary | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [contractType, setContractType] = useState<ContractType>("INTERNE");
  const [showForm,       setShowForm]       = useState(false);
  const [showLeaveTypes, setShowLeaveTypes] = useState(false);
  const [selected,       setSelected]       = useState<LeaveRequest | null>(null);
  const [editTarget,     setEditTarget]     = useState<LeaveRequest | null>(null);
  const [filterOpen,     setFilterOpen]     = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // ── Filtres avancés ────────────────────────────────────────────────────────
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterLeaveTypeId,   setFilterLeaveTypeId]   = useState<string>("");
  const [filterStartDate,     setFilterStartDate]     = useState<string>("");
  const [filterEndDate,       setFilterEndDate]       = useState<string>("");
  const [filterDepartment,    setFilterDepartment]    = useState<string>("");
  const [filterEmployeeName,  setFilterEmployeeName]  = useState<string>("");
  const [filterYear,          setFilterYear]          = useState<string>("");
  const [availableLeaveTypes, setAvailableLeaveTypes] = useState<LeaveType[]>([]);

  // ── Export personnalisé ────────────────────────────────────────────────────
  const [showExportDialog,    setShowExportDialog]    = useState(false);
  const [exportColumns,       setExportColumns]       = useState<ExportColumnKey[]>(DEFAULT_EXPORT_COLUMNS);
  const [exportLoading,       setExportLoading]       = useState(false);

  // ── Recherche + Pagination (onglet Demandes) ──────────────────────────────
  const [searchQ,          setSearchQ]          = useState("");
  const [page,             setPage]             = useState(1);
  const [pageSize,         setPageSize]         = useState(20);
  const PAGE_SIZES = [10, 20, 50, 100] as const;

  // ── Suppression / Relance ─────────────────────────────────────────────────
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<number | null>(null);
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [relaunchRequest,  setRelaunchRequest]  = useState<LeaveRequest | null>(null);

  const advancedFilterCount = [
    filterLeaveTypeId, filterStartDate, filterEndDate,
    filterDepartment, filterEmployeeName, filterYear,
  ].filter(Boolean).length;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Charger les types de congés pour le filtre
  useEffect(() => {
    leaveTypeService.getAll().then(setAvailableLeaveTypes).catch(() => {});
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const apiStatus = statusFilter !== "ALL" ? statusFilter as LeaveStatus : undefined;
      const filters: Parameters<typeof leaveRequestService.getAll>[0] = {
        ...(apiStatus ? { status: apiStatus } : {}),
        ...(filterLeaveTypeId ? { leave_type_id: Number(filterLeaveTypeId) } : {}),
        ...(filterStartDate   ? { start_date: filterStartDate }             : {}),
        ...(filterEndDate     ? { end_date:   filterEndDate }               : {}),
        ...(filterDepartment  ? { department: filterDepartment }            : {}),
        ...(filterEmployeeName? { employee_name: filterEmployeeName }       : {}),
        ...(filterYear        ? { year: Number(filterYear) }                : {}),
      };
      const [data, sum] = await Promise.all([
        leaveRequestService.getAll(filters),
        leaveRequestService.getSummary(),
      ]);
      setRequests(Array.isArray(data) ? data : []);
      setSummary(sum);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.response?.data?.error ?? "Erreur de chargement.";
      setFetchError(msg); setRequests([]);
    } finally { setLoading(false); }
  }, [statusFilter, filterLeaveTypeId, filterStartDate, filterEndDate, filterDepartment, filterEmployeeName, filterYear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetAdvancedFilters = () => {
    setFilterLeaveTypeId(""); setFilterStartDate(""); setFilterEndDate("");
    setFilterDepartment(""); setFilterEmployeeName(""); setFilterYear("");
  };

  const handleExport = async (columns?: ExportColumnKey[]) => {
    try {
      setExportLoading(true);
      const apiStatus = statusFilter !== "ALL" ? statusFilter as LeaveStatus : undefined;
      const filters = {
        ...(apiStatus        ? { status: apiStatus }                        : {}),
        ...(filterLeaveTypeId? { leave_type_id: Number(filterLeaveTypeId) } : {}),
        ...(filterStartDate  ? { start_date: filterStartDate }              : {}),
        ...(filterEndDate    ? { end_date:   filterEndDate }                : {}),
        ...(filterDepartment ? { department: filterDepartment }             : {}),
        ...(filterEmployeeName?{ employee_name: filterEmployeeName }        : {}),
        ...(filterYear       ? { year: Number(filterYear) }                 : {}),
      };
      const blob = await leaveRequestService.exportExcel(filters, columns);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `conges_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExportLoading(false);
    }
  };

  const openDetail  = (r: LeaveRequest) => setSelected(r);
  const closeDetail = ()                 => setSelected(null);
  const afterAction = async ()           => { closeDetail(); await fetchAll(); };
  const afterEdit   = async ()           => { setEditTarget(null); await fetchAll(); };

  const currentFilterLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "Toutes";

  // ── Recherche + filtre contrat côté client ────────────────────────────────
  const filteredRequests = useMemo(() => {
    const q = searchQ.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return requests.filter((r) => {
      // Filtre Interne / Intérimaire (attendance_status === "SHIFT" → intérimaire)
      const isShift = r.employee?.attendance_status === "SHIFT";
      if (contractType === "INTERIM"  && !isShift) return false;
      if (contractType === "INTERNE"  &&  isShift) return false;

      if (!q) return true;
      const name = (r.employee?.full_name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const mat  = (r.employee?.matricule ?? "").toLowerCase();
      const svc  = (r.employee?.service ?? "").toLowerCase();
      const type = (r.leave_type?.label ?? "").toLowerCase();
      return name.includes(q) || mat.includes(q) || svc.includes(q) || type.includes(q);
    });
  }, [requests, searchQ, contractType]);

  const totalReqPages  = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const pagedRequests  = filteredRequests.slice((page - 1) * pageSize, page * pageSize);

  // Reset page sur changement de filtre/recherche
  useEffect(() => { setPage(1); }, [searchQ, contractType, statusFilter, filterLeaveTypeId, filterStartDate, filterEndDate, filterDepartment, filterEmployeeName, filterYear]);

  // ── Suppression d'une demande Annulée ────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await leaveRequestService.delete(confirmDeleteId);
      toast.success("Demande supprimée ✓");
      setConfirmDeleteId(null);
      await fetchAll();
    } catch { toast.error("Erreur lors de la suppression"); }
    finally   { setDeleteLoading(false); }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 sm:px-6 pt-5 pb-3 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-camublue-900 text-white">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-camublue-900">Congés & Absences</h1>
                <p className="text-xs text-slate-400 mt-0.5">Gestion complète des demandes de congé</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-slate-100 rounded-xl p-0.5 text-xs font-semibold">
                {(["INTERNE", "INTERIM"] as ContractType[]).map((c) => (
                  <button key={c} onClick={() => setContractType(c)}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      contractType === c ? "bg-white text-camublue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {c === "INTERNE" ? "Internes" : "Intérimaires"}
                  </button>
                ))}
              </div>

              <button onClick={() => setShowExportDialog(true)} title="Export personnalisé"
                disabled={exportLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition text-xs font-semibold disabled:opacity-50">
                {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span className="hidden sm:inline">Exporter</span>
              </button>

              <button onClick={fetchAll} disabled={loading} title="Actualiser"
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button onClick={() => setShowLeaveTypes(true)}
                title="Gérer les types de congés"
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 text-sm font-semibold transition">
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Types de congés</span>
              </button>

              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold transition shadow-sm">
                <Plus className="h-4 w-4" />Nouvelle demande
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          {summary && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
              <KpiCard label="Total"      value={summary.total}    color="#003c71" />
              <KpiCard label="En attente" value={summary.pending}  color="#d97706"
                active={statusFilter === "PENDING" || statusFilter === "PENDING_SECOND"}
                onClick={() => setStatusFilter(
                  (statusFilter === "PENDING" || statusFilter === "PENDING_SECOND") ? "ALL" : "PENDING"
                )} />
              <KpiCard label="Approuvés"  value={summary.approved} color="#059669"
                sub={`${summary.total_days_approved}j accordés`}
                active={statusFilter === "APPROVED"}
                onClick={() => setStatusFilter(statusFilter === "APPROVED" ? "ALL" : "APPROVED")} />
              <KpiCard label="Rejetés"    value={summary.rejected} color="#dc2626"
                active={statusFilter === "REJECTED"}
                onClick={() => setStatusFilter(statusFilter === "REJECTED" ? "ALL" : "REJECTED")} />
              <KpiCard label="Révoqués"   value={summary.revoked ?? 0} color="#b45309"
                active={statusFilter === "REVOKED"}
                onClick={() => setStatusFilter(statusFilter === "REVOKED" ? "ALL" : "REVOKED")} />
            </div>
          )}

          {/* Tabs + filtre */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    tab === id ? "bg-camublue-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                  }`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>

            {tab === "requests" && (
              <div className="flex items-center gap-2">
                {/* Filtre statut */}
                <div className="relative" ref={filterRef}>
                  <button onClick={() => setFilterOpen((o) => !o)}
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium transition">
                    <span className="hidden sm:inline text-xs">{currentFilterLabel}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {filterOpen && (
                      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-30">
                        {STATUS_FILTERS.map(({ value, label }) => {
                          const cfg = value === "ALL" ? null : STATUS_CFG[value as LeaveStatus];
                          return (
                            <button key={value}
                              onClick={() => { setStatusFilter(value); setFilterOpen(false); }}
                              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left ${
                                statusFilter === value ? "font-bold bg-slate-50 text-camublue-900" : "text-slate-700 hover:bg-slate-50"
                              }`}>
                              {cfg && <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />}
                              {label}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Filtres avancés */}
                <button onClick={() => setShowAdvancedFilters((o) => !o)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition font-medium ${
                    advancedFilterCount > 0
                      ? "border-camublue-300 bg-camublue-50 text-camublue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}>
                  <Filter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Filtres</span>
                  {advancedFilterCount > 0 && (
                    <span className="bg-camublue-700 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {advancedFilterCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ── Panneau de filtres avancés ─────────────────────────────────────── */}
          <AnimatePresence>
            {showAdvancedFilters && tab === "requests" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-slate-100 mt-3">
                <div className="py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Type de congé */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Type</label>
                    <select value={filterLeaveTypeId} onChange={(e) => setFilterLeaveTypeId(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300">
                      <option value="">Tous les types</option>
                      {availableLeaveTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Employé */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Employé</label>
                    <input type="text" value={filterEmployeeName}
                      onChange={(e) => setFilterEmployeeName(e.target.value)}
                      placeholder="Nom / Matricule"
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300" />
                  </div>

                  {/* Service */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Service</label>
                    <input type="text" value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      placeholder="Département"
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300" />
                  </div>

                  {/* Date début */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Début (≥)</label>
                    <input type="date" value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300" />
                  </div>

                  {/* Date fin */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Fin (≤)</label>
                    <input type="date" value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300" />
                  </div>

                  {/* Année */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Année</label>
                    <input type="number" value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                      placeholder={String(new Date().getFullYear())}
                      min="2020" max="2099"
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300" />
                  </div>
                </div>
                {advancedFilterCount > 0 && (
                  <div className="pb-2">
                    <button onClick={resetAdvancedFilters}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition font-medium">
                      <X className="h-3 w-3" />Réinitialiser les filtres
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Export Dialog ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showExportDialog && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <motion.div
                initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div>
                    <h2 className="font-black text-camublue-900 text-base">Export personnalisé</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Sélectionnez les colonnes à inclure dans l'export</p>
                  </div>
                  <button onClick={() => setShowExportDialog(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-5 py-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-semibold text-slate-500">
                      {exportColumns.length}/{EXPORT_COLUMNS.length} colonnes sélectionnées
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setExportColumns(EXPORT_COLUMNS.map((c) => c.key))}
                        className="text-xs text-camublue-700 hover:underline font-medium">Tout</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={() => setExportColumns([])}
                        className="text-xs text-slate-500 hover:underline font-medium">Aucun</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {EXPORT_COLUMNS.map((col) => {
                      const checked = exportColumns.includes(col.key);
                      return (
                        <label key={col.key}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border transition text-sm ${
                            checked ? "bg-camublue-50 border-camublue-200 text-camublue-800" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            setExportColumns((prev) =>
                              prev.includes(col.key) ? prev.filter((k) => k !== col.key) : [...prev, col.key]
                            );
                          }} className="accent-camublue-700 w-3.5 h-3.5" />
                          <span className="font-medium">{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <button onClick={() => setShowExportDialog(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      await handleExport(exportColumns.length > 0 ? exportColumns : undefined);
                      setShowExportDialog(false);
                    }}
                    disabled={exportLoading || exportColumns.length === 0}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-camublue-900 text-white text-sm font-bold hover:bg-camublue-800 disabled:opacity-50 transition">
                    {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Télécharger
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">

          {tab === "requests" && (
            <>
              {loading && (
                <div className="flex flex-col items-center gap-3 text-slate-400 py-24">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <p className="text-sm">Chargement des demandes…</p>
                </div>
              )}

              {!loading && fetchError && (
                <div className="flex flex-col items-center gap-4 py-24">
                  <AlertTriangle className="h-9 w-9 text-red-400" />
                  <p className="text-sm font-medium text-red-500">{fetchError}</p>
                  <button onClick={fetchAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium transition">
                    <RefreshCw className="h-3.5 w-3.5" />Réessayer
                  </button>
                </div>
              )}

              {!loading && !fetchError && (
                <div className="space-y-3">
                  {/* ── Barre de recherche + compteur ─────────────────────── */}
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                    <p className="text-xs text-slate-400 font-medium">
                      {filteredRequests.length} demande(s)
                      {searchQ && ` · "${searchQ}"`}
                      {filteredRequests.length > pageSize && ` · page ${page}/${totalReqPages}`}
                    </p>
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Rechercher employé, type, service…"
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition bg-white"
                      />
                      {searchQ && (
                        <button onClick={() => setSearchQ("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    {filteredRequests.length === 0 ? (
                      <div className="py-20 text-center text-slate-400">
                        <CalendarDays className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                        <p className="font-medium text-sm">Aucune demande trouvée</p>
                        {(statusFilter !== "ALL" || searchQ) && (
                          <button onClick={() => { setStatusFilter("ALL"); setSearchQ(""); }}
                            className="text-xs mt-2 text-camublue-900 underline underline-offset-2">
                            Réinitialiser les filtres
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              {["Employé", "Type de congé", "Période", "Durée", "Statut", "Justificatif", "Actions"].map((h) => (
                                <th key={h}
                                  className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {pagedRequests.map((r, i) => {
                              const lc = r.leave_type?.color ?? "#6b7280";
                              const isPending = r.status === "PENDING" || r.status === "PENDING_SECOND";
                              const needsDoc  = r.leave_type?.requires_justification && !r.justification_document;
                              return (
                                <motion.tr key={r.id}
                                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.12, delay: i * 0.02 }}
                                  onClick={() => openDetail(r)}
                                  className={`hover:bg-slate-50/80 transition cursor-pointer ${i % 2 !== 0 ? "bg-slate-50/20" : ""}`}>

                                  {/* Employé */}
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                                        style={{ backgroundColor: lc }}>
                                        {(r.employee?.full_name ?? "??").slice(0, 2).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="font-semibold text-slate-800 truncate max-w-[140px]">
                                          {r.employee?.full_name ?? "—"}
                                        </p>
                                        <p className="text-xs text-slate-400 truncate max-w-[140px]">
                                          {r.employee?.matricule} · {r.employee?.service ?? "—"}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Type */}
                                  <td className="px-4 py-3.5">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                                      style={{ backgroundColor: lc + "20", color: lc }}>
                                      {r.leave_type?.label ?? "—"}
                                    </span>
                                  </td>

                                  {/* Période */}
                                  <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap font-mono">
                                    {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                                  </td>

                                  {/* Durée */}
                                  <td className="px-4 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                                    {r.days ?? r.duration_days ?? "—"}j
                                  </td>

                                  {/* Statut */}
                                  <td className="px-4 py-3.5">
                                    <StatusBadge status={r.status} />
                                  </td>

                                  {/* Justificatif */}
                                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                    {r.leave_type?.requires_justification ? (
                                      r.justification_document ? (
                                        <a href={r.justification_document} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                                          <FileCheck className="h-3.5 w-3.5" /> Voir
                                        </a>
                                      ) : (
                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${needsDoc ? "text-amber-600" : "text-slate-400"}`}>
                                          <Paperclip className="h-3.5 w-3.5" />
                                          {needsDoc ? "Requis" : "—"}
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-xs text-slate-300">—</span>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex flex-col gap-1.5">
                                      {isPending && (
                                        <>
                                          <ApprovalStepIndicator request={r} />
                                          <button onClick={(e) => { e.stopPropagation(); setEditTarget(r); }}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-1">
                                            <Pencil className="h-3 w-3" /> Modifier
                                          </button>
                                        </>
                                      )}
                                      {r.status === "APPROVED" && (
                                        <QuickRevokeBtn request={r} onDone={fetchAll} />
                                      )}
                                      {r.status === "CANCELLED" && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(r.id); }}
                                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-1">
                                          <Trash2 className="h-3 w-3" /> Supprimer
                                        </button>
                                      )}
                                      {r.status === "REVOKED" && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setRelaunchRequest(r); }}
                                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-1">
                                          <Send className="h-3 w-3" /> Relancer
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

                  {/* ── Pagination ─────────────────────────────────────────── */}
                  {filteredRequests.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>
                          {Math.min((page - 1) * pageSize + 1, filteredRequests.length)}–{Math.min(page * pageSize, filteredRequests.length)} sur {filteredRequests.length}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>Lignes :</span>
                        {PAGE_SIZES.map((s) => (
                          <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                            className={`px-2 py-0.5 rounded-lg font-semibold transition ${pageSize === s ? "bg-camublue-900 text-white" : "hover:bg-slate-100 text-slate-500"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPage(1)} disabled={page === 1}
                          className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">«</button>
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">‹</button>
                        {Array.from({ length: totalReqPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalReqPages || Math.abs(p - page) <= 2)
                          .reduce<(number | "…")[]>((acc, p, i, arr) => {
                            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                            acc.push(p);
                            return acc;
                          }, [])
                          .map((p, i) =>
                            p === "…" ? (
                              <span key={`e${i}`} className="px-1 text-slate-400 text-xs">…</span>
                            ) : (
                              <button key={p} onClick={() => setPage(p as number)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition ${page === p ? "bg-camublue-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                                {p}
                              </button>
                            )
                          )}
                        <button onClick={() => setPage((p) => Math.min(totalReqPages, p + 1))} disabled={page === totalReqPages}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">›</button>
                        <button onClick={() => setPage(totalReqPages)} disabled={page === totalReqPages}
                          className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">»</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "calendar" && <LeaveCalendar />}

          {tab === "balances" && <BalancesTab contractType={contractType} />}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selected && <DetailModal request={selected} onClose={closeDetail} onDone={afterAction} />}
      </AnimatePresence>
      <AnimatePresence>
        {editTarget && <EditModal request={editTarget} onClose={() => setEditTarget(null)} onDone={afterEdit} />}
      </AnimatePresence>
      <AnimatePresence>
        {showForm && (
          <LeaveRequestForm contractType={contractType}
            onClose={() => setShowForm(false)}
            onSuccess={() => { setShowForm(false); fetchAll(); }} />
        )}
      </AnimatePresence>

      {/* Modal Suppression (Annulé) */}
      <ConfirmDeleteModal
        open={confirmDeleteId !== null}
        title="Supprimer cette demande ?"
        message={
          confirmDeleteId !== null
            ? <>La demande <strong>#{confirmDeleteId}</strong> sera <strong>définitivement supprimée</strong>. Cette action est irréversible.</>
            : null
        }
        onClose={() => !deleteLoading && setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />

      {/* Modal Relancer (Révoqué) */}
      <AnimatePresence>
        {relaunchRequest && (
          <RelaunchModal
            request={relaunchRequest}
            onClose={() => setRelaunchRequest(null)}
            onDone={() => { setRelaunchRequest(null); fetchAll(); }}
          />
        )}
      </AnimatePresence>

      {/* Modal Gestion des types de congés */}
      <AnimatePresence>
        {showLeaveTypes && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => setShowLeaveTypes(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{ opacity: 0, scale: 0.97,    y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-50 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header modal */}
              <div className="shrink-0 flex items-center justify-between px-6 pt-5 pb-4 bg-white rounded-t-3xl border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-camublue-900 text-white">
                    <Settings2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-800 text-base">Types de congés</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Configurez les types avant de créer une demande</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLeaveTypes(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Contenu scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <LeaveTypeManagement />
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Les types configurés ici seront disponibles lors de la création d'une demande.
                </p>
                <button
                  onClick={() => { setShowLeaveTypes(false); setShowForm(true); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold rounded-xl transition whitespace-nowrap ml-4"
                >
                  <Plus className="h-4 w-4" />
                  Nouvelle demande
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

// ─── Onglet Soldes de congés ──────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function BalancesTab({ contractType }: { contractType: ContractType }) {
  const [balances,     setBalances]     = useState<LeaveBalance[]>([]);
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [historyEmp,   setHistoryEmp]   = useState<{ id: number; name: string } | null>(null);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState<typeof PAGE_SIZE_OPTIONS[number]>(20);
  const [importOpen,   setImportOpen]   = useState(false);
  const currentYear = new Date().getFullYear();
  const todayDay    = new Date().getDate();
  const isMonthStart = todayDay <= 5;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bals, emps] = await Promise.all([
        leaveBalanceService.getAll(currentYear),
        getEmployees({ status: "ACTIVE" }),
      ]);
      setBalances(bals);
      setEmployees(emps);
    } catch { toast.error("Erreur lors du chargement des soldes"); }
    finally { setLoading(false); }
  }, [currentYear]);

  useEffect(() => { load(); }, [load]);

  const empMap = useMemo(() => {
    const m = new Map<number, Employee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return balances.filter((b) => {
      // Soldes : uniquement les types avec accrual mensuel (Congé Payé).
      // Les autres (Congé Mariage, Maladie…) s'affichent uniquement dans l'Historique.
      if (parseFloat(b.leave_type.monthly_accrual) <= 0) return false;
      const emp = empMap.get(b.employee);
      if (!emp) return false;
      if (contractType === "INTERIM" ? emp.attendance_status !== "SHIFT" : emp.attendance_status === "SHIFT") return false;
      if (!q) return true;
      const name = b.employee_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const mat  = (emp.matricule ?? "").toLowerCase();
      return name.includes(q) || mat.includes(q);
    });
  }, [balances, empMap, contractType, searchQuery]);

  // Reset to page 1 whenever the filtered list changes
  useEffect(() => { setPage(1); }, [filtered.length, searchQuery, contractType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading)
    return (
      <div className="p-10 flex justify-center">
        <ImSpinner2 className="animate-spin text-camublue-900" size={24} />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Bannière début de mois */}
      {isMonthStart && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
          <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800 font-semibold">
            Début du mois — <span className="font-black">+2 jours</span> de congé ont été automatiquement crédités
            à tous les employés actifs.
          </p>
        </div>
      )}

      {/* Header + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="font-bold text-slate-800">Soldes de congés — {currentYear}</p>
          <p className="text-xs text-slate-400">
            {filtered.length} enregistrement(s)
            {filtered.length > pageSize && ` · page ${page}/${totalPages}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Importer Excel
          </button>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher un employé…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition bg-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employé</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type de congé</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Acquis</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Pris</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Solde</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                    {searchQuery ? "Aucun résultat pour cette recherche" : "Aucun solde trouvé pour ce type d'employé"}
                  </td>
                </tr>
              )}
              {paginated.map((b) => {
                const remaining = parseFloat(b.remaining);
                const isLow     = remaining <= 2;
                const emp       = empMap.get(b.employee);
                return (
                  <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{b.employee_name}</p>
                      {emp && (
                        <p className="text-[10px] text-slate-400">
                          {emp.matricule}{emp.fonction ? ` · ${emp.fonction}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: (b.leave_type.color ?? "#6b7280") + "20", color: b.leave_type.color ?? "#6b7280" }}>
                        {b.leave_type.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">{b.acquired}j</td>
                    <td className="px-4 py-3 text-center font-semibold text-red-500">{b.taken}j</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-black tabular-nums text-base ${isLow ? "text-red-500" : "text-emerald-600"}`}>
                        {b.remaining}j
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setHistoryEmp({ id: b.employee, name: b.employee_name })}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition flex items-center gap-1 mx-auto">
                        <History className="h-3 w-3" /> Historique
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          {/* Info + taille de page */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} sur {filtered.length}
            </span>
            <span className="text-slate-300">|</span>
            <span>Lignes par page :</span>
            {PAGE_SIZE_OPTIONS.map((s) => (
              <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                className={`px-2 py-0.5 rounded-lg font-semibold transition ${
                  pageSize === s
                    ? "bg-camublue-900 text-white"
                    : "hover:bg-slate-100 text-slate-500"
                }`}>
                {s}
              </button>
            ))}
          </div>

          {/* Contrôles page */}
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">
              «
            </button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">
              ‹
            </button>

            {/* Pages proches */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-1 text-slate-400 text-xs">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                      page === p
                        ? "bg-camublue-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}>
                    {p}
                  </button>
                )
              )
            }

            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">
              ›
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-2 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition">
              »
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {historyEmp && (
          <LeaveHistoryModal
            employeeId={historyEmp.id}
            employeeName={historyEmp.name}
            onClose={() => setHistoryEmp(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importOpen && (
          <ImportBalancesModal
            onClose={() => setImportOpen(false)}
            onImported={() => { setImportOpen(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Modal Import Excel Soldes ────────────────────────────────────────────────
function ImportBalancesModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file,       setFile]       = useState<File | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [result,     setResult]     = useState<{ created: number; updated: number; errors: { row: number; matricule: string; message: string }[] } | null>(null);

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls)$/i)) { toast.error("Fichier Excel (.xlsx / .xls) requis."); return; }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await leaveBalanceService.bulkImport(file);
      setResult(res);
      if (res.errors.length === 0) {
        toast.success(`Import réussi — ${res.created} créé(s), ${res.updated} mis à jour.`);
        onImported();
      } else {
        toast.success(`Import terminé — ${res.created + res.updated} traité(s), ${res.errors.length} erreur(s).`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'import.");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["MATRICULE", "TYPE_CONGE", "ACQUIS"],
      ["EMP001", "CONGE_PAYE", 24],
      ["EMP002", "CONGE_PAYE", 18],
    ]);
    ws["!cols"] = [{ wch: 16 }, { wch: 20 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Soldes");
    XLSX.writeFile(wb, "template_soldes_conges.xlsx");
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Importer les soldes acquis</h3>
              <p className="text-xs text-slate-500">Fichier Excel avec MATRICULE, TYPE_CONGE, ACQUIS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Zone de dépôt / sélection */}
          <div
            className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                <div className="text-left">
                  <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} Ko</p>
                </div>
                <button className="ml-2 text-slate-400 hover:text-red-500 transition" onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Glissez un fichier Excel ici</p>
                <p className="text-xs text-slate-400 mt-1">ou cliquez pour parcourir (.xlsx, .xls)</p>
              </div>
            )}
          </div>

          {/* Format attendu */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Format attendu</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-slate-500">
                  <th className="text-left pr-4 py-1 font-semibold">MATRICULE</th>
                  <th className="text-left pr-4 py-1 font-semibold">TYPE_CONGE</th>
                  <th className="text-left py-1 font-semibold">ACQUIS</th>
                </tr></thead>
                <tbody className="text-slate-700 font-mono">
                  <tr><td className="pr-4">EMP001</td><td className="pr-4">CONGE_PAYE</td><td>24</td></tr>
                  <tr><td className="pr-4">EMP002</td><td className="pr-4">CONGE_PAYE</td><td>18.5</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400">TYPE_CONGE correspond au <strong>code</strong> du type de congé.</p>
          </div>

          {/* Résultats */}
          {result && (
            <div className="space-y-2">
              <div className="flex gap-3">
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-emerald-700">{result.created + result.updated}</p>
                  <p className="text-xs text-emerald-600 font-semibold mt-0.5">Traités ({result.created} créés, {result.updated} mis à jour)</p>
                </div>
                {result.errors.length > 0 && (
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-red-600">{result.errors.length}</p>
                    <p className="text-xs text-red-500 font-semibold mt-0.5">Erreur(s)</p>
                  </div>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <XOctagon className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      <span className="text-red-700"><strong>Ligne {err.row}</strong>{err.matricule ? ` (${err.matricule})` : ""} — {err.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition">
            <Download className="h-4 w-4" /> Télécharger le modèle
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2 rounded-xl transition disabled:opacity-50"
          >
            {uploading ? <ImSpinner2 className="animate-spin" size={14} /> : <Upload className="h-4 w-4" />}
            {uploading ? "Import en cours…" : "Importer"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal Historique de congés d'un employé ─────────────────────────────────
function LeaveHistoryModal({ employeeId, employeeName, onClose }: {
  employeeId: number; employeeName: string; onClose: () => void;
}) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    leaveRequestService.getByEmployee(employeeId)
      .then(setRequests)
      .catch(() => toast.error("Erreur lors du chargement de l'historique"))
      .finally(() => setLoading(false));
  }, [employeeId]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        <div className="shrink-0 flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100">
              <History className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="font-black text-slate-800">Historique des congés</p>
              <p className="text-xs text-slate-400">{employeeName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <ImSpinner2 className="animate-spin text-camublue-900" size={22} />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">Aucun congé enregistré pour cet employé.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => {
                const cfg = STATUS_CFG[req.status] ?? STATUS_CFG.PENDING;
                const totalDays = parseFloat(req.days ?? req.duration_days ?? "0");
                return (
                  <div key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border border-slate-100 rounded-2xl px-4 py-3 bg-slate-50 hover:bg-white transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {req.leave_type && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold"
                            style={{ backgroundColor: (req.leave_type.color ?? "#6b7280") + "20", color: req.leave_type.color ?? "#6b7280" }}>
                            {req.leave_type.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {fmtDate(req.start_date)} → {fmtDate(req.end_date)}
                        <span className="ml-2 text-xs font-normal text-slate-400">({totalDays}j)</span>
                      </p>
                      {req.motif && <p className="text-xs text-slate-400 mt-0.5 truncate">{req.motif}</p>}
                      {req.status === "REVOKED" && req.days_remaining_at_revocation != null && (
                        <p className="text-xs text-orange-600 font-semibold mt-0.5">
                          Révoqué · {req.days_remaining_at_revocation}j restitués
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 shrink-0">{fmtDate(req.created_at?.slice(0, 10))}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Bouton de révocation rapide (depuis la liste des demandes) ───────────────
function QuickRevokeBtn({ request, onDone }: { request: LeaveRequest; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-1">
        <RotateCcw className="h-3 w-3" /> Révoquer
      </button>
      <AnimatePresence>
        {open && (
          <QuickRevokeModal
            request={request}
            onClose={() => setOpen(false)}
            onDone={() => { setOpen(false); onDone(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Modal de révocation rapide ───────────────────────────────────────────────
function QuickRevokeModal({ request: r, onClose, onDone }: {
  request: LeaveRequest; onClose: () => void; onDone: () => void;
}) {
  const [revokeReason, setRevokeReason] = useState("");
  const [recallDate,   setRecallDate]   = useState(new Date().toISOString().slice(0, 10));
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<{ daysRestored: number; daysTaken: number; total: number } | null>(null);

  const totalDays = parseFloat(r.days ?? r.duration_days ?? "0");

  const handleRevoke = async () => {
    if (!revokeReason.trim()) { toast.error("Le motif est obligatoire."); return; }
    setLoading(true);
    try {
      const res = await leaveRequestService.revoke(r.id, { revoke_reason: revokeReason, recall_date: recallDate });
      const restored = parseFloat(String(res.days_restored ?? res.days_remaining_at_revocation ?? 0));
      const taken    = Math.max(0, totalDays - restored);
      setResult({ daysRestored: restored, daysTaken: taken, total: totalDays });
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la révocation");
    } finally { setLoading(false); }
  };

  // Date bounds: must be between start and end of leave
  const minDate = r.start_date;
  const maxDate = r.end_date;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-[480px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-orange-100 bg-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-200/60">
              <AlertTriangle className="h-4 w-4 text-orange-700" />
            </div>
            <div>
              <p className="font-black text-orange-900">Révocation d'urgence</p>
              <p className="text-xs text-orange-700">{r.employee?.full_name ?? "—"} · #{r.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-orange-100 text-orange-400 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Résumé du congé */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Début</p>
              <p className="text-sm font-bold text-slate-700">{fmtDate(r.start_date)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Fin</p>
              <p className="text-sm font-bold text-slate-700">{fmtDate(r.end_date)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Durée</p>
              <p className="text-sm font-bold text-slate-700">{totalDays}j</p>
            </div>
          </div>

          {result ? (
            /* ── Résultat de la révocation ── */
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <p className="text-sm font-black text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Congé révoqué avec succès
                </p>
                <div className="grid grid-cols-2 gap-2 text-center mt-2">
                  <div className="bg-white rounded-xl p-3 border border-emerald-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Jours pris</p>
                    <p className="font-black text-slate-700 text-xl">{result.daysTaken}j</p>
                  </div>
                  <div className="bg-emerald-100 rounded-xl p-3 border border-emerald-200">
                    <p className="text-[10px] text-emerald-700 uppercase font-bold mb-0.5">Restitués</p>
                    <p className="font-black text-emerald-700 text-xl">{result.daysRestored}j</p>
                  </div>
                </div>
                {result.daysRestored > 0 && (
                  <p className="text-xs text-emerald-700 font-semibold mt-2">
                    L'employé peut soumettre une nouvelle demande de{" "}
                    <strong>{result.daysRestored}j</strong> pour compléter son congé.
                  </p>
                )}
              </div>
              <button onClick={onClose}
                className="w-full py-2.5 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition">
                Fermer
              </button>
            </div>
          ) : (
            /* ── Formulaire de révocation ── */
            <>
              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                L'employé est rappelé d'urgence. Les jours restants depuis la date de rappel
                seront restitués automatiquement dans son solde.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                  Date de rappel effectif <span className="text-red-500">*</span>
                </label>
                <input type="date" value={recallDate}
                  onChange={(e) => setRecallDate(e.target.value)}
                  min={minDate} max={maxDate}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 transition" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                  Motif de révocation <span className="text-red-500">*</span>
                </label>
                <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Situation d'urgence nécessitant l'intervention de l'employé…" rows={3}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 resize-none transition" />
              </div>
              <div className="flex gap-3">
                <button onClick={onClose}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition">
                  Annuler
                </button>
                <button onClick={handleRevoke} disabled={loading || !revokeReason.trim()}
                  className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <ImSpinner2 className="animate-spin" size={13} /> : <RotateCcw className="h-4 w-4" />}
                  Confirmer la révocation
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Calcul des étapes d'approbation ─────────────────────────────────────────
/**
 * Étapes du workflow :
 *   1. Justificatif   (si leave_type.requires_justification)
 *   2. Approbation N+1 (toujours)
 *   3. Approbation N+2  (si employee.requires_two_approvals)
 *
 * Retourne : { steps, currentStep, blocked, blockReason }
 */
function useApprovalSteps(r: LeaveRequest) {
  const requiresDoc  = r.leave_type?.requires_justification ?? false;
  const hasDoc       = !!r.justification_document;
  const needsTwo     = r.employee?.requires_two_approvals ?? false;
  const isSecond     = r.status === "PENDING_SECOND";

  // Build step list
  const steps: Array<{ label: string; done: boolean; current: boolean }> = [];

  // Step: justificatif
  if (requiresDoc) {
    const docDone = hasDoc;
    steps.push({ label: "Justificatif", done: docDone, current: !docDone });
  }

  // Step: N+1
  const n1Done = isSecond || false;
  const n1Current = !isSecond && (requiresDoc ? hasDoc : true);
  steps.push({ label: needsTwo ? "N+1" : "Approbation", done: n1Done, current: n1Current });

  // Step: N+2
  if (needsTwo) {
    steps.push({ label: "N+2", done: false, current: isSecond });
  }

  // Is approval blocked?
  // Blocked when: doc required but missing, OR 2-level flow but N+1 not yet done
  const blockedByDoc  = requiresDoc && !hasDoc;
  const blockedByN1   = needsTwo && !isSecond;   // N+1 must validate first
  const blocked       = blockedByDoc || blockedByN1;
  const blockReason   = blockedByDoc
    ? "Justificatif manquant — l'employé doit fournir le document avant approbation"
    : blockedByN1
      ? "En attente de validation N+1 — la hiérarchie doit valider avant que le RH puisse agir"
      : "";

  const currentStepNum = steps.findIndex((s) => s.current) + 1;
  const totalSteps     = steps.length;

  return { steps, currentStepNum, totalSteps, blocked, blockReason, needsTwo, isSecond };
}

// ─── Indicateur d'étapes (affiché au-dessus des boutons) ─────────────────────
function ApprovalStepIndicator({ request: r }: { request: LeaveRequest }) {
  const { steps, currentStepNum, totalSteps, blocked } = useApprovalSteps(r);
  if (steps.length <= 1 && !blocked) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((s, i) => (
        <span key={i}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${
            s.done    ? "bg-emerald-100 text-emerald-700" :
            s.current ? (blocked && i === 0 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700") :
                        "bg-slate-100 text-slate-400"
          }`}>
          {s.done ? "✓" : s.current ? (i + 1) : "·"}
          {" "}{s.label}
        </span>
      ))}
      {totalSteps > 1 && (
        <span className="text-[10px] text-slate-400 font-medium ml-0.5">
          {currentStepNum}/{totalSteps}
        </span>
      )}
    </div>
  );
}

// ─── Bouton d'approbation (étape-aware, grisé si prérequis non remplis) ───────
function QuickApproveBtn({
  request,
  onDone,
  onOpenDetail,
}: {
  request: LeaveRequest;
  onDone: () => void;
  onOpenDetail: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { blocked, blockReason, needsTwo, isSecond } = useApprovalSteps(request);

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (blocked) return;
    // Flux 2 niveaux au 1er passage → ouvrir le modal détail pour choisir le N+2
    if (needsTwo && !isSecond) {
      onOpenDetail();
      return;
    }
    setLoading(true);
    try {
      await leaveRequestService.approve(request.id);
      toast.success(isSecond ? "2ème validation effectuée ✓" : "Demande approuvée ✓");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'approbation");
    } finally { setLoading(false); }
  };

  const label = needsTwo && !isSecond ? "Valider N+1" : isSecond ? "Valider N+2" : "Approuver";
  const Icon  = needsTwo && !isSecond ? Users : CheckCircle2;

  return (
    <button
      onClick={handle}
      disabled={loading || blocked}
      title={blocked ? blockReason : label}
      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
        blocked
          ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
          : needsTwo && !isSecond
            ? "bg-violet-50 hover:bg-violet-100 text-violet-700"
            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
      }`}>
      {loading
        ? <ImSpinner2 className="animate-spin" size={11} />
        : blocked
          ? <AlertTriangle className="h-3 w-3" />
          : <Icon className="h-3 w-3" />
      }
      {blocked ? "En attente" : label}
    </button>
  );
}

// ─── Modal Relancer (REVOKED only) ────────────────────────────────────────────
function RelaunchModal({ request: r, onClose, onDone }: {
  request: LeaveRequest; onClose: () => void; onDone: () => void;
}) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [form, setForm] = useState({
    leave_type_id: String(r.leave_type?.id ?? ""),
    start_date:    r.start_date,
    end_date:      r.end_date,
    days:          r.days ?? r.duration_days ?? "",
    motif:         r.motif ?? "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    leaveTypeService.getAll().then(setLeaveTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.start_date && form.end_date) {
      const s = new Date(form.start_date), e = new Date(form.end_date);
      if (e >= s) {
        const diff = Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
        setForm((f) => ({ ...f, days: String(diff) }));
      }
    }
  }, [form.start_date, form.end_date]);

  const handleSubmit = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error("Tous les champs sont requis.");
      return;
    }
    setLoading(true);
    try {
      await leaveRequestService.create({
        employee_id:   r.employee.id,
        leave_type_id: parseInt(form.leave_type_id, 10),
        start_date:    form.start_date,
        end_date:      form.end_date,
        days:          parseFloat(form.days),
        motif:         form.motif.trim(),
      });
      toast.success("Nouvelle demande soumise ✓");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la soumission");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 pt-5 pb-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-600" />
            <p className="font-black text-slate-800">Relancer la demande</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
            Basé sur la demande <strong>#{r.id}</strong> de <strong>{r.employee?.full_name}</strong>.
            Modifiez les dates si nécessaire puis soumettez.
          </div>

          {/* Employé (read-only) */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Employé</label>
            <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-600">
              {r.employee?.full_name} · {r.employee?.matricule}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Type de congé</label>
            <select value={form.leave_type_id}
              onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition">
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Date début</label>
              <input type="date" value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Date fin</label>
              <input type="date" value={form.end_date} min={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
            </div>
          </div>

          {form.days && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-700 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Durée calculée : {form.days} jour(s) calendaires
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Motif</label>
            <textarea value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))}
              rows={3} placeholder="Motif de la demande…"
              className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 resize-none transition" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-[2] bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <ImSpinner2 className="animate-spin" size={14} /> : <Send className="h-4 w-4" />}
              Soumettre la demande
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal Modifier (PENDING only) ───────────────────────────────────────────
function EditModal({ request: r, onClose, onDone }: {
  request: LeaveRequest; onClose: () => void; onDone: () => void;
}) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [form, setForm] = useState({
    leave_type_id: String(r.leave_type?.id ?? ""),
    start_date:    r.start_date,
    end_date:      r.end_date,
    days:          r.days ?? r.duration_days ?? "",
    motif:         r.motif ?? "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    leaveTypeService.getAll().then(setLeaveTypes).catch(() => {});
    // Recalcul jours si dates changent
  }, []);

  useEffect(() => {
    if (form.start_date && form.end_date) {
      const s = new Date(form.start_date), e = new Date(form.end_date);
      if (e >= s) {
        const diff = Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
        setForm((f) => ({ ...f, days: String(diff) }));
      }
    }
  }, [form.start_date, form.end_date]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await leaveRequestService.updatePending(r.id, {
        leave_type_id: parseInt(form.leave_type_id, 10),
        start_date:    form.start_date,
        end_date:      form.end_date,
        days:          parseFloat(form.days),
        motif:         form.motif.trim(),
      });
      toast.success("Demande modifiée ✓");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la modification");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 pt-5 pb-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-camublue-900" />
            <p className="font-black text-slate-800">Modifier la demande #{r.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Type de congé</label>
            <select value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition">
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Date début</label>
              <input type="date" value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Date fin</label>
              <input type="date" value={form.end_date} min={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition" />
            </div>
          </div>

          {form.days && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm font-semibold text-blue-700 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Durée calculée : {form.days} jour(s) calendaires
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Motif</label>
            <textarea value={form.motif} onChange={(e) => setForm((f) => ({ ...f, motif: e.target.value }))}
              rows={3} placeholder="Motif de la demande…"
              className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 resize-none transition" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition">
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-[2] bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <ImSpinner2 className="animate-spin" size={14} /> : <CheckCircle2 className="h-4 w-4" />}
              Enregistrer les modifications
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal Détail + Actions ───────────────────────────────────────────────────
function DetailModal({ request: r, onClose, onDone }: {
  request: LeaveRequest; onClose: () => void; onDone: () => void;
}) {
  const [actionLoading,    setActionLoading]    = useState(false);
  const [rejectReason,     setRejectReason]     = useState("");
  const [secondApproverId, setSecondApproverId] = useState<string>("");
  const [approverSearch,   setApproverSearch]   = useState("");
  const [allEmployees,     setAllEmployees]      = useState<Employee[]>([]);
  const [showApproverList, setShowApproverList] = useState(false);
  const [revokeReason,     setRevokeReason]     = useState("");
  const [recallDate,       setRecallDate]       = useState(new Date().toISOString().slice(0, 10));
  const [showRevoke,       setShowRevoke]       = useState(false);
  const [docFile,          setDocFile]          = useState<File | null>(null);
  const [docLoading,       setDocLoading]       = useState(false);
  const fileRef          = useRef<HTMLInputElement>(null);
  const approverRef      = useRef<HTMLDivElement>(null);

  // Charger les employés actifs pour le sélecteur de 2ème approbateur
  useEffect(() => {
    if (r.status === "PENDING") {
      getEmployees({ status: "ACTIVE" })
        .then(setAllEmployees)
        .catch(() => {});
    }
  }, [r.status]);

  // Fermer dropdown approbateur au clic extérieur
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (approverRef.current && !approverRef.current.contains(e.target as Node)) {
        setShowApproverList(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const run = async (fn: () => Promise<void>, msg: string) => {
    setActionLoading(true);
    try { await fn(); toast.success(msg); onDone(); }
    catch (err: any) { toast.error(err?.response?.data?.error ?? "Erreur"); }
    finally { setActionLoading(false); }
  };

  const handleApprove = (payload?: ApprovePayload) =>
    run(() => leaveRequestService.approve(r.id, payload).then(() => {}), "Demande approuvée ✓");

  const handleReject = () => {
    if (!rejectReason.trim()) { toast.error("Le motif de rejet est obligatoire."); return; }
    run(() => leaveRequestService.reject(r.id, rejectReason).then(() => {}), "Demande rejetée");
  };

  const handleCancel = () =>
    run(() => leaveRequestService.cancel(r.id).then(() => {}), "Demande annulée");

  const handleRevoke = async () => {
    if (!revokeReason.trim()) { toast.error("Le motif de révocation est obligatoire."); return; }
    setActionLoading(true);
    try {
      const payload: RevokePayload = { revoke_reason: revokeReason, recall_date: recallDate };
      const res = await leaveRequestService.revoke(r.id, payload);
      const daysRestored = res.days_restored ?? res.days_remaining_at_revocation;
      const msg = daysRestored && parseFloat(String(daysRestored)) > 0
        ? `Congé révoqué — ${daysRestored}j restitués dans le solde ✓`
        : "Congé révoqué ✓";
      toast.success(msg);
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la révocation");
    } finally { setActionLoading(false); }
  };

  const handleUploadDoc = async () => {
    if (!docFile) return;
    setDocLoading(true);
    try {
      await leaveRequestService.uploadDocument(r.id, docFile);
      toast.success("Justificatif envoyé ✓");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'envoi");
    } finally { setDocLoading(false); }
  };

  const isPending = r.status === "PENDING" || r.status === "PENDING_SECOND";
  const lc        = r.leave_type?.color ?? "#6b7280";
  const needsDoc  = r.leave_type?.requires_justification;

  // (RH ne peut pas approuver — approbation réservée aux managers)

  const infoRows: [string, string][] = [
    ["Employé",   r.employee?.full_name ?? "—"],
    ["Matricule", r.employee?.matricule ?? "—"],
    ["Service",   r.employee?.service ?? "—"],
    ["Manager",   r.employee?.manager ?? "—"],
    ["Type",      r.leave_type?.label ?? "—"],
    ["Durée",     `${r.days ?? r.duration_days ?? "—"} jour(s)`],
    ["Du",        fmtDate(r.start_date)],
    ["Au",        fmtDate(r.end_date)],
    ["Soumis le", fmtDate(r.created_at?.slice(0, 10))],
    ...(r.reviewed_by     ? [["Validé par",      r.reviewed_by.full_name]]             as [string,string][] : []),
    ...(r.reviewed_at     ? [["1ère valid.",      fmtDate(r.reviewed_at.slice(0,10))]]  as [string,string][] : []),
    ...(r.second_reviewer ? [["2ème validateur",  r.second_reviewer.full_name]]         as [string,string][] : []),
    ...(r.revoked_at      ? [["Révoqué le",       fmtDate(r.revoked_at.slice(0,10))]]  as [string,string][] : []),
    ...(r.revoked_by      ? [["Révoqué par",      r.revoked_by.full_name]]              as [string,string][] : []),
    ...(r.days_remaining_at_revocation != null
        ? [["Jours restitués", `${r.days_remaining_at_revocation}j`]] as [string,string][] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-[560px] max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 pt-5 pb-4 flex items-start justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white"
              style={{ backgroundColor: lc }}>
              {(r.employee?.full_name ?? "??").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-black text-slate-800">{r.employee?.full_name ?? "—"}</p>
              <p className="text-xs text-slate-400">Demande #{r.id}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Badges statut + type */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={r.status} />
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
              style={{ backgroundColor: lc + "20", color: lc }}>
              {r.leave_type?.label}
            </span>
            {needsDoc && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                r.justification_document ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}>
                {r.justification_document
                  ? <><FileCheck className="h-3 w-3" /> Justificatif fourni</>
                  : <><Paperclip className="h-3 w-3" /> Justificatif requis</>
                }
              </span>
            )}
          </div>

          {/* Grille d'infos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {infoRows.map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{k}</p>
                <p className="text-sm font-semibold text-slate-800 truncate" title={v}>{v}</p>
              </div>
            ))}
          </div>

          {/* Motif */}
          {r.motif && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Motif</p>
              <p className="text-sm text-slate-700">{r.motif}</p>
            </div>
          )}

          {/* ── Section Justificatif ─────────────────────────────────────────── */}
          {needsDoc && (
            <div className={`rounded-2xl border-2 p-4 space-y-3 ${
              r.justification_document ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
            }`}>
              <p className={`text-sm font-bold flex items-center gap-2 ${
                r.justification_document ? "text-emerald-700" : "text-amber-700"
              }`}>
                {r.justification_document
                  ? <><FileCheck className="h-4 w-4" /> Document justificatif fourni</>
                  : <><Paperclip className="h-4 w-4" /> Document justificatif requis</>
                }
              </p>
              <p className={`text-xs ${r.justification_document ? "text-emerald-600" : "text-amber-600"}`}>
                Ce type de congé ({r.leave_type?.label}) nécessite un justificatif (acte de mariage, de naissance, certificat…)
              </p>

              {r.justification_document ? (
                <a href={r.justification_document} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition">
                  <ExternalLink className="h-3.5 w-3.5" /> Ouvrir le document
                </a>
              ) : (
                <div className="space-y-2">
                  <div
                    className="border-2 border-dashed border-amber-300 rounded-xl p-4 text-center cursor-pointer hover:bg-amber-50/50 transition"
                    onClick={() => fileRef.current?.click()}>
                    <Upload className="h-6 w-6 mx-auto text-amber-400 mb-1" />
                    <p className="text-xs text-amber-600 font-semibold">
                      {docFile ? docFile.name : "Cliquer pour sélectionner un fichier (PDF, JPEG, PNG — max 5 Mo)"}
                    </p>
                  </div>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                  {docFile && (
                    <button onClick={handleUploadDoc} disabled={docLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                      {docLoading ? <ImSpinner2 className="animate-spin" size={13} /> : <Upload className="h-4 w-4" />}
                      Envoyer le justificatif
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reject reason (lecture) */}
          {r.status === "REJECTED" && r.reject_reason && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-[10px] text-red-500 uppercase font-bold mb-1">Motif du rejet</p>
              <p className="text-sm text-red-700">{r.reject_reason}</p>
            </div>
          )}

          {/* Revoke info (lecture) */}
          {r.status === "REVOKED" && r.revoke_reason && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
              <p className="text-[10px] text-orange-500 uppercase font-bold mb-1">Motif de révocation</p>
              <p className="text-sm text-orange-800">{r.revoke_reason}</p>
              {r.days_remaining_at_revocation != null && (
                <p className="text-xs text-emerald-600 font-bold mt-1.5">
                  ✓ {r.days_remaining_at_revocation}j restitués dans le solde
                </p>
              )}
            </div>
          )}

          {/* ── Actions PENDING / PENDING_SECOND ──────────────────────────────── */}
          {isPending && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Clock className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">En attente de validation manager</p>
                  <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                    Cette demande suit le circuit d'approbation des managers (N+1 puis N+2 si applicable).
                    Le RH ne peut pas approuver ou rejeter — seul le manager concerné peut valider.
                  </p>
                </div>
              </div>

              {r.status === "PENDING" && (
                <div ref={approverRef} className="hidden">

                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
                    2ème approbateur (N+2){" "}
                    <span className="normal-case font-normal text-slate-400">
                      — laisser vide pour approbation directe (1 niveau)
                    </span>
                  </label>

                  {/* Champ de recherche + dropdown */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Rechercher un employé…"
                      value={approverSearch}
                      onChange={(e) => {
                        setApproverSearch(e.target.value);
                        setShowApproverList(true);
                        if (!e.target.value.trim()) setSecondApproverId("");
                      }}
                      onFocus={() => setShowApproverList(true)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition"
                    />
                    {/* Sélection actuelle affichée */}
                    {secondApproverId && !showApproverList && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-lg font-bold">
                        ID&nbsp;{secondApproverId}
                      </span>
                    )}

                    {/* Dropdown résultats */}
                    <AnimatePresence>
                      {showApproverList && (
                        <motion.ul
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                          className="absolute z-40 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                        >
                          {/* Option : aucun (approbation directe) */}
                          <li
                            onClick={() => {
                              setSecondApproverId("");
                              setApproverSearch("");
                              setShowApproverList(false);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 text-slate-500 italic border-b border-slate-100"
                          >
                            <XCircle className="h-3.5 w-3.5 text-slate-300" />
                            Approbation directe (1 niveau)
                          </li>

                          {allEmployees
                            .filter((emp) => {
                              if (!approverSearch.trim()) return true;
                              const q = approverSearch.toLowerCase();
                              return (
                                emp.nom.toLowerCase().includes(q) ||
                                emp.prenom.toLowerCase().includes(q) ||
                                emp.matricule.toLowerCase().includes(q) ||
                                (emp.service ?? "").toLowerCase().includes(q)
                              );
                            })
                            .filter((emp) => emp.id !== r.employee?.id) // exclure l'employé lui-même
                            .slice(0, 40)
                            .map((emp) => (
                              <li
                                key={emp.id}
                                onClick={() => {
                                  setSecondApproverId(String(emp.id));
                                  setApproverSearch(`${emp.nom} ${emp.prenom} — ${emp.matricule}`);
                                  setShowApproverList(false);
                                }}
                                className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer hover:bg-violet-50 transition ${
                                  secondApproverId === String(emp.id) ? "bg-violet-50 font-bold text-violet-700" : "text-slate-700"
                                }`}
                              >
                                <div>
                                  <p className="font-semibold">{emp.nom} {emp.prenom}</p>
                                  <p className="text-[10px] text-slate-400">{emp.matricule} · {emp.service ?? "—"} · {emp.fonction ?? "—"}</p>
                                </div>
                                {secondApproverId === String(emp.id) && (
                                  <CheckCircle2 className="h-4 w-4 text-violet-600 shrink-0" />
                                )}
                              </li>
                            ))
                          }
                          {allEmployees.length === 0 && (
                            <li className="px-4 py-3 text-sm text-slate-400 text-center">
                              Chargement des employés…
                            </li>
                          )}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── Actions APPROVED ───────────────────────────────────────────────── */}
          {r.status === "APPROVED" && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-4 space-y-3">
                <button onClick={() => setShowRevoke((v) => !v)}
                  className="flex items-center gap-2 text-orange-700 font-bold text-sm w-full">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Révocation d'urgence
                  <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${showRevoke ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showRevoke && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-3">
                      <p className="text-xs text-orange-700">
                        L'employé est rappelé d'urgence. Les jours restants depuis la date de rappel seront restitués dans son solde.
                      </p>
                      <div>
                        <label className="text-xs font-bold text-orange-700 uppercase block mb-1.5">
                          Date de rappel effectif <span className="text-red-500">*</span>
                        </label>
                        <input type="date" value={recallDate} onChange={(e) => setRecallDate(e.target.value)}
                          min={r.start_date} max={r.end_date}
                          className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 transition bg-white" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-orange-700 uppercase block mb-1.5">
                          Motif de révocation <span className="text-red-500">*</span>
                        </label>
                        <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)}
                          placeholder="Situation d'urgence nécessitant l'intervention de l'employé…" rows={2}
                          className="w-full border border-orange-200 rounded-xl p-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200 resize-none transition bg-white" />
                      </div>
                      <button disabled={actionLoading || !revokeReason.trim()} onClick={handleRevoke}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                        {actionLoading ? <ImSpinner2 className="animate-spin" size={13} /> : <RotateCcw className="h-4 w-4" />}
                        Confirmer la révocation
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
