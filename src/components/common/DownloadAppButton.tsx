// src/components/common/DownloadAppButton.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Smartphone, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface DownloadAppButtonProps {
  className?: string;
}

/** APK Android (fichier .env : VITE_ANDROID_APP_URL). Vide = « bientôt disponible ».
 *  Un chemin (/downloads/…) est complété avec l'adresse du site pour que le QR code marche sur le téléphone. */
const RAW_APP_URL = (import.meta.env.VITE_ANDROID_APP_URL as string | undefined)?.trim() ?? "";
const ANDROID_APP_URL = RAW_APP_URL.startsWith("/") ? `${window.location.origin}${RAW_APP_URL}` : RAW_APP_URL;

/**
 * Bouton "Télécharger l'app" : QR code à scanner avec un téléphone Android pour télécharger l'APK.
 * Affiché sur les tableaux de bord de chaque profil (RH, Manager, Employé, Admin).
 */
export default function DownloadAppButton({ className }: DownloadAppButtonProps) {
  const [showAppModal, setShowAppModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowAppModal(true)}
        className={
          className ??
          "flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 border border-camublue-900 px-3 py-2 rounded-xl text-xs font-medium text-white transition shadow-sm"
        }
      >
        <Smartphone className="h-3.5 w-3.5 text-white" />
        <span>Télécharger l'app</span>
      </button>

      <AnimatePresence>
        {showAppModal && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setShowAppModal(false)}
            />

            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed z-50 inset-0 flex items-center justify-center px-4 pointer-events-none"
            >
              <div role="dialog" aria-modal="true" aria-labelledby="app-modal-title"
                className="pointer-events-auto bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center relative">

                <button
                  onClick={() => setShowAppModal(false)}
                  aria-label="Fermer"
                  className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                <h2 id="app-modal-title" className="text-xl font-bold text-slate-800 mb-1 text-center">
                  Application mobile
                </h2>

                {ANDROID_APP_URL ? (
                  <>
                    <p className="text-sm text-slate-500 text-center leading-relaxed mb-5">
                      Scannez ce QR code avec votre téléphone <span className="font-semibold text-slate-700">Android</span> ou
                      <span className="font-semibold text-slate-700"> iPhone</span> pour télécharger l'application <span className="font-semibold text-slate-700">eRH Camusat</span>.
                    </p>

                    <div className="p-4 bg-white rounded-2xl border-2 border-camublue-900/15 shadow-sm">
                      <QRCodeSVG value={ANDROID_APP_URL} size={208} level="M" marginSize={1}
                        title="QR code de téléchargement de l'application Android" />
                    </div>

                    <ol className="mt-5 text-xs text-slate-500 space-y-1 self-stretch list-decimal list-inside">
                      <li>Ouvrez l'appareil photo ou un lecteur de QR code et scannez.</li>
                      <li>Android : téléchargez le fichier, puis ouvrez-le pour installer l'app.</li>
                      <li>Si Android bloque l'installation, autorisez les « applications inconnues » pour ce navigateur.</li>
                      <li>iPhone : ouvrez la page avec Safari, puis Partager › « Sur l'écran d'accueil » (gratuit, sans App Store).</li>
                    </ol>

                    <a href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer"
                      className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white font-semibold text-sm transition-colors">
                      <Download className="h-4 w-4" /> Télécharger
                    </a>
                    <p className="mt-3 text-[11px] text-slate-400 text-center">Android : téléchargement direct. iPhone : ajout à l'écran d'accueil, sans App Store.</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-camublue-900/8 flex items-center justify-center my-5">
                      <Smartphone className="h-10 w-10 text-camublue-900" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
                      L'application mobile <span className="font-semibold text-slate-700">eRH Camusat</span> sera
                      bientôt disponible sur iOS et Android.
                    </p>
                    <button
                      onClick={() => setShowAppModal(false)}
                      className="w-full py-3 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white font-semibold text-sm transition-colors cursor-pointer"
                    >
                      Fermer
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
