import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen, FileText, Download, ChevronRight, Loader2,
  Home, Folder, Eye, X, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { getEmployeeDocuments, downloadEmployeeDocument, DocumentItem } from "@/services/employeeService";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDate(d?: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("fr-FR");
}

type PreviewKind = "pdf";

function getPreviewKind(_name: string): PreviewKind {
  return "pdf";
}

function FileIcon({ size = 20 }: { name?: string; size?: number }) {
  return <FileText size={size} className="text-red-500" />;
}

// ── Récupère le fichier comme Blob (requête authentifiée) ─────────────────────
async function fetchFileBlob(employeeId: number, filePath: string): Promise<Blob> {
  const token = localStorage.getItem("access_token");
  const { BASE_URL: base } = await import("@/api/baseUrl");
  const url = `${base}/api/employees/${employeeId}/documents/download/?path=${encodeURIComponent(filePath)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

// ── Modale de prévisualisation ────────────────────────────────────────────────
interface PreviewState {
  title: string;
  kind: PreviewKind;
  blobUrl: string;      // blob: URL créée localement
}

function PreviewModal({ state, onClose }: { state: PreviewState; onClose: () => void }) {
  const { title, kind, blobUrl } = state;

  // Libérer la Blob URL quand la modale se ferme
  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={onClose}>
      {/* Barre supérieure */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileText size={18} className="text-gray-300 shrink-0" />
          <p className="font-semibold text-sm truncate">{title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <a
            href={blobUrl}
            download={title}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-camublue-900 text-white text-xs font-medium hover:bg-camublue-900/80 transition"
          >
            <Download size={13} />
            Télécharger
          </a>
          {kind === "pdf" && (
            <a
              href={blobUrl}
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

      {/* Zone de visualisation */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "pdf" && (
          <object
            data={blobUrl}
            type="application/pdf"
            className="w-full h-full rounded-lg bg-white"
            aria-label={title}
          >
            <div className="flex flex-col items-center gap-4 text-white text-center py-12">
              <FileText size={48} className="opacity-40" />
              <p className="font-medium">Le PDF ne peut pas être affiché ici.</p>
              <a href={blobUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-camublue-900 text-white font-medium hover:bg-camublue-900/90 transition">
                <ExternalLink size={15} /> Ouvrir le PDF
              </a>
            </div>
          </object>
        )}

      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EmployeeDossierPage() {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [items, setItems]               = useState<DocumentItem[]>([]);
  const [currentPath, setCurrentPath]   = useState<string>("");
  const [pathHistory, setPathHistory]   = useState<{ label: string; path: string }[]>([]);
  const [loading, setLoading]           = useState(true);
  const [downloading, setDownloading]   = useState<string | null>(null);
  const [previewing, setPreviewing]     = useState<string | null>(null);
  const [folderFound, setFolderFound]   = useState(true);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);

  const navigate = useCallback((path: string, label: string, pushHistory = true) => {
    if (!employeeId) return;
    setLoading(true);
    getEmployeeDocuments(employeeId, path)
      .then(res => {
        setItems(res.items);
        setFolderFound(res.folder_found);
        setCurrentPath(path);
        if (pushHistory) setPathHistory(prev => [...prev, { label, path }]);
      })
      .catch(() => toast.error("Impossible d'accéder à ce dossier."))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) { setLoading(false); return; }
    getEmployeeDocuments(employeeId)
      .then(res => {
        setItems(res.items);
        setFolderFound(res.folder_found);
        setPathHistory([{ label: "Dossier", path: "" }]);
      })
      .catch(() => setFolderFound(false))
      .finally(() => setLoading(false));
  }, [employeeId]);

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewState(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleDownload = async (item: DocumentItem) => {
    if (!employeeId || item.type !== "file") return;
    const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
    setDownloading(item.name);
    try {
      await downloadEmployeeDocument(employeeId, filePath);
      toast.success(`${item.name} téléchargé.`);
    } catch {
      toast.error("Erreur lors du téléchargement.");
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (item: DocumentItem) => {
    if (!employeeId || item.type !== "file") return;
    const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
    const kind = getPreviewKind(item.name);
    setPreviewing(item.name);
    try {
      const blob = await fetchFileBlob(employeeId, filePath);
      const blobUrl = URL.createObjectURL(blob);
      setPreviewState({ title: item.name, kind, blobUrl });
    } catch {
      toast.error("Impossible de charger le fichier.");
    } finally {
      setPreviewing(null);
    }
  };

  const handleFolder = (item: DocumentItem) => {
    const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    navigate(newPath, item.name);
  };

  const goToBreadcrumb = (idx: number) => {
    const crumb = pathHistory[idx];
    setPathHistory(prev => prev.slice(0, idx + 1));
    if (!employeeId) return;
    setLoading(true);
    getEmployeeDocuments(employeeId, crumb.path)
      .then(res => { setItems(res.items); setCurrentPath(crumb.path); })
      .finally(() => setLoading(false));
  };

  const folders = items.filter(i => i.type === "folder");
  const files   = items.filter(i => i.type === "file" && i.name.toLowerCase().endsWith(".pdf"));

  return (
    <EmployeeLayout>
      <div className="px-4 md:px-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-camublue-900">Mon Dossier</h1>
          <p className="text-gray-500 text-sm mt-0.5">Accédez à vos documents personnels</p>
        </motion.div>

        {/* Breadcrumb */}
        <motion.nav initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 mb-4 flex-wrap">
          {pathHistory.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight size={14} className="text-gray-400" />}
              <button
                onClick={() => goToBreadcrumb(idx)}
                className={`flex items-center gap-1 text-sm px-2 py-1 rounded-lg transition ${
                  idx === pathHistory.length - 1
                    ? "text-camublue-900 font-semibold"
                    : "text-gray-500 hover:text-camublue-900 hover:bg-camublue-900/5"
                }`}
              >
                {idx === 0 && <Home size={14} />}
                {crumb.label}
              </button>
            </div>
          ))}
        </motion.nav>

        {/* Contenu */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          {!folderFound ? (
            <div className="text-center py-16">
              <FolderOpen size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">Dossier personnel introuvable.</p>
              <p className="text-gray-300 text-xs mt-1">Contactez votre service RH.</p>
            </div>
          ) : loading ? (
            <div className="p-6 space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <FolderOpen size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">Ce dossier est vide.</p>
            </div>
          ) : (
            <div>
              {/* Dossiers */}
              {folders.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Dossiers ({folders.length})
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {folders.map(item => (
                      <button
                        key={item.name}
                        onClick={() => handleFolder(item)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-camublue-900/5 transition text-left group"
                      >
                        <Folder size={20} className="text-camublue-900 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 group-hover:text-camublue-900 transition truncate">
                            {item.name}
                          </div>
                          {item.modified && (
                            <div className="text-xs text-gray-400">{fmtDate(item.modified)}</div>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-camublue-900 transition shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fichiers */}
              {files.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Fichiers ({files.length})
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {files.map(item => {
                      const isDownloading = downloading === item.name;
                      const isPreviewing  = previewing  === item.name;
                      return (
                        <div
                          key={item.name}
                          className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition"
                        >
                          <FileIcon name={item.name} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                            <div className="text-xs text-gray-400">
                              {[fmtSize(item.size), fmtDate(item.modified)].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Bouton Visualiser */}
                            <button
                              onClick={() => handlePreview(item)}
                              disabled={isPreviewing || isDownloading}
                              className="flex items-center gap-1.5 text-sm text-camublue-900 border border-camublue-900/30 hover:bg-camublue-900/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                              title="Visualiser"
                            >
                              {isPreviewing
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Eye size={14} />}
                              Visualiser
                            </button>
                            {/* Bouton Télécharger */}
                            <button
                              onClick={() => handleDownload(item)}
                              disabled={isDownloading || isPreviewing}
                              className="flex items-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                              title="Télécharger"
                            >
                              {isDownloading
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Download size={14} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Modale de prévisualisation */}
      {previewState && (
        <PreviewModal state={previewState} onClose={() => setPreviewState(null)} />
      )}
    </EmployeeLayout>
  );
}
