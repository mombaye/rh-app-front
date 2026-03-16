import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/useAdminAuth";
import { ShieldCheck } from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAdminAuth();

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate("/admin/dashboard", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      navigate("/admin/dashboard");
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.response?.data?.detail ||
        "Identifiants incorrects ou accès non autorisé.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-tr from-camublue-900/20 via-white to-camublue-900/10 overflow-hidden px-4 py-8">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute w-72 h-72 bg-camublue-900/10 rounded-full top-10 left-10 blur-3xl animate-pulse" />
        <div className="absolute w-72 h-72 bg-camublue-900/10 rounded-full bottom-10 right-10 blur-2xl animate-pulse delay-300" />
      </div>

      <Toaster position="top-right" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="shadow-xl rounded-2xl border-0">
          <CardContent className="p-5 sm:p-8 flex flex-col items-center">
            <img src={logo} alt="Camusat" className="h-16 mb-4 object-contain" />

            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={22} className="text-camublue-900" />
              <h1 className="text-2xl font-bold text-camublue-900">Espace Administration</h1>
            </div>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Accès réservé aux administrateurs de la plateforme.
            </p>

            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <Input
                type="text"
                placeholder="Nom d'utilisateur"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-gray-50 focus:ring-2 focus:ring-camublue-900 transition"
                autoFocus
              />
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-gray-50 focus:ring-2 focus:ring-camublue-900 transition"
              />
              {error && (
                <div className="text-red-600 text-sm font-medium">{error}</div>
              )}
              <Button
                type="submit"
                className="w-full bg-camublue-900 text-white rounded-xl px-6 py-3 hover:bg-camublue-900/90 transition"
                disabled={loading}
              >
                {loading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>

            <footer className="mt-8 text-gray-400 text-xs w-full text-center">
              © 2025 Camusat Sénégal — Administration
            </footer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
