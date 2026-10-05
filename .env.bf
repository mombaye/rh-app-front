# ── Burkina Faso ──────────────────────────────────────────────────────────────
# Build: npm run build -- --mode bf
VITE_COUNTRY_NAME=Burkina Faso
VITE_COUNTRY_FLAG=🇧🇫
VITE_COUNTRY_CODE=BF
VITE_APP_SUBTITLE=CAMUSAT Burkina Faso
VITE_APP_TITLE=eRH - Burkina Faso
VITE_API_URL=https://apierh.camusatbf.com

# ── Feature flags (à ajuster selon les besoins du Burkina) ───────────────────
# Mettre à "false" les fonctionnalités non utilisées au Burkina
VITE_FEATURE_MIGRATION=true
VITE_FEATURE_ANTICIPATION=true
VITE_FEATURE_INTERIM=true
VITE_FEATURE_SHIFTS=true
VITE_FEATURE_PLANNING=true
VITE_FEATURE_MISSIONS=true
VITE_FEATURE_ATTESTATIONS=true
VITE_FEATURE_INFIRMERIE=true
VITE_FEATURE_DISCIPLINAIRE=true
VITE_FEATURE_QUESTIONNAIRES=false
VITE_FEATURE_HSE=true

# Séparation Internes / Intérimaires (Gestion Employés, Gestion Congés, Hiérarchie) — comme au Sénégal
VITE_FEATURE_CONTRACT_SPLIT=true

# Gestion Pointages : pas de Pointage O&M ni de Team Planning au Burkina
VITE_FEATURE_OM_POINTAGE=false
VITE_FEATURE_TEAM_PLANNING=false
