// src/components/employees/BulkCreateAccountsModal.tsx
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, UserPlus, CheckCircle, AlertTriangle,
  Users, Search, ChevronRight,
} from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import { bulkCreateAccounts, type BulkCreateAccountsResult } from "@/services/employeeService";
import { Employee } from "@/types/employee";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BulkMode = "all" | "selection";
type Step = "choice" | "confirm" | "select" | "loading" | "result";

interface Props {
  open:         boolean;
  contractType: "INTERNE" | "INTERIM";
  employees:    Employee[];
  onClose:      () => void;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function BulkCreateAccountsModal({
  open, contractType, employees, onClose,
}: Props) {
  const [step,     setStep]     = useState<Step>("choice");
  const [mode,     setMode]     = useState<BulkMode>("all");
  const [result,   setResult]   = useState<BulkCreateAccountsResult | null>(null);
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const label = contractType === "INTERNE" ? "internes" : "intérimaires";

  // ── Sélection — seulement les employés sans compte ──────────────────────────
  const withoutAccount = useMemo(
    () => employees.filter(e => !e.has_user),
    [employees]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withoutAccount.filter(e =>
      !q ||
      `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
      (e.matricule || "").toLowerCase().includes(q) ||
      (e.service   || "").toLowerCase().includes(q)
    );
  }, [withoutAccount, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) { filtered.forEach(e => next.delete(e.id)); }
      else                     { filtered.forEach(e => next.add(e.id));    }
      return next;
    });
  };

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Création ────────────────────────────────────────────────────────────────
  const handleRun = async () => {
    setStep("loading");
    try {
      const ids = mode === "selection" ? Array.from(selected) : undefined;
      const res = await bulkCreateAccounts(contractType, ids);
      setResult(res);
      setStep("result");
      if (res.comptes_crees > 0) {
        toast.success(`${res.comptes_crees} compte(s) créé(s) et email(s) envoyé(s) !`);
      } else {
        toast(`Aucun nouveau compte à créer.`, { icon: "ℹ️" });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de la création des comptes");
      setStep(mode === "selection" ? "select" : "confirm");
    }
  };

  const handleClose = () => {
    setStep("choice");
    setMode("all");
    setResult(null);
    setSearch("");
    setSelected(new Set());
    onClose();
  };

  const selectMode = (m: BulkMode) => {
    setMode(m);
    setStep(m === "all" ? "confirm" : "select");
  };

  const goBack = () => setStep("choice");

  // ── Titre header selon étape ─────────────────────────────────────────────────
  const headerTitle = {
    choice:  "Créer les comptes",
    confirm: "Tous les employés",
    select:  "Sélectionner des employés",
    loading: "Création en cours…",
    result:  "Résultat",
  }[step];

  const headerSub = {
    choice:  `Employés ${label}`,
    confirm: `Employés ${label} sans compte`,
    select:  `${withoutAccount.length} sans compte · ${selected.size} sélectionné(s)`,
    loading: "Envoi des emails de bienvenue",
    result:  `${result?.comptes_crees ?? 0} compte(s) créé(s)`,
  }[step];

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={step !== "loading" ? handleClose : undefined}
        >
          <motion.div
            key={step === "select" ? "large" : "normal"}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col ${
              step === "select" ? "max-w-lg max-h-[85vh]" : "max-w-md"
            }`}
          >
            {/* ── Header ── */}
            <div className="bg-camublue-900 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  {step === "select"
                    ? <Users size={18} className="text-white" />
                    : <UserPlus size={18} className="text-white" />
                  }
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{headerTitle}</p>
                  <p className="text-white/60 text-xs">{headerSub}</p>
                </div>
              </div>
              {step !== "loading" && (
                <button onClick={handleClose} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                  <X size={14} className="text-white" />
                </button>
              )}
            </div>

            {/* ── Corps ── */}
            <div className={`${step === "select" ? "overflow-y-auto flex-1" : ""} p-6`}>

              {/* ── Étape 1 : Choix ── */}
              {step === "choice" && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-4">
                    Comment souhaitez-vous créer les comptes ?
                  </p>

                  <button
                    onClick={() => selectMode("all")}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 group-hover:bg-emerald-200 flex items-center justify-center shrink-0 transition">
                      <UserPlus size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Tous les employés {label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Crée automatiquement les comptes pour tous les employés sans compte
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500 shrink-0 transition" />
                  </button>

                  <button
                    onClick={() => selectMode("selection")}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-gray-200 hover:border-camublue-900/40 hover:bg-camublue-900/5 transition group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-camublue-900/10 group-hover:bg-camublue-900/20 flex items-center justify-center shrink-0 transition">
                      <Users size={18} className="text-camublue-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Sélectionner des employés</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Choisir manuellement les employés concernés depuis la liste
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-camublue-900 shrink-0 transition" />
                  </button>
                </div>
              )}

              {/* ── Étape 2a : Confirmation (tous) ── */}
              {step === "confirm" && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                    <p className="text-sm font-semibold text-blue-800">Ce que cette action va faire</p>
                    <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                      <li>Identifier tous les employés <strong>{label} actifs</strong> sans compte</li>
                      <li>Attribuer automatiquement le rôle <strong>Manager N1/N2</strong> selon la hiérarchie</li>
                      <li>Attribuer le double accès <strong>RH</strong> si le service est "RH"</li>
                      <li>Générer un mot de passe provisoire et envoyer un email à chacun</li>
                    </ul>
                    <p className="text-xs text-blue-500 mt-1">Les employés avec un compte existant ne sont pas affectés.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={goBack} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Retour
                    </button>
                    <button onClick={handleRun} className="flex-[2] bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                      <UserPlus size={14} /> Créer &amp; envoyer les emails
                    </button>
                  </div>
                </div>
              )}

