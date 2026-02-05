import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { ImSpinner2 } from "react-icons/im";
import { fetchBulletinsLogs, deleteBulletinLog, type BulletinLogItem } from "@/services/employeeService";

type StatusFilter = "all" | "sent" | "failed" | "pending";

export default function BulletinsLogsModal({
  open,
  title,
  start,
  end,
  scope,
  onClose,
  onChanged, // refresh summary/table après delete
}: {
  open: boolean;
  title: string;
  start: string;
  end: string;
  scope?: { year?: number; month?: number; status?: "sent" | "failed" | "pending" };
  onClose: () => void;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(scope?.status ?? "all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [count, setCount] = useState(0);
  const [rows, setRows] = useState<BulletinLogItem[]>([]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count]);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setSearch("");
    setStatus(scope?.status ?? "all");
  }, [open, scope?.status]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await fetchBulletinsLogs({
          start,
          end,
          year: scope?.year,
          month: scope?.month,
          status: status === "all" ? undefined : status,
          search: search.trim() || undefined,
          page,
          page_size: pageSize,
        });

        if (!cancelled) {
          setRows(data.results || []);
          setCount(data.count || 0);
        }
      } catch (e: any) {
        toast.error(e?.response?.data?.error || "Erreur chargement des bulletins");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [open, start, end, scope?.year, scope?.month, status, search, page]);

  const doDelete = async (id: number) => {
    if (!window.confirm("Supprimer ce log d’envoi ?")) return;

    const t = toast.loading("Suppression…");
    try {
      await deleteBulletinLog(id);
      toast.success("Supprimé.", { id: t });

      // refresh current page (si page vide après delete => recule)
      const newCount = Math.max(0, count - 1);
      const newTotalPages = Math.max(1, Math.ceil(newCount / pageSize));
      if (page > newTotalPages) setPage(newTotalPages);

      // re-fetch + refresh summary/table
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Suppression impossible", { id: t });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-800">{title}</div>
            <div className="text-xs text-slate-500">
              Période : {start} → {end}
              {scope?.year && scope?.month ? ` • Mois: ${scope.year}-${String(scope.month).padStart(2, "0")}` : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Fermer
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-200 flex flex-col md:flex-row gap-2 md:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (matricule / email)…"
            className="w-full md:w-80 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-camublue-900"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="w-full md:w-48 border border-slate-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">Tous statuts</option>
            <option value="sent">Succès</option>
            <option value="failed">Échecs</option>
            <option value="pending">En attente</option>
          </select>

          <div className="md:ml-auto text-sm text-slate-600">
            {loading ? "Chargement…" : <span>Total : <b>{count}</b></span>}
          </div>
        </div>

        <div className="overflow-auto max-h-[520px]">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-300">
              <tr>
                <th className="px-4 py-2 text-left">Matricule</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <ImSpinner2 className="animate-spin" /> Chargement…
                    </span>
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-300 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{r.matricule}</td>
                    <td className="px-4 py-2">{r.email || "-"}</td>
                    <td className="px-4 py-2">
                      {r.status === "sent" ? (
                        <span className="text-emerald-700 font-medium">Succès</span>
                      ) : r.status === "failed" ? (
                        <span className="text-red-600 font-medium">Échec</span>
                      ) : (
                        <span className="text-yellow-600 font-medium">En attente</span>
                      )}
                      {r.message ? <div className="text-xs text-slate-500">{r.message}</div> : null}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {r.sent_at ? dayjs(r.sent_at).format("DD/MM/YYYY HH:mm") : "-"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => doDelete(r.id)}
                        className="px-3 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50"
                        title="Supprimer ce log"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Aucun résultat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Page <b>{page}</b> / <b>{totalPages}</b>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-md border border-slate-300 disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded-md border border-slate-300 disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
