import { CheckCircle } from "lucide-react";
import type { AlertePeriodeEssai } from "@/services/employeeService";

export default function AlertesPeriodeEssaiPanel({
  alertes,
  loading,
}: {
  alertes: AlertePeriodeEssai[];
  loading: boolean;
}) {
  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const badgeStyle = (j: number) =>
    j <= 7
      ? "bg-red-100 text-red-700 ring-1 ring-red-200"
      : j <= 15
      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
      : "bg-green-100 text-green-700 ring-1 ring-green-200";

  const urgents = alertes.filter((a) => a.jours_restants <= 7);
  const proches = alertes.filter((a) => a.jours_restants > 7 && a.jours_restants <= 15);
  const aVenir  = alertes.filter((a) => a.jours_restants > 15);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (alertes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
        <CheckCircle className="h-10 w-10 text-green-400" />
        <p className="text-sm font-medium text-slate-500">
          Aucune fin de période d'essai dans les 30 prochains jours
        </p>
        <p className="text-xs">Tous les employés en période d'essai sont à jour.</p>
      </div>
    );
  }

  const groups = [
    { label: "Urgents", sub: "Expire dans 7 jours ou moins", rows: urgents, color: "text-red-700",   dot: "bg-red-500"   },
    { label: "Proches", sub: "8 à 15 jours",                 rows: proches, color: "text-amber-700", dot: "bg-amber-500" },
    { label: "À venir", sub: "16 à 30 jours",                rows: aVenir,  color: "text-green-700", dot: "bg-green-500" },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* KPI résumé */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Urgents ≤7j",   value: urgents.length, cls: "text-red-600",   bg: "bg-red-50 border-red-100"     },
          { label: "Proches 8–15j", value: proches.length, cls: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
          { label: "À venir 16–30j",value: aVenir.length,  cls: "text-green-600", bg: "bg-green-50 border-green-100" },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border p-3 text-center ${k.bg}`}>
            <p className={`text-2xl font-bold ${k.cls}`}>{k.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tableaux par groupe */}
      {groups.map((g) => (
        <div key={g.label} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <span className={`h-2 w-2 rounded-full shrink-0 ${g.dot}`} />
            <span className={`text-xs font-bold ${g.color}`}>{g.label}</span>
            <span className="text-xs text-slate-400">— {g.sub}</span>
            <span className="ml-auto text-xs font-semibold text-slate-600">
              {g.rows.length} employé{g.rows.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-4 py-2 text-left font-semibold text-slate-400">Matricule</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-400">Nom Prénom</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-400 hidden sm:table-cell">Fonction</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-400 hidden md:table-cell">Service</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-400 hidden lg:table-cell">Localisation</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-400">Fin essai</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-400">Jours restants</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{a.matricule}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{a.nom} {a.prenom}</td>
                    <td className="px-4 py-2.5 text-slate-500 hidden sm:table-cell">{a.fonction || "–"}</td>
                    <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{a.service || "–"}</td>
                    <td className="px-4 py-2.5 text-slate-500 hidden lg:table-cell">{a.localisation || "–"}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium tabular-nums">
                      {fmtDate(a.date_fin_periode_essai)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeStyle(a.jours_restants)}`}>
                        {a.jours_restants}j
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
