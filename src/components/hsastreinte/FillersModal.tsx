// RH : qui remplit le pointage HS & Astreinte de quels employés.
// Sans responsable désigné, c'est le N+1 de l'employé qui remplit.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, UserCog, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { EmpBrief, hsAstreinteService } from "@/services/hsAstreinteService";
import EmployeeChecklist from "@/components/hsastreinte/EmployeeChecklist";

export default function FillersModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [employees, setEmployees] = useState<EmpBrief[]>([]);
  const [groups, setGroups] = useState<{ filler: EmpBrief; employee_ids: number[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState("");
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const apply = (r: { groups: { filler: EmpBrief; employee_ids: number[] }[]; employees: EmpBrief[] }) => {
    setGroups(r.groups);
    setEmployees(r.employees);
  };
  useEffect(() => {
    hsAstreinteService.getAssignments().then(apply)
      .catch(() => toast.error("Impossible de charger les responsables"))
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const fillerOf = useMemo(() => {
    const m = new Map<number, string>();
    groups.forEach((g) => g.employee_ids.forEach((id) => m.set(id, `${g.filler.prenom} ${g.filler.nom}`)));
    return m;
  }, [groups]);

  const select = (fillerId: number) => {
    setCurrent(fillerId);
    setSelected(new Set(groups.find((g) => g.filler.id === fillerId)?.employee_ids ?? []));
  };

  const addFiller = () => {
    const id = Number(adding);
    if (!id) return;
    if (!groups.some((g) => g.filler.id === id)) {
      const e = byId.get(id);
      if (e) setGroups((gs) => [...gs, { filler: e, employee_ids: [] }]);
    }
    setAdding("");
    select(id);
  };

  const save = async () => {
    if (current == null) return;
    setSaving(true);
    try {
      apply(await hsAstreinteService.setAssignments(current, [...selected]));
      setChanged(true);
      toast.success("Responsable de saisie enregistré");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const close = () => { if (changed) onChanged(); onClose(); };
  const currentEmp = current != null ? byId.get(current) : undefined;
  const moved = [...selected].filter((id) => fillerOf.has(id) && !groups.find((g) => g.filler.id === current)?.employee_ids.includes(id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-[#003c71] flex items-center gap-2"><UserCog size={18} /> Responsables de saisie</h2>
            <p className="text-xs text-slate-500">Qui remplit le pointage de quels employés. Sans responsable désigné, c'est le N+1 qui remplit.</p>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><XIcon size={16} /></button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#003c71]" /></div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            {/* Responsables */}
            <div className="md:w-72 border-b md:border-b-0 md:border-r border-slate-100 p-4 flex flex-col gap-2 min-h-0">
              <div className="flex gap-2">
                <select value={adding} onChange={(e) => setAdding(e.target.value)}
                  className="flex-1 min-w-0 text-sm border border-slate-200 rounded-xl px-2 py-2">
                  <option value="">Ajouter un responsable…</option>
                  {employees.filter((e) => !groups.some((g) => g.filler.id === e.id)).map((e) => (
                    <option key={e.id} value={e.id}>{e.nom} {e.prenom} ({e.matricule})</option>
                  ))}
                </select>
                <button onClick={addFiller} disabled={!adding}
                  className="px-2.5 rounded-xl bg-[#003c71] text-white disabled:opacity-40"><Plus size={16} /></button>
              </div>
              <ul className="flex-1 overflow-auto space-y-1">
                {groups.map((g) => (
                  <li key={g.filler.id}>
                    <button onClick={() => select(g.filler.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm ${current === g.filler.id ? "bg-[#003c71] text-white" : "hover:bg-slate-50 text-slate-700"}`}>
                      <span className="font-semibold">{g.filler.prenom} {g.filler.nom}</span>
                      <span className={`block text-[11px] ${current === g.filler.id ? "text-white/70" : "text-slate-400"}`}>
                        {g.employee_ids.length} employé(s)
                      </span>
                    </button>
                  </li>
                ))}
                {groups.length === 0 && <li className="text-xs text-slate-400 px-1 py-4">Aucun responsable désigné : chaque N+1 remplit pour son équipe.</li>}
              </ul>
            </div>
            {/* Employés du responsable */}
            <div className="flex-1 p-4 flex flex-col min-h-0">
              {currentEmp ? (
                <>
                  <p className="text-sm text-slate-700 mb-2">
                    Employés dont <b>{currentEmp.prenom} {currentEmp.nom}</b> remplit le pointage :
                  </p>
                  <EmployeeChecklist employees={employees.filter((e) => e.id !== current)} selected={selected} onChange={setSelected}
                    note={(e) => fillerOf.has(e.id) ? `rempli par ${fillerOf.get(e.id)}` : e.n1 ? `N+1 : ${e.n1}` : ""} />
                  <div className="flex items-center justify-between gap-3 pt-3">
                    <span className="text-xs text-slate-500">
                      {moved > 0 && `${moved} employé(s) quitteront leur responsable actuel.`}
                      {selected.size === 0 && " Aucun employé coché : ce responsable sera retiré."}
                    </span>
                    <button onClick={save} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold disabled:opacity-50">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-400 text-center px-6">
                  Choisissez un responsable à gauche, ou ajoutez-en un, puis cochez les employés dont il remplit le pointage.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
