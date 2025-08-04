import api from "@/api/axios"


// Appel l'API login et retourne access/refresh tokens
export const login = async (username: string, password: string) => {
  const res = await api.post("/api/auth/login/", { username, password });
  return res.data;
};

// Récupère le profil utilisateur courant (besoin d'être connecté)
export const getProfile = async () => {
  const res = await api.get("/api/auth/profile/");
  return res.data;
};

// Exemple : register un nouvel utilisateur (selon besoin)
export const register = async (username: string, email: string, password: string) => {
  const res = await api.post("/api/auth/register/", { username, email, password });
  return res.data;
};

// ... Tu ajoutes d'autres services liés à l'utilisateur ici si besoin
export const changePassword = async (
  old_password: string,
  new_password: string,
  confirm_password: string
) => {
  const res = await api.post("/users/change-password/", {
    old_password,
    new_password,
    confirm_password,
  });
  return res.data;
};