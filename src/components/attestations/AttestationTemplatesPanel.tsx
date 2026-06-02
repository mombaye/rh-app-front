// src/components/attestations/AttestationTemplatesPanel.tsx
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Trash2, Download, FileText, CheckCircle,
  HelpCircle, X, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import { templateService } from "@/services/attestationService";
import { AttestationTemplate, AttestationDocumentType, TemplatePlaceholder, DOC_TYPE_LABELS } from "@/types/attestation";

const DOC_TYPES: AttestationDocumentType[] = [
  "ATTESTATION_TRAVAIL_CDI",
  "ATTESTATION_TRAVAIL_CDD",
  "ATTESTATION_CONGES",
  "DOMICILIATION_CDI",
  "DOMICILIATION_CDD",
];

const DOC_ICONS: Record<AttestationDocumentType, string> = {
  ATTESTATION_TRAVAIL_CDI: "📄",
  ATTESTATION_TRAVAIL_CDD: "📄",
  ATTESTATION_CONGES:      "🏖️",
  DOMICILIATION_CDI:       "🏦",
  DOMICILIATION_CDD:       "🏦",
};

function fmtSize(bytes: number) {
  if (bytes < 1024)       return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Carte par type de document ───────────────────────────────────────────────

interface TemplateCardProps {
  docType:      AttestationDocumentType;
  template:     AttestationTemplate | null;
  onUploaded:   (t: AttestationTemplate) => void;
  onDeleted:    (id: number) => void;
}

function TemplateCard({ docType, template, onUploaded, onDeleted }: TemplateCardProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx") && !file.name.toLowerCase().endsWith(".doc")) {
      toast.error("Seuls les fichiers .doc et .docx sont acceptés.");
      return;
    }
    setUploading(true);
    try {
      const t = await templateService.upload(docType, file);
      onUploaded(t);
      toast.success(`Template « ${DOC_TYPE_LABELS[docType]} » mis à jour !`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    setDeleting(true);
    try {
      await templateService.delete(template.id);
      onDeleted(template.id);
      toast.success("Template supprimé.");
      setConfirmDel(false);
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`rounded-2xl border transition ${
      template
        ? "border-emerald-200 bg-emerald-50/40"
        : "border-gray-200 bg-white"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="text-2xl select-none">{DOC_ICONS[docType]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {DOC_TYPE_LABELS[docType]}
          </p>
          {template ? (
            <p className="text-xs text-emerald-700 mt-0.5 flex items-center gap-1">
              <CheckCircle size={11} className="shrink-0" />
              Template actif · mis à jour le {fmtDate(template.uploaded_at)}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">Aucun template — génération reportlab utilisée</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {template?.template_url && (
            <a
              href={template.template_url}
              download
              title="Télécharger le template actuel"
              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-[#003c71] transition"
            >
              <Download size={14} />
            </a>
          )}

          {template && !confirmDel && (
            <button
              onClick={() => setConfirmDel(true)}
              title="Supprimer le template"
              className="p-2 rounded-lg bg-white border border-red-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition"
            >
              <Trash2 size={14} />
            </button>
          )}

          {confirmDel && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition disabled:opacity-60"
              >
                {deleting ? <ImSpinner2 className="animate-spin" size={11} /> : <Trash2 size={11} />}
                Supprimer
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
            </div>
          )}

          {/* Upload */}
          <input
            ref={fileRef}
            type="file"
            accept=".doc,.docx"
            className="hidden"
            onChange={handleFile}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-60 ${
              template
                ? "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                : "bg-[#003c71] text-white hover:bg-[#003c71]/90"
            }`}
          >
            {uploading
              ? <ImSpinner2 className="animate-spin" size={12} />
              : <Upload size={12} />
            }
            {template ? "Remplacer" : "Uploader"}
          </button>
        </div>
      </div>

      {/* Détails si template existant */}
      {template && (
        <div className="border-t border-emerald-100 px-5 py-2.5 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FileText size={11} />
            {template.original_filename}
          </span>
          <span>{fmtSize(template.file_size)}</span>
          {template.uploaded_by && (
            <span>par {template.uploaded_by}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Guide des variables ──────────────────────────────────────────────────────

function PlaceholdersGuide({ placeholders }: { placeholders: TemplatePlaceholder[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <HelpCircle size={18} className="text-blue-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-800">
            Guide des variables disponibles
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            Utilisez ces variables dans vos templates Word pour insérer les données de l'employé automatiquement
          </p>
        </div>
        {open ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-blue-500" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-blue-200">
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {placeholders.map(p => (
                  <div key={p.variable} className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-blue-100">
                    <code className="text-xs font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-lg shrink-0">
                      {p.variable}
                    </code>
                    <span className="text-xs text-gray-600 truncate">{p.description}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Écrivez les variables <strong>exactement</strong> comme indiqué, entre doubles accolades.
                  Exemple : <code className="font-mono">{"{{PRENOM}}"}</code> sera remplacé par le prénom de l'employé.
                  Les formats <strong>.doc</strong> et <strong>.docx</strong> sont acceptés.
                  La conversion en PDF nécessite <strong>LibreOffice</strong> installé sur le serveur.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Panneau principal ────────────────────────────────────────────────────────

export default function AttestationTemplatesPanel() {
  const [templates,    setTemplates]    = useState<AttestationTemplate[]>([]);
  const [placeholders, setPlaceholders] = useState<TemplatePlaceholder[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [tpls, phs] = await Promise.all([
          templateService.getAll(),
          templateService.getPlaceholders(),
        ]);
        setTemplates(tpls);
        setPlaceholders(phs);
      } catch {
        toast.error("Erreur chargement des templates");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const templateByType = (dt: AttestationDocumentType) =>
    templates.find(t => t.document_type === dt) ?? null;

  const handleUploaded = (t: AttestationTemplate) => {
    setTemplates(prev => {
      const without = prev.filter(x => x.document_type !== t.document_type);
      return [...without, t];
    });
  };

  const handleDeleted = (id: number) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <ImSpinner2 className="animate-spin text-[#003c71]" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Guide variables */}
      <PlaceholdersGuide placeholders={placeholders} />

      {/* Cartes par type de document */}
      <div className="space-y-3">
        {DOC_TYPES.map(dt => (
          <TemplateCard
            key={dt}
            docType={dt}
            template={templateByType(dt)}
            onUploaded={handleUploaded}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </div>
  );
}
