import { useState } from "react";
import { Search } from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import { FaBell } from "react-icons/fa";
import type { AlertePeriodeEssai } from "@/services/employeeService";
import AlerteEmployeeDetailModal from "./AlerteEmployeeDetailModal";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function urgencyBadge(j: number): string {
  if (j <= 7)  return "bg-red-100 text-red-700 ring-1 ring-red-200";
  if (j <= 15) return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
  return "bg-green-100 text-green-700 ring-1 ring-green-200";
}

export default function AlertesPeriodeEssaiPanel({
  alertes,
  loading,
}: {
  alertes: AlertePeriodeEssai[];
  loading: boolean;
}) {
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<AlertePeriodeEssai | null>(null);

  const q = search.trim().toLowerCase();
  const rows = q
    ? alertes.filter((a) =>
        a.matricule.toLowerCase().includes(q) ||
        a.nom.toLowerCase().includes(q)       ||
        a.prenom.toLowerCase().includes(q)    ||
        (a.service || "").toLowerCase().includes(q)
      )
    : alertes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <ImSpinner2 className="animate-spin text-camublue-900" size={28} />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">

        {/* ── Barre de recherche ── */}
        <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par matricule, nom, service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
            />
          </div>
          {rows.length > 0 && (
            <span className="text-xs text-slate-500 shrink-0">
              {rows.length} employé{rows.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── Table / Empty ── */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <FaBell size={36} className="text-slate-200" />
            <p className="text-slate-400 text-sm">
              {alertes.length === 0
                ? "Aucune alerte dans les 30 prochains jours"
                : "Aucun résultat pour cette recherche"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
              <tr>
                {["Employé", "Matricule", "Fonction", "Service", "Type", "Date fin", "Jours"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((a) => (
                <tr
                  key={`${a.id}-${a.type_alerte}`}
                  onClick={() => setSelected(a)}
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {a.prenom} {a.nom}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">{a.matricule}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{a.fonction || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{a.service || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      a.type_alerte === "PERIODE_ESSAI"
                        ? "bg-violet-100 text-violet-700"
                        : a.type_alerte === "FIN_STAGE"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-orange-100 text-orange-700"
                    }`}>
                      {a.type_alerte === "PERIODE_ESSAI"
                        ? "Période d'essai"
                        : a.type_alerte === "FIN_STAGE"
                        ? "Fin de stage"
                        : "Fin CDD"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-medium tabular-nums text-xs">
                    {fmtDate(a.date_fin)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${urgencyBadge(a.jours_restants)}`}>
                      {a.jours_restants}j
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal détail employé ── */}
      <AlerteEmployeeDetailModal
        alerte={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
