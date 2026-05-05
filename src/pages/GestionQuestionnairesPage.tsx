import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import {
  ClipboardList,
  Send,
  RefreshCw,
  CheckCircle,
  Clock,
  Eye,
  X,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getQuestionnaires,
  getQuestionnaireDetail,
  envoyerQuestionnaire,
  RAISONS_DEPART,
  type QuestionnaireSortieItem,
  type QuestionnaireSortieDetail,
  type StatutQuestionnaire,
} from "@/services/questionnaireService";
import { getEmployees } from "@/services/employeeService";
import type { Employee } from "@/types/employee";

// ── KpiCard ───────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, dot, onClick, active,
}: {
  label: string; value: number; dot: string;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border bg-white transition hover:shadow-sm ${
        active
          ? "border-[#003c71] ring-2 ring-[#003c71]/20 shadow-sm"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <span className="text-2xl font-bold text-[#003c71] tabular-nums">{value}</span>
      <span className="text-xs mt-0.5 font-medium text-gray-600 inline-flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        {label}
      </span>
    </button>
  );
}

// ── StarDisplay ────────────────────────────────────────────────────────────────
function StarDisplay({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= value ? "fill-amber-400 text-amber-400" : "text-slate-200"}
        />
      ))}
    </div>
  );
}

// ── Badge statut ───────────────────────────────────────────────────────────────
function StatutBadge({ statut }: { statut: StatutQuestionnaire }) {
  return statut === "complete" ? (
    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
      <CheckCircle size={11} /> Complété
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
      <Clock size={11} /> En attente
    </span>
  );
}

