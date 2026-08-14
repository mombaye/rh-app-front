// URL de base de l'API.
// Vide ("") = URLs relatives → nginx (prod) ou Vite proxy (dev) gèrent /api/.
// Non-vide = préfixe absolu, ex. http://192.168.1.50:8030 en dev direct.
// Utilise ?? et non || pour que "" reste "" (falsy ne tombe pas sur le fallback).
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "";
