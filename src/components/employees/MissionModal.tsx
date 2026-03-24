import { useState, useEffect } from "react";
import { ImSpinner2 } from "react-icons/im";
import { Employee } from "@/types/employee";
import { setMission } from "@/services/employeeService";
import toast from "react-hot-toast";

type Props = {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  onUpdated?: (employee: Employee) => void;
};

export default function MissionModal({ open, onClose, employee, onUpdated }: Props) {
  const [missionLabel, setMissionLabel] = useState("");
  const [missionStart, setMissionStart] = useState("");
  const [missionEnd, setMissionEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const isOnMission = employee?.on_mission ?? false;

  useEffect(() => {
    if (open && employee) {
      if (employee.on_mission) {
        setMissionLabel(employee.mission_label ?? "");
        setMissionStart(employee.mission_start ?? "");
        setMissionEnd(employee.mission_end ?? "");
      } else {
        setMissionLabel("");
        setMissionStart(new Date().toISOString().slice(0, 10));
        setMissionEnd("");
      }
    }
  }, [open, employee]);

  if (!open || !employee) return null;

  const handleSetMission = async () => {
    if (!missionStart) return;
    setLoading(true);
    try {
      const res = await setMission(employee.id, {
        on_mission: true,
        mission_label: missionLabel || undefined,
        mission_start: missionStart,
        mission_end: missionEnd || undefined,
      });
      toast.success(`${employee.prenom} ${employee.nom} est maintenant en mission`);
      onUpdated?.(res);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors de la mise en mission");
    } finally {
      setLoading(false);
    }
  };

  const handleEndMission = async () => {
    setLoading(true);
    try {
      const res = await setMission(employee.id, { on_mission: false });
      toast.success(`Fin de mission pour ${employee.prenom} ${employee.nom}`);
      onUpdated?.(res);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors de la fin de mission");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-800">
            {isOnMission ? "Gestion de la mission" : "Mettre en mission"}
          </h3>
          <p className="text-sm text-slate-500">
            Employ\u00e9 : {employee.prenom} {employee.nom} — {employee.matricule}
          </p>
        </div>

        {isOnMission && (
          <div className="px-6 pt-4">
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              <span className="font-semibold">En mission</span>
              {employee.mission_label && <> — {employee.mission_label}</>}
              {employee.mission_start && (
                <div className="text-xs mt-1 text-blue-600">
                  Du {new Date(employee.mission_start).toLocaleDateString("fr-FR")}
                  {employee.mission_end
                    ? ` au ${new Date(employee.mission_end).toLocaleDateString("fr-FR")}`
                    : " (sans date de fin)"}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Destination / Libell\u00e9 de la mission
            </label>
            <input
              type="text"
              value={missionLabel}
              onChange={(e) => setMissionLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-camublue-900"
              placeholder="Ex : Dakar \u2013 chantier Ouest"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Date de d\u00e9but</label>
              <input
                type="date"
                value={missionStart}
                onChange={(e) => setMissionStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-camublue-900"
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
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-camublue-900"
              />
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Un employ\u00e9 en mission ne sera <b>pas marqu\u00e9 absent</b> sur le pointage.
            Son statut appara\u00eetra comme <b>En mission</b>.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800"
          >
            Annuler
          </button>
          {isOnMission && (
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
            className="px-4 py-2 rounded-md bg-camublue-900 hover:bg-camublue-800 text-white inline-flex items-center gap-2"
          >
            {loading ? <ImSpinner2 className="animate-spin" /> : null}
            {isOnMission ? "Mettre \u00e0 jour" : "Mettre en mission"}
          </button>
        </div>
      </div>
    </div>
  );
}
