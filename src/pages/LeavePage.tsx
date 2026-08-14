import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import LeaveRequestForm from "@/components/leaves/LeaveRequestForm";
import LeaveCalendar from "@/components/leaves/LeaveCalendar";
import { useAuth } from "@/contexts/useAuth";
import { leaveRequestService, leaveTypeService, leaveBalanceService } from "@/services/leaveService";
import { getEmployees } from "@/services/employeeService";
import { Employee } from "@/types/employee";
import {
  ContractType, LeaveRequest, LeaveStatus, LeaveSummary, LeaveType,
  ApprovePayload, RevokePayload, LeaveBalance,
  MigrationImportResult, MigrationImportRow,
} from "@/types/leave";
import {
  CalendarDays, RefreshCw, Plus, X, CheckCircle2, XCircle,
  Ban, RotateCcw, ChevronDown, Table2, CalendarRange,
  Download, Loader2, AlertTriangle, Clock, Pencil, Paperclip,
  FileCheck, Upload, ExternalLink, Users, Settings2, Wallet,
  Search, History, Info, Trash2, Send, FileSpreadsheet,
  CheckCircle, XOctagon, Mail, GitBranch, UserX, ShieldCheck,
  AlertCircle, SlidersHorizontal, Check, LogOut,
} from "lucide-react";
import * as XLSX from "xlsx";
import { ExportColumnKey, ExportColumnDef } from "@/types/leave";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import ConfirmDeleteModal from "@/components/shared/ConfirmDeleteModal";
import HierarchyManagement from "@/components/leaves/HierarchyManagement";
import LeaveTypeManagement from "@/components/leaves/LeaveTypeManagement";
import ExitAuthorizationPanel from "@/components/leaves/ExitAuthorizationPanel";
import { onEmployeesSynced } from "@/utils/employeeSync";

