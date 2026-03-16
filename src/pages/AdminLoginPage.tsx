import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import toast from "react-hot-toast";

export default function AdminLoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Si déjà connecté en tant qu'admin, rediriger
  useEffect(() => {
    if (!authLoading && user?.is_global_admin) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate("/admin/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-camublue-900/20 via-white to-camublue-900/10 px-4 py-8 overflow-hidden relative">
      {/* blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute w-80 h-80 bg-camublue-900/10 rounded-full -top-20 -left-20 blur-3xl animate-pulse" />
        <div className="absolute w-80 h-80 bg-camublue-900/8  rounded-full -bottom-20 -right-20 blur-3xl animate-pulse delay-500" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-10 flex flex-col items-center gap-6">

          {/* icon */}
          <div className="w-16 h-16 rounded-2xl bg-camublue-900 flex items-center justify-center shadow-md">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-camublue-900">Administration</h1>
            <p className="text-sm text-slate-400 mt-1">Plateforme de gestion des comptes</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Identifiant</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                placeholder="Nom d'utilisateur"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 focus:border-camublue-900/50 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 focus:border-camublue-900/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-camublue-900 hover:bg-camublue-800 text-white font-semibold rounded-xl py-2.5 text-sm transition disabled:opacity-50 mt-1"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="text-xs text-slate-300">© 2025 Camusat Sénégal · Accès restreint</p>
        </div>
      </motion.div>
    </div>
  );
}
