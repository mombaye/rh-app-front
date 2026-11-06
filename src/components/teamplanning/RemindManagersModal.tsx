// Relance par e-mail des responsables qui n'ont pas terminé le Team Planning du mois.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { ManagerStatus, teamPlanningService } from "@/services/teamPlanningService";

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const fmt = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

export default function RemindManagersModal({ year, month, onClose }: { year: number; month: number; onClose: () => void }) {
  const [managers, setManagers] = useState<ManagerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");

  useEffect(() => {
    teamPlanningService.getManagersStatus(year, month)
      .then((r) => setManagers(r.managers))
      .catch((e) => toast.error(e?.response?.data?.detail ?? "Impossible de charger les responsables"))
      .finally(() => setLoading(false));
  }, [year, month]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? managers.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(t)) : managers;
  }, [managers, q]);

  const toggle = (id: number) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pickIncomplete = () => setPicked(new Set(managers.filter((m) => m.incomplete > 0 && m.email).map((m) => m.manager_id)));
  const pickShown = () => setPicked(new Set(shown.filter((m) => m.email).map((m) => m.manager_id)));

  const send = async () => {
    if (picked.size === 0) return;
    setSending(true);
    try {
      const r = await teamPlanningService.remindManagers(year, month, [...picked]);
      if (r.sent.length) toast.success(`Relance envoyée à ${r.sent.length} responsable(s)`);
      if (r.no_email.length) toast.error(`Pas d'e-mail pour : ${r.no_email.join(", ")}`, { duration: 8000 });
      if (r.failed.length) toast.error(`Échec d'envoi pour : ${r.failed.join(", ")}`, { duration: 8000 });
      if (r.sent.length && !r.no_email.length && !r.failed.length) onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Envoi impossible");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !sending && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="remind-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 id="remind-title" className="text-lg font-bold text-[#003c71]">Relancer les responsables</h2>
            <p className="text-sm text-slate-500">Team Planning de {MONTHS_FR[month - 1]} {year} · un e-mail de relance part à chaque responsable coché</p>
          </div>
          <button onClick={onClose} disabled={sending} aria-label="Fermer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un responsable…" aria-label="Rechercher un responsable"
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl w-56" />
          </div>
          <button onClick={pickIncomplete} className="text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
            Sélectionner ceux à compléter
          </button>
          <button onClick={pickShown} className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">Tout sélectionner</button>
          <button onClick={() => setPicked(new Set())} className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">Aucun</button>
        </div>

        <div className="overflow-auto flex-1 px-3 py-2">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#003c71]" /></div>
          ) : shown.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-12">Aucun responsable à afficher.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((m) => {
                const id = `mgr-${m.manager_id}`;
                return (
                  <li key={m.manager_id}>
                    <label htmlFor={id} className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-slate-50 ${!m.email ? "opacity-60" : ""}`}>
                      <input id={id} type="checkbox" checked={picked.has(m.manager_id)} onChange={() => toggle(m.manager_id)} disabled={!m.email}
                        className="w-4 h-4 accent-[#003c71]" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">{m.name}</span>
                        <span className="block text-xs text-slate-500 truncate">
                          {m.email || "Aucune adresse e-mail"} · {m.employees} collaborateur(s)
                          {m.incomplete > 0 ? ` · ${m.incomplete} à compléter` : " · complet"}
                        </span>
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${m.pct >= 100
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200" : m.pct >= 50
                          ? "text-amber-700 bg-amber-50 border-amber-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>{fmt(m.pct)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100">
          <span className="text-sm text-slate-500">{picked.size} responsable(s) sélectionné(s)</span>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={sending} className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50">Annuler</button>
            <button onClick={send} disabled={sending || picked.size === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[#003c71] text-white hover:bg-[#002b52] disabled:opacity-50">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Envoyer la relance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
