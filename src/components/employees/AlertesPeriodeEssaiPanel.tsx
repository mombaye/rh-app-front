import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import { FaBell } from "react-icons/fa";
import type { AlertePeriodeEssai } from "@/services/employeeService";
import AlerteEmployeeDetailModal from "./AlerteEmployeeDetailModal";

const PAGE_SIZE = 10;

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function urgencyBadge(j: number): string {
  if (j <= 7)  return "bg-red-100 text-red-700 ring-1 ring-red-200";
  if (j <= 15) return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
  return "bg-green-100 text-green-700 ring-1 ring-green-200";
}

export default function AlertesPeriodeEssaiPanel({
  alertes,
  loading,
  services = [],
  serviceFiltre = "TOUS",
  onServiceFiltreChange,
}: {
  alertes: AlertePeriodeEssai[];
  loading: boolean;
  services?: string[];
  serviceFiltre?: string;
  onServiceFiltreChange?: (service: string) => void;
}) {
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<AlertePeriodeEssai | null>(null);
  const [page,     setPage]     = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  // Réinitialiser la page quand la liste ou la recherche change
  useEffect(() => { setPage(1); }, [alertes, search]);

  const q = search.trim().toLowerCase();
  const rows = q
    ? alertes.filter((a) =>
        a.matricule.toLowerCase().includes(q) ||
        a.nom.toLowerCase().includes(q)       ||
        a.prenom.toLowerCase().includes(q)    ||
        (a.service || "").toLowerCase().includes(q)
      )
    : alertes;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <ImSpinner2 className="animate-spin text-camublue-900" size={28} />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">

        {/* ── Barre de recherche ── */}
        <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par matricule, nom, service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
            />
          </div>
          {rows.length > 0 && (
            <span className="text-xs text-slate-500 shrink-0">
              {rows.length} employé{rows.length > 1 ? "s" : ""}
            </span>
          )}

          {/* ── Bouton Filtre (par service) ── */}
          <button
            onClick={() => setFilterOpen(true)}
            className="relative shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-camublue-900 text-white text-xs font-semibold shadow-sm hover:bg-camublue-800 transition"
          >
            <SlidersHorizontal size={14} />
            Filtre
            {serviceFiltre !== "TOUS" && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
            )}
          </button>
        </div>

        {/* ── Modal Filtre ── */}
        <AnimatePresence>
          {filterOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
              onClick={() => setFilterOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
              >
                {/* En-tête */}
                <div className="flex items-center justify-between px-5 py-4 bg-camublue-900">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <SlidersHorizontal size={16} />
                    Filtrer les alertes
                  </h3>
                  <button
                    onClick={() => setFilterOpen(false)}
                    className="text-white/80 hover:text-white transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Contenu */}
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      Service
                    </label>
                    <select
                      value={serviceFiltre}
                      onChange={(e) => onServiceFiltreChange?.(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 focus:border-camublue-900"
                    >
                      <option value="TOUS">Tous les services</option>
                      {services.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Pied */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => onServiceFiltreChange?.("TOUS")}
                    disabled={serviceFiltre === "TOUS"}
                    className="text-xs font-medium text-slate-500 hover:text-camublue-900 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Réinitialiser
                  </button>
                  <button
                    onClick={() => setFilterOpen(false)}
                    className="px-4 py-2 rounded-xl bg-camublue-900 text-white text-xs font-semibold shadow-sm hover:bg-camublue-800 transition"
                  >
                    Appliquer
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Table / Empty ── */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <FaBell size={36} className="text-slate-200" />
            <p className="text-slate-400 text-sm">
              {alertes.length === 0
                ? "Aucune alerte dans les 30 prochains jours"
                : "Aucun résultat pour cette recherche"}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                <tr>
                  {["Employé", "Matricule", "Fonction", "Service", "Type", "Date fin", "Jours"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paged.map((a) => (
                  <tr
                    key={`${a.id}-${a.type_alerte}`}
                    onClick={() => setSelected(a)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {a.prenom} {a.nom}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">{a.matricule}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{a.fonction || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{a.service || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        a.type_alerte === "PERIODE_ESSAI"
                          ? "bg-violet-100 text-violet-700"
                          : a.type_alerte === "FIN_STAGE"
                          ? "bg-blue-100 text-blue-700"
                          : a.type_alerte === "FIN_INTERIM"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {a.type_alerte === "PERIODE_ESSAI"
                          ? "Période d'essai"
                          : a.type_alerte === "FIN_STAGE"
                          ? "Fin de stage"
                          : a.type_alerte === "FIN_INTERIM"
                          ? "Fin intérim"
                          : "Fin CDD"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium tabular-nums text-xs">
                      {fmtDate(a.date_fin)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${urgencyBadge(a.jours_restants)}`}>
                        {a.jours_restants}j
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white">
                <span className="text-xs text-slate-400">
                  Page <span className="font-semibold text-slate-600">{safePage}</span> sur{" "}
                  <span className="font-semibold text-slate-600">{totalPages}</span>
                  <span className="ml-2 text-slate-300">·</span>
                  <span className="ml-2">{rows.length} résultat{rows.length > 1 ? "s" : ""}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {/* Numéros de page */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "…" ? (
                        <span key={`sep-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item as number)}
                          className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold transition ${
                            safePage === item
                              ? "bg-camublue-900 text-white"
                              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal détail employé ── */}
      <AlerteEmployeeDetailModal
        alerte={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
