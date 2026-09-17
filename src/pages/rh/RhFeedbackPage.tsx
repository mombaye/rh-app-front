import { useEffect, useState } from "react";
import AppLayout from "@/layouts/AppLayout";
import api from "@/api/axios";
import toast from "react-hot-toast";
import { FiStar, FiPlus, FiToggleLeft, FiToggleRight, FiMessageSquare, FiUsers, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import { motion, AnimatePresence } from "framer-motion";

type Campaign = {
  id: number;
  title: string;
  description: string;
  is_active: boolean;
  is_currently_active: boolean;
  created_at: string;
  ends_at: string | null;
  avg_rating: number;
  total: number;
  by_star: Record<number, number>;
};

type ResponseItem = {
  id: number;
  user_display: string;
  username: string;
  rating: number;
  comment: string;
  submitted_at: string;
};

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <FiStar
          key={n}
          size={size}
          className={n <= Math.round(value) ? "text-amber-400" : "text-slate-200"}
          style={{ fill: n <= Math.round(value) ? "#fbbf24" : "none" }}
        />
      ))}
    </span>
  );
}

export default function RhFeedbackPage() {
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedId,   setSelectedId]   = useState<number | null>(null);
  const [responses,    setResponses]    = useState<ResponseItem[]>([]);
  const [respLoading,  setRespLoading]  = useState(false);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [newTitle,     setNewTitle]     = useState("");
  const [newDesc,      setNewDesc]      = useState("");
  const [creating,     setCreating]     = useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get("/api/feedback/campaigns/");
      setCampaigns(res.data);
    } catch {
      toast.error("Erreur lors du chargement des campagnes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchResponses = async (id: number) => {
    if (selectedId === id) { setSelectedId(null); return; }
    setSelectedId(id);
    setRespLoading(true);
    try {
      const res = await api.get(`/api/feedback/campaigns/${id}/responses/`);
      setResponses(res.data.responses);
    } catch {
      toast.error("Erreur lors du chargement des réponses.");
    } finally {
      setRespLoading(false);
    }
  };

  const toggle = async (id: number) => {
    try {
      const res = await api.patch(`/api/feedback/campaigns/${id}/toggle/`);
      setCampaigns(prev => prev.map(c =>
        c.id === id ? { ...c, is_active: res.data.is_active, is_currently_active: res.data.is_active } : c
      ));
      toast.success(res.data.is_active ? "Campagne activée." : "Campagne désactivée.");
    } catch {
      toast.error("Erreur.");
    }
  };

  const createCampaign = async () => {
    if (!newTitle.trim()) { toast.error("Le titre est obligatoire."); return; }
    setCreating(true);
    try {
      await api.post("/api/feedback/campaigns/", { title: newTitle.trim(), description: newDesc.trim() });
      toast.success("Campagne créée et activée.");
      setNewTitle(""); setNewDesc(""); setCreateOpen(false);
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de la création.");
    } finally {
      setCreating(false);
    }
  };

  const activeCampaign = campaigns.find(c => c.is_currently_active);

  return (
    <AppLayout>
      <div className="space-y-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Avis des employés</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Gérez les campagnes de retour et consultez les avis reçus
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(v => !v)}
            className="inline-flex items-center gap-2 bg-camublue-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-camublue-800 transition"
          >
            <FiPlus size={15} /> Nouvelle campagne
          </button>
        </div>

        {/* Formulaire création */}
        <AnimatePresence>
          {createOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-700">Nouvelle campagne</p>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Titre de la campagne (ex: Votre avis compte !)"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-camublue-900/20 focus:bg-white transition"
                />
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={2}
                  placeholder="Description / sous-titre (optionnel)"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none bg-slate-50 focus:outline-none focus:ring-2 focus:ring-camublue-900/20 focus:bg-white transition"
                />
                <p className="text-xs text-slate-400">La campagne sera activée immédiatement et les autres seront désactivées.</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setCreateOpen(false)} className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition">
                    Annuler
                  </button>
                  <button
                    onClick={createCampaign}
                    disabled={creating}
                    className="inline-flex items-center gap-2 bg-camublue-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-camublue-800 transition disabled:opacity-50"
                  >
                    {creating ? <ImSpinner2 size={13} className="animate-spin" /> : null}
                    Créer et activer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Statut actif */}
        {activeCampaign && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-sm font-semibold text-emerald-700">Campagne active :</span>
            <span className="text-sm text-emerald-600">{activeCampaign.title}</span>
            <span className="ml-auto text-sm text-emerald-500 font-medium">{activeCampaign.total} réponse{activeCampaign.total > 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Liste des campagnes */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ImSpinner2 size={28} className="animate-spin text-camublue-900/30" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FiMessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune campagne créée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* En-tête campagne */}
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{c.title}</span>
                      {c.is_currently_active && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Active
                        </span>
                      )}
                    </div>
                    {c.description && <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>}
                    <p className="text-xs text-slate-300 mt-1">
                      Créée le {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-xl font-black text-slate-800">{c.avg_rating > 0 ? c.avg_rating.toFixed(1) : "—"}</p>
                      <Stars value={c.avg_rating} size={12} />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black text-camublue-900">{c.total}</p>
                      <p className="text-[10px] text-slate-400 font-medium">réponse{c.total > 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggle(c.id)}
                      className={`p-1.5 rounded-lg transition ${c.is_active ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-50"}`}
                      title={c.is_active ? "Désactiver" : "Activer"}
                    >
                      {c.is_active ? <FiToggleRight size={22} /> : <FiToggleLeft size={22} />}
                    </button>
                    {c.total > 0 && (
                      <button
                        onClick={() => fetchResponses(c.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-camublue-900 hover:bg-camublue-900/5 px-3 py-1.5 rounded-xl transition border border-camublue-900/20"
                      >
                        <FiUsers size={12} /> Voir les avis
                        {selectedId === c.id ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Barre de distribution des étoiles */}
                {c.total > 0 && (
                  <div className="px-5 pb-4 grid grid-cols-5 gap-1.5">
                    {[5, 4, 3, 2, 1].map(star => {
                      const pct = c.total > 0 ? Math.round((c.by_star[star] || 0) / c.total * 100) : 0;
                      return (
                        <div key={star} className="flex flex-col items-center gap-1">
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400">{star}★ {c.by_star[star] || 0}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Réponses détaillées */}
                <AnimatePresence>
                  {selectedId === c.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-slate-100 px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
                        {respLoading ? (
                          <div className="flex justify-center py-4">
                            <ImSpinner2 size={20} className="animate-spin text-slate-300" />
                          </div>
                        ) : responses.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-4">Aucun avis pour cette campagne.</p>
                        ) : (
                          responses.map(r => (
                            <div key={r.id} className="flex gap-3 items-start">
                              <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0 text-camublue-900 font-bold text-xs">
                                {r.user_display.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-700">{r.user_display}</span>
                                  <Stars value={r.rating} size={11} />
                                  <span className="text-[10px] text-slate-300 ml-auto">
                                    {new Date(r.submitted_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                                  </span>
                                </div>
                                {r.comment && (
                                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{r.comment}</p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
