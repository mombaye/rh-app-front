import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Download, Loader2, Upload, Trash2, FilePlus } from "lucide-react";
import toast from "react-hot-toast";
import { disciplinaryDocService, UploadedPdf, DiscDocCategory } from "@/services/disciplinaryDocService";
import type { DisciplinaryRecord } from "@/services/employeeService";

interface Props {
  record: DisciplinaryRecord | null;
  onClose: () => void;
}

const SANCTIONS: Record<string, string> = {
  "SAN-01": "Réprimande",
  "SAN-02": "Avertissement verbal ou écrit",
  "SAN-03": "Mise à pied — 1 à 3 jours",
  "SAN-04": "Mise à pied — 4 à 8 jours",
  "SAN-05": "Licenciement disciplinaire",
  "SAN-06": "Licenciement délégué du personnel",
};

const DOC_SECTIONS: { type: DiscDocCategory; label: string; color: string; bg: string; border: string }[] = [
  {
    type:   "DEMANDE",
    label:  "Demande d'explications",
    color:  "text-blue-700",
    bg:     "bg-blue-50",
    border: "border-blue-200",
  },
  {
    type:   "REPONSE",
    label:  "Réponse",
    color:  "text-emerald-700",
    bg:     "bg-emerald-50",
    border: "border-emerald-200",
  },
  {
    type:   "NOTIFICATION",
    label:  "Notification de sanction",
    color:  "text-orange-700",
    bg:     "bg-orange-50",
    border: "border-orange-200",
  },
];

export default function DisciplinaryDocPanel({ record, onClose }: Props) {
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [loading, setLoading]           = useState(false);
  const [uploading, setUploading]       = useState<DiscDocCategory | null>(null);
  const [deletingId, setDeletingId]     = useState<number | null>(null);

  const demandRef      = useRef<HTMLInputElement>(null);
  const reponseRef     = useRef<HTMLInputElement>(null);
  const notifRef       = useRef<HTMLInputElement>(null);

  const inputRefFor = (type: DiscDocCategory) => {
    if (type === "DEMANDE")      return demandRef;
    if (type === "REPONSE")      return reponseRef;
    if (type === "NOTIFICATION") return notifRef;
    return demandRef;
  };

  const loadPdfs = useCallback(async () => {
    if (!record) return;
    setLoading(true);
    try {
      setUploadedPdfs(await disciplinaryDocService.listUploadedPdfs(record.id));
    } catch {
      toast.error("Erreur lors du chargement des documents.");
    } finally {
      setLoading(false);
    }
  }, [record?.id]);

  useEffect(() => {
    if (record) loadPdfs();
    else setUploadedPdfs([]);
  }, [record, loadPdfs]);

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>, docType: DiscDocCategory) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !record) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    setUploading(docType);
    try {
      const uploaded = await disciplinaryDocService.uploadPdf(record.id, file, docType);
      setUploadedPdfs(prev => [uploaded, ...prev]);
      toast.success("Document ajouté.");
    } catch {
      toast.error("Erreur lors de l'upload du PDF.");
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (pdfId: number) => {
    if (!record) return;
    setDeletingId(pdfId);
    try {
      await disciplinaryDocService.deleteUploadedPdf(record.id, pdfId);
      setUploadedPdfs(prev => prev.filter(p => p.id !== pdfId));
      toast.success("Document supprimé.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (pdfId: number, filename: string) => {
    if (!record) return;
    const url = disciplinaryDocService.downloadUploadedPdf(record.id, pdfId);
    const token = localStorage.getItem("access_token");
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Erreur lors du téléchargement."));
  };

  const pdfsByType = (type: DiscDocCategory) =>
    uploadedPdfs.filter(p => p.doc_type === type);

  return (
    <AnimatePresence>
      {record && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center px-4"
            onClick={onClose}
          >
          <motion.aside
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#003c71]/10">
                  <FileText size={18} className="text-[#003c71]" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-800">Documents disciplinaires</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {record.employee_prenom} {record.employee_nom} · {SANCTIONS[record.type_sanction] ?? record.type_sanction}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            {/* Corps */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-[#003c71]" size={28} />
                </div>
              ) : (
                DOC_SECTIONS.map(section => {
                  const docs = pdfsByType(section.type);
                  const isUploading = uploading === section.type;

                  return (
                    <div key={section.type} className={`rounded-xl border ${section.border} overflow-hidden`}>
                      {/* En-tête section */}
                      <div className={`flex items-center justify-between px-4 py-3 ${section.bg}`}>
                        <span className={`text-sm font-semibold ${section.color}`}>
                          {section.label}
                        </span>
                        <button
                          onClick={() => inputRefFor(section.type).current?.click()}
                          disabled={isUploading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${section.color} border ${section.border} bg-white hover:opacity-80 transition disabled:opacity-50`}
                        >
                          {isUploading
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Upload size={12} />}
                          {isUploading ? "Import…" : "Ajouter"}
                        </button>
                      </div>

                      {/* Liste ou état vide */}
                      {docs.length === 0 ? (
                        <div
                          className="flex flex-col items-center gap-2 py-5 cursor-pointer hover:bg-gray-50 transition"
                          onClick={() => inputRefFor(section.type).current?.click()}
                        >
                          <FilePlus size={22} className="text-gray-300" />
                          <p className="text-xs text-gray-400">Aucun document — cliquer pour importer</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {docs.map(pdf => (
                            <div key={pdf.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                              <div className="p-1.5 rounded-lg bg-[#003c71]/10 shrink-0">
                                <FileText size={14} className="text-[#003c71]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{pdf.filename}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(pdf.uploaded_at).toLocaleString("fr-FR")}
                                  {pdf.uploaded_by && ` · ${pdf.uploaded_by}`}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDownload(pdf.id, pdf.filename)}
                                className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-[#003c71] transition"
                                title="Télécharger"
                              >
                                <Download size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(pdf.id)}
                                disabled={deletingId === pdf.id}
                                className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                                title="Supprimer"
                              >
                                {deletingId === pdf.id
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <Trash2 size={14} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Inputs fichier cachés — un par type */}
            {(["DEMANDE", "REPONSE", "NOTIFICATION"] as DiscDocCategory[]).map(type => (
              <input
                key={type}
                ref={inputRefFor(type)}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleUploadPdf(e, type)}
              />
            ))}
          </motion.aside>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
