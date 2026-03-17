// src/pages/WelcomePage.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import toast, { Toaster } from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";
import {
  UserRound, Users, ShieldCheck, ArrowLeft, Eye, EyeOff,
} from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import welcomeIllustration from "@/assets/illustrations/hr-welcome.svg";

// ─── Rôles ────────────────────────────────────────────────────────────────────
const ROLES = [
  {
    id: "employe",
    label: "Employé",
    subtitle: "Accédez à vos bulletins\net congés",
    icon: UserRound,
    gradient: "from-sky-500 to-blue-600",
    glow: "shadow-blue-500/30",
    ring: "ring-sky-400",
  },
  {
    id: "manager",
    label: "Manager",
    subtitle: "Gérez votre équipe\net le planning",
    icon: Users,
    gradient: "from-violet-500 to-indigo-600",
    glow: "shadow-violet-500/30",
    ring: "ring-violet-400",
  },
  {
    id: "rh",
    label: "RH",
    subtitle: "Administration des\nressources humaines",
    icon: ShieldCheck,
    gradient: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/30",
    ring: "ring-emerald-400",
  },
] as const;

type RoleId = (typeof ROLES)[number]["id"];

// ─── Composant principal ──────────────────────────────────────────────────────
export default function WelcomePage() {
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [showPwd, setShowPwd]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const role = ROLES.find((r) => r.id === selectedRole);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || "Identifiants incorrects ou erreur réseau.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#00122b] flex flex-col items-center justify-center px-4 py-10">
      <Toaster position="top-right" />

      {/* ── Arrière-plan animé ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Grande orbe bleue en haut à gauche */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-camublue-900/40 blur-[100px] animate-pulse" />
        {/* Orbe dorée/violette en bas à droite */}
        <div className="absolute -bottom-40 -right-24 w-[420px] h-[420px] rounded-full bg-indigo-700/30 blur-[90px] animate-pulse delay-700" />
        {/* Petite orbe accent en haut à droite */}
        <div className="absolute top-20 right-20 w-[200px] h-[200px] rounded-full bg-sky-500/15 blur-[60px] animate-pulse delay-1000" />
        {/* Grille subtile */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* ── Logo + titre ──────────────────────────────────────────────────── */}
      <motion.div
        className="relative z-10 mb-10 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2.5">
            <img src={logo} alt="Camusat" className="h-8 w-auto" draggable={false} />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Plateforme&nbsp;
          <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            RH Camusat
          </span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-white/50 max-w-xs mx-auto leading-relaxed">
          Simple, puissant, conçu pour la gestion humaine moderne.
        </p>
      </motion.div>

      {/* ── Zone centrale : sélection rôle OU formulaire connexion ─────────── */}
      <div className="relative z-10 w-full max-w-3xl">
        <AnimatePresence mode="wait">

          {/* ╔══ Phase 1 : Sélection du profil ══╗ */}
          {!selectedRole && (
            <motion.div
              key="roles"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-center text-white/60 text-sm mb-6 tracking-wide uppercase font-semibold">
                Sélectionnez votre profil
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {ROLES.map((r, i) => {
                  const Icon = r.icon;
                  return (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                      whileHover={{ scale: 1.04, y: -4 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedRole(r.id)}
                      className={`
                        relative group flex flex-col items-center gap-4 p-7 rounded-2xl
                        bg-white/5 border border-white/10 backdrop-blur-md
                        hover:bg-white/10 hover:border-white/25
                        shadow-2xl ${r.glow}
                        transition-all duration-300 cursor-pointer text-left
                      `}
                    >
                      {/* Halo gradient en fond */}
                      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${r.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />

                      {/* Icône */}
                      <div className={`relative p-4 rounded-xl bg-gradient-to-br ${r.gradient} shadow-lg`}>
                        <Icon className="h-7 w-7 text-white" strokeWidth={1.8} />
                      </div>

                      {/* Texte */}
                      <div className="relative text-center">
                        <p className="text-white font-bold text-lg leading-tight">{r.label}</p>
                        <p className="text-white/50 text-xs mt-1.5 leading-snug whitespace-pre-line">
                          {r.subtitle}
                        </p>
                      </div>

                      {/* Chevron animé */}
                      <div className="relative mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <span className="text-white/60 text-xs">Accéder →</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ╔══ Phase 2 : Formulaire de connexion ══╗ */}
          {selectedRole && role && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md mx-auto"
            >
              {/* Card de connexion */}
              <div className="relative bg-white/6 backdrop-blur-xl border border-white/15 rounded-3xl p-8 shadow-2xl">

                {/* Halo gradient en fond de card */}
                <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${role.gradient} opacity-5`} />

                {/* Bouton retour */}
                <button
                  onClick={() => { setSelectedRole(null); setError(""); setUsername(""); setPassword(""); }}
                  className="relative flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-6 transition group"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                  Changer de profil
                </button>

                {/* En-tête : badge rôle + illustration */}
                <div className="relative flex items-center gap-4 mb-6">
                  <div className={`p-3.5 rounded-xl bg-gradient-to-br ${role.gradient} shadow-lg shrink-0`}>
                    <role.icon className="h-6 w-6 text-white" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">Espace</p>
                    <h2 className="text-white font-extrabold text-xl leading-tight">{role.label}</h2>
                  </div>
                  <img
                    src={welcomeIllustration}
                    alt=""
                    className="ml-auto h-16 opacity-70"
                    draggable={false}
                  />
                </div>

                {/* Ligne séparatrice */}
                <div className="relative h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-6" />

                {/* Formulaire */}
                <form onSubmit={handleLogin} className="relative space-y-4">
                  {/* Username */}
                  <div>
                    <label className="block text-white/60 text-xs font-semibold mb-1.5 tracking-wide">
                      Identifiant
                    </label>
                    <input
                      type="text"
                      placeholder="Nom d'utilisateur ou email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoFocus
                      className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-white/40 focus:bg-white/12 transition"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-white/60 text-xs font-semibold mb-1.5 tracking-wide">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPwd ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 pr-11 text-white placeholder-white/30 text-sm outline-none focus:border-white/40 focus:bg-white/12 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Erreur */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bouton connexion */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`
                      w-full py-3 rounded-xl font-bold text-white text-sm
                      bg-gradient-to-r ${role.gradient}
                      hover:opacity-90 active:scale-[.98]
                      transition-all duration-200 shadow-lg
                      disabled:opacity-60 disabled:cursor-not-allowed
                      flex items-center justify-center gap-2
                    `}
                  >
                    {loading ? (
                      <><ImSpinner2 className="animate-spin" size={15} /> Connexion…</>
                    ) : (
                      "Se connecter"
                    )}
                  </button>

                  {/* Mot de passe oublié */}
                  <div className="text-right">
                    <a href="#" className="text-white/40 hover:text-white/70 text-xs transition">
                      Mot de passe oublié ?
                    </a>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <motion.footer
        className="relative z-10 mt-12 text-white/25 text-xs text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        © {new Date().getFullYear()} Camusat Sénégal — Plateforme RH interne
      </motion.footer>
    </div>
  );
}
