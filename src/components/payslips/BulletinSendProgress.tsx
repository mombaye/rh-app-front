import { fetchBulletinProgress } from "@/services/employeeService";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import { CheckCircle, XCircle, Send, AlertTriangle } from "lucide-react";

type ProgressStatus = "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE";

interface ProgressData {
  task_id: string;
  status: ProgressStatus;
  progress: number;
  sent: number;
  failed: number;
  total: number;
  errors: string[];
}

interface Props {
  taskId: string;
  onDone?: () => void;
}

export default function BulletinSendProgress({ taskId, onDone }: Props) {
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let timer = setInterval(async () => {
      try {
        const data = await fetchBulletinProgress(taskId);
        setProgress(data);

        if (data.status === "SUCCESS") {
          clearInterval(timer);
          const msg = data.failed > 0
            ? `Envoi terminé : ${data.sent} réussi(s), ${data.failed} échec(s)`
            : `✓ ${data.sent} bulletin(s) envoyé(s) avec succès !`;
          toast.success(msg, { duration: 5000 });
          onDone?.();
        }
        if (data.status === "FAILURE") {
          clearInterval(timer);
          toast.error("Erreur lors de l'envoi des bulletins.", { duration: 5000 });
          onDone?.();
        }
      } catch {}
    }, 1500);

    return () => clearInterval(timer);
  }, [taskId, onDone]);

  if (!progress) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 flex items-center gap-3">
        <ImSpinner2 className="animate-spin h-5 w-5 text-camublue-900 shrink-0" />
        <span className="text-sm text-slate-600">Initialisation de l'envoi…</span>
      </div>
    );
  }

  const isDone    = progress.status === "SUCCESS" || progress.status === "FAILURE";
  const isSuccess = progress.status === "SUCCESS";
  const isFailure = progress.status === "FAILURE";
  const hasErrors = progress.errors && progress.errors.length > 0;

  return (
    <div className={`rounded-2xl border shadow-sm p-4 space-y-3 transition-colors ${
      isSuccess && progress.failed === 0 ? "border-emerald-200 bg-emerald-50/50"
      : isSuccess ? "border-amber-200 bg-amber-50/50"
      : isFailure ? "border-red-200 bg-red-50/50"
      : "border-slate-200 bg-white"
    }`}>
      {/* Titre + icône */}
      <div className="flex items-center gap-2.5">
        {isDone ? (
          isSuccess
            ? progress.failed === 0
              ? <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              : <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            : <XCircle className="h-5 w-5 text-red-500 shrink-0" />
        ) : (
          <Send className="h-5 w-5 text-camublue-900 shrink-0" />
        )}
        <p className={`text-sm font-semibold ${
          isSuccess && progress.failed === 0 ? "text-emerald-700"
          : isSuccess ? "text-amber-700"
          : isFailure ? "text-red-700"
          : "text-slate-800"
        }`}>
          {isSuccess && progress.failed === 0
            ? `Envoi terminé — ${progress.sent} bulletin(s) envoyé(s) avec succès`
            : isSuccess
            ? `Envoi terminé — ${progress.sent} réussi(s), ${progress.failed} échec(s)`
            : isFailure
            ? "Erreur lors de l'envoi"
            : "Envoi des bulletins en cours…"}
        </p>
        {!isDone && <ImSpinner2 className="animate-spin h-4 w-4 text-camublue-900 ml-auto shrink-0" />}
      </div>

      {/* Barre de progression */}
      {!isDone && (
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-2 rounded-full bg-camublue-900 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress.progress))}%` }}
          />
        </div>
      )}

      {/* Compteurs */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
          <CheckCircle className="h-3.5 w-3.5" /> {progress.sent} envoyé{progress.sent > 1 ? "s" : ""}
        </span>
        {progress.failed > 0 && (
          <span className="flex items-center gap-1 text-red-500 font-semibold">
            <XCircle className="h-3.5 w-3.5" /> {progress.failed} échec{progress.failed > 1 ? "s" : ""}
          </span>
        )}
        <span className="text-slate-400 text-xs">/ {progress.total} total</span>
        {!isDone && progress.total > 0 && (
          <span className="text-slate-400 text-xs ml-auto">{progress.progress}%</span>
        )}
      </div>

      {/* Détail des erreurs */}
      {hasErrors && (
        <details className="text-xs rounded-xl border border-red-200 bg-red-50 p-3">
          <summary className="cursor-pointer font-semibold text-red-600">
            Voir les erreurs ({progress.errors.length})
          </summary>
          <ul className="mt-2 space-y-0.5 pl-3 text-red-500">
            {progress.errors.map((err, i) => <li key={i}>• {err}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
