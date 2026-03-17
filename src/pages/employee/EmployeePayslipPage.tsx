import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { BadgeDollarSign, Download, FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import { fetchAvailableBulletins } from "@/services/employeeService";
import api from "@/api/axios";
import toast from "react-hot-toast";

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
];

type BulletinEntry = { year: number; month: number };

async function downloadBulletin(matricule: string, year: number, month: number) {
  const res = await api.get(
    `/api/employees/${matricule}/download-bulletin/`,
    { params: { year, month }, responseType: "blob" }
  );
  const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/pdf" });
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `bulletin_${year}_${String(month).padStart(2, "0")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function EmployeePayslipPage() {
  const { user } = useAuth();
  const matricule = user?.employee_matricule;

  const [bulletins, setBulletins] = useState<BulletinEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [openYear, setOpenYear]   = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!matricule) { setLoading(false); return; }
    fetchAvailableBulletins(matricule)
      .then(data => {
        setBulletins(data);
        // Ouvre l'année la plus récente par défaut
        if (data.length > 0) {
          setOpenYear(Math.max(...data.map(b => b.year)));
        }
      })
      .catch(() => setBulletins([]))
      .finally(() => setLoading(false));
  }, [matricule]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDownload = async (year: number, month: number) => {
    if (!matricule) return;
    const key = `${year}-${month}`;
    setDownloading(key);
    try {
      await downloadBulletin(matricule, year, month);
      toast.success(`Bulletin ${MONTHS_FR[month-1]} ${year} téléchargé.`);
    } catch {
      toast.error("Erreur lors du téléchargement.");
    } finally {
      setDownloading(null);
    }
  };

  // Grouper par année
  const byYear = bulletins.reduce<Record<number, BulletinEntry[]>>((acc, b) => {
    if (!acc[b.year]) acc[b.year] = [];
    acc[b.year].push(b);
    return acc;
  }, {});
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <EmployeeLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-camublue-900">Mes Bulletins de Salaire</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Téléchargez vos bulletins de salaire
          </p>
        </motion.div>

        {/* Stat */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6"
        >
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="bg-green-50 text-green-700 p-3 rounded-xl">
              <BadgeDollarSign size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {loading ? "…" : bulletins.length}
              </div>
              <div className="text-sm text-gray-500">Bulletins disponibles</div>
            </div>
          </div>
          {years.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
              <div className="bg-blue-50 text-camublue-900 p-3 rounded-xl">
                <FileText size={22} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{years[0]}</div>
                <div className="text-sm text-gray-500">Dernière année disponible</div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Liste par année */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : bulletins.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm"
          >
            <BadgeDollarSign size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400 text-sm">Aucun bulletin disponible pour le moment.</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {years.map((year, idx) => {
              const months = [...(byYear[year] || [])].sort((a, b) => b.month - a.month);
              const isOpen = openYear === year;
              return (
                <motion.div
                  key={year}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => setOpenYear(isOpen ? null : year)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-camublue-900" />
                      <span className="font-semibold text-gray-800">{year}</span>
                      <span className="text-xs bg-camugray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {months.length} bulletin(s)
                      </span>
                    </div>
                    {isOpen
                      ? <ChevronUp size={18} className="text-gray-400" />
                      : <ChevronDown size={18} className="text-gray-400" />}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {months.map(b => {
                        const key = `${b.year}-${b.month}`;
                        const isLoading = downloading === key;
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between bg-camugray-100 rounded-xl px-4 py-3 border border-gray-100"
                          >
                            <div>
                              <div className="font-medium text-gray-800 text-sm">
                                {MONTHS_FR[b.month - 1]}
                              </div>
                              <div className="text-xs text-gray-400">{b.year}</div>
                            </div>
                            <button
                              onClick={() => handleDownload(b.year, b.month)}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 text-sm text-camublue-900 hover:bg-camublue-900/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                            >
                              {isLoading
                                ? <Loader2 size={15} className="animate-spin" />
                                : <Download size={15} />}
                              Télécharger
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
