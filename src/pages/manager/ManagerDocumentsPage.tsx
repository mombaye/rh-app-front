// pages/manager/ManagerDocumentsPage.tsx
// Managers see the same documents as employees but via the manager layout
import EmployeeDocumentsPage from "@/pages/employee/EmployeeDocumentsPage";
import ManagerLayout from "@/layouts/ManagerLayout";
import { useEffect, useState } from "react";
import { FolderOpen, FileText, Download, Search, RefreshCw } from "lucide-react";
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

export default function ManagerDocumentsPage() {
  const [docs, setDocs] = useState<HRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");

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
    <ManagerLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#003c71]/10">
            <FolderOpen size={24} className="text-[#003c71]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Documents de l'entreprise</h1>
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

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un document..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#003c71]/20 focus:border-[#003c71] outline-none"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#003c71]/20 outline-none"
          >
            <option value="ALL">Toutes les catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <ImSpinner2 className="animate-spin text-[#003c71]" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucun document disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-[#003c71]/10 shrink-0">
                    <FileText size={20} className="text-[#003c71]" />
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
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition"
                  >
                    <Download size={15} />
                    Télécharger
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
