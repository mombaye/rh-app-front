// Business Lines : création, codes projets de la BL et employés rattachés.
// Réservé à la vue complète (RH et profils autorisés).
// Seuls les employés SANS Business Line peuvent être ajoutés à une BL.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, Loader2, Plus, Search, UserMinus, UserPlus, Users, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import {
  BlEmployee, BlEmployees, BusinessLineInfo, PlanningProjectCode, teamPlanningService,
} from "@/services/teamPlanningService";

type Tab = "codes" | "employees";
type Mode = "bl" | "all";

export default function BusinessLinesModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [bls, setBls] = useState<BusinessLineInfo[]>([]);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<Tab>("codes");
  const [mode, setMode] = useState<Mode>("bl");
  const [loading, setLoading] = useState(true);
  const [changed, setChanged] = useState(false);
  const [newBl, setNewBl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);

  const loadBls = useCallback(async (select?: string) => {
    try {
      const list = await teamPlanningService.listBusinessLines();
      setBls(list);
      setSelected((cur) => select ?? (cur || list[0]?.code || ""));
    } catch {
      toast.error("Impossible de charger les Business Lines");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBls(); }, [loadBls]);

  const close = () => { if (changed) onChanged(); onClose(); };

  const create = async () => {
    if (!newBl.trim()) return;
    setCreating(true);
    try {
      const bl = await teamPlanningService.createBusinessLine(newBl.trim(), newLabel.trim());
      toast.success(`Business Line ${bl.code} créée — ajoutez ses codes projets puis ses employés`);
      setNewBl(""); setNewLabel("");
      setChanged(true);
      setTab("codes");
      await loadBls(bl.code);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Création impossible");
    } finally {
      setCreating(false);
    }
  };

  const current = bls.find((b) => b.code === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="bl-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 id="bl-title" className="text-lg font-bold text-[#003c71]">Business Lines</h2>
            <p className="text-sm text-slate-500">Créez une BL, ajoutez ses codes projets, puis les employés concernés.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded-xl p-0.5" role="tablist" aria-label="Affichage">
              {([["bl", "Par Business Line", Layers], ["all", "Tous les employés", Users]] as const).map(([m, label, Icon]) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${mode === m ? "bg-white text-[#003c71] shadow-sm font-semibold" : "text-slate-600"}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            <button onClick={close} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><XIcon size={16} /></button>
          </div>
        </div>

        {mode === "all" ? <AllEmployees onChanged={() => { setChanged(true); loadBls(); }} /> : (
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Liste des BL + création */}
          <div className="md:w-80 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col">
            <div className="p-3 space-y-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase">Nouvelle Business Line</p>
              <input value={newBl} onChange={(e) => setNewBl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Code, ex. BL6" maxLength={20} aria-label="Code de la nouvelle Business Line"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#003c71]" />
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Libellé (optionnel)" maxLength={100} aria-label="Libellé de la nouvelle Business Line"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#003c71]" />
              <button onClick={create} disabled={creating || !newBl.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold disabled:opacity-50">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer la BL
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#003c71]" /></div>
              ) : bls.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Aucune Business Line.</p>
              ) : bls.map((b) => (
                <button key={b.code} onClick={() => setSelected(b.code)}
                  className={`w-full text-left px-3 py-2 rounded-xl mb-1 ${selected === b.code ? "bg-[#003c71] text-white" : "hover:bg-slate-50 text-slate-700"}`}>
                  <div className="flex items-center gap-1.5 font-semibold text-base"><Layers size={15} /> {b.code}
                    {b.label && <span className={`font-normal text-sm truncate ${selected === b.code ? "text-white/80" : "text-slate-400"}`}>· {b.label}</span>}
                  </div>
                  <div className={`text-xs ${selected === b.code ? "text-white/80" : "text-slate-400"}`}>
                    {b.active_codes} code(s) · {b.employees} employé(s)
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Détail de la BL */}
          <div className="flex-1 min-w-0 flex flex-col">
            {!current ? (
              <p className="m-auto text-sm text-slate-400">Créez ou sélectionnez une Business Line.</p>
            ) : (
              <>
                <div className="px-5 pt-3 flex gap-1.5 border-b border-slate-100" role="tablist">
                  {([["codes", `Codes projets (${current.active_codes})`], ["employees", `Employés (${current.employees})`]] as [Tab, string][]).map(([t, l]) => (
                    <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                      className={`px-4 py-2.5 text-base font-semibold border-b-2 -mb-px ${tab === t ? "border-[#003c71] text-[#003c71]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                      {l}
                    </button>
                  ))}
                </div>
                {tab === "codes"
                  ? <BlCodes bl={current.code} onChanged={() => { setChanged(true); loadBls(current.code); }} />
                  : <BlStaff bl={current.code} onChanged={() => { setChanged(true); loadBls(current.code); }} />}
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// Tous les employés actifs avec leur BL ; changement de BL employé par employé
function AllEmployees({ onChanged }: { onChanged: () => void }) {
  const [bls, setBls] = useState<string[]>([]);
  const [rows, setRows] = useState<(BlEmployee & { business_line: string })[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("__all");
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    teamPlanningService.getAllEmployeesBl()
      .then((r) => { setBls(r.business_lines); setRows(r.employees); })
      .catch(() => toast.error("Impossible de charger les employés"));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((e) =>
      (filter === "__all" || (filter === "__none" ? !e.business_line : e.business_line === filter)) &&
      (!q || `${e.matricule} ${e.nom} ${e.prenom} ${e.service} ${e.line_manager}`.toLowerCase().includes(q)));
  }, [rows, query, filter]);

  const change = async (e: BlEmployee & { business_line: string }, bl: string) => {
    if (bl === e.business_line) return;
    if (e.business_line && !window.confirm(
      `Changer ${e.nom} ${e.prenom} de ${e.business_line} vers ${bl || "aucune BL"} ?\nSes jours déjà saisis restent ; les prochains se feront avec les codes de ${bl || "—"}.`)) return;
    setBusy(e.id);
    try {
      const upd = await teamPlanningService.setEmployeeBl(e.id, bl);
      setRows((list) => (list ?? []).map((x) => (x.id === upd.id ? { ...x, business_line: upd.business_line } : x)));
      toast.success(`${e.nom} ${e.prenom} : ${upd.business_line || "aucune BL"}`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Changement impossible");
    } finally {
      setBusy(null);
    }
  };

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#003c71]" /></div>;

  const count = (bl: string) => rows.filter((e) => (bl ? e.business_line === bl : !e.business_line)).length;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-5 py-3 flex gap-2 flex-wrap items-center border-b border-slate-100">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un employé, un service…"
            aria-label="Rechercher un employé"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#003c71]" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrer par Business Line"
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm">
          <option value="__all">Toutes ({rows.length})</option>
          {bls.map((b) => <option key={b} value={b}>{b} ({count(b)})</option>)}
          <option value="__none">Sans BL ({count("")})</option>
        </select>
        <span className="text-sm text-slate-500">{shown.length} employé(s)</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr className="text-left text-xs text-slate-600">
              <th className="px-5 py-2 font-semibold">Employé</th>
              <th className="px-3 py-2 font-semibold">Service</th>
              <th className="px-3 py-2 font-semibold">Line manager</th>
              <th className="px-3 py-2 font-semibold w-48">Business Line</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-5 py-2">
                  <div className="font-medium text-slate-700">{e.nom} {e.prenom}</div>
                  <div className="text-xs text-slate-400">{e.matricule}{e.fonction ? ` · ${e.fonction}` : ""}</div>
                </td>
                <td className="px-3 py-2 text-slate-500">{e.service || "—"}</td>
                <td className="px-3 py-2 text-slate-500">{e.line_manager || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <select value={e.business_line} disabled={busy === e.id} onChange={(ev) => change(e, ev.target.value)}
                      aria-label={`Business Line de ${e.nom} ${e.prenom}`}
                      className={`w-full border rounded-lg px-2 py-1.5 text-sm ${e.business_line ? "border-[#003c71]/30 text-[#003c71] font-semibold" : "border-slate-200 text-slate-400"}`}>
                      <option value="">— Aucune</option>
                      {bls.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {busy === e.id && <Loader2 size={14} className="animate-spin text-[#003c71] shrink-0" />}
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={4} className="text-center text-sm text-slate-400 py-10">Aucun employé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BlCodes({ bl, onChanged }: { bl: string; onChanged: () => void }) {
  const [codes, setCodes] = useState<PlanningProjectCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<number | "add" | null>(null);

  useEffect(() => {
    setLoading(true);
    teamPlanningService.listProjects()
      .then((r) => setCodes(r.projects.filter((p) => p.business_line === bl)))
      .catch(() => toast.error("Impossible de charger les codes projets"))
      .finally(() => setLoading(false));
  }, [bl]);

  const add = async () => {
    if (!code.trim()) return;
    setBusy("add");
    try {
      const p = await teamPlanningService.addProject(code.trim(), bl);
      setCodes((list) => [...list.filter((x) => x.id !== p.id), p]);
      setCode("");
      toast.success(`${p.code} ajouté à ${bl}`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Ajout impossible");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (c: PlanningProjectCode) => {
    setBusy(c.id);
    try {
      const upd = await teamPlanningService.setProjectActive(c.id, !c.is_active);
      setCodes((list) => list.map((x) => (x.id === upd.id ? upd : x)));
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Modification impossible");
    } finally {
      setBusy(null);
    }
  };

  const sorted = [...codes].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.code.localeCompare(b.code));

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-5 py-3 flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={`Nouveau code projet pour ${bl}, ex. TSOR0001`} maxLength={50} aria-label="Nouveau code projet"
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#003c71]" />
        <button onClick={add} disabled={busy === "add" || !code.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold disabled:opacity-50">
          {busy === "add" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 pb-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#003c71]" /></div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">Aucun code projet : ajoutez-en un pour que la BL apparaisse dans le planning.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sorted.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <span className={`font-mono text-base ${c.is_active ? "text-slate-800" : "text-slate-400 line-through"}`}>{c.code}</span>
                <button onClick={() => toggle(c)} disabled={busy === c.id}
                  className={`text-xs font-semibold px-3 py-1 rounded-full border disabled:opacity-50 ${c.is_active
                    ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                  {busy === c.id ? "…" : c.is_active ? "Désactiver" : "Réactiver"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BlStaff({ bl, onChanged }: { bl: string; onChanged: () => void }) {
  const [data, setData] = useState<BlEmployees | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setData(null);
    setChecked(new Set());
    teamPlanningService.getBlEmployees(bl).then(setData).catch(() => toast.error("Impossible de charger les employés"));
  }, [bl]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.candidates ?? []).filter((e) =>
      !q || `${e.matricule} ${e.nom} ${e.prenom} ${e.service} ${e.fonction}`.toLowerCase().includes(q));
  }, [data, query]);

  const update = async (add: number[], remove: number[]) => {
    setBusy(true);
    try {
      const res = await teamPlanningService.setBlEmployees(bl, add, remove);
      setData(res);
      setChecked(new Set());
      if (res.added) toast.success(`${res.added} employé(s) ajouté(s) à ${bl}`);
      if (res.removed) toast.success(`${res.removed} employé(s) retiré(s) de ${bl}`);
      if (res.skipped) toast(`${res.skipped} employé(s) ignoré(s) : ils ont déjà une Business Line`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Modification impossible");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#003c71]" /></div>;

  const toggle = (id: number) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2">
      {/* Employés sans BL */}
      <div className="flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-slate-100">
        <div className="px-4 pt-3 pb-2 space-y-2">
          <p className="text-sm font-semibold text-slate-600">Employés sans Business Line ({data.candidates.length})</p>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un employé"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#003c71]" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <button onClick={() => setChecked(new Set(candidates.map((e) => e.id)))} className="text-[#003c71] hover:underline">
              Tout sélectionner ({candidates.length})
            </button>
            <button onClick={() => update([...checked], [])} disabled={busy || checked.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#003c71] text-white font-semibold disabled:opacity-50">
              <UserPlus size={13} /> Ajouter à {bl} ({checked.size})
            </button>
          </div>
        </div>
        <ul className="flex-1 overflow-auto px-2 pb-3">
          {candidates.map((e) => (
            <li key={e.id}>
              <label className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={checked.has(e.id)} onChange={() => toggle(e.id)} className="accent-[#003c71]" />
                <span className="text-base text-slate-700 truncate">{e.nom} {e.prenom}</span>
                <span className="ml-auto text-xs text-slate-500 shrink-0">{e.matricule}{e.service ? ` · ${e.service}` : ""}</span>
              </label>
            </li>
          ))}
          {candidates.length === 0 && <li className="text-xs text-slate-400 text-center py-6">Aucun employé sans Business Line.</li>}
        </ul>
      </div>

      {/* Membres */}
      <div className="flex flex-col min-h-0">
        <p className="px-4 pt-3 pb-2 text-sm font-semibold text-slate-600">Employés de {bl} ({data.members.length})</p>
        <ul className="flex-1 overflow-auto px-2 pb-3">
          {data.members.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50">
              <span className="text-base text-slate-700 truncate">{e.nom} {e.prenom}</span>
              <span className="text-xs text-slate-500 shrink-0">{e.matricule}</span>
              <button onClick={() => window.confirm(`Retirer ${e.nom} ${e.prenom} de ${bl} ? Sa fiche n'aura plus de Business Line.`) && update([], [e.id])}
                disabled={busy} title={`Retirer de ${bl}`} aria-label={`Retirer ${e.nom} ${e.prenom} de ${bl}`}
                className="ml-auto p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                <UserMinus size={14} />
              </button>
            </li>
          ))}
          {data.members.length === 0 && <li className="text-xs text-slate-400 text-center py-6">Aucun employé dans cette BL.</li>}
        </ul>
      </div>
    </div>
  );
}
