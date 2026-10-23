// Taux de remplissage du Team Planning : jours de chaque code projet / jours ouvrés hors congés.
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { FillRateRow, PlanningFilters, teamPlanningService } from "@/services/teamPlanningService";

// Couleurs des codes projets dans la barre (réutilisées dans l'ordre des codes de l'employé)
const SEGMENT_COLORS = ["#003c71", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#64748b"];

const fmt = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

function pctTone(p: number) {
  if (p >= 100) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (p >= 50) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

export default function FillRatesPanel({ filters, search }: { filters: PlanningFilters; search: string }) {
  const [rows, setRows] = useState<FillRateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    teamPlanningService.getFillRates(filters)
      .then((r) => setRows(r.rows))
      .catch((e) => toast.error(e?.response?.data?.detail ?? "Impossible de calculer le remplissage"))
      .finally(() => setLoading(false));
  }, [filters]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.matricule} ${r.nom} ${r.prenom}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const summary = useMemo(() => {
    const total = shown.reduce((s, r) => s + r.total_days, 0);
    const filled = shown.reduce((s, r) => s + r.project_days, 0);
    return {
      pct: total ? Math.round((filled * 1000) / total) / 10 : 0,
      complete: shown.filter((r) => r.pct >= 100).length,
      low: shown.filter((r) => r.pct < 50).length,
    };
  }, [shown]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#003c71]" /></div>;

  if (shown.length === 0) {
    return <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">Aucun employé à afficher.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Remplissage moyen", fmt(summary.pct)],
          ["Employés", String(shown.length)],
          ["À 100 %", String(summary.complete)],
          ["Moins de 50 %", String(summary.low)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-xl font-bold text-[#003c71]">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        Pourcentage = jours du code projet / jours ouvrés hors congés (week-ends et fériés exclus, sauf s'ils portent un projet).
        Le cumul est la somme des pourcentages de l'employé. Les BL marquées « 100 % d'office » (BL5, NOPE) sont comptées à 100 %.
      </p>

      <div className="bg-white border border-slate-200 rounded-xl overflow-auto max-h-[calc(100vh-20rem)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr className="text-left text-xs text-slate-600">
              <th className="px-3 py-2 font-semibold">Employé</th>
              <th className="px-3 py-2 font-semibold">BL</th>
              <th className="px-3 py-2 font-semibold min-w-[260px]">Codes projets</th>
              <th className="px-3 py-2 font-semibold text-right">Jours</th>
              <th className="px-3 py-2 font-semibold text-right">Cumul</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.employee_id} className="align-top">
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-700">{r.nom} {r.prenom}</div>
                  <div className="text-xs text-slate-400">{r.matricule}{r.line_manager ? ` · ${r.line_manager}` : ""}</div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {r.business_line}
                  {r.fixed_code && <div className="mt-1 text-[10px] font-semibold text-emerald-700 whitespace-nowrap" title="Code projet fixe : jours remplis d'office avec ce code">Code fixe</div>}
                  {r.forced && <div className="mt-1 text-[10px] font-semibold text-emerald-700 whitespace-nowrap" title="Cette BL est comptée à 100 % sans saisie">100 % d'office</div>}
                </td>
                <td className="px-3 py-2">
                  {r.forced ? (
                    <span className="text-xs text-emerald-700 italic">Aucun code projet requis — 100 % d'office</span>
                  ) : (<>
                  {/* Barre empilée : un segment par code projet */}
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex" role="img"
                    aria-label={`Remplissage ${fmt(r.pct)} : ${r.projects.map((p) => `${p.code} ${fmt(p.pct)}`).join(", ") || "aucun projet"}`}>
                    {r.projects.map((p, i) => (
                      <div key={p.code} style={{ width: `${Math.min(p.pct, 100)}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                        title={`${p.code} : ${p.days} j — ${fmt(p.pct)}`} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    {r.projects.length === 0 && <span className="text-xs text-slate-400 italic">Aucun projet saisi</span>}
                    {r.projects.map((p, i) => (
                      <span key={p.code} className="flex items-center gap-1 text-xs text-slate-600">
                        <span className="w-2 h-2 rounded-full" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                        <span className="font-mono">{p.code}</span> <strong>{fmt(p.pct)}</strong>
                      </span>
                    ))}
                  </div>
                  </>)}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-500 whitespace-nowrap">{r.project_days} / {r.total_days}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${pctTone(r.pct)}`}>{fmt(r.pct)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
