import { useEffect, useMemo, useState } from "react";
import { ImSpinner2 } from "react-icons/im";
import { Input } from "@/components/ui/input";
import { PayslipPreviewItem } from "@/services/employeeService";

export default function PayslipTargetsModal({
  open,
  items,
  onClose,
  onConfirm,
  sending,
  loading,
  progress = 0,
  totalPages,
  found,
  errorsCount,
}: {
  open: boolean;
  items: PayslipPreviewItem[];
  sending: boolean;
  loading: boolean;
  progress?: number;
  totalPages?: number;
  found?: number;
  errorsCount?: number;
  onClose: () => void;
  onConfirm: (matricules: string[]) => void;
}) {

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(items.filter((x) => x.can_send).map((x) => x.matricule))
  );


  useEffect(() => {
    setSelected(new Set(items.filter((x) => x.can_send).map((x) => x.matricule)));
}, [items]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return items;
    return items.filter((x) =>
      `${x.fullname} ${x.matricule} ${x.email}`.toLowerCase().includes(s)
    );
  }, [q, items]);

  const canSendItems = useMemo(() => items.filter((x) => x.can_send), [items]);
  const allSelected = canSendItems.length > 0 && canSendItems.every((x) => selected.has(x.matricule));

  const toggle = (m: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(m) ? n.delete(m) : n.add(m);
      return n;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSelected) {
        canSendItems.forEach((x) => n.delete(x.matricule));
      } else {
        canSendItems.forEach((x) => n.add(x.matricule));
      }
      return n;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-800">Sélection des destinataires</h3>
          <button
            onClick={onClose}
            disabled={sending}
            className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Fermer
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (nom, matricule, email)..."
          />
          <button
            onClick={toggleAll}
            disabled={sending || canSendItems.length === 0}
            className="px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
          >
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        </div>

        {loading && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
            <ImSpinner2 className="animate-spin" />
            <span className="font-medium">Analyse en cours… {progress}%</span>
            {typeof totalPages === "number" ? (
                <span className="text-slate-500">
                • ~{Math.max(1, Math.round((progress * totalPages) / 100))}/{totalPages} pages
                </span>
            ) : null}
            {typeof found === "number" ? <span className="text-slate-500">• détectés: {found}</span> : null}
            {typeof errorsCount === "number" ? <span className="text-slate-500">• erreurs: {errorsCount}</span> : null}
            </div>

            <div className="mt-2 h-2 w-full rounded bg-slate-200">
            <div className="h-2 rounded bg-camublue-900" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>

            <div className="mt-2 text-xs text-slate-500">
            Pour les gros fichiers (300+ pages), ça peut prendre plusieurs minutes.
            </div>
        </div>
        )}


        <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-slate-300">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-300">
              <tr>
                <th className="p-2 w-10"></th>
                <th className="p-2 text-left">Employé</th>
                <th className="p-2 text-left">Matricule</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.map((x) => (
                <tr key={x.matricule} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      disabled={!x.can_send || sending}
                      checked={selected.has(x.matricule)}
                      onChange={() => toggle(x.matricule)}
                    />
                  </td>
                  <td className="p-2">{x.fullname}</td>
                  <td className="p-2">{x.matricule}</td>
                  <td className="p-2">{x.email || "-"}</td>
                  <td className="p-2">
                    {x.can_send ? (
                      <span className="text-emerald-700">OK</span>
                    ) : (
                      <span className="text-red-600">{x.reason || "Non envoyable"}</span>
                    )}
                  </td>
                </tr>
              ))}

                {loading && (
                    <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                        Analyse en cours…
                    </td>
                    </tr>
                )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500">
                    Aucun résultat
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Sélectionnés : <b>{selected.size}</b>
          </div>

          <button
            onClick={() => onConfirm(Array.from(selected))}
             disabled={loading || sending || selected.size === 0}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-2 disabled:opacity-50"
          >
            {sending ? <ImSpinner2 className="animate-spin" /> : null}
            Envoyer aux sélectionnés
          </button>
        </div>
      </div>
    </div>
  );
}
