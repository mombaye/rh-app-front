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
} from "lucide-react";

// ── FormData ──────────────────────────────────────────────────────────────────
type FormData = {
  matricule: string; nom: string; prenom: string; sexe: SexeType;
  date_naissance: string; lieu_naissance: string; nationalite: string; adresse: string;
  type_piece: TypePiece | ""; numero_piece: string; date_delivrance: string; date_expiration: string;
  contact_urgence_nom: string; contact_urgence_telephone: string;
  prenom_pere: string; nom_prenom_mere: string;
  situation_matrimoniale: SituationMatrimoniale | "";
  nom_conjoint: string; nombre_enfants: number; enfants: Enfant[];
  rib: string; banque: string;
  type_contrat: ContractType | ""; fonction: string; categorie: string;
  date_embauche: string; date_fin_cdd: string; date_fin_periode_essai: string;
  business_line: string; projet: string; service: string;
  manager: string; localisation: string; email: string; telephone: string;
};

const EMPTY: FormData = {
  matricule: "", nom: "", prenom: "", sexe: "H",
  date_naissance: "", lieu_naissance: "", nationalite: "", adresse: "",
  type_piece: "", numero_piece: "", date_delivrance: "", date_expiration: "",
  contact_urgence_nom: "", contact_urgence_telephone: "",
  prenom_pere: "", nom_prenom_mere: "", situation_matrimoniale: "",
  nom_conjoint: "", nombre_enfants: 0, enfants: [],
  rib: "", banque: "",
  type_contrat: "", fonction: "", categorie: "",
  date_embauche: "", date_fin_cdd: "", date_fin_periode_essai: "",
  business_line: "", projet: "", service: "",
  manager: "", localisation: "", email: "", telephone: "",
};

// ── Étapes ────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Identité",         icon: User,      desc: "Informations personnelles" },
  { id: 2, label: "Pièce d'identité", icon: FileText,  desc: "Document officiel" },
  { id: 3, label: "Famille",          icon: Users,     desc: "Famille & contact d'urgence" },
  { id: 4, label: "Banque",           icon: Landmark,  desc: "Informations bancaires" },
  { id: 5, label: "Professionnel",    icon: Briefcase, desc: "Informations professionnelles" },
];

