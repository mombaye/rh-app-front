import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { ImSpinner2 } from "react-icons/im";
import { Send, X, Search, CheckCircle, User, RefreshCw } from "lucide-react";
import { fetchAvailableBulletins, sendBulletinsToUser } from "@/services/employeeService";

dayjs.locale("fr");

const MONTH_NAMES = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pré-remplir le matricule si on vient d'une ligne de la table */
  defaultMatricule?: string;
}

export function BulletinResendModal({ open, onClose, defaultMatricule }: Props) {
  const [matricule, setMatricule]   = useState("");
  const [email,     setEmail]       = useState("");
  const [avail,     setAvail]       = useState<{ year: number; month: number }[]>([]);
  const [selected,  setSelected]    = useState<Set<string>>(new Set());
  const [loading,   setLoading]     = useState(false);
  const [sending,   setSending]     = useState(false);
  const [fetched,   setFetched]     = useState(false);

  // Reset à l'ouverture
  useEffect(() => {
    if (!open) return;
    setMatricule(defaultMatricule ?? "");
    setEmail("");
    setAvail([]);
    setSelected(new Set());
    setFetched(false);
  }, [open, defaultMatricule]);

  // Si matricule pré-rempli, charger automatiquement
  useEffect(() => {
    if (open && defaultMatricule) fetchBulletins(defaultMatricule);
  }, [open, defaultMatricule]);

  const fetchBulletins = async (mat: string) => {
    const m = mat.trim();
    if (!m) return toast.error("Saisissez un matricule.");
    setLoading(true);
    setAvail([]);
    setSelected(new Set());
    setFetched(false);
    try {
      const data = await fetchAvailableBulletins(m);
      setAvail(data);
      // pré-sélectionner tout
      setSelected(new Set(data.map((d) => `${d.year}-${d.month}`)));
      setFetched(true);
      if (data.length === 0) toast("Aucun bulletin stocké pour ce matricule.", { icon: "ℹ️" });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Matricule introuvable ou erreur serveur.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleAll = () =>
    setSelected((prev) =>
      avail.every((d) => prev.has(`${d.year}-${d.month}`))
        ? new Set()
        : new Set(avail.map((d) => `${d.year}-${d.month}`))
    );

  const handleSend = async () => {
    if (selected.size === 0) return toast.error("Sélectionnez au moins un mois.");
    setSending(true);
    const t = toast.loading(`Envoi de ${selected.size} bulletin(s)…`);
    try {
      const mois = Array.from(selected).map((k) => {
        const [y, m] = k.split("-");
        return { year: parseInt(y), month: parseInt(m) };
      });
      await sendBulletinsToUser({ matricule: matricule.trim(), email: email.trim() || undefined, mois });
      toast.success(`${selected.size} bulletin(s) renvoyé(s) avec succès !`, { id: t, duration: 4000 });
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'envoi.", { id: t });
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const allSelected = avail.length > 0 && avail.every((d) => selected.has(`${d.year}-${d.month}`));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-camublue-900">
              <RefreshCw className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Renvoyer un bulletin</h3>
              <p className="text-xs text-slate-500">Sur demande de l'employé</p>
            </div>
          </div>
          <button onClick={onClose} disabled={sending} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 disabled:opacity-40 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto flex-1">
          {/* Recherche par matricule */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Matricule de l'employé</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchBulletins(matricule)}
                  placeholder="ex : 345"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-camublue-900"
                  disabled={sending}
                />
              </div>
              <button
                onClick={() => fetchBulletins(matricule)}
                disabled={loading || sending || !matricule.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {loading ? <ImSpinner2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                Chercher
              </button>
            </div>
          </div>

          {/* Email optionnel */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Email <span className="font-normal text-slate-400">(optionnel – utilise celui de l'employé par défaut)</span>
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex : employe@société.com"
              type="email"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900"
              disabled={sending}
            />
          </div>

          {/* Liste des bulletins disponibles */}
          {fetched && avail.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">
                  Bulletins disponibles <span className="text-slate-400 font-normal">({avail.length})</span>
                </label>
                <button
                  onClick={toggleAll}
                  className="text-xs text-camublue-700 hover:underline font-medium"
                  disabled={sending}
                >
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {avail.map(({ year, month }) => {
                  const key = `${year}-${month}`;
                  const isSelected = selected.has(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition select-none ${isSelected ? "bg-camublue-50" : "hover:bg-slate-50"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(key)}
                        disabled={sending}
                        className="accent-camublue-900 h-4 w-4 shrink-0"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-medium text-slate-700 capitalize">
                          {MONTH_NAMES[month]} {year}
                        </span>
                        <span className="text-xs text-slate-400">
                          {dayjs(`${year}-${String(month).padStart(2, "0")}-01`).format("MM/YYYY")}
                        </span>
                      </div>
                      {isSelected && <CheckCircle className="h-3.5 w-3.5 text-camublue-600 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {fetched && avail.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 text-center">
              Aucun bulletin stocké pour ce matricule.
            </div>
          )}
        </div>

        {/* Footer */}
        {fetched && avail.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-200 shrink-0">
            <button
              onClick={handleSend}
              disabled={selected.size === 0 || sending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white font-semibold text-sm transition disabled:opacity-50"
            >
              {sending ? <ImSpinner2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
              {sending
                ? "Envoi en cours…"
                : selected.size === 0
                ? "Sélectionnez des bulletins"
                : `Renvoyer ${selected.size} bulletin${selected.size > 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
