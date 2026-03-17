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
  },
  {
    id: "manager",
    label: "Manager",
    description: "Gestion d'équipe, planning\net suivi des absences",
    icon: Users,
  },
  {
    id: "rh",
    label: "RH",
    description: "Administration, rapports\net gestion du personnel",
    icon: ShieldCheck,
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
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Tout
            <span className="text-camublue-900"> Camusat</span>,<br />en un seul endroit
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            return (
              <motion.button
                key={role.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                whileHover={{ y: -3, boxShadow: "0 12px 32px 0 rgba(0,60,113,0.13)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/login?role=${role.id}`)}
                className="group flex flex-col items-center gap-3 px-6 py-8 rounded-2xl border-2 border-slate-200 bg-white hover:border-camublue-900/60 hover:bg-slate-50 transition-all duration-200 text-center cursor-pointer"
              >
                <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-camublue-900/10 transition-colors duration-200">
                  <Icon
                    className="h-6 w-6 text-slate-500 group-hover:text-camublue-900 transition-colors duration-200"
                    strokeWidth={1.8}
                  />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-base group-hover:text-camublue-900 transition-colors duration-200">
                    {role.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-snug whitespace-pre-line">
                    {role.description}
                  </p>
                </div>
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
