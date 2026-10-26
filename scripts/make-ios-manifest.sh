#!/bin/bash
# Installation directe sur iPhone (sans TestFlight) pour une app signée Ad Hoc ou Entreprise.
# Usage : ./scripts/make-ios-manifest.sh https://erh.camusatsn.com 1.0.1
#   1. déposer le fichier signé dans ./downloads/erh-camusat.ipa
#   2. lancer ce script : il crée downloads/manifest.plist et downloads/ios-link.txt
#   3. ./downloads est monté dans le conteneur : aucun redéploiement n'est nécessaire
set -e
SITE="${1:?adresse du site, ex. https://erh.camusatsn.com}"
VERSION="${2:-1.0.0}"
BUNDLE_ID="${BUNDLE_ID:-com.camusat.erh.mobile}"
mkdir -p downloads
cat > downloads/manifest.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>items</key><array><dict>
  <key>assets</key><array><dict>
    <key>kind</key><string>software-package</string>
    <key>url</key><string>${SITE}/downloads/erh-camusat.ipa</string>
  </dict></array>
  <key>metadata</key><dict>
    <key>bundle-identifier</key><string>${BUNDLE_ID}</string>
    <key>bundle-version</key><string>${VERSION}</string>
    <key>kind</key><string>software</string>
    <key>title</key><string>eRH-Camusat</string>
  </dict>
</dict></array></dict></plist>
PLIST
echo "itms-services://?action=download-manifest&url=${SITE}/downloads/manifest.plist" > downloads/ios-link.txt
echo "OK : ${SITE}/telecharger/ affiche maintenant « Installer sur iPhone » (sans TestFlight)."