// ── Modal Détail ───────────────────────────────────────────────────────────────
function DetailModal({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const [detail, setDetail]   = useState<QuestionnaireSortieDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuestionnaireDetail(id)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [id]);

  const raisonLabel =
    RAISONS_DEPART.find((r) => r.value === detail?.raison_depart)?.label ??
    detail?.raison_depart ??
    "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-camublue-900">Détail du questionnaire</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-camublue-900" size={32} />
          </div>
        ) : detail ? (
          <div className="p-6 space-y-5">
            {/* Employé */}
            <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Employé</p>
                <p className="font-semibold text-slate-800">
                  {detail.employee_prenom} {detail.employee_nom}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Matricule</p>
                <p className="font-mono text-slate-700">{detail.employee_matricule}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Service</p>
                <p className="text-slate-700">{detail.employee_service || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Statut</p>
                <StatutBadge statut={detail.statut} />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Envoyé par</p>
                <p className="text-slate-700">{detail.envoye_par || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Date réponse</p>
                <p className="text-slate-700">
                  {detail.date_reponse
                    ? new Date(detail.date_reponse).toLocaleDateString("fr-FR")
                    : "—"}
                </p>
              </div>
            </div>

            {detail.statut === "complete" ? (
              <>
                {/* Raison départ */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Raison du départ
                  </p>
                  <p className="text-sm text-slate-800 font-medium">{raisonLabel}</p>
                  {detail.raison_depart_detail && (
                    <p className="text-sm text-slate-600 mt-1 italic">
                      "{detail.raison_depart_detail}"
                    </p>
                  )}
                </div>

                {/* Satisfactions */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Satisfactions
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { label: "Satisfaction générale",           value: detail.satisfaction_generale },
                      { label: "Relation avec la hiérarchie",    value: detail.satisfaction_management },
                      { label: "Environnement de travail",       value: detail.satisfaction_environnement },
                      { label: "Rémunération & avantages",       value: detail.satisfaction_remuneration },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{label}</span>
                        <StarDisplay value={value} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommandation */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
                  <span className="text-sm font-medium text-slate-700">
                    Recommanderait Camusat ?
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      detail.recommandation ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {detail.recommandation === null ? "—" : detail.recommandation ? "Oui" : "Non"}
                  </span>
                </div>

                {/* Texte libre */}
                {[
                  { label: "Points positifs",       value: detail.points_positifs },
                  { label: "Points d'amélioration", value: detail.points_amelioration },
                  { label: "Commentaires",           value: detail.commentaires },
                ].filter(({ value }) => value).map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      {label}
                    </p>
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 italic">
                      "{value}"
                    </p>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                L'employé n'a pas encore répondu au questionnaire.
              </p>
            )}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

// ── Modal Envoi ────────────────────────────────────────────────────────────────
function EnvoiModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<Employee | null>(null);
  const [sending, setSending]       = useState(false);
  const [loadingEmp, setLoadingEmp] = useState(true);

  useEffect(() => {
    getEmployees({ status: "ACTIVE" })
      .then(setEmployees)
      .finally(() => setLoadingEmp(false));
  }, []);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.nom?.toLowerCase().includes(q) ||
      e.prenom?.toLowerCase().includes(q) ||
      e.matricule?.toLowerCase().includes(q) ||
      e.service?.toLowerCase().includes(q) ||
      e.fonction?.toLowerCase().includes(q)
    );
  });

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    try {
      await envoyerQuestionnaire(selected.id);
      toast.success(`Questionnaire envoyé à ${selected.prenom} ${selected.nom}`);
      onSent();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ?? "Erreur lors de l'envoi du questionnaire.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-camublue-900">Envoyer un questionnaire de sortie</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Sélectionnez l'employé concerné puis cliquez sur Envoyer
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Barre de recherche + compteur */}
        <div className="px-6 py-3 border-b border-slate-100 shrink-0 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, matricule, service, fonction..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              autoFocus
            />
          </div>
          {!loadingEmp && (
            <span className="text-xs text-slate-500 shrink-0">
              {filtered.length} employé{filtered.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Tableau employés */}
        <div className="flex-1 overflow-y-auto">
          {loadingEmp ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-camublue-900" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Search size={32} className="text-slate-300" />
              <p className="text-sm text-slate-400">Aucun employé trouvé.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employé</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Matricule</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fonction</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Service</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((emp) => {
                  const isSelected = selected?.id === emp.id;
                  const hasEmail   = !!emp.email;
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => hasEmail && setSelected(emp)}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-camublue-900/8 ring-inset ring-1 ring-camublue-900/20"
                          : hasEmail
                          ? "hover:bg-slate-50 cursor-pointer"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {/* Radio */}
                      <td className="px-4 py-3">
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-camublue-900 bg-camublue-900"
                              : "border-slate-300"
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </td>
                      {/* Nom */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-camublue-900/10 text-camublue-900 flex items-center justify-center text-xs font-bold shrink-0">
                            {(emp.prenom?.[0] ?? "").toUpperCase()}{(emp.nom?.[0] ?? "").toUpperCase()}
                          </div>
                          <span className={`font-medium truncate max-w-[140px] ${isSelected ? "text-camublue-900" : "text-slate-800"}`}>
                            {emp.prenom} {emp.nom}
                          </span>
                        </div>
                      </td>
                      {/* Matricule */}
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{emp.matricule}</td>
                      {/* Fonction */}
                      <td className="px-4 py-3 text-slate-600 text-xs max-w-[160px] truncate">{emp.fonction || "—"}</td>
                      {/* Service */}
                      <td className="px-4 py-3 text-slate-600 text-xs">{emp.service || "—"}</td>
                      {/* Email */}
                      <td className="px-4 py-3">
                        {hasEmail ? (
                          <span className="text-xs text-slate-500 truncate max-w-[160px] block">{emp.email}</span>
                        ) : (
                          <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">
                            Pas d'email
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center justify-between gap-4">
          {selected ? (
            <p className="text-sm text-slate-600">
              Sélectionné :{" "}
              <span className="font-semibold text-camublue-900">
                {selected.prenom} {selected.nom}
              </span>
              {" "}— {selected.email}
            </p>
          ) : (
            <p className="text-sm text-slate-400">Aucun employé sélectionné</p>
          )}
          <div className="flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSend}
              disabled={!selected || !selected.email || sending}
              className="px-5 py-2.5 rounded-xl bg-camublue-900 text-white text-sm font-semibold hover:bg-camublue-800 disabled:opacity-50 flex items-center gap-2 transition"
            >
              {sending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              Envoyer le questionnaire
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function GestionQuestionnairesPage() {
  const [items, setItems]             = useState<QuestionnaireSortieItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filtre, setFiltre]           = useState<"tous" | "envoye" | "complete">("tous");
  const [showEnvoi, setShowEnvoi]     = useState(false);
  const [selectedId, setSelectedId]   = useState<number | null>(null);

  const fetchData = async () => {
    const statut = filtre === "tous" ? undefined : (filtre as "envoye" | "complete");
    const res = await getQuestionnaires(statut);
    setItems(res.results);
  };

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [filtre]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const total    = items.length;
  const complets = items.filter((i) => i.statut === "complete").length;
  const enAttente = items.filter((i) => i.statut === "envoye").length;

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-3 p-3 sm:p-4 md:p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-camublue-900">
              Questionnaires de sortie
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Gérez les questionnaires envoyés aux employés en cours de départ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            <button
              onClick={() => setShowEnvoi(true)}
              className="flex items-center gap-1.5 bg-camublue-900 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-camublue-800 transition shadow-sm"
            >
              <Send size={14} />
              <span>Envoyer questionnaire</span>
            </button>
          </div>
        </div>

        {/* KPIs cliquables (même design que /leaves/internes) */}
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <KpiCard
            label="Total envoyés"
            value={total}
            dot="bg-slate-400"
            active={filtre === "tous"}
            onClick={() => setFiltre("tous")}
          />
          <KpiCard
            label="Complétés"
            value={complets}
            dot="bg-emerald-500"
            active={filtre === "complete"}
            onClick={() => setFiltre(filtre === "complete" ? "tous" : "complete")}
          />
          <KpiCard
            label="En attente"
            value={enAttente}
            dot="bg-amber-400"
            active={filtre === "envoye"}
            onClick={() => setFiltre(filtre === "envoye" ? "tous" : "envoye")}
          />
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-slate-100 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-camublue-900" size={28} />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <ClipboardList size={40} className="text-slate-300" />
              <p className="text-slate-400 text-sm">Aucun questionnaire pour ce filtre.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  {["Employé", "Matricule", "Service", "Envoyé le", "Statut", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.employee_prenom} {item.employee_nom}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                      {item.employee_matricule}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {item.employee_service || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(item.date_envoi).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <StatutBadge statut={item.statut} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedId(item.id)}
                        className="flex items-center gap-1 text-camublue-900 hover:underline text-xs font-medium"
                      >
                        <Eye size={13} /> Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {showEnvoi && (
          <EnvoiModal
            onClose={() => setShowEnvoi(false)}
            onSent={handleRefresh}
          />
        )}
        {selectedId !== null && (
          <DetailModal id={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
