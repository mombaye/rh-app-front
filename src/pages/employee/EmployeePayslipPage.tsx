import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeDollarSign, Download, FileText, Loader2,
  ChevronDown, ChevronUp, Eye, X, Send, Clock,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { fetchAvailableBulletins, requestPayslipAccess } from "@/services/employeeService";
import api from "@/api/axios";
import toast from "react-hot-toast";

// ─── Config ──────────────────────────────────────────────────────────────────
const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

const DEFAULT_VISIBLE = 3; // derniers mois affichés sans demande

type BulletinEntry = { year: number; month: number };

// ─── Téléchargement ──────────────────────────────────────────────────────────
async function downloadBulletin(matricule: string, year: number, month: number) {
  const res = await api.get(
    `/api/employees/${matricule}/download-bulletin/`,
    { params: { year, month, preview: false }, responseType: "blob" },
  );
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `bulletin_${year}_${String(month).padStart(2, "0")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

async function fetchBulletinBlobUrl(matricule: string, year: number, month: number): Promise<string> {
  const res = await api.get(
    `/api/employees/${matricule}/download-bulletin/`,
    { params: { year, month, preview: true }, responseType: "blob" },
  );
  return window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
}

// ─── Modal prévisualisation ───────────────────────────────────────────────────
function PreviewModal({ matricule, year, month, onClose }: {
  matricule: string; year: number; month: number; onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    let url: string | null = null;
    fetchBulletinBlobUrl(matricule, year, month)
      .then(u => { url = u; setBlobUrl(u); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    return () => { if (url) window.URL.revokeObjectURL(url); };
  }, [matricule, year, month]);

  const handleDownload = async () => {
    try { await downloadBulletin(matricule, year, month); toast.success("Bulletin téléchargé !"); }
    catch { toast.error("Erreur lors du téléchargement."); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/90 border-b border-white/10"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#003c71] flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Bulletin — {MONTHS_FR[month - 1]} {year}</p>
            <p className="text-gray-400 text-xs">Prévisualisation PDF</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#003c71] text-white text-xs font-medium hover:bg-[#003c71]/80 transition">
            <Download size={13} /> Télécharger
          </button>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <X size={16} className="text-white" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 size={36} className="animate-spin text-[#003c71]" />
            <p className="text-sm text-gray-300">Chargement du bulletin…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 text-white">
            <FileText size={48} className="text-gray-500" />
            <p className="text-sm text-gray-300">Impossible de charger le bulletin.</p>
            <button onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/80 transition">
              <Download size={15} /> Télécharger à la place
            </button>
          </div>
        ) : blobUrl ? (
          <iframe src={blobUrl} className="w-full h-full rounded-xl shadow-2xl bg-white"
            style={{ maxWidth: "900px", minHeight: "calc(100vh - 120px)" }}
            title={`Bulletin ${MONTHS_FR[month - 1]} ${year}`} />
        ) : null}
      </div>
    </div>
  );
}

// ─── Modal de demande ─────────────────────────────────────────────────────────
function RequestModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const currentDate = new Date();
  const options: BulletinEntry[] = [];
  for (let i = DEFAULT_VISIBLE + 1; i <= DEFAULT_VISIBLE + 24; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    options.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const [selected, setSelected] = useState<BulletinEntry[]>([]);
  const [message,  setMessage]  = useState("");
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);

  const toggle = (entry: BulletinEntry) => {
    setSelected(prev => {
      const exists = prev.some(e => e.year === entry.year && e.month === entry.month);
      return exists
        ? prev.filter(e => !(e.year === entry.year && e.month === entry.month))
        : [...prev, entry];
    });
  };

  const handleSubmit = async () => {
    if (selected.length === 0) { toast.error("Veuillez sélectionner au moins un mois."); return; }
    setSending(true);
    try {
      await requestPayslipAccess({ months: selected, message });
      setSent(true);
      onSuccess();
    } catch {
      toast.error("Erreur lors de l'envoi de la demande.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
         onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#003c71]/10 flex items-center justify-center">
              <Send size={15} className="text-[#003c71]" />
            </div>
            <span className="font-semibold text-[#003c71]">Demander des bulletins antérieurs</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <X size={16} />
          </button>
        </div>

        {/* Corps */}
        {sent ? (
          <div className="p-8 text-center">
            <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-800 mb-1">Demande envoyée !</p>
            <p className="text-sm text-gray-500">Le service RH a été notifié et vous enverra les bulletins demandés.</p>
            <button onClick={onClose}
              className="mt-5 px-5 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition">
              Fermer
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs text-gray-500">
              Sélectionnez les mois souhaités. Le service RH vous les enverra après traitement.
            </p>

            {/* Sélection des mois */}
            <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {options.map(opt => {
                const isSelected = selected.some(e => e.year === opt.year && e.month === opt.month);
                return (
                  <button key={`${opt.year}-${opt.month}`} onClick={() => toggle(opt)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition text-left ${
                      isSelected
                        ? "bg-[#003c71] border-[#003c71] text-white font-medium"
                        : "border-gray-200 text-gray-700 hover:border-[#003c71]/40 hover:bg-[#003c71]/5"
                    }`}>
                    <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      isSelected ? "border-white bg-white" : "border-gray-300"
                    }`}>
                      {isSelected && <div className="w-1 h-1 rounded-full bg-[#003c71]" />}
                    </div>
                    <span className="truncate">{MONTHS_FR[opt.month - 1].slice(0, 3)} {opt.year}</span>
                  </button>
                );
              })}
            </div>

            {selected.length > 0 && (
              <p className="text-xs text-[#003c71] font-medium">
                {selected.length} mois sélectionné{selected.length > 1 ? "s" : ""}
              </p>
            )}

            {/* Message optionnel */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Message (optionnel)</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                rows={2} placeholder="Ex : Bulletins nécessaires pour un dossier de prêt"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#003c71]/30" />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button onClick={handleSubmit} disabled={sending || selected.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition disabled:opacity-50">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Envoyer la demande
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Carte bulletin ───────────────────────────────────────────────────────────
function BulletinCard({ b, matricule }: { b: BulletinEntry; matricule: string }) {
  const [downloading, setDownloading] = useState(false);
  const [previewing,  setPreviewing]  = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 hover:border-gray-200 transition group">
        <div className="w-9 h-9 rounded-lg bg-[#003c71]/10 flex flex-col items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-[#003c71] leading-none">{MONTHS_FR[b.month - 1].slice(0, 3).toUpperCase()}</span>
          <span className="text-[9px] text-gray-400 leading-none mt-0.5">{b.year}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-800 text-sm">{MONTHS_FR[b.month - 1]}</div>
          <div className="text-[11px] text-gray-400">{b.year}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => { setPreviewing(true); setPreviewOpen(true); setPreviewing(false); }}
            disabled={previewing} title="Visualiser"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#003c71] hover:bg-[#003c71]/10 transition disabled:opacity-50">
            {previewing ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
          </button>
          <button onClick={async () => {
            setDownloading(true);
            try { await downloadBulletin(matricule, b.year, b.month); toast.success(`Bulletin ${MONTHS_FR[b.month - 1]} ${b.year} téléchargé.`); }
            catch { toast.error("Erreur lors du téléchargement."); }
            finally { setDownloading(false); }
          }} disabled={downloading} title="Télécharger"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#003c71] hover:bg-[#003c71]/10 transition disabled:opacity-50">
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {previewOpen && (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PreviewModal matricule={matricule} year={b.year} month={b.month} onClose={() => setPreviewOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
interface Props { layout?: React.ComponentType<{ children: React.ReactNode }>; }

export default function EmployeePayslipPage({ layout: Layout = EmployeeLayout }: Props) {
  const { user } = useAuth();
  const matricule = user?.employee_matricule;

  const [bulletins,    setBulletins]    = useState<BulletinEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [openYear,    setOpenYear]    = useState<number | null>(null);
  const [showRequest, setShowRequest] = useState(false);

  const refresh = useCallback(() => {
    if (!matricule) { setLoading(false); return; }
    fetchAvailableBulletins(matricule)
      .then(data => {
        setBulletins(data);
        if (data.length > 0) setOpenYear(data[0].year);
      })
      .catch(() => setBulletins([]))
      .finally(() => setLoading(false));
  }, [matricule]);

  useEffect(() => { refresh(); }, [refresh]);

  // Seulement les 3 derniers mois (triés desc par serveur)
  const recent  = bulletins.slice(0, DEFAULT_VISIBLE);
  const hasMore = bulletins.length > DEFAULT_VISIBLE;

  // Grouper par année
  const byYear = recent.reduce<Record<number, BulletinEntry[]>>((acc, b) => {
    if (!acc[b.year]) acc[b.year] = [];
    acc[b.year].push(b);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 md:px-0 pb-10">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#003c71]">Mes Bulletins de Salaire</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Les 3 derniers mois sont accessibles directement.
            </p>
          </div>
          <button onClick={() => setShowRequest(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#003c71] text-white text-sm font-medium hover:bg-[#003c71]/90 transition shrink-0 mt-1">
            <Send size={14} /> Faire une demande
          </button>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="bg-green-50 text-green-700 p-2.5 rounded-xl shrink-0"><BadgeDollarSign size={20} /></div>
            <div>
              <div className="text-xl font-bold text-gray-800">{loading ? "…" : recent.length}</div>
              <div className="text-xs text-gray-500">Bulletins disponibles</div>
            </div>
          </div>
          {bulletins.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="bg-blue-50 text-[#003c71] p-2.5 rounded-xl shrink-0"><FileText size={20} /></div>
              <div>
                <div className="text-xl font-bold text-gray-800">{bulletins[0].year}</div>
                <div className="text-xs text-gray-500">Dernière année</div>
              </div>
            </div>
          )}
          {hasMore && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl shrink-0"><Clock size={20} /></div>
              <div>
                <div className="text-xl font-bold text-gray-800">{bulletins.length - DEFAULT_VISIBLE}</div>
                <div className="text-xs text-gray-500">Anciens bulletins</div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Liste des 3 derniers mois ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : recent.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
            <BadgeDollarSign size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">Aucun bulletin disponible pour le moment.</p>
            <p className="text-gray-300 text-xs mt-1">Contactez votre service RH.</p>
          </motion.div>
        ) : (
          <div className="space-y-3 mb-4">
            {years.map((year, idx) => {
              const months = [...(byYear[year] || [])].sort((a, b) => b.month - a.month);
              const isOpen = openYear === year;
              return (
                <motion.div key={year} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button onClick={() => setOpenYear(isOpen ? null : year)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#003c71]/10 flex items-center justify-center">
                        <FileText size={16} className="text-[#003c71]" />
                      </div>
                      <span className="font-bold text-gray-800">{year}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                        {months.length} bulletin{months.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {matricule && months.map(b => (
                            <BulletinCard key={`${b.year}-${b.month}`} b={b} matricule={matricule} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>

      {/* ── Modal demande bulletins antérieurs ── */}
      <AnimatePresence>
        {showRequest && (
          <RequestModal
            onClose={() => setShowRequest(false)}
            onSuccess={() => setShowRequest(false)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
