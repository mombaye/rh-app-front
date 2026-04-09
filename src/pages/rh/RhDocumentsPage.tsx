// pages/rh/RhDocumentsPage.tsx
import { useEffect, useState, useRef } from "react";
import {
  Upload, FileText, Trash2, Eye, EyeOff, Plus,
  FolderOpen, RefreshCw, Download, X, Search,
} from "lucide-react";
import AppLayout from "@/layouts/AppLayout";
import { documentService, HRDocument, CATEGORY_LABELS } from "@/services/documentService";
import DocumentPreviewModal, { getDocKind } from "@/components/documents/DocumentPreviewModal";
import toast from "react-hot-toast";
import { ImSpinner2 } from "react-icons/im";

const CATEGORIES = [
  { value: "REGLEMENT",    label: "Règlement intérieur" },
  { value: "NOTE_SERVICE", label: "Note de service" },
  { value: "PROCEDURE",    label: "Procédure / Politique" },
  { value: "FORMULAIRE",   label: "Formulaire" },
  { value: "AUTRE",        label: "Autre" },
];

const CATEGORY_COLORS: Record<string, string> = {
  REGLEMENT:    "bg-blue-100 text-blue-700",
  NOTE_SERVICE: "bg-purple-100 text-purple-700",
  PROCEDURE:    "bg-amber-100 text-amber-700",
  FORMULAIRE:   "bg-green-100 text-green-700",
  AUTRE:        "bg-gray-100 text-gray-600",
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

export default function RhDocumentsPage() {
  const [docs, setDocs] = useState<HRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<HRDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<HRDocument | null>(null);

  // Upload form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("AUTRE");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const filtered = docs.filter((d) => {
    const matchSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "ALL" || d.category === catFilter;
    return matchSearch && matchCat;
  });

  const handleUpload = async () => {
    if (!title.trim()) return toast.error("Le titre est obligatoire");
    if (!file) return toast.error("Veuillez sélectionner un fichier");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("category", category);
      fd.append("file", file);
      const created = await documentService.upload(fd);
      setDocs((prev) => [created, ...prev]);
      toast.success("Document uploadé avec succès");
      setShowUploadModal(false);
      resetForm();
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("AUTRE");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleToggle = async (doc: HRDocument) => {
    try {
      const res = await documentService.toggleActive(doc.id);
      setDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, is_active: res.is_active } : d))
      );
      toast.success(res.is_active ? "Document activé" : "Document masqué");
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await documentService.delete(confirmDelete.id);
      setDocs((prev) => prev.filter((d) => d.id !== confirmDelete.id));
      toast.success("Document supprimé");
      setConfirmDelete(null);
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-camublue-900/10">
              <FolderOpen size={24} className="text-camublue-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-camublue-900">Documents RH</h1>
              <p className="text-sm text-gray-500">
                Gérez les documents publics accessibles à tous les employés
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg border bg-white hover:bg-gray-50 transition"
              title="Rafraîchir"
            >
              <RefreshCw size={16} className="text-gray-500" />
            </button>
            <button
              onClick={() => { resetForm(); setShowUploadModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 transition text-sm font-medium"
            >
              <Plus size={16} />
              Ajouter un document
            </button>
          </div>
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

        {/* Documents list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <ImSpinner2 className="animate-spin text-camublue-900" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucun document trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left">Catégorie</th>
                  <th className="px-4 py-3 text-left">Taille</th>
                  <th className="px-4 py-3 text-left">Ajouté le</th>
                  <th className="px-4 py-3 text-left">Par</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((doc) => (
                  <tr key={doc.id} className={`hover:bg-gray-50 transition ${!doc.is_active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-camublue-900 shrink-0" />
                        <div>
                          <p className="font-medium text-gray-800">{doc.title}</p>
                          {doc.description && (
                            <p className="text-xs text-gray-400 truncate max-w-[220px]">{doc.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[doc.category] || "bg-gray-100 text-gray-600"}`}>
                        {CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{documentService.formatSize(doc.file_size)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(doc.created_at)}</td>
                    <td className="px-4 py-3 text-gray-500">{doc.uploaded_by || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${doc.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {doc.is_active ? "Actif" : "Masqué"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setPreview(doc)}
                          className={`p-1.5 rounded-lg transition ${
                            getDocKind(doc) !== "download-only"
                              ? "hover:bg-camublue-900/10 text-camublue-900"
                              : "hover:bg-gray-50 text-gray-400"
                          }`}
                          title="Visualiser"
                        >
                          <Eye size={15} />
                        </button>
                        {doc.file_url && (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                            title="Télécharger"
                          >
                            <Download size={15} />
                          </a>
                        )}
                        <button
                          onClick={() => handleToggle(doc)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition"
                          title={doc.is_active ? "Masquer" : "Afficher"}
                        >
                          {doc.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(doc)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
              <h2 className="text-lg font-semibold text-camublue-900 flex items-center gap-2">
                <Upload size={18} /> Ajouter un document
              </h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Règlement intérieur 2025"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900/20 focus:border-camublue-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900/20 outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description optionnelle..."
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-camublue-900/20 focus:border-camublue-900 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fichier *</label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-camublue-900 transition"
                  onClick={() => fileRef.current?.click()}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-camublue-900">
                      <FileText size={16} />
                      <span className="text-sm font-medium truncate max-w-[220px]">{file.name}</span>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">
                      <Upload size={20} className="mx-auto mb-1" />
                      Cliquez pour sélectionner un fichier
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition"
              >
                Annuler
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 text-sm transition disabled:opacity-60"
              >
                {uploading ? <ImSpinner2 className="animate-spin" size={14} /> : <Upload size={14} />}
                {uploading ? "Upload en cours..." : "Uploader"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-camublue-900 mb-2">Supprimer le document</h3>
            <p className="text-sm text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer <strong>"{confirmDelete.title}"</strong> ? Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm transition disabled:opacity-60"
              >
                {deleting ? <ImSpinner2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <DocumentPreviewModal
          doc={preview}
          onClose={() => setPreview(null)}
          accentClass="camublue-900"
        />
      )}
    </AppLayout>
  );
}
