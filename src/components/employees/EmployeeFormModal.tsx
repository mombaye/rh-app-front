import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createEmployee, updateEmployee, getEmployees } from "@/services/employeeService";
import { departmentService, employeeHierarchyService, DepartmentManagerMini } from "@/services/hierarchyService";
import {
  ContractType, Diplome, Employee, Enfant,
  SexeType, SituationMatrimoniale, TypePiece,
} from "@/types/employee";
import { Department } from "@/types/leave";
import {
  User, Users, Briefcase, Building2,
  ChevronRight, Check, X,
  Mail, UserCheck, Search, AlertCircle,
  CreditCard, GraduationCap, Plus, Trash2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type FormData = {
  // Identité
  matricule: string; nom: string; prenom: string; nom_jeune_fille: string;
  sexe: SexeType; date_naissance: string; lieu_naissance: string;
  nationalite: string; adresse: string; email: string; telephone: string;
  numero_securite_sociale: string;
  // Pièce d'identité principale
  type_piece: TypePiece | ""; numero_piece: string;
  date_delivrance: string; delivre_par: string; date_expiration: string;
  // Passeport
  has_passeport: boolean; passeport_numero: string;
  passeport_date_delivrance: string; passeport_delivre_par: string; passeport_date_expiration: string;
  // Permis
  has_permis: boolean; permis_numero: string;
  permis_date_delivrance: string; permis_delivre_par: string; permis_date_expiration: string;
  // Travailleur handicapé
  est_travailleur_handicape: boolean;
  handicap_date_delivrance: string; handicap_categorie: string;
  // Professionnel
  type_contrat: ContractType | ""; fonction: string; categorie: string;
  date_embauche: string; date_fin_cdd: string;
  date_fin_periode_essai: string; date_fin_periode_essai_2: string;
  // Organisation
  business_line: string; projet: string; service: string; localisation: string;
  manager: string; manager_email: string; n1_manager: number | null; n2_manager: number | null;
  // Contacts d'urgence
  contact_urgence_nom: string; contact_urgence_telephone: string;
  contact_urgence2_nom: string; contact_urgence2_telephone: string;
  // Parents
  prenom_pere: string; telephone_pere: string;
  nom_prenom_mere: string; telephone_mere: string;
  // Famille
  situation_matrimoniale: SituationMatrimoniale | "";
  nom_conjoint: string; partenaire_prenom: string;
  partenaire_date_naissance: string; partenaire_lieu_naissance: string;
  nombre_enfants: number; enfants: Enfant[];
  // Banque
  banque: string; adresse_banque: string;
  nom_beneficiaire: string; adresse_beneficiaire: string;
  iban: string; bic_swift: string;
  code_banque: string; code_guichet: string;
  numero_compte: string; cle_rib: string;
  // Diplômes
  diplomes: Diplome[];
};

const EMPTY: FormData = {
  matricule: "", nom: "", prenom: "", nom_jeune_fille: "",
  sexe: "H", date_naissance: "", lieu_naissance: "",
  nationalite: "", adresse: "", email: "", telephone: "",
  numero_securite_sociale: "",
  type_piece: "", numero_piece: "", date_delivrance: "", delivre_par: "", date_expiration: "",
  has_passeport: false, passeport_numero: "",
  passeport_date_delivrance: "", passeport_delivre_par: "", passeport_date_expiration: "",
  has_permis: false, permis_numero: "",
  permis_date_delivrance: "", permis_delivre_par: "", permis_date_expiration: "",
  est_travailleur_handicape: false, handicap_date_delivrance: "", handicap_categorie: "",
  type_contrat: "", fonction: "", categorie: "",
  date_embauche: "", date_fin_cdd: "",
  date_fin_periode_essai: "", date_fin_periode_essai_2: "",
  business_line: "", projet: "", service: "", localisation: "",
  manager: "", manager_email: "", n1_manager: null, n2_manager: null,
  contact_urgence_nom: "", contact_urgence_telephone: "",
  contact_urgence2_nom: "", contact_urgence2_telephone: "",
  prenom_pere: "", telephone_pere: "", nom_prenom_mere: "", telephone_mere: "",
  situation_matrimoniale: "",
  nom_conjoint: "", partenaire_prenom: "",
  partenaire_date_naissance: "", partenaire_lieu_naissance: "",
  nombre_enfants: 0, enfants: [],
  banque: "", adresse_banque: "", nom_beneficiaire: "", adresse_beneficiaire: "",
  iban: "", bic_swift: "",
  code_banque: "", code_guichet: "", numero_compte: "", cle_rib: "",
  diplomes: [],
};

const STEPS = [
  { id: 1, label: "Identité",      icon: User,           desc: "Informations personnelles & pièces d'identité" },
  { id: 2, label: "Professionnel", icon: Briefcase,      desc: "Contrat & poste"                               },
  { id: 3, label: "Organisation",  icon: Building2,      desc: "Service, projet & hiérarchie"                  },
  { id: 4, label: "Famille",       icon: Users,          desc: "Situation familiale & contacts"                },
  { id: 5, label: "Banque",        icon: CreditCard,     desc: "Coordonnées bancaires"                         },
  { id: 6, label: "Diplômes",      icon: GraduationCap,  desc: "Formations & diplômes obtenus"                 },
];

const BRAND        = "#003c71";
const BRAND_BG     = "#edf2f7";
const BRAND_BORDER = "#c3d4e6";

// ── Composants utilitaires ────────────────────────────────────────────────────
function F({ label, children, req, col2, error }: {
  label: string; children: React.ReactNode; req?: boolean; col2?: boolean; error?: boolean;
}) {
  return (
    <div className={col2 ? "col-span-2" : ""}>
      <Label className={`text-sm font-medium mb-1.5 block ${error ? "text-red-600" : "text-slate-700"}`}>
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
      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm
        focus:outline-none focus:ring-2 focus:border-transparent text-slate-700 shadow-sm
        transition-colors hover:border-slate-400">
      {ph && <option value="">{ph}</option>}
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-3 pt-2">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

/** Oui / Non — affiche deux boutons, révèle les champs si Oui */
function OuiNon({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="col-span-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(true)}
          className="px-5 py-1.5 rounded-lg text-sm font-semibold border transition-all"
          style={value
            ? { background: BRAND, color: "#fff", borderColor: BRAND }
            : { background: "#fff", color: "#64748b", borderColor: "#cbd5e1" }}>
          Oui
        </button>
        <button type="button" onClick={() => onChange(false)}
          className="px-5 py-1.5 rounded-lg text-sm font-semibold border transition-all"
          style={!value
            ? { background: "#f1f5f9", color: "#374151", borderColor: "#94a3b8" }
            : { background: "#fff", color: "#64748b", borderColor: "#cbd5e1" }}>
          Non
        </button>
      </div>
    </div>
  );
}

const inputCls = (err?: boolean) =>
  `text-sm p-3 shadow-sm border transition-colors focus:outline-none focus:ring-2 focus:border-transparent rounded-md ${
    err ? "border-red-400 focus:ring-red-400/40 bg-red-50 text-red-900"
        : "border-slate-300 hover:border-slate-400"
  }`;

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

  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [mgrSearch, setMgrSearch] = useState("");
  const [n2Search, setN2Search] = useState("");
  const [showN1Dropdown, setShowN1Dropdown] = useState(false);
  const [showN2Dropdown, setShowN2Dropdown] = useState(false);
  const [n2ManagerInfo, setN2ManagerInfo] = useState<DepartmentManagerMini | null>(null);
  const [detectingManagers, setDetectingManagers] = useState(false);
  const [projetFromHierarchy, setProjetFromHierarchy] = useState(false);

  useEffect(() => {
    if (!open) return;
    getEmployees({ status: "ACTIVE" }).then(setAllEmployees).catch(() => {});
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep(1); setMgrSearch(""); setN2Search("");
    setStepErrors([]); setTouchedRequired(false);
    setN2ManagerInfo(null); setDetectingManagers(false); setProjetFromHierarchy(false);
    if (isEdit && initialData) {
      const enfants: Enfant[] = (initialData.enfants ?? []).map(e => ({
        nom:            String((e as Enfant).nom            ?? ""),
        prenom:         String((e as Enfant).prenom         ?? ""),
        sexe:           String((e as Enfant).sexe           ?? "H"),
        date_naissance: String((e as Enfant).date_naissance ?? ""),
        lieu_naissance: String((e as Enfant).lieu_naissance ?? ""),
      }));
      setForm({
        matricule: initialData.matricule ?? "", nom: initialData.nom ?? "",
        prenom: initialData.prenom ?? "", nom_jeune_fille: initialData.nom_jeune_fille ?? "",
        sexe: (initialData.sexe as SexeType) ?? "H",
        date_naissance: initialData.date_naissance ?? "", lieu_naissance: initialData.lieu_naissance ?? "",
        nationalite: initialData.nationalite ?? "", adresse: initialData.adresse ?? "",
        email: initialData.email ?? "", telephone: initialData.telephone ?? "",
        numero_securite_sociale: initialData.numero_securite_sociale ?? "",
        type_piece: (initialData.type_piece as TypePiece) ?? "", numero_piece: initialData.numero_piece ?? "",
        date_delivrance: initialData.date_delivrance ?? "", delivre_par: initialData.delivre_par ?? "",
        date_expiration: initialData.date_expiration ?? "",
        has_passeport: initialData.has_passeport ?? false,
        passeport_numero: initialData.passeport_numero ?? "",
        passeport_date_delivrance: initialData.passeport_date_delivrance ?? "",
        passeport_delivre_par: initialData.passeport_delivre_par ?? "",
        passeport_date_expiration: initialData.passeport_date_expiration ?? "",
        has_permis: initialData.has_permis ?? false,
        permis_numero: initialData.permis_numero ?? "",
        permis_date_delivrance: initialData.permis_date_delivrance ?? "",
        permis_delivre_par: initialData.permis_delivre_par ?? "",
        permis_date_expiration: initialData.permis_date_expiration ?? "",
        est_travailleur_handicape: initialData.est_travailleur_handicape ?? false,
        handicap_date_delivrance: initialData.handicap_date_delivrance ?? "",
        handicap_categorie: initialData.handicap_categorie ?? "",
        type_contrat: initialData.type_contrat ?? "", fonction: initialData.fonction ?? "",
        categorie: initialData.categorie ?? "", date_embauche: initialData.date_embauche ?? "",
        date_fin_cdd: initialData.date_fin_cdd ?? "",
        date_fin_periode_essai: initialData.date_fin_periode_essai ?? "",
        date_fin_periode_essai_2: initialData.date_fin_periode_essai_2 ?? "",
        business_line: initialData.business_line ?? "", projet: initialData.projet ?? "",
        service: initialData.service ?? "", localisation: initialData.localisation ?? "",
        manager: initialData.manager ?? "", manager_email: initialData.manager_email ?? "",
        n1_manager: initialData.n1_manager ?? null, n2_manager: initialData.n2_manager ?? null,
        contact_urgence_nom: initialData.contact_urgence_nom ?? "",
        contact_urgence_telephone: initialData.contact_urgence_telephone ?? "",
        contact_urgence2_nom: initialData.contact_urgence2_nom ?? "",
        contact_urgence2_telephone: initialData.contact_urgence2_telephone ?? "",
        prenom_pere: initialData.prenom_pere ?? "", telephone_pere: initialData.telephone_pere ?? "",
        nom_prenom_mere: initialData.nom_prenom_mere ?? "", telephone_mere: initialData.telephone_mere ?? "",
        situation_matrimoniale: (initialData.situation_matrimoniale as SituationMatrimoniale) ?? "",
        nom_conjoint: initialData.nom_conjoint ?? "", partenaire_prenom: initialData.partenaire_prenom ?? "",
        partenaire_date_naissance: initialData.partenaire_date_naissance ?? "",
        partenaire_lieu_naissance: initialData.partenaire_lieu_naissance ?? "",
        nombre_enfants: initialData.nombre_enfants ?? 0, enfants,
        banque: initialData.banque ?? "",
        adresse_banque: initialData.adresse_banque ?? "",
        nom_beneficiaire: initialData.nom_beneficiaire ?? "",
        adresse_beneficiaire: initialData.adresse_beneficiaire ?? "",
        iban: initialData.iban ?? "",
        bic_swift: initialData.bic_swift ?? "",
        code_banque: initialData.code_banque ?? "",
        code_guichet: initialData.code_guichet ?? "",
        numero_compte: initialData.numero_compte ?? "",
        cle_rib: initialData.cle_rib ?? "",
        diplomes: (initialData.diplomes ?? []).map(d => ({
          intitule: String((d as Diplome).intitule ?? ""),
          annee: String((d as Diplome).annee ?? ""),
          etablissement: String((d as Diplome).etablissement ?? ""),
        })),
      });
    } else {
      setForm({ ...EMPTY, type_contrat: defaultContractType ?? "" });
    }
  }, [open, initialData, isEdit, defaultContractType]);

  const autoDetectManagers = useCallback(async (deptName: string, fieldUpdated: "service" | "projet") => {
    if (!deptName) return;
    const allDepts = [...departments, ...departments.flatMap(d => d.children || [])];
    const selectedDept = allDepts.find(d => d.name === deptName);
    if (selectedDept) {
      const n1Emp = allEmployees.find(e => e.id === selectedDept.head);
      const parentDept = departments.find(d => d.children?.some(c => c.name === deptName));
      const n2Emp = parentDept ? allEmployees.find(e => e.id === parentDept.head) : null;
      if (n2Emp) setN2ManagerInfo({ id: n2Emp.id, full_name: `${n2Emp.nom} ${n2Emp.prenom}`, email: n2Emp.email || "", fonction: n2Emp.fonction || "", matricule: n2Emp.matricule || "" });
      const willFillProjet = fieldUpdated === "service" && !!parentDept;
      if (willFillProjet) setProjetFromHierarchy(true);
      setForm(p => ({
        ...p, [fieldUpdated]: deptName,
        ...(willFillProjet && !p.projet ? { projet: parentDept!.name } : {}),
        n1_manager: selectedDept.head ?? p.n1_manager,
        manager: n1Emp ? `${n1Emp.nom} ${n1Emp.prenom}` : p.manager,
        manager_email: n1Emp?.email || p.manager_email,
        n2_manager: n2Emp?.id ?? (parentDept?.head ?? p.n2_manager),
      }));
      return;
    }
    setDetectingManagers(true);
    try {
      const { n1_manager, n2_manager } = await employeeHierarchyService.getManagersByDepartment(deptName);
      if (n2_manager) setN2ManagerInfo(n2_manager);
      const allDepts2 = [...departments, ...departments.flatMap(d => d.children || [])];
      const selectedDept2 = allDepts2.find(d => d.name === deptName);
      const parentDept2 = selectedDept2 ? departments.find(d => d.children?.some(c => c.name === deptName)) : null;
      const willFillProjet2 = fieldUpdated === "service" && !!parentDept2;
      if (willFillProjet2) setProjetFromHierarchy(true);
      setForm(p => ({
        ...p, [fieldUpdated]: deptName,
        ...(willFillProjet2 && !p.projet ? { projet: parentDept2!.name } : {}),
        n1_manager: n1_manager?.id ?? p.n1_manager,
        manager: n1_manager?.full_name ?? p.manager,
        manager_email: n1_manager?.email ?? p.manager_email,
        n2_manager: n2_manager?.id ?? p.n2_manager,
      }));
    } catch {
      setForm(p => ({ ...p, [fieldUpdated]: deptName }));
    } finally { setDetectingManagers(false); }
  }, [departments, allEmployees]);

  const ch = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if ((name === "service" || name === "projet") && value) {
      autoDetectManagers(value, name as "service" | "projet");
      if (name === "projet") setProjetFromHierarchy(false);
      return;
    }
    // Effacer les champs conjoint/partenaire si on quitte marie/concubinage
    if (name === "situation_matrimoniale") {
      const isPartner = value === "marie" || value === "concubinage";
      const hasEnfants = value !== "" && value !== "celibataire";
      setForm(p => ({
        ...p,
        situation_matrimoniale: value as SituationMatrimoniale,
        ...(!isPartner ? { nom_conjoint: "", partenaire_prenom: "", partenaire_date_naissance: "", partenaire_lieu_naissance: "" } : {}),
        ...(!hasEnfants ? { nombre_enfants: 0, enfants: [] } : {}),
      }));
      return;
    }
    setForm(p => ({ ...p, [name]: value }));
  };

  useEffect(() => {
    if (!open || !isEdit || !initialData || initialData.n1_manager) return;
    const deptName = initialData.service || initialData.projet;
    if (deptName && departments.length > 0) autoDetectManagers(deptName, initialData.service ? "service" : "projet");
  }, [open, isEdit, initialData, departments, autoDetectManagers]);

  const setNbEnfants = (n: number) => {
    const nb = Math.max(0, Math.min(7, n));
    setForm(p => {
      const arr = [...(p.enfants ?? [])];
      while (arr.length < nb) arr.push({ nom: "", prenom: "", sexe: "H", date_naissance: "", lieu_naissance: "" });
      return { ...p, nombre_enfants: nb, enfants: arr.slice(0, nb) };
    });
  };

  const chEnfant = (i: number, f: keyof Enfant, v: string) =>
    setForm(p => { const a = [...(p.enfants ?? [])]; a[i] = { ...a[i], [f]: v }; return { ...p, enfants: a }; });

  const nullDate = (v: string) => v || null;
  const closeDropdowns = () => setTimeout(() => { setShowN1Dropdown(false); setShowN2Dropdown(false); }, 200);

  const selectN1 = (emp: Employee) => {
    setForm(p => ({ ...p, n1_manager: emp.id, manager: `${emp.nom} ${emp.prenom}`, manager_email: emp.email || "" }));
    setMgrSearch(""); setShowN1Dropdown(false);
  };
  const clearN1 = () => { setForm(p => ({ ...p, n1_manager: null, manager: "", manager_email: "" })); setMgrSearch(""); };
  const selectN2 = (emp: Employee) => { setForm(p => ({ ...p, n2_manager: emp.id })); setN2Search(""); setShowN2Dropdown(false); };
  const clearN2 = () => { setForm(p => ({ ...p, n2_manager: null })); setN2Search(""); setN2ManagerInfo(null); };

  const filteredN1 = allEmployees.filter(e => {
    if (initialData && e.id === initialData.id) return false;
    if (!mgrSearch) return true;
    const s = mgrSearch.toLowerCase();
    return `${e.nom} ${e.prenom}`.toLowerCase().includes(s) || (e.matricule || "").toLowerCase().includes(s) || (e.fonction || "").toLowerCase().includes(s);
  }).slice(0, 10);

  const filteredN2 = allEmployees.filter(e => {
    if (initialData && e.id === initialData.id) return false;
    if (form.n1_manager && e.id === form.n1_manager) return false;
    if (!n2Search) return true;
    const s = n2Search.toLowerCase();
    return `${e.nom} ${e.prenom}`.toLowerCase().includes(s) || (e.matricule || "").toLowerCase().includes(s) || (e.fonction || "").toLowerCase().includes(s);
  }).slice(0, 10);

  const n1Name = form.n1_manager
    ? (() => { const e = allEmployees.find(e2 => e2.id === form.n1_manager); return e ? `${e.nom} ${e.prenom}` : form.manager || `ID: ${form.n1_manager}`; })()
    : "";
  const n2Name = form.n2_manager
    ? (() => { const e = allEmployees.find(e2 => e2.id === form.n2_manager); return e ? `${e.nom} ${e.prenom}` : `ID: ${form.n2_manager}`; })()
    : "";

  const deptOptions = departments.flatMap(d => {
    const opts = [{ v: d.name, l: d.name }];
    (d.children || []).forEach(c => opts.push({ v: c.name, l: `  └ ${c.name}` }));
    return opts;
  });

  const validateStep = (s: number): string[] => {
    const errs: string[] = [];
    if (s === 1) {
      if (!form.matricule.trim()) errs.push("matricule");
      if (!form.nom.trim()) errs.push("nom");
      if (!form.prenom.trim()) errs.push("prenom");
      if (!form.type_piece) errs.push("type_piece");
    }
    if (s === 2) { if (!form.type_contrat) errs.push("type_contrat"); }
    return errs;
  };

  const goNext = () => {
    const errs = validateStep(step);
    if (errs.length > 0) { setStepErrors(errs); setTouchedRequired(true); return; }
    setStepErrors([]); setTouchedRequired(false); setStep(s => s + 1);
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
      date_fin_periode_essai_2: nullDate(form.date_fin_periode_essai_2),
      passeport_date_delivrance: nullDate(form.passeport_date_delivrance),
      passeport_date_expiration: nullDate(form.passeport_date_expiration),
      permis_date_delivrance: nullDate(form.permis_date_delivrance),
      permis_date_expiration: nullDate(form.permis_date_expiration),
      handicap_date_delivrance: nullDate(form.handicap_date_delivrance),
      partenaire_date_naissance: nullDate(form.partenaire_date_naissance),
      n1_manager: form.n1_manager, n2_manager: form.n2_manager,
    };
    try {
      if (isEdit && initialData) {
        await updateEmployee(initialData.id, payload);
        const planningSync = form.nom !== (initialData.nom ?? "") || form.prenom !== (initialData.prenom ?? "") || form.matricule !== (initialData.matricule ?? "");
        toast.success(planningSync ? "Employé mis à jour — planning synchronisé." : "Employé mis à jour !", { duration: planningSync ? 4000 : 2000 });
      } else {
        await createEmployee(payload);
        toast.success("Employé ajouté !");
      }
      onSuccess(); onClose();
    } catch (err: any) {
      const detail = err?.response?.data;
      const msg = typeof detail === "string"
        ? detail
        : detail ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
        : "Erreur lors de l'enregistrement";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  const isLast = step === STEPS.length;
  const StepIcon = STEPS[step - 1].icon;

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-3xl max-h-[94vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-1.5 w-full shrink-0" style={{ background: BRAND }} />

            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: BRAND_BG }}>
                  <StepIcon size={17} style={{ color: BRAND }} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isEdit ? "Modifier l'employé" : "Ajouter un employé"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    {STEPS[step - 1].desc}
                    {touchedRequired && stepErrors.length > 0 && (
                      <span className="text-red-500 font-medium flex items-center gap-1">
                        <AlertCircle size={11} />Champs requis manquants
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition p-1.5 rounded-lg">
                <X size={17} />
              </button>
            </div>

            {/* Stepper */}
            <div className="px-6 pt-3.5 pb-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-1">
                {STEPS.map((s, i) => {
                  const done = step > s.id; const cur = step === s.id;
                  const hasErr = cur && touchedRequired && stepErrors.length > 0;
                  return (
                    <div key={s.id} className="flex items-center flex-1 min-w-0">
                      <button type="button"
                        onClick={() => { setStepErrors([]); setTouchedRequired(false); setStep(s.id); }}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all w-full justify-center ${
                          hasErr ? "bg-red-50 text-red-600 border border-red-200" :
                          cur    ? "border" :
                          done   ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-50"
                        }`}
                        style={cur && !hasErr ? { background: BRAND_BG, color: BRAND, borderColor: BRAND_BORDER } : {}}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          hasErr ? "bg-red-500 text-white" : done ? "bg-emerald-500 text-white" : cur ? "text-white" : "bg-slate-200 text-slate-500"
                        }`} style={cur && !hasErr ? { background: BRAND } : {}}>
                          {hasErr ? "!" : done ? <Check className="h-2.5 w-2.5" /> : s.id}
                        </span>
                        <span className="truncate hidden sm:block">{s.label}</span>
                      </button>
                      {i < STEPS.length - 1 && (
                        <div className={`h-px w-3 shrink-0 mx-0.5 rounded-full ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(step / STEPS.length) * 100}%`, background: BRAND }} />
              </div>
            </div>

            {/* Corps */}
            <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">

              {/* ── Étape 1 : Identité + Documents ── */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-5">
                  {/* ── Identité de base ── */}
                  <F label="Matricule" req error={hasFieldError("matricule")}>
                    <Input name="matricule" value={form.matricule} onChange={ch} placeholder="Entrez votre matricule" className={inputCls(hasFieldError("matricule"))} />
                  </F>
                  <F label="Sexe">
                    <Sel name="sexe" value={form.sexe} onChange={ch} opts={[{v:"H",l:"Homme"},{v:"F",l:"Femme"}]} />
                  </F>
                  <F label="Nom" req error={hasFieldError("nom")}>
                    <Input name="nom" value={form.nom} onChange={ch} placeholder="Entrez votre nom" className={inputCls(hasFieldError("nom"))} />
                  </F>
                  <F label="Prénom" req error={hasFieldError("prenom")}>
                    <Input name="prenom" value={form.prenom} onChange={ch} placeholder="Entrez votre prénom" className={inputCls(hasFieldError("prenom"))} />
                  </F>
                  <F label="Date de naissance">
                    <Input type="date" name="date_naissance" value={form.date_naissance} onChange={ch} className={inputCls()} />
                  </F>
                  <F label="Lieu de naissance">
                    <Input name="lieu_naissance" value={form.lieu_naissance} onChange={ch} placeholder="Entrez votre lieu de naissance" className={inputCls()} />
                  </F>
                  <F label="Nationalité">
                    <Input name="nationalite" value={form.nationalite} onChange={ch} placeholder="Entrez votre nationalité" className={inputCls()} />
                  </F>
                  <F label="Adresse">
                    <Input name="adresse" value={form.adresse} onChange={ch} placeholder="Entrez votre adresse" className={inputCls()} />
                  </F>
                  <F label="Email">
                    <Input type="email" name="email" value={form.email} onChange={ch} placeholder="Entrez votre adresse email" className={inputCls()} />
                  </F>
                  <F label="Téléphone">
                    <Input name="telephone" value={form.telephone} onChange={ch} placeholder="Entrez le numéro de téléphone" className={inputCls()} />
                  </F>

                  {/* ── Pièce d'identité principale ── */}
                  <Divider label="Pièce d'identité" />
                  <F label="Type de pièce" req error={hasFieldError("type_piece")} col2>
                    <Sel name="type_piece" value={form.type_piece} onChange={ch} ph="— Sélectionner le type de pièce —"
                      opts={[
                        {v:"CNI",      l:"Carte Nationale d'Identité"},
                        {v:"PASSEPORT",l:"Passeport"},
                        {v:"SEJOUR",   l:"Titre de séjour"},
                        {v:"AUTRE",    l:"Autre"},
                      ]} />
                    {hasFieldError("type_piece") && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Le type de pièce est requis</p>
                    )}
                  </F>
                  {form.type_piece && (
                    <>
                      <F label="Numéro de pièce">
                        <Input name="numero_piece" value={form.numero_piece} onChange={ch} placeholder="Entrez le numéro de votre pièce" className={inputCls()} />
                      </F>
                      <F label="Date de délivrance">
                        <Input type="date" name="date_delivrance" value={form.date_delivrance} onChange={ch} className={inputCls()} />
                      </F>
                      <F label="Délivrée par">
                        <Input name="delivre_par" value={form.delivre_par} onChange={ch} placeholder="Entrez l'organisme émetteur" className={inputCls()} />
                      </F>
                      <F label="Date d'expiration">
                        <Input type="date" name="date_expiration" value={form.date_expiration} onChange={ch} className={inputCls()} />
                      </F>
                    </>
                  )}

                  {/* ── Informations complémentaires ── */}
                  <Divider label="Informations complémentaires" />
                  <F label="Nom de jeune fille">
                    <Input name="nom_jeune_fille" value={form.nom_jeune_fille} onChange={ch} placeholder="Entrez votre nom de jeune fille" className={inputCls()} />
                  </F>
                  <F label="N° de Sécurité Sociale">
                    <Input name="numero_securite_sociale" value={form.numero_securite_sociale} onChange={ch} placeholder="Entrez votre numéro de sécurité sociale" className={inputCls()} />
                  </F>

                  {/* Passeport */}
                  <OuiNon
                    label="Possède un passeport ?"
                    value={form.has_passeport}
                    onChange={v => setForm(p => ({
                      ...p, has_passeport: v,
                      ...(!v ? { passeport_numero: "", passeport_date_delivrance: "", passeport_delivre_par: "", passeport_date_expiration: "" } : {}),
                    }))}
                  />
                  {form.has_passeport && (
                    <>
                      <F label="Numéro de passeport">
                        <Input name="passeport_numero" value={form.passeport_numero} onChange={ch} className={inputCls()} />
                      </F>
                      <F label="Délivré par">
                        <Input name="passeport_delivre_par" value={form.passeport_delivre_par} onChange={ch} className={inputCls()} />
                      </F>
                      <F label="Date de délivrance">
                        <Input type="date" name="passeport_date_delivrance" value={form.passeport_date_delivrance} onChange={ch} className={inputCls()} />
                      </F>
                      <F label="Valable jusqu'au">
                        <Input type="date" name="passeport_date_expiration" value={form.passeport_date_expiration} onChange={ch} className={inputCls()} />
                      </F>
                    </>
                  )}

                  {/* Permis de conduire */}
                  <OuiNon
                    label="Possède un permis de conduire ?"
                    value={form.has_permis}
                    onChange={v => setForm(p => ({
                      ...p, has_permis: v,
                      ...(!v ? { permis_numero: "", permis_date_delivrance: "", permis_delivre_par: "", permis_date_expiration: "" } : {}),
                    }))}
                  />
                  {form.has_permis && (
                    <>
                      <F label="Numéro de permis">
                        <Input name="permis_numero" value={form.permis_numero} onChange={ch} className={inputCls()} />
                      </F>
                      <F label="Délivré par">
                        <Input name="permis_delivre_par" value={form.permis_delivre_par} onChange={ch} className={inputCls()} />
                      </F>
                      <F label="Date de délivrance">
                        <Input type="date" name="permis_date_delivrance" value={form.permis_date_delivrance} onChange={ch} className={inputCls()} />
                      </F>
                      <F label="Valable jusqu'au">
                        <Input type="date" name="permis_date_expiration" value={form.permis_date_expiration} onChange={ch} className={inputCls()} />
                      </F>
                    </>
                  )}

                  {/* Travailleur handicapé */}
                  <OuiNon
                    label="Êtes-vous reconnu(e) travailleur handicapé ?"
                    value={form.est_travailleur_handicape}
                    onChange={v => setForm(p => ({
                      ...p, est_travailleur_handicape: v,
                      ...(!v ? { handicap_date_delivrance: "", handicap_categorie: "" } : {}),
                    }))}
                  />
                  {form.est_travailleur_handicape && (
                    <>
                      <F label="Date de reconnaissance">
                        <Input type="date" name="handicap_date_delivrance" value={form.handicap_date_delivrance} onChange={ch} className={inputCls()} />
                      </F>
                      <F label="Catégorie handicap">
                        <Input name="handicap_categorie" value={form.handicap_categorie} onChange={ch} placeholder="Entrez la catégorie du handicap" className={inputCls()} />
                      </F>
                    </>
                  )}
                </div>
              )}

              {/* ── Étape 2 : Professionnel ── */}
              {step === 2 && (
                <div className="grid grid-cols-2 gap-5">
                  <F label="Type de contrat" req error={hasFieldError("type_contrat")}>
                    <Sel name="type_contrat" value={form.type_contrat} onChange={ch} ph="— Sélectionner —"
                      opts={[{v:"CDI",l:"CDI"},{v:"CDD",l:"CDD"},{v:"STAGE",l:"Stage"},{v:"INTERIM",l:"Intérim"}]} />
                    {hasFieldError("type_contrat") && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Le type de contrat est requis</p>
                    )}
                  </F>
                  <F label="Fonction">
                    <Input name="fonction" value={form.fonction} onChange={ch} placeholder="Entrez votre fonction" className={inputCls()} />
                  </F>
                  <F label="Catégorie">
                    <Input name="categorie" value={form.categorie} onChange={ch} placeholder="Entrez votre catégorie" className={inputCls()} />
                  </F>
                  <F label="Date d'embauche">
                    <Input type="date" name="date_embauche" value={form.date_embauche} onChange={ch} className={inputCls()} />
                  </F>
                  {(form.type_contrat === "CDD" || form.type_contrat === "STAGE") && (
                    <F label={`Date de fin ${form.type_contrat === "STAGE" ? "stage" : "CDD"}`}>
                      <Input type="date" name="date_fin_cdd" value={form.date_fin_cdd} onChange={ch} className={inputCls()} />
                    </F>
                  )}
                  {(form.type_contrat === "CDI" || form.type_contrat === "CDD") && (
                    <>
                      <F label="Date fin période d'essai 1">
                        <Input type="date" name="date_fin_periode_essai" value={form.date_fin_periode_essai} onChange={ch} className={inputCls()} />
                      </F>
                      <F label="Date fin période d'essai 2">
                        <Input type="date" name="date_fin_periode_essai_2" value={form.date_fin_periode_essai_2} onChange={ch} className={inputCls()} />
                      </F>
                    </>
                  )}
                </div>
              )}

              {/* ── Étape 3 : Organisation & Hiérarchie ── */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-5">
                    <F label="Service / Département">
                      {deptOptions.length > 0 ? (
                        <>
                          <div className="relative">
                            <Sel name="service" value={form.service} onChange={ch} ph="— Sélectionner —" opts={deptOptions} />
                            {detectingManagers && (
                              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                                <span className="inline-block w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                                  style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
                              </div>
                            )}
                          </div>
                          {form.service && form.n1_manager && !detectingManagers && (
                            <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                              <UserCheck className="h-3 w-3 shrink-0" />N+1 détecté automatiquement
                            </p>
                          )}
                        </>
                      ) : (
                        <Input name="service" value={form.service} onChange={ch} placeholder="Entrez le service" className={inputCls()} />
                      )}
                    </F>
                    <F label={projetFromHierarchy && form.projet ? "Projet (auto)" : "Projet"}>
                      {deptOptions.length > 0 ? (
                        <>
                          <Sel name="projet" value={form.projet} onChange={ch} ph="— Sélectionner —" opts={deptOptions} />
                          {projetFromHierarchy && form.projet && (
                            <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />Auto-rempli depuis le parent
                            </p>
                          )}
                        </>
                      ) : (
                        <Input name="projet" value={form.projet} onChange={ch} placeholder="Entrez le nom du projet" className={inputCls()} />
                      )}
                    </F>
                    <F label="Business Line">
                      <Input name="business_line" value={form.business_line} onChange={ch} className={inputCls()} />
                    </F>
                    <F label="Localisation">
                      <Input name="localisation" value={form.localisation} onChange={ch} placeholder="Entrez la localisation" className={inputCls()} />
                    </F>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Hiérarchie</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  {detectingManagers && (
                    <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 border"
                      style={{ background: BRAND_BG, borderColor: BRAND_BORDER, color: BRAND }}>
                      <span className="inline-block w-3 h-3 border-2 border-t-transparent rounded-full animate-spin shrink-0"
                        style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
                      Récupération de la hiérarchie…
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-5">
                    {/* N+1 */}
                    <F label="Manager N+1 (supérieur direct)">
                      <div className="relative">
                        {form.n1_manager ? (
                          <div className="flex flex-col gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span className="flex-1 text-slate-800 font-medium truncate">{n1Name}</span>
                              <button type="button" onClick={clearN1} className="text-slate-400 hover:text-red-500 transition shrink-0">×</button>
                            </div>
                            {form.manager_email && (
                              <span className="text-xs text-slate-500 ml-6 truncate flex items-center gap-1">
                                <Mail className="h-3 w-3 text-slate-400 shrink-0" />{form.manager_email}
                              </span>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input value={mgrSearch}
                                onChange={e => { setMgrSearch(e.target.value); setShowN1Dropdown(true); }}
                                onFocus={() => setShowN1Dropdown(true)} onBlur={closeDropdowns}
                                placeholder="Rechercher…" className={`${inputCls()} pl-9`} />
                            </div>
                            {showN1Dropdown && (mgrSearch || filteredN1.length > 0) && (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                                {filteredN1.length === 0 ? <p className="text-xs text-slate-400 px-4 py-3">Aucun résultat</p>
                                  : filteredN1.map(e => (
                                    <button key={e.id} type="button" onClick={() => selectN1(e)}
                                      className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition hover:bg-slate-50">
                                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: BRAND_BG, color: BRAND }}>
                                        {(e.prenom?.[0] || "")}{(e.nom?.[0] || "")}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="font-medium text-slate-800">{e.nom} {e.prenom}</span>
                                        <span className="text-slate-400 text-xs ml-2">{e.matricule}</span>
                                        {e.fonction && <span className="text-slate-400 text-xs ml-1">· {e.fonction}</span>}
                                      </div>
                                    </button>
                                  ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </F>
                    {/* N+2 */}
                    <F label="Manager N+2">
                      <div className="relative">
                        {form.n2_manager ? (
                          <div className="flex flex-col gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span className="flex-1 text-slate-800 font-medium truncate">{n2Name}</span>
                              <button type="button" onClick={clearN2} className="text-slate-400 hover:text-red-500 transition shrink-0">×</button>
                            </div>
                            {(n2ManagerInfo?.email || allEmployees.find(e => e.id === form.n2_manager)?.email) && (
                              <span className="text-xs text-slate-500 ml-6 truncate flex items-center gap-1">
                                <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                                {n2ManagerInfo?.email || allEmployees.find(e => e.id === form.n2_manager)?.email}
                              </span>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input value={n2Search}
                                onChange={e => { setN2Search(e.target.value); setShowN2Dropdown(true); }}
                                onFocus={() => setShowN2Dropdown(true)} onBlur={closeDropdowns}
                                placeholder="Rechercher…" className={`${inputCls()} pl-9`} />
                            </div>
                            {showN2Dropdown && (n2Search || filteredN2.length > 0) && (
                              <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                                {filteredN2.length === 0 ? <p className="text-xs text-slate-400 px-4 py-3">Aucun résultat</p>
                                  : filteredN2.map(e => (
                                    <button key={e.id} type="button" onClick={() => selectN2(e)}
                                      className="w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition hover:bg-slate-50">
                                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: BRAND_BG, color: BRAND }}>
                                        {(e.prenom?.[0] || "")}{(e.nom?.[0] || "")}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="font-medium text-slate-800">{e.nom} {e.prenom}</span>
                                        <span className="text-slate-400 text-xs ml-2">{e.matricule}</span>
                                        {e.fonction && <span className="text-slate-400 text-xs ml-1">· {e.fonction}</span>}
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
                </div>
              )}

              {/* ── Étape 4 : Famille & Banque ── */}
              {step === 4 && (() => {
                const showPartner  = form.situation_matrimoniale === "marie" || form.situation_matrimoniale === "concubinage";
                const showEnfants  = form.situation_matrimoniale !== "" && form.situation_matrimoniale !== "celibataire";
                return (
                  <div className="grid grid-cols-2 gap-5">
                    {/* Contacts d'urgence */}
                    <Divider label="Contacts d'urgence" />
                    <F label="Contact n°1 — Nom">
                      <Input name="contact_urgence_nom" value={form.contact_urgence_nom} onChange={ch} placeholder="Entrez le nom du contact" className={inputCls()} />
                    </F>
                    <F label="Contact n°1 — Téléphone">
                      <Input name="contact_urgence_telephone" value={form.contact_urgence_telephone} onChange={ch} placeholder="Entrez le numéro de téléphone" className={inputCls()} />
                    </F>
                    <F label="Contact n°2 — Nom">
                      <Input name="contact_urgence2_nom" value={form.contact_urgence2_nom} onChange={ch} placeholder="Entrez le nom du contact" className={inputCls()} />
                    </F>
                    <F label="Contact n°2 — Téléphone">
                      <Input name="contact_urgence2_telephone" value={form.contact_urgence2_telephone} onChange={ch} placeholder="Entrez le numéro de téléphone" className={inputCls()} />
                    </F>

                    {/* Parents */}
                    <Divider label="Parents" />
                    <F label="Père — Prénom">
                      <Input name="prenom_pere" value={form.prenom_pere} onChange={ch} className={inputCls()} />
                    </F>
                    <F label="Père — Téléphone">
                      <Input name="telephone_pere" value={form.telephone_pere} onChange={ch} placeholder="Entrez le numéro de téléphone" className={inputCls()} />
                    </F>
                    <F label="Mère — Prénom & Nom">
                      <Input name="nom_prenom_mere" value={form.nom_prenom_mere} onChange={ch} className={inputCls()} />
                    </F>
                    <F label="Mère — Téléphone">
                      <Input name="telephone_mere" value={form.telephone_mere} onChange={ch} placeholder="Entrez le numéro de téléphone" className={inputCls()} />
                    </F>

                    {/* Situation familiale */}
                    <Divider label="Situation familiale" />
                    <F label="Situation matrimoniale">
                      <Sel name="situation_matrimoniale" value={form.situation_matrimoniale} onChange={ch} ph="— Sélectionner —"
                        opts={[
                          {v:"celibataire", l:"Célibataire"},
                          {v:"marie",       l:"Marié(e)"},
                          {v:"concubinage", l:"Concubinage"},
                          {v:"divorce",     l:"Divorcé(e)"},
                          {v:"separe",      l:"Séparé(e)"},
                          {v:"veuf",        l:"Veuf / Veuve"},
                        ]} />
                    </F>
                    {/* Partenaire — visible si marié ou concubinage */}
                    {showPartner && (
                      <>
                        <F label="Conjoint(e) — Nom (+ nom jeune fille)">
                          <Input name="nom_conjoint" value={form.nom_conjoint} onChange={ch} placeholder="Entrez le nom du conjoint" className={inputCls()} />
                        </F>
                        <F label="Conjoint(e) — Prénom">
                          <Input name="partenaire_prenom" value={form.partenaire_prenom} onChange={ch} className={inputCls()} />
                        </F>
                        <F label="Conjoint(e) — Date de naissance">
                          <Input type="date" name="partenaire_date_naissance" value={form.partenaire_date_naissance} onChange={ch} className={inputCls()} />
                        </F>
                        <F label="Conjoint(e) — Lieu de naissance">
                          <Input name="partenaire_lieu_naissance" value={form.partenaire_lieu_naissance} onChange={ch} placeholder="Entrez le lieu de naissance" className={inputCls()} />
                        </F>
                      </>
                    )}

                    {/* Nombre d'enfants — masqué si célibataire ou non sélectionné */}
                    {showEnfants && (
                      <F label="Nombre d'enfants (max 7)">
                        <Input type="number" min={0} max={7} name="nombre_enfants"
                          value={form.nombre_enfants} onChange={e => setNbEnfants(parseInt(e.target.value) || 0)} className={inputCls()} />
                      </F>
                    )}

                    {/* Détail des enfants */}
                    {showEnfants && form.nombre_enfants > 0 && (
                      <div className="col-span-2 space-y-2.5">
                        {Array.from({ length: form.nombre_enfants }).map((_, i) => (
                          <div key={i} className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                            <F label={`Enfant ${i + 1} — Nom`}>
                              <Input value={form.enfants[i]?.nom ?? ""} onChange={e => chEnfant(i, "nom", e.target.value)} placeholder="Entrez le nom" className={inputCls()} />
                            </F>
                            <F label="Prénom">
                              <Input value={form.enfants[i]?.prenom ?? ""} onChange={e => chEnfant(i, "prenom", e.target.value)} placeholder="Entrez le prénom" className={inputCls()} />
                            </F>
                            <F label="Sexe">
                              <Sel name={`enfant_sexe_${i}`} value={form.enfants[i]?.sexe ?? "H"}
                                onChange={e => chEnfant(i, "sexe", e.target.value)}
                                opts={[{v:"H",l:"Masculin"},{v:"F",l:"Féminin"}]} />
                            </F>
                            <F label="Date de naissance">
                              <Input type="date" value={form.enfants[i]?.date_naissance ?? ""} onChange={e => chEnfant(i, "date_naissance", e.target.value)} className={inputCls()} />
                            </F>
                            <F label="Lieu de naissance (Ville, Pays)" col2>
                              <Input value={form.enfants[i]?.lieu_naissance ?? ""} onChange={e => chEnfant(i, "lieu_naissance", e.target.value)} placeholder="Entrez le lieu de naissance" className={inputCls()} />
                            </F>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                );
              })()}

              {/* ── Étape 5 : Banque ── */}
              {step === 5 && (
                <div className="grid grid-cols-2 gap-5">
                  <Divider label="Informations bancaires" />
                  <F label="Nom de la banque" col2>
                    <Input name="banque" value={form.banque} onChange={ch} placeholder="Entrez le nom de la banque" className={inputCls()} />
                  </F>
                  <F label="Adresse de la banque" col2>
                    <Input name="adresse_banque" value={form.adresse_banque} onChange={ch} placeholder="Entrez l'adresse de la banque" className={inputCls()} />
                  </F>
                  <F label="Nom du bénéficiaire" col2>
                    <Input name="nom_beneficiaire" value={form.nom_beneficiaire} onChange={ch} placeholder="Entrez le nom du bénéficiaire" className={inputCls()} />
                  </F>
                  <F label="Adresse du bénéficiaire" col2>
                    <Input name="adresse_beneficiaire" value={form.adresse_beneficiaire} onChange={ch} placeholder="Entrez l'adresse du bénéficiaire" className={inputCls()} />
                  </F>

                  <Divider label="IBAN / BIC" />
                  <F label="Code IBAN" col2>
                    <Input name="iban" value={form.iban} onChange={ch} placeholder="Entrez votre code IBAN" className={inputCls()} />
                  </F>
                  <F label="Code BIC / SWIFT">
                    <Input name="bic_swift" value={form.bic_swift} onChange={ch} placeholder="Entrez votre code BIC/SWIFT" className={inputCls()} />
                  </F>

                  <Divider label="RIB (format français)" />
                  <F label="Code banque">
                    <Input name="code_banque" value={form.code_banque} onChange={ch} placeholder="Entrez le code banque" className={inputCls()} />
                  </F>
                  <F label="Code guichet">
                    <Input name="code_guichet" value={form.code_guichet} onChange={ch} placeholder="Entrez le code guichet" className={inputCls()} />
                  </F>
                  <F label="Numéro de compte">
                    <Input name="numero_compte" value={form.numero_compte} onChange={ch} placeholder="Entrez le numéro de compte" className={inputCls()} />
                  </F>
                  <F label="Clé RIB">
                    <Input name="cle_rib" value={form.cle_rib} onChange={ch} placeholder="Entrez la clé RIB" className={inputCls()} />
                  </F>
                </div>
              )}

              {/* ── Étape 6 : Diplômes ── */}
              {step === 6 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Renseignez les diplômes et niveaux d'études obtenus. Joindre obligatoirement une photocopie des diplômes.
                  </div>

                  {/* En-tête colonnes */}
                  {form.diplomes.length > 0 && (
                    <div className="grid grid-cols-[1fr_120px_1fr_36px] gap-3 px-1">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Diplôme / Niveau d'études</span>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Année</span>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Établissement</span>
                      <span />
                    </div>
                  )}

                  {/* Lignes de diplômes */}
                  <div className="space-y-2.5">
                    {form.diplomes.map((d, i) => (
                      <div key={i} className="grid grid-cols-[1fr_120px_1fr_36px] gap-3 items-start p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
                        <Input
                          value={d.intitule}
                          onChange={e => setForm(p => { const a = [...p.diplomes]; a[i] = { ...a[i], intitule: e.target.value }; return { ...p, diplomes: a }; })}
                          placeholder="Entrez le diplôme ou niveau d'études"
                          className={inputCls()}
                        />
                        <Input
                          value={d.annee}
                          onChange={e => setForm(p => { const a = [...p.diplomes]; a[i] = { ...a[i], annee: e.target.value }; return { ...p, diplomes: a }; })}
                          placeholder="Entrez l'année"
                          maxLength={4}
                          className={inputCls()}
                        />
                        <Input
                          value={d.etablissement}
                          onChange={e => setForm(p => { const a = [...p.diplomes]; a[i] = { ...a[i], etablissement: e.target.value }; return { ...p, diplomes: a }; })}
                          placeholder="Entrez le nom de l'établissement"
                          className={inputCls()}
                        />
                        <button
                          type="button"
                          onClick={() => setForm(p => ({ ...p, diplomes: p.diplomes.filter((_, j) => j !== i) }))}
                          className="h-10 w-9 flex items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Bouton Ajouter */}
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, diplomes: [...p.diplomes, { intitule: "", annee: "", etablissement: "" }] }))}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition">
                    <Plus size={15} />
                    Ajouter un diplôme
                  </button>
                </div>
              )}
            </div>

            {/* Pied de page */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-slate-50/60">
              <p className="text-xs text-slate-400">
                Étape <span className="font-semibold text-slate-600">{step}</span> / {STEPS.length}
              </p>
              <div className="flex items-center gap-2.5">
                <button type="button"
                  onClick={() => { setStepErrors([]); setTouchedRequired(false); step > 1 ? setStep(s => s - 1) : onClose(); }}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium transition">
                  {step === 1 ? "Annuler" : "Précédent"}
                </button>
                {isLast ? (
                  <button type="button" onClick={submit} disabled={loading}
                    className="px-5 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50 hover:opacity-90"
                    style={{ background: BRAND }}>
                    {loading
                      ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement…</>
                      : <><Check className="h-4 w-4" />{isEdit ? "Enregistrer" : "Créer l'employé"}</>}
                  </button>
                ) : (
                  <button type="button" onClick={goNext}
                    className="px-5 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-2 transition hover:opacity-90"
                    style={{ background: BRAND }}>
                    Suivant <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
