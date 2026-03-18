import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeDollarSign, Download, FileText, Loader2,
  ChevronDown, ChevronUp, Eye, X,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import ManagerLayout from "@/layouts/ManagerLayout";
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

// ─── Modal de prévisualisation ───────────────────────────────────────────────

interface PreviewModalProps {
  matricule: string;
  bulletin: BulletinEntry;
  onClose: () => void;
  onDownload: (year: number, month: number) => void;
}

function PreviewModal({ matricule, bulletin, onClose, onDownload }: PreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let revoked = false;
    fetchBulletinBlobUrl(matricule, bulletin.year, bulletin.month)
      .then(url => { if (!revoked) setBlobUrl(url); })
      .catch(() => { if (!revoked) setLoadError(true); });
    return () => {
      revoked = true;
      if (blobUrl) window.URL.revokeObjectURL(blobUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matricule, bulletin.year, bulletin.month]);

  const title = `${MONTHS_FR[bulletin.month - 1]} ${bulletin.year}`;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-[#003c71]" />
          <span className="font-semibold text-gray-800 text-sm">Bulletin — {title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDownload(bulletin.year, bulletin.month)}
            className="flex items-center gap-1.5 text-sm text-[#003c71] hover:bg-[#003c71]/10 px-3 py-1.5 rounded-lg transition"
          >
            <Download size={15} />
            Télécharger
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* PDF viewer */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        {loadError ? (
          <div className="text-white text-center">
            <FileText size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm opacity-75">Impossible de charger le bulletin.</p>
          </div>
        ) : !blobUrl ? (
          <Loader2 size={32} className="text-white animate-spin" />
        ) : (
          <iframe
            src={blobUrl}
            title={`Bulletin ${title}`}
            className="w-full max-w-3xl h-full rounded-xl shadow-2xl bg-white"
            style={{ minHeight: "70vh" }}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function ManagerPayslipPage() {
  const { user } = useAuth();
  const matricule = user?.employee_matricule;

  const [bulletins, setBulletins] = useState<BulletinEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [openYear, setOpenYear]   = useState<number | null>(null);
  const [page, setPage]           = useState(0);
  const [preview, setPreview]     = useState<BulletinEntry | null>(null);

  const refresh = useCallback(() => {
    if (!matricule) { setLoading(false); return; }
    fetchAvailableBulletins(matricule)
      .then(data => {
        const sorted = [...data].sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
        setBulletins(sorted);
        if (sorted.length > 0) setOpenYear(sorted[0].year);
      })
      .catch(() => setBulletins([]))
      .finally(() => setLoading(false));
  }, [matricule]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages  = Math.ceil(bulletins.length / PAGE_SIZE);
  const paginated   = bulletins.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const byYear = paginated.reduce<Record<number, BulletinEntry[]>>((acc, b) => {
    if (!acc[b.year]) acc[b.year] = [];
    acc[b.year].push(b);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  const allYears = [...new Set(bulletins.map(b => b.year))];

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleDownload = async (year: number, month: number) => {
    if (!matricule) return;
    const key = `${year}-${month}`;
    setDownloading(key);
    try {
      await downloadBulletin(matricule, year, month);
      toast.success(`Bulletin ${MONTHS_FR[month - 1]} ${year} téléchargé.`);
    } catch {
      toast.error("Erreur lors du téléchargement.");
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = (b: BulletinEntry) => setPreview(b);

  return (
    <ManagerLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-0">
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold text-[#003c71]">Mes Bulletins de Salaire</h1>
          <p className="text-gray-500 text-sm mt-0.5">Consultez et téléchargez vos bulletins de salaire</p>
        </motion.div>

        {/* ── Stat cards ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="bg-green-50 text-green-700 p-3 rounded-xl"><BadgeDollarSign size={22} /></div>
            <div>
              <div className="text-2xl font-bold text-gray-800">{loading ? "…" : bulletins.length}</div>
              <div className="text-sm text-gray-500">Bulletins disponibles</div>
            </div>
          </div>
          {allYears.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="bg-blue-50 text-[#003c71] p-3 rounded-xl"><FileText size={22} /></div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{allYears[0]}</div>
                <div className="text-sm text-gray-500">Dernière année</div>
              </div>
            </div>
          )}
          {allYears.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="bg-purple-50 text-purple-700 p-3 rounded-xl"><FileText size={22} /></div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{allYears.length}</div>
                <div className="text-sm text-gray-500">Années couvertes</div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : bulletins.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <BadgeDollarSign size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">Aucun bulletin disponible pour le moment.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {years.map((year, idx) => {
                const months = [...(byYear[year] || [])].sort((a, b) => b.month - a.month);
                const isOpen = openYear === year;
                return (
                  <motion.div key={year} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <button onClick={() => setOpenYear(isOpen ? null : year)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-[#003c71]" />
                        <span className="font-semibold text-gray-800">{year}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{months.length} bulletin(s)</span>
                      </div>
                      {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }} className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {months.map(b => {
                              const key = `${b.year}-${b.month}`;
                              const isLoading = downloading === key;
                              return (
                                <div key={key} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                  <div>
                                    <div className="font-medium text-gray-800 text-sm">{MONTHS_FR[b.month - 1]}</div>
                                    <div className="text-xs text-gray-400">{b.year}</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {/* Prévisualiser */}
                                    <button
                                      onClick={() => handlePreview(b)}
                                      className="p-1.5 text-gray-500 hover:text-[#003c71] hover:bg-[#003c71]/10 rounded-lg transition"
                                      title="Visualiser"
                                    >
                                      <Eye size={15} />
                                    </button>
                                    {/* Télécharger */}
                                    <button
                                      onClick={() => handleDownload(b.year, b.month)}
                                      disabled={isLoading}
                                      className="flex items-center gap-1.5 text-sm text-[#003c71] hover:bg-[#003c71]/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                                      title="Télécharger"
                                    >
                                      {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                      Télécharger
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
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => { setPage(p => p - 1); setOpenYear(null); }}
                  disabled={page === 0}
                  className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-600 font-medium">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => { setPage(p => p + 1); setOpenYear(null); }}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Preview modal ── */}
      <AnimatePresence>
        {preview && matricule && (
          <PreviewModal
            matricule={matricule}
            bulletin={preview}
            onClose={() => setPreview(null)}
            onDownload={(year, month) => { handleDownload(year, month); }}
          />
        )}
      </AnimatePresence>
    </ManagerLayout>
  );
}
