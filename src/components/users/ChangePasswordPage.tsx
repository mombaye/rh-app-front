import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { changePassword } from "@/services/userService";  // <--- Ici le service !

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword, confirm);
      toast.success("Mot de passe changé avec succès !");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ||
          "Erreur lors du changement de mot de passe."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-camublue-900/10 via-white to-camublue-900/10">
      <Card className="shadow-lg rounded-2xl border-0 w-full max-w-md">
        <CardContent className="p-8 flex flex-col items-center">
          <h2 className="text-xl font-bold text-camublue-900 mb-2">
            Première connexion : changez votre mot de passe
          </h2>
          <p className="mb-6 text-sm text-gray-500 text-center">
            Pour sécuriser votre compte RH, merci de définir un nouveau mot de passe.
          </p>
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <Input
              type="password"
              placeholder="Mot de passe actuel"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Confirmez le nouveau mot de passe"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <Button
              type="submit"
              className="w-full bg-camublue-900 text-white rounded-xl px-6 py-3"
              disabled={loading}
            >
              {loading ? "Changement..." : "Changer mon mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
