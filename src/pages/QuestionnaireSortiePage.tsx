import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import {
  getQuestionnairePublic,
  repondreQuestionnaire,
  RAISONS_DEPART,
  type QuestionnairePublicInfo,
  type RepondrePayload,
} from "@/services/questionnaireService";

// ─── Constantes exactes du document Word ─────────────────────────────────────

const SAT_EMOJIS   = ["😢", "😟", "😊", "😄"];
const SAT_LABELS   = ["Très insatisfait", "Insatisfait", "Satisfait", "Très satisfait"];

const REL_EMOJIS   = ["😢", "😟", "😊", "😄", "N/A"];
const REL_LABELS   = ["Très mauvaise", "Mauvaise", "Bonne", "Très bonne", "Sans objet"];
// valeur 5 = N/A

// ─── Composants UI ────────────────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="bg-[#003c71] px-6 py-3 flex items-center gap-3 rounded-t-2xl">
      <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">{num}</span>
      <h3 className="text-sm font-bold text-white tracking-wide uppercase">{title}</h3>
    </div>
  );
}

function SectionCard({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <SectionHeader num={num} title={title} />
      <div className="p-6 space-y-6">{children}</div>
    </div>
  );
}

function QuestionLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <p className="text-sm font-medium text-slate-700 mb-2">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </p>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#003c71]/25 focus:border-[#003c71] transition bg-white"
      rows={rows}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

