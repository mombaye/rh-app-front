// Page publique — affiche le passeport PDF via QR code (sans authentification)
// Accessible depuis n'importe quel réseau (WiFi local ou internet)
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ImSpinner2 } from "react-icons/im";

export default function PassportViewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError]   = useState(false);
  const [loaded, setLoaded] = useState(false);

  // passeport_pdf_scan : endpoint public (sans auth), génère le PDF si absent
  // URL relative → proxiée par Vite en dev, par nginx en prod
  const pdfUrl = `/api/employees/passeports/${slug}/pdf/scan/`;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <img
          src="/logo_camusat.png"
          alt="CAMUSAT"
          className="h-12 mb-6 opacity-80"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <p className="text-gray-500 text-sm text-center">
          Passeport introuvable ou non disponible.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Bandeau CAMUSAT */}
      <div className="bg-[#003c71] text-white text-center py-3 px-4 flex items-center justify-center gap-3 flex-shrink-0">
        <img
          src="/logo_camusat.png"
          alt="CAMUSAT"
          className="h-7 brightness-0 invert"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <span className="text-sm font-semibold tracking-widest uppercase">
          Passeport Sécurité — CAMUSAT Sénégal
        </span>
      </div>

      {/* PDF plein écran */}
      <div className="flex-1 relative">
        <iframe
          src={pdfUrl}
          className="w-full border-0 absolute inset-0"
          style={{ height: "100%" }}
          title="Passeport Sécurité"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 pointer-events-none">
            <ImSpinner2 className="animate-spin text-[#003c71]" size={32} />
            <p className="ml-3 text-sm text-gray-500">Chargement du passeport…</p>
          </div>
        )}
      </div>
    </div>
  );
}
