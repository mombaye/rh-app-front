import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen, FileText, Download, ChevronRight, Loader2,
  Home, Folder, Eye, X, ExternalLink, FileImage, FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import ManagerLayout from "@/layouts/ManagerLayout";
import { getEmployeeDocuments, downloadEmployeeDocument, DocumentItem } from "@/services/employeeService";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────
const getExt = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const fmtSize = (b?: number) => !b ? "" : b < 1024 ? `${b} o` : b < 1048576 ? `${(b/1024).toFixed(1)} Ko` : `${(b/1048576).toFixed(1)} Mo`;
const fmtDate = (d?: string) => !d ? "" : new Date(d).toLocaleDateString("fr-FR");

type PreviewKind = "pdf" | "image" | "office" | "none";

function getPreviewKind(name: string): PreviewKind {
  const ext = getExt(name);
  if (ext === "pdf") return "pdf";
  if (["jpg","jpeg","png","gif","webp","svg"].includes(ext)) return "image";
  if (["doc","docx","xls","xlsx","ppt","pptx"].includes(ext)) return "office";
  return "none";
}

function FileIcon({ name, size = 20 }: { name: string; size?: number }) {
  const ext = getExt(name);
  if (["jpg","jpeg","png","gif","webp","svg"].includes(ext)) return <FileImage size={size} className="text-purple-500" />;
  if (["xls","xlsx","csv"].includes(ext)) return <FileSpreadsheet size={size} className="text-green-600" />;
  if (ext === "pdf") return <FileText size={size} className="text-red-500" />;
  if (["doc","docx"].includes(ext)) return <FileText size={size} className="text-blue-600" />;
  if (["ppt","pptx"].includes(ext)) return <FileText size={size} className="text-orange-500" />;
  return <FileText size={size} className="text-gray-500" />;
}

