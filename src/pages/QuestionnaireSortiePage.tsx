import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Star, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import {
  getQuestionnairePublic,
  repondreQuestionnaire,
  RAISONS_DEPART,
  type QuestionnairePublicInfo,
  type RepondrePayload,
} from "@/services/questionnaireService";

// ── StarRating ─────────────────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  labels = ["Très insatisfait", "Insatisfait", "Neutre", "Satisfait", "Très satisfait"],
}: {
  value: number | null;
  onChange: (v: number) => void;
  labels?: string[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={32}
              className={`transition-colors ${
                display !== null && n <= display
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
      {display !== null && (
        <span className="text-xs text-slate-500">{labels[display - 1]}</span>
      )}
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h3 className="text-base font-semibold text-camublue-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function QuestionnaireSortiePage() {
  const { token } = useParams<{ token: string }>();

  const [info, setInfo]         = useState<QuestionnairePublicInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [raison, setRaison]                 = useState("");
  const [raisonDetail, setRaisonDetail]     = useState("");
  const [satGen, setSatGen]                 = useState<number | null>(null);
  const [satMgmt, setSatMgmt]               = useState<number | null>(null);
  const [satEnv, setSatEnv]                 = useState<number | null>(null);
  const [satRem, setSatRem]                 = useState<number | null>(null);
  const [recommandation, setRecommandation] = useState<boolean | null>(null);
  const [pointsPos, setPointsPos]           = useState("");
  const [pointsAmel, setPointsAmel]         = useState("");
  const [commentaires, setCommentaires]     = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getQuestionnairePublic(token)
      .then((d) => {
        if (d.already_completed) setSubmitted(true);
        setInfo(d);
      })
      .catch(() => setError("Lien invalide ou expiré."))
      .finally(() => setLoading(false));
  }, [token]);

  const canSubmit =
    raison !== "" &&
    satGen !== null &&
    satMgmt !== null &&
    satEnv !== null &&
    satRem !== null &&
    recommandation !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setValidationError("Veuillez répondre à toutes les questions obligatoires (marquées *).");
      return;
    }
    setValidationError(null);
    setSubmitting(true);

    const payload: RepondrePayload = {
      raison_depart: raison,
      raison_depart_detail: raisonDetail,
      satisfaction_generale: satGen!,
      satisfaction_management: satMgmt!,
      satisfaction_environnement: satEnv!,
      satisfaction_remuneration: satRem!,
      recommandation: recommandation!,
      points_positifs: pointsPos,
      points_amelioration: pointsAmel,
      commentaires,
    };

    try {
      await repondreQuestionnaire(token!, payload);
      setSubmitted(true);
    } catch {
      setValidationError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── States ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-camublue-900" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-6">
        <AlertTriangle size={48} className="text-red-400" />
        <h2 className="text-xl font-semibold text-slate-700">{error}</h2>
        <p className="text-slate-500 text-center max-w-sm">
          Ce lien est invalide ou a déjà été utilisé. Contactez votre service RH.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6 p-6">
        <img src={logo} alt="Camusat" className="h-16 object-contain" />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <CheckCircle size={64} className="text-green-500" />
          <h2 className="text-2xl font-bold text-camublue-900">Merci pour votre réponse !</h2>
          <p className="text-slate-500 text-center max-w-md">
            Votre questionnaire de sortie a bien été enregistré. Nous vous souhaitons bonne
            continuation dans vos projets futurs.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="Camusat" className="h-16 object-contain" />
          <h1 className="text-2xl font-bold text-camublue-900">Questionnaire de sortie</h1>
          {info && (
            <p className="text-slate-500 text-sm">
              Bonjour <strong>{info.employee_prenom} {info.employee_nom}</strong>
              {info.employee_fonction ? ` — ${info.employee_fonction}` : ""}
              {info.employee_service ? `, ${info.employee_service}` : ""}
            </p>
          )}
          <p className="text-slate-400 text-xs max-w-md">
            Vos réponses sont confidentielles et nous aideront à améliorer nos pratiques RH.
            Les champs marqués <span className="text-red-500 font-bold">*</span> sont obligatoires.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* 1. Raison du départ */}
          <Section title="1. Raison principale de votre départ *">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RAISONS_DEPART.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRaison(r.value)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    raison === r.value
                      ? "bg-camublue-900 text-white border-camublue-900"
                      : "bg-white text-slate-700 border-slate-200 hover:border-camublue-900/40"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      raison === r.value ? "border-white bg-white" : "border-slate-300"
                    }`}
                  >
                    {raison === r.value && (
                      <span className="w-2 h-2 rounded-full bg-camublue-900" />
                    )}
                  </span>
                  {r.label}
                </button>
              ))}
            </div>
            {raison === "autre" && (
              <textarea
                className="mt-3 w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                rows={2}
                placeholder="Précisez..."
                value={raisonDetail}
                onChange={(e) => setRaisonDetail(e.target.value)}
              />
            )}
          </Section>

          {/* 2. Satisfactions */}
          <Section title="2. Satisfaction générale *">
            <StarRating value={satGen} onChange={setSatGen} />
          </Section>

          <Section title="3. Relation avec la hiérarchie directe *">
            <StarRating value={satMgmt} onChange={setSatMgmt} />
          </Section>

          <Section title="4. Conditions et environnement de travail *">
            <StarRating value={satEnv} onChange={setSatEnv} />
          </Section>

          <Section title="5. Rémunération et avantages *">
            <StarRating value={satRem} onChange={setSatRem} />
          </Section>

          {/* 3. Recommandation */}
          <Section title="6. Recommanderiez-vous Camusat comme employeur ? *">
            <div className="flex gap-4 justify-center">
              {[
                { label: "Oui", value: true,  color: "green" },
                { label: "Non", value: false, color: "red"   },
              ].map(({ label, value, color }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setRecommandation(value)}
                  className={`px-8 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    recommandation === value
                      ? color === "green"
                        ? "bg-green-500 text-white border-green-500"
                        : "bg-red-500 text-white border-red-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* 4. Texte libre */}
          <Section title="7. Points positifs (facultatif)">
            <textarea
              className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              rows={3}
              placeholder="Quels aspects avez-vous le plus appréciés ?"
              value={pointsPos}
              onChange={(e) => setPointsPos(e.target.value)}
            />
          </Section>

          <Section title="8. Points d'amélioration (facultatif)">
            <textarea
              className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              rows={3}
              placeholder="Quels aspects auraient pu être améliorés ?"
              value={pointsAmel}
              onChange={(e) => setPointsAmel(e.target.value)}
            />
          </Section>

          <Section title="9. Commentaires supplémentaires (facultatif)">
            <textarea
              className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              rows={3}
              placeholder="Avez-vous d'autres remarques ou suggestions ?"
              value={commentaires}
              onChange={(e) => setCommentaires(e.target.value)}
            />
          </Section>

          {/* Erreur de validation */}
          <AnimatePresence>
            {validationError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-500 text-sm text-center bg-red-50 rounded-xl p-3"
              >
                {validationError}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-camublue-900 text-white py-4 rounded-2xl font-semibold text-sm hover:bg-camublue-800 transition disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Soumettre le questionnaire
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 pb-6">
          Camusat — Direction des Ressources Humaines
        </p>
      </div>
    </div>
  );
}
