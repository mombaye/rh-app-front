import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Loader2, ClipboardList,
  Clock, AlertTriangle, CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";
import EmployeeLayout from "@/layouts/EmployeeLayout";
import {
  getMonQuestionnaire,
  repondreQuestionnaire,
  getQuestionnaireTemplate,
  RAISONS_DEPART,
  SAT4_LABELS,
  REL5_LABELS,
  type MonQuestionnaire,
  type RepondrePayload,
  type QuestionnaireStructure,
  type SectionDef,
  type QuestionDef,
} from "@/services/questionnaireService";

type LayoutComponent = React.ComponentType<{ children: React.ReactNode }>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function joursRestants(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

// ── Composant : case à cocher stylée ─────────────────────────────────────────
function Checkbox({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group select-none">
      <span
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
          checked
            ? "bg-camublue-900 border-camublue-900"
            : "border-slate-300 group-hover:border-camublue-900/50"
        }`}
      >
        {checked && <CheckCircle size={12} className="text-white" strokeWidth={3} />}
      </span>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

// ── Composant : échelle de satisfaction 4 niveaux ─────────────────────────────
const SAT4_COLORS = [
  "border-red-400 bg-red-50 text-red-700",
  "border-orange-400 bg-orange-50 text-orange-700",
  "border-green-400 bg-green-50 text-green-700",
  "border-emerald-500 bg-emerald-50 text-emerald-700",
];
const SAT4_SELECTED = [
  "bg-red-500 border-red-500 text-white",
  "bg-orange-500 border-orange-500 text-white",
  "bg-green-500 border-green-500 text-white",
  "bg-emerald-600 border-emerald-600 text-white",
];

function Scale4({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {SAT4_LABELS.map((label, i) => {
        const n = i + 1;
        const sel = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              sel ? SAT4_SELECTED[i] : `bg-white ${SAT4_COLORS[i]} hover:opacity-80`
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Composant : échelle de relation 5 niveaux ─────────────────────────────────
const REL5_COLORS = [
  "border-red-400 bg-red-50 text-red-700",
  "border-orange-400 bg-orange-50 text-orange-700",
  "border-yellow-400 bg-yellow-50 text-yellow-700",
  "border-green-400 bg-green-50 text-green-700",
  "border-slate-300 bg-slate-50 text-slate-500",
];
const REL5_SELECTED = [
  "bg-red-500 border-red-500 text-white",
  "bg-orange-500 border-orange-500 text-white",
  "bg-yellow-500 border-yellow-500 text-white",
  "bg-green-500 border-green-500 text-white",
  "bg-slate-400 border-slate-400 text-white",
];

function Scale5({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {REL5_LABELS.map((label, i) => {
        const n = i + 1;
        const sel = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
              sel ? REL5_SELECTED[i] : `bg-white ${REL5_COLORS[i]} hover:opacity-80`
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Composant : textarea réutilisable ─────────────────────────────────────────
function Field({
  label, placeholder, value, onChange, required, rows = 3,
}: {
  label: string; placeholder?: string; value: string;
  onChange: (v: string) => void; required?: boolean; rows?: number;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <textarea
        className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-camublue-900/30 placeholder:text-slate-300"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── Types formulaire ──────────────────────────────────────────────────────────
interface FormData {
  // Section 2
  motifs:                string[];
  motifs_commentaires:   string;
  evenement_declencheur: string;
  echange_manager:       string;
  // Section 3
  motivation_rejoindre:  string;
  sat_missions:          number | null;
  sat_moyens:            number | null;
  sat_objectifs:         number | null;
  sat_soutien:           number | null;
  sat_charge_travail:    number | null;
  sat_evolution:         number | null;
  aspect_satisfaisant:   string;
  aspect_insatisfaisant: string;
  competences:           string;
  // Section 4
  rel_support:           number | null;
  rel_direction:         number | null;
  rel_manager:           number | null;
  rel_collegues:         number | null;
  rel_autres_services:   number | null;
  rel_clients:           number | null;
  rel_fournisseurs:      number | null;
  rel_sous_traitants:    number | null;
  rel_commentaire:       string;
  amelioration_env:      string;
  // Section 5
  profil_remplacement:   string;
  qualites_poste:        string;
  retravaillerait:       "oui" | "non" | "peut_etre" | null;
  recommande:            "oui" | "non" | "peut_etre" | null;
  nouveau_poste:         string;
  suggestions:           string;
}

const INIT: FormData = {
  motifs: [], motifs_commentaires: "", evenement_declencheur: "", echange_manager: "",
  motivation_rejoindre: "",
  sat_missions: null, sat_moyens: null, sat_objectifs: null,
  sat_soutien: null, sat_charge_travail: null, sat_evolution: null,
  aspect_satisfaisant: "", aspect_insatisfaisant: "", competences: "",
  rel_support: null, rel_direction: null, rel_manager: null,
  rel_collegues: null, rel_autres_services: null, rel_clients: null,
  rel_fournisseurs: null, rel_sous_traitants: null,
  rel_commentaire: "", amelioration_env: "",
  profil_remplacement: "", qualites_poste: "",
  retravaillerait: null, recommande: null,
  nouveau_poste: "", suggestions: "",
};

// ── Définition des 4 étapes (sections 2→5) ───────────────────────────────────
const STEPS = [
  { id: 1, section: "2", title: "Motifs du départ",         subtitle: "Pourquoi avez-vous décidé de quitter le Groupe CAMUSAT ?" },
  { id: 2, section: "3", title: "Emploi",                   subtitle: "Votre expérience de travail au sein de CAMUSAT" },
  { id: 3, section: "4", title: "Environnement de travail", subtitle: "Vos relations professionnelles" },
  { id: 4, section: "5", title: "Divers",                   subtitle: "Informations complémentaires" },
];
const TOTAL = STEPS.length;

// ── Banner suspension ─────────────────────────────────────────────────────────
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

// ── Composant : radio oui/non/peut-être ──────────────────────────────────────
function OuiNon({
  value, onChange,
}: { value: "oui" | "non" | "peut_etre" | null; onChange: (v: "oui" | "non" | "peut_etre") => void }) {
  const opts: { val: "oui" | "non" | "peut_etre"; label: string; cls: string; selCls: string }[] = [
    { val: "oui",       label: "Oui",        cls: "border-green-400 bg-green-50 text-green-700",   selCls: "bg-green-500 border-green-500 text-white" },
    { val: "peut_etre", label: "Peut-être",  cls: "border-yellow-400 bg-yellow-50 text-yellow-700", selCls: "bg-yellow-500 border-yellow-500 text-white" },
    { val: "non",       label: "Non",        cls: "border-red-400 bg-red-50 text-red-700",         selCls: "bg-red-500 border-red-500 text-white" },
  ];
  return (
    <div className="flex gap-3">
      {opts.map(({ val, label, cls, selCls }) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
            value === val ? selCls : `bg-white ${cls} hover:opacity-80`
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function EmployeeQuestionnairePage({ layout: Layout = EmployeeLayout }: { layout?: LayoutComponent }) {
  const [info,            setInfo]            = useState<MonQuestionnaire | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [notFound,        setNotFound]        = useState(false);
  const [submitted,       setSubmitted]       = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [stepError,       setStepError]       = useState<string | null>(null);
  // Mode dynamique (template DOCX uploadé)
  const [dynStructure,    setDynStructure]    = useState<QuestionnaireStructure | null>(null);
  const [dynAnswers,      setDynAnswers]      = useState<Record<string, unknown>>({});

  const [step, setStep] = useState(1);
  const [dir,  setDir]  = useState(1);
  const [form, setForm] = useState<FormData>(INIT);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      getMonQuestionnaire()
        .then((d) => { setInfo(d); if (d.statut === "complete") setSubmitted(true); })
        .catch(() => setNotFound(true)),
      getQuestionnaireTemplate()
        .then((t) => setDynStructure(t.structure))
        .catch(() => { /* pas de template → mode hardcodé */ }),
    ]).finally(() => setLoading(false));
  }, []);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const toggleMotif = (val: string) => {
    setForm((f) => ({
      ...f,
      motifs: f.motifs.includes(val)
        ? f.motifs.filter((m) => m !== val)
        : [...f.motifs, val],
    }));
    setStepError(null);
  };

  const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  // ── Mode dynamique ────────────────────────────────────────────────────────

  // Sections du template, sans la section 1 (identification auto-remplie)
  const dynSections: SectionDef[] = dynStructure
    ? dynStructure.sections.filter((s) => s.num !== "1")
    : [];
  const isDynamic = dynSections.length > 0;
  const dynTotal  = isDynamic ? dynSections.length : TOTAL;

  const setDynAnswer = (key: string, val: unknown) =>
    setDynAnswers((prev) => ({ ...prev, [key]: val }));

  const dynCanAdvance = (): boolean => {
    if (!isDynamic) return true;
    const sec = dynSections[step - 1];
    if (!sec) return true;
    for (const q of sec.questions) {
      if (q.type === "checkbox_list") {
        const v = dynAnswers[q.key];
        if (!Array.isArray(v) || v.length === 0) return false;
      } else if (q.type === "scale4" || q.type === "scale5") {
        if (!dynAnswers[q.key]) return false;
      } else if (q.type === "oui_non") {
        if (!dynAnswers[q.key]) return false;
      }
    }
    return true;
  };

  const renderDynamicQuestion = (q: QuestionDef) => {
    const labelEl = (
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {q.num ? `${q.num} — ` : ""}{q.label}
      </p>
    );

    switch (q.type) {
      case "checkbox_list": {
        const selected = (dynAnswers[q.key] as string[] | undefined) ?? [];
        return (
          <div key={q.key} className="space-y-1.5">
            {labelEl}
            <div className="space-y-2">
              {(q.options ?? []).map((opt) => (
                <Checkbox
                  key={opt}
                  label={opt}
                  checked={selected.includes(opt)}
                  onChange={(checked) =>
                    setDynAnswer(q.key, checked ? [...selected, opt] : selected.filter((s) => s !== opt))
                  }
                />
              ))}
            </div>
          </div>
        );
      }
      case "scale4": {
        const val = (dynAnswers[q.key] as number | null) ?? null;
        return (
          <div key={q.key}>
            {labelEl}
            <Scale4 value={val} onChange={(v) => setDynAnswer(q.key, v)} />
          </div>
        );
      }
      case "scale5": {
        const val = (dynAnswers[q.key] as number | null) ?? null;
        return (
          <div key={q.key}>
            {labelEl}
            <Scale5 value={val} onChange={(v) => setDynAnswer(q.key, v)} />
          </div>
        );
      }
      case "oui_non": {
        const val = (dynAnswers[q.key] as "oui" | "non" | "peut_etre" | null) ?? null;
        return (
          <div key={q.key}>
            {labelEl}
            <OuiNon value={val} onChange={(v) => setDynAnswer(q.key, v)} />
          </div>
        );
      }
      default: {
        const val = (dynAnswers[q.key] as string | undefined) ?? "";
        return (
          <Field
            key={q.key}
            label={q.num ? `${q.num} — ${q.label}` : q.label}
            value={val}
            onChange={(v) => setDynAnswer(q.key, v)}
          />
        );
      }
    }
  };

  const renderDynamicStep = () => {
    const sec = dynSections[step - 1];
    if (!sec) return null;
    return (
      <div className="space-y-5">
        {sec.questions.map((q) => renderDynamicQuestion(q))}
      </div>
    );
  };

  const canAdvance = (): boolean => {
    if (isDynamic) return dynCanAdvance();
    switch (step) {
      case 1:
        return form.motifs.length > 0;
      case 2:
        return (
          form.sat_missions   !== null &&
          form.sat_moyens     !== null &&
          form.sat_objectifs  !== null &&
          form.sat_soutien    !== null &&
          form.sat_charge_travail !== null &&
          form.sat_evolution  !== null
        );
      case 3:
        return (
          form.rel_support       !== null &&
          form.rel_direction     !== null &&
          form.rel_manager       !== null &&
          form.rel_collegues     !== null &&
          form.rel_autres_services !== null &&
          form.rel_clients       !== null &&
          form.rel_fournisseurs  !== null &&
          form.rel_sous_traitants !== null
        );
      case 4:
        return form.retravaillerait !== null && form.recommande !== null;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!canAdvance()) {
      setStepError("Veuillez répondre à toutes les questions obligatoires avant de continuer.");
      return;
    }
    setStepError(null);
    setDir(1);
    setStep((s) => Math.min(s + 1, dynTotal));
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
    if (!canAdvance()) {
      setStepError("Veuillez répondre à toutes les questions obligatoires.");
      return;
    }
    setSubmitting(true);
    setStepError(null);

    let payload: RepondrePayload;

    if (isDynamic) {
      // Mode dynamique : on envoie les réponses en JSON générique
      // Les champs obligatoires du sérialiseur ont des valeurs par défaut acceptables
      payload = {
        motifs_depart:          [],
        sat_missions:           1,
        sat_moyens:             1,
        sat_objectifs:          1,
        sat_soutien:            1,
        sat_charge_travail:     1,
        sat_evolution_carriere: 1,
        rel_support_groupe:     1,
        rel_direction_filiale:  1,
        rel_manager:            1,
        rel_collegues:          1,
        rel_autres_services:    1,
        rel_clients:            1,
        rel_fournisseurs:       1,
        rel_sous_traitants:     1,
        retravaillerait_camusat: "oui",
        recommande_camusat:      "oui",
        reponses_json: dynAnswers,
      };
    } else {
      payload = {
        motifs_depart:          form.motifs,
        motifs_commentaires:    form.motifs_commentaires || undefined,
        evenement_declencheur:  form.evenement_declencheur || undefined,
        echange_manager_avant:  form.echange_manager || undefined,
        motivation_rejoindre:   form.motivation_rejoindre || undefined,
        sat_missions:           form.sat_missions!,
        sat_moyens:             form.sat_moyens!,
        sat_objectifs:          form.sat_objectifs!,
        sat_soutien:            form.sat_soutien!,
        sat_charge_travail:     form.sat_charge_travail!,
        sat_evolution_carriere: form.sat_evolution!,
        aspect_satisfaisant:    form.aspect_satisfaisant || undefined,
        aspect_insatisfaisant:  form.aspect_insatisfaisant || undefined,
        competences_developpees: form.competences || undefined,
        rel_support_groupe:     form.rel_support!,
        rel_direction_filiale:  form.rel_direction!,
        rel_manager:            form.rel_manager!,
        rel_collegues:          form.rel_collegues!,
        rel_autres_services:    form.rel_autres_services!,
        rel_clients:            form.rel_clients!,
        rel_fournisseurs:       form.rel_fournisseurs!,
        rel_sous_traitants:     form.rel_sous_traitants!,
        rel_commentaire:        form.rel_commentaire || undefined,
        amelioration_environnement: form.amelioration_env || undefined,
        profil_remplacement:    form.profil_remplacement || undefined,
        qualites_poste:         form.qualites_poste || undefined,
        retravaillerait_camusat: form.retravaillerait!,
        recommande_camusat:     form.recommande!,
        nouveau_poste_entreprise: form.nouveau_poste || undefined,
        suggestions_commentaires: form.suggestions || undefined,
      };
    }

    try {
      await repondreQuestionnaire(info.token, payload);
      setSubmitted(true);
    } catch {
      setStepError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Contenu de chaque étape ───────────────────────────────────────────────

  type SatRow = { num: string; label: string; key: keyof FormData };
  type RelRow = { num: string; label: string; key: keyof FormData };

  const SAT_ROWS: SatRow[] = [
    { num: "3.2", label: "Les missions confiées étaient-elles conformes à ce que vous espériez ?",       key: "sat_missions"       },
    { num: "3.3", label: "Les moyens pour exercer vos fonctions étaient-ils suffisants ?",                key: "sat_moyens"         },
    { num: "3.4", label: "Les objectifs étaient-ils précis et saviez-vous ce qu'on attendait de vous ?", key: "sat_objectifs"      },
    { num: "3.5", label: "Le soutien pour exercer vos fonctions était-il suffisant ?",                   key: "sat_soutien"        },
    { num: "3.6", label: "La charge de travail était-elle réaliste ?",                                   key: "sat_charge_travail" },
    { num: "3.7", label: "Le Groupe CAMUSAT vous a-t-il aidé à atteindre votre projet de carrière ?",   key: "sat_evolution"      },
  ];

  const REL_ROWS: RelRow[] = [
    { num: "4.1.1", label: "Le support Groupe (Technique, R&D, Achats, RH…)", key: "rel_support"         },
    { num: "4.1.2", label: "La direction de votre filiale",                    key: "rel_direction"       },
    { num: "4.1.3", label: "Votre manager",                                    key: "rel_manager"         },
    { num: "4.1.4", label: "Les collègues de votre équipe",                    key: "rel_collegues"       },
    { num: "4.1.5", label: "Les autres services",                              key: "rel_autres_services" },
    { num: "4.1.6", label: "Les clients",                                      key: "rel_clients"         },
    { num: "4.1.7", label: "Les fournisseurs",                                 key: "rel_fournisseurs"    },
    { num: "4.1.8", label: "Les sous-traitants",                               key: "rel_sous_traitants"  },
  ];

  const renderStep = () => {
    switch (step) {

      // ── SECTION 2 : Motifs du départ ────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-6">

            {/* 2.1 Motifs multiples */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">
                <span className="text-camublue-900 font-bold">2.1</span>{" "}
                Pourquoi avez-vous décidé de quitter le Groupe CAMUSAT ?{" "}
                <span className="text-xs font-normal text-slate-400">(Plusieurs réponses possibles)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {RAISONS_DEPART.map((r) => (
                  <Checkbox
                    key={r.value}
                    checked={form.motifs.includes(r.value)}
                    onChange={() => toggleMotif(r.value)}
                    label={r.label}
                  />
                ))}
              </div>
            </div>

            {/* Commentaires sur les raisons */}
            <Field
              label="Commentaires sur les raisons sélectionnées"
              placeholder="Précisez votre choix si nécessaire..."
              value={form.motifs_commentaires}
              onChange={(v) => set("motifs_commentaires", v)}
              rows={2}
            />

            {/* 2.2 Évènement déclencheur */}
            <Field
              label="2.2 — Existe-t-il un évènement déclencheur qui vous a poussé à prendre la décision de partir ? Si oui, merci de détailler."
              placeholder="Décrivez l'évènement déclencheur..."
              value={form.evenement_declencheur}
              onChange={(v) => set("evenement_declencheur", v)}
            />

            {/* 2.3 Échange avec manager */}
            <Field
              label="2.3 — Avant de prendre votre décision, avez-vous échangé avec votre manager ? Si oui, merci de détailler."
              placeholder="Décrivez cet échange..."
              value={form.echange_manager}
              onChange={(v) => set("echange_manager", v)}
            />
          </div>
        );

      // ── SECTION 3 : Emploi ───────────────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-6">

            {/* 3.1 Motivation */}
            <Field
              label="3.1 — Qu'est-ce qui vous a donné envie de venir travailler chez CAMUSAT ?"
              placeholder="Décrivez vos motivations initiales..."
              value={form.motivation_rejoindre}
              onChange={(v) => set("motivation_rejoindre", v)}
            />

            {/* 3.2 – 3.7 Tableau de satisfaction */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Degré de satisfaction — cochez une seule case par ligne <span className="text-red-400">*</span>
              </p>
              <div className="space-y-4">
                {SAT_ROWS.map(({ num, label, key }) => (
                  <div key={key} className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <p className="text-sm text-slate-700">
                      <span className="font-bold text-camublue-900">{num}</span> {label}
                    </p>
                    <Scale4
                      value={form[key] as number | null}
                      onChange={(v) => set(key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 3.8 – 3.10 */}
            <Field
              label="3.8 — Quel était l'aspect le plus satisfaisant de votre travail ?"
              placeholder="Décrivez ce que vous avez le plus apprécié..."
              value={form.aspect_satisfaisant}
              onChange={(v) => set("aspect_satisfaisant", v)}
            />
            <Field
              label="3.9 — Quel était l'aspect le moins satisfaisant de votre travail ?"
              placeholder="Décrivez ce que vous avez le moins apprécié..."
              value={form.aspect_insatisfaisant}
              onChange={(v) => set("aspect_insatisfaisant", v)}
            />
            <Field
              label="3.10 — Quelles connaissances et compétences avez-vous développées durant votre emploi au sein de l'entreprise ?"
              placeholder="Décrivez vos acquis professionnels..."
              value={form.competences}
              onChange={(v) => set("competences", v)}
            />
          </div>
        );

      // ── SECTION 4 : Environnement de travail ─────────────────────────────────
      case 3:
        return (
          <div className="space-y-6">

            {/* 4.1 Relations */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">
                <span className="text-camublue-900 font-bold">4.1</span>{" "}
                Comment qualifieriez-vous vos relations avec :
                <span className="text-red-400 ml-1">*</span>
              </p>
              <p className="text-xs text-slate-400 mb-3">
                {REL5_LABELS.join(" · ")}
              </p>
              <div className="space-y-3">
                {REL_ROWS.map(({ num, label, key }) => (
                  <div key={key} className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <p className="text-sm text-slate-700">
                      <span className="font-bold text-camublue-900">{num}</span> {label}
                    </p>
                    <Scale5
                      value={form[key] as number | null}
                      onChange={(v) => set(key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Commentaire relations */}
            <Field
              label="Commentaire sur vos relations"
              placeholder="Précisez si nécessaire..."
              value={form.rel_commentaire}
              onChange={(v) => set("rel_commentaire", v)}
              rows={2}
            />

            {/* 4.2 */}
            <Field
              label="4.2 — Pour améliorer l'environnement de travail, quels sont les changements que vous apporteriez ?"
              placeholder="Vos suggestions d'amélioration..."
              value={form.amelioration_env}
              onChange={(v) => set("amelioration_env", v)}
            />
          </div>
        );

      // ── SECTION 5 : Divers ───────────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-6">
            <Field
              label="5.1 — Selon vous, quel profil faut-il rechercher pour vous remplacer ?"
              placeholder="Décrivez le profil idéal..."
              value={form.profil_remplacement}
              onChange={(v) => set("profil_remplacement", v)}
            />
            <Field
              label="5.2 — À votre avis, quelles sont les qualités que l'on doit posséder pour réussir sur ce poste ?"
              placeholder="Listez les qualités essentielles..."
              value={form.qualites_poste}
              onChange={(v) => set("qualites_poste", v)}
            />

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                5.3 — Seriez-vous prêt à travailler à nouveau pour CAMUSAT à l'avenir ?
                <span className="text-red-400 ml-1">*</span>
              </p>
              <OuiNon value={form.retravaillerait} onChange={(v) => set("retravaillerait", v)} />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                5.4 — Recommanderiez-vous à votre entourage de travailler chez CAMUSAT ?
                <span className="text-red-400 ml-1">*</span>
              </p>
              <OuiNon value={form.recommande} onChange={(v) => set("recommande", v)} />
            </div>

            <Field
              label="5.5 — Quel sera votre nouveau poste et votre entreprise ?"
              placeholder="Ex. : Ingénieur réseau chez XYZ..."
              value={form.nouveau_poste}
              onChange={(v) => set("nouveau_poste", v)}
              rows={2}
            />
            <Field
              label="5.6 — Avez-vous des suggestions d'améliorations et/ou des commentaires à apporter ?"
              placeholder="Vos remarques finales..."
              value={form.suggestions}
              onChange={(v) => set("suggestions", v)}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div ref={topRef} className="w-full h-full flex flex-col px-4 pt-3 pb-2 gap-2 overflow-hidden">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-camublue-900 flex items-center gap-2">
            <ClipboardList size={24} />
            Questionnaire de sortie
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Ce questionnaire est confidentiel — vos réponses permettront d'améliorer nos pratiques.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-camublue-900" size={36} />
          </div>
        )}

        {/* Aucun questionnaire */}
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

        {/* Déjà soumis */}
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
                <p className="text-xs text-slate-400 mt-1">
                  Nous vous remercions d'avoir répondu à ce questionnaire et nous vous souhaitons une bonne continuation !
                </p>
              </div>
            </motion.div>
            <SuspensionBanner dateSortie={info.date_sortie} />
          </div>
        )}

        {/* Wizard formulaire */}
        {!loading && !notFound && !submitted && info && (
          <div className="flex-1 flex flex-col overflow-hidden gap-2">

            {/* Badge envoi */}
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <Clock size={13} className="text-amber-600 shrink-0" />
              <span className="text-sm text-amber-700 font-medium">
                Envoyé le {new Date(info.date_envoi).toLocaleDateString("fr-FR")}
              </span>
            </div>

            {/* Progression */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Section {step} sur {dynTotal}
                </span>
                <span className="text-xs font-bold text-camublue-900">
                  {Math.round((step / dynTotal) * 100)} %
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-camublue-900 rounded-full"
                  initial={false}
                  animate={{ width: `${(step / dynTotal) * 100}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between mt-3">
                {(isDynamic ? dynSections : STEPS).map((s, i) => {
                  const id   = i + 1;
                  const sec  = isDynamic ? (s as SectionDef).num   : (s as typeof STEPS[0]).section;
                  const ttl  = isDynamic ? (s as SectionDef).title : (s as typeof STEPS[0]).title;
                  return (
                    <div key={id} className={`flex flex-col items-center gap-1 ${id > step ? "opacity-30" : ""}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        id < step   ? "bg-camublue-900 text-white" :
                        id === step ? "bg-camublue-900 text-white ring-4 ring-camublue-900/20" :
                        "bg-slate-100 text-slate-400"
                      }`}>
                        {id < step ? <CheckCircle size={13} /> : sec}
                      </div>
                      <span className="text-[10px] text-slate-400 hidden sm:block">{ttl}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Carte étape */}
            <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-slate-50">
                {isDynamic ? (<>
                  <p className="text-xs font-semibold text-camublue-900/60 uppercase tracking-widest mb-1">
                    Section {dynSections[step - 1]?.num}
                  </p>
                  <h2 className="text-lg font-bold text-slate-800">{dynSections[step - 1]?.title}</h2>
                  {dynSections[step - 1]?.subtitle && (
                    <p className="text-sm text-slate-400 mt-0.5">{dynSections[step - 1].subtitle}</p>
                  )}
                </>) : (<>
                  <p className="text-xs font-semibold text-camublue-900/60 uppercase tracking-widest mb-1">
                    Section {STEPS[step - 1].section}
                  </p>
                  <h2 className="text-lg font-bold text-slate-800">{STEPS[step - 1].title}</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{STEPS[step - 1].subtitle}</p>
                </>)}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
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
                    {isDynamic ? renderDynamicStep() : renderStep()}
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
                {step < dynTotal ? (
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

            {/* Note confidentialité */}
            <p className="text-center text-xs text-slate-300">
              Ce document est confidentiel — il ne peut être communiqué à des tiers sans le consentement écrit de CAMUSAT.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
