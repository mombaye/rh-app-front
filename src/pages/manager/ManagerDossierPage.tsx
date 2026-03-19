import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { FolderOpen, FileText, Download, ChevronRight, Loader2, Home, Folder, File } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import ManagerLayout from "@/layouts/ManagerLayout";
import { getEmployeeDocuments, downloadEmployeeDocument, DocumentItem } from "@/services/employeeService";
import toast from "react-hot-toast";

const FILE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  pdf:  { icon: FileText, color: "text-red-500" },
  doc:  { icon: FileText, color: "text-blue-600" },
  docx: { icon: FileText, color: "text-blue-600" },
  xls:  { icon: FileText, color: "text-green-600" },
  xlsx: { icon: FileText, color: "text-green-600" },
  png:  { icon: File, color: "text-purple-500" },
  jpg:  { icon: File, color: "text-purple-500" },
  jpeg: { icon: File, color: "text-purple-500" },
};
const getExt = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const fmtSize = (bytes?: number) => !bytes ? "" : bytes < 1024 ? `${bytes} o` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
const fmtDate = (d?: string) => !d ? "" : new Date(d).toLocaleDateString("fr-FR");

interface ManagerDossierPageProps {
  layout?: React.ComponentType<{ children: React.ReactNode }>;
}

export default function ManagerDossierPage({ layout: Layout = ManagerLayout }: ManagerDossierPageProps) {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  const [items, setItems] = useState<DocumentItem[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [pathHistory, setPathHistory] = useState<{ label: string; path: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [folderFound, setFolderFound] = useState(true);

  const navigate = useCallback((path: string, label: string) => {
    if (!employeeId) return;
    setLoading(true);
    getEmployeeDocuments(employeeId, path)
      .then(res => {
        setItems(res.items);
        setFolderFound(res.folder_found);
        setCurrentPath(path);
        setPathHistory(prev => [...prev, { label, path }]);
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
              <button
                onClick={() => goToBreadcrumb(idx)}
                className={`flex items-center gap-1 text-sm px-2 py-1 rounded-lg transition ${
                  idx === pathHistory.length - 1 ? "text-[#003c71] font-semibold" : "text-gray-500 hover:text-[#003c71] hover:bg-[#003c71]/5"
                }`}
              >
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
                      const ext = getExt(item.name);
                      const cfg = FILE_ICONS[ext] ?? { icon: FileText, color: "text-gray-500" };
                      const Icon = cfg.icon;
                      const isLoading = downloading === item.name;
                      return (
                        <div key={item.name} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition">
                          <Icon size={20} className={`shrink-0 ${cfg.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                            <div className="text-xs text-gray-400">{[fmtSize(item.size), fmtDate(item.modified)].filter(Boolean).join(" · ")}</div>
                          </div>
                          <button onClick={() => handleDownload(item)} disabled={isLoading} className="flex items-center gap-1.5 text-sm text-[#003c71] hover:bg-[#003c71]/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50 shrink-0">
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            Télécharger
                          </button>
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
    </Layout>
  );
}
