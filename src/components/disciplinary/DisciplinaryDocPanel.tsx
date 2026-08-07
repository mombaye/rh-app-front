import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Download, Loader2, Upload, Trash2, FilePlus } from "lucide-react";
import toast from "react-hot-toast";
import { disciplinaryDocService, UploadedPdf } from "@/services/disciplinaryDocService";
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

export default function DisciplinaryDocPanel({ record, onClose }: Props) {
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [loading, setLoading]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [deletingId, setDeletingId]     = useState<number | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !record) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await disciplinaryDocService.uploadPdf(record.id, file);
      setUploadedPdfs(prev => [uploaded, ...prev]);
      toast.success("Document PDF ajouté.");
    } catch {
      toast.error("Erreur lors de l'upload du PDF.");
    } finally {
      setUploading(false);
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

  return (
    <AnimatePresence>
      {record && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
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
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-[#003c71]" size={28} />
                </div>
              ) : uploadedPdfs.length === 0 ? (
                /* ── État vide : zone d'upload centrale ── */
                <div className="flex flex-col items-center justify-center h-full gap-5 py-16">
                  <div className="p-5 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200">
                    <FilePlus size={36} className="text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Aucun document pour ce dossier</p>
                    <p className="text-xs text-gray-400 mt-1">Importez un PDF pour l'associer à ce dossier disciplinaire.</p>
                  </div>
                  <button
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#003c71] text-white text-sm font-semibold hover:bg-[#002d56] transition disabled:opacity-60"
                  >
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    {uploading ? "Import en cours…" : "Importer un PDF"}
                  </button>
                </div>
              ) : (
                /* ── Liste des PDFs ── */
                <div className="flex flex-col gap-3">
                  {/* Bouton ajouter */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {uploadedPdfs.length} document{uploadedPdfs.length > 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#003c71] text-white text-xs font-semibold hover:bg-[#002d56] transition disabled:opacity-60"
                    >
                      {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      {uploading ? "Import…" : "Ajouter un PDF"}
                    </button>
                  </div>

                  {uploadedPdfs.map(pdf => (
                    <div
                      key={pdf.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition"
                    >
                      <div className="p-2 rounded-lg bg-[#003c71]/10 shrink-0">
                        <FileText size={16} className="text-[#003c71]" />
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
                        <Download size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(pdf.id)}
                        disabled={deletingId === pdf.id}
                        className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deletingId === pdf.id
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Trash2 size={15} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleUploadPdf}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
