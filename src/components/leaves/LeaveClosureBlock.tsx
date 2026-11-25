import { useState } from "react";
import { CheckCircle2, Clock, XCircle, FileDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/useAuth";
import { leaveRequestService } from "@/services/leaveService";
import type { LeaveRequest } from "@/types/leave";

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";

/** Télécharge l'attestation de congé en PDF (clôture DG, ou congé déjà approuvé). */
export function AttestationButton({ req, className = "" }: { req: LeaveRequest; className?: string }) {
  const [loading, setLoading] = useState(false);
  if (!req.has_attestation) return null;
  const download = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await leaveRequestService.downloadAttestation(req.id);
    } catch {
      toast.error("Impossible de télécharger l'attestation de congé.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={download}
      disabled={loading}
      className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-[#003c71] hover:bg-[#002a50] text-white text-xs font-bold transition disabled:opacity-60 ${className}`}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
      Télécharger l'attestation de congé (PDF)
    </button>
  );
}

function Step({ state, title, sub }: { state: "done" | "waiting" | "pending" | "rejected"; title: string; sub?: string }) {
  const icon = state === "done" ? <CheckCircle2 size={13} className="text-green-600" />
    : state === "rejected" ? <XCircle size={13} className="text-red-500" />
    : <Clock size={13} className={state === "waiting" ? "text-purple-600" : "text-gray-300"} />;
  const bg = state === "done" ? "bg-green-100" : state === "rejected" ? "bg-red-100"
    : state === "waiting" ? "bg-purple-100" : "bg-gray-100";
  return (
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${bg}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

/**
 * Étapes de clôture après le circuit hiérarchique (Burkina Faso) : le RH, puis le DG qui délivre
 * l'attestation de congé. N'affiche rien si la clôture RH → DG n'est pas activée.
 */
export default function LeaveClosureBlock({ req }: { req: LeaveRequest }) {
  const { user } = useAuth();
  if (!user?.leave_rh_dg_closure) return null;
  if (["CANCELLED"].includes(req.status) && !req.hr_reviewed_at) return null;
  // Congé approuvé avant la mise en place de la clôture RH → DG : seulement le téléchargement
  if (req.status === "APPROVED" && !req.dg_reviewed_at) {
    return req.has_attestation ? (
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Attestation de congé</p>
        <AttestationButton req={req} />
      </div>
    ) : null;
  }

  const rejected = req.status === "REJECTED";
  const rhDone = !!req.hr_reviewed_at && (req.status !== "PENDING_RH");
  const dgDone = !!req.dg_reviewed_at && req.status === "APPROVED";
  const rhState = req.status === "PENDING_RH" ? "waiting"
    : rhDone ? (rejected && !req.dg_reviewed_at ? "rejected" : "done") : "pending";
  const dgState = req.status === "PENDING_DG" ? "waiting"
    : dgDone ? "done" : rejected && req.dg_reviewed_at ? "rejected" : "pending";

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Clôture & attestation</p>
      <Step
        state={rhState}
        title={`Clôture RH${req.hr_reviewer ? ` · ${req.hr_reviewer.full_name}` : rhState === "waiting" ? " · En attente" : ""}`}
        sub={fmt(req.hr_reviewed_at)}
      />
      <Step
        state={dgState}
        title={`Clôture DG${req.dg_reviewer ? ` · ${req.dg_reviewer.full_name}` : dgState === "waiting" ? " · En attente" : ""}`}
        sub={dgDone ? `${fmt(req.dg_reviewed_at)} · attestation délivrée` : fmt(req.dg_reviewed_at)}
      />
      <AttestationButton req={req} className="mt-2" />
    </div>
  );
}
