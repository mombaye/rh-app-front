import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Plus,
  GitBranch,
} from "lucide-react";
import toast from "react-hot-toast";
import HierarchyModal from "@/components/leaves/HierarchyModal";
import {
  getLeaveRequests,
  approveLeave,
  rejectLeave,
  cancelLeave,
} from "@/services/leaveService";
import type { LeaveRequest } from "@/services/leaveService";

const STATUS_STYLES: Record<
  string,
  { badge: string; label: string; icon: React.ReactNode }
> = {
  PENDING: {
    badge: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
    label: "En attente",
    icon: <Clock size={12} />,
  },
  APPROVED: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    label: "Approuv\u00e9",
    icon: <CheckCircle size={12} />,
  },
  REJECTED: {
    badge: "bg-red-50 text-red-700 ring-1 ring-red-200",
    label: "Rejet\u00e9",
    icon: <XCircle size={12} />,
  },
  CANCELLED: {
    badge: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    label: "Annul\u00e9",
    icon: <XCircle size={12} />,
  },
};

export default function LeavesPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [hierarchyOpen, setHierarchyOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params =
        statusFilter !== "ALL" ? { status: statusFilter } : undefined;
      const reqs = await getLeaveRequests(params);
      setRequests(reqs);
    } catch {
      toast.error("Erreur lors du chargement des demandes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleApprove = async (id: number) => {
    try {
      await approveLeave(id);
      toast.success("Demande approuv\u00e9e");
      fetchData();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error || "Erreur lors de l'approbation"
      );
    }
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt("Motif du rejet (optionnel) :");
    if (reason === null) return;
    try {
      await rejectLeave(id, reason || "");
      toast.success("Demande rejet\u00e9e");
      fetchData();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error || "Erreur lors du rejet"
      );
    }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm("Confirmer l'annulation de cette demande ?"))
      return;
    try {
      await cancelLeave(id);
      toast.success("Demande annul\u00e9e");
      fetchData();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error || "Erreur lors de l'annulation"
      );
    }
  };

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "PENDING").length,
    approved: requests.filter((r) => r.status === "APPROVED").length,
    rejected: requests.filter((r) => r.status === "REJECTED").length,
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row justify-between gap-3 md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-camublue-900">
              Gestion des cong\u00e9s
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Suivi et validation des demandes de cong\u00e9s
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Bouton Hi\u00e9rarchie */}
            <button
              onClick={() => setHierarchyOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-camublue-900 text-camublue-900 hover:bg-camublue-900 hover:text-white transition font-medium"
            >
              <GitBranch size={16} />
              Hi\u00e9rarchie
            </button>

            {/* Bouton Nouvelle demande */}
            <button
              onClick={() =>
                toast("Formulaire de nouvelle demande \u00e0 venir", {
                  icon: "\ud83d\udcc5",
                })
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-800 transition font-medium"
            >
              <Plus size={16} />
              Nouvelle demande
            </button>
          </div>
        </div>

        {/* ── Stats cards ────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total",
              value: stats.total,
              color: "text-camublue-900",
              bg: "bg-camublue-50",
            },
            {
              label: "En attente",
              value: stats.pending,
              color: "text-yellow-700",
              bg: "bg-yellow-50",
            },
            {
              label: "Approuv\u00e9s",
              value: stats.approved,
              color: "text-emerald-700",
              bg: "bg-emerald-50",
            },
            {
              label: "Rejet\u00e9s",
              value: stats.rejected,
              color: "text-red-700",
              bg: "bg-red-50",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-xl p-4 ${s.bg} border border-slate-200 shadow-sm`}
            >
              <p className="text-sm text-slate-600">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Filters ────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-slate-600">
            Filtrer :
          </span>
          {["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-sm px-3 py-1.5 rounded-full font-medium transition ${
                  statusFilter === s
                    ? "bg-camublue-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s === "ALL"
                  ? "Tous"
                  : STATUS_STYLES[s]?.label ?? s}
              </button>
            )
          )}
          <button
            onClick={fetchData}
            className="ml-auto p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
            title="Rafra\u00eechir"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>

        {/* ── Table ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
              <RefreshCw size={18} className="animate-spin" />
              <span>Chargement...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <CalendarDays size={40} className="mb-3 opacity-30" />
              <p className="font-medium">Aucune demande de cong\u00e9</p>
              <p className="text-sm mt-1">
                Les demandes appara\u00eetront ici une fois cr\u00e9\u00e9es
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      Employ\u00e9
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      P\u00e9riode
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">
                      Jours
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      Statut
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req, i) => {
                    const style = STATUS_STYLES[req.status];
                    return (
                      <tr
                        key={req.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 transition ${
                          i % 2 === 0 ? "" : "bg-slate-50/50"
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {req.employee.prenom} {req.employee.nom}
                          <span className="block text-xs text-slate-400">
                            {req.employee.matricule}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${req.leave_type.color}20`,
                              color: req.leave_type.color,
                            }}
                          >
                            {req.leave_type.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {req.start_date} &rarr; {req.end_date}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-camublue-900">
                          {req.days}j
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style?.badge}`}
                          >
                            {style?.icon}
                            {style?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {req.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() =>
                                    handleApprove(req.id)
                                  }
                                  className="px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition font-medium"
                                >
                                  Approuver
                                </button>
                                <button
                                  onClick={() =>
                                    handleReject(req.id)
                                  }
                                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                                >
                                  Rejeter
                                </button>
                              </>
                            )}
                            {(req.status === "PENDING" ||
                              req.status === "APPROVED") && (
                              <button
                                onClick={() =>
                                  handleCancel(req.id)
                                }
                                className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
                              >
                                Annuler
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Modals ──────────────────────────────────────── */}
      <HierarchyModal
        open={hierarchyOpen}
        onClose={() => setHierarchyOpen(false)}
      />
    </AppLayout>
  );
}
