// pages/employee/EmployeeDocumentsPage.tsx
import { useEffect, useState } from "react";
import {
  FolderOpen, FileText, Download, Search, RefreshCw,
  Eye, X, ExternalLink, FileImage, FileSpreadsheet, Presentation,
} from "lucide-react";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { documentService, HRDocument, CATEGORY_LABELS } from "@/services/documentService";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";

const CATEGORY_COLORS: Record<string, string> = {
  REGLEMENT:    "bg-blue-100 text-blue-700",
  NOTE_SERVICE: "bg-purple-100 text-purple-700",
  PROCEDURE:    "bg-amber-100 text-amber-700",
  FORMULAIRE:   "bg-green-100 text-green-700",
  AUTRE:        "bg-gray-100 text-gray-600",
};

const CATEGORIES = [
  { value: "REGLEMENT",    label: "Règlement intérieur" },
  { value: "NOTE_SERVICE", label: "Note de service" },
  { value: "PROCEDURE",    label: "Procédure / Politique" },
  { value: "FORMULAIRE",   label: "Formulaire" },
  { value: "AUTRE",        label: "Autre" },
];

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Corrige les URLs qui pointent vers localhost en remplaçant le host
 * par celui configuré dans VITE_API_URL.
 * Cela se produit quand Django est derrière un proxy sans BACKEND_URL configuré.
 */
function fixUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string) || "";
    if (url.includes("://localhost") && apiBase && !apiBase.includes("localhost")) {
      const u = new URL(url);
      const api = new URL(apiBase);
      u.protocol = api.protocol;
      u.host = api.host;
      return u.toString();
    }
  } catch {
    // URL invalide → on retourne telle quelle
  }
  return url;
}

function getExt(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

type PreviewKind = "pdf" | "image" | "office" | "none";

function getPreviewKind(fileName: string): PreviewKind {
  const ext = getExt(fileName);
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  return "none";
}

function FileIcon({ fileName, size = 20, className = "text-camublue-900" }: { fileName: string; size?: number; className?: string }) {
  const ext = getExt(fileName);
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return <FileImage size={size} className={className} />;
  if (["xls", "xlsx", "csv"].includes(ext))
    return <FileSpreadsheet size={size} className="text-green-700" />;
  if (["ppt", "pptx"].includes(ext))
    return <Presentation size={size} className="text-orange-600" />;
  return <FileText size={size} className={className} />;
}

// ── Modale de prévisualisation ────────────────────────────────────────────────
function PreviewModal({ doc, onClose }: { doc: HRDocument; onClose: () => void }) {
  const url = fixUrl(doc.file_url);
  const kind = getPreviewKind(doc.file_name || url || "");

  // URL Microsoft Office Viewer (Word, Excel, PPT)
  const officeViewerUrl = url
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={onClose}>
      {/* Barre supérieure */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon fileName={doc.file_name} size={18} className="text-gray-300" />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{doc.title}</p>
            <p className="text-xs text-gray-400 truncate">{doc.file_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {url && (
            <a
              href={url}
              download
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-camublue-900 text-white text-xs font-medium hover:bg-camublue-900/80 transition"
            >
              <Download size={13} />
              Télécharger
            </a>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition"
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink size={16} />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition"
            title="Fermer (Echap)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Zone de prévisualisation */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* PDF → <object> natif du navigateur */}
        {kind === "pdf" && url && (
          <object
            data={url}
            type="application/pdf"
            className="w-full h-full rounded-lg bg-white"
            aria-label={doc.title}
          >
            {/* Fallback si le navigateur ne supporte pas l'objet PDF */}
            <div className="flex flex-col items-center gap-4 text-white text-center py-12">
              <FileText size={48} className="opacity-40" />
              <p className="text-base font-medium">Le PDF ne peut pas être affiché ici.</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-camublue-900 text-white font-medium hover:bg-camublue-900/90 transition"
              >
                <ExternalLink size={15} />
                Ouvrir le PDF
              </a>
            </div>
          </object>
        )}

        {/* Image */}
        {kind === "image" && url && (
          <img
            src={url}
            alt={doc.title}
            className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
          />
        )}

        {/* Office (Word / Excel / PowerPoint) → Microsoft Viewer */}
        {kind === "office" && officeViewerUrl && (
          <iframe
            src={officeViewerUrl}
            className="w-full h-full rounded-lg bg-white"
            title={doc.title}
            allow="fullscreen"
          />
        )}

        {/* Autres formats non prévisualisables */}
        {kind === "none" && (
          <div className="flex flex-col items-center gap-4 text-white text-center">
            <FileText size={56} className="opacity-40" />
            <p className="text-lg font-medium">Aperçu non disponible</p>
            <p className="text-sm text-gray-400 max-w-xs">
              Ce format ne peut pas être prévisualisé directement.
              <br />Téléchargez le fichier pour l'ouvrir.
            </p>
            {url && (
              <a
                href={url}
                download
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-camublue-900 text-white font-medium hover:bg-camublue-900/90 transition"
              >
                <Download size={16} />
                Télécharger
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EmployeeDocumentsPage() {
  const [docs, setDocs] = useState<HRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [preview, setPreview] = useState<HRDocument | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await documentService.getAll();
      setDocs(data);
    } catch {
      toast.error("Erreur lors du chargement des documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = docs.filter((d) => {
    const matchSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "ALL" || d.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-camublue-900/10">
            <FolderOpen size={24} className="text-camublue-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-camublue-900">Documents de l'entreprise</h1>
            <p className="text-sm text-gray-500">
              Consultez et téléchargez les documents mis à disposition par les RH
            </p>
          </div>
          <button
            onClick={load}
            className="ml-auto p-2 rounded-lg border bg-white hover:bg-gray-50 transition"
            title="Rafraîchir"
          >
            <RefreshCw size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un document..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-camublue-900/20 focus:border-camublue-900 outline-none"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900/20 outline-none"
          >
            <option value="ALL">Toutes les catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Documents grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <ImSpinner2 className="animate-spin text-camublue-900" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucun document disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((doc) => {
              const kind = getPreviewKind(doc.file_name || fixUrl(doc.file_url) || "");
              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-camublue-900/10 shrink-0">
                      <FileIcon fileName={doc.file_name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 leading-tight">{doc.title}</p>
                      {doc.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{doc.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[doc.category] || "bg-gray-100 text-gray-600"}`}>
                        {CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                      <span className="text-xs text-gray-400">{documentService.formatSize(doc.file_size)}</span>
                    </div>
                    <span className="text-xs text-gray-400">{fmt(doc.created_at)}</span>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => setPreview(doc)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                        kind !== "none"
                          ? "border-camublue-900 text-camublue-900 hover:bg-camublue-900/10"
                          : "border-gray-200 text-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      <Eye size={15} />
                      Visualiser
                    </button>
                    {fixUrl(doc.file_url) && (
                      <a
                        href={fixUrl(doc.file_url)!}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="flex items-center justify-center px-3 py-2 rounded-lg bg-camublue-900 text-white text-sm font-medium hover:bg-camublue-900/90 transition"
                        title="Télécharger"
                      >
                        <Download size={15} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </EmployeeLayout>
  );
}
