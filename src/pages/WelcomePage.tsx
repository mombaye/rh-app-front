// src/pages/WelcomePage.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Smartphone, X } from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";

export default function WelcomePage() {
  const navigate = useNavigate();
  const [showAppModal, setShowAppModal] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Contenu principal ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">

        {/* Titre */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src={logo}
            alt="Camusat"
            className="h-28 w-auto mx-auto mb-8"
            draggable={false}
          />
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight whitespace-nowrap">
            Portail Collaborateur
          </h1>
          <p className="mt-4 text-base text-slate-500 max-w-lg mx-auto leading-relaxed">
            Connectez-vous pour accéder à votre espace.
          </p>
        </motion.div>

        {/* Boutons */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Se connecter */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            whileHover={{ y: -3, boxShadow: "0 12px 32px 0 rgba(0,60,113,0.2)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/login")}
            className="px-10 py-4 rounded-2xl bg-camublue-900 hover:bg-camublue-800 text-white font-bold text-base tracking-wide transition-all duration-200 cursor-pointer"
          >
            Se connecter
          </motion.button>

          {/* Télécharger l'app */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            whileHover={{ y: -3, boxShadow: "0 8px 24px 0 rgba(0,0,0,0.10)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAppModal(true)}
            className="flex items-center gap-2 px-10 py-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-camublue-900/30 hover:bg-slate-50 text-slate-700 font-bold text-base tracking-wide transition-all duration-200 cursor-pointer"
          >
            <Smartphone className="h-5 w-5 text-camublue-900" />
            Télécharger l'app
          </motion.button>
        </div>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="py-5 text-center text-xs text-slate-900 border-t border-slate-100">
        © {new Date().getFullYear()} Camusat — Usage interne uniquement
      </footer>

      {/* ── Modal "Bientôt disponible" ───────────────────────────────────────── */}
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

                {/* Badges stores (visuels) */}
                <div className="flex gap-3 mb-6">
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 opacity-50">
                    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <span className="text-xs font-semibold text-slate-600">App Store</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 opacity-50">
                    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.18 23.76c.3.17.64.22.99.14l12.47-7.18-2.8-2.8-10.66 9.84zm-1.5-20.3C1.47 3.78 1.5 4.1 1.5 4.44v15.12c0 .34-.03.66.18.98l.09.08 8.47-8.47v-.2L1.77 3.38l-.09.08zm18.5 8.5l-2.51-1.45-3.11 3.11 3.11 3.11 2.53-1.46c.72-.42.72-1.89-.02-2.31zM4.17.24L16.64 7.42l-2.8 2.8L3.18.38C3.5.24 3.87.1 4.17.24z"/>
                    </svg>
                    <span className="text-xs font-semibold text-slate-600">Google Play</span>
                  </div>
                </div>

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

    </div>
  );
}
