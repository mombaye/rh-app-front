// Liste d'employés à cocher avec recherche (responsables de saisie, bénéficiaires du forfait).
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { EmpBrief } from "@/services/hsAstreinteService";

export default function EmployeeChecklist({ employees, selected, onChange, note }: {
  employees: EmpBrief[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
  /** texte secondaire par employé (ex. « rempli par X ») */
  note?: (e: EmpBrief) => string;
}) {
  const [q, setQ] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return employees.filter((e) =>
      (!onlySelected || selected.has(e.id)) &&
      (!s || `${e.matricule} ${e.nom} ${e.prenom} ${e.service}`.toLowerCase().includes(s)));
  }, [employees, q, onlySelected, selected]);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  const setAll = (on: boolean) => {
    const next = new Set(selected);
    shown.forEach((e) => (on ? next.add(e.id) : next.delete(e.id)));
    onChange(next);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, matricule, service…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#003c71]" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} /> Cochés seulement
        </label>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>{selected.size} sélectionné(s)</span>
        <span className="flex gap-3">
          <button onClick={() => setAll(true)} className="text-[#003c71] hover:underline">Tout cocher ({shown.length})</button>
          <button onClick={() => setAll(false)} className="text-slate-500 hover:underline">Tout décocher</button>
        </span>
      </div>
      <ul className="flex-1 overflow-auto border border-slate-100 rounded-xl divide-y divide-slate-100 min-h-[200px]">
        {shown.map((e) => (
          <li key={e.id}>
            <label className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="accent-[#003c71]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-800 truncate">{e.nom} {e.prenom}</span>
                <span className="block text-[11px] text-slate-400 truncate">
                  {e.matricule}{e.service ? ` · ${e.service}` : ""}{note?.(e) ? ` · ${note(e)}` : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Aucun employé</li>}
      </ul>
    </div>
  );
}
