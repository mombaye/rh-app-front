import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createEmployee, updateEmployee } from "@/services/employeeService";
import {
  ContractType, Employee, Enfant,
  SexeType, SituationMatrimoniale, TypePiece,
} from "@/types/employee";
import {
  User, FileText, Users, Landmark, Briefcase,
  ChevronLeft, ChevronRight, Check,
  Mail, Phone, MapPin, Building2, UserCheck,
} from "lucide-react";

// ── Types et données par défaut ───────────────────────────────────────────────
type FormData = {
  matricule: string; nom: string; prenom: string; sexe: SexeType;
  date_naissance: string; lieu_naissance: string; nationalite: string; adresse: string;
  email: string; telephone: string;
  type_contrat: ContractType | ""; fonction: string; categorie: string;
  date_embauche: string; date_fin_cdd: string; date_fin_periode_essai: string;
  business_line: string; projet: string; service: string; localisation: string;
  manager: string; manager_email: string;
  type_piece: TypePiece | ""; numero_piece: string; date_delivrance: string; date_expiration: string;
  contact_urgence_nom: string; contact_urgence_telephone: string;
  prenom_pere: string; nom_prenom_mere: string;
  situation_matrimoniale: SituationMatrimoniale | "";
  nom_conjoint: string; nombre_enfants: number; enfants: Enfant[];
  rib: string; banque: string;
};

const EMPTY: FormData = {
  matricule: "", nom: "", prenom: "", sexe: "H",
  date_naissance: "", lieu_naissance: "", nationalite: "", adresse: "",
  email: "", telephone: "",
  type_contrat: "", fonction: "", categorie: "",
  date_embauche: "", date_fin_cdd: "", date_fin_periode_essai: "",
  business_line: "", projet: "", service: "", localisation: "",
  manager: "", manager_email: "",
  type_piece: "", numero_piece: "", date_delivrance: "", date_expiration: "",
  contact_urgence_nom: "", contact_urgence_telephone: "",
  prenom_pere: "", nom_prenom_mere: "", situation_matrimoniale: "",
  nom_conjoint: "", nombre_enfants: 0, enfants: [],
  rib: "", banque: "",
};

// ── Étapes du formulaire ───────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Identité",       icon: User,      desc: "Informations personnelles & contact" },
  { id: 2, label: "Professionnel",  icon: Briefcase, desc: "Poste, contrat & hiérarchie"         },
  { id: 3, label: "Pièce d'identité", icon: FileText, desc: "Document officiel d'identité"      },
  { id: 4, label: "Famille",        icon: Users,     desc: "Situation familiale & urgence"       },
  { id: 5, label: "Banque",         icon: Landmark,  desc: "Informations bancaires"              },
];