/** Boutons emoji exactement comme dans le document Word */
function EmojiRating({ value, onChange, emojis, labels, required }: {
  value: number | null;
  onChange: (v: number) => void;
  emojis: string[];
  labels: string[];
  required?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {emojis.map((emoji, i) => {
        const v      = i + 1;
        const active = value === v;
        const isNA   = emoji === "N/A";
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            title={labels[i]}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 transition-all min-w-[64px] ${
              active
                ? "border-[#003c71] bg-[#003c71]/8 shadow-sm"
                : "border-slate-200 bg-white hover:border-[#003c71]/40 hover:bg-slate-50"
            }`}
          >
            {isNA
              ? <span className={`text-xs font-bold px-1.5 py-1 rounded-lg ${active ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-500"}`}>N/A</span>
              : <span className="text-2xl leading-none">{emoji}</span>
            }
            <span className={`text-[10px] font-medium text-center leading-tight max-w-[56px] ${active ? "text-[#003c71] font-bold" : "text-slate-400"}`}>
              {labels[i]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Rangée question + rating + commentaire (comme le tableau du Word) */
function RatingRow({ num, label, value, onChange, emojis, labels, comment, onCommentChange, required }: {
  num: string; label: string;
  value: number | null; onChange: (v: number) => void;
  emojis: string[]; labels: string[];
  comment: string; onCommentChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      {/* Question */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <p className="text-sm font-medium text-slate-700">
          <span className="text-[#003c71] font-bold mr-1.5">{num}</span>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </p>
      </div>
      {/* Rating + commentaire */}
      <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="shrink-0">
          <EmojiRating value={value} onChange={onChange} emojis={emojis} labels={labels} />
        </div>
        <div className="flex-1">
          <Textarea
            value={comment}
            onChange={onCommentChange}
            placeholder="Commentaire (facultatif)…"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}

/** Oui / Non / Peut-être */
function OuiNon({ value, onChange, withMaybe = false }: {
  value: string; onChange: (v: string) => void; withMaybe?: boolean;
}) {
  const opts = withMaybe
    ? [{ v: "oui", l: "Oui ✅", bg: "#10b981" }, { v: "peut_etre", l: "Peut-être 🤔", bg: "#f59e0b" }, { v: "non", l: "Non ❌", bg: "#ef4444" }]
    : [{ v: "oui", l: "Oui ✅", bg: "#10b981" }, { v: "non", l: "Non ❌", bg: "#ef4444" }];
  return (
    <div className="flex flex-wrap gap-3">
      {opts.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`px-6 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
            value === o.v ? "text-white border-transparent shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
          }`}
          style={value === o.v ? { backgroundColor: o.bg, borderColor: o.bg } : {}}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type SatKey = "missions" | "moyens" | "objectifs" | "soutien" | "charge" | "evolution";
type RelKey = "support" | "direction" | "manager" | "collegues" | "autres" | "clients" | "fournisseurs" | "sous_traitants";

const SAT_QUESTIONS: { key: SatKey; num: string; label: string }[] = [
  { key: "missions",  num: "3.2", label: "Les missions confiées étaient-elles conformes à ce que vous espériez ?" },
  { key: "moyens",    num: "3.3", label: "Les moyens pour exercer vos fonctions étaient-ils suffisants ?" },
  { key: "objectifs", num: "3.4", label: "Les objectifs étaient-ils précis et saviez-vous ce qu'on attendait de vous ?" },
  { key: "soutien",   num: "3.5", label: "Le soutien pour exercer vos fonctions était-il suffisant ?" },
  { key: "charge",    num: "3.6", label: "La charge de travail était-elle réaliste ?" },
  { key: "evolution", num: "3.7", label: "Le Groupe CAMUSAT vous a-t-il aidé à atteindre votre projet de carrière ?" },
];

const REL_QUESTIONS: { key: RelKey; num: string; label: string }[] = [
  { key: "support",       num: "4.1.1", label: "Le support Groupe (Technique, R&D, Achats, RH…) ?" },
  { key: "direction",     num: "4.1.2", label: "La direction de votre filiale ?" },
  { key: "manager",       num: "4.1.3", label: "Votre manager ?" },
  { key: "collegues",     num: "4.1.4", label: "Les collègues de votre équipe ?" },
  { key: "autres",        num: "4.1.5", label: "Les autres services ?" },
  { key: "clients",       num: "4.1.6", label: "Les clients ?" },
  { key: "fournisseurs",  num: "4.1.7", label: "Les fournisseurs ?" },
  { key: "sous_traitants",num: "4.1.8", label: "Les sous-traitants ?" },
];

export default function QuestionnaireSortiePage() {
  const { token } = useParams<{ token: string }>();

  const [info,       setInfo]       = useState<QuestionnairePublicInfo | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [valErr,     setValErr]     = useState<string | null>(null);

  // ── Section 2 ───────────────────────────────────────────────────────────────
  const [motifs,        setMotifs]        = useState<string[]>([]);
  const [motifAutre,    setMotifAutre]    = useState("");
  const [motifsComment, setMotifsComment] = useState("");
  const [evenement,     setEvenement]     = useState("");
  const [echangeMgr,    setEchangeMgr]    = useState("");

  // ── Section 3 ───────────────────────────────────────────────────────────────
  const [motivJoindre, setMotivJoindre] = useState("");
  const [satVals,  setSatVals]  = useState<Record<SatKey, number | null>>({
    missions: null, moyens: null, objectifs: null,
    soutien: null, charge: null, evolution: null,
  });
  const [satComments, setSatComments] = useState<Record<SatKey, string>>({
    missions: "", moyens: "", objectifs: "",
    soutien: "", charge: "", evolution: "",
  });
  const [aspectPos,   setAspectPos]   = useState("");
  const [aspectNeg,   setAspectNeg]   = useState("");
  const [competences, setCompetences] = useState("");

  // ── Section 4 ───────────────────────────────────────────────────────────────
  const [relVals, setRelVals] = useState<Record<RelKey, number | null>>({
    support: null, direction: null, manager: null, collegues: null,
    autres: null, clients: null, fournisseurs: null, sous_traitants: null,
  });
  const [relComments, setRelComments] = useState<Record<RelKey, string>>({
    support: "", direction: "", manager: "", collegues: "",
    autres: "", clients: "", fournisseurs: "", sous_traitants: "",
  });
  const [amelioration, setAmelioration] = useState("");

  // ── Section 5 ───────────────────────────────────────────────────────────────
  const [profil,       setProfil]       = useState("");
  const [qualites,     setQualites]     = useState("");
  const [retravail,    setRetravail]    = useState("");
  const [recommande,   setRecommande]   = useState("");
  const [nouveauPoste, setNouveauPoste] = useState("");
  const [suggestions,  setSuggestions]  = useState("");

  useEffect(() => {
    if (!token) return;
    getQuestionnairePublic(token)
      .then(d => { if (d.already_completed) setSubmitted(true); setInfo(d); })
      .catch(() => setError("Lien invalide ou expiré."))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleMotif = (v: string) =>
    setMotifs(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const setSat = (key: SatKey, v: number) =>
    setSatVals(p => ({ ...p, [key]: v }));
  const setSatComment = (key: SatKey, v: string) =>
    setSatComments(p => ({ ...p, [key]: v }));
  const setRel = (key: RelKey, v: number) =>
    setRelVals(p => ({ ...p, [key]: v }));
  const setRelComment = (key: RelKey, v: string) =>
    setRelComments(p => ({ ...p, [key]: v }));

  const allSatFilled = SAT_QUESTIONS.every(q => satVals[q.key] !== null);
  const allRelFilled = REL_QUESTIONS.every(q => relVals[q.key] !== null);

  const canSubmit = motifs.length > 0 && allSatFilled && allRelFilled && retravail !== "" && recommande !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setValErr("Veuillez répondre à toutes les questions obligatoires (marquées *).");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setValErr(null);
    setSubmitting(true);

    const allMotifs = motifs.includes("autre") && motifAutre.trim()
      ? [...motifs.filter(m => m !== "autre"), `autre: ${motifAutre.trim()}`]
      : motifs;

    // Filtrer les commentaires non vides
    const satC = Object.fromEntries(Object.entries(satComments).filter(([, v]) => v.trim()));
    const relC = Object.fromEntries(Object.entries(relComments).filter(([, v]) => v.trim()));

    const payload: RepondrePayload = {
      motifs_depart:          allMotifs,
      motifs_commentaires:    motifsComment,
      evenement_declencheur:  evenement,
      echange_manager_avant:  echangeMgr,
      motivation_rejoindre:   motivJoindre,
      sat_missions:           satVals.missions!,
      sat_moyens:             satVals.moyens!,
      sat_objectifs:          satVals.objectifs!,
      sat_soutien:            satVals.soutien!,
      sat_charge_travail:     satVals.charge!,
      sat_evolution_carriere: satVals.evolution!,
      aspect_satisfaisant:    aspectPos,
      aspect_insatisfaisant:  aspectNeg,
      competences_developpees: competences,
      rel_support_groupe:     relVals.support!,
      rel_direction_filiale:  relVals.direction!,
      rel_manager:            relVals.manager!,
      rel_collegues:          relVals.collegues!,
      rel_autres_services:    relVals.autres!,
      rel_clients:            relVals.clients!,
      rel_fournisseurs:       relVals.fournisseurs!,
      rel_sous_traitants:     relVals.sous_traitants!,
      amelioration_environnement: amelioration,
      profil_remplacement:    profil,
      qualites_poste:         qualites,
      retravaillerait_camusat: retravail as "oui" | "non" | "peut_etre",
      recommande_camusat:     recommande as "oui" | "non" | "peut_etre",
      nouveau_poste_entreprise: nouveauPoste,
      suggestions_commentaires: suggestions,
      ...(Object.keys(satC).length > 0 && { sat_comments: satC }),
      ...(Object.keys(relC).length > 0 && { rel_comments: relC }),
    };

    try {
      await repondreQuestionnaire(token!, payload);
      setSubmitted(true);
    } catch {
      setValErr("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── États loading / error / success ──────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-[#003c71]" size={40} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-6">
      <AlertTriangle size={48} className="text-red-400" />
      <h2 className="text-xl font-semibold text-slate-700">{error}</h2>
      <p className="text-slate-500 text-center max-w-sm">Ce lien est invalide ou a déjà été utilisé. Contactez votre service RH.</p>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6 p-6">
      <img src={logo} alt="Camusat" className="h-16 object-contain" />
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 text-center">
        <CheckCircle size={64} className="text-green-500" />
        <h2 className="text-2xl font-bold text-[#003c71]">Merci pour votre réponse !</h2>
        <p className="text-slate-500 max-w-md">Votre questionnaire de sortie a bien été enregistré. Nous vous souhaitons une bonne continuation dans vos projets futurs.</p>
        <p className="text-xs text-slate-400 italic mt-2">Nous vous remercions d'avoir répondu à ce questionnaire et nous vous souhaitons une bonne continuation !</p>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── En-tête ── */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="Camusat" className="h-16 object-contain" />
          <h1 className="text-2xl font-bold text-[#003c71]">QUESTIONNAIRE DE SORTIE</h1>
          {info && (
            <div className="text-slate-500 text-sm space-y-0.5">
              <p>Bonjour <strong>{info.employee_prenom} {info.employee_nom}</strong>
                {info.employee_fonction ? ` — ${info.employee_fonction}` : ""}
                {info.employee_service ? `, ${info.employee_service}` : ""}
              </p>
              {info.date_sortie && <p className="text-xs text-slate-400">Date de départ : {new Date(info.date_sortie).toLocaleDateString("fr-FR")}</p>}
            </div>
          )}
          <div className="bg-slate-100 rounded-xl px-4 py-3 max-w-xl text-xs text-slate-500 text-center leading-relaxed">
            Ce questionnaire s'adresse à l'ensemble des salariés souhaitant quitter le Groupe CAMUSAT.
            Les informations recueillies permettront d'identifier les raisons de votre départ et de cerner les domaines pouvant être améliorés.
            <strong> Ce document est confidentiel.</strong>
            <br />Les champs marqués <span className="text-red-500 font-bold">*</span> sont obligatoires.
          </div>
        </div>

        {/* Erreur de validation */}
        <AnimatePresence>
          {valErr && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 justify-center">
              <AlertTriangle size={15} className="shrink-0" /> {valErr}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ══ SECTION 2 — Motifs de départ ══════════════════════════════════ */}
          <SectionCard num="2" title="Motifs justifiant votre départ">

            <div>
              <QuestionLabel
                label="2.1 Pourquoi avez-vous décidé de quitter le Groupe CAMUSAT ? (Plusieurs réponses sont possibles)"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RAISONS_DEPART.map(r => {
                  const sel = motifs.includes(r.value);
                  return (
                    <button key={r.value} type="button" onClick={() => toggleMotif(r.value)}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                        sel ? "bg-[#003c71] text-white border-[#003c71]" : "bg-white text-slate-700 border-slate-200 hover:border-[#003c71]/40"
                      }`}>
                      <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                        sel ? "border-white bg-white" : "border-slate-300"
                      }`}>
                        {sel && <span className="w-2 h-2 rounded-sm bg-[#003c71]" />}
                      </span>
                      {r.label}
                    </button>
                  );
                })}
              </div>
              {motifs.includes("autre") && (
                <div className="mt-2">
                  <Textarea value={motifAutre} onChange={setMotifAutre} placeholder="Précisez les autres raisons…" rows={2} />
                </div>
              )}
            </div>

            <div>
              <QuestionLabel label="Commentaires sur les raisons sélectionnées ci-dessus :" />
              <Textarea value={motifsComment} onChange={setMotifsComment} placeholder="Vos commentaires…" />
            </div>

            <div>
              <QuestionLabel label="2.2 Existe-t-il un évènement déclencheur qui vous a poussé à prendre la décision de partir ? Si oui, merci de détailler." />
              <Textarea value={evenement} onChange={setEvenement} placeholder="Décrivez l'évènement déclencheur…" />
            </div>

            <div>
              <QuestionLabel label="2.3 Avant de prendre votre décision, avez-vous échangé avec votre manager ? Si oui, merci de détailler." />
              <Textarea value={echangeMgr} onChange={setEchangeMgr} placeholder="Décrivez cet échange…" />
            </div>
          </SectionCard>

          {/* ══ SECTION 3 — Emploi ════════════════════════════════════════════ */}
          <SectionCard num="3" title="Emploi">

            <div>
              <QuestionLabel label="3.1 Qu'est-ce qui vous a donné envie de venir travailler chez CAMUSAT ?" />
              <Textarea value={motivJoindre} onChange={setMotivJoindre} placeholder="Décrivez vos motivations initiales…" />
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 italic">
              Donner votre degré de satisfaction en ne cochant qu'une seule case. Une colonne commentaire est disponible pour chaque question.
            </div>

            <div className="space-y-3">
              {SAT_QUESTIONS.map(q => (
                <RatingRow
                  key={q.key}
                  num={q.num}
                  label={q.label}
                  value={satVals[q.key]}
                  onChange={v => setSat(q.key, v)}
                  emojis={SAT_EMOJIS}
                  labels={SAT_LABELS}
                  comment={satComments[q.key]}
                  onCommentChange={v => setSatComment(q.key, v)}
                  required
                />
              ))}
            </div>

            <div>
              <QuestionLabel label="3.8 Quel était l'aspect le plus satisfaisant de votre travail ?" />
              <Textarea value={aspectPos} onChange={setAspectPos} placeholder="Décrivez les aspects positifs…" />
            </div>

            <div>
              <QuestionLabel label="3.9 Quel était l'aspect le moins satisfaisant de votre travail ?" />
              <Textarea value={aspectNeg} onChange={setAspectNeg} placeholder="Décrivez les aspects négatifs…" />
            </div>

            <div>
              <QuestionLabel label="3.10 Quelles connaissances et compétences avez-vous développées durant votre emploi au sein de l'entreprise ?" />
              <Textarea value={competences} onChange={setCompetences} placeholder="Décrivez les compétences et connaissances acquises…" />
            </div>
          </SectionCard>

          {/* ══ SECTION 4 — Environnement de travail ═════════════════════════ */}
          <SectionCard num="4" title="Environnement de travail">

            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 italic">
              4.1 Comment qualifieriez-vous vos relations avec : (une colonne commentaire est disponible)
            </div>

            <div className="space-y-3">
              {REL_QUESTIONS.map(q => (
                <RatingRow
                  key={q.key}
                  num={q.num}
                  label={q.label}
                  value={relVals[q.key]}
                  onChange={v => setRel(q.key, v)}
                  emojis={REL_EMOJIS}
                  labels={REL_LABELS}
                  comment={relComments[q.key]}
                  onCommentChange={v => setRelComment(q.key, v)}
                  required
                />
              ))}
            </div>

            <div>
              <QuestionLabel label="4.2 Pour améliorer l'environnement de travail, quels sont les changements que vous apporteriez ?" />
              <Textarea value={amelioration} onChange={setAmelioration} placeholder="Vos suggestions d'amélioration…" />
            </div>
          </SectionCard>

          {/* ══ SECTION 5 — Divers ════════════════════════════════════════════ */}
          <SectionCard num="5" title="Divers">

            <div>
              <QuestionLabel label="5.1 Selon vous, quel profil faut-il rechercher pour vous remplacer ?" />
              <Textarea value={profil} onChange={setProfil} placeholder="Décrivez le profil idéal pour vous remplacer…" />
            </div>

            <div>
              <QuestionLabel label="5.2 À votre avis, quelles sont les qualités que l'on doit posséder pour réussir sur ce poste ?" />
              <Textarea value={qualites} onChange={setQualites} placeholder="Les qualités et compétences requises…" />
            </div>

            <div>
              <QuestionLabel label="5.3 Seriez-vous prêt(e) à travailler à nouveau pour CAMUSAT à l'avenir ?" required />
              <OuiNon value={retravail} onChange={setRetravail} withMaybe />
            </div>

            <div>
              <QuestionLabel label="5.4 Recommanderiez-vous à votre entourage de travailler chez CAMUSAT ?" required />
              <OuiNon value={recommande} onChange={setRecommande} withMaybe />
            </div>

            <div>
              <QuestionLabel label="5.5 Quel sera votre nouveau poste et votre entreprise ?" />
              <Textarea value={nouveauPoste} onChange={setNouveauPoste} placeholder="Nouveau poste, nouvelle entreprise…" rows={2} />
            </div>

            <div>
              <QuestionLabel label="5.6 Avez-vous des suggestions d'améliorations et/ou des commentaires à apporter ?" />
              <Textarea value={suggestions} onChange={setSuggestions} placeholder="Vos suggestions et commentaires finaux…" />
            </div>
          </SectionCard>

          {/* Bouton soumettre */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-[#003c71] text-white py-4 rounded-2xl font-semibold text-sm hover:bg-[#003c71]/90 transition disabled:opacity-60"
          >
            {submitting
              ? <Loader2 size={18} className="animate-spin" />
              : <><ChevronRight size={18} /> Soumettre le questionnaire</>
            }
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 pb-6">
          Ce document est confidentiel. Il ne peut être copié, communiqué à des tiers ou reproduit sans le consentement écrit de CAMUSAT.
        </p>
      </div>
    </div>
  );
}
