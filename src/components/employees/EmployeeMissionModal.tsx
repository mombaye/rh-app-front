// src/components/employees/EmployeeMissionModal.tsx
// Modale pour définir / terminer une mission professionnelle d'un employé.
// Impact : dans la vue Pointage, le statut "Absent" devient "En mission" sur la période définie.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiMapPin, FiCalendar, FiAlertCircle } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import { Briefcase, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { setMission, type MissionPayload } from "@/services/employeeService";
import type { Employee } from "@/types/employee";

interface Props {
  employee: Employee | null;
  onClose: () => void;
  onUpdated: (updated: Employee) => void;
}

export default function EmployeeMissionModal({ employee, onClose, onUpdated }: Props) {
  const isOpen = employee !== null;

  const [missionLabel, setMissionLabel] = useState("");
  const [missionStart, setMissionStart] = useState("");
  const [missionEnd, setMissionEnd]     = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Pré-remplit le formulaire si l'employé est déjà en mission
  useEffect(() => {
    if (!employee) return;
    setMissionLabel(employee.mission_label ?? "");
    setMissionStart(employee.mission_start ?? "");
    setMissionEnd(employee.mission_end ?? "");
    setError(null);
  }, [employee]);

  const isCurrentlyOnMission = !!employee?.on_mission;

  const handleSetMission = async () => {
    if (!employee) return;
    if (!missionStart) {
      setError("La date de début de mission est obligatoire.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: MissionPayload = {
        on_mission:    true,
        mission_label: missionLabel.trim() || undefined,
        mission_start: missionStart || null,
        mission_end:   missionEnd   || null,
      };
      const updated = await setMission(employee.id, payload);
      toast.success(`${employee.prenom} ${employee.nom} est désormais en mission.`);
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Une erreur est survenue.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEndMission = async () => {
    if (!employee) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await setMission(employee.id, { on_mission: false });
      toast.success(`Mission de ${employee.prenom} ${employee.nom} clôturée.`);
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Une erreur est survenue.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && employee && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[460px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-xl p-2">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base leading-tight">
                      {isCurrentlyOnMission ? "Gérer la mission" : "Envoyer en mission"}
                    </h2>
                    <p className="text-xs text-orange-100 mt-0.5">
                      {employee.prenom} {employee.nom} · {employee.matricule}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
                >
                  <FiX size={16} />
                </button>
              </div>

              {/* Badge statut actuel */}
              {isCurrentlyOnMission && (
                <div className="mt-4 bg-white/15 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
                  <span className="text-sm font-semibold">Actuellement en mission</span>
                  {employee.mission_label && (
                    <span className="text-xs text-orange-100">— {employee.mission_label}</span>
                  )}
                </div>
              )}
            </div>

            {/* Corps */}
            <div className="px-6 py-5 space-y-4">
              {/* Note d'information */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
                <FiAlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <span>
                  Durant la période de mission, le statut de pointage affichera
                  <strong> "En mission"</strong> à la place de "Absent".
                  Le pointage biométrique reste actif si l'employé bade.
                </span>
              </div>

              {/* Formulaire */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                  Intitulé / destination
                </label>
                <div className="relative">
                  <FiMapPin
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={missionLabel}
                    onChange={(e) => setMissionLabel(e.target.value)}
                    placeholder="Ex : Dakar – chantier Ouest, Formation Paris…"
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                    Début <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FiCalendar
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="date"
                      value={missionStart}
                      onChange={(e) => setMissionStart(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1.5">
                    Fin prévue
                  </label>
                  <div className="relative">
                    <FiCalendar
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="date"
                      value={missionEnd}
                      onChange={(e) => setMissionEnd(e.target.value)}
                      min={missionStart || undefined}
                      className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Laisser vide si inconnue</p>
                </div>
              </div>

              {/* Erreur */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                {/* Bouton "Terminer la mission" si déjà en mission */}
                {isCurrentlyOnMission && (
                  <button
                    onClick={handleEndMission}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    {loading ? (
                      <ImSpinner2 className="animate-spin" size={13} />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    )}
                    Terminer la mission
                  </button>
                )}

                {!isCurrentlyOnMission && (
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Annuler
                  </button>
                )}

                <button
                  onClick={handleSetMission}
                  disabled={loading}
                  className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
                >
                  {loading ? (
                    <><ImSpinner2 className="animate-spin" size={13} /> En cours…</>
                  ) : (
                    <><Briefcase className="h-4 w-4" />
                      {isCurrentlyOnMission ? "Mettre à jour" : "Confirmer la mission"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
