import dayjs from "dayjs";
import "dayjs/locale/fr";
dayjs.locale("fr");

export default function BulletinsMonthlyTable({
  rows,
  onOpenMonth,
  loading,
}: {
  rows: { year: number; month: number; total: number; sent: number; failed: number; pending: number }[];
  loading: boolean;
  onOpenMonth: (year: number, month: number) => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-800">Répartition des bulletins par mois</div>
          <div className="text-xs text-slate-500">Clique sur une ligne pour voir le détail.</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-300">
            <tr>
              <th className="px-4 py-2 text-left">Mois</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Succès</th>
              <th className="px-4 py-2 text-right">Échecs</th>
              <th className="px-4 py-2 text-right">Taux</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Chargement…
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((r) => {
                const label = dayjs(`${r.year}-${String(r.month).padStart(2, "0")}-01`).format("MMMM YYYY");
                const rate = r.total ? Math.round((r.sent / r.total) * 100) : 0;

                return (
                  <tr
                    key={`${r.year}-${r.month}`}
                    className="border-b border-slate-300 hover:bg-slate-50 cursor-pointer"
                    onClick={() => onOpenMonth(r.year, r.month)}
                  >
                    <td className="px-4 py-2 capitalize">{label}</td>
                    <td className="px-4 py-2 text-right font-medium">{r.total}</td>
                    <td className="px-4 py-2 text-right text-emerald-700 font-medium">{r.sent}</td>
                    <td className="px-4 py-2 text-right text-red-600 font-medium">{r.failed}</td>
                    <td className="px-4 py-2 text-right">{rate}%</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="px-3 py-1 rounded-md bg-camublue-900 text-white hover:bg-camublue-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMonth(r.year, r.month);
                        }}
                      >
                        Voir détails
                      </button>
                    </td>
                  </tr>
                );
              })}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Aucun bulletin sur cette période.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
