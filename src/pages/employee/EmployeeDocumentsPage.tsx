// pages/employee/EmployeeDocumentsPage.tsx
import { useEffect, useState } from "react";
import { FolderOpen, Download, Search, RefreshCw, Eye } from "lucide-react";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { documentService, HRDocument, CATEGORY_LABELS } from "@/services/documentService";
import DocumentPreviewModal, {
  FileTypeIcon,
  getDocKind,
} from "@/components/documents/DocumentPreviewModal";
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

type LayoutComponent = React.ComponentType<{ children: React.ReactNode }>;

export default function EmployeeDocumentsPage({ layout: Layout = EmployeeLayout }: { layout?: LayoutComponent }) {
  const [docs,      setDocs]      = useState<HRDocument[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [preview,   setPreview]   = useState<HRDocument | null>(null);

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

  return (
    <Layout>
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
              placeholder="Rechercher un document…"
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
              const kind = getDocKind(doc);
              const isPreviewable = kind !== "download-only";
              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-camublue-900/10 shrink-0">
                      <FileTypeIcon fileName={doc.file_name} />
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
                        isPreviewable
                          ? "border-camublue-900 text-camublue-900 hover:bg-camublue-900/10"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      <Eye size={15} />
                      {isPreviewable ? "Visualiser" : "Voir"}
                    </button>
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
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

      {preview && (
        <DocumentPreviewModal
          doc={preview}
          onClose={() => setPreview(null)}
          accentClass="camublue-900"
        />
      )}
    </Layout>
  );
}
