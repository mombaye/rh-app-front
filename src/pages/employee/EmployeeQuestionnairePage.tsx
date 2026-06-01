import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Star, Loader2, ClipboardList,
  Clock, AlertTriangle, CalendarDays, ChevronLeft,
  ChevronRight, ThumbsUp, ThumbsDown,
} from "lucide-react";
import EmployeeLayout from "@/layouts/EmployeeLayout";

type LayoutComponent = React.ComponentType<{ children: React.ReactNode }>;
import {
  getMonQuestionnaire,
  repondreQuestionnaire,
  RAISONS_DEPART,
  type MonQuestionnaire,
  type RepondrePayload,
} from "@/services/questionnaireService";

// ── Helpers ────────────────────────────────────────────────────────────────────

function joursRestants(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

// ── StarRating ─────────────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const LABELS = ["Très insatisfait", "Insatisfait", "Neutre", "Satisfait", "Très satisfait"];
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            className="transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              size={40}
              className={`transition-colors ${
                display !== null && n <= display
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-200 hover:text-amber-200"
              }`}
            />
          </button>
        ))}
      </div>
      <span className={`text-sm font-medium transition-all ${display !== null ? "text-slate-600" : "text-slate-300"}`}>
        {display !== null ? LABELS[display - 1] : "Sélectionnez une note"}
      </span>
    </div>
  );
}

// ── SuspensionBanner ───────────────────────────────────────────────────────────
function SuspensionBanner({ dateSortie }: { dateSortie: string | null }) {
  const jours = joursRestants(dateSortie);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5"
    >
      <div className="p-2 rounded-xl bg-amber-100 shrink-0">
        <CalendarDays className="text-amber-600" size={20} />
      </div>
      <div>
        <p className="font-semibold text-amber-800 text-sm">
          {jours !== null && jours > 0
            ? `Dans ${jours} jour${jours > 1 ? "s" : ""}, votre accès sera désactivé.`
            : "Votre accès sera prochainement désactivé."}
        </p>
        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
          Merci pour votre collaboration et votre engagement au sein de Camusat.
          Nous vous souhaitons une belle continuation dans vos projets futurs.
        </p>
      </div>
    </motion.div>
  );
}

// ── Types formulaire ───────────────────────────────────────────────────────────
interface FormData {
  raison:         string;
  raisonDetail:   string;
  satGen:         number | null;
  satMgmt:        number | null;
  satEnv:         number | null;
  satRem:         number | null;
  recommandation: boolean | null;
  pointsPos:      string;
  pointsAmel:     string;
  commentaires:   string;
}

const INIT: FormData = {
  raison: "", raisonDetail: "",
  satGen: null, satMgmt: null, satEnv: null, satRem: null,
  recommandation: null,
  pointsPos: "", pointsAmel: "", commentaires: "",
};

// ── Définition des étapes ──────────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: "Raison du départ",        subtitle: "Pourquoi quittez-vous Camusat ?" },
  { id: 2, title: "Satisfaction générale",    subtitle: "Comment évaluez-vous votre expérience globale ?" },
  { id: 3, title: "Relation hiérarchique",    subtitle: "Comment était votre relation avec votre manager ?" },
  { id: 4, title: "Environnement de travail", subtitle: "Comment étiez-vous dans vos conditions de travail ?" },
  { id: 5, title: "Rémunération",             subtitle: "Étiez-vous satisfait de votre rémunération ?" },
  { id: 6, title: "Recommandation",           subtitle: "Recommanderiez-vous Camusat comme employeur ?" },
  { id: 7, title: "Commentaires libres",      subtitle: "Partagez d'autres retours (facultatif)" },
];

const TOTAL = STEPS.length;

