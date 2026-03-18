import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeDollarSign, Download, FileText, Loader2,
  ChevronDown, ChevronUp, Eye, X,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { fetchAvailableBulletins } from "@/services/employeeService";
import api from "@/api/axios";
import toast from "react-hot-toast";

// ─── Config ──────────────────────────────────────────────────────────────────
const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const PAGE_SIZE = 12; // 12 bulletins par page = 1 an

type BulletinEntry = { year: number; month: number };

// ─── Fonctions utilitaires ───────────────────────────────────────────────────

/** Télécharge un bulletin (Content-Disposition: attachment) */
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

/** Charge un bulletin en mémoire et retourne une URL blob pour l'iframe */
async function fetchBulletinBlobUrl(matricule: string, year: number, month: number): Promise<string> {
  const res = await api.get(
    `/api/employees/${matricule}/download-bulletin/`,
    { params: { year, month, preview: true }, responseType: "blob" },
  );
  const blob = new Blob([res.data], { type: "application/pdf" });
  return window.URL.createObjectURL(blob);
}

// ─── Modal de prévisualisation PDF ───────────────────────────────────────────
function PreviewModal({
  matricule, year, month,
  onClose,
}: {
  matricule: string;
  year: number;
  month: number;
  onClose: () => void;
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
    try {
      await downloadBulletin(matricule, year, month);
      toast.success("Bulletin téléchargé !");
    } catch {
      toast.error("Erreur lors du téléchargement.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Barre supérieure */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-900/90 border-b border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#003c71] flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              Bulletin — {MONTHS_FR[month - 1]} {year}
            </p>
            <p className="text-gray-400 text-xs">Prévisualisation PDF</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#003c71] text-white text-xs font-medium hover:bg-[#003c71]/80 transition"
          >
            <Download size={13} />
            Télécharger
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <X size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Zone PDF */}
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
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#003c71] text-white text-sm hover:bg-[#003c71]/80 transition"
            >
              <Download size={15} />
              Télécharger à la place
            </button>
          </div>
        ) : blobUrl ? (
          <iframe
            src={blobUrl}
            className="w-full h-full rounded-xl shadow-2xl bg-white"
            style={{ maxWidth: "900px", minHeight: "calc(100vh - 120px)" }}
            title={`Bulletin ${MONTHS_FR[month - 1]} ${year}`}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
interface EmployeePayslipPageProps {
  layout?: React.ComponentType<{ children: React.ReactNode }>;
}

export default function EmployeePayslipPage({
  layout: Layout = EmployeeLayout,
}: EmployeePayslipPageProps) {
  const { user } = useAuth();
  const matricule = user?.employee_matricule;

  const [bulletins,    setBulletins]    = useState<BulletinEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [downloading,  setDownloading]  = useState<string | null>(null);
  const [previewing,   setPreviewing]   = useState<string | null>(null);
  const [openYear,     setOpenYear]     = useState<number | null>(null);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [previewEntry, setPreviewEntry] = useState<BulletinEntry | null>(null);

  const refresh = useCallback(() => {
    if (!matricule) { setLoading(false); return; }
    fetchAvailableBulletins(matricule)
      .then(data => {
        setBulletins(data); // déjà trié par (year desc, month desc) côté serveur
        if (data.length > 0) setOpenYear(data[0].year);
      })
      .catch(() => setBulletins([]))
      .finally(() => setLoading(false));
  }, [matricule]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(bulletins.length / PAGE_SIZE));
  const paginated  = bulletins.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Grouper les bulletins de la page courante par année
  const byYear = paginated.reduce<Record<number, BulletinEntry[]>>((acc, b) => {
    if (!acc[b.year]) acc[b.year] = [];
    acc[b.year].push(b);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDownload = async (b: BulletinEntry) => {
    if (!matricule) return;
    const key = `dl-${b.year}-${b.month}`;
    setDownloading(key);
    try {
      await downloadBulletin(matricule, b.year, b.month);
      toast.success(`Bulletin ${MONTHS_FR[b.month - 1]} ${b.year} téléchargé.`);
    } catch {
      toast.error("Erreur lors du téléchargement. Vérifiez que le fichier est disponible.");
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (b: BulletinEntry) => {
    if (!matricule) return;
    const key = `pv-${b.year}-${b.month}`;
    setPreviewing(key);
    // On ouvre la modal immédiatement, qui gère son propre chargement
    setPreviewEntry(b);
    setPreviewing(null);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const years_all = [...new Set(bulletins.map(b => b.year))].sort((a, b) => b - a);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 md:px-0 pb-10">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-[#003c71]">Mes Bulletins de Salaire</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Visualisez et téléchargez vos bulletins de salaire
          </p>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6"
        >
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="bg-green-50 text-green-700 p-2.5 rounded-xl shrink-0">
              <BadgeDollarSign size={20} />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">{loading ? "…" : bulletins.length}</div>
              <div className="text-xs text-gray-500">Bulletins disponibles</div>
            </div>
          </div>

          {years_all.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="bg-blue-50 text-[#003c71] p-2.5 rounded-xl shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-800">{years_all[0]}</div>
                <div className="text-xs text-gray-500">Dernière année</div>
              </div>
            </div>
          )}

          {years_all.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="bg-purple-50 text-purple-700 p-2.5 rounded-xl shrink-0">
                <Eye size={20} />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-800">{years_all.length}</div>
                <div className="text-xs text-gray-500">Année{years_all.length > 1 ? "s" : ""} couverte{years_all.length > 1 ? "s" : ""}</div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Liste ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : bulletins.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm"
          >
            <BadgeDollarSign size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">Aucun bulletin disponible pour le moment.</p>
            <p className="text-gray-300 text-xs mt-1">Contactez votre service RH.</p>
          </motion.div>
        ) : (
          <>
            <div className="space-y-3">
              {years.map((year, idx) => {
                const months = [...(byYear[year] || [])].sort((a, b) => b.month - a.month);
                const isOpen = openYear === year;
                return (
                  <motion.div
                    key={year}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* En-tête année */}
                    <button
                      onClick={() => setOpenYear(isOpen ? null : year)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#003c71]/10 flex items-center justify-center">
                          <FileText size={16} className="text-[#003c71]" />
                        </div>
                        <span className="font-bold text-gray-800">{year}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                          {months.length} bulletin{months.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      {isOpen
                        ? <ChevronUp size={18} className="text-gray-400" />
                        : <ChevronDown size={18} className="text-gray-400" />}
                    </button>

                    {/* Liste des mois */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {months.map(b => {
                              const dlKey = `dl-${b.year}-${b.month}`;
                              const pvKey = `pv-${b.year}-${b.month}`;
                              const isDownloading = downloading === dlKey;
                              const isPreviewing  = previewing  === pvKey;

                              return (
                                <div
                                  key={`${b.year}-${b.month}`}
                                  className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 hover:border-gray-200 transition group"
                                >
                                  {/* Icône mois */}
                                  <div className="w-9 h-9 rounded-lg bg-[#003c71]/10 flex flex-col items-center justify-center shrink-0">
                                    <span className="text-[10px] font-bold text-[#003c71] leading-none">
                                      {MONTHS_FR[b.month - 1].slice(0, 3).toUpperCase()}
                                    </span>
                                    <span className="text-[9px] text-gray-400 leading-none mt-0.5">{b.year}</span>
                                  </div>

                                  {/* Label */}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-800 text-sm">
                                      {MONTHS_FR[b.month - 1]}
                                    </div>
                                    <div className="text-[11px] text-gray-400">{b.year}</div>
                                  </div>

                                  {/* Boutons */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Prévisualiser */}
                                    <button
                                      onClick={() => handlePreview(b)}
                                      disabled={isPreviewing}
                                      title="Visualiser"
                                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#003c71] hover:bg-[#003c71]/10 transition disabled:opacity-50"
                                    >
                                      {isPreviewing
                                        ? <Loader2 size={15} className="animate-spin" />
                                        : <Eye size={15} />}
                                    </button>

                                    {/* Télécharger */}
                                    <button
                                      onClick={() => handleDownload(b)}
                                      disabled={isDownloading}
                                      title="Télécharger"
                                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[#003c71] hover:bg-[#003c71]/10 transition disabled:opacity-50"
                                    >
                                      {isDownloading
                                        ? <Loader2 size={15} className="animate-spin" />
                                        : <Download size={15} />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3"
              >
                <span className="text-xs text-gray-400">
                  {bulletins.length} bulletin{bulletins.length > 1 ? "s" : ""} · Page {currentPage} / {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setOpenYear(null); }}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => { setCurrentPage(page); setOpenYear(null); }}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition ${
                        page === currentPage
                          ? "bg-[#003c71] text-white shadow-sm"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setOpenYear(null); }}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* ── Modal prévisualisation ── */}
      <AnimatePresence>
        {previewEntry && matricule && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PreviewModal
              matricule={matricule}
              year={previewEntry.year}
              month={previewEntry.month}
              onClose={() => setPreviewEntry(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
