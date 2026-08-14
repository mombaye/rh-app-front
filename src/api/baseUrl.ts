// ════════════════════════════════════════════════════════════════
//  URL de base du backend — modifier UNIQUEMENT ici
// ════════════════════════════════════════════════════════════════
// Vide = URLs relatives → nginx proxifie /api/ vers le backend en interne.
// Le navigateur ne voit que du HTTPS, les erreurs Mixed Content disparaissent.
// Pour changer l'adresse du backend, modifier nginx.conf (proxy_pass).
export const BASE_URL = "";
