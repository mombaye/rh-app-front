import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiStar, FiMessageSquare } from "react-icons/fi";
import { ImSpinner2 } from "react-icons/im";
import api from "@/api/axios";
import toast from "react-hot-toast";

type Campaign = { id: number; title: string; description: string; has_responded: boolean };

const LS_DISMISSED = (id: number) => `feedback_dismissed_${id}`;
const LS_DONE      = (id: number) => `feedback_done_${id}`;

export default function FeedbackBanner() {
  const [campaign,  setCampaign]  = useState<Campaign | null>(null);
  const [visible,   setVisible]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [rating,    setRating]    = useState(0);
  const [hover,     setHover]     = useState(0);
  const [comment,   setComment]   = useState("");
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    api.get("/api/feedback/active/")
      .then(res => {
        const c: Campaign = res.data;
        const dismissed = localStorage.getItem(LS_DISMISSED(c.id));
        const done      = localStorage.getItem(LS_DONE(c.id));
        if (!c.has_responded && !dismissed && !done) {
          setCampaign(c);
          setTimeout(() => setVisible(true), 1500);
        }
      })
      .catch(() => {}); // 204 ou erreur → on ne fait rien
  }, []);

  const dismiss = () => {
    if (campaign) localStorage.setItem(LS_DISMISSED(campaign.id), "1");
    setVisible(false);
  };

  const submit = async () => {
    if (!rating) { toast.error("Veuillez donner une note."); return; }
    setLoading(true);
    try {
      await api.post("/api/feedback/submit/", { rating, comment });
      if (campaign) localStorage.setItem(LS_DONE(campaign.id), "1");
      toast.success("Merci pour votre avis !");
      setModalOpen(false);
      setVisible(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Erreur lors de l'envoi.");
    } finally {
      setLoading(false);
    }
  };

  if (!campaign) return null;

  return (
    <>
      {/* ── Bannière fixe en bas ── */}
      <AnimatePresence>
        {visible && !modalOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{   y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-camublue-900/10 flex items-center justify-center shrink-0">
                <FiMessageSquare size={18} className="text-camublue-900" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{campaign.title}</p>
                {campaign.description && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{campaign.description}</p>
                )}
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="shrink-0 bg-camublue-900 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl hover:bg-camublue-800 transition"
              >
                Donner mon avis
              </button>
              <button
                onClick={dismiss}
                className="shrink-0 p-1 text-slate-300 hover:text-slate-500 transition rounded-lg"
              >
                <FiX size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal de notation ── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-6 sm:pb-0"
            onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">{campaign.title}</h3>
                  {campaign.description && (
                    <p className="text-sm text-slate-400 mt-0.5">{campaign.description}</p>
                  )}
                </div>
                <button onClick={() => setModalOpen(false)} className="p-1 text-slate-300 hover:text-slate-500 rounded-lg transition ml-2">
                  <FiX size={16} />
                </button>
              </div>

              {/* Étoiles */}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Votre note</p>
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <FiStar
                      size={30}
                      className={`transition-colors ${
                        n <= (hover || rating)
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-200"
                      }`}
                      style={{ fill: n <= (hover || rating) ? "#fbbf24" : "none" }}
                    />
                  </button>
                ))}
              </div>

              {/* Commentaire */}
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Commentaire <span className="normal-case font-normal text-slate-400">(optionnel)</span>
              </p>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder="Partagez votre expérience, vos suggestions…"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none bg-slate-50 focus:outline-none focus:ring-2 focus:ring-camublue-900/20 focus:bg-white transition"
              />

              <button
                onClick={submit}
                disabled={loading || !rating}
                className="mt-4 w-full bg-camublue-900 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-camublue-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading
                  ? <><ImSpinner2 size={14} className="animate-spin" /> Envoi…</>
                  : "Envoyer mon avis"
                }
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