// ─── Config statuts ───────────────────────────────────────────────────────────
const STATUS_CFG: Record<
  LeaveStatus | "CONSUMED" | "ON_LEAVE",
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  PENDING:        { label: "En attente",          color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "bg-amber-400"   },
  PENDING_SECOND: { label: "En att. 2ème valid.", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", dot: "bg-violet-500"  },
  PENDING_RH:     { label: "En attente RH",       color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", dot: "bg-blue-500"    },
  APPROVED:       { label: "Approuvé",            color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", dot: "bg-emerald-500" },
  REJECTED:       { label: "Rejeté",              color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "bg-red-500"     },
  CANCELLED:      { label: "Annulé",              color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", dot: "bg-slate-400"   },
  REVOKED:        { label: "Révoqué (urgence)",   color: "#b45309", bg: "#fff7ed", border: "#fed7aa", dot: "bg-orange-500"  },
  CONSUMED:       { label: "Consommé",            color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db", dot: "bg-gray-500"    },
  ON_LEAVE:       { label: "En congé",            color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd", dot: "bg-sky-500"     },
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
  { key: "reviewed_by",           label: "Validé par (N+1)"      },
  { key: "reviewed_by_email",     label: "Email validateur N+1"  },
  { key: "reviewed_at",           label: "Date validation N+1"   },
  { key: "second_reviewer",       label: "Validé par (N+2)"      },
  { key: "second_reviewer_email", label: "Email validateur N+2"  },
  { key: "second_reviewed_at",    label: "Date validation N+2"   },
  { key: "reject_reason",         label: "Motif de rejet"        },
  { key: "revoke_reason",         label: "Motif de révocation"   },
  { key: "justification_validated", label: "Justif. validé (O/N)"},
  { key: "created_at",            label: "Date de demande"       },
];

// Sélection par défaut pour l'export
const DEFAULT_EXPORT_COLUMNS: ExportColumnKey[] = [
  "employee", "matricule", "service", "leave_type",
  "start_date", "end_date", "days", "status",
];

type TabId        = "requests" | "calendar" | "balances" | "justifications" | "exit_authorizations";
type StatusFilter = "ALL" | LeaveStatus;

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "requests",            label: "Demandes",       Icon: Table2       },
  { id: "calendar",            label: "Calendrier",     Icon: CalendarRange },
  { id: "balances",            label: "Soldes",         Icon: Wallet       },
  { id: "justifications",      label: "Justificatifs",  Icon: FileCheck    },
  { id: "exit_authorizations", label: "Autorisations",  Icon: LogOut       },
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
function StatusBadge({ status, isConsumed = false, isInProgress = false }: {
  status: LeaveStatus; isConsumed?: boolean; isInProgress?: boolean;
}) {
  // Priorité : Consommé > En congé > statut normal
  let key: LeaveStatus | "CONSUMED" | "ON_LEAVE" = status;
  if (isConsumed) {
    key = "CONSUMED";
  } else if (isInProgress && status === "APPROVED") {
    key = "ON_LEAVE";
  }
  const cfg = STATUS_CFG[key] ?? STATUS_CFG.PENDING;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, dot, onClick, active }: {
  label: string; value: number | string; sub?: string;
  dot: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
        active
          ? "border-[#003c71] ring-2 ring-[#003c71]/20 shadow-sm"
          : "border-gray-200 hover:border-gray-300"
      }`}>
      <span className="text-2xl font-bold text-[#003c71] tabular-nums">{value}</span>
      <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        {label}
      </span>
      {sub && <span className="text-[10px] text-gray-400 mt-0.5">{sub}</span>}
    </button>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function LeavePage({ contractFilter }: { contractFilter?: ContractType } = {}) {
  const [tab,          setTab]          = useState<TabId>("requests");
  const [requests,     setRequests]     = useState<LeaveRequest[]>([]);
  const [summary,      setSummary]      = useState<LeaveSummary | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [contractType, setContractType] = useState<ContractType>(contractFilter ?? "INTERNE");
  const [showForm,       setShowForm]       = useState(false);
  const [showLeaveTypes, setShowLeaveTypes] = useState(false);
  const [newTypeTrigger, setNewTypeTrigger] = useState(0);
  const [showHierarchy,  setShowHierarchy]  = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selected,       setSelected]       = useState<LeaveRequest | null>(null);
  const [editTarget,     setEditTarget]     = useState<LeaveRequest | null>(null);
  const [filterOpen,     setFilterOpen]     = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // ── Filtres avancés ────────────────────────────────────────────────────────
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

  // ── Suppression / Relance / Annulation ───────────────────────────────────────
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<number | null>(null);
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [relaunchRequest,  setRelaunchRequest]  = useState<LeaveRequest | null>(null);
  const [cancelInProgressRequest, setCancelInProgressRequest] = useState<LeaveRequest | null>(null);
  const [reminderLoadingId, setReminderLoadingId] = useState<number | null>(null);
  const [reminderTarget,    setReminderTarget]    = useState<LeaveRequest | null>(null);
  const [hrValidateTarget,  setHrValidateTarget]  = useState<LeaveRequest | null>(null);
  const [hrValidateLoading, setHrValidateLoading] = useState(false);
  const [hrRejectTarget,    setHrRejectTarget]    = useState<LeaveRequest | null>(null);
  const [hrRejectLoading,   setHrRejectLoading]   = useState(false);
  const [manageTarget,      setManageTarget]      = useState<LeaveRequest | null>(null);
  const [revokeTarget,      setRevokeTarget]      = useState<LeaveRequest | null>(null);

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

  useEffect(() => {
    return onEmployeesSynced(() => { fetchAll(); });
  }, [fetchAll]);

  const handleSendReminder = async (id: number) => {
    setReminderLoadingId(id);
    try {
      await leaveRequestService.sendReminder(id);
      toast.success("Email de relance envoyé au manager.");
    } catch {
      toast.error("Impossible d'envoyer la relance.");
    } finally {
      setReminderLoadingId(null);
    }
  };

  const handleHrValidate = async (id: number) => {
    setHrValidateLoading(true);
    try {
      await leaveRequestService.hrValidate(id, user?.employee_id ?? undefined);
      toast.success("Congé validé par la RH ✓");
      setHrValidateTarget(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la validation RH.");
    } finally {
      setHrValidateLoading(false);
    }
  };

  const handleHrReject = async (id: number, reason: string) => {
    setHrRejectLoading(true);
    try {
      await leaveRequestService.hrReject(id, reason);
      toast.success("Demande rejetée par la RH ✓");
      setHrRejectTarget(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors du rejet RH.");
    } finally {
      setHrRejectLoading(false);
    }
  };

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

  // Statistiques filtrées par type de contrat (Internes vs Intérimaires)
  const contractSummary = useMemo(() => {
    if (!contractFilter) return summary; // page principale : utiliser le résumé API
    const filtered = requests.filter((r) => {
      const isShift = r.employee?.attendance_status === "SHIFT";
      if (contractFilter === "INTERIM" && !isShift) return false;
      if (contractFilter === "INTERNE" &&  isShift) return false;
      return true;
    });
    const approved = filtered.filter((r) => r.status === "APPROVED");
    return {
      total:               filtered.length,
      pending:             filtered.filter((r) => r.status === "PENDING" || r.status === "PENDING_SECOND").length,
      approved:            approved.length,
      rejected:            filtered.filter((r) => r.status === "REJECTED").length,
      cancelled:           filtered.filter((r) => r.status === "CANCELLED").length,
      revoked:             filtered.filter((r) => r.status === "REVOKED").length,
      total_days_approved: approved.reduce((acc, r) => acc + (r.days ?? 0), 0),
    } as typeof summary;
  }, [requests, contractFilter, summary]);

  const totalReqPages  = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const pagedRequests  = filteredRequests.slice((page - 1) * pageSize, page * pageSize);

  // Reset page sur changement de filtre/recherche
  useEffect(() => { setPage(1); }, [searchQ, contractType, statusFilter, filterLeaveTypeId, filterStartDate, filterEndDate, filterDepartment, filterEmployeeName, filterYear]);

  // Sync contractType with route prop
  useEffect(() => { if (contractFilter) setContractType(contractFilter); }, [contractFilter]);

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

        {/* ── Header simplifié : titre + onglets + actions globales ──────────── */}
        <div className="shrink-0 bg-white border-b border-slate-100 shadow-sm">
          {/* Ligne titre */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-camublue-900 text-white">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-camublue-900">
                  {contractFilter === "INTERIM" ? "Intérimaires — Congés" : "Internes — Congés"}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {contractFilter === "INTERIM" ? "Gestion des congés des intérimaires" : "Gestion des congés des employés internes (CDI / CDD / Stage)"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button onClick={fetchAll} disabled={loading} title="Actualiser"
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              {/* Filtres statut + avancés au même niveau que les actions */}
              {(contractFilter || tab === "requests") && (<>
                <div className="relative" ref={filterRef}>
                  <button onClick={() => setFilterOpen((o) => !o)}
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium transition">
                    <span className="text-xs">{currentFilterLabel}</span>
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
                <button onClick={() => setShowFiltersModal(true)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition font-medium ${
                    advancedFilterCount > 0
                      ? "border-camublue-300 bg-camublue-50 text-camublue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}>
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span className="text-xs">Filtres</span>
                  {advancedFilterCount > 0 && (
                    <span className="bg-camublue-700 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {advancedFilterCount}
                    </span>
                  )}
                </button>
              </>)}
              {!contractFilter && (<>
                <button onClick={() => setShowHierarchy(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-camublue-300 text-sm font-semibold transition">
                  <GitBranch className="h-4 w-4" />
                  <span className="hidden sm:inline">Hiérarchie</span>
                </button>
                <button onClick={() => setShowLeaveTypes(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-camublue-300 text-sm font-semibold transition">
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Types de congés</span>
                </button>
              </>)}
              {contractFilter && (<>
                <button onClick={() => setShowExportDialog(true)} disabled={exportLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition text-xs font-semibold disabled:opacity-50">
                  {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span className="hidden sm:inline">Exporter</span>
                </button>
                <button onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold transition shadow-sm">
                  <Plus className="h-4 w-4" />Nouvelle demande
                </button>
              </>)}
            </div>
          </div>

          {/* Navigation par onglets (cachée en mode sous-section) */}
          {!contractFilter && (
          <div className="flex gap-0 overflow-x-auto px-4 sm:px-6">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  tab === id
                    ? "border-camublue-900 text-camublue-900 bg-camublue-900/5"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
          )}
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
              {/* ── Toolbar Demandes : actions + KPIs + filtres ───────────────── */}
              <div className="mb-4 space-y-3">
                {/* Ligne 1 : toggle contrat + actions (page principale uniquement) */}
                {!contractFilter && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-semibold w-fit">
                    {(["INTERNE", "INTERIM"] as ContractType[]).map((c) => (
                      <button key={c} onClick={() => setContractType(c)}
                        className={`px-3 py-1.5 rounded-lg transition ${
                          contractType === c ? "bg-camublue-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}>
                        {c === "INTERNE" ? "Internes" : "Intérimaires"}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowExportDialog(true)} disabled={exportLoading}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition text-xs font-semibold disabled:opacity-50">
                      {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span className="hidden sm:inline">Exporter</span>
                    </button>
                    <button onClick={() => setShowForm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold transition shadow-sm">
                      <Plus className="h-4 w-4" />Nouvelle demande
                    </button>
                  </div>
                </div>
                )}

                {/* Ligne 2 : KPI Cards (filtrées par type de contrat si sous-section) */}
                {contractSummary && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <KpiCard label="Total"      value={contractSummary.total}         dot="bg-slate-400" />
                    <KpiCard label="En attente" value={contractSummary.pending}        dot="bg-amber-400"
                      active={statusFilter === "PENDING" || statusFilter === "PENDING_SECOND"}
                      onClick={() => setStatusFilter(
                        (statusFilter === "PENDING" || statusFilter === "PENDING_SECOND") ? "ALL" : "PENDING"
                      )} />
                    <KpiCard label="Approuvés"  value={contractSummary.approved}       dot="bg-emerald-500"
                      sub={`${contractSummary.total_days_approved}j accordés`}
                      active={statusFilter === "APPROVED"}
                      onClick={() => setStatusFilter(statusFilter === "APPROVED" ? "ALL" : "APPROVED")} />
                    <KpiCard label="Rejetés"    value={contractSummary.rejected}       dot="bg-red-500"
                      active={statusFilter === "REJECTED"}
                      onClick={() => setStatusFilter(statusFilter === "REJECTED" ? "ALL" : "REJECTED")} />
                    <KpiCard label="Révoqués"   value={contractSummary.revoked ?? 0}   dot="bg-orange-500"
                      active={statusFilter === "REVOKED"}
                      onClick={() => setStatusFilter(statusFilter === "REVOKED" ? "ALL" : "REVOKED")} />
                  </div>
                )}

              </div>

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
                  {/* ── Barre de recherche centrée ─────────────────────── */}
                  <div className="flex justify-center">
                    <div className="relative w-full sm:w-[42rem]">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Rechercher employé, type, service…"
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        className="w-full pl-12 pr-10 py-4 border-2 border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition bg-white shadow-sm placeholder:text-slate-400"
                      />
                      {searchQ && (
                        <button onClick={() => setSearchQ("")}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <X className="h-5 w-5" />
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
                                    <StatusBadge status={r.status} isConsumed={r.is_consumed} isInProgress={r.is_in_progress} />
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
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setManageTarget(r); }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#003c71] hover:bg-[#003c71]/90 text-white text-xs font-semibold rounded-lg transition shadow-sm whitespace-nowrap"
                                    >
                                      <Settings2 className="h-3.5 w-3.5" />
                                      Gérer
                                    </button>
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

          {tab === "calendar" && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Calendrier des absences</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Visualisez les congés approuvés sur le mois</p>
                </div>
              </div>
              <LeaveCalendar />
            </>
          )}

          {tab === "balances" && (
            <>
              {!contractFilter && (
              <div className="flex justify-end mb-3">
                <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-semibold">
                  {(["INTERNE", "INTERIM"] as ContractType[]).map((c) => (
                    <button key={c} onClick={() => setContractType(c)}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        contractType === c ? "bg-camublue-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}>
                      {c === "INTERNE" ? "Internes" : "Intérimaires"}
                    </button>
                  ))}
                </div>
              </div>
              )}
              <BalancesTab contractType={contractType} />
            </>
          )}

          {tab === "justifications" && <JustificationsTab onOpenDetail={openDetail} />}

          {tab === "exit_authorizations" && (
            <ExitAuthorizationPanel
              employees={employees}
              canCreate
              showEmployeeName
              canReview={false}
            />
          )}
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

      {/* Modal Annulation (En congé) */}
      <AnimatePresence>
        {cancelInProgressRequest && (
          <CancelInProgressModal
            request={cancelInProgressRequest}
            onClose={() => setCancelInProgressRequest(null)}
            onDone={() => { setCancelInProgressRequest(null); fetchAll(); }}
          />
        )}
      </AnimatePresence>

      {/* Modal Gérer */}
      <AnimatePresence>
        {manageTarget && (
          <ManageModal
            request={manageTarget}
            reminderLoadingId={reminderLoadingId}
            onClose={() => setManageTarget(null)}
            onEdit={(r)     => { setManageTarget(null); setEditTarget(r); }}
            onReminder={(r)   => { setManageTarget(null); setReminderTarget(r); }}
            onHrValidate={(r) => { setManageTarget(null); setHrValidateTarget(r); }}
            onHrReject={(r)   => { setManageTarget(null); setHrRejectTarget(r); }}
            onRevoke={(r)     => { setManageTarget(null); setRevokeTarget(r); }}
            onCancel={(r)     => { setManageTarget(null); setCancelInProgressRequest(r); }}
            onRelaunch={(r)   => { setManageTarget(null); setRelaunchRequest(r); }}
            onDelete={(r)     => { setManageTarget(null); setConfirmDeleteId(r.id); }}
          />
        )}
      </AnimatePresence>

      {/* Modal Révoquer (depuis Gérer) */}
      <AnimatePresence>
        {revokeTarget && (
          <QuickRevokeModal
            request={revokeTarget}
            onClose={() => setRevokeTarget(null)}
            onDone={() => { setRevokeTarget(null); fetchAll(); }}
          />
        )}
      </AnimatePresence>

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

      {/* Modal Validation RH */}
      <AnimatePresence>
        {hrValidateTarget && (
          <HrValidateModal
            request={hrValidateTarget}
            loading={hrValidateLoading}
            onClose={() => setHrValidateTarget(null)}
            onConfirm={() => handleHrValidate(hrValidateTarget.id)}
          />
        )}
      </AnimatePresence>

      {/* Modal Rejet RH */}
      <AnimatePresence>
        {hrRejectTarget && (
          <HrRejectModal
            request={hrRejectTarget}
            loading={hrRejectLoading}
            onClose={() => setHrRejectTarget(null)}
            onConfirm={(reason) => handleHrReject(hrRejectTarget.id, reason)}
          />
        )}
      </AnimatePresence>

      {/* Modal Confirmation Relance Manager */}
      <AnimatePresence>
        {reminderTarget && (
          <ReminderConfirmModal
            request={reminderTarget}
            loading={reminderLoadingId === reminderTarget.id}
            onClose={() => setReminderTarget(null)}
            onConfirm={async () => {
              await handleSendReminder(reminderTarget.id);
              setReminderTarget(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Modal Filtres avancés ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showFiltersModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => setShowFiltersModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 20 }} transition={{ duration: 0.2 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-camublue-900 text-white">
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-800 text-base">Filtres avancés</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Affinez la liste des demandes</p>
                  </div>
                </div>
                <button onClick={() => setShowFiltersModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Contenu */}
              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Type de congé</label>
                  <select value={filterLeaveTypeId} onChange={(e) => setFilterLeaveTypeId(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300 focus:border-camublue-400 transition">
                    <option value="">Tous les types</option>
                    {availableLeaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Employé</label>
                  <input type="text" value={filterEmployeeName}
                    onChange={(e) => setFilterEmployeeName(e.target.value)}
                    placeholder="Nom ou matricule"
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300 focus:border-camublue-400 transition" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Service / Département</label>
                  <input type="text" value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    placeholder="Nom du département"
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300 focus:border-camublue-400 transition" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Année</label>
                  <input type="number" value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    placeholder={String(new Date().getFullYear())}
                    min="2020" max="2099"
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300 focus:border-camublue-400 transition" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Date début (≥)</label>
                  <input type="date" value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300 focus:border-camublue-400 transition" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Date fin (≤)</label>
                  <input type="date" value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-camublue-300 focus:border-camublue-400 transition" />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex items-center justify-between gap-3">
                <button onClick={resetAdvancedFilters}
                  disabled={advancedFilterCount === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 transition">
                  <X className="h-3.5 w-3.5" />Réinitialiser
                </button>
                <button onClick={() => setShowFiltersModal(false)}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-bold transition">
                  {advancedFilterCount > 0 && (
                    <span className="bg-white text-camublue-900 text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                      {advancedFilterCount}
                    </span>
                  )}
                  Appliquer les filtres
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Types de congés ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showLeaveTypes && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => setShowLeaveTypes(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 20 }} transition={{ duration: 0.2 }}
              className="bg-slate-50 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-6 pt-5 pb-4 bg-white rounded-t-3xl border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-camublue-900 text-white">
                    <Settings2 className="h-4 w-4" />
                  </div>
                  <h2 className="font-black text-slate-800 text-base">Types de congés</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNewTypeTrigger(c => c + 1)}
                    className="flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nouveau type
                  </button>
                  <button onClick={() => setShowLeaveTypes(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Contenu scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <LeaveTypeManagement triggerNew={newTypeTrigger} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Hiérarchie ──────────────────────────────────────────────── */}
      <HierarchyManagement open={showHierarchy} onClose={() => setShowHierarchy(false)} />

    </AppLayout>
  );
}

// ─── Onglet Justificatifs ────────────────────────────────────────────────────
import { BASE_URL as API_BASE } from "@/api/baseUrl";

type JustifStatus = "missing" | "uploaded" | "validated" | "absent";

function getJustifStatus(r: LeaveRequest): JustifStatus {
  if (r.marked_as_absent)        return "absent";
  if (r.justification_validated) return "validated";
  if (r.justification_document)  return "uploaded";
  return "missing";
}

const JUSTIF_STATUS_CFG: Record<JustifStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  missing:   { label: "Manquant",         color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "bg-amber-400"   },
  uploaded:  { label: "Soumis",           color: "#0284c7", bg: "#eff6ff", border: "#bfdbfe", dot: "bg-blue-400"    },
  validated: { label: "Validé",           color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", dot: "bg-emerald-500" },
  absent:    { label: "Non justifié",     color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "bg-red-500"     },
};

interface JustificationsTabProps {
  onOpenDetail: (r: LeaveRequest) => void;
}

function JustificationsTab({ onOpenDetail }: JustificationsTabProps) {
  const { user } = useAuth();
  const [requests,    setRequests]    = useState<LeaveRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [filter,      setFilter]      = useState<JustifStatus | "ALL">("ALL");
  const [searchQ,     setSearchQ]     = useState("");
  const [actionId,    setActionId]    = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Fetch all approved leaves and filter client-side for those requiring justification
      const all = await leaveRequestService.getAll({ status: "APPROVED" });
      const withJustif = (Array.isArray(all) ? all : []).filter(
        (r) => r.leave_type.requires_justification
      );
      setRequests(withJustif);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleValidate = async (id: number) => {
    setActionId(id);
    try {
      await leaveRequestService.validateDocument(id, user?.employee_id);
      toast.success("Justificatif validé ✓");
      await load();
    } catch { toast.error("Erreur lors de la validation"); }
    finally { setActionId(null); }
  };

  const handleMarkAbsent = async (id: number) => {
    setActionId(id);
    try {
      await leaveRequestService.markAsAbsent(id, { marker_id: user?.employee_id });
      toast.success("Congé marqué non justifié ✓");
      await load();
    } catch { toast.error("Erreur lors du marquage"); }
    finally { setActionId(null); }
  };

  const handleUndoAbsent = async (id: number) => {
    setActionId(id);
    try {
      await leaveRequestService.markAsAbsent(id, { undo: true });
      toast.success("Marquage non justifié annulé ✓");
      await load();
    } catch { toast.error("Erreur lors de l'annulation"); }
    finally { setActionId(null); }
  };

  const filtered = requests.filter((r) => {
    if (filter !== "ALL" && getJustifStatus(r) !== filter) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const name = (r.employee?.full_name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const mat  = (r.employee?.matricule ?? "").toLowerCase();
      const type = (r.leave_type?.label ?? "").toLowerCase();
      if (!name.includes(q) && !mat.includes(q) && !type.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    ALL:       requests.length,
    missing:   requests.filter((r) => getJustifStatus(r) === "missing").length,
    uploaded:  requests.filter((r) => getJustifStatus(r) === "uploaded").length,
    validated: requests.filter((r) => getJustifStatus(r) === "validated").length,
    absent:    requests.filter((r) => getJustifStatus(r) === "absent").length,
  };

  if (loading) return (
    <div className="flex flex-col items-center gap-3 text-slate-400 py-24">
      <Loader2 className="h-7 w-7 animate-spin" />
      <p className="text-sm">Chargement des justificatifs…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-4 py-24">
      <AlertTriangle className="h-9 w-9 text-red-400" />
      <p className="text-sm font-medium text-red-500">{error}</p>
      <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-medium transition">
        <RefreshCw className="h-3.5 w-3.5" />Réessayer
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: "missing",   label: "Manquants",   icon: AlertCircle,  color: "#d97706", bg: "#fffbeb" },
          { key: "uploaded",  label: "Soumis",      icon: Upload,       color: "#0284c7", bg: "#eff6ff" },
          { key: "validated", label: "Validés",     icon: ShieldCheck,  color: "#059669", bg: "#ecfdf5" },
          { key: "absent",    label: "Non justifiés", icon: UserX,      color: "#dc2626", bg: "#fef2f2" },
        ] as const).map(({ key, label, icon: Icon, color, bg }) => (
          <button key={key}
            onClick={() => setFilter(filter === key ? "ALL" : key)}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition text-left ${
              filter === key ? "border-current shadow-md" : "border-transparent bg-white shadow-sm hover:shadow-md"
            }`}
            style={{ color, backgroundColor: filter === key ? color + "18" : bg }}>
            <Icon className="h-6 w-6 shrink-0" />
            <div>
              <p className="text-2xl font-black tabular-nums">{counts[key]}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Barre de recherche + refresh */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input type="text" placeholder="Rechercher employé, type…"
            value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition bg-white" />
          {searchQ && (
            <button onClick={() => setSearchQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button onClick={load} title="Actualiser" className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <FileCheck className="h-12 w-12 mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-sm">
              {filter === "missing" ? "Aucun justificatif manquant" :
               filter === "uploaded" ? "Aucun justificatif en attente de validation" :
               filter === "validated" ? "Aucun justificatif validé" :
               filter === "absent" ? "Aucun congé marqué non justifié" :
               "Aucun congé nécessitant un justificatif"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {["Employé", "Type de congé", "Période", "Échéance", "Statut justif.", "Document", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((r, i) => {
                  const lc     = r.leave_type?.color ?? "#6b7280";
                  const jStatus = getJustifStatus(r);
                  const cfg    = JUSTIF_STATUS_CFG[jStatus];
                  const isActing = actionId === r.id;
                  const docUrl = r.justification_document
                    ? (r.justification_document.startsWith("http") ? r.justification_document : `${API_BASE}${r.justification_document}`)
                    : null;

                  return (
                    <motion.tr key={r.id}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.12, delay: i * 0.02 }}
                      onClick={() => onOpenDetail(r)}
                      className={`hover:bg-slate-50/80 transition cursor-pointer ${i % 2 !== 0 ? "bg-slate-50/20" : ""}`}>

                      {/* Employé */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                            style={{ backgroundColor: lc }}>
                            {(r.employee?.full_name ?? "??").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 truncate max-w-[140px]">{r.employee?.full_name ?? "—"}</p>
                            <p className="text-xs text-slate-400 truncate max-w-[140px]">{r.employee?.matricule} · {r.employee?.service ?? "—"}</p>
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

                      {/* Échéance */}
                      <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                        {r.justification_deadline ? (
                          <span className={`font-semibold ${
                            new Date(r.justification_deadline) < new Date() && !r.justification_document && !r.marked_as_absent
                              ? "text-red-600" : "text-slate-600"
                          }`}>
                            {fmtDate(r.justification_deadline)}
                          </span>
                        ) : "—"}
                      </td>

                      {/* Statut justif. */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap"
                          style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Document */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        {docUrl ? (
                          <a href={docUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition border border-blue-200 whitespace-nowrap">
                            <ExternalLink className="h-3.5 w-3.5" /> Voir le doc
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 italic">Aucun document</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1.5">
                          {/* Valider le document */}
                          {jStatus === "uploaded" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleValidate(r.id); }}
                              disabled={isActing}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition border border-emerald-200 whitespace-nowrap disabled:opacity-50">
                              {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                              Valider
                            </button>
                          )}
                          {/* Marquer absent */}
                          {(jStatus === "missing" || jStatus === "uploaded") && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMarkAbsent(r.id); }}
                              disabled={isActing}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition border border-red-200 whitespace-nowrap disabled:opacity-50">
                              {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                              Non justifié
                            </button>
                          )}
                          {/* Annuler marquage non justifié */}
                          {jStatus === "absent" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUndoAbsent(r.id); }}
                              disabled={isActing}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition border border-slate-200 whitespace-nowrap disabled:opacity-50">
                              {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
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
    </div>
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
  const [importOpen,     setImportOpen]     = useState(false);
  const [migrationOpen,  setMigrationOpen]  = useState(false);
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
            onClick={() => setMigrationOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
          >
            <Upload className="h-4 w-4" />
            Migration Soldes
          </button>
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
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Ligne de titre des groupes */}
              <tr className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
                <th className="px-3 py-2.5 text-left text-xs font-bold border-r border-slate-600 whitespace-nowrap" rowSpan={2}>Employé</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold border-r border-slate-600 whitespace-nowrap" rowSpan={2}>Type</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold border-r border-slate-600 uppercase leading-tight">Report Années<br/>Antérieures</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold border-r border-slate-600 uppercase leading-tight">Congés Payés Acquis<br/>Mois en Cours</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold border-r border-slate-600 uppercase leading-tight bg-slate-900/30">Solde des Congés<br/>Acquis à Date</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold border-r border-slate-600 uppercase leading-tight">Congés Payés Pris<br/>en {currentYear}</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold border-r border-slate-600 uppercase leading-tight bg-emerald-600/40">Solde des Congés<br/>Payés à Prendre</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold" rowSpan={2}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                    {searchQuery ? "Aucun résultat pour cette recherche" : "Aucun solde trouvé pour ce type d'employé"}
                  </td>
                </tr>
              )}
              {paginated.map((b) => {
                const report    = parseFloat(b.adjusted  ?? "0");
                const acquis    = parseFloat(b.acquired  ?? "0");
                const pris      = parseFloat(b.taken     ?? "0");
                const soldeDate = acquis + report;
                const remaining = parseFloat(b.remaining ?? "0");
                const isLow     = remaining <= 2;
                const emp       = empMap.get(b.employee);
                return (
                  <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-3 py-2 border border-slate-200">
                      <p className="font-semibold text-slate-800 text-xs">{b.employee_name}</p>
                      {emp && (
                        <p className="text-[10px] text-slate-400">
                          {emp.matricule}{emp.fonction ? ` · ${emp.fonction}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 border border-slate-200">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                        style={{ backgroundColor: (b.leave_type.color ?? "#6b7280") + "20", color: b.leave_type.color ?? "#6b7280" }}>
                        {b.leave_type.label}
                      </span>
                    </td>
                    {/* Report années antérieures */}
                    <td className="px-3 py-2 text-center border border-slate-200 tabular-nums font-semibold text-slate-700 text-sm">
                      {report.toFixed(2)}
                    </td>
                    {/* Acquis mois en cours */}
                    <td className="px-3 py-2 text-center border border-slate-200 tabular-nums font-semibold text-slate-700 text-sm">
                      {acquis.toFixed(2)}
                    </td>
                    {/* Solde acquis à date */}
                    <td className="px-3 py-2 text-center border border-slate-200 tabular-nums font-bold text-slate-800 text-sm bg-slate-50">
                      {soldeDate.toFixed(2)}
                    </td>
                    {/* Pris en année */}
                    <td className="px-3 py-2 text-center border border-slate-200 tabular-nums font-semibold text-orange-600 text-sm">
                      {pris.toFixed(2)}
                    </td>
                    {/* Solde à prendre */}
                    <td className={`px-3 py-2 text-center border border-slate-200 tabular-nums font-black text-sm ${
                      isLow
                        ? "bg-red-50 text-red-600"
                        : remaining >= 10
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                    }`}>
                      {remaining.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center border border-slate-200">
                      <button
                        onClick={() => setHistoryEmp({ id: b.employee, name: b.employee_name })}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold rounded-lg transition flex items-center gap-1 mx-auto whitespace-nowrap">
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

      <AnimatePresence>
        {migrationOpen && (
          <MigrationImportModal
            onClose={() => setMigrationOpen(false)}
            onImported={() => { setMigrationOpen(false); load(); }}
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
    const year = new Date().getFullYear();
    const headers = [
      "MATRICULE",
      "TYPE_CONGE",
      "REPORT_ANNEES_ANTERIEURES",
      "CONGES_PAYES_ACQUIS_MOIS_EN_COURS",
      "CONGES_PAYES_PRIS",
    ];
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      ["EMP001", "CONGE_PAYE", 3505, 585, 509],
      ["EMP002", "CONGE_PAYE", 87,   4,   8  ],
    ]);
    ws["!cols"] = [
      { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 34 }, { wch: 20 },
    ];
    // Style header row in red
    const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1:E1");
    for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[cellAddr]) continue;
      ws[cellAddr].s = {
        font:    { bold: true, color: { rgb: "FFFFFF" } },
        fill:    { fgColor: { rgb: "CC0000" } },
        alignment: { horizontal: "center", wrapText: true },
      };
    }
    // Highlight "SOLDE PAYES A PRENDRE" computed column hint via a note
    // (computed column not in template — see note below)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Soldes ${year}`);
    XLSX.writeFile(wb, `template_soldes_conges_${year}.xlsx`);
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
              <h3 className="font-bold text-slate-800">Importer les soldes de congés</h3>
              <p className="text-xs text-slate-500">Format : MATRICULE · TYPE_CONGE · REPORT · ACQUIS MOIS · PRIS</p>
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
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Format attendu</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="px-2 py-1 border-r border-slate-600 font-bold text-center whitespace-nowrap">MATRICULE</th>
                    <th className="px-2 py-1 border-r border-slate-600 font-bold text-center whitespace-nowrap">TYPE_CONGE</th>
                    <th className="px-2 py-1 border-r border-slate-600 font-bold text-center leading-tight">REPORT_ANNEES<br/>_ANTERIEURES</th>
                    <th className="px-2 py-1 border-r border-slate-600 font-bold text-center leading-tight">CONGES_PAYES_ACQUIS<br/>_MOIS_EN_COURS</th>
                    <th className="px-2 py-1 font-bold text-center leading-tight bg-emerald-600/40">CONGES<br/>_PAYES_PRIS</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-700">
                  <tr className="border-b border-slate-200">
                    <td className="px-2 py-1 border border-slate-200 text-center">EMP001</td>
                    <td className="px-2 py-1 border border-slate-200 text-center">CONGE_PAYE</td>
                    <td className="px-2 py-1 border border-slate-200 text-center">3505,00</td>
                    <td className="px-2 py-1 border border-slate-200 text-center">585,00</td>
                    <td className="px-2 py-1 border border-slate-200 text-center bg-amber-50">509,00</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 border border-slate-200 text-center">EMP002</td>
                    <td className="px-2 py-1 border border-slate-200 text-center">CONGE_PAYE</td>
                    <td className="px-2 py-1 border border-slate-200 text-center">87</td>
                    <td className="px-2 py-1 border border-slate-200 text-center">4</td>
                    <td className="px-2 py-1 border border-slate-200 text-center bg-amber-50">8</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] text-slate-500"><strong>TYPE_CONGE</strong> = code du type (ex&nbsp;: CONGE_PAYE).</p>
              <p className="text-[11px] text-slate-500"><strong>REPORT</strong> = jours reportés des années précédentes (optionnel, défaut 0).</p>
              <p className="text-[11px] text-slate-500"><strong>CONGES_PAYES_PRIS</strong> = jours déjà pris dans l'année (optionnel, défaut 0).</p>
            </div>
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

// ─── Modal Migration Soldes (import depuis plateforme externe) ───────────────
function MigrationImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const currentYear = new Date().getFullYear();

  const [file,        setFile]        = useState<File | null>(null);
  const [year,        setYear]        = useState<number>(currentYear);
  const [leaveCode,   setLeaveCode]   = useState<string>("CONGE_PAYE");
  const [loading,     setLoading]     = useState(false);
  const [preview,     setPreview]     = useState<MigrationImportResult | null>(null);
  const [confirmed,   setConfirmed]   = useState(false);

  const handleFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Fichier Excel (.xlsx / .xls) ou CSV requis.");
      return;
    }
    setFile(f);
    setPreview(null);
    setConfirmed(false);
  };

  const matchBadge = (row: MigrationImportRow) => {
    if (row.status === "not_found") return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">Introuvable</span>;
    if (row.status === "ambiguous") return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600">Ambigu</span>;
    if (row.status === "error")     return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">Erreur</span>;
    const mt = row.match_type;
    if (mt === "matricule")   return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Matricule</span>;
    if (mt === "name_exact")  return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-700">Nom exact</span>;
    if (mt === "name_fuzzy")  return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Nom approx.</span>;
    return null;
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await leaveBalanceService.migrationImport(file, { dry_run: true, year, leave_type_code: leaveCode || undefined });
      setPreview(res);
      setConfirmed(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de la prévisualisation.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await leaveBalanceService.migrationImport(file, { dry_run: false, year, leave_type_code: leaveCode || undefined });
      setConfirmed(true);
      setPreview(res);
      toast.success(`Migration réussie — ${res.processed} employé(s) mis à jour.`);
      onImported();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de la migration.");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["NOM_PRENOM", "MATRICULE", "SOLDE_RESTANT"],
      ["Jean Dupont", "EMP001",   15.5],
      ["Marie Martin", "EMP002",  8],
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Migration ${year}`);
    XLSX.writeFile(wb, `template_migration_soldes_${year}.xlsx`);
  };

  const okRows    = preview?.results.filter(r => r.status === "ok") ?? [];
  const errRows   = preview?.results.filter(r => r.status !== "ok") ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-600">
              <Upload className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Migration des soldes de congés</h3>
              <p className="text-xs text-slate-500">Importez les soldes depuis votre ancienne plateforme</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Année de migration</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Code type de congé</label>
              <input
                type="text"
                value={leaveCode}
                onChange={(e) => setLeaveCode(e.target.value.toUpperCase())}
                placeholder="Ex : CONGE_PAYE"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition font-mono"
              />
            </div>
          </div>

          {/* Zone de dépôt */}
          <div
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
              file ? "border-violet-400 bg-violet-50/50" : "border-slate-200 hover:border-violet-400 hover:bg-violet-50/30"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-violet-600" />
                <div className="text-left">
                  <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} Ko</p>
                </div>
                <button
                  className="ml-2 text-slate-400 hover:text-red-500 transition"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setConfirmed(false); }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Glissez un fichier ici</p>
                <p className="text-xs text-slate-400 mt-1">ou cliquez pour parcourir (.xlsx, .xls, .csv)</p>
              </div>
            )}
          </div>

          {/* Format attendu */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Format attendu (colonnes auto-détectées)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-violet-700 text-white">
                    <th className="px-2 py-1.5 border-r border-violet-600 font-bold text-center whitespace-nowrap">NOM_PRENOM <span className="font-normal opacity-70">ou</span> MATRICULE</th>
                    <th className="px-2 py-1.5 border-r border-violet-600 font-bold text-center whitespace-nowrap">MATRICULE <span className="font-normal opacity-70">(optionnel)</span></th>
                    <th className="px-2 py-1.5 font-bold text-center whitespace-nowrap bg-emerald-600/50">SOLDE_RESTANT</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-700">
                  <tr className="border-b border-slate-200">
                    <td className="px-2 py-1 border border-slate-200 text-center">Jean Dupont</td>
                    <td className="px-2 py-1 border border-slate-200 text-center text-slate-400">EMP001</td>
                    <td className="px-2 py-1 border border-slate-200 text-center bg-emerald-50 font-bold">15.5</td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 border border-slate-200 text-center">Marie Martin</td>
                    <td className="px-2 py-1 border border-slate-200 text-center text-slate-400">EMP002</td>
                    <td className="px-2 py-1 border border-slate-200 text-center bg-emerald-50 font-bold">8</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] text-slate-500">• La colonne <strong>SOLDE_RESTANT</strong> contiendra le nombre de jours restants à reprendre.</p>
              <p className="text-[11px] text-slate-500">• Le système détecte automatiquement les colonnes (NOM, PRENOM, MATRICULE, SOLDE, DUREE…).</p>
              <p className="text-[11px] text-slate-500">• La recherche est insensible aux accents et à la casse.</p>
            </div>
          </div>

          {/* Résultats de prévisualisation */}
          {preview && (
            <div className="space-y-3">
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-emerald-700">{preview.processed}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">À mettre à jour</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-red-600">{preview.errors_count}</p>
                  <p className="text-[11px] text-red-500 font-semibold mt-0.5">Erreur(s)</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-slate-700">{preview.results.length}</p>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Total lignes</p>
                </div>
              </div>

              {/* Bannière dry_run */}
              {preview.dry_run && !confirmed && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 font-medium">
                    Ceci est une <strong>prévisualisation</strong> — aucun solde n'a encore été modifié.
                    Vérifiez les résultats ci-dessous puis cliquez sur <strong>Confirmer l'import</strong>.
                  </p>
                </div>
              )}

              {confirmed && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-800 font-semibold">Migration appliquée avec succès.</p>
                </div>
              )}

              {/* Tableau résultats */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-700 text-white">
                      <tr>
                        <th className="px-2 py-2 text-left font-bold border-r border-slate-600">#</th>
                        <th className="px-2 py-2 text-left font-bold border-r border-slate-600">Employé</th>
                        <th className="px-2 py-2 text-center font-bold border-r border-slate-600">Détection</th>
                        <th className="px-2 py-2 text-center font-bold border-r border-slate-600">Solde actuel</th>
                        <th className="px-2 py-2 text-center font-bold border-r border-slate-600">Nouveau solde</th>
                        <th className="px-2 py-2 text-center font-bold">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.results.map((row) => (
                        <tr key={row.row} className={`border-b border-slate-100 ${
                          row.status === "ok" ? "hover:bg-slate-50" : "bg-red-50"
                        }`}>
                          <td className="px-2 py-1.5 border-r border-slate-100 text-slate-400 font-mono">{row.row}</td>
                          <td className="px-2 py-1.5 border-r border-slate-100">
                            <p className="font-semibold text-slate-800">{row.employee}</p>
                            {row.matricule && <p className="text-[10px] text-slate-400 font-mono">{row.matricule}</p>}
                            {row.message   && <p className="text-[10px] text-red-500">{row.message}</p>}
                          </td>
                          <td className="px-2 py-1.5 border-r border-slate-100 text-center">{matchBadge(row)}</td>
                          <td className="px-2 py-1.5 border-r border-slate-100 text-center font-mono text-slate-600">
                            {row.current_remaining !== null ? row.current_remaining.toFixed(2) : "—"}
                          </td>
                          <td className="px-2 py-1.5 border-r border-slate-100 text-center font-mono font-bold text-slate-800">
                            {row.new_remaining !== null ? row.new_remaining.toFixed(2) : "—"}
                          </td>
                          <td className={`px-2 py-1.5 text-center font-mono font-bold ${
                            (row.delta ?? 0) > 0 ? "text-emerald-600" : (row.delta ?? 0) < 0 ? "text-red-600" : "text-slate-400"
                          }`}>
                            {row.delta !== undefined
                              ? `${row.delta > 0 ? "+" : ""}${row.delta.toFixed(2)}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex gap-3 shrink-0">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4" /> Modèle
          </button>

          {!confirmed && (
            <>
              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
              >
                {loading && !preview ? <ImSpinner2 className="animate-spin" size={14} /> : <CheckCircle2 className="h-4 w-4" />}
                Prévisualiser
              </button>

              {preview && preview.processed > 0 && (
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-2 rounded-xl transition disabled:opacity-50"
                >
                  {loading ? <ImSpinner2 className="animate-spin" size={14} /> : <Upload className="h-4 w-4" />}
                  {loading ? "Migration en cours…" : `Confirmer l'import (${preview.processed} employé(s))`}
                </button>
              )}
            </>
          )}

          {confirmed && (
            <button
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2 rounded-xl transition"
            >
              <CheckCircle className="h-4 w-4" /> Fermer
            </button>
          )}
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
                let statusKey: LeaveStatus | "CONSUMED" | "ON_LEAVE" = req.status;
                if (req.is_consumed) statusKey = "CONSUMED";
                else if (req.is_in_progress && req.status === "APPROVED") statusKey = "ON_LEAVE";
                const cfg = STATUS_CFG[statusKey] ?? STATUS_CFG.PENDING;
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

// ─── Modal Gérer — toutes les actions d'une demande en un seul endroit ──────────
interface ManageModalProps {
  request:           LeaveRequest;
  reminderLoadingId: number | null;
  onClose:      ()                      => void;
  onEdit:       (r: LeaveRequest)       => void;
  onReminder:   (r: LeaveRequest)       => void;
  onHrValidate: (r: LeaveRequest)       => void;
  onHrReject:   (r: LeaveRequest)       => void;
  onRevoke:     (r: LeaveRequest)       => void;
  onCancel:     (r: LeaveRequest)       => void;
  onRelaunch:   (r: LeaveRequest)       => void;
  onDelete:     (r: LeaveRequest)       => void;
}

function ManageModal({
  request: r, reminderLoadingId,
  onClose, onEdit, onReminder, onHrValidate, onHrReject, onRevoke, onCancel, onRelaunch, onDelete,
}: ManageModalProps) {
  const isPending     = r.status === "PENDING" || r.status === "PENDING_SECOND";
  const isPendingRH   = r.status === "PENDING_RH";
  const isApproved    = r.status === "APPROVED";
  const isRejected    = r.status === "REJECTED";
  const isRevoked     = r.status === "REVOKED";
  const isCancelled   = r.status === "CANCELLED";
  const isInProgress  = !!r.is_in_progress;
  const isEnded       = !!r.is_ended;
  const lc            = r.leave_type?.color ?? "#003c71";
  const isReminderBusy = reminderLoadingId === r.id;

  const ActionBtn = ({
    icon: Icon, label, description, onClick, variant = "default", disabled = false,
  }: {
    icon: React.ElementType; label: string; description?: string;
    onClick: () => void; variant?: "default" | "danger" | "warning" | "success"; disabled?: boolean;
  }) => {
    const styles = {
      default: "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200",
      danger:  "bg-red-50   hover:bg-red-100   text-red-700   border-red-200",
      warning: "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200",
      success: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200",
    };
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]}`}
      >
        <div className={`p-2 rounded-xl ${styles[variant]} shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{label}</p>
          {description && <p className="text-xs opacity-60 mt-0.5 leading-snug">{description}</p>}
        </div>
        {disabled && <ImSpinner2 className="h-3.5 w-3.5 animate-spin shrink-0 opacity-50" />}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-5 py-4" style={{ backgroundColor: lc }}>
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-sm shrink-0">
              {(r.employee?.full_name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wide mb-0.5">Gérer la demande</p>
              <p className="text-white font-bold text-sm leading-tight truncate max-w-[200px]">
                {r.employee?.full_name ?? "—"}
              </p>
              <p className="text-white/70 text-xs mt-0.5">
                {r.leave_type?.label ?? "—"} · {r.days ?? r.duration_days ?? "?"}j
              </p>
            </div>
          </div>
        </div>

        {/* ── Motif de rejet ── */}
        {isRejected && r.reject_reason && (
          <div className="px-4 pt-4">
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-red-500 uppercase tracking-wide mb-1">
                  Motif du rejet
                </p>
                <p className="text-sm text-red-700 leading-snug whitespace-pre-wrap break-words">
                  {r.reject_reason}
                </p>
                {r.reviewed_by?.full_name && (
                  <p className="text-[11px] text-red-400 mt-1.5">
                    Rejeté par <span className="font-semibold">{r.reviewed_by.full_name}</span>
                    {r.reviewed_at && (
                      <> le {new Date(r.reviewed_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 space-y-2">
          {/* ── En attente de validation ── */}
          {isPending && (
            <>
              <ActionBtn
                icon={Pencil}
                label="Modifier"
                description="Changer les dates, le type ou le motif"
                onClick={() => onEdit(r)}
              />
              <ActionBtn
                icon={isReminderBusy ? ImSpinner2 : Mail}
                label="Relancer le manager"
                description="Envoyer un email de rappel au manager en attente"
                onClick={() => onReminder(r)}
                variant="warning"
                disabled={isReminderBusy}
              />
            </>
          )}

          {/* ── En attente de validation RH ── */}
          {isPendingRH && (
            <>
              <ActionBtn
                icon={CheckCircle2}
                label="Valider (RH)"
                description="Approuver définitivement ce congé en tant que RH"
                onClick={() => onHrValidate(r)}
                variant="success"
              />
              <ActionBtn
                icon={XCircle}
                label="Rejeter (RH)"
                description="Rejeter cette demande depuis la validation RH"
                onClick={() => onHrReject(r)}
                variant="danger"
              />
            </>
          )}

          {/* ── Approuvé – pas encore commencé ── */}
          {isApproved && !isInProgress && !isEnded && (
            <ActionBtn
              icon={RotateCcw}
              label="Révoquer"
              description="Annuler ce congé approuvé (urgence, rappel anticipé)"
              onClick={() => onRevoke(r)}
              variant="warning"
            />
          )}

          {/* ── Approuvé – en cours ── */}
          {isApproved && isInProgress && (
            <ActionBtn
              icon={X}
              label="Annuler le congé en cours"
              description="Interrompre le congé actuellement en cours"
              onClick={() => onCancel(r)}
              variant="danger"
            />
          )}

          {/* ── Approuvé terminé ── */}
          {isApproved && isEnded && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100">
              <CheckCircle2 className="h-4 w-4 text-gray-400 shrink-0" />
              <p className="text-sm text-gray-500 font-medium">Congé terminé — aucune action disponible</p>
            </div>
          )}

          {/* ── Révoqué ── */}
          {isRevoked && (
            <ActionBtn
              icon={Send}
              label="Relancer la demande"
              description="Soumettre à nouveau cette demande révoquée"
              onClick={() => onRelaunch(r)}
            />
          )}

          {/* ── Supprimer (tous sauf en cours) ── */}
          {!isInProgress && (
            <ActionBtn
              icon={Trash2}
              label="Supprimer"
              description="Supprimer définitivement cette demande"
              onClick={() => onDelete(r)}
              variant="danger"
            />
          )}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
          >
            Fermer
          </button>
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
        className="flex-1 px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center justify-center gap-1">
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
      ? "En attente de validation N+1 — le manager N+1 doit valider en premier"
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

// ─── Modal Confirmation Validation RH ────────────────────────────────────────
function HrValidateModal({ request: r, loading, onClose, onConfirm }: {
  request: LeaveRequest; loading: boolean; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{ opacity: 0, scale: 0.95,    y: 16 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="bg-emerald-600 px-5 py-4 flex items-center gap-3 relative">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
          <div className="p-2 rounded-xl bg-white/20">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wide">Validation RH</p>
            <p className="text-white font-bold text-sm leading-tight">Confirmer la validation ?</p>
          </div>
        </div>

        {/* Corps */}
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            Vous êtes sur le point de valider définitivement la demande de congé de{" "}
            <span className="font-semibold text-slate-800">{r.employee?.full_name ?? "cet employé"}</span>.
            Cette action passera le statut à <span className="font-semibold text-emerald-700">Approuvé</span>.
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Détails du congé</p>
            <p className="text-sm text-emerald-900 font-semibold">{r.leave_type?.label ?? "—"}</p>
            <p className="text-xs text-emerald-700">
              {r.start_date ? new Date(r.start_date).toLocaleDateString("fr-FR") : "—"} →{" "}
              {r.end_date   ? new Date(r.end_date).toLocaleDateString("fr-FR")   : "—"}
              {" "}&nbsp;·&nbsp; <span className="font-semibold">{r.days ?? r.duration_days ?? "?"}j</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 transition shadow-sm"
          >
            {loading
              ? <ImSpinner2 className="h-4 w-4 animate-spin" />
              : <CheckCircle2 className="h-4 w-4" />}
            Confirmer la validation
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal Rejet RH ──────────────────────────────────────────────────────────
function HrRejectModal({ request: r, loading, onClose, onConfirm }: {
  request: LeaveRequest; loading: boolean; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{ opacity: 0, scale: 0.95,    y: 16 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3 relative">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
          <div className="p-2 rounded-xl bg-white/20">
            <XCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wide">Rejet RH</p>
            <p className="text-white font-bold text-sm leading-tight">Rejeter la demande ?</p>
          </div>
        </div>

        {/* Corps */}
        <div className="px-5 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Demande concernée</p>
            <p className="text-sm text-red-900 font-semibold">{r.employee?.full_name ?? "—"}</p>
            <p className="text-sm text-red-800">{r.leave_type?.label ?? "—"}</p>
            <p className="text-xs text-red-700">
              {r.start_date ? new Date(r.start_date).toLocaleDateString("fr-FR") : "—"} →{" "}
              {r.end_date   ? new Date(r.end_date).toLocaleDateString("fr-FR")   : "—"}
              {" "}&nbsp;·&nbsp; <span className="font-semibold">{r.days ?? r.duration_days ?? "?"}j</span>
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5 block">
              Motif du rejet <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Expliquez la raison du rejet…"
              className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 resize-none transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading || !reason.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 transition shadow-sm"
          >
            {loading
              ? <ImSpinner2 className="h-4 w-4 animate-spin" />
              : <XCircle className="h-4 w-4" />}
            Confirmer le rejet
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal Confirmation Relance Manager ───────────────────────────────────────
function ReminderConfirmModal({ request: r, loading, onClose, onConfirm }: {
  request: LeaveRequest; loading: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const managerName = r.reviewed_by?.full_name ?? r.employee?.manager ?? null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{ opacity: 0, scale: 0.95,    y: 16 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="bg-amber-500 px-5 py-4 flex items-center gap-3 relative">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
          <div className="p-2 rounded-xl bg-white/20">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wide">Relance manager</p>
            <p className="text-white font-bold text-sm leading-tight">Confirmer l'envoi ?</p>
          </div>
        </div>

        {/* Corps */}
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            Un email de rappel sera envoyé au manager de{" "}
            <span className="font-semibold text-slate-800">{r.employee?.full_name ?? "cet employé"}</span>{" "}
            pour la demande de congé en attente de validation.
          </p>
          {managerName && (
            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <Mail className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Destinataire</p>
                <p className="text-sm text-amber-900 font-semibold">{managerName}</p>
              </div>
            </div>
          )}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 leading-relaxed">
            Type · <span className="font-semibold text-slate-700">{r.leave_type?.label ?? "—"}</span>
            {" "}&nbsp;|&nbsp; Période · <span className="font-semibold text-slate-700">
              {r.start_date ? new Date(r.start_date).toLocaleDateString("fr-FR") : "—"} →{" "}
              {r.end_date   ? new Date(r.end_date).toLocaleDateString("fr-FR")   : "—"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 transition shadow-sm"
          >
            {loading
              ? <ImSpinner2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
            Envoyer la relance
          </button>
        </div>
      </motion.div>
    </div>
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

// ─── Circuit de validation (timeline étape par étape) ────────────────────────
function ValidationChain({ r }: { r: LeaveRequest }) {
  const fmtDt = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : null;

  type StepStatus = "done" | "waiting" | "rejected" | "pending";

  interface Step {
    label:   string;
    name?:   string | null;
    email?:  string | null;
    date?:   string | null;
    note?:   string | null;
    status:  StepStatus;
  }

  // Détecter si c'est un flux DG (responsable de département)
  // On le détecte si : pas de N+1 défini mais un reviewed_by existe avec un status APPROVED direct,
  // ou si l'API a marqué le reviewed_by comme DG
  const hasN1 = !!r.employee?.n1_manager_id;
  const hasN2 = r.requires_second_approval || !!r.second_reviewer || !!r.employee?.n2_manager_id;

  // Flux DG : pas de N+1/N+2 défini dans la hiérarchie standard mais une validation directe
  const isDgFlow = !hasN1 && !hasN2 && r.status === "APPROVED" && !!r.reviewed_by;

  const steps: Step[] = [];

  // Étape 0 — Soumission par l'employé
  steps.push({
    label:  "Demande soumise",
    name:   r.employee?.full_name ?? null,
    email:  r.employee?.email ?? null,
    date:   fmtDt(r.created_at),
    status: "done",
  });

  if (isDgFlow) {
    // Flux responsable de département → validation DG directe
    steps.push({
      label:  "Validation DG",
      name:   r.reviewed_by?.full_name ?? null,
      email:  r.reviewed_by?.email ?? null,
      date:   fmtDt(r.reviewed_at),
      note:   r.status === "REJECTED" ? r.reject_reason : null,
      status: r.status === "APPROVED" ? "done" : r.status === "REJECTED" ? "rejected" : "waiting",
    });
  } else {
    // Flux hiérarchique standard : N+1 puis N+2 si existe

    // Étape 1 — Validation N+1
    const n1Done    = !!r.reviewed_at;
    const n1Waiting = r.status === "PENDING";
    const n1Status: StepStatus =
      r.status === "REJECTED" && !r.requires_second_approval && !r.second_reviewer
        ? (n1Done ? "done" : "rejected")
        : n1Done
          ? "done"
          : n1Waiting ? "waiting" : "pending";

    steps.push({
      label:  "Validation N+1",
      name:   r.reviewed_by?.full_name ?? r.employee?.n1_manager_name ?? null,
      email:  r.reviewed_by?.email ?? null,
      date:   fmtDt(r.reviewed_at),
      note:   r.status === "REJECTED" && !r.second_reviewer ? r.reject_reason : null,
      status: n1Status,
    });

    // Étape 2 — Validation N+2 (si chaîne à 2 niveaux)
    if (hasN2) {
      const n2Done    = !!r.second_reviewed_at;
      const n2Waiting = r.status === "PENDING_SECOND";
      const n2Rejected = r.status === "REJECTED" && !!r.second_reviewer;

      const n2Status: StepStatus =
        n2Rejected ? "rejected"
        : n2Done    ? "done"
        : n2Waiting ? "waiting"
        : "pending";

      steps.push({
        label:  "Validation N+2",
        name:   r.second_reviewer?.full_name ?? r.employee?.n2_manager_name ?? null,
        email:  r.second_reviewer?.email ?? null,
        date:   fmtDt(r.second_reviewed_at),
        note:   n2Rejected ? r.reject_reason : null,
        status: n2Status,
      });
    }
  }

  const dot: Record<StepStatus, string> = {
    done:     "bg-emerald-500 border-emerald-300 shadow-emerald-200",
    waiting:  "bg-amber-400  border-amber-300   shadow-amber-200   animate-pulse",
    pending:  "bg-slate-200  border-slate-200",
    rejected: "bg-red-500    border-red-300     shadow-red-200",
  };
  const line: Record<StepStatus, string> = {
    done: "bg-emerald-200", waiting: "bg-amber-200", pending: "bg-slate-100", rejected: "bg-red-200",
  };
  const badgeStyle: Record<StepStatus, string> = {
    done:     "bg-emerald-50 text-emerald-700 border-emerald-200",
    waiting:  "bg-amber-50   text-amber-700   border-amber-200",
    pending:  "bg-slate-50   text-slate-400   border-slate-200",
    rejected: "bg-red-50     text-red-700     border-red-200",
  };
  const badgeText: Record<StepStatus, string> = {
    done: "✓ Validé", waiting: "En attente…", pending: "Non démarré", rejected: "✗ Rejeté",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {/* Titre section */}
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
          Circuit de validation
        </p>
      </div>

      {/* Steps */}
      <div>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className="flex gap-3">
              {/* Dot + ligne verticale */}
              <div className="flex flex-col items-center pt-0.5">
                <div className={`w-3 h-3 rounded-full border-2 shrink-0 shadow-sm ${dot[step.status]}`} />
                {!isLast && <div className={`w-0.5 flex-1 min-h-[28px] my-1.5 rounded-full ${line[step.status]}`} />}
              </div>

              {/* Contenu */}
              <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-4"}`}>
                {/* Ligne titre + badge + date */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">{step.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${badgeStyle[step.status]}`}>
                    {badgeText[step.status]}
                  </span>
                  {step.date && (
                    <span className="text-[10px] text-slate-400">{step.date}</span>
                  )}
                </div>

                {/* Nom + email */}
                {(step.name || step.email) && step.status !== "pending" && (
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    {step.name && (
                      <span className="text-xs text-slate-600 font-medium">{step.name}</span>
                    )}
                    {step.email && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <Mail className="h-2.5 w-2.5 shrink-0" />
                        {step.email}
                      </span>
                    )}
                  </div>
                )}

                {/* Motif de rejet */}
                {step.note && (
                  <div className="mt-1.5 flex items-start gap-1.5 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                    <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-600 leading-snug">{step.note}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
  const [docFile,            setDocFile]          = useState<File | null>(null);
  const [docLoading,         setDocLoading]       = useState(false);
  const [validateDocLoading, setValidateDocLoading] = useState(false);
  const [markAbsentLoading,  setMarkAbsentLoading] = useState(false);
  const { user } = useAuth();
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
    run(() => leaveRequestService.cancel(r.id, user?.employee_id ?? undefined).then(() => {}), "Demande annulée");

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

  const handleValidateDoc = async () => {
    setValidateDocLoading(true);
    try {
      await leaveRequestService.validateDocument(r.id, user?.employee_id);
      toast.success("Justificatif validé ✓");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la validation");
    } finally { setValidateDocLoading(false); }
  };

  const handleMarkAbsent = async (undo = false) => {
    setMarkAbsentLoading(true);
    try {
      await leaveRequestService.markAsAbsent(r.id, { marker_id: user?.employee_id, undo });
      toast.success(undo ? "Marquage non justifié annulé ✓" : "Congé marqué non justifié ✓");
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur");
    } finally { setMarkAbsentLoading(false); }
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
            <StatusBadge status={r.status} isConsumed={r.is_consumed} isInProgress={r.is_in_progress} />
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

          {/* ── Circuit de validation ────────────────────────────────────── */}
          <ValidationChain r={r} />

          {/* Motif */}
          {r.motif && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Motif</p>
              <p className="text-sm text-slate-700">{r.motif}</p>
            </div>
          )}

          {/* ── Section Justificatif ─────────────────────────────────────────── */}
          {r.leave_type?.requires_justification && (
            <div className={`rounded-2xl border-2 p-4 space-y-3 ${
              r.marked_as_absent
                ? "border-red-300 bg-red-50"
                : r.justification_validated
                  ? "border-emerald-300 bg-emerald-50"
                  : r.justification_document
                    ? "border-blue-200 bg-blue-50"
                    : "border-amber-200 bg-amber-50"
            }`}>
              {/* Titre */}
              <div className="flex items-center gap-2">
                {r.marked_as_absent
                  ? <UserX className="h-4 w-4 text-red-600" />
                  : r.justification_validated
                    ? <CheckCircle className="h-4 w-4 text-emerald-600" />
                    : r.justification_document
                      ? <FileCheck className="h-4 w-4 text-blue-600" />
                      : <Paperclip className="h-4 w-4 text-amber-600" />
                }
                <p className={`text-sm font-bold ${
                  r.marked_as_absent ? "text-red-700"
                  : r.justification_validated ? "text-emerald-700"
                  : r.justification_document ? "text-blue-700"
                  : "text-amber-700"
                }`}>
                  {r.marked_as_absent
                    ? "Non justifié — justificatif non fourni"
                    : r.justification_validated
                      ? "Justificatif validé ✓"
                      : r.justification_document
                        ? "Justificatif soumis — validation en attente"
                        : "Justificatif non encore fourni"
                  }
                </p>
              </div>

              {/* Date limite */}
              {!r.marked_as_absent && r.justification_deadline && !r.justification_validated && (
                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Date limite de dépôt : <span className="font-semibold">{fmtDate(r.justification_deadline)}</span>
                </p>
              )}

              {/* Info absence */}
              {r.marked_as_absent && (
                <div className="space-y-1">
                  {r.marked_as_absent_by && (
                    <p className="text-xs text-red-700">
                      Marqué par <strong>{r.marked_as_absent_by.full_name}</strong>
                      {r.marked_as_absent_at && (
                        <span className="ml-1">· le {new Date(r.marked_as_absent_at).toLocaleDateString("fr-FR")}</span>
                      )}
                    </p>
                  )}
                  <button
                    onClick={() => handleMarkAbsent(true)}
                    disabled={markAbsentLoading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition disabled:opacity-50">
                    {markAbsentLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Annuler le marquage
                  </button>
                </div>
              )}

              {/* Infos validateur */}
              {r.justification_validated && r.justification_validated_by && (
                <p className="text-xs text-emerald-700">
                  Validé par <strong>{r.justification_validated_by.full_name}</strong>
                  {r.justification_validated_at && (
                    <span className="ml-1 text-emerald-500">
                      · {new Date(r.justification_validated_at).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </p>
              )}

              {/* Lien vers document */}
              {r.justification_document && (
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={r.justification_document.startsWith("http") ? r.justification_document : `${API_BASE}${r.justification_document}`}
                    target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-bold rounded-xl transition ${
                      r.justification_validated
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}>
                    <ExternalLink className="h-3.5 w-3.5" /> Ouvrir le document
                  </a>

                  {/* Bouton de validation RH */}
                  {!r.justification_validated && !r.marked_as_absent && (
                    <button
                      onClick={handleValidateDoc}
                      disabled={validateDocLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-50">
                      {validateDocLoading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <CheckCircle className="h-3.5 w-3.5" />
                      }
                      Valider le justificatif
                    </button>
                  )}
                </div>
              )}

              {/* Pas encore de document : option marquer absent */}
              {!r.justification_document && !r.marked_as_absent && r.status === "APPROVED" && (
                <div className="flex items-start gap-3">
                  <p className="text-xs text-amber-600 flex-1">
                    L'employé doit soumettre un justificatif depuis son espace personnel.
                  </p>
                  <button
                    onClick={() => handleMarkAbsent(false)}
                    disabled={markAbsentLoading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition border border-red-200 disabled:opacity-50 whitespace-nowrap shrink-0">
                    {markAbsentLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                    Non justifié
                  </button>
                </div>
              )}

              {/* Justificatif soumis mais non validé : option marquer non justifié aussi */}
              {r.justification_document && !r.justification_validated && !r.marked_as_absent && r.status === "APPROVED" && (
                <button
                  onClick={() => handleMarkAbsent(false)}
                  disabled={markAbsentLoading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition border border-red-200 disabled:opacity-50">
                  {markAbsentLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                  Non justifié (doc insuffisant)
                </button>
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
                  <p className="text-sm font-semibold text-blue-800">En attente de validation hiérarchique</p>
                  <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                    Cette demande suit le circuit d'approbation hiérarchique (N+1 puis N+2 si applicable,
                    ou DG pour les responsables de département).
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

          {/* ── Actions APPROVED (masqué si congé terminé/consommé) ──────────── */}
          {r.status === "APPROVED" && !r.is_ended && !r.is_consumed && (
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

// ─── Modale d'annulation pour congés en cours ───────────────────────────────
function CancelInProgressModal({ request: r, onClose, onDone }: {
  request: LeaveRequest; onClose: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const daysToRestore = parseFloat(r.days ?? r.duration_days ?? "0");

  const handleConfirm = async () => {
    if (!r.id) return;
    setLoading(true);
    try {
      await leaveRequestService.cancel(r.id, user?.employee_id ?? undefined);
      toast.success(`Congé annulé · ${daysToRestore}j restitués au solde`);
      onDone();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'annulation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px]"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4">
          <div className="p-2.5 rounded-xl bg-red-100">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Annuler ce congé ?</h2>
            <p className="text-xs text-slate-400 mt-0.5">Demande #{r.id}</p>
          </div>
        </div>

        {/* Contenu */}
        <div className="px-6 py-4 space-y-3 border-t border-slate-100">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
            <p className="text-sm font-semibold text-red-900">Récapitulatif</p>
            <div className="text-sm text-red-800 space-y-1">
              <p>• <strong>{r.employee?.full_name}</strong></p>
              <p>• <strong>{r.leave_type?.label}</strong></p>
              <p>• Période : <strong>{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</strong></p>
              <p className="font-bold text-red-600 mt-2">
                ✓ Jours à restituer : <strong>{daysToRestore}j</strong>
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Cette action <strong>annulera</strong> le congé en cours et <strong>restituera</strong> les <strong>{daysToRestore} jour(s)</strong> dans le solde de congés de l'employé.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition disabled:opacity-50">
            Annuler
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50">
            {loading ? <ImSpinner2 className="animate-spin" size={14} /> : <Check className="h-4 w-4" />}
            Confirmer l'annulation
          </button>
        </div>
      </motion.div>
    </div>
  );
}
