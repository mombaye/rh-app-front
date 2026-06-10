// src/components/common/DownloadAppButton.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, X } from "lucide-react";

interface DownloadAppButtonProps {
  className?: string;
}

/**
 * Bouton "Télécharger l'app" + modal "Bientôt disponible".
 * Affiché sur les tableaux de bord de chaque profil (RH, Manager, Employé, Admin).
 */
export default function DownloadAppButton({ className }: DownloadAppButtonProps) {
  const [showAppModal, setShowAppModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowAppModal(true)}
        className={
          className ??
          "flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 border border-camublue-900 px-3 py-2 rounded-xl text-xs font-medium text-white transition shadow-sm"
        }
      >
        <Smartphone className="h-3.5 w-3.5 text-white" />
        <span>Télécharger l'app</span>
      </button>

      {/* ── Modal "Bientôt disponible" ───────────────────────────────────── */}
      <AnimatePresence>
        {showAppModal && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setShowAppModal(false)}
            />

            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed z-50 inset-0 flex items-center justify-center px-4"
            >
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center relative">

                {/* Fermer */}
                <button
                  onClick={() => setShowAppModal(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Icône */}
                <div className="w-20 h-20 rounded-2xl bg-camublue-900/8 flex items-center justify-center mb-5">
                  <Smartphone className="h-10 w-10 text-camublue-900" strokeWidth={1.5} />
                </div>

                {/* Texte */}
                <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">
                  Application mobile
                </h2>
                <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
                  L'application mobile <span className="font-semibold text-slate-700">eRH Camusat</span> sera
                  bientôt disponible sur iOS et Android.
                </p>

                <p className="text-xs text-slate-400 text-center">
                  Disponible prochainement — restez connectés !
                </p>

                <button
                  onClick={() => setShowAppModal(false)}
                  className="mt-5 w-full py-3 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
