// src/pages/hse/PassportManagementPage.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { BookUser, Search, RefreshCw, X, ChevronLeft, ChevronRight, QrCode, Download, Printer, Upload } from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import { QRCodeCanvas } from "qrcode.react";
import toast from "react-hot-toast";
import ManagerLayout from "@/layouts/ManagerLayout";
import { passportService, PassportFile } from "@/services/passportService";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8030";
const PAGE_SIZE = 10;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("access_token")}`,
});

// ── URL publique QR (scan sans login) ────────────────────────────────────────
function getFrontendUrl(): string {
  // 1. En prod : VITE_PUBLIC_URL est défini dans .env.production
  if (import.meta.env.VITE_PUBLIC_URL) return import.meta.env.VITE_PUBLIC_URL;
  // 2. En dev via localhost : remplacer par l'IP WiFi réelle pour que le téléphone puisse accéder
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `http://${__LOCAL_NETWORK_IP__}:${window.location.port}`;
  }
  // 3. Déjà accédé via IP réseau → utiliser tel quel
  return window.location.origin;
}

const FRONTEND_URL = getFrontendUrl();
const qrScanUrl = (slug: string) => `${FRONTEND_URL}/passeports/${slug}/view`;

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
    // Tenter de charger la photo existante
    const token = localStorage.getItem("access_token");
    fetch(`${BASE_URL}/api/employees/passeports/${slug}/photo/`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (r.ok) return r.blob();
      throw new Error("no photo");
    }).then((blob) => setPhotoUrl(URL.createObjectURL(blob)))
    .catch(() => setPhotoUrl(null));
  }, [slug]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("photo", file);
    const token = localStorage.getItem("access_token");
    try {
      const r = await fetch(`${BASE_URL}/api/employees/passeports/${slug}/photo/upload/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!r.ok) throw new Error("upload failed");
      // Afficher la nouvelle photo
      const blob = await file.arrayBuffer();
      setPhotoUrl(URL.createObjectURL(new Blob([blob], { type: file.type })));
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

// ── Modal Détail — PDF rendu en image avec zone photo cliquable ───────────────
function PassportDetailModal({ file, onClose }: { file: PassportFile; onClose: () => void }) {
  const [pages, setPages]     = useState<string[]>([]);   // blob URLs par page
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [photoRect, setPhotoRect] = useState<{ x_pct: number; y_pct: number; w_pct: number; h_pct: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cacheKey, setCacheKey] = useState(0); // forcer rechargement image
  const inputRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem("access_token");
  const headers = { Authorization: `Bearer ${token}` };

  const loadPage = async (pageNum: number, key = cacheKey) => {
    setLoading(true);
    try {
      const r = await fetch(
        `${BASE_URL}/api/employees/passeports/${file.slug}/page-image/?page=${pageNum}&v=${key}`,
        { headers }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const count = parseInt(r.headers.get("X-Page-Count") || "1", 10);
      setPageCount(count);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setPages((prev) => {
        const next = [...prev];
        next[pageNum] = url;
        return next;
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(0);
    // Charger la zone photo (seulement page 0)
    fetch(`${BASE_URL}/api/employees/passeports/${file.slug}/photo-rect/`, { headers })
      .then((r) => r.json())
      .then((d) => setPhotoRect(d.rect || null))
      .catch(() => setPhotoRect(null));
  }, [file.slug]);

  useEffect(() => {
    if (!pages[currentPage]) loadPage(currentPage);
  }, [currentPage]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const form = new FormData();
    form.append("photo", f);
    if (photoRect) {
      form.append("x_pct", String(photoRect.x_pct));
      form.append("y_pct", String(photoRect.y_pct));
      form.append("w_pct", String(photoRect.w_pct));
      form.append("h_pct", String(photoRect.h_pct));
    }
    try {
      const r = await fetch(
        `${BASE_URL}/api/employees/passeports/${file.slug}/embed-photo/`,
        { method: "POST", headers, body: form }
      );
      if (!r.ok) throw new Error("upload failed");
      // Forcer rechargement de la page image
      const newKey = cacheKey + 1;
      setCacheKey(newKey);
      setPages([]);
      await loadPage(0, newKey);
      toast.success("Photo intégrée dans le passeport !");
    } catch {
      toast.error("Erreur lors de l'intégration de la photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const pageUrl = pages[currentPage];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-2"
      onClick={onClose}
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
              <p className="text-xs text-gray-400">Passeport Sécurité CAMUSAT</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pageCount > 1 && (
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
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corps — image PDF avec overlay photo cliquable */}
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
            <div className="relative inline-block shadow-lg">
              <img
                src={pageUrl}
                alt={`Page ${currentPage + 1}`}
                className="max-w-full block"
                style={{ maxHeight: "calc(98vh - 140px)" }}
              />

              {/* Overlay zone photo — visible seulement sur la page 0 */}
              {currentPage === 0 && photoRect && (
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  title="Cliquer pour ajouter / modifier la photo"
                  style={{
                    position: "absolute",
                    left:   `${photoRect.x_pct}%`,
                    top:    `${photoRect.y_pct}%`,
                    width:  `${photoRect.w_pct}%`,
                    height: `${photoRect.h_pct}%`,
                  }}
                  className="border-2 border-dashed border-purple-400 bg-purple-400/10 hover:bg-purple-400/25 transition flex items-center justify-center group cursor-pointer"
                >
                  {uploading
                    ? <ImSpinner2 className="animate-spin text-purple-600" size={20} />
                    : <Upload size={18} className="text-purple-600 opacity-0 group-hover:opacity-100 transition" />}
                </button>
              )}

              {/* Si pas de zone détectée, bouton flottant en haut à droite */}
              {currentPage === 0 && !photoRect && (
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  title="Ajouter une photo"
                  className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium shadow hover:bg-purple-700 transition"
                >
                  {uploading
                    ? <ImSpinner2 className="animate-spin" size={12} />
                    : <Upload size={12} />}
                  Photo
                </button>
              )}
            </div>
          ) : null}
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
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

  const handleResetAll = async () => {
    setResetting(true);
    try {
      const res = await passportService.resetAll();
      toast.success(`Réinitialisé : ${res.deleted_pdfs} fichier(s) supprimé(s).`);
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
  useEffect(() => { setPage(1); }, [search]);


  const filtered = files.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return f.display_name.toLowerCase().includes(q) || f.nom_prenom.toLowerCase().includes(q);
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
