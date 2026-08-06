import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Download, Save, CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { disciplinaryDocService } from "@/services/disciplinaryDocService";
import {
  DisciplinaryDocument,
  DisciplinaryDocType,
  DOC_TYPE_CONFIG,
  DOC_TYPES,
} from "@/types/disciplinaryDoc";
import type { DisciplinaryRecord } from "@/services/employeeService";

interface Props {
  record: DisciplinaryRecord | null;
  onClose: () => void;
}

const PLACEHOLDERS: Record<DisciplinaryDocType, string> = {
  DEMANDE_EXPLICATION: `Nous avons été informés de faits susceptibles de constituer une faute professionnelle à votre encontre.\n\nNous vous demandons de bien vouloir nous fournir vos explications sur les faits suivants :\n\n[Décrire les faits reprochés]\n\nVeuillez nous faire parvenir votre réponse écrite dans un délai de 48 heures.`,
  REPONSE_EXPLICATION: `Suite à votre demande d'explications en date du [date], nous avons reçu la réponse de l'employé(e) concerné(e).\n\nRésumé de la réponse :\n\n[Résumer ou coller la réponse de l'employé]`,
  NOTIFICATION_SANCTION: `Suite à l'examen de votre dossier et après avoir pris connaissance de vos explications, la Direction a décidé de vous notifier la sanction suivante :\n\n[Détailler la sanction décidée]\n\nCette décision prend effet à compter du [date d'effet].\n\nVous disposez d'un délai de [délai] pour contester cette décision.`,
};

function DocSection({
  recordId,
  docType,
  existing,
  onSaved,
}: {
  recordId: number;
  docType: DisciplinaryDocType;
  existing: DisciplinaryDocument | undefined;
  onSaved: (doc: DisciplinaryDocument) => void;
}) {
  const cfg = DOC_TYPE_CONFIG[docType];
  const [content, setContent] = useState(existing?.content ?? "");
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);

  useEffect(() => {
    setContent(existing?.content ?? "");
  }, [existing?.content]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const doc = await disciplinaryDocService.save(recordId, docType, content);
      onSaved(doc);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("Document enregistré et PDF généré.");
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!existing) { toast.error("Enregistrez d'abord le document."); return; }
    const url = disciplinaryDocService.pdfUrl(recordId, existing.id);
    const token = localStorage.getItem("access_token");
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${docType}_${recordId}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Erreur lors du téléchargement."));
  };

  const dirty = content !== (existing?.content ?? "");

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100`}>
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className="font-semibold text-gray-800 text-sm">{cfg.label}</span>
          {existing && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              Enregistré
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {existing && (
            <button
              onClick={handleDownload}
              title="Télécharger le PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              <Download size={12} /> PDF
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            title="Enregistrer"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              saved
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : dirty
                ? "bg-[#003c71] text-white hover:bg-[#002d56]"
                : "bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saved ? (
              <CheckCircle2 size={12} />
            ) : (
              <Save size={12} />
            )}
            {saved ? "Enregistré" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Éditeur */}
      <div className="p-4 bg-white">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={PLACEHOLDERS[docType]}
          rows={8}
          className="w-full text-sm text-gray-700 leading-relaxed resize-y outline-none border border-gray-200 rounded-xl px-4 py-3 focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/15 transition placeholder-gray-300 bg-gray-50 focus:bg-white"
        />
        {existing && (
          <p className="text-[10px] text-gray-400 mt-1.5">
            Dernière mise à jour : {new Date(existing.updated_at).toLocaleString("fr-FR")}
            {existing.created_by && ` · par ${existing.created_by}`}
          </p>
        )}
      </div>
    </div>
  );
}

export default function DisciplinaryDocPanel({ record, onClose }: Props) {
  const [docs, setDocs]     = useState<DisciplinaryDocument[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!record) return;
    setLoading(true);
    try {
      setDocs(await disciplinaryDocService.list(record.id));
    } catch {
      toast.error("Erreur lors du chargement des documents.");
    } finally {
      setLoading(false);
    }
  }, [record?.id]);

  useEffect(() => {
    if (record) loadDocs();
    else setDocs([]);
  }, [record, loadDocs]);

  const handleSaved = (updated: DisciplinaryDocument) => {
    setDocs(prev => {
      const exists = prev.find(d => d.doc_type === updated.doc_type);
      return exists
        ? prev.map(d => d.doc_type === updated.doc_type ? updated : d)
        : [...prev, updated];
    });
  };

  const SANCTIONS: Record<string, string> = {
    "SAN-01": "Réprimande",
    "SAN-02": "Avertissement verbal ou écrit",
    "SAN-03": "Mise à pied — 1 à 3 jours",
    "SAN-04": "Mise à pied — 4 à 8 jours",
    "SAN-05": "Licenciement disciplinaire",
    "SAN-06": "Licenciement délégué du personnel",
  };

  return (
    <AnimatePresence>
      {record && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* Panneau */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-gray-50 z-50 shadow-2xl flex flex-col"
          >
            {/* Header panneau */}
            <div className="flex items-start justify-between px-6 py-5 bg-white border-b border-gray-100 shrink-0">
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
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-[#003c71]" size={28} />
                </div>
              ) : (
                DOC_TYPES.map(docType => (
                  <DocSection
                    key={docType}
                    recordId={record.id}
                    docType={docType}
                    existing={docs.find(d => d.doc_type === docType)}
                    onSaved={handleSaved}
                  />
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
