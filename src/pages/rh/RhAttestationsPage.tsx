// src/pages/rh/RhAttestationsPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, RefreshCw, Search, X,
  RotateCcw, LayoutTemplate, Settings2,
  User, Calendar, Briefcase, Building2, FileCheck, Clock,
  CheckCircle2, Ban, History, PlusCircle, Send, XCircle, Move, Minus, Plus,
} from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import toast from "react-hot-toast";
import AppLayout from "@/layouts/AppLayout";
import { attestationService, attestationStampService, AttestationStamp } from "@/services/attestationService";
import { AttestationRequest, AttestationStatus, AttestationHistory } from "@/types/attestation";
import AttestationTemplatesPanel from "@/components/attestations/AttestationTemplatesPanel";

type Tab = "requests" | "templates";

const STATUS_CONFIG: Record<AttestationStatus, { label: string; cls: string; dotCls: string }> = {
  PENDING:   { label: "En attente",      cls: "bg-amber-50 text-amber-700 border-amber-200",   dotCls: "bg-amber-400"   },
  GENERATED: { label: "À valider",       cls: "bg-sky-50 text-sky-700 border-sky-200",         dotCls: "bg-sky-400"     },
  PROCESSED: { label: "Traité",          cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dotCls: "bg-emerald-500" },
  REJECTED:  { label: "Refusé",          cls: "bg-red-50 text-red-600 border-red-200",         dotCls: "bg-red-400"     },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

const EXTRA_LABELS: Record<string, string> = {
  date_debut_conges:    "Début des congés",
  date_fin_conges:      "Fin des congés",
  date_reprise:         "Date de reprise",
  nom_banque:           "Banque",
  rib:                  "RIB",
  salaire_net_lettre:   "Salaire net (lettres)",
  salaire_net_chiffre:  "Salaire net (chiffres)",
  date_retraite:        "Date de retraite",
  date_fin_cdd:         "Fin du CDD",
};

const HISTORY_CONFIG: Record<string, { icon: React.ReactNode; color: string; dot: string }> = {
  CREATED:     { icon: <PlusCircle  size={13} />, color: "text-blue-600",    dot: "bg-blue-400"    },
  GENERATED:   { icon: <FileCheck   size={13} />, color: "text-sky-600",     dot: "bg-sky-400"     },
  PROCESSED:   { icon: <Send        size={13} />, color: "text-emerald-600", dot: "bg-emerald-500" },
  VALIDATED:   { icon: <Send        size={13} />, color: "text-emerald-600", dot: "bg-emerald-500" },
  REGENERATED: { icon: <RotateCcw   size={13} />, color: "text-violet-600",  dot: "bg-violet-400"  },
  REJECTED:    { icon: <XCircle     size={13} />, color: "text-red-600",     dot: "bg-red-400"     },
};

// ── Séparateur section ──────────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

// ── Chargement de l'aperçu du document ──────────────────────────────────────
function useDocumentPreview(attestationId: number) {
  const [preview, setPreview] = useState<{
    image: string; page_width: number; page_height: number; page_index: number; page_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const data = await attestationService.getPreviewImage(attestationId, false);
      const bust = Date.now();
      const image = data.image && !data.image.startsWith("data:")
        ? `${data.image}${data.image.includes("?") ? "&" : "?"}_t=${bust}`
        : data.image;
      setPreview({ ...data, image });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors du chargement de l'aperçu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPreview(); }, [attestationId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { preview, loading, containerRef, loadPreview };
}

// ── Hook de placement du cachet ─────────────────────────────────────────────
interface StampPlacerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  previewReady: boolean;
  previewWidth: number;
  previewHeight: number;
  onRegenerate: () => Promise<void>;
  reloadPreview: () => Promise<void>;
}

function useStampPlacement({ containerRef, previewReady, previewWidth, previewHeight, onRegenerate, reloadPreview }: StampPlacerProps) {
  const STAMP_W_MIN = 0.05;
  const STAMP_W_MAX = 0.60;

  const [stamp, setStamp] = useState<AttestationStamp | null>(null);
  const [pos, setPos] = useState({ x: 0.58, y: 0.80 });
  const [stampWidth, setStampWidth] = useState(0.35);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moved, setMoved] = useState(false);
  // Offset entre le point de clic et le coin haut-gauche du cachet
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    attestationStampService.get()
      .then(s => {
        if (s) {
          setStamp(s);
          setPos({ x: s.pos_x, y: s.pos_y });
          setStampWidth(s.width);
        }
      })
      .catch(() => {});
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  const updatePosFromClient = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const stampH = previewWidth > 0 ? stampWidth * (previewHeight / previewWidth) : stampWidth;
    let x = (clientX - rect.left) / rect.width - dragOffset.current.x;
    let y = (clientY - rect.top) / rect.height - dragOffset.current.y;
    x = clamp(x, 0, 1 - stampWidth);
    y = clamp(y, 0, 1 - stampH);
    setPos({ x, y });
    setMoved(true);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Capture au niveau du container (pas de e.target) pour que les pointermove
    // arrivent toujours sur le container même si le pointeur sort du cachet
    containerRef.current?.setPointerCapture(e.pointerId);
    // Calcul de l'offset : où dans le cachet a-t-on cliqué ?
    const el = containerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      dragOffset.current = {
        x: (e.clientX - rect.left) / rect.width - pos.x,
        y: (e.clientY - rect.top) / rect.height - pos.y,
      };
    }
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    updatePosFromClient(e.clientX, e.clientY);
  };

  const handlePointerUp = () => setDragging(false);

  const changeWidth = (delta: number) => {
    setStampWidth(w => {
      const next = clamp(w + delta, STAMP_W_MIN, STAMP_W_MAX);
      setPos(p => ({ x: clamp(p.x, 0, 1 - next), y: p.y }));
      return next;
    });
    setMoved(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await attestationStampService.updatePosition(pos.x, pos.y, stampWidth);
      await onRegenerate();
      await reloadPreview();
      setMoved(false);
      toast.success("Position du cachet sauvegardée !");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return {
    stamp, pos, stampWidth, dragging, saving, moved,
    STAMP_W_MIN, STAMP_W_MAX,
    handlePointerDown, handlePointerMove, handlePointerUp,
    changeWidth, setStampWidth, setMoved, handleSave,
  };
}

// ── Bloc complet pour l'état GENERATED : aperçu à gauche, actions à droite ──
interface GeneratedPanelProps {
  manageTarget: AttestationRequest;
  onRegenerate: () => Promise<void>;
  regenerating: boolean;
  onValidate: () => void;
  validating: boolean;
  rejecting: boolean;
}

function GeneratedPanel({
  manageTarget, onRegenerate, regenerating, onValidate, validating, rejecting,
}: GeneratedPanelProps) {
  const doc = useDocumentPreview(manageTarget.id);

  const stamp = useStampPlacement({
    containerRef: doc.containerRef,
    previewReady: !!doc.preview,
    previewWidth:  doc.preview?.page_width  ?? 595,
    previewHeight: doc.preview?.page_height ?? 842,
    onRegenerate,
    reloadPreview: doc.loadPreview,
  });

  const busy = regenerating || validating || rejecting || stamp.saving;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* ── Aperçu du document (gauche) ── */}
      <div>
        <DocumentPreview doc={doc} stampOverlay={stamp.stamp ? stamp : null} />
      </div>

      {/* ── Actions (droite) ── */}
      <div className="space-y-3 flex flex-col">
        {/* ── Contrôles taille du cachet ── */}
        {stamp.stamp && (
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Move size={14} className="text-gray-400" />
                Cachet
              </p>
              <span className="text-xs text-gray-400">{Math.round(stamp.stampWidth * 100)}% largeur</span>
            </div>
            <p className="text-xs text-gray-400">Glissez le cachet sur l'aperçu pour le repositionner.</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => stamp.changeWidth(-0.02)}
                disabled={stamp.stampWidth <= stamp.STAMP_W_MIN}
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition">
                <Minus size={12} />
              </button>
              <input type="range" min={stamp.STAMP_W_MIN} max={stamp.STAMP_W_MAX} step={0.01}
                value={stamp.stampWidth}
                onChange={e => { stamp.setStampWidth(parseFloat(e.target.value)); stamp.setMoved(true); }}
                className="flex-1 accent-[#003c71]" />
              <button type="button" onClick={() => stamp.changeWidth(0.02)}
                disabled={stamp.stampWidth >= stamp.STAMP_W_MAX}
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition">
                <Plus size={12} />
              </button>
            </div>
            {stamp.moved && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                ● Position modifiée — sera appliquée à la validation
              </p>
            )}
          </div>
        )}

        {/* Visualiser le PDF généré */}
        {manageTarget.pdf_url && (
          <a
            href={manageTarget.pdf_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 bg-[#003c71]/5 hover:bg-[#003c71]/10 border border-[#003c71]/20 rounded-xl transition group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#003c71] flex items-center justify-center shrink-0">
              <FileText size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#003c71]">Visualiser le document généré</p>
              <p className="text-xs text-gray-400">Ouvrir le PDF complet dans un nouvel onglet</p>
            </div>
          </a>
        )}

        {/* Re-générer (avant validation) */}
        <button
          onClick={onRegenerate}
          disabled={busy}
          className="flex items-center gap-3 w-full px-4 py-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition disabled:opacity-60 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
            {regenerating
              ? <ImSpinner2 className="animate-spin text-gray-500" size={16} />
              : <RotateCcw size={16} className="text-gray-500" />
            }
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-700">
              {regenerating ? "Re-génération en cours…" : "Re-générer l'aperçu"}
            </p>
            <p className="text-xs text-gray-400">Recréer le document avec les données actuelles</p>
          </div>
        </button>

        <div className="flex-1" />

        {/* Valider & envoyer (sauvegarde la position du cachet si modifiée) */}
        <button
          onClick={async () => {
            if (stamp.stamp && stamp.moved) {
              await stamp.handleSave();
            }
            onValidate();
          }}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition"
        >
          {stamp.saving
            ? <><ImSpinner2 className="animate-spin" size={15} /> Application du cachet…</>
            : validating
              ? <><ImSpinner2 className="animate-spin" size={15} /> Envoi en cours…</>
              : <><Send size={15} /> Valider &amp; envoyer à l'employé</>
          }
        </button>
      </div>
    </div>
  );
}

