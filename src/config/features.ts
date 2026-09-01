// src/config/features.ts
// Lire depuis les variables d'environnement Vite (définies par pays dans .env.XX)
// Build: vite build --mode sn | --mode bf | --mode ci | --mode ga

const flag = (key: string, defaultOn = true): boolean => {
  const val = import.meta.env[key];
  if (val === undefined) return defaultOn;
  return val === "true";
};

export const COUNTRY = {
  name:     import.meta.env.VITE_COUNTRY_NAME  ?? "Sénégal",
  flag:     import.meta.env.VITE_COUNTRY_FLAG  ?? "🇸🇳",
  code:     import.meta.env.VITE_COUNTRY_CODE  ?? "SN",
  subtitle: import.meta.env.VITE_APP_SUBTITLE  ?? "CAMUSAT Sénégal",
  title:    import.meta.env.VITE_APP_TITLE     ?? "eRH - Sénégal",
};

export const FEATURES = {
  // ── Congés ─────────────────────────────────────────────────────────────────
  migration:      flag("VITE_FEATURE_MIGRATION"),
  anticipation:   flag("VITE_FEATURE_ANTICIPATION"),
  interim:        flag("VITE_FEATURE_INTERIM"),

  // ── Pointage ───────────────────────────────────────────────────────────────
  shifts:         flag("VITE_FEATURE_SHIFTS"),
  planning:       flag("VITE_FEATURE_PLANNING"),

  // ── RH ─────────────────────────────────────────────────────────────────────
  missions:       flag("VITE_FEATURE_MISSIONS"),
  attestations:   flag("VITE_FEATURE_ATTESTATIONS"),
  infirmerie:     flag("VITE_FEATURE_INFIRMERIE"),
  disciplinaire:  flag("VITE_FEATURE_DISCIPLINAIRE"),
  questionnaires: flag("VITE_FEATURE_QUESTIONNAIRES"),

  // ── Modules spéciaux ───────────────────────────────────────────────────────
  hse:            flag("VITE_FEATURE_HSE"),
};
