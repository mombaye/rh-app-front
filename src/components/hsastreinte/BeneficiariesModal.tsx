// RH : employés qui bénéficient du forfait HS / astreinte (tous ne sont pas concernés).
import { useEffect, useState } from "react";
import { Loader2, Save, Users, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { EmpBrief, hsAstreinteService } from "@/services/hsAstreinteService";
import EmployeeChecklist from "@/components/hsastreinte/EmployeeChecklist";

export default function BeneficiariesModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<EmpBrief[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hsAstreinteService.getBeneficiaries()
      .then((r) => { setEmployees(r.employees); setSelected(new Set(r.employee_ids)); })
      .catch(() => toast.error("Impossible de charger les bénéficiaires"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await hsAstreinteService.setBeneficiaries([...selected]);
      toast.success(`${selected.size} bénéficiaire(s) enregistré(s)`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-[#003c71] flex items-center gap-2"><Users size={18} /> Bénéficiaires du forfait</h2>
            <p className="text-xs text-slate-500">Seuls les employés cochés apparaissent dans les forfaits, avec le calcul des montants.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><XIcon size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 p-4 flex flex-col">
          {loading
            ? <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#003c71]" /></div>
            : <EmployeeChecklist employees={employees} selected={selected} onChange={setSelected} />}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-slate-200 hover:bg-slate-50">Annuler</button>
          <button onClick={save} disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