async function fetchFileBlob(employeeId: number, filePath: string): Promise<Blob> {
  const token = localStorage.getItem("access_token");
  const base = (import.meta.env.VITE_API_URL as string) || "http://localhost:8030";
  const url = `${base}/api/employees/${employeeId}/documents/download/?path=${encodeURIComponent(filePath)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

interface PreviewState { title: string; kind: PreviewKind; blobUrl: string; }

function PreviewModal({ state, onClose, color = "#003c71" }: { state: PreviewState; onClose: () => void; color?: string }) {
  const { title, kind, blobUrl } = state;
  useEffect(() => () => URL.revokeObjectURL(blobUrl), [blobUrl]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 min-w-0">
          <FileText size={18} className="text-gray-300 shrink-0" />
          <p className="font-semibold text-sm truncate">{title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <a href={blobUrl} download={title} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: color }}>
            <Download size={13} />Télécharger
          </a>
          {kind === "pdf" && (
            <a href={blobUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition" title="Ouvrir dans un onglet">
              <ExternalLink size={16} />
            </a>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-300 transition"><X size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex items-center justify-center p-2" onClick={e => e.stopPropagation()}>
        {kind === "pdf" && (
          <object data={blobUrl} type="application/pdf" className="w-full h-full rounded-lg bg-white" aria-label={title}>
            <div className="flex flex-col items-center gap-4 text-white text-center py-12">
              <FileText size={48} className="opacity-40" />
              <p className="font-medium">Le PDF ne peut pas être affiché ici.</p>
              <a href={blobUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-medium transition hover:opacity-80" style={{ backgroundColor: color }}>
                <ExternalLink size={15} />Ouvrir
              </a>
            </div>
          </object>
        )}
        {kind === "image" && <img src={blobUrl} alt={title} className="max-w-full max-h-full object-contain rounded-lg shadow-xl" />}
        {kind === "office" && (
          <div className="flex flex-col items-center gap-5 text-white text-center">
            <FileText size={60} className="opacity-30" />
            <div>
              <p className="text-lg font-semibold">Aperçu Office</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm">
                Les fichiers Word, Excel et PowerPoint ne peuvent pas être prévisualisés directement.<br />
                Téléchargez le fichier pour l'ouvrir.
              </p>
            </div>
            <a href={blobUrl} download={title} className="flex items-center gap-2 px-6 py-3 rounded-lg text-white font-medium transition hover:opacity-80" style={{ backgroundColor: color }}>
              <Download size={16} />Télécharger {title}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
interface ManagerDossierPageProps {
  layout?: React.ComponentType<{ children: React.ReactNode }>;
}

export default function ManagerDossierPage({ layout: Layout = ManagerLayout }: ManagerDossierPageProps) {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [items, setItems]               = useState<DocumentItem[]>([]);
  const [currentPath, setCurrentPath]   = useState("");
  const [pathHistory, setPathHistory]   = useState<{ label: string; path: string }[]>([]);
  const [loading, setLoading]           = useState(true);
  const [downloading, setDownloading]   = useState<string | null>(null);
  const [previewing, setPreviewing]     = useState<string | null>(null);
  const [folderFound, setFolderFound]   = useState(true);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);

  const navigate = useCallback((path: string, label: string) => {
    if (!employeeId) return;
    setLoading(true);
    getEmployeeDocuments(employeeId, path)
      .then(res => { setItems(res.items); setFolderFound(res.folder_found); setCurrentPath(path); setPathHistory(prev => [...prev, { label, path }]); })
      .catch(() => toast.error("Impossible d'accéder à ce dossier."))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) { setLoading(false); return; }
    getEmployeeDocuments(employeeId)
      .then(res => { setItems(res.items); setFolderFound(res.folder_found); setPathHistory([{ label: "Dossier", path: "" }]); })
      .catch(() => setFolderFound(false))
      .finally(() => setLoading(false));
  }, [employeeId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewState(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const handleDownload = async (item: DocumentItem) => {
    if (!employeeId || item.type !== "file") return;
    const fp = currentPath ? `${currentPath}/${item.name}` : item.name;
    setDownloading(item.name);
    try { await downloadEmployeeDocument(employeeId, fp); toast.success(`${item.name} téléchargé.`); }
    catch { toast.error("Erreur lors du téléchargement."); }
    finally { setDownloading(null); }
  };

  const handlePreview = async (item: DocumentItem) => {
    if (!employeeId || item.type !== "file") return;
    const fp = currentPath ? `${currentPath}/${item.name}` : item.name;
    setPreviewing(item.name);
    try {
      const blob = await fetchFileBlob(employeeId, fp);
      setPreviewState({ title: item.name, kind: getPreviewKind(item.name), blobUrl: URL.createObjectURL(blob) });
    } catch { toast.error("Impossible de charger le fichier."); }
    finally { setPreviewing(null); }
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
  const files   = items.filter(i => i.type === "file");

  return (
    <Layout>
      <div className="px-4 md:px-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-[#003c71]">Mon Dossier</h1>
          <p className="text-gray-500 text-sm mt-0.5">Accédez à vos documents personnels</p>
        </motion.div>

        <motion.nav initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 mb-4 flex-wrap">
          {pathHistory.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight size={14} className="text-gray-400" />}
              <button onClick={() => goToBreadcrumb(idx)} className={`flex items-center gap-1 text-sm px-2 py-1 rounded-lg transition ${idx === pathHistory.length - 1 ? "text-[#003c71] font-semibold" : "text-gray-500 hover:text-[#003c71] hover:bg-[#003c71]/5"}`}>
                {idx === 0 && <Home size={14} />}
                {crumb.label}
              </button>
            </div>
          ))}
        </motion.nav>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {!folderFound ? (
            <div className="text-center py-16">
              <FolderOpen size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">Dossier personnel introuvable.</p>
              <p className="text-gray-300 text-xs mt-1">Contactez votre service RH.</p>
            </div>
          ) : loading ? (
            <div className="p-6 space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <FolderOpen size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">Ce dossier est vide.</p>
            </div>
          ) : (
            <div>
              {folders.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dossiers ({folders.length})</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {folders.map(item => (
                      <button key={item.name} onClick={() => navigate(currentPath ? `${currentPath}/${item.name}` : item.name, item.name)} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#003c71]/5 transition text-left group">
                        <Folder size={20} className="text-[#003c71] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 group-hover:text-[#003c71] transition truncate">{item.name}</div>
                          {item.modified && <div className="text-xs text-gray-400">{fmtDate(item.modified)}</div>}
                        </div>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-[#003c71] transition shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {files.length > 0 && (
                <div>
                  <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fichiers ({files.length})</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {files.map(item => {
                      const isDownloading = downloading === item.name;
                      const isPreviewing  = previewing  === item.name;
                      return (
                        <div key={item.name} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition">
                          <FileIcon name={item.name} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                            <div className="text-xs text-gray-400">{[fmtSize(item.size), fmtDate(item.modified)].filter(Boolean).join(" · ")}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handlePreview(item)}
                              disabled={isPreviewing || isDownloading}
                              className="flex items-center gap-1.5 text-sm text-[#003c71] border border-[#003c71]/30 hover:bg-[#003c71]/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                            >
                              {isPreviewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                              Visualiser
                            </button>
                            <button
                              onClick={() => handleDownload(item)}
                              disabled={isDownloading || isPreviewing}
                              className="flex items-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                              title="Télécharger"
                            >
                              {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
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

      {previewState && <PreviewModal state={previewState} onClose={() => setPreviewState(null)} />}
    </Layout>
  );
}
