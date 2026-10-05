// Gestion des codes projets (CECO) par Business Line : ajout, désactivation, réactivation.
// Réservé à la vue complète (RH et profils autorisés).
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { PlanningProjectCode, teamPlanningService } from "@/services/teamPlanningService";

type StatusFilter = "all" | "active" | "inactive";

export default function ProjectCodesModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [codes, setCodes] = useState<PlanningProjectCode[]>([]);
  const [bls, setBls] = useState<string[]>([]);
  const [bl, setBl] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [newCode, setNewCode] = useState("");
  const [newBl, setNewBl] = useState("");
  const [busy, setBusy] = useState<number | "add" | null>(null);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    teamPlanningService.listProjects()
      .then((r) => { setCodes(r.projects); setBls(r.business_lines); setBl(r.business_lines[0] ?? ""); setNewBl(r.business_lines[0] ?? ""); })
      .catch(() => toast.error("Impossible de charger les codes projets"))
      .finally(() => setLoading(false));
  }, []);

  const close = () => { if (changed) onChanged(); onClose(); };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return codes
      .filter((c) => c.business_line === bl)
      .filter((c) => status === "all" || (status === "active") === c.is_active)
      .filter((c) => !q || c.code.toLowerCase().includes(q))
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.code.localeCompare(b.code));
  }, [codes, bl, status, query]);

  const count = (b: string, active: boolean) => codes.filter((c) => c.business_line === b && c.is_active === active).length;

  const toggle = async (c: PlanningProjectCode) => {
    setBusy(c.id);
    try {
      const upd = await teamPlanningService.setProjectActive(c.id, !c.is_active);
      setCodes((list) => list.map((x) => (x.id === upd.id ? upd : x)));
      setChanged(true);
      toast.success(`${upd.code} ${upd.is_active ? "réactivé" : "désactivé"}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Modification impossible");
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    if (!newCode.trim() || !newBl.trim()) return;
    setBusy("add");
    try {
      const p = await teamPlanningService.addProject(newCode.trim(), newBl.trim());
      setCodes((list) => [...list.filter((x) => x.id !== p.id), p]);
      setBls((list) => (list.includes(p.business_line) ? list : [...list, p.business_line].sort()));
      setBl(p.business_line);
      setNewCode("");
      setChanged(true);
      toast.success(`${p.code} ajouté à ${p.business_line}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Ajout impossible");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-[#003c71]">Codes projets (CECO)</h2>
            <p className="text-xs text-slate-500">Un code désactivé n'est plus proposé ; les jours déjà saisis avec lui restent.</p>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><XIcon size={16} /></button>
        </div>

        {/* Ajouter un code */}
        <div className="px-5 py-3 border-b border-slate-100 flex gap-2 flex-wrap">
          <input value={newCode} onChange={(e) => setNewCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Nouveau code, ex. TSOR0300" maxLength={50}
            className="flex-1 min-w-[160px] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#003c71]" />
          <input value={newBl} onChange={(e) => setNewBl(e.target.value)} list="tp-bl-list" placeholder="BL"
            className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#003c71]" />
          <datalist id="tp-bl-list">{bls.map((b) => <option key={b} value={b} />)}</datalist>
          <button onClick={add} disabled={busy === "add" || !newCode.trim() || !newBl.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#003c71] text-white text-sm font-semibold disabled:opacity-50">
            {busy === "add" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
          </button>
        </div>

        {/* BL + filtres */}
        <div className="px-5 pt-3 flex gap-1.5 flex-wrap">
          {bls.map((b) => (
            <button key={b} onClick={() => setBl(b)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${bl === b ? "bg-[#003c71] text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`}>
              {b} <span className="opacity-70">· {count(b, true)} actifs{count(b, false) ? ` · ${count(b, false)} inactifs` : ""}</span>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un code…"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#003c71]" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="border border-slate-200 rounded-xl px-2 py-2 text-sm">
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-auto px-5 pb-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#003c71]" /></div>
          ) : shown.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">Aucun code{query ? " pour cette recherche" : ""}.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span className={`font-mono text-sm ${c.is_active ? "text-slate-800" : "text-slate-400 line-through"}`}>{c.code}</span>
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
    </div>
  );
}
