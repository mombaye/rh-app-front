// src/pages/hse/PassportManagementPage.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { BookUser, Search, RefreshCw, X, ChevronLeft, ChevronRight, QrCode, Download, Printer, Upload, Check, Stamp, Plus, Filter, ShieldCheck, ShieldAlert, PenLine, Trash2 } from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import { QRCodeCanvas } from "qrcode.react";
import toast from "react-hot-toast";
import ManagerLayout from "@/layouts/ManagerLayout";
import { passportService, PassportFile, PassportCheckbox, PassportDateField } from "@/services/passportService";

const PAGE_SIZE = 10;

// ── Cache module-level des images de page 0 (persistant entre renders) ──────
// slug → blob URL de la page 0 rendue en PNG
const _page0Cache = new Map<string, string>();
// slugs dont le préchargement est en cours (éviter doublons)
const _prefetchingSet = new Set<string>();

async function _prefetchPage0(slug: string) {
  if (_page0Cache.has(slug) || _prefetchingSet.has(slug)) return;
  _prefetchingSet.add(slug);
  try {
    const { blob } = await passportService.getPageImage(slug, 0, 0);
    _page0Cache.set(slug, URL.createObjectURL(blob));
  } catch { /* silencieux */ } finally {
    _prefetchingSet.delete(slug);
  }
}

// Précharge les slugs visibles avec max 4 requêtes en parallèle
function prefetchVisible(slugs: string[]) {
  const todo = slugs.filter((s) => !_page0Cache.has(s) && !_prefetchingSet.has(s));
  if (todo.length === 0) return;
  // Par lots de 4
  const CONCURRENCY = 4;
  let i = 0;
  const next = () => {
    if (i >= todo.length) return;
    const slug = todo[i++];
    _prefetchPage0(slug).then(next);
  };
  for (let k = 0; k < Math.min(CONCURRENCY, todo.length); k++) next();
}

// ── URL publique QR ──────────────────────────────────────────────────────────
// En dev  : IP réseau locale injectée par Vite + port courant
//           → le téléphone sur le même WiFi atteint le serveur Vite
//             qui proxyfie /api vers localhost:8030
// En prod : domaine fixe
// ── Cache module-level du cachet global ─────────────────────────────────────
let _cachetBlobUrl: string | null = null;
let _cachetFetchPromise: Promise<string | null> | null = null;

async function _ensureCachetLoaded(): Promise<string | null> {
  if (_cachetBlobUrl) return _cachetBlobUrl;
  if (_cachetFetchPromise) return _cachetFetchPromise;
  _cachetFetchPromise = passportService.getCachet()
    .then((blob) => { _cachetBlobUrl = URL.createObjectURL(blob); return _cachetBlobUrl; })
    .catch(() => null)
    .finally(() => { _cachetFetchPromise = null; });
  return _cachetFetchPromise;
}

function _invalidateCachetCache() {
  if (_cachetBlobUrl) URL.revokeObjectURL(_cachetBlobUrl);
  _cachetBlobUrl = null;
  _cachetFetchPromise = null;
}

declare const __LOCAL_NETWORK_IP__: string;
const QR_API_BASE = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD
    ? ""
    : `http://${__LOCAL_NETWORK_IP__}:${window.location.port || 5173}`);
const qrScanUrl = (slug: string) =>
  `${QR_API_BASE}/api/employees/passeports/${slug}/pdf/scan/`;

