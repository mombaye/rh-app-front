import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logo from "@/assets/images/logo-camusat.png";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/admin/contexts/AdminAuthContext";
import { ShieldCheck, Lock, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      navigate("/admin/dashboard");
    } catch (err: any) {
      const msg = err?.message || "Identifiants incorrects ou accès refusé.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-camublue-900 overflow-hidden px-4 py-8">
      <Toaster position="top-right" />

      {/* Motif géométrique en arrière-plan */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute w-[500px] h-[500px] border border-white/5 rounded-full top-[-100px] left-[-150px]" />
        <div className="absolute w-[400px] h-[400px] border border-white/5 rounded-full top-[-50px] left-[-100px]" />
        <div className="absolute w-[600px] h-[600px] border border-white/5 rounded-full bottom-[-200px] right-[-200px]" />
        <div className="absolute w-[400px] h-[400px] border border-white/5 rounded-full bottom-[-150px] right-[-100px]" />
        <div className="absolute w-96 h-96 bg-white/5 rounded-full top-[-80px] right-[-80px] blur-3xl" />
        <div className="absolute w-72 h-72 bg-white/5 rounded-full bottom-[-40px] left-[-40px] blur-2xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Camusat" className="h-10 object-contain brightness-0 invert opacity-90" />
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header de la card */}
          <div className="px-8 pt-8 pb-6 flex flex-col items-center border-b border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mb-4 shadow-inner">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Portail Administrateur</h1>
            <p className="text-sm text-white/60 mt-1 text-center">
              Accès restreint au personnel autorisé
            </p>
          </div>

          {/* Formulaire */}
          <div className="px-8 py-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Nom d'utilisateur
              </label>
              <Input
                name="username"
                type="text"
                placeholder="ex : adiallo_admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-white/30 focus:border-white/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Input
                  name="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-white/30 focus:border-white/40 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-400/30 text-red-300 text-sm rounded-lg">
                <Lock size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-white text-camublue-900 font-semibold rounded-xl py-3 hover:bg-white/90 transition mt-2 disabled:opacity-60"
            >
              {loading ? "Vérification..." : "Accéder au panneau d'administration"}
            </Button>
          </div>

          <div className="px-8 pb-6 text-center">
            <p className="text-white/30 text-xs">
              © {new Date().getFullYear()} Camusat — Accès restreint
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