// ── Composants utilitaires ───────────────────────────────────────────────────
function F({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-600 mb-1 block">
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
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      {ph && <option value="">{ph}</option>}
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
interface Props {
  open: boolean; onClose: () => void; onSuccess: () => void;
  initialData?: Employee | null; defaultContractType?: ContractType;
}

export default function EmployeeFormModal({ open, onClose, onSuccess, initialData, defaultContractType }: Props) {
  const isEdit = !!initialData;
  const [step, setStep]       = useState(1);
  const [form, setForm]       = useState<FormData>({ ...EMPTY });
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
        type_piece: (initialData.type_piece as TypePiece) ?? "", numero_piece: initialData.numero_piece ?? "",
        date_delivrance: initialData.date_delivrance ?? "", date_expiration: initialData.date_expiration ?? "",
        contact_urgence_nom: initialData.contact_urgence_nom ?? "",
        contact_urgence_telephone: initialData.contact_urgence_telephone ?? "",
        prenom_pere: initialData.prenom_pere ?? "", nom_prenom_mere: initialData.nom_prenom_mere ?? "",
        situation_matrimoniale: (initialData.situation_matrimoniale as SituationMatrimoniale) ?? "",
        nom_conjoint: initialData.nom_conjoint ?? "",
        nombre_enfants: initialData.nombre_enfants ?? 0, enfants,
        rib: initialData.rib ?? "", banque: initialData.banque ?? "",
        type_contrat: initialData.type_contrat ?? "", fonction: initialData.fonction ?? "",
        categorie: initialData.categorie ?? "", date_embauche: initialData.date_embauche ?? "",
        date_fin_cdd: initialData.date_fin_cdd ?? "",
        date_fin_periode_essai: initialData.date_fin_periode_essai ?? "",
        business_line: initialData.business_line ?? "", projet: initialData.projet ?? "",
        service: initialData.service ?? "", manager: initialData.manager ?? "",
        localisation: initialData.localisation ?? "", email: initialData.email ?? "",
        telephone: initialData.telephone ?? "",
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

  // Convertit "" → null pour les DateFields Django (qui rejettent les chaînes vides)
  const nullDate = (v: string) => v || null;

  const submit = async () => {
    setLoading(true);
    const payload: Partial<Employee> = {
      ...form,
      // Champs choice : chaîne vide → undefined (omis de la requête)
      type_contrat:           (form.type_contrat || undefined) as ContractType | undefined,
      situation_matrimoniale: (form.situation_matrimoniale || undefined) as SituationMatrimoniale | undefined,
      type_piece:             (form.type_piece || undefined) as TypePiece | undefined,
      // DateFields : chaîne vide → null (Django rejette "")
      date_naissance:         nullDate(form.date_naissance),
      date_delivrance:        nullDate(form.date_delivrance),
      date_expiration:        nullDate(form.date_expiration),
      date_fin_cdd:           nullDate(form.date_fin_cdd),
      date_fin_periode_essai: nullDate(form.date_fin_periode_essai),
    };
    try {
      if (isEdit && initialData) {
        await updateEmployee(initialData.id, payload);
        const planningSync =
          form.nom        !== (initialData.nom        ?? "") ||
          form.prenom     !== (initialData.prenom     ?? "") ||
          form.matricule  !== (initialData.matricule  ?? "");
        toast.success(
          planningSync
            ? "Employé mis à jour — le planning shifts a été synchronisé automatiquement."
            : "Employé mis à jour !",
          { duration: planningSync ? 4000 : 2000 },
        );
      } else { await createEmployee(payload); toast.success("Employé ajouté !"); }
      onSuccess(); onClose();
    } catch (err: any) {
      const detail = err?.response?.data;
      const msg = typeof detail === "string"
        ? detail
        : detail
          ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
          : "Erreur lors de l'enregistrement";
      toast.error(msg);
    }
    finally  { setLoading(false); }
  };

  const isLast = step === STEPS.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-800">
            {isEdit ? "Modifier l'employé" : "Ajouter un employé"}
          </DialogTitle>
        </DialogHeader>

        {/* Barre de progression */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const cur  = step === s.id;
              return (
                <div key={s.id} className="flex items-center flex-1 min-w-0">
                  <button type="button" onClick={() => done && setStep(s.id)}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl w-full transition-all text-center ${
                      cur  ? "bg-blue-900 text-white shadow-md" :
                      done ? "bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer" :
                             "bg-slate-100 text-slate-400"}`}>
                    <div className="flex items-center gap-1">
                      {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                      <span className="text-[10px] font-bold hidden sm:block truncate">{s.label}</span>
                    </div>
                  </button>
                  {i < STEPS.length - 1 && <div className={`h-0.5 w-2 shrink-0 mx-0.5 rounded-full ${step > s.id ? "bg-blue-500" : "bg-slate-200"}`} />}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 mb-3">
            Étape {step}/{STEPS.length} — <span className="font-semibold">{STEPS[step - 1].desc}</span>
          </p>
          <div className="h-px bg-slate-100 -mx-6" />
        </div>

        {/* Corps de l'étape */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Matricule" req><Input name="matricule" value={form.matricule} onChange={ch} placeholder="EX-0001" /></F>
              <F label="Sexe">
                <Sel name="sexe" value={form.sexe} onChange={ch} opts={[{v:"H",l:"Homme"},{v:"F",l:"Femme"}]} />
              </F>
              <F label="Nom" req><Input name="nom" value={form.nom} onChange={ch} placeholder="DIOP" /></F>
              <F label="Prénom" req><Input name="prenom" value={form.prenom} onChange={ch} placeholder="Mamadou" /></F>
              <F label="Date de naissance"><Input type="date" name="date_naissance" value={form.date_naissance} onChange={ch} /></F>
              <F label="Lieu de naissance"><Input name="lieu_naissance" value={form.lieu_naissance} onChange={ch} placeholder="Dakar" /></F>
              <F label="Nationalité"><Input name="nationalite" value={form.nationalite} onChange={ch} placeholder="Sénégalaise" /></F>
              <F label="Adresse"><Input name="adresse" value={form.adresse} onChange={ch} placeholder="Rue, quartier, ville" /></F>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Type de pièce">
                <Sel name="type_piece" value={form.type_piece} onChange={ch} ph="— Sélectionner —"
                  opts={[{v:"CNI",l:"Carte Nationale d'Identité"},{v:"PASSEPORT",l:"Passeport"},{v:"SEJOUR",l:"Titre de séjour"},{v:"AUTRE",l:"Autre"}]} />
              </F>
              <F label="Numéro de pièce"><Input name="numero_piece" value={form.numero_piece} onChange={ch} placeholder="123456789" /></F>
              <F label="Date de délivrance"><Input type="date" name="date_delivrance" value={form.date_delivrance} onChange={ch} /></F>
              <F label="Date d'expiration"><Input type="date" name="date_expiration" value={form.date_expiration} onChange={ch} /></F>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Contact d'urgence</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Personne à contacter en cas d'urgence">
                    <Input name="contact_urgence_nom" value={form.contact_urgence_nom} onChange={ch} placeholder="Nom complet" />
                  </F>
                  <F label="Téléphone à appeler">
                    <Input name="contact_urgence_telephone" value={form.contact_urgence_telephone} onChange={ch} placeholder="+221 77 000 00 00" />
                  </F>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Filiation</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Prénom du père"><Input name="prenom_pere" value={form.prenom_pere} onChange={ch} /></F>
                  <F label="Prénom & Nom de la mère"><Input name="nom_prenom_mere" value={form.nom_prenom_mere} onChange={ch} /></F>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Situation familiale</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Situation matrimoniale">
                    <Sel name="situation_matrimoniale" value={form.situation_matrimoniale} onChange={ch} ph="— Sélectionner —"
                      opts={[{v:"celibataire",l:"Célibataire"},{v:"marie",l:"Marié(e)"},{v:"divorce",l:"Divorcé(e)"},{v:"veuf",l:"Veuf / Veuve"}]} />
                  </F>
                  <F label="Prénom & Nom conjoint(e)"><Input name="nom_conjoint" value={form.nom_conjoint} onChange={ch} /></F>
                  <F label="Nombre d'enfants (max 7)">
                    <Input type="number" min={0} max={7} name="nombre_enfants"
                      value={form.nombre_enfants} onChange={e => setNbEnfants(parseInt(e.target.value) || 0)} />
                  </F>
                </div>
              </div>
              {form.nombre_enfants > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Enfants</p>
                  <div className="space-y-2">
                    {Array.from({ length: form.nombre_enfants }).map((_, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <F label={`Nom enfant ${i + 1}`}>
                          <Input value={form.enfants[i]?.nom ?? ""} onChange={e => chEnfant(i, "nom", e.target.value)} placeholder="Nom complet" />
                        </F>
                        <F label="Date de naissance">
                          <Input type="date" value={form.enfants[i]?.date_naissance ?? ""} onChange={e => chEnfant(i, "date_naissance", e.target.value)} />
                        </F>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Relevé d'Identité Bancaire (RIB)">
                <Input name="rib" value={form.rib} onChange={ch} placeholder="SN00 0000 0000 0000 0000 000" />
              </F>
              <F label="Banque"><Input name="banque" value={form.banque} onChange={ch} placeholder="Nom de la banque" /></F>
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Type de contrat" req>
                <Sel name="type_contrat" value={form.type_contrat} onChange={ch} ph="— Sélectionner —"
                  opts={[{v:"CDI",l:"CDI"},{v:"CDD",l:"CDD"},{v:"STAGE",l:"Stage"},{v:"INTERIM",l:"Intérim"}]} />
              </F>
              <F label="Fonction"><Input name="fonction" value={form.fonction} onChange={ch} placeholder="Technicien, Ingénieur…" /></F>
              <F label="Catégorie"><Input name="categorie" value={form.categorie} onChange={ch} placeholder="Cadre, Agent de maîtrise…" /></F>
              <F label="Date d'embauche"><Input type="date" name="date_embauche" value={form.date_embauche} onChange={ch} /></F>
              {(form.type_contrat === "CDD" || form.type_contrat === "STAGE") && (
                <F label="Date fin CDD / Stage"><Input type="date" name="date_fin_cdd" value={form.date_fin_cdd} onChange={ch} /></F>
              )}
              <F label="Date fin période d'essai"><Input type="date" name="date_fin_periode_essai" value={form.date_fin_periode_essai} onChange={ch} /></F>
              <F label="Business Line"><Input name="business_line" value={form.business_line} onChange={ch} /></F>
              <F label="Projet"><Input name="projet" value={form.projet} onChange={ch} /></F>
              <F label="Service"><Input name="service" value={form.service} onChange={ch} /></F>
              <F label="Line Manager"><Input name="manager" value={form.manager} onChange={ch} /></F>
              <F label="Localisation"><Input name="localisation" value={form.localisation} onChange={ch} /></F>
              <F label="Adresse mail"><Input type="email" name="email" value={form.email} onChange={ch} /></F>
              <F label="Téléphone"><Input name="telephone" value={form.telephone} onChange={ch} /></F>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center justify-between bg-white">
          <Button type="button" variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-2">
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Annuler" : "Précédent"}
          </Button>
          {isLast ? (
            <Button onClick={submit} disabled={loading}
              className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white">
              <Check className="h-4 w-4" />
              {loading ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Créer l'employé"}
            </Button>
          ) : (
            <Button type="button" onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white">
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
