// Import d'un classeur de pointage HS & Astreinte (une feuille par période) : aperçu, puis enregistrement.
import { useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { HsImportResult, frDate, hsAstreinteService } from "@/services/hsAstreinteService";

export default function ImportModal({ campaignId, onClose, onImported }: { campaignId: number; onClose: () => void; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [preview, setPreview] = useState<HsImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (f: File, opts: { dryRun: boolean; sheet?: string; overwrite?: boolean }) => {
    setBusy(true); setError("");
    try {
      const r = await hsAstreinteService.importFile(f, campaignId, opts);
      if (opts.dryRun) { setPreview(r); }
      else {
        toast.success(`Import terminé : ${r.written + r.overwritten} saisie(s) enregistrée(s), ${r.zones_updated} zone(s) mise(s) à jour`);
        onImported(); onClose();
      }
    } catch (e: any) {
      const d = e?.response?.data;
      setError(d?.detail ?? "Import impossible");
      if (d?.sheets) setPreview((p) => p ?? ({ sheets: d.sheets, sheet: d.sheet ?? "" } as HsImportResult));
    } finally { setBusy(false); }
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f); setPreview(null); setSheet("");
    run(f, { dryRun: true, overwrite });
  };
  const changeSheet = (name: string) => { setSheet(name); if (file) run(file, { dryRun: true, sheet: name, overwrite }); };
  const changeOverwrite = (v: boolean) => { setOverwrite(v); if (file) run(file, { dryRun: true, sheet: sheet || undefined, overwrite: v }); };
  const ready = !!file && !!preview && preview.matched !== undefined && !error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="hs-import-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 id="hs-import-title" className="text-lg font-bold text-[#003c71]">Importer un fichier de pointage</h2>
            <p className="text-sm text-slate-500">Les codes de la feuille correspondant à la période sont repris, ainsi que la zone de chaque employé.</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-auto">
          <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-[#003c71] rounded-xl py-5 text-sm text-slate-600 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {file ? file.name : "Choisir le fichier Excel (.xlsx)"}
          </button>

          {error && <div role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>}

          {preview?.sheets && preview.sheets.length > 0 && (
            <div>
              <label htmlFor="hs-import-sheet" className="block text-xs font-semibold text-slate-600 mb-1">Feuilles utilisées</label>
              <select id="hs-import-sheet" value={sheet} onChange={(e) => changeSheet(e.target.value)} disabled={busy}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white">
                <option value="">Automatique : toutes les feuilles de la période</option>
                {[...preview.sheets].reverse().map((s) => (
                  <option key={s.name} value={s.name}>{s.name.trim()} · {frDate(s.start)} → {frDate(s.end)}</option>
                ))}
              </select>
              {preview.sheets_used && (
                <p className="text-[11px] text-slate-600 mt-1">
                  Lue{preview.sheets_used.length > 1 ? "s" : ""} : <strong>{preview.sheets_used.map((n) => n.trim()).join(" + ")}</strong>
                  {" "}— si la période s'étend sur deux feuilles, les deux sont reprises.
                </p>
              )}
            </div>
          )}
          {preview?.warning && (
            <div role="status" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{preview.warning}</div>
          )}

          {ready && preview && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ["Employés dans le fichier", preview.employees_in_file],
                  ["Reconnus", preview.matched],
                  [preview.zones_only ? "Jours repris" : "Saisies à enregistrer", preview.written + preview.overwritten],
                  ["Zones à mettre à jour", preview.zones_updated],
                ].map(([l, v]) => (
                  <div key={String(l)} className="border border-slate-200 rounded-xl px-3 py-2">
                    <p className="text-lg font-bold text-[#003c71]">{v}</p>
                    <p className="text-[11px] text-slate-500">{l}</p>
                  </div>
                ))}
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={overwrite} onChange={(e) => changeOverwrite(e.target.checked)} disabled={busy} className="mt-0.5" />
                <span>Remplacer les saisies déjà enregistrées par celles du fichier
                  <span className="block text-[11px] text-slate-500">Sinon les saisies existantes sont conservées ({preview.kept} concernée(s)).</span></span>
              </label>
              <ul className="text-xs text-slate-500 space-y-0.5">
                {preview.same_as_auto > 0 && <li>{preview.same_as_auto} jour(s) déjà remplis automatiquement (pointage, congés, sorties) : non répétés.</li>}
                {preview.days_off_refused > 0 && <li>{preview.days_off_refused} « Days Off » ignoré(s) : option non activée pour la BL de l'employé.</li>}
                {preview.after_exit > 0 && <li>{preview.after_exit} jour(s) après la date de sortie ignoré(s).</li>}
                {preview.unknown_codes > 0 && <li>{preview.unknown_codes} code(s) inconnu(s) ignoré(s).</li>}
              </ul>
              {preview.unmatched_count > 0 && (
                <details className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <summary className="cursor-pointer font-semibold">{preview.unmatched_count} employé(s) du fichier non reconnu(s) (ignorés)</summary>
                  <ul className="mt-1 max-h-32 overflow-auto">{preview.unmatched.map((u) => <li key={u}>{u}</li>)}</ul>
                </details>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50">Annuler</button>
          <button onClick={() => file && run(file, { dryRun: false, sheet: sheet || undefined, overwrite })} disabled={busy || !ready}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[#003c71] text-white hover:bg-[#002b52] disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} Importer
          </button>
        </div>
      </div>
    </div>
  );
}
