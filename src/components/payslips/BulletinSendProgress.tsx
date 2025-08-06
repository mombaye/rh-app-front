import { fetchBulletinProgress } from "@/services/employeeService";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";

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
  onDone?: () => void; // callback optionnel quand fini
}

export default function BulletinSendProgress({ taskId, onDone }: Props) {
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let timer = setInterval(async () => {
      try {
        const data = await fetchBulletinProgress(taskId);
        setProgress(data);

        // Notifications auto selon statut
        if (data.status === "SUCCESS") {
          toast.success("Tous les bulletins ont été envoyés !");
          onDone && onDone();
          clearInterval(timer);
        }
        if (data.status === "FAILURE") {
          toast.error("Des erreurs sont survenues lors de l'envoi.");
          onDone && onDone();
          clearInterval(timer);
        }
      } catch (e) {
        // Optionnel : log, stop timer si 404
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [taskId, onDone]);

  if (!progress) {
    return (
      <div className="flex items-center gap-2 mt-4">
        <ImSpinner2 className="animate-spin text-camublue-900" />
        <span>Initialisation du suivi...</span>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-4 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="flex items-center gap-3 mb-2">
        <ImSpinner2 className={`text-camublue-900 ${progress.status === "SUCCESS" ? "hidden" : "animate-spin"}`} />
        <div className="font-bold text-lg text-camublue-900">
          {progress.status === "SUCCESS"
            ? "Envoi terminé"
            : progress.status === "FAILURE"
              ? "Erreur lors de l'envoi"
              : "Envoi des bulletins en cours..."}
        </div>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full my-2">
        <div
          className="h-3 rounded-full bg-camublue-900 transition-all"
          style={{ width: `${progress.progress}%` }}
        ></div>
      </div>
      <div className="flex justify-between text-sm text-gray-700 mb-2">
        <span>
          <b>{progress.sent}</b> envoyés
        </span>
        <span>
          <b>{progress.failed}</b> échecs
        </span>
        <span>
          <b>{progress.total}</b> total
        </span>
      </div>
      {progress.errors && progress.errors.length > 0 && (
        <details className="text-sm text-red-500 mt-2">
          <summary className="cursor-pointer">Voir les erreurs</summary>
          <ul className="list-disc pl-5">
            {progress.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
