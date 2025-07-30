import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logo from "@/assets/images/camusat-logo.png";
import welcome from "@/assets/illustrations/hr-welcome.svg";
import axios from "@/api/axios";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate(); 
  const {login} = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      navigate("/dashboard");
      console.log("login sucess")
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
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-tr from-camublue-900/20 via-white to-camublue-900/10 overflow-hidden">
      {/* Fond animé en bulles */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute w-72 h-72 bg-camublue-900/10 rounded-full top-10 left-10 blur-3xl animate-pulse"></div>
        <div className="absolute w-72 h-72 bg-camublue-900/10 rounded-full bottom-10 right-10 blur-2xl animate-pulse delay-300"></div>
      </div>

      {/* Toaster notifications */}
      <Toaster position="top-right" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="shadow-xl rounded-2xl border-0">
          <CardContent className="p-8 flex flex-col items-center">
            
            <img
              src={welcome}
              alt="Illustration RH"
              className="h-32 mb-4"
              draggable={false}
            />
            <h1 className="text-2xl font-bold text-camublue-900 mb-1">
              Bienvenue sur RH Camusat
            </h1>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Merci de vous connecter pour accéder à vos outils RH.
            </p>

            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <Input
                name="username"
                type="text"
                placeholder="Nom d'utilisateur ou Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-gray-50 focus:ring-2 focus:ring-camublue-900 transition"
                autoFocus
              />
              <Input
                name="password"
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

            <div className="mt-4 w-full flex justify-end text-sm">
              <a
                href="#"
                className="text-camublue-900 hover:underline transition"
              >
                Mot de passe oublié ?
              </a>
            </div>

            <footer className="mt-8 text-gray-400 text-xs w-full text-center">
              © 2025 Camusat Sénégal RH
            </footer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