type StampPlacement = ReturnType<typeof useStampPlacement>;
type DocumentPreviewProps = { doc: ReturnType<typeof useDocumentPreview>; stampOverlay: StampPlacement | null };

/** Aperçu image du document avec le cachet déplaçable. */
function DocumentPreview({ doc, stampOverlay }: DocumentPreviewProps) {
  const { preview, loading, containerRef } = doc;
  const stampDragging = stampOverlay?.dragging ?? false;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 bg-gray-50 border border-gray-200 rounded-xl">
        <ImSpinner2 className="animate-spin text-[#003c71]" size={22} />
      </div>
    );
  }

  if (!preview) return null;

  const stampFileUrl = stampOverlay?.stamp?.file_url ?? null;
  const isStampPdf = stampFileUrl && /\.pdf(\?|$)/i.test(stampFileUrl);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 select-none"
      style={{ aspectRatio: `${preview.page_width} / ${preview.page_height}`, touchAction: "none" }}
      onPointerMove={e => stampOverlay?.handlePointerMove(e)}
      onPointerUp={() => stampOverlay?.handlePointerUp()}
      onPointerLeave={() => stampOverlay?.handlePointerUp()}
    >
      <img
        src={preview.image}
        alt="Aperçu du document"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />

      {/* ── Cachet draggable ── */}
      {stampOverlay?.stamp?.file_url && (
        <div
          style={{
            position: "absolute",
            left:   `${stampOverlay.pos.x * 100}%`,
            top:    `${stampOverlay.pos.y * 100}%`,
            width:  `${stampOverlay.stampWidth * 100}%`,
            cursor: stampDragging ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
          }}
          onPointerDown={stampOverlay.handlePointerDown}
        >
          {isStampPdf ? (
            <div style={{ position: "relative" }}>
              <object
                data={`${stampOverlay.stamp.file_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                type="application/pdf"
                style={{ display: "block", width: "100%", aspectRatio: "1 / 1", border: "none", overflow: "hidden" }}
              >
                <img src={stampOverlay.stamp.file_url} alt="Cachet" draggable={false} style={{ display: "block", width: "100%" }} />
              </object>
              <div style={{ position: "absolute", inset: 0, cursor: "inherit" }} />
            </div>
          ) : (
            <img
              src={stampOverlay.stamp.file_url}
              alt="Cachet"
              draggable={false}
              style={{ display: "block", width: "100%", pointerEvents: "none" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function RhAttestationsPage() {
  const [activeTab,    setActiveTab]    = useState<Tab>("requests");
  const [requests,     setRequests]     = useState<AttestationRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<AttestationStatus | "ALL">("ALL");

  // Modal détails (clic sur une ligne)
  const [detailTarget,  setDetailTarget]  = useState<AttestationRequest | null>(null);
  const [detailHistory, setDetailHistory] = useState<AttestationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modal gérer (bouton Gérer)
  const [manageTarget,  setManageTarget]  = useState<AttestationRequest | null>(null);
  const [processNotes,  setProcessNotes]  = useState("");
  const [rejectNotes,   setRejectNotes]   = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [validating,    setValidating]    = useState(false);
  const [rejecting,     setRejecting]     = useState(false);
  const [regenerating,  setRegenerating]  = useState(false);
  const [justValidated, setJustValidated] = useState(false);
  const validatedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoyage du timer de fermeture automatique au démontage
  useEffect(() => {
    return () => {
      if (validatedTimerRef.current) clearTimeout(validatedTimerRef.current);
    };
  }, []);

  const openDetail = async (r: AttestationRequest) => {
    setDetailTarget(r);
    setDetailHistory([]);
    setHistoryLoading(true);
    try {
      setDetailHistory(await attestationService.getHistory(r.id));
    } catch {
      // silencieux — l'historique est facultatif
    } finally {
      setHistoryLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try { setRequests(await attestationService.getAll()); }
    catch { toast.error("Erreur chargement"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.employee_nom_complet.toLowerCase().includes(q) ||
      r.employee_matricule.toLowerCase().includes(q) ||
      r.document_type_display.toLowerCase().includes(q);
    return matchSearch && (filterStatus === "ALL" || r.status === filterStatus);
  });

  const counts = {
    ALL:       requests.length,
    PENDING:   requests.filter(r => r.status === "PENDING").length,
    GENERATED: requests.filter(r => r.status === "GENERATED").length,
    PROCESSED: requests.filter(r => r.status === "PROCESSED").length,
    REJECTED:  requests.filter(r => r.status === "REJECTED").length,
  };

  // ── Générer l'aperçu ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!manageTarget) return;
    setGenerating(true);
    try {
      const updated = await attestationService.generate(manageTarget.id, processNotes);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setManageTarget(updated);
      if (detailTarget?.id === updated.id) await openDetail(updated);
      toast.success("Aperçu généré — vérifiez le document avant de valider.");
      setProcessNotes("");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de la génération");
    } finally { setGenerating(false); }
  };

  // ── Valider & envoyer ────────────────────────────────────────────────────────
  const handleValidate = async () => {
    if (!manageTarget) return;
    setValidating(true);
    try {
      const updated = await attestationService.validate(manageTarget.id, processNotes);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setManageTarget(updated);
      if (detailTarget?.id === updated.id) await openDetail(updated);
      toast.success("Document validé — PDF envoyé à l'employé !");
      setProcessNotes("");
      setJustValidated(true);
      if (validatedTimerRef.current) clearTimeout(validatedTimerRef.current);
      validatedTimerRef.current = setTimeout(() => {
        setManageTarget(null);
        setJustValidated(false);
        validatedTimerRef.current = null;
      }, 3000);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur lors de la validation");
    } finally { setValidating(false); }
  };

  /** Ferme la modale "Gérer" et nettoie l'état lié au message de succès. */
  const closeManageModal = () => {
    if (validatedTimerRef.current) {
      clearTimeout(validatedTimerRef.current);
      validatedTimerRef.current = null;
    }
    setJustValidated(false);
    setShowRejectForm(false);
    setManageTarget(null);
  };

  // ── Refuser ────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!manageTarget) return;
    setRejecting(true);
    try {
      const updated = await attestationService.reject(manageTarget.id, rejectNotes);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setManageTarget(updated);
      if (detailTarget?.id === updated.id) await openDetail(updated);
      toast.success("Demande refusée — l'employé a été notifié.");
      setRejectNotes("");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur");
    } finally { setRejecting(false); }
  };

  // ── Re-générer ─────────────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    if (!manageTarget) return;
    setRegenerating(true);
    try {
      const updated = await attestationService.regenerate(manageTarget.id);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setManageTarget(updated);
      if (detailTarget?.id === updated.id) await openDetail(updated);
      toast.success("PDF re-généré avec succès");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Erreur");
    } finally { setRegenerating(false); }
  };

  return (
    <AppLayout>
      <div className="space-y-5 pb-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Demandes d'attestation</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gérez les demandes de documents officiels des employés</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "requests" && (
              <button onClick={load} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition" title="Rafraîchir">
                <RefreshCw size={16} className="text-gray-500" />
              </button>
            )}
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === "requests"
                  ? "bg-[#003c71] text-white shadow-sm"
                  : "bg-white border border-[#003c71] text-[#003c71] hover:bg-[#003c71]/5"
              }`}
            >
              <FileText size={15} />
              Demandes
              {(counts.PENDING + counts.GENERATED) > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  activeTab === "requests" ? "bg-white/25 text-white" : "bg-amber-400 text-white"
                }`}>{counts.PENDING + counts.GENERATED}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === "templates"
                  ? "bg-[#003c71] text-white shadow-sm"
                  : "bg-white border border-[#003c71] text-[#003c71] hover:bg-[#003c71]/5"
              }`}
            >
              <LayoutTemplate size={15} />
              Modèles
            </button>
          </div>
        </div>

        {/* ── Onglet Modèles ── */}
        {activeTab === "templates" && <AttestationTemplatesPanel />}

        {/* ── Onglet Demandes ── */}
        {activeTab === "requests" && <>

          {/* Recherche + filtres */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-56">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, matricule, type…"
                className="w-full pl-10 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#003c71] focus:ring-2 focus:ring-[#003c71]/20 transition bg-white"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["ALL", "PENDING", "GENERATED", "PROCESSED", "REJECTED"] as const).map(s => {
                const label = s === "ALL" ? "Toutes" : STATUS_CONFIG[s].label;
                const active = filterStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition ${
                      active ? "bg-[#003c71] text-white border-[#003c71] shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                    <span className={`px-1.5 py-0.5 rounded-lg text-xs font-bold ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                      {counts[s]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tableau */}
          {loading ? (
            <div className="flex justify-center py-16">
              <ImSpinner2 className="animate-spin text-[#003c71]" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <FileText size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-500">Aucune demande trouvée</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Employé</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Document demandé</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date demande</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(r => {
                    const cfg = STATUS_CONFIG[r.status];
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-gray-50/60 transition cursor-pointer"
                        onClick={() => openDetail(r)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800">{r.employee_nom_complet}</p>
                          <p className="text-xs text-gray-400 font-mono">{r.employee_matricule} · {r.employee_service}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.document_type_display}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => { setManageTarget(r); setProcessNotes(""); setRejectNotes(""); setShowRejectForm(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#003c71] hover:bg-[#003c71]/90 text-white rounded-lg text-xs font-semibold transition ml-auto"
                          >
                            <Settings2 size={13} />
                            Gérer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>}
      </div>

      {/* ══ Modal Détails ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {detailTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setDetailTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="bg-[#003c71] px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold">{detailTarget.employee_nom_complet}</p>
                  <p className="text-white/70 text-xs truncate">{detailTarget.document_type_display}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_CONFIG[detailTarget.status].cls}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_CONFIG[detailTarget.status].dotCls}`} />
                  {STATUS_CONFIG[detailTarget.status].label}
                </span>
                <button onClick={() => setDetailTarget(null)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition ml-1">
                  <X size={14} className="text-white" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">

                {/* Infos employé */}
                <Divider label="Employé" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <User size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Matricule</p>
                      <p className="font-mono font-semibold text-gray-700">{detailTarget.employee_matricule}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Briefcase size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Fonction</p>
                      <p className="text-gray-700">{detailTarget.employee_fonction}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 col-span-2">
                    <Building2 size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Service</p>
                      <p className="text-gray-700">{detailTarget.employee_service}</p>
                    </div>
                  </div>
                </div>

                {/* Infos demande */}
                <Divider label="Demande" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Date de demande</p>
                      <p className="text-gray-700">{fmtDate(detailTarget.created_at)}</p>
                    </div>
                  </div>
                  {detailTarget.processed_at && (
                    <div className="flex items-start gap-2">
                      <Clock size={14} className="text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Traité le</p>
                        <p className="text-gray-700">{fmtDateTime(detailTarget.processed_at)}</p>
                      </div>
                    </div>
                  )}
                  {detailTarget.processed_by && (
                    <div className="flex items-start gap-2 col-span-2">
                      <User size={14} className="text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Traité par</p>
                        <p className="text-gray-700">{detailTarget.processed_by}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Données complémentaires */}
                {Object.keys(detailTarget.extra_data || {}).length > 0 && (
                  <>
                    <Divider label="Informations complémentaires" />
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(detailTarget.extra_data).map(([k, v]) => (
                        <div key={k} className="bg-gray-50 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-400 mb-0.5">{EXTRA_LABELS[k] || k.replace(/_/g, " ")}</p>
                          <p className="text-sm font-medium text-gray-700">{v}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Notes / motif de refus */}
                {detailTarget.notes && (
                  <div className={`p-3 rounded-xl border text-sm ${
                    detailTarget.status === "REJECTED"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-blue-50 border-blue-200 text-blue-700"
                  }`}>
                    <p className="text-xs font-semibold mb-1 uppercase tracking-wide opacity-70">
                      {detailTarget.status === "REJECTED" ? "Motif de refus" : "Notes"}
                    </p>
                    {detailTarget.notes}
                  </div>
                )}

                {/* ── Historique ── */}
                <Divider label="Historique" />
                {historyLoading ? (
                  <div className="flex justify-center py-4">
                    <ImSpinner2 className="animate-spin text-gray-400" size={18} />
                  </div>
                ) : detailHistory.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <History size={14} />
                    Aucun historique disponible
                  </div>
                ) : (
                  <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                    {detailHistory.map((h, i) => {
                      const cfg = HISTORY_CONFIG[h.action] ?? HISTORY_CONFIG.CREATED;
                      return (
                        <li key={h.id} className="ml-4">
                          {/* point sur la timeline */}
                          <span className={`absolute -left-[7px] w-3.5 h-3.5 rounded-full border-2 border-white ${cfg.dot}`} />
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold ${cfg.color}`}>{h.action_display}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {h.performed_by && <span className="font-medium text-gray-500">{h.performed_by} · </span>}
                                {new Date(h.performed_at).toLocaleDateString("fr-FR", {
                                  day: "2-digit", month: "short", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </p>
                              {h.notes && (
                                <p className="text-xs text-gray-500 mt-1 italic">"{h.notes}"</p>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}

                <button
                  onClick={() => setDetailTarget(null)}
                  className="w-full border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition mt-2"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ Modal Gérer ════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {manageTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !generating && !validating && !rejecting && !regenerating && closeManageModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={e => e.stopPropagation()}
              className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden ${
                !justValidated && manageTarget.status === "GENERATED" ? "max-w-3xl" : "max-w-md"
              }`}
            >
              {!justValidated && (
              <>
              {/* Header */}
              <div className="bg-[#003c71] px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Settings2 size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Gérer la demande</p>
                  <p className="text-white/70 text-xs truncate">{manageTarget.employee_nom_complet} — {manageTarget.document_type_display}</p>
                </div>
                <button
                  onClick={() => !generating && !validating && !rejecting && !regenerating && closeManageModal()}
                  className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
              </>
              )}

              {justValidated ? (
                <div className="p-10 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-emerald-600" />
                  </div>
                  <p className="text-base font-semibold text-gray-800">Document validé et envoyé à l'employé !</p>
                  <p className="text-xs text-gray-400">Cette fenêtre va se fermer automatiquement…</p>
                </div>
              ) : (
              <div className="p-6 space-y-3">

                {/* ── PENDING ── */}
                {manageTarget.status === "PENDING" && (
                  <>
                    {!showRejectForm ? (
                      <>
                        {/* Générer l'aperçu */}
                        <button
                          onClick={handleGenerate}
                          disabled={generating || rejecting}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#003c71] hover:bg-[#003c71]/90 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition"
                        >
                          {generating
                            ? <><ImSpinner2 className="animate-spin" size={15} /> Génération du PDF en cours…</>
                            : <><FileCheck size={15} /> Générer l'aperçu du document</>
                          }
                        </button>

                        {/* Refuser */}
                        <button
                          onClick={() => setShowRejectForm(true)}
                          disabled={generating}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition"
                        >
                          <Ban size={15} /> Refuser la demande
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Motif de refus */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            Motif de refus <span className="text-red-400">*</span>
                          </label>
                          <textarea
                            value={rejectNotes}
                            onChange={e => setRejectNotes(e.target.value)}
                            rows={3}
                            autoFocus
                            placeholder="Ex : Informations manquantes dans votre dossier…"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 resize-none transition"
                          />
                        </div>
                        <button
                          onClick={handleReject}
                          disabled={rejecting || !rejectNotes.trim()}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 disabled:opacity-60 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition"
                        >
                          {rejecting
                            ? <><ImSpinner2 className="animate-spin" size={15} /> En cours…</>
                            : <><Ban size={15} /> Confirmer le refus</>
                          }
                        </button>
                        <button
                          onClick={() => setShowRejectForm(false)}
                          disabled={rejecting}
                          className="w-full border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition"
                        >
                          Retour
                        </button>
                      </>
                    )}
                  </>
                )}

                {/* ── GENERATED (aperçu en attente de validation) ── */}
                {manageTarget.status === "GENERATED" && (
                  <GeneratedPanel
                    manageTarget={manageTarget}
                    onRegenerate={handleRegenerate}
                    regenerating={regenerating}
                    onValidate={handleValidate}
                    validating={validating}
                    rejecting={rejecting}
                  />
                )}

                {/* ── PROCESSED ── */}
                {manageTarget.status === "PROCESSED" && (
                  <>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                      <CheckCircle2 size={14} className="shrink-0" />
                      Demande traitée le {fmtDateTime(manageTarget.processed_at)}
                      {manageTarget.processed_by && ` par ${manageTarget.processed_by}`}.
                    </div>

                    {/* Afficher PDF */}
                    {manageTarget.pdf_url && (
                      <a
                        href={manageTarget.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-4 py-3.5 bg-[#003c71]/5 hover:bg-[#003c71]/10 border border-[#003c71]/20 rounded-xl transition group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#003c71] flex items-center justify-center shrink-0">
                          <Download size={16} className="text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#003c71]">Afficher le fichier PDF</p>
                          <p className="text-xs text-gray-400">Ouvrir dans un nouvel onglet</p>
                        </div>
                      </a>
                    )}

                    {/* Re-générer */}
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="flex items-center gap-3 w-full px-4 py-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition disabled:opacity-60 text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                        {regenerating
                          ? <ImSpinner2 className="animate-spin text-gray-500" size={16} />
                          : <RotateCcw size={16} className="text-gray-500" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-700">
                          {regenerating ? "Re-génération en cours…" : "Re-générer le PDF"}
                        </p>
                        <p className="text-xs text-gray-400">Recréer le document avec les données actuelles</p>
                      </div>
                    </button>
                  </>
                )}

                {/* ── REJECTED ── */}
                {manageTarget.status === "REJECTED" && (
                  <>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                      <p className="font-semibold mb-1">Demande refusée</p>
                      {manageTarget.notes && <p>{manageTarget.notes}</p>}
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 text-center">
                      Pour re-traiter cette demande, l'employé doit soumettre une nouvelle demande.
                    </div>
                  </>
                )}

                <button
                  onClick={() => !generating && !validating && !rejecting && !regenerating && closeManageModal()}
                  className="w-full border border-gray-200 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition"
                >
                  Fermer
                </button>
              </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
