import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { FaHourglass, FaFileContract, FaEnvelope, FaPhone, FaUserTie, FaMapMarkerAlt } from "react-icons/fa";
import { getEmployeeById } from "@/services/employeeService";
import type { AlertePeriodeEssai } from "@/services/employeeService";
import type { Employee } from "@/types/employee";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function urgencyBadge(j: number) {
  if (j <= 7)  return { cls: "bg-red-100 text-red-700 ring-1 ring-red-200",     label: "Urgent" };
  if (j <= 15) return { cls: "bg-amber-100 text-amber-700 ring-1 ring-amber-200", label: "Proche" };
  return               { cls: "bg-green-100 text-green-700 ring-1 ring-green-200", label: "À venir" };
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{value || "—"}</p>
    </div>
  );
}

interface Props {
  alerte: AlertePeriodeEssai | null;
  onClose: () => void;
}

export default function AlerteEmployeeDetailModal({ alerte, onClose }: Props) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!alerte) return;
    setEmployee(null);
    setLoading(true);
    getEmployeeById(alerte.id)
      .then(setEmployee)
      .catch(() => setEmployee(null))
      .finally(() => setLoading(false));
  }, [alerte]);

  if (!alerte) return null;

  const badge    = urgencyBadge(alerte.jours_restants);
  const isPE     = alerte.type_alerte === "PERIODE_ESSAI";
  const isStage  = alerte.type_alerte === "FIN_STAGE";
  const initials = `${alerte.prenom?.[0] ?? ""}${alerte.nom?.[0] ?? ""}`.toUpperCase();

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-camublue-900/10 text-camublue-900 flex items-center justify-center text-base font-bold shrink-0">
                {initials}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {alerte.prenom} {alerte.nom}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {alerte.matricule}
                  {alerte.fonction ? ` · ${alerte.fonction}` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-400 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="p-6 space-y-5">

            {/* ── Bloc alerte ── */}
            <div className={`flex items-start gap-4 rounded-xl border p-4 ${
              isPE      ? "bg-violet-50 border-violet-100"
              : isStage ? "bg-blue-50 border-blue-100"
              :           "bg-orange-50 border-orange-100"
            }`}>
              <div className={`p-2.5 rounded-xl shrink-0 ${
                isPE ? "bg-violet-100" : isStage ? "bg-blue-100" : "bg-orange-100"
              }`}>
                {isPE
                  ? <FaHourglass className="text-violet-600" size={16} />
                  : isStage
                  ? <FaFileContract className="text-blue-600" size={16} />
                  : <FaFileContract className="text-orange-600" size={16} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${
                  isPE ? "text-violet-700" : isStage ? "text-blue-700" : "text-orange-700"
                }`}>
                  {isPE ? "Fin de période d'essai" : isStage ? "Fin de stage" : "Fin de contrat CDD"}
                </p>
                <p className="text-sm text-slate-700 mt-0.5">
                  Le <span className="font-semibold">{fmtDate(alerte.date_fin)}</span>
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${badge.cls}`}>
                {alerte.jours_restants}j — {badge.label}
              </span>
            </div>

            {/* ── Informations contractuelles ── */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Informations contractuelles
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow label="Type de contrat" value={
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    alerte.type_contrat === "CDD"
                      ? "bg-orange-100 text-orange-700"
                      : alerte.type_contrat === "STAGE"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {alerte.type_contrat}
                  </span>
                } />
                <InfoRow label="Service" value={alerte.service || "—"} />
                <InfoRow label="Fonction" value={alerte.fonction || "—"} />
                <InfoRow label="Localisation" value={alerte.localisation || "—"} />
                {loading ? (
                  <div className="col-span-2 flex items-center gap-2 text-slate-400 text-xs">
                    <Loader2 size={13} className="animate-spin" /> Chargement…
                  </div>
                ) : employee ? (
                  <>
                    <InfoRow label="Date d'embauche"    value={fmtDate(employee.date_embauche)} />
                    {employee.date_fin_cdd && (
                      <InfoRow label="Fin CDD"          value={fmtDate(employee.date_fin_cdd)} />
                    )}
                    {employee.date_fin_periode_essai && (
                      <InfoRow label="Fin période essai 1" value={fmtDate(employee.date_fin_periode_essai)} />
                    )}
                    {employee.date_fin_periode_essai_2 && (
                      <InfoRow label="Fin période essai 2" value={fmtDate(employee.date_fin_periode_essai_2)} />
                    )}
                    {employee.categorie && (
                      <InfoRow label="Catégorie"        value={employee.categorie} />
                    )}
                    {employee.anciennete != null && (
                      <InfoRow label="Ancienneté"       value={`${employee.anciennete} an${employee.anciennete !== 1 ? "s" : ""}`} />
                    )}
                  </>
                ) : null}
              </div>
            </div>

            {/* ── Informations personnelles & contact ── */}
            {!loading && employee && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Contact &amp; hiérarchie
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {employee.email && (
                    <div className="flex items-center gap-2 col-span-2">
                      <FaEnvelope size={12} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{employee.email}</span>
                    </div>
                  )}
                  {employee.telephone && (
                    <div className="flex items-center gap-2">
                      <FaPhone size={12} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700">{employee.telephone}</span>
                    </div>
                  )}
                  {employee.localisation && (
                    <div className="flex items-center gap-2">
                      <FaMapMarkerAlt size={12} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700">{employee.localisation}</span>
                    </div>
                  )}
                  {(employee.n1_manager_name || employee.manager) && (
                    <div className="flex items-center gap-2 col-span-2">
                      <FaUserTie size={12} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-700">
                        {employee.n1_manager_name || employee.manager}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