// ── Page principale ────────────────────────────────────────────────────────────
export default function EmployeeQuestionnairePage({ layout: Layout = EmployeeLayout }: { layout?: LayoutComponent }) {
  const [info,       setInfo]       = useState<MonQuestionnaire | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stepError,  setStepError]  = useState<string | null>(null);

  const [step, setStep]   = useState(1);
  const [dir,  setDir]    = useState(1);   // 1 = forward, -1 = backward
  const [form, setForm]   = useState<FormData>(INIT);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMonQuestionnaire()
      .then((d) => { setInfo(d); if (d.statut === "complete") setSubmitted(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, []);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return form.raison !== "";
      case 2: return form.satGen !== null;
      case 3: return form.satMgmt !== null;
      case 4: return form.satEnv !== null;
      case 5: return form.satRem !== null;
      case 6: return form.recommandation !== null;
      default: return true;
    }
  };

  const goNext = () => {
    if (!canAdvance()) {
      setStepError("Veuillez répondre à cette question avant de continuer.");
      return;
    }
    setStepError(null);
    setDir(1);
    setStep((s) => Math.min(s + 1, TOTAL));
    scrollTop();
  };

  const goBack = () => {
    setStepError(null);
    setDir(-1);
    setStep((s) => Math.max(s - 1, 1));
    scrollTop();
  };

  const handleSubmit = async () => {
    if (!info) return;
    setSubmitting(true);
    setStepError(null);
    const payload: RepondrePayload = {
      raison_depart:              form.raison,
      raison_depart_detail:       form.raisonDetail,
      satisfaction_generale:      form.satGen!,
      satisfaction_management:    form.satMgmt!,
      satisfaction_environnement: form.satEnv!,
      satisfaction_remuneration:  form.satRem!,
      recommandation:             form.recommandation!,
      points_positifs:            form.pointsPos,
      points_amelioration:        form.pointsAmel,
      commentaires:               form.commentaires,
    };
    try {
      await repondreQuestionnaire(info.token, payload);
      setSubmitted(true);
    } catch {
      setStepError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Slide animation variants ───────────────────────────────────────────────
  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  // ── Contenu de chaque étape ────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RAISONS_DEPART.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, raison: r.value })); setStepError(null); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                    form.raison === r.value
                      ? "bg-camublue-900 text-white border-camublue-900 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-camublue-900/40 hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    form.raison === r.value ? "border-white" : "border-slate-300"
                  }`}>
                    {form.raison === r.value && <span className="w-2 h-2 rounded-full bg-white" />}
                  </span>
                  {r.label}
                </button>
              ))}
            </div>
            {form.raison === "autre" && (
              <textarea
                className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                rows={2}
                placeholder="Précisez la raison..."
                value={form.raisonDetail}
                onChange={(e) => setForm((f) => ({ ...f, raisonDetail: e.target.value }))}
              />
            )}
          </div>
        );

      case 2:
        return <StarRating value={form.satGen} onChange={(v) => { setForm((f) => ({ ...f, satGen: v })); setStepError(null); }} />;
      case 3:
        return <StarRating value={form.satMgmt} onChange={(v) => { setForm((f) => ({ ...f, satMgmt: v })); setStepError(null); }} />;
      case 4:
        return <StarRating value={form.satEnv} onChange={(v) => { setForm((f) => ({ ...f, satEnv: v })); setStepError(null); }} />;
      case 5:
        return <StarRating value={form.satRem} onChange={(v) => { setForm((f) => ({ ...f, satRem: v })); setStepError(null); }} />;

      case 6:
        return (
          <div className="flex gap-5 justify-center py-2">
            {[
              { label: "Oui, volontiers",  value: true,  icon: <ThumbsUp size={22} />,  cls: "green" },
              { label: "Non, pas vraiment", value: false, icon: <ThumbsDown size={22} />, cls: "red"   },
            ].map(({ label, value, icon, cls }) => (
              <button
                key={label}
                type="button"
                onClick={() => { setForm((f) => ({ ...f, recommandation: value })); setStepError(null); }}
                className={`flex flex-col items-center gap-3 px-8 py-5 rounded-2xl border-2 font-semibold text-sm transition-all ${
                  form.recommandation === value
                    ? cls === "green"
                      ? "bg-green-500 text-white border-green-500 shadow-md"
                      : "bg-red-500 text-white border-red-500 shadow-md"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            {[
              { key: "pointsPos",  label: "Points positifs",        placeholder: "Quels aspects avez-vous le plus appréciés ?" },
              { key: "pointsAmel", label: "Points d'amélioration",  placeholder: "Quels aspects auraient pu être améliorés ?" },
              { key: "commentaires", label: "Commentaires supplémentaires", placeholder: "Avez-vous d'autres remarques ?" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                  {label}
                </label>
                <textarea
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                  rows={3}
                  placeholder={placeholder}
                  value={form[key as keyof FormData] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        );

      default: return null;
    }
  };

  return (
    <Layout>
      <div ref={topRef} className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-camublue-900 flex items-center gap-2">
            <ClipboardList size={24} />
            Questionnaire de sortie
          </h1>
          <p className="text-sm text-slate-400 mt-1">Partagez votre expérience avant votre départ</p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-camublue-900" size={36} />
          </div>
        )}

        {/* ── Pas de questionnaire ── */}
        {!loading && notFound && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="p-5 rounded-2xl bg-slate-100">
              <ClipboardList size={40} className="text-slate-300" />
            </div>
            <p className="text-slate-600 font-semibold">Aucun questionnaire de sortie</p>
            <p className="text-slate-400 text-sm max-w-sm">
              Votre service RH ne vous a pas encore envoyé de questionnaire de sortie.
            </p>
          </div>
        )}

        {/* ── Déjà soumis ── */}
        {!loading && !notFound && submitted && info && (
          <div className="space-y-5">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                <CheckCircle size={64} className="text-green-500" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-camublue-900">Questionnaire complété</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Merci, <strong>{info.employee_prenom} {info.employee_nom}</strong>. Vos réponses ont bien été enregistrées.
                </p>
                {info.date_reponse && (
                  <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1">
                    <Clock size={12} />
                    Répondu le {new Date(info.date_reponse).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
            </motion.div>
            <SuspensionBanner dateSortie={info.date_sortie} />
          </div>
        )}

        {/* ── Wizard formulaire ── */}
        {!loading && !notFound && !submitted && info && (
          <div className="space-y-5">

            {/* Badge envoi */}
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <Clock size={13} className="text-amber-600 shrink-0" />
              <span className="text-sm text-amber-700 font-medium">
                Envoyé le {new Date(info.date_envoi).toLocaleDateString("fr-FR")}
              </span>
            </div>

            {/* ── Indicateur de progression ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Étape {step} sur {TOTAL}
                </span>
                <span className="text-xs font-bold text-camublue-900">
                  {Math.round((step / TOTAL) * 100)} %
                </span>
              </div>
              {/* Barre de progression */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-camublue-900 rounded-full"
                  initial={false}
                  animate={{ width: `${(step / TOTAL) * 100}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
              {/* Pastilles numérotées */}
              <div className="flex justify-between mt-3">
                {STEPS.map((s) => (
                  <div
                    key={s.id}
                    className={`flex flex-col items-center gap-1 ${s.id > step ? "opacity-30" : ""}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      s.id < step  ? "bg-camublue-900 text-white" :
                      s.id === step ? "bg-camublue-900 text-white ring-4 ring-camublue-900/20" :
                      "bg-slate-100 text-slate-400"
                    }`}>
                      {s.id < step ? <CheckCircle size={12} /> : s.id}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Carte de l'étape ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* En-tête étape */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-50">
                <p className="text-xs font-semibold text-camublue-900/60 uppercase tracking-widest mb-1">
                  Question {step}/{TOTAL}{step <= 6 ? " *" : ""}
                </p>
                <h2 className="text-lg font-bold text-slate-800">{STEPS[step - 1].title}</h2>
                <p className="text-sm text-slate-400 mt-0.5">{STEPS[step - 1].subtitle}</p>
              </div>

              {/* Contenu animé */}
              <div className="px-6 py-6 min-h-[200px] flex flex-col justify-center">
                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div
                    key={step}
                    custom={dir}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Erreur */}
              <AnimatePresence>
                {stepError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-6 mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5"
                  >
                    <AlertTriangle size={13} className="text-red-500 shrink-0" />
                    <p className="text-red-600 text-xs">{stepError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="px-6 pb-6 flex items-center gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    <ChevronLeft size={16} /> Précédent
                  </button>
                )}

                {step < TOTAL ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="flex-1 flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold transition"
                  >
                    Suivant <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition disabled:opacity-60"
                  >
                    {submitting
                      ? <Loader2 size={16} className="animate-spin" />
                      : <><CheckCircle size={16} /> Soumettre le questionnaire</>
                    }
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
