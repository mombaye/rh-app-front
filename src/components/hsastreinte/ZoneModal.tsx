// Changer la zone d'un employé (ou la retirer) : saisie libre, avec les zones déjà connues en suggestion.
import { useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import toast from "react-hot-toast";
import { HsRow, hsAstreinteService } from "@/services/hsAstreinteService";

export default function ZoneModal({ row, zones, onClose, onSaved }: {
  row: HsRow; zones: string[]; onClose: () => void; onSaved: (employeeId: number, zone: string) => void;
}) {
  const [zone, setZone] = useState(row.zone ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (value: string) => {
    setBusy(true);
    try {
      const r = await hsAstreinteService.setZone(row.employee_id, value);
      toast.success(r.zone ? `Zone « ${r.zone} » enregistrée` : "Zone retirée");
      onSaved(row.employee_id, r.zone);
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Enregistrement impossible");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby="zone-title" onSubmit={(e) => { e.preventDefault(); save(zone); }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 id="zone-title" className="text-base font-bold text-[#003c71] flex items-center gap-2"><MapPin size={16} /> Zone de l'employé</h2>
            <p className="text-sm text-slate-500 truncate">{row.nom} {row.prenom} · {row.matricule}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-2">
          <label htmlFor="zone-input" className="block text-xs font-semibold text-slate-600">Zone</label>
          <input id="zone-input" list="zone-list" value={zone} onChange={(e) => setZone(e.target.value)} autoFocus maxLength={100}
            placeholder="Ex. Zone3, TEAM1…" className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#003c71]" />
          <datalist id="zone-list">{zones.filter(Boolean).map((z) => <option key={z} value={z} />)}</datalist>
          <p className="text-[11px] text-slate-500">Laissez vide pour retirer la zone.</p>
        </div>
        <div className="flex justify-between gap-2 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={() => save("")} disabled={busy || !row.zone}
            className="px-3 py-2 text-sm rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-40">Retirer</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={busy || zone.trim() === (row.zone ?? "")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[#003c71] text-white hover:bg-[#002b52] disabled:opacity-50">
              {busy && <Loader2 size={14} className="animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
