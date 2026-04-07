import { useState, useEffect, useRef } from 'react';
import { Upload, Download, Trash2, FileText, Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  downloadDocument,
} from '../services/documentService';
import { HRDocument, DOCUMENT_TYPE_OPTIONS } from '../types/document';

export default function DocumentsPage() {
  const { user } = useAuth();
  const isHR = user?.is_staff || user?.is_global_admin;
  const [documents, setDocuments] = useState<HRDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    document_type: 'AUTRE',
    file: null as File | null,
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await getDocuments();
      setDocuments(data);
    } catch {
      setError('Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file || !form.title) {
      setError('Titre et fichier sont requis');
      return;
    }
    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('document_type', form.document_type);
    formData.append('file', form.file);

    try {
      setUploading(true);
      setError(null);
      await uploadDocument(formData);
      setSuccess('Document uploadé avec succès');
      setForm({ title: '', description: '', document_type: 'AUTRE', file: null });
      setShowUploadForm(false);
      fetchDocuments();
    } catch {
      setError("Erreur lors de l'upload du document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce document ?')) return;
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSuccess('Document supprimé');
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      REGLEMENT: 'bg-red-100 text-red-700',
      PROCEDURE: 'bg-blue-100 text-blue-700',
      POLITIQUE: 'bg-purple-100 text-purple-700',
      FORMULAIRE: 'bg-green-100 text-green-700',
      GUIDE: 'bg-yellow-100 text-yellow-700',
      AUTRE: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || colors.AUTRE;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents RH</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isHR
              ? 'Gérez les documents publics disponibles pour les employés'
              : 'Documents mis à disposition par les Ressources Humaines'}
          </p>
        </div>
        {isHR && (
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            {showUploadForm ? <X size={16} /> : <Plus size={16} />}
            {showUploadForm ? 'Annuler' : 'Ajouter un document'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex justify-between">
          {error}
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X size={16} /></button>
        </div>
      )}

      {isHR && showUploadForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Uploader un nouveau document</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ex: Règlement intérieur 2024"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de document</label>
                <select
                  value={form.document_type}
                  onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                rows={2}
                placeholder="Description optionnelle..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fichier *</label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                {form.file ? (
                  <p className="text-sm text-gray-700">{form.file.name}</p>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload size={24} className="text-gray-400" />
                    <p className="text-sm text-gray-500">Cliquez pour sélectionner un fichier</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
              >
                {uploading ? 'Upload en cours...' : 'Uploader'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText size={48} className="mx-auto mb-3 opacity-40" />
          <p>Aucun document disponible</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Document</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Uploadé par</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-indigo-500" />
                      <div>
                        <p className="font-medium text-gray-900">{doc.title}</p>
                        {doc.description && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{doc.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(doc.document_type)}`}>
                      {doc.document_type_label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{doc.uploaded_by_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => downloadDocument(doc.id)}
                        className="flex items-center gap-1 px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs"
                        title="Télécharger"
                      >
                        <Download size={14} />
                        Télécharger
                      </button>
                      {isHR && (
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="flex items-center gap-1 px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg text-xs"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
