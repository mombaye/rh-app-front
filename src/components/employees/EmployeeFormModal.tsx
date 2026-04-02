import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createEmployee, updateEmployee, getEmployees } from "@/services/employeeService";
import { departmentService, employeeHierarchyService, DepartmentManagerMini } from "@/services/hierarchyService";
import {
  ContractType, Employee, Enfant,
  SexeType, SituationMatrimoniale, TypePiece,
} from "@/types/employee";
import { Department } from "@/types/leave";
import {
  User, FileText, Users, Landmark, Briefcase,
  ChevronLeft, ChevronRight, Check,
  Mail, Phone, Building2, UserCheck,
  Search, AlertCircle,
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
  n1_manager: number | null; n2_manager: number | null;
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
  n1_manager: null, n2_manager: null,
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
function F({ label, children, req, col2, error }: {
  label: string; children: React.ReactNode; req?: boolean; col2?: boolean; error?: boolean;
}) {
  return (
    <div className={col2 ? "sm:col-span-2" : ""}>
      <Label className={`text-sm font-medium mb-2 block ${error ? "text-red-600" : "text-gray-700"}`}>
        {label}
        {req && <span className={`ml-0.5 ${error ? "text-red-600" : "text-red-400"}`}>*</span>}
        {error && <span className="ml-1 text-xs font-normal text-red-500">(requis)</span>}
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
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [touchedRequired, setTouchedRequired] = useState(false);

  // ── Données de référence pour les dropdowns hiérarchiques ──
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mgrSearch, setMgrSearch] = useState("");
  const [n2Search, setN2Search] = useState("");
  const [showN1Dropdown, setShowN1Dropdown] = useState(false);
  const [showN2Dropdown, setShowN2Dropdown] = useState(false);
  // Infos enrichies du manager N+2 (email non stocké sur Employee pour N+2)
  const [n2ManagerInfo, setN2ManagerInfo] = useState<DepartmentManagerMini | null>(null);
  const [detectingManagers, setDetectingManagers] = useState(false);

  // Charger les employés et départements à l'ouverture
  useEffect(() => {
    if (!open) return;
    getEmployees({ status: "ACTIVE" }).then(setAllEmployees).catch(() => {});
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMgrSearch("");
    setN2Search("");
    setStepErrors([]);
    setTouchedRequired(false);
    setN2ManagerInfo(null);
    setDetectingManagers(false);
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
        n1_manager: initialData.n1_manager ?? null, n2_manager: initialData.n2_manager ?? null,
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

  /**
   * Détecte automatiquement N+1 et N+2 depuis un nom de service/département.
   * 1) Cherche d'abord dans les départements déjà chargés (synchrone).
   * 2) Appelle l'API si non trouvé en local.
   */
  const autoDetectManagers = useCallback(async (deptName: string, fieldUpdated: "service" | "projet") => {
    if (!deptName) return;

    // ── Recherche locale ──────────────────────────────────────────────────────
    const allDepts = [...departments, ...departments.flatMap(d => d.children || [])];
    const selectedDept = allDepts.find(d => d.name === deptName);

    if (selectedDept) {
      const n1Emp = allEmployees.find(e => e.id === selectedDept.head);
      const parentDept = departments.find(d => d.children?.some(c => c.name === deptName));
      const n2Emp = parentDept ? allEmployees.find(e => e.id === parentDept.head) : null;

      if (n2Emp) {
        setN2ManagerInfo({ id: n2Emp.id, full_name: `${n2Emp.nom} ${n2Emp.prenom}`, email: n2Emp.email || "", fonction: n2Emp.fonction || "", matricule: n2Emp.matricule || "" });
      }

      setForm(p => ({
        ...p,
        [fieldUpdated]: deptName,
        n1_manager: selectedDept.head ?? p.n1_manager,
        manager: n1Emp ? `${n1Emp.nom} ${n1Emp.prenom}` : p.manager,
        manager_email: n1Emp?.email || p.manager_email,
        n2_manager: n2Emp?.id ?? (parentDept?.head ?? p.n2_manager),
      }));
      return;
    }

    // ── Appel API si non trouvé en local ─────────────────────────────────────
    setDetectingManagers(true);
    try {
      const { n1_manager, n2_manager } = await employeeHierarchyService.getManagersByDepartment(deptName);
      if (n2_manager) setN2ManagerInfo(n2_manager);
      setForm(p => ({
        ...p,
        [fieldUpdated]: deptName,
        n1_manager: n1_manager?.id ?? p.n1_manager,
        manager: n1_manager?.full_name ?? p.manager,
        manager_email: n1_manager?.email ?? p.manager_email,
        n2_manager: n2_manager?.id ?? p.n2_manager,
      }));
    } catch {
      // Pas de correspondance dans la hiérarchie → laisser la saisie libre
      setForm(p => ({ ...p, [fieldUpdated]: deptName }));
    } finally {
      setDetectingManagers(false);
    }
  }, [departments, allEmployees]);

  const ch = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Auto-détection des managers depuis la hiérarchie pour service et projet
    if ((name === "service" || name === "projet") && value) {
      autoDetectManagers(value, name as "service" | "projet");
      return;
    }
    setForm(p => ({ ...p, [name]: value }));
  };

  // Auto-sync hiérarchie lors de l'ouverture en mode édition
  // (si l'employé a un service/projet mais pas encore de n1/n2)
  useEffect(() => {
    if (!open || !isEdit || !initialData) return;
    if (initialData.n1_manager) return; // hiérarchie déjà renseignée
    const deptName = initialData.service || initialData.projet;
    if (deptName) {
      // On attend que departments soit chargé
      if (departments.length > 0) {
        autoDetectManagers(deptName, initialData.service ? "service" : "projet");
      }
    }
  }, [open, isEdit, initialData, departments, autoDetectManagers]);

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

  // Fermer les dropdowns au clic extérieur (délai pour permettre le clic sur l'option)
  const closeDropdowns = () => setTimeout(() => { setShowN1Dropdown(false); setShowN2Dropdown(false); }, 200);

  // Sélection N+1 manager
  const selectN1 = (emp: Employee) => {
    setForm(p => ({
      ...p,
      n1_manager: emp.id,
      manager: `${emp.nom} ${emp.prenom}`,
      manager_email: emp.email || "",
    }));
    setMgrSearch("");
    setShowN1Dropdown(false);
  };
  const clearN1 = () => {
    setForm(p => ({ ...p, n1_manager: null, manager: "", manager_email: "" }));
    setMgrSearch("");
  };

  // Sélection N+2 manager
  const selectN2 = (emp: Employee) => {
    setForm(p => ({ ...p, n2_manager: emp.id }));
    setN2Search("");
    setShowN2Dropdown(false);
  };
  const clearN2 = () => {
    setForm(p => ({ ...p, n2_manager: null }));
    setN2Search("");
    setN2ManagerInfo(null);
  };

  // Filtrage des employés pour les dropdowns
  const filteredN1 = allEmployees.filter(e => {
    if (initialData && e.id === initialData.id) return false;
    if (!mgrSearch) return true;
    const s = mgrSearch.toLowerCase();
    return (
      `${e.nom} ${e.prenom}`.toLowerCase().includes(s) ||
      (e.matricule || "").toLowerCase().includes(s) ||
      (e.fonction || "").toLowerCase().includes(s)
    );
  }).slice(0, 10);

  const filteredN2 = allEmployees.filter(e => {
    if (initialData && e.id === initialData.id) return false;
    if (form.n1_manager && e.id === form.n1_manager) return false;
    if (!n2Search) return true;
    const s = n2Search.toLowerCase();
    return (
      `${e.nom} ${e.prenom}`.toLowerCase().includes(s) ||
      (e.matricule || "").toLowerCase().includes(s) ||
      (e.fonction || "").toLowerCase().includes(s)
    );
  }).slice(0, 10);

  // Noms affichés
  const n1Name = form.n1_manager
    ? allEmployees.find(e => e.id === form.n1_manager)
      ? (() => { const e = allEmployees.find(e2 => e2.id === form.n1_manager)!; return `${e.nom} ${e.prenom}`; })()
      : form.manager || `ID: ${form.n1_manager}`
    : "";
  const n2Name = form.n2_manager
    ? allEmployees.find(e => e.id === form.n2_manager)
      ? (() => { const e = allEmployees.find(e2 => e2.id === form.n2_manager)!; return `${e.nom} ${e.prenom}`; })()
      : `ID: ${form.n2_manager}`
    : "";

  // Départements → options pour les champs service et projet
  const deptOptions = departments.flatMap(d => {
    const opts = [{ v: d.name, l: d.name }];
    (d.children || []).forEach(c => opts.push({ v: c.name, l: `  └ ${c.name}` }));
    return opts;
  });

  // Validation par étape — retourne les erreurs
  const validateStep = (s: number): string[] => {
    const errs: string[] = [];
    if (s === 1) {
      if (!form.matricule.trim()) errs.push("matricule");
      if (!form.nom.trim()) errs.push("nom");
      if (!form.prenom.trim()) errs.push("prenom");
    }
    if (s === 2) {
      if (!form.type_contrat) errs.push("type_contrat");
    }
    return errs;
  };

  const goNext = () => {
    const errs = validateStep(step);
    if (errs.length > 0) {
      setStepErrors(errs);
      setTouchedRequired(true);
      return;
    }
    setStepErrors([]);
    setTouchedRequired(false);
    setStep(s => s + 1);
  };

  const hasFieldError = (f: string) => touchedRequired && stepErrors.includes(f);

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
      n1_manager: form.n1_manager,
      n2_manager: form.n2_manager,
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
        <div className="px-8 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.id;
              const cur = step === s.id;
              const hasErr = cur && touchedRequired && stepErrors.length > 0;
              return (
                <div key={s.id} className="flex items-center flex-1 min-w-0 relative group">
                  <button
                    type="button"
                    onClick={() => { setStepErrors([]); setTouchedRequired(false); setStep(s.id); }}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all text-center ${
                      cur ? "opacity-100" : done ? "opacity-100 cursor-pointer" : "opacity-60 cursor-pointer hover:opacity-90"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                      hasErr  ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-200" :
                      cur     ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" :
                      done    ? "bg-green-500 border-green-500 text-white" :
                                "bg-white border-gray-300 text-gray-500 group-hover:border-blue-400"
                    }`}>
                      {hasErr ? <AlertCircle className="h-4 w-4" /> :
                       done   ? <Check className="h-4 w-4" /> :
                                <span className="text-xs font-bold">{s.id}</span>}
                    </div>
                    <span className={`text-xs font-medium ${
                      hasErr  ? "text-red-600" :
                      cur     ? "text-blue-600" :
                      done    ? "text-green-600" :
                                "text-gray-500 group-hover:text-blue-500"
                    }`}>
                      {s.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`absolute top-1/4 right-0 h-0.5 w-1/3 rounded-full transition-colors ${
                      step > s.id ? "bg-green-500" : "bg-gray-200 group-hover:bg-blue-200"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Erreurs de l'étape courante */}
          {touchedRequired && stepErrors.length > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Veuillez renseigner les champs obligatoires avant de continuer.</span>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2 text-center">
            Étape <span className="font-semibold text-blue-600">{step}</span>/{STEPS.length}
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="text-gray-500">{STEPS[step - 1].desc}</span>
          </p>
        </div>

        {/* ── Corps du formulaire ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-gray-50">
          {/* ─── Étape 1 : Identité ─── */}
          {step === 1 && (
            <div className="space-y-6">
              <SectionHeader icon={User} title="État civil" subtitle="Identification de l'employé" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <F label="Matricule" req error={hasFieldError("matricule")}>
                  <Input name="matricule" value={form.matricule} onChange={ch} placeholder="EX-0001"
                    className={`text-sm p-3 shadow-sm focus:ring-2 focus:border-transparent ${
                      hasFieldError("matricule")
                        ? "border-red-400 focus:ring-red-400 bg-red-50"
                        : "border-gray-300 focus:ring-blue-500"
                    }`} />
                </F>
                <F label="Sexe">
                  <Sel name="sexe" value={form.sexe} onChange={ch}
                    opts={[{v:"H",l:"Homme"},{v:"F",l:"Femme"}]} />
                </F>
                <F label="Nom" req error={hasFieldError("nom")}>
                  <Input name="nom" value={form.nom} onChange={ch} placeholder="DIOP"
                    className={`text-sm p-3 shadow-sm focus:ring-2 focus:border-transparent ${
                      hasFieldError("nom")
                        ? "border-red-400 focus:ring-red-400 bg-red-50"
                        : "border-gray-300 focus:ring-blue-500"
                    }`} />
                </F>
                <F label="Prénom" req error={hasFieldError("prenom")}>
                  <Input name="prenom" value={form.prenom} onChange={ch} placeholder="Mamadou"
                    className={`text-sm p-3 shadow-sm focus:ring-2 focus:border-transparent ${
                      hasFieldError("prenom")
                        ? "border-red-400 focus:ring-red-400 bg-red-50"
                        : "border-gray-300 focus:ring-blue-500"
                    }`} />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="space-y-6">
              <SectionHeader icon={Briefcase} title="Poste & contrat" subtitle="Rôle et conditions d'emploi" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <F label="Type de contrat" req error={hasFieldError("type_contrat")}>
                  <Sel name="type_contrat" value={form.type_contrat} onChange={ch} ph="— Sélectionner —"
                    opts={[{v:"CDI",l:"CDI"},{v:"CDD",l:"CDD"},{v:"STAGE",l:"Stage"},{v:"INTERIM",l:"Intérim"}]} />
                  {hasFieldError("type_contrat") && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />Le type de contrat est requis
                    </p>
                  )}
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
                {/* Date de fin : uniquement pour CDD et Stage (pas CDI, pas INTERIM) */}
                {(form.type_contrat === "CDD" || form.type_contrat === "STAGE") && (
                  <F label={`Date de fin ${form.type_contrat === "STAGE" ? "Stage" : "CDD"}`}>
                    <Input type="date" name="date_fin_cdd" value={form.date_fin_cdd} onChange={ch}
                      className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                  </F>
                )}
                {/* Période d'essai : CDI et CDD uniquement */}
                {(form.type_contrat === "CDI" || form.type_contrat === "CDD") && (
                  <F label="Date fin période d'essai">
                    <Input type="date" name="date_fin_periode_essai" value={form.date_fin_periode_essai} onChange={ch}
                      className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                  </F>
                )}
              </div>

              <SectionHeader icon={Building2} title="Organisation" subtitle="Rattachement dans l'entreprise" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <F label="Business Line">
                  <Input name="business_line" value={form.business_line} onChange={ch}
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
                <F label="Projet">
                  {/* Dropdown depuis les départements + saisie libre */}
                  {deptOptions.length > 0 ? (
                    <Sel name="projet" value={form.projet} onChange={ch}
                      ph="— Sélectionner ou saisir —" opts={deptOptions} />
                  ) : (
                    <Input name="projet" value={form.projet} onChange={ch}
                      placeholder="Nom du projet"
                      className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                  )}
                </F>
                <F label="Service / Département">
                  {deptOptions.length > 0 ? (
                    <Sel name="service" value={form.service} onChange={ch}
                      ph="— Sélectionner un département —" opts={deptOptions} />
                  ) : (
                    <Input name="service" value={form.service} onChange={ch}
                      className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                  )}
                </F>
                <F label="Localisation">
                  <Input name="localisation" value={form.localisation} onChange={ch} placeholder="Dakar, Abidjan…"
                    className="text-sm p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                </F>
              </div>

              <SectionHeader icon={UserCheck} title="Hiérarchie"
                subtitle={detectingManagers ? "Détection des managers en cours…" : "Managers N+1 et N+2 — détectés automatiquement depuis le département sélectionné"} />

              {detectingManagers && (
                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2">
                  <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  Récupération de la hiérarchie depuis la configuration…
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Manager N+1 (dropdown avec recherche) */}
                <F label="Manager N+1 (supérieur direct)">
                  <div className="relative">
                    {form.n1_manager ? (
                      <div className="flex flex-col gap-1 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-green-600 shrink-0" />
                          <span className="flex-1 text-gray-800 font-medium truncate">{n1Name}</span>
                          <button type="button" onClick={clearN1}
                            className="text-gray-400 hover:text-red-500 transition shrink-0"
                            title="Retirer le manager N+1">×</button>
                        </div>
                        {form.manager_email && (
                          <span className="text-xs text-gray-500 ml-6 truncate flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-400 shrink-0" />{form.manager_email}
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            value={mgrSearch}
                            onChange={e => { setMgrSearch(e.target.value); setShowN1Dropdown(true); }}
                            onFocus={() => setShowN1Dropdown(true)}
                            onBlur={closeDropdowns}
                            placeholder="Rechercher un employé…"
                            className="text-sm pl-9 p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                        </div>
                        {showN1Dropdown && (mgrSearch || filteredN1.length > 0) && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredN1.length === 0 ? (
                              <p className="text-xs text-gray-400 px-4 py-3">Aucun résultat</p>
                            ) : filteredN1.map(e => (
                              <button key={e.id} type="button"
                                onClick={() => selectN1(e)}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm flex items-center gap-3 transition">
                                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                                  {(e.prenom?.[0] || "")}{(e.nom?.[0] || "")}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-gray-800">{e.nom} {e.prenom}</span>
                                  <span className="text-gray-400 text-xs ml-2">{e.matricule}</span>
                                  {e.fonction && <span className="text-gray-400 text-xs ml-1">· {e.fonction}</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </F>

                {/* Manager N+2 (dropdown avec recherche) */}
                <F label="Manager N+2 (supérieur N+2)">
                  <div className="relative">
                    {form.n2_manager ? (
                      <div className="flex flex-col gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="flex-1 text-gray-800 font-medium truncate">{n2Name}</span>
                          <button type="button" onClick={clearN2}
                            className="text-gray-400 hover:text-red-500 transition shrink-0"
                            title="Retirer le manager N+2">×</button>
                        </div>
                        {(n2ManagerInfo?.email || allEmployees.find(e => e.id === form.n2_manager)?.email) && (
                          <span className="text-xs text-gray-500 ml-6 truncate flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-400 shrink-0" />
                            {n2ManagerInfo?.email || allEmployees.find(e => e.id === form.n2_manager)?.email}
                          </span>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            value={n2Search}
                            onChange={e => { setN2Search(e.target.value); setShowN2Dropdown(true); }}
                            onFocus={() => setShowN2Dropdown(true)}
                            onBlur={closeDropdowns}
                            placeholder="Rechercher un employé…"
                            className="text-sm pl-9 p-3 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm" />
                        </div>
                        {showN2Dropdown && (n2Search || filteredN2.length > 0) && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredN2.length === 0 ? (
                              <p className="text-xs text-gray-400 px-4 py-3">Aucun résultat</p>
                            ) : filteredN2.map(e => (
                              <button key={e.id} type="button"
                                onClick={() => selectN2(e)}
                                className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-sm flex items-center gap-3 transition">
                                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold shrink-0">
                                  {(e.prenom?.[0] || "")}{(e.nom?.[0] || "")}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-gray-800">{e.nom} {e.prenom}</span>
                                  <span className="text-gray-400 text-xs ml-2">{e.matricule}</span>
                                  {e.fonction && <span className="text-gray-400 text-xs ml-1">· {e.fonction}</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </F>
              </div>
              {/* Info de sync automatique */}
              <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 flex items-start gap-2">
                <Building2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  La hiérarchie est le <strong>point d'entrée unique</strong> : tout changement de manager ici se répercute automatiquement
                  sur le profil utilisateur (rôle Manager), les validations de congés et l'organigramme.
                </span>
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
        <div className="px-8 py-4 border-t border-gray-200 bg-white flex items-center justify-between gap-3">
          <Button
            type="button" variant="outline"
            onClick={() => { setStepErrors([]); setTouchedRequired(false); step > 1 ? setStep(s => s - 1) : onClose(); }}
            className="flex items-center gap-2 text-gray-700 hover:bg-gray-100 border-gray-300"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Annuler" : "Précédent"}
          </Button>

          <div className="flex items-center gap-1.5">
            {STEPS.map(s => (
              <div key={s.id} className={`h-1.5 rounded-full transition-all ${
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
            <Button type="button" onClick={goNext}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}