// ── Modal QR Code ─────────────────────────────────────────────────────────────
function QrModal({ file, alreadyGenerated, onGenerated, onClose }: {
  file: PassportFile;
  alreadyGenerated: boolean;
  onGenerated: (slug: string) => void;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(alreadyGenerated);
  const [saving, setSaving] = useState(false);
  const canvasId = `qr-${file.slug}`;
  const url = qrScanUrl(file.slug);

  const download = () => {
    const qr = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!qr) return;

    const name = file.nom_prenom || file.display_name;
    const padding  = 16;
    const fontSize = 15;
    const lineHeight = fontSize + 8;

    // Nouveau canvas = CAMUSAT + QR + nom
    const out = document.createElement("canvas");
    out.width  = qr.width + padding * 2;
    out.height = qr.height + lineHeight * 2 + padding * 2;

    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);

    // CAMUSAT en haut
    ctx.fillStyle = "#003c71";
    ctx.font      = `bold ${fontSize + 2}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("CAMUSAT", out.width / 2, padding + fontSize);

    // QR
    ctx.drawImage(qr, padding, padding + lineHeight);

    // Nom en bas
    ctx.fillStyle = "#111827";
    ctx.font      = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(name, out.width / 2, padding + lineHeight + qr.height + lineHeight - 4);

    const a = document.createElement("a");
    a.download = `QR_${name}.png`;
    a.href = out.toDataURL("image/png");
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50">
              <QrCode size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{file.nom_prenom || file.display_name}</p>
              <p className="text-xs text-gray-400">Passeport Sécurité — QR Code</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {!confirmed ? (
            /* Confirmation */
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mx-auto">
                <QrCode size={28} className="text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Générer le code QR ?</p>
                <p className="text-xs text-gray-400 mt-1">
                  Le QR permettra d'ouvrir le passeport PDF de{" "}
                  <span className="font-medium text-gray-600">{file.nom_prenom || file.display_name}</span>{" "}
                  depuis n'importe quel appareil photo.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition"
                >
                  Annuler
                </button>
                <button
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await passportService.markQrGenerated(file.slug);
                      setConfirmed(true);
                      onGenerated(file.slug);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition disabled:opacity-60"
                >
                  {saving ? "..." : "Générer"}
                </button>
              </div>
            </div>
          ) : (
            /* QR affiché */
            <div className="text-center space-y-4">
              <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm gap-2">
                <p className="text-base font-extrabold text-[#003c71] tracking-widest uppercase">
                  CAMUSAT
                </p>
                <QRCodeCanvas id={canvasId} value={url} size={180} level="H" marginSize={1} />
                <p className="text-sm font-bold text-gray-800 text-center tracking-wide">
                  {file.nom_prenom || file.display_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 break-all">{url}</p>
              </div>
              <button
                onClick={download}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#003c71] hover:bg-[#003c71]/90 text-white text-sm font-medium transition"
              >
                <Download size={14} />
                Télécharger le QR
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Photo de profil cliquable ─────────────────────────────────────────────────
function PassportPhoto({ slug, name }: { slug: string; name: string }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passportService.getPhoto(slug)
      .then((blob) => setPhotoUrl(URL.createObjectURL(blob)))
      .catch(() => setPhotoUrl(null));
  }, [slug]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await passportService.uploadPhoto(slug, file);
      setPhotoUrl(URL.createObjectURL(file));
      toast.success("Photo enregistrée");
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Cliquer pour changer la photo"
        className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#003c71]/20 hover:border-[#003c71] transition group flex-shrink-0"
      >
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#003c71]/10 flex items-center justify-center text-[#003c71] font-bold text-xl">
            {initials}
          </div>
        )}
        {/* Overlay au survol */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          {uploading
            ? <ImSpinner2 className="animate-spin text-white" size={18} />
            : <Upload size={18} className="text-white" />}
        </div>
      </button>
      <span className="text-[10px] text-gray-400">Cliquer pour modifier</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ── Types drag photo / cachet ─────────────────────────────────────────────────
type DragMode = "move" | "tl" | "tr" | "bl" | "br";
type PhotoPos = { x: number; y: number; w: number; h: number }; // en % de l'image
type CachetItem = { id: string; pos: PhotoPos };

// ── Modal Détail — PDF rendu en image + placement photo + cachets ─────────────
function PassportDetailModal({ file, onClose }: { file: PassportFile; onClose: () => void }) {
  const cached0 = _page0Cache.get(file.slug);
  const [pages, setPages]         = useState<string[]>(cached0 ? [cached0] : []);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading]     = useState(!cached0);
  const [error, setError]         = useState<string | null>(null);
  const [cacheKey, setCacheKey]   = useState(0);

  // Mode placement photo
  const [placingPhoto, setPlacingPhoto] = useState<{
    file: File;
    previewUrl: string;
    pos: PhotoPos;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Mode placement cachets (deux types)
  type CachetType = "entreprise" | "conduite_defensive";
  const [cachetEntrepriseUrl, setCachetEntrepriseUrl] = useState<string | null>(null);
  const [cachetConduiteUrl, setCachetConduiteUrl]     = useState<string | null>(null);
  const [activeCachetType, setActiveCachetType]       = useState<CachetType | null>(null);
  const [cachetItems, setCachetItems]     = useState<CachetItem[]>([]);
  const [savingCachets, setSavingCachets] = useState(false);
  const cachetDragRef = useRef<{ id: string; mode: DragMode; sx: number; sy: number; sp: PhotoPos } | null>(null);
  const placingCachets = cachetItems.length > 0;
  const cachetBlobUrl = activeCachetType === "conduite_defensive" ? cachetConduiteUrl : cachetEntrepriseUrl;

  // Confirmations de suppression globale
  const [confirmDelete, setConfirmDelete] = useState<"photo" | "signature" | "cachets" | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Cachets déjà intégrés (overlays sélectionnables)
  const [appliedCachets, setAppliedCachets] = useState<{ idx: number; x_pct: number; y_pct: number; w_pct: number; h_pct: number }[]>([]);
  const [selectedCachetIdx, setSelectedCachetIdx] = useState<number | null>(null);
  const [deletingCachetIdx, setDeletingCachetIdx] = useState<number | null>(null);

  // Mode placement signature
  const [placingSig, setPlacingSig] = useState<{
    file: File;
    previewUrl: string;
    pos: PhotoPos;
  } | null>(null);
  const [savingSig, setSavingSig] = useState(false);
  const sigDragRef = useRef<{ mode: DragMode; sx: number; sy: number; sp: PhotoPos } | null>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef      = useRef<{ mode: DragMode; sx: number; sy: number; sp: PhotoPos } | null>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Checkboxes interactives
  const [checkboxes, setCheckboxes] = useState<PassportCheckbox[]>([]);
  const [togglingCb, setTogglingCb] = useState<string | null>(null);

  // Autorisation employeur
  const [autorisationDate, setAutorisationDate] = useState("");
  const [autorisationSigUrl, setAutorisationSigUrl] = useState<string | null>(null);

  // Mode placement autorisation (drag & drop date + sig)
  const [placingAutorisation, setPlacingAutorisation] = useState<{
    column: "th" | "el";
    date: string;
    pos: PhotoPos;
  } | null>(null);
  const [savingAutorisation, setSavingAutorisation] = useState(false);
  const autorisationDragRef = useRef<{ mode: DragMode; sx: number; sy: number; sp: PhotoPos } | null>(null);

  // Champs de date interactifs
  const [dateFields, setDateFields] = useState<PassportDateField[]>([]);
  const [editingDate, setEditingDate] = useState<{ id: string; value: string } | null>(null);
  const [savingDate, setSavingDate] = useState(false);

  // Charger les deux cachets + signature autorisation au montage
  useEffect(() => {
    passportService.getCachet("entreprise")
      .then((blob) => setCachetEntrepriseUrl(URL.createObjectURL(blob)))
      .catch(() => {});
    passportService.getCachet("conduite_defensive")
      .then((blob) => setCachetConduiteUrl(URL.createObjectURL(blob)))
      .catch(() => {});
    passportService.getAutorisationSig()
      .then((blob) => setAutorisationSigUrl(URL.createObjectURL(blob)))
      .catch(() => {});
  }, []);

  // Charger les checkboxes au montage
  useEffect(() => {
    passportService.getCheckboxes(file.slug).then(setCheckboxes).catch(() => {});
  }, [file.slug]);

  // Charger les champs de date au montage
  useEffect(() => {
    passportService.getDateFields(file.slug).then(setDateFields).catch(() => {});
  }, [file.slug]);

  // Charger les cachets intégrés
  const reloadAppliedCachets = () => {
    passportService.getAppliedCachets(file.slug).then(setAppliedCachets).catch(() => setAppliedCachets([]));
  };
  useEffect(() => { reloadAppliedCachets(); }, [file.slug]);

  const handleCheckboxClick = async (cb: PassportCheckbox) => {
    if (togglingCb || placingPhoto || placingCachets || placingSig || placingAutorisation) return;
    const isAutorise = cb.id === "th_oui" || cb.id === "el_oui";

    // Cocher une case autorisation → entrer en mode placement drag & drop
    if (isAutorise && !cb.checked) {
      const column = cb.id === "th_oui" ? "th" : "el";
      setPlacingAutorisation({ column, date: autorisationDate, pos: { x: 5, y: 75, w: 28, h: 12 } });
      return;
    }

    // Décocher ou case normale → appel backend direct
    setTogglingCb(cb.id);
    try {
      const res = await passportService.toggleCheckbox(file.slug, cb.id);
      setCheckboxes((prev) => prev.map((c) => c.id === cb.id ? { ...c, checked: res.checked } : c));
      _page0Cache.delete(file.slug);
      const newKey = cacheKey + 1;
      setCacheKey(newKey);
      setPages([]);
      await loadPage(0, newKey);
    } catch {
      toast.error("Impossible de mettre à jour la case.");
    } finally {
      setTogglingCb(null);
    }
  };

  const handleDateSave = async () => {
    if (!editingDate || savingDate) return;
    // Convertir AAAA-MM-JJ (format input[type=date]) → MM/JJ/AAAA
    const parts = editingDate.value.split("-");
    const formatted = parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : editingDate.value;
    setSavingDate(true);
    try {
      await passportService.updateDateField(file.slug, editingDate.id, formatted);
      setDateFields((prev) =>
        prev.map((d) => d.id === editingDate.id ? { ...d, value: formatted, overridden: true } : d)
      );
      setEditingDate(null);
      // Recharger l'image PDF
      _page0Cache.delete(file.slug);
      const newKey = cacheKey + 1;
      setCacheKey(newKey);
      setPages([]);
      await loadPage(0, newKey);
    } catch {
      toast.error("Impossible de mettre à jour la date.");
    } finally {
      setSavingDate(false);
    }
  };

  // ── Chargement pages PDF via service (token toujours frais) ───────────────
  const loadPage = async (pageNum: number, key = cacheKey) => {
    if (pageNum === 0 && key === 0 && _page0Cache.has(file.slug)) {
      setPages((p) => { const n = [...p]; n[0] = _page0Cache.get(file.slug)!; return n; });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { blob, pageCount: pc } = await passportService.getPageImage(file.slug, pageNum, key);
      setPageCount(pc);
      const url = URL.createObjectURL(blob);
      if (pageNum === 0 && key === 0) _page0Cache.set(file.slug, url);
      setPages((p) => { const n = [...p]; n[pageNum] = url; return n; });
    } catch (e: any) {
      setError(e?.response?.status ? `HTTP ${e.response.status}` : e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPage(0); }, [file.slug]);
  useEffect(() => { if (!pages[currentPage]) loadPage(currentPage); }, [currentPage]);

  // ── Drag & resize ───────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d || !containerRef.current) return;
    const cr  = containerRef.current.getBoundingClientRect();
    const dx  = (e.clientX - d.sx) / cr.width  * 100;
    const dy  = (e.clientY - d.sy) / cr.height * 100;
    const p   = d.sp;
    const MIN = 4;

    setPlacingPhoto((prev) => {
      if (!prev) return prev;
      let { x, y, w, h } = p;
      if (d.mode === "move") {
        x = Math.max(0, Math.min(100 - w, p.x + dx));
        y = Math.max(0, Math.min(100 - h, p.y + dy));
      } else if (d.mode === "br") {
        w = Math.max(MIN, Math.min(100 - p.x, p.w + dx));
        h = Math.max(MIN, Math.min(100 - p.y, p.h + dy));
      } else if (d.mode === "bl") {
        const nw = Math.max(MIN, p.w - dx);
        x = p.x + p.w - nw; w = nw;
        h = Math.max(MIN, Math.min(100 - p.y, p.h + dy));
      } else if (d.mode === "tr") {
        w = Math.max(MIN, Math.min(100 - p.x, p.w + dx));
        const nh = Math.max(MIN, p.h - dy);
        y = p.y + p.h - nh; h = nh;
      } else if (d.mode === "tl") {
        const nw = Math.max(MIN, p.w - dx); x = p.x + p.w - nw; w = nw;
        const nh = Math.max(MIN, p.h - dy); y = p.y + p.h - nh; h = nh;
      }
      return { ...prev, pos: { x, y, w, h } };
    });
  }, []);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    if (!placingPhoto) return;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",  onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",  onMouseUp);
    };
  }, [placingPhoto, onMouseMove, onMouseUp]);

  const startDrag = (mode: DragMode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!placingPhoto) return;
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, sp: { ...placingPhoto.pos } };
  };

  // ── Drag & resize cachets ───────────────────────────────────────────────────
  const onCachetMouseMove = useCallback((e: MouseEvent) => {
    const d = cachetDragRef.current;
    if (!d || !containerRef.current) return;
    const cr = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / cr.width  * 100;
    const dy = (e.clientY - d.sy) / cr.height * 100;
    const p  = d.sp;
    const MIN = 3;
    setCachetItems((prev) => prev.map((c) => {
      if (c.id !== d.id) return c;
      let { x, y, w, h } = p;
      if (d.mode === "move") {
        x = Math.max(0, Math.min(100 - w, p.x + dx));
        y = Math.max(0, Math.min(100 - h, p.y + dy));
      } else if (d.mode === "br") {
        w = Math.max(MIN, Math.min(100 - p.x, p.w + dx));
        h = Math.max(MIN, Math.min(100 - p.y, p.h + dy));
      } else if (d.mode === "bl") {
        const nw = Math.max(MIN, p.w - dx); x = p.x + p.w - nw; w = nw;
        h = Math.max(MIN, Math.min(100 - p.y, p.h + dy));
      } else if (d.mode === "tr") {
        w = Math.max(MIN, Math.min(100 - p.x, p.w + dx));
        const nh = Math.max(MIN, p.h - dy); y = p.y + p.h - nh; h = nh;
      } else if (d.mode === "tl") {
        const nw = Math.max(MIN, p.w - dx); x = p.x + p.w - nw; w = nw;
        const nh = Math.max(MIN, p.h - dy); y = p.y + p.h - nh; h = nh;
      }
      return { ...c, pos: { x, y, w, h } };
    }));
  }, []);

  const onCachetMouseUp = useCallback(() => { cachetDragRef.current = null; }, []);

  useEffect(() => {
    if (!placingCachets) return;
    window.addEventListener("mousemove", onCachetMouseMove);
    window.addEventListener("mouseup",  onCachetMouseUp);
    return () => {
      window.removeEventListener("mousemove", onCachetMouseMove);
      window.removeEventListener("mouseup",  onCachetMouseUp);
    };
  }, [placingCachets, onCachetMouseMove, onCachetMouseUp]);

  const startCachetDrag = (id: string, mode: DragMode, e: React.MouseEvent, pos: PhotoPos) => {
    e.preventDefault();
    e.stopPropagation();
    cachetDragRef.current = { id, mode, sx: e.clientX, sy: e.clientY, sp: { ...pos } };
  };

  // ── Drag & resize signature ─────────────────────────────────────────────────
  const onSigMouseMove = useCallback((e: MouseEvent) => {
    const d = sigDragRef.current;
    if (!d || !containerRef.current) return;
    const cr  = containerRef.current.getBoundingClientRect();
    const dx  = (e.clientX - d.sx) / cr.width  * 100;
    const dy  = (e.clientY - d.sy) / cr.height * 100;
    const p   = d.sp;
    const MIN = 4;
    setPlacingSig((prev) => {
      if (!prev) return prev;
      let { x, y, w, h } = p;
      if (d.mode === "move") {
        x = Math.max(0, Math.min(100 - w, p.x + dx));
        y = Math.max(0, Math.min(100 - h, p.y + dy));
      } else if (d.mode === "br") {
        w = Math.max(MIN, Math.min(100 - p.x, p.w + dx));
        h = Math.max(MIN, Math.min(100 - p.y, p.h + dy));
      } else if (d.mode === "bl") {
        const nw = Math.max(MIN, p.w - dx); x = p.x + p.w - nw; w = nw;
        h = Math.max(MIN, Math.min(100 - p.y, p.h + dy));
      } else if (d.mode === "tr") {
        w = Math.max(MIN, Math.min(100 - p.x, p.w + dx));
        const nh = Math.max(MIN, p.h - dy); y = p.y + p.h - nh; h = nh;
      } else if (d.mode === "tl") {
        const nw = Math.max(MIN, p.w - dx); x = p.x + p.w - nw; w = nw;
        const nh = Math.max(MIN, p.h - dy); y = p.y + p.h - nh; h = nh;
      }
      return { ...prev, pos: { x, y, w, h } };
    });
  }, []);

  const onSigMouseUp = useCallback(() => { sigDragRef.current = null; }, []);

  useEffect(() => {
    if (!placingSig) return;
    window.addEventListener("mousemove", onSigMouseMove);
    window.addEventListener("mouseup",  onSigMouseUp);
    return () => {
      window.removeEventListener("mousemove", onSigMouseMove);
      window.removeEventListener("mouseup",  onSigMouseUp);
    };
  }, [placingSig, onSigMouseMove, onSigMouseUp]);

  const startSigDrag = (mode: DragMode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!placingSig) return;
    sigDragRef.current = { mode, sx: e.clientX, sy: e.clientY, sp: { ...placingSig.pos } };
  };

  // ── Drag & resize autorisation ──────────────────────────────────────────────
  const onAutorisationMouseMove = useCallback((e: MouseEvent) => {
    const d = autorisationDragRef.current;
    if (!d || !containerRef.current) return;
    const cr  = containerRef.current.getBoundingClientRect();
    const dx  = (e.clientX - d.sx) / cr.width  * 100;
    const dy  = (e.clientY - d.sy) / cr.height * 100;
    const p   = d.sp;
    const MIN = 4;
    setPlacingAutorisation((prev) => {
      if (!prev) return prev;
      let { x, y, w, h } = p;
      if (d.mode === "move") {
        x = Math.max(0, Math.min(100 - w, p.x + dx));
        y = Math.max(0, Math.min(100 - h, p.y + dy));
      } else if (d.mode === "br") {
        w = Math.max(MIN, Math.min(100 - p.x, p.w + dx));
        h = Math.max(MIN, Math.min(100 - p.y, p.h + dy));
      } else if (d.mode === "bl") {
        const nw = Math.max(MIN, p.w - dx); x = p.x + p.w - nw; w = nw;
        h = Math.max(MIN, Math.min(100 - p.y, p.h + dy));
      } else if (d.mode === "tr") {
        w = Math.max(MIN, Math.min(100 - p.x, p.w + dx));
        const nh = Math.max(MIN, p.h - dy); y = p.y + p.h - nh; h = nh;
      } else if (d.mode === "tl") {
        const nw = Math.max(MIN, p.w - dx); x = p.x + p.w - nw; w = nw;
        const nh = Math.max(MIN, p.h - dy); y = p.y + p.h - nh; h = nh;
      }
      return { ...prev, pos: { x, y, w, h } };
    });
  }, []);

  const onAutorisationMouseUp = useCallback(() => { autorisationDragRef.current = null; }, []);

  useEffect(() => {
    if (!placingAutorisation) return;
    window.addEventListener("mousemove", onAutorisationMouseMove);
    window.addEventListener("mouseup",  onAutorisationMouseUp);
    return () => {
      window.removeEventListener("mousemove", onAutorisationMouseMove);
      window.removeEventListener("mouseup",  onAutorisationMouseUp);
    };
  }, [placingAutorisation, onAutorisationMouseMove, onAutorisationMouseUp]);

  const startAutorisationDrag = (mode: DragMode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!placingAutorisation) return;
    autorisationDragRef.current = { mode, sx: e.clientX, sy: e.clientY, sp: { ...placingAutorisation.pos } };
  };

  const handleValidateAutorisation = async () => {
    if (!placingAutorisation) return;
    setSavingAutorisation(true);
    try {
      await passportService.toggleCheckbox(
        file.slug,
        placingAutorisation.column === "th" ? "th_oui" : "el_oui",
        placingAutorisation.date
      );
      await passportService.applyAutorisation(
        file.slug,
        placingAutorisation.column,
        placingAutorisation.date,
        placingAutorisation.pos
      );
      setCheckboxes((prev) =>
        prev.map((c) =>
          c.id === (placingAutorisation.column === "th" ? "th_oui" : "el_oui")
            ? { ...c, checked: true }
            : c
        )
      );
      _page0Cache.delete(file.slug);
      const newKey = cacheKey + 1;
      setCacheKey(newKey);
      setPages([]);
      setPlacingAutorisation(null);
      await loadPage(0, newKey);
      toast.success("Autorisation appliquée !");
    } catch {
      toast.error("Erreur lors de l'application de l'autorisation.");
    } finally {
      setSavingAutorisation(false);
    }
  };

  const handleSigFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPlacingSig({
      file: f,
      previewUrl: URL.createObjectURL(f),
      pos: { x: 5, y: 60, w: 20, h: 10 },
    });
    e.target.value = "";
  };

  const handleValidateSig = async () => {
    if (!placingSig) return;
    setSavingSig(true);
    try {
      await passportService.uploadSignature(file.slug, placingSig.file);
      await passportService.embedSignature(file.slug, placingSig.pos, currentPage);
      _page0Cache.delete(file.slug);
      const newKey = cacheKey + 1;
      setCacheKey(newKey);
      setPages([]);
      setPlacingSig(null);
      await loadPage(currentPage, newKey);
      toast.success("Signature intégrée dans le passeport !");
    } catch {
      toast.error("Erreur lors de l'intégration de la signature");
    } finally {
      setSavingSig(false);
    }
  };

  const handleDelete = async (type: "photo" | "signature" | "cachets") => {
    setDeleting(true);
    try {
      if (type === "photo")     await passportService.deletePhoto(file.slug);
      if (type === "signature") await passportService.deleteSignature(file.slug);
      if (type === "cachets")   await passportService.deleteCachets(file.slug);
      _page0Cache.delete(file.slug);
      const newKey = cacheKey + 1;
      setCacheKey(newKey);
      setPages([]);
      setConfirmDelete(null);
      await loadPage(currentPage, newKey);
      toast.success(`${type === "photo" ? "Photo" : type === "signature" ? "Signature" : "Cachets"} supprimé(s) du passeport`);
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCachetIdx = async (idx: number) => {
    setDeletingCachetIdx(idx);
    try {
      await passportService.deleteCachetIdx(file.slug, idx);
      _page0Cache.delete(file.slug);
      const newKey = cacheKey + 1;
      setCacheKey(newKey);
      setPages([]);
      setSelectedCachetIdx(null);
      reloadAppliedCachets();
      await loadPage(currentPage, newKey);
      toast.success("Cachet supprimé");
    } catch {
      toast.error("Erreur lors de la suppression du cachet");
    } finally {
      setDeletingCachetIdx(null);
    }
  };

  const addCachet = (type: CachetType) => {
    setActiveCachetType(type);
    setCachetItems((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), pos: { x: 5, y: 68, w: 20, h: 14 } },
    ]);
  };

  const handleValidateCachets = async () => {
    if (cachetItems.length === 0 || !activeCachetType) return;
    setSavingCachets(true);
    try {
      await passportService.applyCachetMulti(
        file.slug,
        cachetItems.map(({ pos }) => ({ x_pct: pos.x, y_pct: pos.y, w_pct: pos.w, h_pct: pos.h })),
        activeCachetType
      );
      _page0Cache.delete(file.slug);
      const newKey = cacheKey + 1;
      setCacheKey(newKey);
      setPages([]);
      setCachetItems([]);
      setActiveCachetType(null);
      reloadAppliedCachets();
      await loadPage(0, newKey);
      toast.success("Cachets intégrés dans le passeport !");
    } catch {
      toast.error("Erreur lors de l'intégration des cachets");
    } finally {
      setSavingCachets(false);
    }
  };

  // ── Sélection fichier ───────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPlacingPhoto({
      file: f,
      previewUrl: URL.createObjectURL(f),
      pos: { x: 5, y: 8, w: 14, h: 18 }, // position initiale en haut à gauche
    });
    e.target.value = "";
  };

  // ── Validation → embed dans le PDF via service (token toujours frais) ──────
  const handleValidate = async () => {
    if (!placingPhoto) return;
    setSaving(true);
    try {
      await passportService.embedPhoto(file.slug, placingPhoto.file, placingPhoto.pos);
      _page0Cache.delete(file.slug);
      const newKey = cacheKey + 1;
      setCacheKey(newKey);
      setPages([]);
      setPlacingPhoto(null);
      await loadPage(0, newKey);
      toast.success("Photo intégrée dans le passeport !");
    } catch {
      toast.error("Erreur lors de l'intégration de la photo");
    } finally {
      setSaving(false);
    }
  };

  const pageUrl = pages[currentPage];

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-2"
      onClick={placingPhoto || placingSig ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[98vh] flex flex-col overflow-hidden"
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
              <p className="text-xs text-gray-400">
                {placingPhoto
                  ? "Glissez la photo au bon endroit, redimensionnez via les coins, puis validez"
                  : placingCachets
                  ? `Cachet ${activeCachetType === "conduite_defensive" ? "conduite défensive" : "entreprise"} — glissez, redimensionnez, supprimez avec ×, puis validez`
                  : placingSig
                  ? "Glissez la signature au bon endroit, redimensionnez via les coins, puis validez"
                  : placingAutorisation
                  ? `Autorisation ${placingAutorisation.column.toUpperCase()} — glissez la zone date+signature au bon endroit, puis validez`
                  : "Passeport Sécurité CAMUSAT"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navigation pages — masquée en mode placement */}
            {!placingPhoto && !placingCachets && !placingSig && !placingAutorisation && pageCount > 1 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                  <ChevronLeft size={14} />
                </button>
                <span>{currentPage + 1} / {pageCount}</span>
                <button onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))} disabled={currentPage === pageCount - 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Boutons normaux — hors mode placement */}
            {!placingPhoto && !placingCachets && !placingSig && !placingAutorisation && (
              <>
                {/* Date autorisation */}
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Date autor.</label>
                  <input
                    type="date"
                    value={autorisationDate}
                    onChange={(e) => setAutorisationDate(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#003c71]/40 w-32"
                  />
                </div>

                {/* Photo + supprimer */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => { setConfirmDelete(null); inputRef.current?.click(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg border border-purple-200 text-purple-600 bg-purple-50 text-xs font-medium hover:bg-purple-100 transition"
                  >
                    <Upload size={13} />
                    Photo
                  </button>
                  {confirmDelete === "photo" ? (
                    <span className="flex items-center gap-1 px-2 py-1.5 border border-red-300 bg-red-50 rounded-r-lg text-xs">
                      <span className="text-red-600 font-medium">Supprimer ?</span>
                      <button onClick={() => handleDelete("photo")} disabled={deleting}
                        className="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50">
                        {deleting ? "…" : "Oui"}
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300">
                        Non
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete("photo")}
                      className="px-2 py-1.5 rounded-r-lg border border-purple-200 text-purple-400 bg-purple-50 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Signature + supprimer */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => { setConfirmDelete(null); sigInputRef.current?.click(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg border border-blue-200 text-blue-600 bg-blue-50 text-xs font-medium hover:bg-blue-100 transition"
                  >
                    <PenLine size={13} />
                    Signature
                  </button>
                  {confirmDelete === "signature" ? (
                    <span className="flex items-center gap-1 px-2 py-1.5 border border-red-300 bg-red-50 rounded-r-lg text-xs">
                      <span className="text-red-600 font-medium">Supprimer ?</span>
                      <button onClick={() => handleDelete("signature")} disabled={deleting}
                        className="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50">
                        {deleting ? "…" : "Oui"}
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300">
                        Non
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete("signature")}
                      className="px-2 py-1.5 rounded-r-lg border border-blue-200 text-blue-400 bg-blue-50 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Cachet Entreprise — toujours visible */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => { setConfirmDelete(null); addCachet("entreprise"); }}
                    disabled={!cachetEntrepriseUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg border border-amber-200 text-amber-700 bg-amber-50 text-xs font-medium hover:bg-amber-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    title={cachetEntrepriseUrl ? "Cachet entreprise" : "Aucun cachet entreprise configuré"}
                  >
                    <Stamp size={13} />
                    Cachet Entr.
                  </button>
                  {confirmDelete === "cachets" ? (
                    <span className="flex items-center gap-1 px-2 py-1.5 border border-red-300 bg-red-50 rounded-r-lg text-xs">
                      <span className="text-red-600 font-medium">Supprimer tous ?</span>
                      <button onClick={() => handleDelete("cachets")} disabled={deleting}
                        className="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50">
                        {deleting ? "…" : "Oui"}
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300">
                        Non
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete("cachets")}
                      className="px-2 py-1.5 rounded-r-lg border border-amber-200 text-amber-400 bg-amber-50 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Cachet Conduite Défensive — toujours visible */}
                <button
                  onClick={() => { setConfirmDelete(null); addCachet("conduite_defensive"); }}
                  disabled={!cachetConduiteUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 text-orange-700 bg-orange-50 text-xs font-medium hover:bg-orange-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title={cachetConduiteUrl ? "Cachet conduite défensive" : "Aucun cachet conduite défensive configuré"}
                >
                  <Stamp size={13} />
                  Conduite Déf.
                </button>
              </>
            )}

            {/* Actions mode placement photo */}
            {placingPhoto && (
              <>
                <button
                  onClick={() => setPlacingPhoto(null)}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition disabled:opacity-50"
                >
                  <X size={13} /> Annuler
                </button>
                <button
                  onClick={handleValidate}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition disabled:opacity-60"
                >
                  {saving ? <ImSpinner2 className="animate-spin" size={13} /> : <Check size={13} />}
                  Valider la photo
                </button>
              </>
            )}

            {/* Actions mode placement cachets */}
            {placingCachets && (
              <>
                <button
                  onClick={addCachet}
                  disabled={savingCachets}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-50 transition disabled:opacity-50"
                >
                  <Plus size={13} /> Ajouter
                </button>
                <button
                  onClick={() => { setCachetItems([]); setActiveCachetType(null); }}
                  disabled={savingCachets}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition disabled:opacity-50"
                >
                  <X size={13} /> Annuler
                </button>
                <button
                  onClick={handleValidateCachets}
                  disabled={savingCachets}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition disabled:opacity-60"
                >
                  {savingCachets ? <ImSpinner2 className="animate-spin" size={13} /> : <Check size={13} />}
                  Valider ({cachetItems.length})
                </button>
              </>
            )}

            {/* Actions mode placement signature */}
            {placingSig && (
              <>
                <button
                  onClick={() => setPlacingSig(null)}
                  disabled={savingSig}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition disabled:opacity-50"
                >
                  <X size={13} /> Annuler
                </button>
                <button
                  onClick={handleValidateSig}
                  disabled={savingSig}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {savingSig ? <ImSpinner2 className="animate-spin" size={13} /> : <Check size={13} />}
                  Valider la signature
                </button>
              </>
            )}

            {/* Actions mode placement autorisation */}
            {placingAutorisation && (
              <>
                <button
                  onClick={() => setPlacingAutorisation(null)}
                  disabled={savingAutorisation}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition disabled:opacity-50"
                >
                  <X size={13} /> Annuler
                </button>
                <button
                  onClick={handleValidateAutorisation}
                  disabled={savingAutorisation}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {savingAutorisation ? <ImSpinner2 className="animate-spin" size={13} /> : <Check size={13} />}
                  Valider l'autorisation
                </button>
              </>
            )}

            {!placingPhoto && !placingCachets && !placingSig && !placingAutorisation && (
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
          {loading && !pageUrl ? (
            <div className="flex items-center justify-center h-64">
              <ImSpinner2 className="animate-spin text-[#003c71]" size={32} />
            </div>
          ) : error ? (
            <div className="text-center text-gray-400 h-64 flex flex-col items-center justify-center">
              <BookUser size={36} className="mb-3 opacity-30" />
              <p className="text-sm">{error}</p>
            </div>
          ) : pageUrl ? (
            <div
              ref={containerRef}
              className="relative inline-block shadow-lg select-none"
            >
              <img
                src={pageUrl}
                alt={`Page ${currentPage + 1}`}
                className="max-w-full block"
                style={{ maxHeight: "calc(98vh - 140px)" }}
                draggable={false}
              />

              {/* ── Overlays cachets draggables ── */}
              {placingCachets && cachetBlobUrl && cachetItems.map((item) => (
                <div
                  key={item.id}
                  onMouseDown={(e) => startCachetDrag(item.id, "move", e, item.pos)}
                  style={{
                    position: "absolute",
                    left:   `${item.pos.x}%`,
                    top:    `${item.pos.y}%`,
                    width:  `${item.pos.w}%`,
                    height: `${item.pos.h}%`,
                    cursor: "move",
                    boxSizing: "border-box",
                  }}
                  className="border-2 border-amber-500 shadow-xl"
                >
                  <img
                    src={cachetBlobUrl}
                    alt="cachet"
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
                    draggable={false}
                  />
                  {/* Bouton supprimer */}
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setCachetItems((p) => p.filter((c) => c.id !== item.id)); }}
                    className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs leading-none hover:bg-red-600 z-10"
                    style={{ pointerEvents: "auto" }}
                  >
                    ×
                  </button>
                  {/* Poignées de redimensionnement */}
                  {([
                    ["tl", "-top-1.5 -left-1.5",   "cursor-nw-resize"],
                    ["tr", "-top-1.5 -right-1.5",  "cursor-ne-resize"],
                    ["bl", "-bottom-1.5 -left-1.5", "cursor-sw-resize"],
                    ["br", "-bottom-1.5 -right-1.5","cursor-se-resize"],
                  ] as const).map(([mode, pos, cur]) => (
                    <div
                      key={mode}
                      onMouseDown={(e) => startCachetDrag(item.id, mode, e, item.pos)}
                      className={`absolute ${pos} w-3.5 h-3.5 bg-white border-2 border-amber-500 rounded-sm ${cur}`}
                    />
                  ))}
                </div>
              ))}

              {/* ── Overlays cases à cocher (page 0) ── */}
              {currentPage === 0 && !placingPhoto && !placingCachets && !placingAutorisation && checkboxes.map((cb) => {
                const cx = cb.x_pct + cb.w_pct / 2;
                const cy = cb.y_pct + cb.h_pct / 2;
                const isToggling = togglingCb === cb.id;
                return (
                  <div
                    key={cb.id}
                    onClick={() => handleCheckboxClick(cb)}
                    title={`${cb.label} — cliquer pour ${cb.checked ? "décocher" : "cocher"}`}
                    style={{
                      position: "absolute",
                      left: `${cx}%`,
                      top: `${cy}%`,
                      transform: "translate(-50%, -50%)",
                      minWidth: "22px",
                      minHeight: "22px",
                      cursor: isToggling ? "wait" : "pointer",
                      zIndex: 20,
                      boxSizing: "border-box",
                      borderRadius: "3px",
                      opacity: isToggling ? 0.5 : 1,
                      transition: "opacity 0.15s, background-color 0.15s",
                      border: cb.checked
                        ? "2px solid rgba(20,40,140,0.7)"      /* bleu marine si coché */
                        : "2px dashed rgba(59,130,246,0.5)",   /* bleu pointillé si vide */
                      backgroundColor: cb.checked
                        ? "rgba(20,40,140,0.12)"
                        : "rgba(59,130,246,0.04)",
                    }}
                  />
                );
              })}

              {/* ── Overlays champs de date ── */}
              {currentPage === 0 && !placingPhoto && !placingCachets && !placingSig && !placingAutorisation && dateFields.map((df) => {
                const isEditing = editingDate?.id === df.id;
                return (
                  <div
                    key={df.id}
                    style={{
                      position: "absolute",
                      left:   `${df.x_pct}%`,
                      top:    `${df.y_pct}%`,
                      width:  `${df.w_pct}%`,
                      height: `${df.h_pct}%`,
                      zIndex: 25,
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Zone cliquable */}
                    {!isEditing && (
                      <div
                        onClick={() => {
                          // Convertir MM/JJ/AAAA → AAAA-MM-JJ pour l'input[type=date]
                          const p = df.value.split("/");
                          const iso = p.length === 3 ? `${p[2]}-${p[0].padStart(2,"0")}-${p[1].padStart(2,"0")}` : "";
                          setEditingDate({ id: df.id, value: iso });
                        }}
                        title={`Date : ${df.value} — cliquer pour modifier`}
                        style={{
                          width: "100%",
                          height: "100%",
                          cursor: "pointer",
                          border: df.overridden
                            ? "2px solid rgba(22,163,74,0.6)"
                            : "2px dashed rgba(234,179,8,0.5)",
                          borderRadius: "2px",
                          backgroundColor: df.overridden
                            ? "rgba(22,163,74,0.08)"
                            : "rgba(234,179,8,0.05)",
                        }}
                      />
                    )}

                    {/* Popup d'édition */}
                    {isEditing && (
                      <div
                        style={{
                          position: "absolute",
                          top: "120%",
                          left: "0",
                          zIndex: 50,
                          background: "white",
                          border: "1px solid #d1d5db",
                          borderRadius: "8px",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                          padding: "10px 12px",
                          minWidth: "200px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "2px" }}>
                          Modifier la date
                        </div>
                        <input
                          type="date"
                          value={editingDate.value}
                          onChange={(e) => setEditingDate({ id: df.id, value: e.target.value })}
                          style={{
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            padding: "4px 8px",
                            fontSize: "13px",
                            width: "100%",
                          }}
                          autoFocus
                        />
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => setEditingDate(null)}
                            style={{
                              padding: "3px 10px",
                              fontSize: "12px",
                              border: "1px solid #d1d5db",
                              borderRadius: "4px",
                              background: "white",
                              cursor: "pointer",
                            }}
                          >
                            Annuler
                          </button>
                          <button
                            onClick={handleDateSave}
                            disabled={savingDate || !editingDate.value}
                            style={{
                              padding: "3px 10px",
                              fontSize: "12px",
                              border: "none",
                              borderRadius: "4px",
                              background: savingDate ? "#9ca3af" : "#2563eb",
                              color: "white",
                              cursor: savingDate ? "wait" : "pointer",
                            }}
                          >
                            {savingDate ? "…" : "Valider"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Overlays cachets déjà intégrés (sélectionnables pour suppression) ── */}
              {!placingPhoto && !placingCachets && !placingSig && !placingAutorisation && currentPage === 0 &&
                appliedCachets.map((c) => {
                  const isSelected = selectedCachetIdx === c.idx;
                  const isDeleting = deletingCachetIdx === c.idx;
                  const imgUrl = c.cachet_type === "conduite_defensive" ? cachetConduiteUrl : cachetEntrepriseUrl;
                  return (
                    <div
                      key={c.idx}
                      onClick={(e) => { e.stopPropagation(); setSelectedCachetIdx(isSelected ? null : c.idx); setConfirmDelete(null); }}
                      style={{
                        position: "absolute",
                        left:   `${c.x_pct}%`,
                        top:    `${c.y_pct}%`,
                        width:  `${c.w_pct}%`,
                        height: `${c.h_pct}%`,
                        cursor: "pointer",
                        boxSizing: "border-box",
                        border: isSelected ? "2px solid #ef4444" : "2px dashed transparent",
                        borderRadius: "2px",
                        transition: "border-color 0.15s",
                      }}
                      className={isSelected ? "shadow-lg" : "hover:border-dashed hover:border-red-300"}
                    >
                      {/* Image cachet semi-transparente pour visualiser */}
                      {imgUrl && (
                        <img
                          src={imgUrl}
                          alt="cachet"
                          style={{ width: "100%", height: "100%", objectFit: "contain", opacity: isSelected ? 0.7 : 0.3, pointerEvents: "none", display: "block" }}
                          draggable={false}
                        />
                      )}
                      {/* Popup suppression */}
                      {isSelected && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: "absolute", top: "-36px", left: "50%", transform: "translateX(-50%)", zIndex: 30 }}
                          className="flex items-center gap-1 px-2 py-1 bg-white border border-red-300 rounded-lg shadow-lg text-xs whitespace-nowrap"
                        >
                          <Trash2 size={11} className="text-red-500" />
                          <span className="text-red-600 font-medium">Supprimer ?</span>
                          <button
                            onClick={() => handleDeleteCachetIdx(c.idx)}
                            disabled={isDeleting}
                            className="px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 font-medium"
                          >
                            {isDeleting ? "…" : "Oui"}
                          </button>
                          <button
                            onClick={() => setSelectedCachetIdx(null)}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          >
                            Non
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              }

              {/* ── Overlay signature draggable ── */}
              {placingSig && (
                <div
                  onMouseDown={(e) => startSigDrag("move", e)}
                  style={{
                    position: "absolute",
                    left:   `${placingSig.pos.x}%`,
                    top:    `${placingSig.pos.y}%`,
                    width:  `${placingSig.pos.w}%`,
                    height: `${placingSig.pos.h}%`,
                    cursor: "move",
                    boxSizing: "border-box",
                  }}
                  className="border-2 border-blue-500 shadow-xl"
                >
                  <img
                    src={placingSig.previewUrl}
                    alt="signature à placer"
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
                    draggable={false}
                  />
                  {([
                    ["tl", "-top-1.5 -left-1.5",   "cursor-nw-resize"],
                    ["tr", "-top-1.5 -right-1.5",  "cursor-ne-resize"],
                    ["bl", "-bottom-1.5 -left-1.5", "cursor-sw-resize"],
                    ["br", "-bottom-1.5 -right-1.5","cursor-se-resize"],
                  ] as const).map(([mode, pos, cur]) => (
                    <div
                      key={mode}
                      onMouseDown={(e) => startSigDrag(mode, e)}
                      className={`absolute ${pos} w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-sm ${cur}`}
                    />
                  ))}
                </div>
              )}

              {/* ── Overlay autorisation draggable (date + sig employeur) ── */}
              {placingAutorisation && (
                <div
                  onMouseDown={(e) => startAutorisationDrag("move", e)}
                  style={{
                    position: "absolute",
                    left:   `${placingAutorisation.pos.x}%`,
                    top:    `${placingAutorisation.pos.y}%`,
                    width:  `${placingAutorisation.pos.w}%`,
                    height: `${placingAutorisation.pos.h}%`,
                    cursor: "move",
                    boxSizing: "border-box",
                    zIndex: 30,
                  }}
                  className="border-2 border-indigo-500 shadow-xl rounded-sm"
                >
                  {/* Aperçu : date en haut, sig en dessous */}
                  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", pointerEvents: "none", overflow: "hidden" }}>
                    {placingAutorisation.date && (
                      <div style={{
                        fontSize: "min(1.8vh, 9px)",
                        color: "#14228c",
                        padding: "1px 3px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}>
                        {placingAutorisation.date}
                      </div>
                    )}
                    {autorisationSigUrl && (
                      <img
                        src={autorisationSigUrl}
                        alt="sig autorisation"
                        style={{ flex: 1, objectFit: "contain", display: "block", minHeight: 0 }}
                        draggable={false}
                      />
                    )}
                    {!autorisationSigUrl && (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: "min(1.5vh, 8px)", color: "#6366f1" }}>
                        sig. autorisation
                      </div>
                    )}
                  </div>
                  {/* Poignées */}
                  {([
                    ["tl", "-top-1.5 -left-1.5",    "cursor-nw-resize"],
                    ["tr", "-top-1.5 -right-1.5",   "cursor-ne-resize"],
                    ["bl", "-bottom-1.5 -left-1.5",  "cursor-sw-resize"],
                    ["br", "-bottom-1.5 -right-1.5", "cursor-se-resize"],
                  ] as const).map(([mode, pos, cur]) => (
                    <div
                      key={mode}
                      onMouseDown={(e) => startAutorisationDrag(mode, e)}
                      className={`absolute ${pos} w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-sm ${cur}`}
                    />
                  ))}
                </div>
              )}

              {/* ── Overlay photo draggable ── */}
              {placingPhoto && (
                <div
                  onMouseDown={(e) => startDrag("move", e)}
                  style={{
                    position: "absolute",
                    left:   `${placingPhoto.pos.x}%`,
                    top:    `${placingPhoto.pos.y}%`,
                    width:  `${placingPhoto.pos.w}%`,
                    height: `${placingPhoto.pos.h}%`,
                    cursor: "move",
                    boxSizing: "border-box",
                  }}
                  className="border-2 border-purple-500 shadow-xl"
                >
                  <img
                    src={placingPhoto.previewUrl}
                    alt="photo à placer"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                    draggable={false}
                  />
                  {/* Poignées de redimensionnement aux 4 coins */}
                  {([
                    ["tl", "-top-1.5 -left-1.5",  "cursor-nw-resize"],
                    ["tr", "-top-1.5 -right-1.5", "cursor-ne-resize"],
                    ["bl", "-bottom-1.5 -left-1.5","cursor-sw-resize"],
                    ["br", "-bottom-1.5 -right-1.5","cursor-se-resize"],
                  ] as const).map(([mode, pos, cur]) => (
                    <div
                      key={mode}
                      onMouseDown={(e) => startDrag(mode, e)}
                      className={`absolute ${pos} w-3.5 h-3.5 bg-white border-2 border-purple-500 rounded-sm ${cur}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <input ref={sigInputRef} type="file" accept="image/*" className="hidden" onChange={handleSigFileSelect} />
      </div>
    </div>
  );
}

