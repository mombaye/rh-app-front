#!/bin/bash
# Annonce une nouvelle version de l'APK aux applications installées : elles affichent « Mettre à jour ».
# Usage : ./scripts/set-app-version.sh <versionCode> <version> [adresse-apk]
#   ex. : ./scripts/set-app-version.sh 3 1.0.2
# Le versionCode est celui de app.json (android.versionCode) de l'APK que vous venez de déposer dans ./downloads/.
# ./downloads est monté dans le conteneur : aucun redéploiement n'est nécessaire.
set -e
CODE="${1:?versionCode (ex. 3)}"
VERSION="${2:?version (ex. 1.0.2)}"
URL="${3:-/downloads/erh-camusat.apk}"
mkdir -p downloads
printf '{"versionCode": %s, "version": "%s", "url": "%s"}\n' "$CODE" "$VERSION" "$URL" > downloads/app-version.json
echo "OK : downloads/app-version.json -> versionCode $CODE ($VERSION)"