// ── Composants utilitaires ───────────────────────────────────────────────────
function F({ label, children, req, col2 }: {
  label: string; children: React.ReactNode; req?: boolean; col2?: boolean;
}) {
  return (
    <div className={col2 ? "sm:col-span-2" : ""}>
      <Label className="text-sm font-medium text-gray-700 mb-2 block">
        {label}{req && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Sel({ name, value, onChange, opts, ph }: {
  name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  opts: { v: string; l: string }[]; ph?: string;
}) {
  return (
    <select name={name} value={value} onChange={onChange}
      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 shadow-sm">
      {ph && <option value="">{ph}</option>}
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 shadow-sm">
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
interface Props {
  open: boolean; onClose: () => void; onSuccess: () => void;
  initialData?: Employee | null; defaultContractType?: ContractType;
}

export default function EmployeeFormModal({ open, onClose, onSuccess, initialData, defaultContractType }: Props) {
  const isEdit = !!initialData;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...EMPTY });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (isEdit && initialData) {
      const enfants: Enfant[] = (initialData.enfants ?? []).map(e => ({
        nom: String((e as Enfant).nom ?? ""),
        date_naissance: String((e as Enfant).date_naissance ?? ""),
      }));
      setForm({
        matricule: initialData.matricule ?? "", nom: initialData.nom ?? "",
        prenom: initialData.prenom ?? "", sexe: (initialData.sexe as SexeType) ?? "H",
        date_naissance: initialData.date_naissance ?? "", lieu_naissance: initialData.lieu_naissance ?? "",
        nationalite: initialData.nationalite ?? "", adresse: initialData.adresse ?? "",
        email: initialData.email ?? "", telephone: initialData.telephone ?? "",
        type_contrat: initialData.type_contrat ?? "", fonction: initialData.fonction ?? "",
        categorie: initialData.categorie ?? "", date_embauche: initialData.date_embauche ?? "",
        date_fin_cdd: initialData.date_fin_cdd ?? "",
        date_fin_periode_essai: initialData.date_fin_periode_essai ?? "",
        business_line: initialData.business_line ?? "", projet: initialData.projet ?? "",
        service: initialData.service ?? "", localisation: initialData.localisation ?? "",
        manager: initialData.manager ?? "", manager_email: initialData.manager_email ?? "",
        type_piece: (initialData.type_piece as TypePiece) ?? "", numero_piece: initialData.numero_piece ?? "",
        date_delivrance: initialData.date_delivrance ?? "", date_expiration: initialData.date_expiration ?? "",
        contact_urgence_nom: initialData.contact_urgence_nom ?? "",
        contact_urgence_telephone: initialData.contact_urgence_telephone ?? "",
        prenom_pere: initialData.prenom_pere ?? "", nom_prenom_mere: initialData.nom_prenom_mere ?? "",
        situation_matrimoniale: (initialData.situation_matrimoniale as SituationMatrimoniale) ?? "",
        nom_conjoint: initialData.nom_conjoint ?? "",
        nombre_enfants: initialData.nombre_enfants ?? 0, enfants,
        rib: initialData.rib ?? "", banque: initialData.banque ?? "",
      });
    } else {
      setForm({ ...EMPTY, type_contrat: defaultContractType ?? "" });
    }
  }, [open, initialData, isEdit, defaultContractType]);

  const ch = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };

  const setNbEnfants = (n: number) => {
    const nb = Math.max(0, Math.min(7, n));
    setForm(p => {
      const arr = [...(p.enfants ?? [])];
      while (arr.length < nb) arr.push({ nom: "", date_naissance: "" });
      return { ...p, nombre_enfants: nb, enfants: arr.slice(0, nb) };
    });
  };

  const chEnfant = (i: number, f: keyof Enfant, v: string) =>
    setForm(p => { const a = [...(p.enfants ?? [])]; a[i] = { ...a[i], [f]: v }; return { ...p, enfants: a }; });

  const nullDate = (v: string) => v || null;

  const submit = async () => {
    setLoading(true);
    const payload: Partial<Employee> = {
      ...form,
      type_contrat: (form.type_contrat || undefined) as ContractType | undefined,
      situation_matrimoniale: (form.situation_matrimoniale || undefined) as SituationMatrimoniale | undefined,
      type_piece: (form.type_piece || undefined) as TypePiece | undefined,
      date_naissance: nullDate(form.date_naissance),
      date_delivrance: nullDate(form.date_delivrance),
      date_expiration: nullDate(form.date_expiration),
      date_fin_cdd: nullDate(form.date_fin_cdd),
      date_fin_periode_essai: nullDate(form.date_fin_periode_essai),
    };
    try {
      if (isEdit && initialData) {
        await updateEmployee(initialData.id, payload);
        const planningSync =
          form.nom !== (initialData.nom ?? "") ||
          form.prenom !== (initialData.prenom ?? "") ||
          form.matricule !== (initialData.matricule ?? "");
        toast.success(
          planningSync
            ? "Employé mis à jour — le planning shifts a été synchronisé automatiquement."
            : "Employé mis à jour !",
          { duration: planningSync ? 4000 : 2000 },
        );
      } else {
        await createEmployee(payload);
        toast.success("Employé ajouté !");
      }
      onSuccess(); onClose();
    } catch (err: any) {
      const detail = err?.response?.data;
      const msg = typeof detail === "string"
        ? detail
        : detail
          ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
          : "Erreur lors de l'enregistrement";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const isLast = step === STEPS.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden shadow-xl rounded-lg">

        {/* ── En-tête du dialogue ── */}
        <DialogHeader className="px-8 pt-6 pb-5 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
          <DialogTitle className="text-xl font-bold">
            {isEdit ? "Modifier l'employé" : "Ajouter un employé"}
          </DialogTitle>
          <p className="text-sm mt-1 opacity-90">
            {isEdit ? "Mettez à jour les informations du dossier" : "Remplissez les étapes pour créer le dossier"}
          </p>
        </DialogHeader>

        {/* ── Stepper (indicateurs d'étapes) ── */}
        <div className="px-8 py-5 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const cur = step === s.id;
              return (
                <div key={s.id} className="flex items-center flex-1 min-w-0 relative group">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg transition-all text-center ${
                      cur ? "opacity-100" : done ? "opacity-100 cursor-pointer" : "opacity-60 cursor-pointer hover:opacity-90"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                      cur ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" :
                      done ? "bg-green-500 border-green-500 text-white" :
                             "bg-white border-gray-300 text-gray-500 group-hover:border-blue-400"
                    }`}>
                      {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{s.id}</span>}
                    </div>
                    <span className={`text-xs font-medium ${
                      cur ? "text-blue-600" : done ? "text-green-600" : "text-gray-500 group-hover:text-blue-500"
                    }`}>
                      {s.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`absolute top-1/2 right-0 transform translate-y-1/2 h-0.5 w-1/3 rounded-full transition-colors ${
                      step > s.id ? "bg-green-500" : "bg-gray-200 group-hover:bg-blue-200"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-sm text-gray-500 mt-4 text-center">
            Étape <span className="font-semibold text-blue-600">{step}</span> sur {STEPS.length}
            <span className="mx-2 text-gray-400">·</span>
            <span className="text-gray-600">{STEPS[step - 1].desc}</span>
          </p>
        </div>

        {/* ── Corps du formulaire ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-gray-50">
          {/* ─── Étape 1 : Identité ─── */}
          {step === 1 && (
            <div className="space-y-7">
              <SectionHeader icon={User} title="État civil" subtitle="Identification de l'employé" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Matricule" req>
                  <Input name="matricule" value={form.matricule} onChange={ch} placeholder="EX-0001"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Sexe">
                  <Sel name="sexe" value={form.sexe} onChange={ch}
                    opts={[{v:"H",l:"Homme"},{v:"F",l:"Femme"}]} />
                </F>
                <F label="Nom" req>
                  <Input name="nom" value={form.nom} onChange={ch} placeholder="DIOP"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Prénom" req>
                  <Input name="prenom" value={form.prenom} onChange={ch} placeholder="Mamadou"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Date de naissance">
                  <Input type="date" name="date_naissance" value={form.date_naissance} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Lieu de naissance">
                  <Input name="lieu_naissance" value={form.lieu_naissance} onChange={ch} placeholder="Dakar"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Nationalité">
                  <Input name="nationalite" value={form.nationalite} onChange={ch} placeholder="Sénégalaise"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Adresse">
                  <Input name="adresse" value={form.adresse} onChange={ch} placeholder="Rue, quartier, ville"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>

              <SectionHeader icon={Mail} title="Contact direct" subtitle="Coordonnées personnelles" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Adresse e-mail">
                  <Input type="email" name="email" value={form.email} onChange={ch} placeholder="prenom.nom@example.com"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Téléphone">
                  <Input name="telephone" value={form.telephone} onChange={ch} placeholder="+221 77 000 00 00"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>
            </div>
          )}

          {/* ─── Étape 2 : Professionnel ─── */}
          {step === 2 && (
            <div className="space-y-7">
              <SectionHeader icon={Briefcase} title="Poste & contrat" subtitle="Rôle et conditions d'emploi" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Type de contrat" req>
                  <Sel name="type_contrat" value={form.type_contrat} onChange={ch} ph="— Sélectionner —"
                    opts={[{v:"CDI",l:"CDI"},{v:"CDD",l:"CDD"},{v:"STAGE",l:"Stage"},{v:"INTERIM",l:"Intérim"}]} />
                </F>
                <F label="Fonction">
                  <Input name="fonction" value={form.fonction} onChange={ch} placeholder="Technicien, Ingénieur…"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Catégorie">
                  <Input name="categorie" value={form.categorie} onChange={ch} placeholder="Cadre, Agent de maîtrise…"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Date d'embauche">
                  <Input type="date" name="date_embauche" value={form.date_embauche} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                {(form.type_contrat === "CDD" || form.type_contrat === "STAGE") && (
                  <F label="Date fin CDD / Stage">
                    <Input type="date" name="date_fin_cdd" value={form.date_fin_cdd} onChange={ch}
                      className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                  </F>
                )}
                <F label="Date fin période d'essai">
                  <Input type="date" name="date_fin_periode_essai" value={form.date_fin_periode_essai} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>

              <SectionHeader icon={Building2} title="Organisation" subtitle="Rattachement dans l'entreprise" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Business Line">
                  <Input name="business_line" value={form.business_line} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Projet">
                  <Input name="projet" value={form.projet} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Service / Département">
                  <Input name="service" value={form.service} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Localisation">
                  <Input name="localisation" value={form.localisation} onChange={ch} placeholder="Dakar, Abidjan…"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>

              <SectionHeader icon={UserCheck} title="Hiérarchie" subtitle="Manager direct" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Nom du manager">
                  <Input name="manager" value={form.manager} onChange={ch} placeholder="Prénom NOM"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Email du manager">
                  <Input type="email" name="manager_email" value={form.manager_email} onChange={ch} placeholder="manager@example.com"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>
            </div>
          )}

          {/* ─── Étape 3 : Pièce d'identité ─── */}
          {step === 3 && (
            <div className="space-y-7">
              <SectionHeader icon={FileText} title="Document officiel" subtitle="Pièce d'identité en cours de validité" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Type de pièce">
                  <Sel name="type_piece" value={form.type_piece} onChange={ch} ph="— Sélectionner —"
                    opts={[
                      {v:"CNI",l:"Carte Nationale d'Identité"},
                      {v:"PASSEPORT",l:"Passeport"},
                      {v:"SEJOUR",l:"Titre de séjour"},
                      {v:"AUTRE",l:"Autre"},
                    ]} />
                </F>
                <F label="Numéro de pièce">
                  <Input name="numero_piece" value={form.numero_piece} onChange={ch} placeholder="123456789"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Date de délivrance">
                  <Input type="date" name="date_delivrance" value={form.date_delivrance} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Date d'expiration">
                  <Input type="date" name="date_expiration" value={form.date_expiration} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>
            </div>
          )}

          {/* ─── Étape 4 : Situation familiale ─── */}
          {step === 4 && (
            <div className="space-y-7">
              <SectionHeader icon={Phone} title="Contact d'urgence" subtitle="Personne à joindre en cas d'urgence" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Nom complet">
                  <Input name="contact_urgence_nom" value={form.contact_urgence_nom} onChange={ch} placeholder="Nom du contact"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Téléphone">
                  <Input name="contact_urgence_telephone" value={form.contact_urgence_telephone} onChange={ch} placeholder="+221 77 000 00 00"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>

              <SectionHeader icon={Users} title="Filiation" subtitle="Informations sur les parents" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Prénom du père">
                  <Input name="prenom_pere" value={form.prenom_pere} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Prénom & Nom de la mère">
                  <Input name="nom_prenom_mere" value={form.nom_prenom_mere} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>

              <SectionHeader icon={Users} title="Situation familiale" subtitle="État matrimonial et enfants" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Situation matrimoniale">
                  <Sel name="situation_matrimoniale" value={form.situation_matrimoniale} onChange={ch} ph="— Sélectionner —"
                    opts={[
                      {v:"celibataire",l:"Célibataire"},
                      {v:"marie",l:"Marié(e)"},
                      {v:"divorce",l:"Divorcé(e)"},
                      {v:"veuf",l:"Veuf / Veuve"},
                    ]} />
                </F>
                <F label="Nom & Prénom conjoint(e)">
                  <Input name="nom_conjoint" value={form.nom_conjoint} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Nombre d'enfants (max 7)">
                  <Input type="number" min={0} max={7} name="nombre_enfants"
                    value={form.nombre_enfants}
                    onChange={e => setNbEnfants(parseInt(e.target.value) || 0)}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>
              {form.nombre_enfants > 0 && (
                <div className="space-y-3 mt-3">
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wider">Détail des enfants</p>
                  {Array.from({ length: form.nombre_enfants }).map((_, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-white border border-gray-200 shadow-sm">
                      <F label={`Enfant ${i + 1} — Nom`}>
                        <Input value={form.enfants[i]?.nom ?? ""} onChange={e => chEnfant(i, "nom", e.target.value)} placeholder="Nom complet"
                          className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                      </F>
                      <F label="Date de naissance">
                        <Input type="date" value={form.enfants[i]?.date_naissance ?? ""} onChange={e => chEnfant(i, "date_naissance", e.target.value)}
                          className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                      </F>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Étape 5 : Informations bancaires ─── */}
          {step === 5 && (
            <div className="space-y-7">
              <SectionHeader icon={Landmark} title="Coordonnées bancaires" subtitle="Pour le versement du salaire" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <F label="Banque">
                  <Input name="banque" value={form.banque} onChange={ch} placeholder="Nom de la banque"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Relevé d'Identité Bancaire (RIB)" col2>
                  <Input name="rib" value={form.rib} onChange={ch} placeholder="SN00 0000 0000 0000 0000 000"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>
            </div>
          )}
        </div>

        {/* ── Pied de page (navigation) ── */}
        <div className="px-8 py-5 border-t border-gray-200 bg-white flex items-center justify-between">
          <Button
            type="button" variant="outline"
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-2 text-gray-700 hover:bg-gray-100 border-gray-300"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Annuler" : "Précédent"}
          </Button>

          <div className="flex items-center gap-2">
            {STEPS.map(s => (
              <div key={s.id} className={`h-2 rounded-full transition-all ${
                s.id === step ? "w-8 bg-blue-600" :
                s.id < step ? "w-2 bg-green-500" :
                              "w-2 bg-gray-300"
              }`} />
            ))}
          </div>

          {isLast ? (
            <Button onClick={submit} disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <Check className="h-4 w-4" />
              {loading ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer l'employé"}
            </Button>
          ) : (
            <Button type="button" onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}