import { useEffect, useState } from "react";
import { Loader2, Search, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { MemberCandidate, PlanningRow, teamPlanningService } from "@/services/teamPlanningService";

interface Props {
  /** Employé à modifier ; absent = ajout d'un nouvel employé */
  row?: PlanningRow;
  businessLines: string[];
  managers: string[];
  onClose: () => void;
  onSaved: () => void;
}

export default function MemberDialog({ row, businessLines, managers, onClose, onSaved }: Props) {
  const [query, setQuery]         = useState("");
  const [candidates, setCandidates] = useState<MemberCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [employee, setEmployee]   = useState<MemberCandidate | null>(
    row ? { id: row.employee_id, matricule: row.matricule, nom: row.nom, prenom: row.prenom } : null);
  const [bl, setBl]               = useState(row?.business_line ?? businessLines[0] ?? "");
  const [manager, setManager]     = useState(row?.line_manager ?? "");
  const [busy, setBusy]           = useState(false);

  useEffect(() => {
    if (row || employee) return;
    const id = setTimeout(async () => {
      setSearching(true);
      try { setCandidates(await teamPlanningService.candidates(query)); }
      catch { setCandidates([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(id);
  }, [query, row, employee]);

  const save = async () => {
    if (!employee || !bl) return;
    setBusy(true);
    try {
      const res = await teamPlanningService.upsertMember({
        employee_id: employee.id, business_line: bl, line_manager_name: manager.trim(),
      });
      toast.success(row ? "Employé mis à jour" : "Employé ajouté au Team Planning");
      if (!res.manager_recognized) {
        toast(`« ${manager} » ne correspond à aucune fiche employé : ce line manager ne verra pas son équipe.`, { duration: 7000 });
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!row || !window.confirm(`Retirer ${row.nom} ${row.prenom} du Team Planning ?\nSes saisies passées sont conservées.`)) return;
    setBusy(true);
    try {
      await teamPlanningService.deleteMember(row.employee_id);
      toast.success("Employé retiré du Team Planning");
      onSaved();
    } catch {
      toast.error("Suppression impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800">{row ? "Modifier l'employé" : "Ajouter un employé"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XIcon size={18} /></button>
        </div>

        {/* Employé */}
        <label className="block text-xs font-semibold text-slate-600 mb-1">Employé</label>
        {employee ? (
          <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 mb-3">
            <span className="text-sm text-slate-700">{employee.nom} {employee.prenom} <span className="text-slate-400">· {employee.matricule}</span></span>
            {!row && <button onClick={() => setEmployee(null)} className="text-xs text-[#003c71] hover:underline">Changer</button>}
          </div>
        ) : (
          <div className="mb-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom ou matricule…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003c71]/20" />
            </div>
            <div className="max-h-44 overflow-auto mt-1 border border-slate-100 rounded-lg">
              {searching && <div className="p-2 text-center"><Loader2 size={14} className="animate-spin inline text-slate-400" /></div>}
              {!searching && candidates.map((c) => (
                <button key={c.id} onClick={() => setEmployee(c)}
                  className="w-full text-left text-sm px-3 py-1.5 hover:bg-[#003c71]/10 text-slate-700">
                  {c.nom} {c.prenom} <span className="text-slate-400">· {c.matricule}</span>
                </button>
              ))}
              {!searching && candidates.length === 0 && (
                <div className="text-xs text-slate-400 px-3 py-2">Aucun employé actif hors Team Planning ne correspond.</div>
              )}
            </div>
          </div>
        )}

        {/* Business Line */}
        <label className="block text-xs font-semibold text-slate-600 mb-1">Business Line</label>
        <select value={bl} onChange={(e) => setBl(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 bg-white">
          {businessLines.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        {/* Line manager */}
        <label className="block text-xs font-semibold text-slate-600 mb-1">Line manager</label>
        <input list="tp-managers" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Choisir ou saisir un nom…"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-5 focus:outline-none focus:ring-2 focus:ring-[#003c71]/20" />
        <datalist id="tp-managers">
          {managers.map((m) => <option key={m} value={m} />)}
        </datalist>

        <div className="flex items-center justify-between gap-2">
          {row ? (
            <button onClick={remove} disabled={busy} className="text-sm text-rose-600 hover:underline disabled:opacity-50">
              Retirer du Team Planning
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Annuler</button>
            <button onClick={save} disabled={busy || !employee || !bl}
              className="text-sm px-4 py-2 rounded-lg bg-[#003c71] text-white hover:bg-[#002b52] disabled:opacity-50">
              {busy ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
