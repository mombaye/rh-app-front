// src/pages/hse/PassportManagementPage.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import {
  BookUser, Upload, Search, RefreshCw, Download, QrCode,
  Trash2, X, ChevronLeft, ChevronRight, Settings2,
  RefreshCcw, CheckCircle2, Printer,
} from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import ManagerLayout from "@/layouts/ManagerLayout";
import {
  passportService,
  PassportFile,
  UploadResult,
} from "@/services/passportService";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
const PAGE_SIZE = 10;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

// ── Modal Détail — rendu HTML direct depuis le fichier Excel ─────────────────
function PassportDetailModal({ file, onClose }: { file: PassportFile; onClose: () => void }) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const iframeRef                     = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    axios
      .get<string>(
        `${BASE_URL}/api/employees/passeports/${file.slug}/html/?token=${token}`,
        { headers: authHeaders(), responseType: "text" }
      )
      .then((r) => setHtmlContent(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [file.slug]);

  // Ajuste la hauteur de l'iframe à son contenu réel
  const onIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc && iframeRef.current) {
        iframeRef.current.style.height = doc.documentElement.scrollHeight + "px";
      }
    } catch {}
  };

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-2"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[98vw] max-h-[98vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#003c71]/10">
              <BookUser size={16} className="text-[#003c71]" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">{file.nom_prenom || file.display_name}</p>
              <p className="text-xs text-gray-400">Passeport Sécurité CAMUSAT</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {htmlContent && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition"
              >
                <Printer size={13} />
                Imprimer
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {loading && (
            <div className="flex justify-center py-20">
              <ImSpinner2 className="animate-spin text-[#003c71]" size={32} />
            </div>
          )}
          {error && (
            <div className="text-center py-20 text-gray-400">
              <BookUser size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Impossible de charger la fiche.</p>
            </div>
          )}
          {htmlContent && (
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              className="w-full border-0 min-h-[600px]"
              title={file.display_name}
              onLoad={onIframeLoad}
              sandbox="allow-same-origin allow-scripts allow-modals"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal Gérer ───────────────────────────────────────────────────────────────
function GestionModal({
  file, hasQr, onClose, onVoirDetail, onQrGenerated, onDelete,
}: {
  file: PassportFile;
  hasQr: boolean;
  onClose: () => void;
  onVoirDetail: () => void;
  onQrGenerated: (slug: string) => void;
  onDelete: () => void;
}) {
  const [showQr, setShowQr] = useState(hasQr);
  const qrCanvasId = `qr-canvas-${file.slug}`;
  const qrValue = `${BASE_URL}/api/employees/passeports/${file.slug}/pdf/`;

  const handleGenerate = () => {
    setShowQr(true);
    onQrGenerated(file.slug);
  };

  const downloadQr = () => {
    const canvas = document.getElementById(qrCanvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `QR_${file.display_name}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#003c71]/10 text-[#003c71] flex items-center justify-center font-bold text-sm">
              {(file.nom_prenom || file.display_name).split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm leading-tight">{file.nom_prenom || file.display_name}</p>
              <p className="text-xs text-gray-400">Passeport Sécurité</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          {/* Voir le détail */}
          <button
            onClick={onVoirDetail}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-[#003c71] hover:bg-[#003c71]/5 transition group text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-[#003c71]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#003c71]/20 transition">
              <BookUser size={15} className="text-[#003c71]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Voir le détail</p>
              <p className="text-xs text-gray-400">Afficher la fiche passeport complète</p>
            </div>
          </button>

          {/* Générer / Régénérer QR */}
          <button
            onClick={handleGenerate}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-[#003c71] hover:bg-[#003c71]/5 transition group text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition">
              {showQr ? <RefreshCcw size={15} className="text-purple-600" /> : <QrCode size={15} className="text-purple-600" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">
                {showQr ? "Régénérer le code QR" : "Générer le code QR"}
              </p>
              <p className="text-xs text-gray-400">Créer un QR vers la fiche passeport</p>
            </div>
            {hasQr && !showQr && (
              <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
            )}
          </button>

          {/* QR affiché */}
          {showQr && (
            <div className="flex items-center gap-4 px-4 py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm flex-shrink-0">
                <QRCodeCanvas id={qrCanvasId} value={qrValue} size={90} level="H" marginSize={1} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700">QR généré</p>
                <p className="text-[10px] text-gray-400 break-all mt-1">{qrValue}</p>
                <button
                  onClick={downloadQr}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-[#003c71] text-white text-xs rounded-lg hover:bg-[#003c71]/90 font-medium transition"
                >
                  <Download size={11} />
                  Télécharger
                </button>
              </div>
            </div>
          )}

          {/* Supprimer */}
          <div className="pt-1 border-t border-gray-100">
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-100 hover:border-red-300 hover:bg-red-50 transition group text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition">
                <Trash2 size={15} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-500">Supprimer</p>
                <p className="text-xs text-gray-400">Retirer ce passeport du serveur</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bouton upload dossier ─────────────────────────────────────────────────────
function UploadButton({ onUploaded }: { onUploaded: (r: UploadResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = async (fileList: FileList) => {
    const files = Array.from(fileList).filter((f) =>
      /\.(xlsx|xls)$/i.test(f.name)
    );
    if (files.length === 0) {
      toast.error("Aucun fichier Excel (.xlsx) trouvé dans le dossier.");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const result = await passportService.upload(files, setProgress);
      toast.success(`${result.extracted.length} passeport(s) importé(s).`);
      onUploaded(result);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de l'import.");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        // @ts-ignore — webkitdirectory n'est pas dans les types React mais supporté par tous les navigateurs modernes
        webkitdirectory=""
        multiple
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
      />
      <button
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-70"
      >
        {uploading
          ? <><ImSpinner2 className="animate-spin" size={15} />{progress}%</>
          : <><Upload size={15} />Importer le dossier</>
        }
      </button>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PassportManagementPage() {
  const [files, setFiles] = useState<PassportFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [manageFile, setManageFile]     = useState<PassportFile | null>(null);
  const [detailFile, setDetailFile]     = useState<PassportFile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PassportFile | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [qrGenerated, setQrGenerated]   = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try { setFiles(await passportService.getAll()); }
    catch (e: any) { toast.error(e?.response?.data?.error || "Erreur lors du chargement."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const filtered = files.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return f.display_name.toLowerCase().includes(q) || f.nom_prenom.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleUploaded = (result: UploadResult) => { setFiles(result.files); setPage(1); };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await passportService.deleteFile(deleteConfirm.slug);
      setFiles((prev) => prev.filter((f) => f.slug !== deleteConfirm.slug));
      toast.success("Fichier supprimé.");
      setManageFile(null);
    } catch { toast.error("Erreur lors de la suppression."); }
    finally { setDeleting(false); setDeleteConfirm(null); }
  };

  return (
    <ManagerLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#003c71]/10">
            <BookUser size={24} className="text-[#003c71]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Gestion des Passeports Sécurité</h1>
            <p className="text-sm text-gray-500">
              Importez un dossier ZIP · Consultez les fiches · Générez des QR codes
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <UploadButton onUploaded={handleUploaded} />
            <button onClick={load} className="p-2 rounded-lg border bg-white hover:bg-gray-50 transition" title="Rafraîchir">
              <RefreshCw size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Recherche */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom…"
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#003c71]/20 focus:border-[#003c71] outline-none" />
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {filtered.length} passeport{filtered.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16">
            <ImSpinner2 className="animate-spin text-[#003c71]" size={32} />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookUser size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucun passeport — importez un ZIP pour commencer</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun résultat pour « {search} »</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* En-têtes */}
              <div className="flex items-center gap-3 px-4 py-2 border-b bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <span className="w-6 flex-shrink-0" />
                <span className="w-8 flex-shrink-0" />
                <span className="flex-1">Nom / Prénom</span>
                <span className="w-20 text-right flex-shrink-0">Actions</span>
              </div>

              {paginated.map((file, idx) => {
                const hasQr = qrGenerated.has(file.slug);
                return (
                  <div
                    key={file.slug}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-[#003c71]/5 transition ${
                      idx !== paginated.length - 1 ? "border-b border-gray-100" : ""
                    }`}
                  >
                    <span className="text-xs text-gray-300 w-6 text-right flex-shrink-0 font-mono">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-[#003c71]/10 text-[#003c71] flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {(file.nom_prenom || file.display_name).split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                    </div>
                    <p className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">
                      {file.nom_prenom || file.display_name}
                    </p>
                    {hasQr && (
                      <span className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5 flex-shrink-0">
                        <QrCode size={10} />QR
                      </span>
                    )}
                    <button
                      onClick={() => setManageFile(file)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#003c71] text-white text-xs font-medium hover:bg-[#003c71]/90 transition flex-shrink-0"
                    >
                      <Settings2 size={13} />Gérer
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Page {page} / {totalPages} · {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <ChevronLeft size={16} className="text-gray-600" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce<(number | "…")[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span key={`e-${i}`} className="px-2 text-gray-400 text-sm">…</span>
                      ) : (
                        <button key={p} onClick={() => setPage(p as number)}
                          className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition border ${
                            page === p ? "bg-[#003c71] text-white border-[#003c71]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                          }`}>
                          {p}
                        </button>
                      )
                    )}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <ChevronRight size={16} className="text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Gérer */}
      {manageFile && (
        <GestionModal
          file={manageFile}
          hasQr={qrGenerated.has(manageFile.slug)}
          onClose={() => setManageFile(null)}
          onVoirDetail={() => { setDetailFile(manageFile); setManageFile(null); }}
          onQrGenerated={(slug) => setQrGenerated((prev) => new Set(prev).add(slug))}
          onDelete={() => { setDeleteConfirm(manageFile); setManageFile(null); }}
        />
      )}

      {/* Modal Détail */}
      {detailFile && (
        <PassportDetailModal file={detailFile} onClose={() => setDetailFile(null)} />
      )}

      {/* Confirmation suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-[#003c71] mb-2">Supprimer le passeport ?</h3>
            <p className="text-sm text-gray-600 mb-5">
              <span className="font-semibold">{deleteConfirm.nom_prenom || deleteConfirm.display_name}</span> sera définitivement supprimé.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50 flex items-center gap-2">
                {deleting ? <ImSpinner2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
