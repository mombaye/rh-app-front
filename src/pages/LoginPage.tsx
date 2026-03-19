// src/pages/LoginPage.tsx
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import welcome from "@/assets/illustrations/hr-welcome.svg";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, type UserRole, dashboardForRole } from "@/contexts/useAuth";
import { ArrowLeft, UserRound, Users, ShieldCheck, LayoutDashboard, Calendar } from "lucide-react";

const ROLE_META: Record<UserRole, { label: string; description: string; Icon: React.ElementType; color: string }> = {
  employe:  { label: "Employé",        description: "Accédez à vos congés, bulletins et dossier",       Icon: UserRound,      color: "text-blue-600 bg-blue-50 border-blue-200" },
  manager1: { label: "Manager N1",     description: "Gérez votre équipe et validez les demandes",        Icon: Users,          color: "text-purple-600 bg-purple-50 border-purple-200" },
  manager2: { label: "Manager N2",     description: "Supervision et validation de second niveau",        Icon: Users,          color: "text-violet-600 bg-violet-50 border-violet-200" },
  rh:       { label: "Espace RH",      description: "Administrez les employés, congés et pointages",     Icon: ShieldCheck,    color: "text-camublue-900 bg-camublue-900/8 border-camublue-900/20" },
  planning: { label: "Planning",       description: "Gestion des plannings et shifts",                   Icon: Calendar,       color: "text-green-600 bg-green-50 border-green-200" },
};

type Step = "login" | "select-role";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [step,     setStep]     = useState<Step>("login");
  const [pendingRoles, setPendingRoles] = useState<UserRole[]>([]);

  const navigate = useNavigate();
  const { login, switchRole } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const profile = await login(username, password);
      const roles: UserRole[] = (profile as any).roles ?? [];

      if (roles.length === 0) {
        navigate("/employee/dashboard");
        return;
      }

      // Si l'utilisateur est manager (N1 ou N2), le rôle "employe" est absorbé
      // → on retire "employe" de la liste s'il a déjà un rôle manager
      const hasManager = roles.some(r => r === "manager1" || r === "manager2");
      const effectiveRoles = hasManager ? roles.filter(r => r !== "employe") : roles;

      if (effectiveRoles.length === 1) {
        switchRole(effectiveRoles[0]);
        navigate(dashboardForRole(effectiveRoles[0]));
        return;
      }

      // Multiple rôles distincts → afficher la sélection
      setPendingRoles(effectiveRoles);
      setStep("select-role");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Identifiants incorrects ou erreur réseau.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = (role: UserRole) => {
    switchRole(role);
    navigate(dashboardForRole(role));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-12">
      <Toaster position="top-right" />

      <AnimatePresence mode="wait">
        {step === "login" ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-sm"
          >
            <Card className="shadow-md rounded-2xl border border-slate-200">
              <CardContent className="p-7 sm:p-8 flex flex-col items-center relative">

                {/* Bouton retour */}
                <Link
                  to="/"
                  className="absolute top-5 left-5 p-1.5 rounded-lg text-slate-400 hover:text-camublue-900 hover:bg-slate-100 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>

                {/* Illustration */}
                <img
                  src={welcome}
                  alt="Illustration RH"
                  className="h-28 mb-5"
                  draggable={false}
                />

                <h1 className="text-xl font-bold text-slate-800 mb-1 text-center">
                  Connexion
                </h1>
                <p className="text-sm text-slate-400 mb-6 text-center">
                  Entrez vos identifiants pour accéder à votre espace.
                </p>

                {/* Formulaire */}
                <form onSubmit={handleSubmit} className="w-full space-y-4">
                  <Input
                    name="username"
                    type="text"
                    placeholder="Nom d'utilisateur ou Email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    className="bg-slate-50 border-slate-200 focus:ring-2 focus:ring-camublue-900/30 transition"
                  />
                  <Input
                    name="password"
                    type="password"
                    placeholder="Mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-slate-50 border-slate-200 focus:ring-2 focus:ring-camublue-900/30 transition"
                  />

                  {error && (
                    <div className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-camublue-900 text-white rounded-xl py-3 hover:bg-camublue-900/90 transition font-semibold"
                    disabled={loading}
                  >
                    {loading ? "Connexion…" : "Se connecter"}
                  </Button>
                </form>

                <div className="mt-4 w-full flex justify-end">
                  <a href="#" className="text-xs text-slate-400 hover:text-camublue-900 transition">
                    Mot de passe oublié ?
                  </a>
                </div>

                <footer className="mt-8 text-slate-300 text-xs text-center">
                  © {new Date().getFullYear()} Camusat Sénégal RH
                </footer>

              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="select-role"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-sm"
          >
            <Card className="shadow-md rounded-2xl border border-slate-200">
              <CardContent className="p-7 sm:p-8 flex flex-col items-center">

                <div className="w-12 h-12 rounded-full bg-camublue-900/10 flex items-center justify-center mb-4">
                  <LayoutDashboard className="h-6 w-6 text-camublue-900" />
                </div>

                <h1 className="text-xl font-bold text-slate-800 mb-1 text-center">
                  Choisissez votre espace
                </h1>
                <p className="text-sm text-slate-400 mb-6 text-center">
                  Votre compte a accès à plusieurs espaces. Lequel souhaitez-vous ouvrir ?
                </p>

                <div className="w-full space-y-3">
                  {pendingRoles.map((role) => {
                    const meta = ROLE_META[role];
                    if (!meta) return null;
                    return (
                      <button
                        key={role}
                        onClick={() => handleSelectRole(role)}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition hover:scale-[1.01] active:scale-[0.99] ${meta.color}`}
                      >
                        <div className="flex-shrink-0">
                          <meta.Icon className="h-5 w-5" strokeWidth={2} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{meta.label}</div>
                          <div className="text-xs opacity-70 leading-tight mt-0.5">{meta.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <footer className="mt-8 text-slate-300 text-xs text-center">
                  © {new Date().getFullYear()} Camusat Sénégal RH
                </footer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
