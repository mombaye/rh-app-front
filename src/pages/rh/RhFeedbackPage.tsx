import { useEffect, useState } from "react";
import AppLayout from "@/layouts/AppLayout";
import api from "@/api/axios";
import toast from "react-hot-toast";
import { FiStar, FiPlus, FiToggleLeft, FiToggleRight, FiMessageSquare, FiUsers, FiX, FiSearch } from "react-icons/fi";
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

// ── Modal réponses ────────────────────────────────────────────────────────────
function ResponsesModal({
  campaign,
  responses,
  loading,
  onClose,
}: {
  campaign: Campaign;
  responses: ResponseItem[];
  loading: boolean;
  onClose: () => void;
}) {
  const [search, setSearch]       = useState("");
  const [filterStar, setFilterStar] = useState<number | null>(null);

  const filtered = responses.filter(r => {
    const matchStar   = filterStar === null || r.rating === filterStar;
    const matchSearch = search.trim() === "" ||
      r.user_display.toLowerCase().includes(search.toLowerCase()) ||
      r.comment.toLowerCase().includes(search.toLowerCase());
    return matchStar && matchSearch;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 28, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
      >
        {/* En-tête modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800 truncate">{campaign.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {campaign.total} réponse{campaign.total > 1 ? "s" : ""}
              {campaign.avg_rating > 0 && (
                <span className="ml-2 font-semibold text-amber-500">
                  ★ {campaign.avg_rating.toFixed(1)} / 5
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-300 hover:text-slate-500 rounded-lg transition shrink-0">
            <FiX size={16} />
          </button>
        </div>

        {/* Filtres */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un employé ou un commentaire…"
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-camublue-900/20 focus:bg-white transition"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setFilterStar(null)}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition ${filterStar === null ? "bg-camublue-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
            >
              Tous
            </button>
            {[5, 4, 3, 2, 1].map(s => (
              <button
                key={s}
                onClick={() => setFilterStar(filterStar === s ? null : s)}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition ${filterStar === s ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                {s}★
              </button>
            ))}
          </div>
        </div>

        {/* Liste des réponses */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <ImSpinner2 size={24} className="animate-spin text-slate-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <FiMessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun avis correspondant.</p>
            </div>
          ) : (
            filtered.map(r => (
              <div key={r.id} className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0 text-camublue-900 font-bold text-sm">
                  {r.user_display.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-700">{r.user_display}</span>
                    <Stars value={r.rating} size={12} />
                    <span className="text-[10px] text-slate-300 ml-auto shrink-0">
                      {new Date(r.submitted_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                    </span>
                  </div>
                  {r.comment ? (
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                      {r.comment}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300 mt-1 italic">Aucun commentaire écrit.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pied modal */}
        {filtered.length > 0 && !loading && (
          <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 text-right">
            {filtered.length} réponse{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
            {filterStar || search ? ` sur ${responses.length}` : ""}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function RhFeedbackPage() {
  const [campaigns,   setCampaigns]   = useState<Campaign[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [responses,   setResponses]   = useState<ResponseItem[]>([]);
  const [respLoading, setRespLoading] = useState(false);
  const [createOpen,  setCreateOpen]  = useState(false);
  const [newTitle,    setNewTitle]    = useState("");
  const [newDesc,     setNewDesc]     = useState("");
  const [creating,    setCreating]    = useState(false);

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

  const openResponses = async (c: Campaign) => {
    setSelectedCampaign(c);
    setRespLoading(true);
    setResponses([]);
    try {
      const res = await api.get(`/api/feedback/campaigns/${c.id}/responses/`);
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
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 bg-camublue-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-camublue-800 transition"
          >
            <FiPlus size={15} /> Nouvelle campagne
          </button>
        </div>

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
                        onClick={() => openResponses(c)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-camublue-900 hover:bg-camublue-900/5 px-3 py-1.5 rounded-xl transition border border-camublue-900/20"
                      >
                        <FiUsers size={12} /> Voir les avis
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal création campagne */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={e => { if (e.target === e.currentTarget) { setCreateOpen(false); setNewTitle(""); setNewDesc(""); } }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-slate-800">Nouvelle campagne</p>
                <button
                  onClick={() => { setCreateOpen(false); setNewTitle(""); setNewDesc(""); }}
                  className="p-1 text-slate-300 hover:text-slate-500 rounded-lg transition"
                >
                  <FiX size={16} />
                </button>
              </div>
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Titre de la campagne (ex : Votre avis compte !)"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-camublue-900/20 focus:bg-white transition"
              />
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={3}
                placeholder="Description / sous-titre (optionnel)"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none bg-slate-50 focus:outline-none focus:ring-2 focus:ring-camublue-900/20 focus:bg-white transition"
              />
              <p className="text-xs text-slate-400">La campagne sera activée immédiatement et les autres seront désactivées.</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setCreateOpen(false); setNewTitle(""); setNewDesc(""); }}
                  className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                >
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal réponses */}
      <AnimatePresence>
        {selectedCampaign && (
          <ResponsesModal
            campaign={selectedCampaign}
            responses={responses}
            loading={respLoading}
            onClose={() => { setSelectedCampaign(null); setResponses([]); }}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