              {/* ── Étape 2b : Sélection ── */}
              {step === "select" && (
                <div className="space-y-3">
                  {/* Recherche */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher par nom, matricule, service…"
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-camublue-900 focus:ring-2 focus:ring-camublue-900/20 transition"
                    />
                  </div>

                  {/* Tout sélectionner + compteur */}
                  <div className="flex items-center justify-between px-1">
                    <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs font-medium text-camublue-900 hover:underline">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${allFilteredSelected ? "bg-camublue-900 border-camublue-900" : "border-gray-300"}`}>
                        {allFilteredSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                      </div>
                      {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}
                    </button>
                    <span className="text-xs text-gray-500">
                      <span className="font-semibold text-camublue-900">{selected.size}</span> sélectionné(s)
                    </span>
                  </div>

                  {/* Liste */}
                  <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    {withoutAccount.length === 0 ? (
                      <div className="text-center py-8 space-y-1">
                        <p className="text-sm font-medium text-gray-500">Tous les employés ont déjà un compte</p>
                        <p className="text-xs text-gray-400">Aucun compte à créer</p>
                      </div>
                    ) : filtered.length === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-8">Aucun résultat pour cette recherche</p>
                    ) : filtered.map(emp => {
                      const isSel = selected.has(emp.id);
                      return (
                        <div key={emp.id} onClick={() => toggle(emp.id)}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-gray-50 last:border-0 transition ${isSel ? "bg-camublue-900/5" : "hover:bg-gray-50"}`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${isSel ? "bg-camublue-900 border-camublue-900" : "border-gray-300"}`}>
                            {isSel && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{emp.prenom} {emp.nom}</p>
                            <p className="text-xs text-gray-400 truncate">{emp.matricule}{emp.service ? ` · ${emp.service}` : ""}</p>
                          </div>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                            {emp.type_contrat}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={goBack} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                      Retour
                    </button>
                    <button onClick={handleRun} disabled={selected.size === 0}
                      className="flex-[2] bg-camublue-900 hover:bg-camublue-900/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2"
                    >
                      <UserPlus size={14} />
                      Créer {selected.size > 0 ? `${selected.size} compte(s)` : "les comptes"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Chargement ── */}
              {step === "loading" && (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <ImSpinner2 className="animate-spin text-camublue-900" size={32} />
                  <div className="text-center">
                    <p className="text-gray-700 font-medium">Création des comptes en cours…</p>
                    <p className="text-gray-400 text-sm mt-1">Envoi des emails de bienvenue</p>
                  </div>
                </div>
              )}

              {/* ── Résultat ── */}
              {step === "result" && result && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center p-3 rounded-xl border border-gray-200 bg-white">
                      <p className="text-2xl font-bold text-camublue-900">{result.total_sans_compte}</p>
                      <p className="text-xs text-gray-500 mt-0.5 text-center">Sans compte</p>
                    </div>
                    <div className="flex flex-col items-center p-3 rounded-xl border border-emerald-200 bg-emerald-50">
                      <p className="text-2xl font-bold text-emerald-700">{result.comptes_crees}</p>
                      <p className="text-xs text-emerald-600 mt-0.5 text-center">Créés</p>
                    </div>
                    <div className={`flex flex-col items-center p-3 rounded-xl border ${result.erreurs.length > 0 ? "border-red-200 bg-red-50" : "border-gray-100 bg-gray-50"}`}>
                      <p className={`text-2xl font-bold ${result.erreurs.length > 0 ? "text-red-600" : "text-gray-400"}`}>{result.erreurs.length}</p>
                      <p className="text-xs text-gray-500 mt-0.5 text-center">Erreurs</p>
                    </div>
                  </div>

                  {result.comptes_crees === 0 && result.erreurs.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <CheckCircle size={16} className="text-blue-500 shrink-0" />
                      <p className="text-sm text-blue-700">Tous les employés sélectionnés ont déjà un compte.</p>
                    </div>
                  ) : result.comptes_crees > 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                      <p className="text-sm text-emerald-700 font-medium">
                        {result.comptes_crees} compte(s) créé(s) — emails envoyés.
                      </p>
                    </div>
                  ) : null}

                  {result.details_crees.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 max-h-36 overflow-y-auto">
                      <p className="text-xs font-semibold text-emerald-700 mb-1.5">Comptes créés</p>
                      {result.details_crees.map((c, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5">
                          <p className="text-xs text-emerald-800 truncate">{c.nom} <span className="text-emerald-500">— {c.email}</span></p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-2 shrink-0 ${
                            c.role === "RH" ? "bg-purple-100 text-purple-700"
                            : c.role.includes("Manager") ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                          }`}>{c.role}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.erreurs.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                        <AlertTriangle size={12} /> Erreurs ({result.erreurs.length})
                      </p>
                      {result.erreurs.map((e, i) => (
                        <p key={i} className="text-xs text-red-600 py-0.5">{e.nom} — {e.erreur}</p>
                      ))}
                    </div>
                  )}

                  <button onClick={handleClose} className="w-full bg-camublue-900 hover:bg-camublue-900/90 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                    Fermer
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
