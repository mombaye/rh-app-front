import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/admin/contexts/AdminAuthContext";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err?.message || "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-camublue-900 via-camublue-900/90 to-camublue-900/70 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-camublue-900 px-8 py-8 flex flex-col items-center gap-3">
            <img src={logo} alt="Camusat" className="h-12 object-contain brightness-0 invert" />
            <div className="flex items-center gap-2 bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              <ShieldCheck size={14} />
              Plateforme Administrateur
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h1 className="text-xl font-bold text-gray-800 mb-1">Connexion</h1>
            <p className="text-sm text-gray-500 mb-6">Accès réservé aux administrateurs.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  placeholder="ex: adiallo_admin"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-gray-50 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-camublue-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-camublue-900/90 transition disabled:opacity-60"
              >
                {loading ? "Connexion en cours..." : "Se connecter"}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          © {new Date().getFullYear()} Camusat — Accès restreint
        </p>
      </div>
    </div>
  );
}
