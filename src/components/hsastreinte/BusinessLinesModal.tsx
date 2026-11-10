// RH : pour chaque BL, les éditeurs autorisés à remplir le pointage et l'option « Days Off ».
// Un éditeur voit et remplit tous les agents rattachés à ses BL.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Network, Save, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { EmpBrief, HsBusinessLine, hsAstreinteService } from "@/services/hsAstreinteService";
import EmployeeChecklist from "@/components/hsastreinte/EmployeeChecklist";

export default function BusinessLinesModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [bls, setBls] = useState<HsBusinessLine[]>([]);
  const [employees, setEmployees] = useState<EmpBrief[]>([]);
  const [current, setCurrent] = useState("");
  const [editors, setEditors] = useState<Set<number>>(new Set());
  const [daysOff, setDaysOff] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apply = (data: { business_lines: HsBusinessLine[]; employees: EmpBrief[] }) => {
    setBls(data.business_lines);
    setEmployees(data.employees);
  };

  useEffect(() => {
    hsAstreinteService.getBusinessLines()
      .then((d) => { apply(d); if (d.business_lines[0]) select(d.business_lines[0]); })
      .catch(() => toast.error("Impossible de charger les BL"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (bl: HsBusinessLine) => {
    setCurrent(bl.code);
    setEditors(new Set(bl.editor_ids));
    setDaysOff(bl.days_off_enabled);
    setDirty(false);
  };

  const pick = (bl: HsBusinessLine) => {
    if (dirty && !window.confirm(`Les modifications de ${current} ne sont pas enregistrées. Continuer ?`)) return;
    select(bl);
  };

  const save = async () => {
    setSaving(true);
    try {
      apply(await hsAstreinteService.saveBusinessLine(current, [...editors], daysOff));
      setDirty(false);
      toast.success(`${current} : ${editors.size} éditeur(s) enregistré(s)`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  // Les membres de la BL en premier dans la liste
  const sorted = useMemo(() => [...employees].sort((a, b) =>
    Number(b.bl === current) - Number(a.bl === current)), [employees, current]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-[#003c71] flex items-center gap-2"><Network size={18} /> Accès par BL</h2>
            <p className="text-xs text-slate-500">Les éditeurs d'une BL voient et remplissent le pointage de tous ses agents, et seulement ceux-là.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><XIcon size={16} /></button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#003c71]" /></div>
        ) : bls.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-6 text-center">
            Aucune BL : renseignez la Business Line sur les fiches employés.
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
            <ul className="sm:w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 overflow-auto max-h-40 sm:max-h-none p-2 space-y-1">
              {bls.map((b) => (
                <li key={b.code}>
                  <button onClick={() => pick(b)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm ${b.code === current ? "bg-[#003c71] text-white" : "hover:bg-slate-50 text-slate-700"}`}>
                    <div className="font-semibold flex items-center justify-between gap-2">
                      {b.code}
                      {b.days_off_enabled && <span className={`text-[9px] px-1.5 py-0.5 rounded ${b.code === current ? "bg-white/20" : "bg-teal-100 text-teal-700"}`}>Days Off</span>}
                    </div>
                    <div className={`text-[11px] ${b.code === current ? "text-white/70" : "text-slate-400"}`}>
                      {b.nb_agents} agent(s) · {b.editor_ids.length} éditeur(s)
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex-1 min-h-0 p-4 flex flex-col gap-3">
              <label className="flex items-start gap-2 text-sm text-slate-700 bg-teal-50/60 border border-teal-100 rounded-xl px-3 py-2">
                <input type="checkbox" className="mt-0.5 accent-teal-600" checked={daysOff}
                  onChange={(e) => { setDaysOff(e.target.checked); setDirty(true); }} />
                <span>
                  <b>Option « Days Off » (D)</b>
                  <span className="block text-xs text-slate-500">Ajoute le code D dans la liste ; les Days Off sont déduits du nombre d'astreintes avant le calcul du montant.</span>
                </span>
              </label>
              <p className="text-xs font-semibold text-slate-600">Éditeurs de {current}</p>
              <EmployeeChecklist employees={sorted} selected={editors}
                onChange={(s) => { setEditors(s); setDirty(true); }}
                note={(e) => (e.bl ? (e.bl === current ? `agent ${e.bl}` : e.bl) : "")} />
            </div>
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Fermer</button>
          <button onClick={save} disabled={saving || loading || !current || !dirty}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer {current}
          </button>
        </div>
      </div>
    </div>
  );
}
