import { useState, useEffect } from "react";
import { ImSpinner2 } from "react-icons/im";
import { Employee } from "@/types/employee";

type MissionPayload = {
  on_mission: boolean;
  mission_label?: string;
  mission_start?: string | null;
  mission_end?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  onConfirm: (payload: MissionPayload) => Promise<void>;
};

export default function MissionModal({ open, onClose, employee, onConfirm }: Props) {
  const [missionLabel, setMissionLabel] = useState("");
  const [missionStart, setMissionStart] = useState("");
  const [missionEnd, setMissionEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const isAlreadyOnMission = !!employee?.on_mission;

  useEffect(() => {
    if (open && employee) {
      setMissionLabel(employee.mission_label ?? "");
      setMissionStart(employee.mission_start ?? new Date().toISOString().slice(0, 10));
      setMissionEnd(employee.mission_end ?? "");
    }
  }, [open, employee]);

  if (!open || !employee) return null;

  const handleSetMission = async () => {
    setLoading(true);
    try {
      await onConfirm({
        on_mission: true,
        mission_label: missionLabel || undefined,
        mission_start: missionStart || null,
        mission_end: missionEnd || null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleEndMission = async () => {
    setLoading(true);
    try {
      await onConfirm({
        on_mission: false,
        mission_label: "",
        mission_start: null,
        mission_end: null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-800">
            {isAlreadyOnMission ? "Gestion de la mission" : "Définir en mission"}
          </h3>
          <p className="text-sm text-slate-500">
            Employé : {employee.prenom} {employee.nom} — {employee.matricule}
          </p>
        </div>

        {isAlreadyOnMission && (
          <div className="mx-6 mt-4 rounded-xl bg-indigo-50 border border-indigo-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span className="text-sm font-semibold text-indigo-700">Actuellement en mission</span>
            </div>
            {employee.mission_label && (
              <p className="text-sm text-indigo-600 ml-4">{employee.mission_label}</p>
            )}
            <p className="text-xs text-indigo-500 ml-4 mt-1">
              Depuis le {employee.mission_start ?? "—"}
              {employee.mission_end ? ` jusqu'au ${employee.mission_end}` : " (fin non définie)"}
            </p>
          </div>
        )}

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Intitulé / destination de la mission
            </label>
            <input
              type="text"
              value={missionLabel}
              onChange={(e) => setMissionLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: Mission Dakar, Audit terrain, Formation externe…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Date de début</label>
              <input
                type="date"
                value={missionStart}
                onChange={(e) => setMissionStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Date de fin <span className="text-slate-400">(optionnel)</span>
              </label>
              <input
                type="date"
                value={missionEnd}
                onChange={(e) => setMissionEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Un employé en mission ne sera <b>pas marqué absent</b> sur le pointage.
            Son statut affichera <b>« En Mission »</b>.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800"
          >
            Annuler
          </button>

          {isAlreadyOnMission && (
            <button
              onClick={handleEndMission}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white inline-flex items-center gap-2"
            >
              {loading ? <ImSpinner2 className="animate-spin" /> : null}
              Terminer la mission
            </button>
          )}

          <button
            onClick={handleSetMission}
            disabled={loading || !missionStart}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white inline-flex items-center gap-2"
          >
            {loading ? <ImSpinner2 className="animate-spin" /> : null}
            {isAlreadyOnMission ? "Mettre à jour" : "Définir en mission"}
          </button>
        </div>
      </div>
    </div>
  );
}
