// src/pages/LoginPage.tsx
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import welcome from "@/assets/illustrations/hr-welcome.svg";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import { ArrowLeft, UserRound, Users, ShieldCheck } from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";

const ROLE_META: Record<string, { label: string; Icon: React.ElementType }> = {
  employe: { label: "Employé",  Icon: UserRound   },
  manager: { label: "Manager",  Icon: Users       },
  rh:      { label: "RH",       Icon: ShieldCheck },
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const { login }     = useAuth();

  const roleId   = params.get("role") ?? "";
  const roleMeta = ROLE_META[roleId];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        "Identifiants incorrects ou erreur réseau.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
        <img src={logo} alt="Camusat" className="h-8 w-auto" draggable={false} />
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-camublue-900 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Retour à l'accueil
        </Link>
      </header>

      {/* ── Formulaire centré ───────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Toaster position="top-right" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-sm"
        >
          <Card className="shadow-md rounded-2xl border border-slate-200">
            <CardContent className="p-7 sm:p-8 flex flex-col items-center">

              {/* Illustration */}
              <img
                src={welcome}
                alt="Illustration RH"
                className="h-28 mb-5"
                draggable={false}
              />

              {/* Badge rôle (si présent) */}
              {roleMeta && (
                <div className="flex items-center gap-2 mb-3 bg-camublue-900/8 border border-camublue-900/15 rounded-full px-3.5 py-1.5">
                  <roleMeta.Icon className="h-3.5 w-3.5 text-camublue-900" strokeWidth={2} />
                  <span className="text-xs font-semibold text-camublue-900">
                    Espace {roleMeta.label}
                  </span>
                </div>
              )}

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
      </div>

    </div>
  );
}
