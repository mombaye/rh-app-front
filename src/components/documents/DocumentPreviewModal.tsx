// src/components/documents/DocumentPreviewModal.tsx
// Modale de prévisualisation de documents partagée (Employé / Manager / RH).
//
// Stratégie de rendu :
//   PDF   → <iframe> alimenté par une Blob URL authentifiée (robuste, pas de CORS)
//   Image → <img>   alimenté par une Blob URL authentifiée
//   Word / Excel / PPT → affichage "téléchargement requis" (les visionneuses en ligne
//                        nécessitent une URL publique — non applicable ici)
//   Autres → même affichage "téléchargement requis"

import { useEffect, useRef, useState } from "react";
import {
  X, Download, ExternalLink, FileText, FileImage,
  FileSpreadsheet, Presentation, Loader2, AlertTriangle,
  FileDown,
} from "lucide-react";
import { documentService, HRDocument } from "@/services/documentService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

type PreviewKind = "pdf" | "image" | "download-only";

function getPreviewKind(fileName: string): PreviewKind {
  const ext = getExt(fileName);
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  // Word / Excel / PPT ne peuvent pas être prévisualisés sans URL publique
  return "download-only";
}

export function FileTypeIcon({
  fileName,
  size = 20,
  className = "text-camublue-900",
}: {
  fileName: string;
  size?: number;
  className?: string;
}) {
  const ext = getExt(fileName);
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return <FileImage size={size} className={className} />;
  if (["xls", "xlsx", "csv"].includes(ext))
    return <FileSpreadsheet size={size} className="text-green-700" />;
  if (["ppt", "pptx"].includes(ext))
    return <Presentation size={size} className="text-orange-600" />;
  if (["doc", "docx"].includes(ext))
    return <FileText size={size} className="text-blue-600" />;
  return <FileText size={size} className={className} />;
}

export function getDocKind(doc: HRDocument): PreviewKind {
  return getPreviewKind(doc.file_name || "");
}

// ─── Modale principale ────────────────────────────────────────────────────────

interface Props {
  doc: HRDocument;
  onClose: () => void;
  /** Couleur accent (classe Tailwind, ex: "camublue-900" ou "[#003c71]") */
  accentClass?: string;
}

export default function DocumentPreviewModal({
  doc,
  onClose,
  accentClass = "camublue-900",
}: Props) {
  const kind = getPreviewKind(doc.file_name || "");

  const [blobUrl,   setBlobUrl]   = useState<string | null>(null);
  const [loading,   setLoading]   = useState(kind === "pdf" || kind === "image");
  const [error,     setError]     = useState<string | null>(null);

  // Garder une référence à l'URL objet pour la révoquer au démontage
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Charger le blob uniquement pour les formats prévisualisables
    if (kind !== "pdf" && kind !== "image") return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    documentService.fetchBlobUrl(doc.id)
      .then(({ objectUrl }) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        blobUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger le fichier.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      // Révoquer l'URL objet pour libérer la mémoire
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [doc.id, kind]);

  // Fermeture sur Échap
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const btnClass = `bg-${accentClass} hover:bg-${accentClass}/80`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85"
      onClick={onClose}
    >
      {/* ── Barre supérieure ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0 gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileTypeIcon fileName={doc.file_name} size={18} className="text-gray-300 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">{doc.title}</p>
            <p className="text-[11px] text-gray-400 truncate">{doc.file_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {doc.file_url && (
            <>
              <a
                href={doc.file_url}
                download
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${btnClass} text-white text-xs font-medium transition`}
              >
                <Download size={13} />
                Télécharger
              </a>
              <a
                href={doc.file_url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition"
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink size={16} />
              </a>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition"
            title="Fermer (Échap)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Zone de contenu ──────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Chargement ── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 size={40} className="animate-spin opacity-60" />
            <p className="text-sm text-gray-300">Chargement du document…</p>
          </div>
        )}

        {/* ── Erreur de chargement ── */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-4 text-white text-center px-6">
            <AlertTriangle size={48} className="text-amber-400 opacity-80" />
            <p className="text-base font-medium">{error}</p>
            {doc.file_url && (
              <a
                href={doc.file_url}
                download
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl ${btnClass} text-white font-medium transition`}
              >
                <Download size={16} />
                Télécharger le fichier
              </a>
            )}
          </div>
        )}

        {/* ── PDF ── */}
        {!loading && !error && kind === "pdf" && blobUrl && (
          <iframe
            src={blobUrl}
            className="w-full h-full rounded-lg bg-white"
            title={doc.title}
          />
        )}

        {/* ── Image ── */}
        {!loading && !error && kind === "image" && blobUrl && (
          <img
            src={blobUrl}
            alt={doc.title}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        )}

        {/* ── Word / Excel / PPT / autres (téléchargement requis) ── */}
        {kind === "download-only" && (
          <DownloadOnlyView doc={doc} btnClass={btnClass} />
        )}
      </div>
    </div>
  );
}

// ─── Vue "téléchargement requis" ─────────────────────────────────────────────

function DownloadOnlyView({ doc, btnClass }: { doc: HRDocument; btnClass: string }) {
  const ext = getExt(doc.file_name || "");

  const extLabel: Record<string, string> = {
    doc:  "Document Word",
    docx: "Document Word",
    xls:  "Classeur Excel",
    xlsx: "Classeur Excel",
    ppt:  "Présentation PowerPoint",
    pptx: "Présentation PowerPoint",
  };
  const typeLabel = extLabel[ext] ?? "Document";

  return (
    <div className="flex flex-col items-center gap-5 text-white text-center px-6 max-w-sm">
      <div className="p-5 rounded-2xl bg-white/10">
        <FileDown size={52} className="opacity-70" />
      </div>
      <div>
        <p className="text-lg font-semibold">{typeLabel}</p>
        <p className="text-sm text-gray-300 mt-1 leading-relaxed">
          Ce format ne peut pas être affiché directement dans le navigateur.
          <br />Téléchargez le fichier pour l'ouvrir avec l'application adaptée.
        </p>
      </div>
      {doc.file_url && (
        <a
          href={doc.file_url}
          download
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-2 px-6 py-3 rounded-xl ${btnClass} text-white font-semibold transition text-sm`}
        >
          <Download size={17} />
          Télécharger {doc.file_name}
        </a>
      )}
    </div>
  );
}