// ── Modal Génération QR en masse ─────────────────────────────────────────────
function BulkGenerateModal({
  files,
  alreadyGenerated,
  onDone,
  onClose,
}: {
  files: PassportFile[];
  alreadyGenerated: Set<string>;
  onDone: (newSlugs: string[]) => void;
  onClose: () => void;
}) {
  const [mode, setMode]       = useState<"choose" | "select">("choose");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const notYet = files.filter((f) => !alreadyGenerated.has(f.slug));
  const filtered = notYet.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (f.nom_prenom || f.display_name).toLowerCase().includes(q);
  });

  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });

  const generate = async (slugs: string[]) => {
    if (slugs.length === 0) return;
    setLoading(true);
    setProgress(50);
    try {
      await passportService.markQrGeneratedBulk(slugs);
      setProgress(100);
      onDone(slugs);
    } catch {
      // fallback séquentiel si le bulk échoue
      const done: string[] = [];
      for (let i = 0; i < slugs.length; i++) {
        try { await passportService.markQrGenerated(slugs[i]); done.push(slugs[i]); } catch { /* skip */ }
        setProgress(Math.round(((i + 1) / slugs.length) * 100));
      }
      setLoading(false);
      onDone(done);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50"><QrCode size={16} className="text-purple-600" /></div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Générer QR en masse</p>
              <p className="text-xs text-gray-400">
                {notYet.length} passeport{notYet.length !== 1 ? "s" : ""} sans QR
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {loading ? (
          /* Barre de progression */
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mx-auto">
              <QrCode size={28} className="text-purple-500 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Génération en cours…</p>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-400">{progress}%</p>
          </div>
        ) : mode === "choose" ? (
          /* Choix : Tous ou Sélectionner */
          <div className="p-5 space-y-3">
            <>
              <button
                onClick={() => generate(files.map((f) => f.slug))}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition">
                  <QrCode size={18} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Tous les membres</p>
                  <p className="text-xs text-gray-400">
                    Générer pour les {files.length} passeports
                    {notYet.length < files.length ? ` (${notYet.length} restants, ${files.length - notYet.length} déjà faits)` : ""}
                  </p>
                </div>
              </button>

              <button
                onClick={() => setMode("select")}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-gray-200 hover:border-[#003c71] hover:bg-[#003c71]/5 transition text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#003c71]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#003c71]/20 transition">
                  <BookUser size={18} className="text-[#003c71]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Sélectionner des membres</p>
                  <p className="text-xs text-gray-400">Choisir manuellement qui générer</p>
                </div>
              </button>
            </>
          </div>
        ) : (
          /* Sélection individuelle */
          <div className="flex flex-col" style={{ maxHeight: "70vh" }}>
            {/* Barre recherche + tout cocher */}
            <div className="px-4 py-3 border-b space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((f) => selected.has(f.slug))}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(filtered.map((f) => f.slug)));
                      else setSelected(new Set());
                    }}
                    className="accent-purple-600"
                  />
                  Tout sélectionner ({filtered.length})
                </label>
                <span className="text-xs text-purple-600 font-medium">{selected.size} sélectionné{selected.size !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Liste */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {filtered.map((f) => (
                <label key={f.slug} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(f.slug)}
                    onChange={() => toggle(f.slug)}
                    className="accent-purple-600 flex-shrink-0"
                  />
                  <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {(f.nom_prenom || f.display_name).split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-800 truncate">{f.nom_prenom || f.display_name}</span>
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-6">Aucun résultat</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t flex gap-2">
              <button onClick={() => { setMode("choose"); setSelected(new Set()); setSearch(""); }}
                className="flex-1 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition">
                Retour
              </button>
              <button
                disabled={selected.size === 0}
                onClick={() => generate([...selected])}
                className="flex-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition disabled:opacity-40"
              >
                Générer ({selected.size})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal Export QR en masse ─────────────────────────────────────────────────
function BulkQrModal({
  files, generated, onClose,
}: {
  files: PassportFile[];
  generated: Set<string>;
  onClose: () => void;
}) {
  const items = files.filter((f) => generated.has(f.slug));
  const hiddenRef = useRef<HTMLDivElement>(null);

  const buildQrCanvas = (slug: string, name: string): Promise<HTMLCanvasElement> =>
    new Promise((resolve) => {
      const src = document.getElementById(`bulk-qr-${slug}`) as HTMLCanvasElement | null;
      if (!src) { resolve(document.createElement("canvas")); return; }

      const pad = 14; const fs = 14; const lh = fs + 8;
      const out = document.createElement("canvas");
      out.width  = src.width + pad * 2;
      out.height = src.height + lh * 2 + pad * 2;
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, out.width, out.height);
      ctx.fillStyle = "#003c71"; ctx.font = `bold ${fs + 2}px Arial`; ctx.textAlign = "center";
      ctx.fillText("CAMUSAT", out.width / 2, pad + fs);
      ctx.drawImage(src, pad, pad + lh);
      ctx.fillStyle = "#111827"; ctx.font = `bold ${fs}px Arial`;
      ctx.fillText(name, out.width / 2, pad + lh + src.height + lh - 4);
      resolve(out);
    });

  const handleDownload = async () => {
    if (items.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("QR_Passeports_CAMUSAT")!;

    for (const f of items) {
      const name = f.nom_prenom || f.display_name;
      const qr   = await buildQrCanvas(f.slug, name);
      // Convertir le canvas en blob PNG
      const blob: Blob = await new Promise((res) =>
        qr.toBlob((b) => res(b!), "image/png")
      );
      // Nom du fichier = nom du technicien
      const safeName = name.replace(/[/\\?%*:|"<>]/g, "_");
      folder.file(`${safeName}.png`, blob);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.download = `QR_Passeports_CAMUSAT_${new Date().toLocaleDateString("fr").replace(/\//g, "-")}.zip`;
    a.href = URL.createObjectURL(content);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const canvases = items.map((f) => {
      const c = document.getElementById(`bulk-qr-${f.slug}`) as HTMLCanvasElement | null;
      return { name: f.nom_prenom || f.display_name, src: c?.toDataURL("image/png") || "" };
    });

    win.document.write(`<!DOCTYPE html><html><head><title>QR Passeports CAMUSAT</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #fff; }
      .grid { display: flex; flex-wrap: wrap; gap: 0; }
      .card { width: 33.33%; box-sizing: border-box; padding: 16px;
              display: flex; flex-direction: column; align-items: center;
              border: 0.5px solid #e5e7eb; page-break-inside: avoid; }
      .brand { font-size: 14px; font-weight: 900; color: #003c71;
               letter-spacing: 4px; margin-bottom: 8px; }
      img { width: 140px; height: 140px; }
      .name { font-size: 11px; font-weight: 700; color: #111827;
              text-align: center; margin-top: 8px; }
      @media print { @page { margin: 8mm; } }
    </style></head><body>
    <div class="grid">${canvases.map(({ name, src }) =>
      `<div class="card">
        <div class="brand">CAMUSAT</div>
        <img src="${src}" />
        <div class="name">${name}</div>
      </div>`
    ).join("")}</div>
    <script>window.onload=()=>{ window.print(); }<\/script>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50"><QrCode size={16} className="text-purple-600" /></div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">QR Codes générés</p>
              <p className="text-xs text-gray-400">{items.length} passeport{items.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <QrCode size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun QR code généré pour l'instant.</p>
            <p className="text-xs mt-1">Cliquez sur "Générer QR" sur les lignes.</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {/* Télécharger */}
            <button onClick={handleDownload}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-gray-200 hover:border-[#003c71] hover:bg-[#003c71]/5 transition text-left group">
              <div className="w-10 h-10 rounded-xl bg-[#003c71]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#003c71]/20 transition">
                <Download size={18} className="text-[#003c71]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Télécharger les QR codes</p>
                <p className="text-xs text-gray-400">Image PNG — {items.length} QR en grille 3 par ligne</p>
              </div>
            </button>

            {/* Imprimer */}
            <button onClick={handlePrint}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition text-left group">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition">
                <Printer size={18} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Imprimer les QR codes</p>
                <p className="text-xs text-gray-400">Format papier — 3 par ligne, optimisé impression</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* QR rendus en arrière-plan pour capture canvas */}
      <div ref={hiddenRef} style={{ position: "absolute", left: -9999, top: -9999 }}>
        {items.map((f) => (
          <QRCodeCanvas key={f.slug} id={`bulk-qr-${f.slug}`}
            value={qrScanUrl(f.slug)} size={140} level="H" marginSize={1} />
        ))}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PassportManagementPage() {
  const [files, setFiles] = useState<PassportFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailFile, setDetailFile]   = useState<PassportFile | null>(null);
  const [qrFile, setQrFile]           = useState<PassportFile | null>(null);
  const [qrGenerated, setQrGenerated] = useState<Set<string>>(new Set());
  const [showBulkQr, setShowBulkQr]               = useState(false);
  const [showBulkGenerate, setShowBulkGenerate]   = useState(false);
  const [showResetConfirm, setShowResetConfirm]   = useState(false);
  const [resetting, setResetting]                 = useState(false);
  const [uploadingCachet, setUploadingCachet]     = useState(false);
  const [uploadingCachetType, setUploadingCachetType] = useState<"entreprise" | "conduite_defensive" | null>(null);
  const [showCachetUploadModal, setShowCachetUploadModal] = useState(false);
  const [previewEntrepriseUrl, setPreviewEntrepriseUrl] = useState<string | null>(null);
  const [previewConduiteUrl, setPreviewConduiteUrl]     = useState<string | null>(null);
  const [sigFilter, setSigFilter] = useState<"all" | "complete" | "incomplete">("all");
  const [uploadingAutorisationSig, setUploadingAutorisationSig] = useState(false);
  const autorisationSigInputRef = useRef<HTMLInputElement>(null);
  const cachetInputRef = useRef<HTMLInputElement>(null);
  const cachetConduiteInputRef = useRef<HTMLInputElement>(null);

  const handleCachetUpload = async (e: React.ChangeEvent<HTMLInputElement>, cachetType: "entreprise" | "conduite_defensive" = "entreprise") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCachet(true);
    setUploadingCachetType(cachetType);
    // Prévisualiser immédiatement le fichier choisi
    const localUrl = URL.createObjectURL(file);
    if (cachetType === "entreprise") setPreviewEntrepriseUrl(localUrl);
    else setPreviewConduiteUrl(localUrl);
    e.target.value = "";
    try {
      await passportService.uploadCachet(file, cachetType);
      _invalidateCachetCache();
      const label = cachetType === "conduite_defensive" ? "Conduite Défensive" : "Entreprise";
      toast.success(`Cachet ${label} uploadé avec succès.`);
    } catch {
      toast.error("Erreur lors de l'upload du cachet");
    } finally {
      setUploadingCachet(false);
      setUploadingCachetType(null);
    }
  };

  const handleAutorisationSigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAutorisationSig(true);
    try {
      await passportService.uploadAutorisationSig(file);
      toast.success("Signature autorisation uploadée.");
    } catch {
      toast.error("Erreur lors de l'upload de la signature autorisation.");
    } finally {
      setUploadingAutorisationSig(false);
    }
  };

  const handleResetAll = async () => {
    setResetting(true);
    try {
      const res = await passportService.resetAll();
      // Vider tous les caches locaux (pages PDF rendues + cachet)
      _page0Cache.clear();
      _invalidateCachetCache();
      setQrGenerated(new Set());
      toast.success(`Réinitialisé : ${res.deleted_pdfs} PDF et ${(res as any).deleted_photos ?? 0} photo(s) supprimé(s).`);
      setShowResetConfirm(false);
      await load();
    } catch {
      toast.error("Erreur lors de la réinitialisation.");
    } finally {
      setResetting(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await passportService.getAll();
      setFiles(data);
      setQrGenerated(new Set(data.filter((f) => f.qr_generated).map((f) => f.slug)));
    }
    catch (e: any) { toast.error(e?.response?.data?.error || "Erreur lors du chargement."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, sigFilter]);

  // Charger les previews des cachets au montage
  useEffect(() => {
    passportService.getCachet("entreprise")
      .then((blob) => setPreviewEntrepriseUrl(URL.createObjectURL(blob)))
      .catch(() => {});
    passportService.getCachet("conduite_defensive")
      .then((blob) => setPreviewConduiteUrl(URL.createObjectURL(blob)))
      .catch(() => {});
  }, []);

  const filtered = files.filter((f) => {
    if (search) {
      const q = search.toLowerCase();
      if (!f.display_name.toLowerCase().includes(q) && !f.nom_prenom.toLowerCase().includes(q)) return false;
    }
    if (sigFilter === "complete" && !f.has_all_signatures) return false;
    if (sigFilter === "incomplete" && f.has_all_signatures) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
              Dossier réseau · Consultez les fiches · Générez des QR codes
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Upload cachet global */}
            <button
              onClick={() => setShowCachetUploadModal(true)}
              disabled={uploadingCachet}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-60"
            >
              {uploadingCachet ? <ImSpinner2 className="animate-spin" size={15} /> : <Stamp size={15} />}
              {uploadingCachet
                ? uploadingCachetType === "conduite_defensive" ? "Conduite Déf…" : "Entreprise…"
                : "Upload cachet"}
            </button>
            {/* Upload signature autorisation employeur */}
            <button
              onClick={() => autorisationSigInputRef.current?.click()}
              disabled={uploadingAutorisationSig}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#003c71]/30 bg-[#003c71]/10 text-[#003c71] text-sm font-medium hover:bg-[#003c71]/20 transition disabled:opacity-60"
              title="Uploader la signature autorisation employeur"
            >
              {uploadingAutorisationSig ? <ImSpinner2 className="animate-spin" size={15} /> : <PenLine size={15} />}
              Sig. Autorisation
            </button>
            <input ref={autorisationSigInputRef} type="file" accept="image/*" className="hidden" onChange={handleAutorisationSigUpload} />

            <input ref={cachetInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCachetUpload(e, "entreprise")} />
            <input ref={cachetConduiteInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCachetUpload(e, "conduite_defensive")} />

            {files.length > 0 && (
              <button
                onClick={() => setShowBulkGenerate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 transition"
              >
                <QrCode size={15} />
                Générer QR en masse
              </button>
            )}
            {qrGenerated.size > 0 && (
              <button
                onClick={() => setShowBulkQr(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                <QrCode size={15} />
                QR Codes ({qrGenerated.size})
              </button>
            )}
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition"
            >
              <RefreshCw size={15} />
              Réinitialiser
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-60"
            >
              {loading ? <ImSpinner2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
              Synchroniser
            </button>
          </div>
        </div>

        {/* Recherche + Filtres */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom…"
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#003c71]/20 focus:border-[#003c71] outline-none" />
            </div>

            {/* Filtre signatures */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSigFilter("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  sigFilter === "all"
                    ? "bg-white text-gray-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Filter size={12} />
                Tous
              </button>
              <button
                onClick={() => setSigFilter("complete")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  sigFilter === "complete"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-emerald-600"
                }`}
              >
                <ShieldCheck size={12} />
                4 signatures
              </button>
              <button
                onClick={() => setSigFilter("incomplete")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  sigFilter === "incomplete"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-amber-500"
                }`}
              >
                <ShieldAlert size={12} />
                Incomplets
              </button>
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
            <p className="text-sm">Aucun passeport trouvé dans le dossier réseau.</p>
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
                <span className="w-24 text-right flex-shrink-0" />
              </div>

              {paginated.map((file, idx) => (
                <div
                  key={file.slug}
                  onMouseEnter={() => _prefetchPage0(file.slug)}
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {file.nom_prenom || file.display_name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {(["sig_th", "sig_el", "sig_ps", "sig_af"] as const).map((key) => {
                        const labels: Record<string, string> = { sig_th: "TH", sig_el: "EL", sig_ps: "PS", sig_af: "AF" };
                        const ok = file[key] as boolean;
                        return (
                          <span key={key} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            ok ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                          }`}>
                            {labels[key]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setQrFile(file)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 bg-purple-50 text-xs font-medium hover:bg-purple-100 transition"
                    >
                      <QrCode size={13} />
                      {qrGenerated.has(file.slug) ? "Voir QR" : "Générer QR"}
                    </button>
                    <button
                      onClick={() => setDetailFile(file)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#003c71] text-white text-xs font-medium hover:bg-[#003c71]/90 transition"
                    >
                      <BookUser size={13} />Voir le détail
                    </button>
                  </div>
                </div>
              ))}
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


{/* Modal génération QR en masse */}
      {showBulkGenerate && (
        <BulkGenerateModal
          files={files}
          alreadyGenerated={qrGenerated}
          onDone={(newSlugs) => {
            setQrGenerated((prev) => {
              const next = new Set(prev);
              newSlugs.forEach((s) => next.add(s));
              return next;
            });
            setShowBulkGenerate(false);
            toast.success(`${newSlugs.length} QR code${newSlugs.length > 1 ? "s" : ""} généré${newSlugs.length > 1 ? "s" : ""} !`);
          }}
          onClose={() => setShowBulkGenerate(false)}
        />
      )}

      {/* Modal export QR en masse */}
      {showBulkQr && (
        <BulkQrModal files={files} generated={qrGenerated} onClose={() => setShowBulkQr(false)} />
      )}

      {/* Modal QR individuel */}
      {qrFile && (
        <QrModal
          file={qrFile}
          alreadyGenerated={qrGenerated.has(qrFile.slug)}
          onGenerated={(slug) => setQrGenerated((prev) => new Set(prev).add(slug))}
          onClose={() => setQrFile(null)}
        />
      )}

      {/* Modal Détail */}
      {detailFile && (
        <PassportDetailModal file={detailFile} onClose={() => setDetailFile(null)} />
      )}

      {/* ── Modal Upload Cachet ──────────────────────────────────────────── */}
      {showCachetUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => !uploadingCachet && setShowCachetUploadModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#003c71]">
                <Stamp size={20} />
                <h2 className="text-lg font-bold">Upload du cachet</h2>
              </div>
              <button
                onClick={() => setShowCachetUploadModal(false)}
                disabled={uploadingCachet}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Choisissez le type de cachet à uploader. Il sera automatiquement appliqué sur les passeports ayant 4 signatures.
            </p>

            {/* Cachet Entreprise */}
            {/* Cachet Entreprise */}
            <div className="border border-amber-200 rounded-xl p-4 flex gap-4 bg-amber-50 items-center">
              {/* Prévisualisation */}
              <div className="shrink-0 w-20 h-20 rounded-lg border border-amber-200 bg-white flex items-center justify-center overflow-hidden">
                {uploadingCachet && uploadingCachetType === "entreprise"
                  ? <ImSpinner2 className="animate-spin text-amber-400" size={24} />
                  : previewEntrepriseUrl
                    ? <img src={previewEntrepriseUrl} alt="Cachet entreprise" className="w-full h-full object-contain p-1" />
                    : <Stamp size={28} className="text-amber-200" />}
              </div>
              {/* Infos + bouton */}
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Stamp size={15} className="text-amber-600" />
                  <span className="font-semibold text-amber-800 text-sm">Cachet Entreprise</span>
                  {previewEntrepriseUrl && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Configuré</span>}
                </div>
                <p className="text-xs text-amber-700">Cachet officiel de la société, appliqué sur les passeports validés.</p>
                <button
                  onClick={() => cachetInputRef.current?.click()}
                  disabled={uploadingCachet}
                  className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition disabled:opacity-60"
                >
                  <Upload size={13} />
                  {previewEntrepriseUrl ? "Remplacer" : "Choisir un fichier"}
                </button>
              </div>
            </div>

            {/* Cachet Conduite Défensive */}
            <div className="border border-orange-200 rounded-xl p-4 flex gap-4 bg-orange-50 items-center">
              {/* Prévisualisation */}
              <div className="shrink-0 w-20 h-20 rounded-lg border border-orange-200 bg-white flex items-center justify-center overflow-hidden">
                {uploadingCachet && uploadingCachetType === "conduite_defensive"
                  ? <ImSpinner2 className="animate-spin text-orange-400" size={24} />
                  : previewConduiteUrl
                    ? <img src={previewConduiteUrl} alt="Cachet conduite" className="w-full h-full object-contain p-1" />
                    : <Stamp size={28} className="text-orange-200" />}
              </div>
              {/* Infos + bouton */}
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Stamp size={15} className="text-orange-600" />
                  <span className="font-semibold text-orange-800 text-sm">Conduite Défensive</span>
                  {previewConduiteUrl && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Configuré</span>}
                </div>
                <p className="text-xs text-orange-700">Cachet spécifique à la formation conduite défensive.</p>
                <button
                  onClick={() => cachetConduiteInputRef.current?.click()}
                  disabled={uploadingCachet}
                  className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition disabled:opacity-60"
                >
                  <Upload size={13} />
                  {previewConduiteUrl ? "Remplacer" : "Choisir un fichier"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Réinitialiser tout ─────────────────────────────────────── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => !resetting && setShowResetConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-50">
                  <RefreshCw size={16} className="text-red-500" />
                </div>
                <p className="font-semibold text-gray-800 text-sm">Réinitialiser tout</p>
              </div>
              {!resetting && (
                <button onClick={() => setShowResetConfirm(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
                <p className="font-semibold">Cette action va :</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs mt-1">
                  <li>Supprimer toutes les photos et cachets intégrés</li>
                  <li>Remettre tous les QR codes à zéro (régénérables)</li>
                  <li>Effacer les positions de cachet sauvegardées</li>
                </ul>
                <p className="text-xs font-medium mt-2">Les fichiers Excel originaux ne sont pas modifiés.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleResetAll}
                  disabled={resetting}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {resetting
                    ? <><ImSpinner2 className="animate-spin" size={14} /> Réinitialisation…</>
                    : "Confirmer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
