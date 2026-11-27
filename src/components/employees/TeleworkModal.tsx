// RH : périodes de télétravail d'un employé (Gestion Employés → Gérer → « Définir en télétravail »).
// Les jours de télétravail comptent comme travaillés et s'affichent « Télé-Travail » dans les pointages.
import { useEffect, useState } from "react";
import { Home, Loader2, Plus, Trash2, X as XIcon } from "lucide-react";
import toast from "react-hot-toast";
import type { Employee } from "@/types/employee";
import { TeleworkPeriod, teleworkService } from "@/services/teleworkService";

const fr = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const today = () => new Date().toISOString().slice(0, 10);

export default function TeleworkModal({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const [periods, setPeriods] = useState<TeleworkPeriod[] | null>(null);
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    if (!employee) return;
    teleworkService.list(employee.id).then(setPeriods).catch(() => { setPeriods([]); toast.error("Impossible de charger le télétravail"); });
  };

  useEffect(() => {
    if (!employee) return;
    setPeriods(null); setStart(today()); setEnd(today()); setMotif(""); setError("");
    load();
  }, [employee?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!employee) return null;

  const add = async () => {
    setSaving(true);
    setError("");
    try {
      await teleworkService.create({ employee_id: employee.id, start_date: start, end_date: end, motif });
      toast.success("Télétravail enregistré");
      setMotif("");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: TeleworkPeriod) => {
    if (!window.confirm(`Supprimer le télétravail du ${fr(p.start_date)} au ${fr(p.end_date)} ?`)) return;
    try {
      await teleworkService.remove(p.id);
      toast.success("Période supprimée");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Suppression impossible");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-camublue-900 flex items-center gap-2"><Home size={18} /> Télétravail</h2>
            <p className="text-xs text-slate-500">{employee.prenom} {employee.nom} · {employee.matricule}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Fermer"><XIcon size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-5">
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Définir une période de télétravail</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">Du
                <input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800" />
              </label>
              <label className="text-xs text-slate-500">Au
                <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800" />
              </label>
            </div>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={500} placeholder="Motif (facultatif)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
            {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>}
            <button onClick={add} disabled={saving || !start || !end}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-camublue-900 text-white text-sm font-semibold py-2.5 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Enregistrer le télétravail
            </button>
            <p className="text-xs text-slate-400">Les jours ouvrés de la période comptent comme des journées de travail effectif et s'affichent « Télé-Travail » dans les pointages. Le solde de congés ne change pas.</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Périodes enregistrées</p>
            {periods === null ? (
              <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-camublue-900" /></div>
            ) : periods.length === 0 ? (
              <p className="text-sm text-slate-400 py-3 text-center">Aucune période de télétravail.</p>
            ) : (
              <div className="border border-slate-100 rounded-xl divide-y divide-slate-100">
                {periods.map((p) => (
                  <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 ${p.is_past ? "opacity-60" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">
                        {p.start_date === p.end_date ? fr(p.start_date) : <>{fr(p.start_date)} → {fr(p.end_date)}</>}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{p.days} jour(s) ouvré(s){p.motif ? ` · ${p.motif}` : ""}</p>
                    </div>
                    <button onClick={() => remove(p)} title="Supprimer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
