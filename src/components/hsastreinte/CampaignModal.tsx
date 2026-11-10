// RH : créer ou modifier une période de saisie (date de début et de fin libres).
import { useState } from "react";
import { CalendarRange, Loader2, Save, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { HsCampaign, hsAstreinteService } from "@/services/hsAstreinteService";

export default function CampaignModal({ campaign, onClose, onSaved }: {
  campaign?: HsCampaign | null;
  onClose: () => void;
  onSaved: (c: HsCampaign) => void;
}) {
  const [label, setLabel] = useState(campaign?.label ?? "");
  const [start, setStart] = useState(campaign?.start_date ?? "");
  const [end, setEnd] = useState(campaign?.end_date ?? "");
  const [saving, setSaving] = useState(false);

  const nbDays = start && end && end >= start
    ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1 : 0;

  const save = async () => {
    if (!start || !end) { toast.error("Choisissez la date de début et la date de fin."); return; }
    if (end < start) { toast.error("La date de fin doit être après la date de début."); return; }
    setSaving(true);
    try {
      const data = { label: label.trim(), start_date: start, end_date: end };
      const c = campaign ? await hsAstreinteService.updateCampaign(campaign.id, data)
        : await hsAstreinteService.createCampaign(data);
      toast.success(campaign ? "Période modifiée." : "Période créée en brouillon.");
      onSaved(c);
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-[#003c71] flex items-center gap-2">
              <CalendarRange size={18} /> {campaign ? "Modifier la période" : "Nouvelle période de saisie"}
            </h2>
            <p className="text-xs text-slate-500">
              {campaign ? "Les saisies déjà faites sont conservées." : "Créée en brouillon : vous consultez les pointages, puis vous donnez le go."}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><XIcon size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Libellé (facultatif)</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder="Ex. Astreintes novembre 2026"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#003c71]" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Date de début</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#003c71]" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Date de fin</span>
              <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#003c71]" />
            </label>
          </div>
          {nbDays > 0 && <p className="text-xs text-slate-500">{nbDays} jour{nbDays > 1 ? "s" : ""} (62 au maximum)</p>}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Annuler</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
