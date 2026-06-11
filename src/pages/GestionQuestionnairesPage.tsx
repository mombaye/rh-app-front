import { useCallback, useEffect, useState } from "react";
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
  UserX,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getQuestionnaires,
  getQuestionnaireDetail,
  envoyerQuestionnaire,
  toggleCompteQuestionnaire,
  RAISONS_DEPART,
  SAT4_LABELS, SAT4_EMOJIS,
  REL5_LABELS, REL5_EMOJIS,
  OUI_NON_LABELS,
  type QuestionnaireSortieItem,
  type QuestionnaireSortieDetail,
  type StatutQuestionnaire,
} from "@/services/questionnaireService";
import { getEmployees } from "@/services/employeeService";
import type { Employee } from "@/types/employee";
import { onEmployeesSynced } from "@/utils/employeeSync";

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

// ── Helpers affichage ─────────────────────────────────────────────────────────
function RatingBadge({ value, labels, emojis }: { value: number | null; labels: string[]; emojis: string[] }) {
  if (!value) return <span className="text-slate-400 text-xs">—</span>;
  const label = labels[value - 1] ?? String(value);
  const emoji = emojis[value - 1] ?? "";
  const isNA  = emoji === "N/A";
  const isNeg = value <= Math.ceil(labels.length / 2) && !isNA;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
      isNA ? "bg-slate-100 text-slate-500" : isNeg ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
    }`}>
      {isNA ? "N/A" : emoji} {label}
    </span>
  );
}

function TextField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 italic">"{value}"</p>
    </div>
  );
}

function SectionTitle({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="w-6 h-6 rounded-full bg-[#003c71] text-white text-xs font-bold flex items-center justify-center shrink-0">{num}</span>
      <p className="text-sm font-bold text-[#003c71]">{title}</p>
    </div>
  );
}

// ── Modal Détail ───────────────────────────────────────────────────────────────
function DetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [detail, setDetail]   = useState<QuestionnaireSortieDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuestionnaireDetail(id).then(setDetail).finally(() => setLoading(false));
  }, [id]);

  const isV2 = !!(detail?.motifs_depart && detail.motifs_depart.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-[#003c71]">Questionnaire de sortie</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} className="text-slate-500" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-[#003c71]" size={32} />
          </div>
        ) : detail ? (
          <div className="p-6 space-y-5">

            {/* ── Section 1 : Identification ── */}
            <div className="bg-[#003c71]/5 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm border border-[#003c71]/10">
              {[
                ["Employé",     `${detail.employee_prenom} ${detail.employee_nom}`],
                ["Matricule",   detail.employee_matricule],
                ["Service",     detail.employee_service || "—"],
                ["Fonction",    detail.employee_fonction || "—"],
                ["Envoyé par",  detail.envoye_par || "—"],
                ["Réponse le",  detail.date_reponse ? new Date(detail.date_reponse).toLocaleDateString("fr-FR") : "—"],
              ].map(([lbl, val]) => (
                <div key={lbl}>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{lbl}</p>
                  <p className="font-medium text-slate-800">{val}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Statut</p>
                <StatutBadge statut={detail.statut} />
              </div>
            </div>

            {detail.statut === "complete" ? (<>

              {isV2 ? (<>
                {/* ── Section 2 ── */}
                <SectionTitle num="2" title="Motifs de départ" />

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Motifs sélectionnés</p>
                  <div className="flex flex-wrap gap-2">
                    {(detail.motifs_depart ?? []).map(m => {
                      const found = RAISONS_DEPART.find(r => r.value === m);
                      return (
                        <span key={m} className="text-xs font-medium px-3 py-1 bg-[#003c71]/10 text-[#003c71] rounded-full">
                          {found?.label ?? m}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <TextField label="Commentaires sur les motifs"    value={detail.motifs_commentaires} />
                <TextField label="2.2 Évènement déclencheur"      value={detail.evenement_declencheur} />
                <TextField label="2.3 Échange avec le manager"    value={detail.echange_manager_avant} />

                {/* ── Section 3 ── */}
                <SectionTitle num="3" title="Emploi" />

                <TextField label="3.1 Motivation à rejoindre CAMUSAT" value={detail.motivation_rejoindre} />

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Satisfactions</p>
                  <div className="space-y-2">
                    {([
                      ["3.2 Missions confiées conformes",            detail.sat_missions,         detail.sat_comments?.missions],
                      ["3.3 Moyens pour exercer les fonctions",      detail.sat_moyens,           detail.sat_comments?.moyens],
                      ["3.4 Objectifs précis",                       detail.sat_objectifs,        detail.sat_comments?.objectifs],
                      ["3.5 Soutien suffisant",                      detail.sat_soutien,          detail.sat_comments?.soutien],
                      ["3.6 Charge de travail réaliste",             detail.sat_charge_travail,   detail.sat_comments?.charge],
                      ["3.7 Aide à atteindre le projet de carrière", detail.sat_evolution_carriere, detail.sat_comments?.evolution],
                    ] as [string, number | null, string | undefined][]).map(([lbl, val, cmt]) => (
                      <div key={lbl} className="py-1.5 border-b border-slate-50 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">{lbl}</span>
                          <RatingBadge value={val} labels={SAT4_LABELS} emojis={SAT4_EMOJIS} />
                        </div>
                        {cmt && <p className="text-xs text-slate-400 italic mt-0.5 pl-2">"{cmt}"</p>}
                      </div>
                    ))}
                  </div>
                </div>

                <TextField label="3.8 Aspect le plus satisfaisant"   value={detail.aspect_satisfaisant} />
                <TextField label="3.9 Aspect le moins satisfaisant"  value={detail.aspect_insatisfaisant} />
                <TextField label="3.10 Compétences développées"      value={detail.competences_developpees} />

                {/* ── Section 4 ── */}
                <SectionTitle num="4" title="Environnement de travail" />

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Relations</p>
                  <div className="space-y-2">
                    {([
                      ["4.1.1 Support Groupe",          detail.rel_support_groupe,    detail.rel_comments?.support],
                      ["4.1.2 Direction de la filiale", detail.rel_direction_filiale, detail.rel_comments?.direction],
                      ["4.1.3 Manager",                 detail.rel_manager,           detail.rel_comments?.manager],
                      ["4.1.4 Collègues de l'équipe",   detail.rel_collegues,         detail.rel_comments?.collegues],
                      ["4.1.5 Autres services",         detail.rel_autres_services,   detail.rel_comments?.autres],
                      ["4.1.6 Clients",                 detail.rel_clients,           detail.rel_comments?.clients],
                      ["4.1.7 Fournisseurs",            detail.rel_fournisseurs,      detail.rel_comments?.fournisseurs],
                      ["4.1.8 Sous-traitants",          detail.rel_sous_traitants,    detail.rel_comments?.sous_traitants],
                    ] as [string, number | null, string | undefined][]).map(([lbl, val, cmt]) => (
                      <div key={lbl} className="py-1.5 border-b border-slate-50 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">{lbl}</span>
                          <RatingBadge value={val} labels={REL5_LABELS} emojis={REL5_EMOJIS} />
                        </div>
                        {cmt && <p className="text-xs text-slate-400 italic mt-0.5 pl-2">"{cmt}"</p>}
                      </div>
                    ))}
                  </div>
                </div>

                <TextField label="Commentaire relations"             value={detail.rel_commentaire} />
                <TextField label="4.2 Améliorations environnement"  value={detail.amelioration_environnement} />

                {/* ── Section 5 ── */}
                <SectionTitle num="5" title="Divers" />

                <TextField label="5.1 Profil pour remplacement"      value={detail.profil_remplacement} />
                <TextField label="5.2 Qualités requises pour le poste" value={detail.qualites_poste} />

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">5.3 Retravaillerait chez CAMUSAT</p>
                    <p className={`text-sm font-bold ${
                      detail.retravaillerait_camusat === "oui" ? "text-green-600" :
                      detail.retravaillerait_camusat === "non" ? "text-red-600" : "text-amber-600"
                    }`}>
                      {detail.retravaillerait_camusat ? OUI_NON_LABELS[detail.retravaillerait_camusat] : "—"}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-1">5.4 Recommande CAMUSAT</p>
                    <p className={`text-sm font-bold ${
                      detail.recommande_camusat === "oui" ? "text-green-600" :
                      detail.recommande_camusat === "non" ? "text-red-600" : "text-amber-600"
                    }`}>
                      {detail.recommande_camusat ? OUI_NON_LABELS[detail.recommande_camusat] : "—"}
                    </p>
                  </div>
                </div>

                <TextField label="5.5 Nouveau poste / entreprise"    value={detail.nouveau_poste_entreprise} />
                <TextField label="5.6 Suggestions et commentaires"   value={detail.suggestions_commentaires} />

              </>) : (<>
                {/* ── Ancien format (rétrocompat) ── */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Raison du départ</p>
                  <p className="text-sm text-slate-800 font-medium">
                    {RAISONS_DEPART.find(r => r.value === detail.raison_depart)?.label ?? detail.raison_depart ?? "—"}
                  </p>
                  {detail.raison_depart_detail && (
                    <p className="text-sm text-slate-600 mt-1 italic">"{detail.raison_depart_detail}"</p>
                  )}
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: "Satisfaction générale",       value: detail.satisfaction_generale },
                    { label: "Relation avec la hiérarchie", value: detail.satisfaction_management },
                    { label: "Environnement de travail",    value: detail.satisfaction_environnement },
                    { label: "Rémunération & avantages",    value: detail.satisfaction_remuneration },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{label}</span>
                      <StarDisplay value={value} />
                    </div>
                  ))}
                </div>
                {[
                  { label: "Points positifs",       value: detail.points_positifs },
                  { label: "Points d'amélioration", value: detail.points_amelioration },
                  { label: "Commentaires",           value: detail.commentaires },
                ].filter(f => f.value).map(f => <TextField key={f.label} label={f.label} value={f.value} />)}
              </>)}

            </>) : (
              <p className="text-sm text-slate-500 text-center py-6">
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

  const loadEmployees = useCallback(() => {
    setLoadingEmp(true);
    getEmployees({ status: "ACTIVE" })
      .then(setEmployees)
      .finally(() => setLoadingEmp(false));
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  useEffect(() => {
    return onEmployeesSynced(() => { loadEmployees(); });
  }, [loadEmployees]);

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
  const [items, setItems]               = useState<QuestionnaireSortieItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [filtre, setFiltre]             = useState<"tous" | "envoye" | "complete">("tous");
  const [showEnvoi, setShowEnvoi]       = useState(false);
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [toggleTarget, setToggleTarget] = useState<QuestionnaireSortieItem | null>(null);
  const [toggling, setToggling]         = useState(false);

  const fetchData = async () => {
    try {
      const statut = filtre === "tous" ? undefined : (filtre as "envoye" | "complete");
      const res = await getQuestionnaires(statut);
      setItems(res.results ?? []);
    } catch {
      setItems([]);
    }
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

  const handleToggleCompte = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      const res = await toggleCompteQuestionnaire(toggleTarget.id);
      toast.success(res.message);
      setToggleTarget(null);
      await fetchData();
    } catch {
      toast.error("Erreur lors de la mise à jour du compte.");
    } finally {
      setToggling(false);
    }
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
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  {["Employé", "Matricule", "Service", "Envoyé le", "Statut", "Actions"].map((h) => (
                    <th key={h} className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-center font-medium text-slate-800 truncate">
                      {item.employee_prenom} {item.employee_nom}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-500 text-xs">
                      {item.employee_matricule}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 text-xs truncate">
                      {item.employee_service || "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 text-xs">
                      {new Date(item.date_envoi).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <StatutBadge statut={item.statut} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedId(item.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-camublue-900 hover:bg-camublue-800 text-white text-xs font-semibold transition"
                        >
                          <Eye size={12} /> Voir
                        </button>
                        {item.user_id !== null && (
                          <button
                            onClick={() => setToggleTarget(item)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              item.user_is_active === false
                                ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-700"
                                : "bg-red-100 hover:bg-red-200 text-red-600"
                            }`}
                          >
                            {item.user_is_active === false ? (
                              <><UserCheck size={12} /> Activer</>
                            ) : (
                              <><UserX size={12} /> Désactiver</>
                            )}
                          </button>
                        )}
                      </div>
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

        {/* Modal confirmation toggle compte */}
        {toggleTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            >
              {/* Icône */}
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                toggleTarget.user_is_active === false ? "bg-emerald-100" : "bg-red-100"
              }`}>
                {toggleTarget.user_is_active === false
                  ? <UserCheck size={22} className="text-emerald-600" />
                  : <UserX size={22} className="text-red-500" />
                }
              </div>

              <h2 className="text-lg font-bold text-slate-800 text-center mb-1">
                {toggleTarget.user_is_active === false ? "Activer le compte ?" : "Désactiver le compte ?"}
              </h2>

              <p className="text-sm text-slate-500 text-center mb-2">
                <span className="font-semibold text-slate-700">
                  {toggleTarget.employee_prenom} {toggleTarget.employee_nom}
                </span>{" "}
                — {toggleTarget.employee_matricule}
              </p>

              {toggleTarget.user_is_active !== false && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-xs text-red-700">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>
                    L'employé ne pourra plus se connecter à la plateforme. Un message lui indiquera que son compte est désactivé.
                  </span>
                </div>
              )}
              {toggleTarget.user_is_active === false && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5 text-xs text-emerald-700">
                  <UserCheck size={13} className="shrink-0 mt-0.5" />
                  <span>
                    L'employé pourra à nouveau se connecter à la plateforme avec ses identifiants habituels.
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setToggleTarget(null)}
                  disabled={toggling}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleToggleCompte}
                  disabled={toggling}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition disabled:opacity-50 ${
                    toggleTarget.user_is_active === false
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {toggling
                    ? <Loader2 size={14} className="animate-spin" />
                    : toggleTarget.user_is_active === false
                    ? <><UserCheck size={14} /> Activer</>
                    : <><UserX size={14} /> Désactiver</>
                  }
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
