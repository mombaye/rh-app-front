// src/pages/WelcomePage.tsx
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/images/logo-camusat.png";

export default function WelcomePage() {
  const navigate = useNavigate();

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
        </div>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="py-5 text-center text-xs text-slate-900 border-t border-slate-100">
        © {new Date().getFullYear()} Camusat — Usage interne uniquement
      </footer>

    </div>
  );
}
