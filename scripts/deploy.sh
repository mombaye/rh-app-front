#!/bin/bash
# Déploiement production du frontend (Sénégal) — usage : make prod  (ou bash scripts/deploy.sh)
# Construit dans dist_new/ puis remplace dist/ d'un coup : si le build échoue, le site actuel reste en ligne.
set -e
cd "$(dirname "$0")/.."
MODE="${1:-sn}"

echo "== 1/3 Récupération du code =="
git fetch origin main
if ! git merge-base --is-ancestor HEAD origin/main; then
    echo "   ARRÊT : la copie locale a divergé de origin/main. Rien n'a été modifié."
    echo "   Vérifier avec : git status && git log --oneline -3"
    exit 1
fi
# package-lock.json est régénéré par npm install : on repart de la version du dépôt
git checkout -- package-lock.json 2>/dev/null || true
# Se remet sur la branche main (fonctionne aussi depuis un "detached HEAD")
git checkout -B main origin/main
git log --oneline -1

echo "== 2/3 Build (mode $MODE) =="
command -v npm >/dev/null || { echo "   npm introuvable sur ce serveur."; exit 1; }
npm install --legacy-peer-deps --no-audit --no-fund
rm -rf dist_new
npx vite build --mode "$MODE" --outDir dist_new --emptyOutDir
git checkout -- package-lock.json 2>/dev/null || true

echo "== 3/3 Mise en ligne =="
rm -rf dist_old
[ -d dist ] && mv dist dist_old
mv dist_new dist
rm -rf dist_old
echo "   Titre : $(grep -o '<title>[^<]*</title>' dist/index.html)"
echo "Déploiement frontend terminé."
