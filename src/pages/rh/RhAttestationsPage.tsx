// src/pages/rh/RhAttestationsPage.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, CheckCircle, Clock, XCircle, Download,
  RefreshCw, Search, X, AlertCircle, Eye, RotateCcw,
  Send, ChevronDown, ChevronUp,
} from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import AppLayout from "@/layouts/AppLayout";
import { attestationService } from "@/services/attestationService";
import { AttestationRequest, AttestationStatus } from "@/types/attestation";

const STATUS_CONFIG: Record<AttestationStatus, { label: string; cls: string; dotCls: string }> = {
  PENDING:   { label: "En attente",  cls: "bg-amber-50 text-amber-700 border-amber-200",   dotCls: "bg-amber-400"   },
  PROCESSED: { label: "Traité",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dotCls: "bg-emerald-500" },
  REJECTED:  { label: "Refusé",      cls: "bg-red-50 text-red-600 border-red-200",           dotCls: "bg-red-400"     },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

export default function RhAttestationsPage() {
  const [requests,    setRequests]    = useState<AttestationRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterStatus, setFilterStatus] = useState<AttestationStatus | "ALL">("ALL");

  // Modal Traiter
  const [processTarget, setProcessTarget] = useState<AttestationRequest | null>(null);
  const [processNotes,  setProcessNotes]  = useState("");
  const [processing,    setProcessing]    = useState(false);

  // Modal Refuser
  const [rejectTarget, setRejectTarget] = useState<AttestationRequest | null>(null);
  const [rejectNotes,  setRejectNotes]  = useState("");
  const [rejecting,    setRejecting]    = useState(false);

  // Ligne expandée (détails)
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRequests(await attestationService.getAll());
    } catch {
      toast.error("Erreur chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.employee_nom_complet.toLowerCase().includes(q) ||
      r.employee_matricule.toLowerCase().includes(q) ||
      r.document_type_display.toLowerCase().includes(q);
    const matchStatus = filterStatus === "ALL" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    ALL:       requests.length,
    PENDING:   requests.filter(r => r.status === "PENDING").length,
    PROCESSED: requests.filter(r => r.status === "PROCESSED").length,
    REJECTED:  requests.filter(r => r.status === "REJECTED").length,
  };

  // ── Traiter ────────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (!processTarget) return;
    setProcessing(true);
    try {
      const updated = await attestationService.process(processTarget.id, processNotes);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success("Demande traitée — PDF envoyé à l'employé !");
      setProcessTarget(null);
      setProcessNotes("");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors du traitement");
    } finally {
      setProcessing(false);
    }
  };

  // ── Refuser ────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      const updated = await attestationService.reject(rejectTarget.id, rejectNotes);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success("Demande refusée — l'employé a été notifié.");
      setRejectTarget(null);
      setRejectNotes("");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur");
    } finally {
      setRejecting(false);
    }
  };

  // ── Re-générer ──────────────────────────────────────────────────────────────
  const handleRegenerate = async (r: AttestationRequest) => {
    try {
      const updated = await attestationService.regenerate(r.id);
      setRequests(prev => prev.map(x => x.id === updated.id ? updated : x));
      toast.success("PDF re-généré avec succès");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 pb-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Demandes d'attestation</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Gérez les demandes de documents officiels des employés
            </p>
          </div>
          <button onClick={load} className="p-2 rounded-lg border bg-white hover:bg-gray-50 transition" title="Rafraîchir">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>

        {/* ── Barre de recherche + filtres ── */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Recherche — côté gauche */}
          <div className="relative flex-1 min-w-56">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, matricule, type…"
              className="w-full pl-10 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition bg-white"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtres statut — côté droit */}
          <div className="flex gap-2 flex-wrap">
            {(["ALL", "PENDING", "PROCESSED", "REJECTED"] as const).map(s => {
              const label  = s === "ALL" ? "Toutes" : STATUS_CONFIG[s].label;
              const count  = counts[s];
              const active = filterStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition ${
                    active
                      ? "bg-[#003c71] text-white border-[#003c71] shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {label}
                  <span className={`px-1.5 py-0.5 rounded-lg text-xs font-bold ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tableau ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <ImSpinner2 className="animate-spin text-[#003c71]" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <FileText size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500">Aucune demande trouvée</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Employé</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Document demandé</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date demande</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => {
                  const cfg     = STATUS_CONFIG[r.status];
                  const isOpen  = expanded === r.id;
                  return (
                    <>
                      <tr
                        key={r.id}
                        className="hover:bg-gray-50/50 transition cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800">{r.employee_nom_complet}</p>
                          <p className="text-xs text-gray-400 font-mono">{r.employee_matricule} · {r.employee_service}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700">{r.document_type_display}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === "PENDING" && (
                              <>
                                <button
                                  onClick={() => { setProcessTarget(r); setProcessNotes(""); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
                                >
                                  <Send size={12} /> Traiter
                                </button>
                                <button
                                  onClick={() => { setRejectTarget(r); setRejectNotes(""); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition"
                                >
                                  <XCircle size={12} /> Refuser
                                </button>
                              </>
                            )}
                            {r.status === "PROCESSED" && (
                              <>
                                {r.pdf_url && (
                                  <a
                                    href={r.pdf_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#003c71]/10 hover:bg-[#003c71]/20 text-[#003c71] rounded-lg text-xs font-semibold transition"
                                  >
                                    <Download size={12} /> PDF
                                  </a>
                                )}
                                <button
                                  onClick={() => handleRegenerate(r)}
                                  className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition"
                                  title="Re-générer le PDF"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              </>
                            )}
                            <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Ligne détaillée ── */}
                      {isOpen && (
                        <tr key={`${r.id}-detail`} className="bg-gray-50/50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <p className="text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Fonction</p>
                                <p className="text-gray-700">{r.employee_fonction}</p>
                              </div>
                              {r.processed_at && (
                                <div>
                                  <p className="text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Traité le</p>
                                  <p className="text-gray-700">{fmtDateTime(r.processed_at)}</p>
                                </div>
                              )}
                              {r.processed_by && (
                                <div>
                                  <p className="text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Traité par</p>
                                  <p className="text-gray-700">{r.processed_by}</p>
                                </div>
                              )}
                              {Object.keys(r.extra_data || {}).length > 0 && (
                                <div className="col-span-2">
                                  <p className="text-gray-400 uppercase tracking-wide font-semibold mb-1">Informations complémentaires</p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(r.extra_data).map(([k, v]) => (
                                      <span key={k} className="px-2 py-0.5 bg-white border border-gray-200 rounded-lg text-gray-600">
                                        <span className="text-gray-400">{k.replace(/_/g, " ")} :</span> {v}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {r.notes && (
                                <div className="col-span-2">
                                  <p className="text-gray-400 uppercase tracking-wide font-semibold mb-0.5">
                                    {r.status === "REJECTED" ? "Motif de refus" : "Notes"}
                                  </p>
                                  <p className={`${r.status === "REJECTED" ? "text-red-600" : "text-gray-700"}`}>{r.notes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Modal Traiter ════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {processTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setProcessTarget(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Send size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Traiter la demande</p>
                  <p className="text-white/70 text-xs truncate">{processTarget.employee_nom_complet} — {processTarget.document_type_display}</p>
                </div>
                <button onClick={() => !processing && setProcessTarget(null)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                  <X size={14} className="text-white" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-xs text-emerald-700">
                    Le PDF sera <strong>généré automatiquement</strong> avec les données du profil de l'employé,
                    puis envoyé par email à <strong>{processTarget.employee_nom_complet}</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Notes (optionnel)
                  </label>
                  <textarea
                    value={processNotes}
                    onChange={e => setProcessNotes(e.target.value)}
                    rows={3}
                    placeholder="Remarques pour l'employé…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none transition"
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => !processing && setProcessTarget(null)}
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                    Annuler
                  </button>
                  <button onClick={handleProcess} disabled={processing}
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                    {processing
                      ? <><ImSpinner2 className="animate-spin" size={14} /> Génération PDF…</>
                      : <><Send size={14} /> Générer &amp; Envoyer</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ Modal Refuser ════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {rejectTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !rejecting && setRejectTarget(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-red-500 px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <AlertCircle size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Refuser la demande</p>
                  <p className="text-white/70 text-xs truncate">{rejectTarget.employee_nom_complet} — {rejectTarget.document_type_display}</p>
                </div>
                <button onClick={() => !rejecting && setRejectTarget(null)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                  <X size={14} className="text-white" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Motif du refus <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={rejectNotes}
                    onChange={e => setRejectNotes(e.target.value)}
                    rows={4}
                    placeholder="Ex : Informations manquantes dans votre dossier…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 resize-none transition"
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => !rejecting && setRejectTarget(null)}
                    className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
                    Annuler
                  </button>
                  <button onClick={handleReject} disabled={rejecting || !rejectNotes.trim()}
                    className="flex-[2] bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
                    {rejecting
                      ? <><ImSpinner2 className="animate-spin" size={14} /> En cours…</>
                      : <><XCircle size={14} /> Confirmer le refus</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
