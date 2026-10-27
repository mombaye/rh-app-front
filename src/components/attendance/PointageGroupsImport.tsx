// Import du fichier Bureau / Shift / Techniciens : définit le régime de pointage de chaque employé.
// Bureau → pointage normal · Shift → pointage shift · Techniciens → absents des pages de pointage.
import { useRef, useState } from "react";
import { Loader2, Users, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/api/axios";

type Summary = {
  dry_run: boolean;
  groups: Record<string, { in_file: number; matched: number; changed: number }>;
  conflicts: string[];
  unknown: string[];
  ignored_sheets: string[];
  unchanged_outside_file: number;
  outside_file: string[];
};

const WHERE: Record<string, string> = {
  Bureau: "Pointage normal",
  Shift: "Pointage shift",
  Techniciens: "Non affichés dans les pointages",
};

const send = async (file: File, dryRun: boolean): Promise<Summary> => {
  const fd = new FormData();
  fd.append("file", file);
  if (dryRun) fd.append("dry_run", "1");
  return (await api.post("/api/attendance/pointage-groups/import/", fd, { headers: { "Content-Type": undefined } })).data;
};

export default function PointageGroupsImport({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; summary: Summary } | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = async (file: File) => {
    const t = toast.loading("Lecture du fichier…");
    try {
      const summary = await send(file, true);
      toast.dismiss(t);
      setPending({ file, summary });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Fichier illisible", { id: t });
    }
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await send(pending.file, false);
      toast.success("Régimes de pointage mis à jour");
      setPending(null);
      onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Import impossible");
    } finally {
      setBusy(false);
    }
  };

  const s = pending?.summary;
  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) preview(f); }} />
      <button onClick={() => fileRef.current?.click()}
        title="Importer le fichier Bureau / Shift / Techniciens"
        className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition flex items-center gap-1.5">
        <Users className="h-4 w-4 text-camublue-900" /><span className="hidden sm:inline">Bureau / Shift / Techniciens</span>
      </button>

      {pending && s && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setPending(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="pg-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 id="pg-title" className="text-lg font-bold text-camublue-900">Importer « {pending.file.name} »</h2>
                <p className="text-sm text-slate-500">Rien n'est enregistré avant votre confirmation.</p>
              </div>
              <button onClick={() => setPending(null)} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><XIcon size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              <table className="w-full text-left">
                <thead className="text-xs text-slate-500">
                  <tr><th className="py-1 font-semibold">Onglet</th><th className="font-semibold">Où ils apparaissent</th><th className="font-semibold text-right">Employés</th><th className="font-semibold text-right">À modifier</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(s.groups).map(([name, g]) => (
                    <tr key={name}>
                      <td className="py-1.5 font-semibold text-slate-700">{name}</td>
                      <td className="text-slate-600">{WHERE[name] ?? ""}</td>
                      <td className="text-right">{g.matched}<span className="text-slate-400"> / {g.in_file}</span></td>
                      <td className="text-right font-bold text-camublue-900">{g.changed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {([
                ["Matricules du fichier absents de l'application", s.unknown],
                ["Employés présents dans plusieurs onglets (le premier est gardé)", s.conflicts],
                [`${s.unchanged_outside_file} employé(s) de l'application ne sont pas dans le fichier : ils ne changent pas`, s.outside_file],
              ] as [string, string[]][]).filter(([, l]) => l.length > 0).map(([label, l]) => (
                <details key={label} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <summary className="cursor-pointer font-semibold">{label.includes("employé(s) de l'application") ? label : `${l.length} — ${label}`}</summary>
                  <p className="mt-1 break-words">{l.slice(0, 60).join(", ")}{l.length > 60 ? "…" : ""}</p>
                </details>
              ))}
              {s.ignored_sheets.length > 0 && (
                <p className="text-xs text-slate-500">Onglets ignorés : {s.ignored_sheets.join(", ")}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setPending(null)} disabled={busy} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50">Annuler</button>
              <button onClick={confirm} disabled={busy}
                className="px-4 py-2 text-sm rounded-xl bg-camublue-900 text-white font-semibold hover:bg-camublue-800 disabled:opacity-60 flex items-center gap-1.5">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmer l'import
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
