// src/pages/WelcomePage.tsx
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { UserRound, Users, ShieldCheck } from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";

const ROLES = [
  {
    id: "employe",
    label: "Employé",
    description: "Bulletins de paie, congés\net informations personnelles",
    icon: UserRound,
    color: "#1e78c2",
    light: "#dbeeff",
    gradient: "linear-gradient(135deg, #1e78c2 0%, #2f8de0 100%)",
  },
  {
    id: "manager",
    label: "Manager",
    description: "Gestion d'équipe, planning\net suivi des absences",
    icon: Users,
    color: "#0d5393",
    light: "#d0e4f7",
    gradient: "linear-gradient(135deg, #0d5393 0%, #1b6bbf 100%)",
  },
  {
    id: "rh",
    label: "RH",
    description: "Administration, rapports\net gestion du personnel",
    icon: ShieldCheck,
    color: "#003c71",
    light: "#c5ddf0",
    gradient: "linear-gradient(135deg, #003c71 0%, #0a5090 100%)",
  },
] as const;

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
            className="h-10 w-auto mx-auto mb-8"
            draggable={false}
          />
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight whitespace-nowrap">
            Tout <span className="text-camublue-900">Camusat</span>, en un seul endroit
          </h1>
          <p className="mt-4 text-base text-slate-500 max-w-lg mx-auto leading-relaxed">
            Congés, bulletins de paie, gestion d'équipe, administration —
            accédez à votre espace en quelques secondes.
          </p>
        </motion.div>

        {/* Sélection rôle */}
        <motion.p
          className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Choisissez votre espace
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-2xl">
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            return (
              <motion.button
                key={role.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                whileHover={{ y: -4, boxShadow: `0 16px 40px 0 ${role.color}30` }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/login?role=${role.id}`)}
                className="group flex flex-col items-center gap-4 px-6 py-8 rounded-2xl border border-slate-200 bg-white transition-all duration-200 text-center cursor-pointer overflow-hidden relative"
              >
                {/* Barre colorée en haut */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{ background: role.gradient }}
                />

                {/* Icône avec fond coloré */}
                <div
                  className="p-3.5 rounded-xl transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: role.light }}
                >
                  <Icon
                    className="h-6 w-6"
                    style={{ color: role.color }}
                    strokeWidth={1.8}
                  />
                </div>

                <div>
                  <p
                    className="font-bold text-base"
                    style={{ color: role.color }}
                  >
                    {role.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-snug whitespace-pre-line">
                    {role.description}
                  </p>
                </div>

                {/* Flèche au hover */}
                <span
                  className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 -mt-1"
                  style={{ color: role.color }}
                >
                  Accéder →
                </span>
              </motion.button>
            );
          })}
        </div>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="py-5 text-center text-xs text-slate-300 border-t border-slate-100">
        © {new Date().getFullYear()} Camusat Sénégal — Usage interne uniquement
      </footer>

    </div>
  );
}
