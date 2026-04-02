// src/components/employees/EmployeeFormModal.tsx
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createEmployee, updateEmployee, getEmployees } from "@/services/employeeService";
import { departmentService, employeeHierarchyService, DepartmentManagerMini } from "@/services/hierarchyService";
import { ContractType, Employee, SexeType } from "@/types/employee";
import { Department } from "@/types/leave";
import { ChevronRight, Check, X, UserCheck, Mail, Loader2 } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type FormData = {
  matricule: string; nom: string; prenom: string; sexe: SexeType;
  email: string; telephone: string;
  type_contrat: ContractType | "";
  fonction: string; date_embauche: string; date_fin_cdd: string;
  service: string; projet: string;
  manager: string; manager_email: string;
  n1_manager: number | null; n2_manager: number | null;
};

const EMPTY: FormData = {
  matricule: "", nom: "", prenom: "", sexe: "H",
  email: "", telephone: "",
  type_contrat: "",
  fonction: "", date_embauche: "", date_fin_cdd: "",
  service: "", projet: "",
  manager: "", manager_email: "",
  n1_manager: null, n2_manager: null,
};

const CONTRACT_TYPES: { value: ContractType; label: string; color: string }[] = [
  { value: "CDI",    label: "CDI",     color: "blue"   },
  { value: "CDD",    label: "CDD",     color: "amber"  },
  { value: "STAGE",  label: "Stage",   color: "purple" },
  { value: "INTERIM",label: "Intérim", color: "orange" },
];

// ── Label champ ──────────────────────────────────────────────────────────────
function Field({ label, req, error, children }: {
  label: string; req?: boolean; error?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className={`text-sm font-medium mb-1.5 block ${error ? "text-red-600" : "text-gray-700"}`}>
        {label}
        {req && <span className="ml-0.5 text-red-400">*</span>}
        {error && <span className="ml-1 text-xs font-normal text-red-500">(requis)</span>}
      </label>
      {children}
    </div>
  );
}

// ── Input stylé ──────────────────────────────────────────────────────────────
function Inp({ name, value, onChange, placeholder, type = "text", error }: {
  name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; error?: boolean;
}) {
  return (
    <Input name={name} value={value} onChange={onChange} type={type} placeholder={placeholder}
      className={`text-sm h-10 focus:ring-2 focus:border-transparent ${
        error ? "border-red-300 bg-red-50 focus:ring-red-400" : "border-gray-200 focus:ring-blue-500"
      }`} />
  );
}

// ── Select stylé ─────────────────────────────────────────────────────────────
function Sel({ name, value, onChange, opts, ph, error }: {
  name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  opts: { v: string; l: string }[]; ph?: string; error?: boolean;
}) {
  return (
    <select name={name} value={value} onChange={onChange}
      className={`w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white text-gray-700 ${
        error ? "border-red-300 bg-red-50 focus:ring-red-400" : "border-gray-200 focus:ring-blue-500"
      }`}>
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
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const [allEmployees, setAllEmployees]     = useState<Employee[]>([]);
  const [departments,   setDepartments]     = useState<Department[]>([]);
  const [detecting,     setDetecting]       = useState(false);
  const [n2Info,        setN2Info]          = useState<DepartmentManagerMini | null>(null);

  // ── Chargement données de référence ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    getEmployees({ status: "ACTIVE" }).then(setAllEmployees).catch(() => {});
    departmentService.getAll().then(setDepartments).catch(() => {});
  }, [open]);

  // ── Init formulaire ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStep(1); setErrors([]); setTouched(false); setN2Info(null); setDetecting(false);
    if (isEdit && initialData) {
      setForm({
        matricule:     initialData.matricule     ?? "",
        nom:           initialData.nom           ?? "",
        prenom:        initialData.prenom        ?? "",
        sexe:          (initialData.sexe as SexeType) ?? "H",
        email:         initialData.email         ?? "",
        telephone:     initialData.telephone     ?? "",
        type_contrat:  initialData.type_contrat  ?? "",
        fonction:      initialData.fonction      ?? "",
        date_embauche: initialData.date_embauche ?? "",
        date_fin_cdd:  initialData.date_fin_cdd  ?? "",
        service:       initialData.service       ?? "",
        projet:        initialData.projet        ?? "",
        manager:       initialData.manager       ?? "",
        manager_email: initialData.manager_email ?? "",
        n1_manager:    initialData.n1_manager    ?? null,
        n2_manager:    initialData.n2_manager    ?? null,
      });
    } else {
      setForm({ ...EMPTY, type_contrat: defaultContractType ?? "" });
    }
  }, [open, initialData, isEdit, defaultContractType]);

  // ── Auto-détection managers depuis hiérarchie ────────────────────────────────
  const autoDetect = useCallback(async (deptName: string) => {
    if (!deptName) return;
    const allDepts = [...departments, ...departments.flatMap(d => d.children || [])];
    const dept = allDepts.find(d => d.name === deptName);
    if (dept) {
      const n1 = allEmployees.find(e => e.id === dept.head);
      const parent = departments.find(d => d.children?.some(c => c.name === deptName));
      const n2 = parent ? allEmployees.find(e => e.id === parent.head) : null;
      if (n2) setN2Info({ id: n2.id, full_name: `${n2.nom} ${n2.prenom}`, email: n2.email || "", fonction: n2.fonction || "", matricule: n2.matricule || "" });
      setForm(p => ({
        ...p, service: deptName,
        ...(parent && !p.projet ? { projet: parent.name } : {}),
        n1_manager:    dept.head    ?? p.n1_manager,
        manager:       n1 ? `${n1.nom} ${n1.prenom}` : p.manager,
        manager_email: n1?.email    || p.manager_email,
        n2_manager:    n2?.id       ?? (parent?.head ?? p.n2_manager),
      }));
      return;
    }
    setDetecting(true);
    try {
      const { n1_manager, n2_manager } = await employeeHierarchyService.getManagersByDepartment(deptName);
      if (n2_manager) setN2Info(n2_manager);
      setForm(p => ({
        ...p, service: deptName,
        n1_manager:    n1_manager?.id         ?? p.n1_manager,
        manager:       n1_manager?.full_name  ?? p.manager,
        manager_email: n1_manager?.email      ?? p.manager_email,
        n2_manager:    n2_manager?.id         ?? p.n2_manager,
      }));
    } catch {
      setForm(p => ({ ...p, service: deptName }));
    } finally {
      setDetecting(false);
    }
  }, [departments, allEmployees]);

  // Auto-sync à l'ouverture en édition
  useEffect(() => {
    if (!open || !isEdit || !initialData || initialData.n1_manager) return;
    const dept = initialData.service || initialData.projet;
    if (dept && departments.length > 0) autoDetect(dept);
  }, [open, isEdit, initialData, departments, autoDetect]);

  // ── Handler champ ────────────────────────────────────────────────────────────
  const ch = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "service" && value) { autoDetect(value); return; }
    setForm(p => ({ ...p, [name]: value }));
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = (s: number) => {
    if (s === 1) {
      const errs: string[] = [];
      if (!form.matricule.trim()) errs.push("matricule");
      if (!form.nom.trim())       errs.push("nom");
      if (!form.prenom.trim())    errs.push("prenom");
      return errs;
    }
    if (s === 2 && !form.type_contrat) return ["type_contrat"];
    return [];
  };

  const goNext = () => {
    const errs = validate(step);
    if (errs.length) { setErrors(errs); setTouched(true); return; }
    setErrors([]); setTouched(false); setStep(2);
  };

  const err = (f: string) => touched && errors.includes(f);

  // ── Départements pour le select ──────────────────────────────────────────────
  const deptOptions = departments.flatMap(d => {
    const opts = [{ v: d.name, l: d.name }];
    (d.children || []).forEach(c => opts.push({ v: c.name, l: `  └ ${c.name}` }));
    return opts;
  });

  // ── Nom affiché N+1 ──────────────────────────────────────────────────────────
  const n1Name = form.n1_manager
    ? (allEmployees.find(e => e.id === form.n1_manager)
        ? (() => { const e = allEmployees.find(e2 => e2.id === form.n1_manager)!; return `${e.nom} ${e.prenom}`; })()
        : form.manager || `#${form.n1_manager}`)
    : "";
  const n2Name = form.n2_manager
    ? (allEmployees.find(e => e.id === form.n2_manager)
        ? (() => { const e = allEmployees.find(e2 => e2.id === form.n2_manager)!; return `${e.nom} ${e.prenom}`; })()
        : n2Info?.full_name || `#${form.n2_manager}`)
    : "";

  // ── Soumission ───────────────────────────────────────────────────────────────
  const submit = async () => {
    const errs = validate(2);
    if (errs.length) { setErrors(errs); setTouched(true); return; }
    setLoading(true);
    try {
      const payload: Partial<Employee> = {
        ...form,
        type_contrat:  (form.type_contrat  || undefined) as ContractType | undefined,
        date_embauche: form.date_embauche  || undefined,
        date_fin_cdd:  form.date_fin_cdd   || null,
        n1_manager:    form.n1_manager,
        n2_manager:    form.n2_manager,
      } as Partial<Employee>;
      if (isEdit && initialData) {
        await updateEmployee(initialData.id, payload);
        toast.success("Employé mis à jour !");
      } else {
        await createEmployee(payload);
        toast.success("Employé ajouté !");
      }
      onSuccess(); onClose();
    } catch (e: any) {
      const d = e?.response?.data;
      toast.error(
        typeof d === "string" ? d
          : d ? Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
          : "Erreur lors de l'enregistrement"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isEdit ? "Modifier l'employé" : "Ajouter un employé"}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {step === 1 ? "Identité & coordonnées" : "Poste & organisation"}
                  {touched && errors.length > 0 && (
                    <span className="ml-2 text-red-500 font-medium">· Champs requis manquants</span>
                  )}
                </p>
              </div>
              <button onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            {/* ── Stepper 2 étapes ── */}
            <div className="px-6 pt-3 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                {[
                  { id: 1, label: "Identité" },
                  { id: 2, label: "Poste" },
                ].map((s, i) => {
                  const done = step > s.id;
                  const cur  = step === s.id;
                  const hasErr = cur && touched && errors.length > 0;
                  return (
                    <div key={s.id} className="flex items-center flex-1">
                      <button type="button"
                        onClick={() => { if (s.id < step || done) { setErrors([]); setTouched(false); setStep(s.id); } }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition w-full justify-center ${
                          hasErr ? "bg-red-50 text-red-600 border border-red-200" :
                          cur    ? "bg-blue-50 text-blue-700 border border-blue-200" :
                          done   ? "text-emerald-600 hover:bg-emerald-50 cursor-pointer" :
                                   "text-gray-400"
                        }`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          hasErr ? "bg-red-500 text-white" :
                          cur    ? "bg-blue-600 text-white" :
                          done   ? "bg-emerald-500 text-white" :
                                   "bg-gray-200 text-gray-500"
                        }`}>
                          {hasErr ? "!" : done ? <Check size={12} /> : s.id}
                        </span>
                        {s.label}
                      </button>
                      {i === 0 && (
                        <div className={`h-px w-8 shrink-0 mx-1 ${done ? "bg-emerald-400" : "bg-gray-200"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Corps ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">

              {/* ─ Étape 1 : Identité ─ */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Matricule + Sexe */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Matricule" req error={err("matricule")}>
                      <Inp name="matricule" value={form.matricule} onChange={ch}
                        placeholder="EX-0001" error={err("matricule")} />
                    </Field>
                    <Field label="Sexe">
                      <div className="flex gap-2 h-10 items-center">
                        {(["H", "F"] as SexeType[]).map(s => (
                          <button key={s} type="button"
                            onClick={() => setForm(p => ({ ...p, sexe: s }))}
                            className={`flex-1 h-10 rounded-lg border text-sm font-medium transition ${
                              form.sexe === s
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-gray-200 text-gray-500 hover:border-gray-300"
                            }`}>
                            {s === "H" ? "Homme" : "Femme"}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>

                  {/* Nom + Prénom */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nom" req error={err("nom")}>
                      <Inp name="nom" value={form.nom} onChange={ch}
                        placeholder="DIOP" error={err("nom")} />
                    </Field>
                    <Field label="Prénom" req error={err("prenom")}>
                      <Inp name="prenom" value={form.prenom} onChange={ch}
                        placeholder="Mamadou" error={err("prenom")} />
                    </Field>
                  </div>

                  {/* Email + Téléphone */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Email">
                      <Inp name="email" value={form.email} onChange={ch}
                        type="email" placeholder="prenom.nom@example.com" />
                    </Field>
                    <Field label="Téléphone">
                      <Inp name="telephone" value={form.telephone} onChange={ch}
                        placeholder="+221 77 000 00 00" />
                    </Field>
                  </div>
                </div>
              )}

              {/* ─ Étape 2 : Poste ─ */}
              {step === 2 && (
                <div className="space-y-5">

                  {/* Type de contrat — badges cliquables */}
                  <Field label="Type de contrat" req error={err("type_contrat")}>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {CONTRACT_TYPES.map(ct => {
                        const active = form.type_contrat === ct.value;
                        const colors: Record<string, string> = {
                          blue:   active ? "border-blue-500 bg-blue-50 text-blue-700"   : "border-gray-200 text-gray-500 hover:border-blue-300",
                          amber:  active ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500 hover:border-amber-300",
                          purple: active ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500 hover:border-purple-300",
                          orange: active ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-500 hover:border-orange-300",
                        };
                        return (
                          <button key={ct.value} type="button"
                            onClick={() => setForm(p => ({ ...p, type_contrat: ct.value }))}
                            className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition ${colors[ct.color]}`}>
                            {ct.label}
                          </button>
                        );
                      })}
                    </div>
                    {err("type_contrat") && (
                      <p className="mt-1 text-xs text-red-500">Sélectionnez un type de contrat</p>
                    )}
                  </Field>

                  {/* Fonction + Date embauche */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Fonction">
                      <Inp name="fonction" value={form.fonction} onChange={ch}
                        placeholder="Technicien, Ingénieur…" />
                    </Field>
                    <Field label="Date d'embauche">
                      <Inp name="date_embauche" value={form.date_embauche}
                        onChange={ch} type="date" />
                    </Field>
                  </div>

                  {/* Date fin — uniquement CDD / Stage */}
                  {(form.type_contrat === "CDD" || form.type_contrat === "STAGE") && (
                    <Field label={`Date de fin ${form.type_contrat === "STAGE" ? "de stage" : "CDD"}`}>
                      <Inp name="date_fin_cdd" value={form.date_fin_cdd}
                        onChange={ch} type="date" />
                    </Field>
                  )}

                  {/* Service / Département → auto-détect hiérarchie */}
                  <Field label="Service / Département">
                    <div className="relative">
                      {deptOptions.length > 0 ? (
                        <Sel name="service" value={form.service} onChange={ch}
                          ph="— Sélectionner un département —" opts={deptOptions} />
                      ) : (
                        <Inp name="service" value={form.service} onChange={ch}
                          placeholder="Ex : Informatique, Finance…" />
                      )}
                      {detecting && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 size={14} className="animate-spin text-blue-500" />
                        </div>
                      )}
                    </div>
                  </Field>

                  {/* Managers auto-détectés */}
                  {(form.n1_manager || form.n2_manager) && !detecting && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <UserCheck size={13} />
                        Managers détectés depuis la hiérarchie
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {form.n1_manager && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">N+1</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{n1Name}</p>
                            {form.manager_email && (
                              <p className="text-xs text-gray-400 flex items-center gap-1 truncate mt-0.5">
                                <Mail size={10} />{form.manager_email}
                              </p>
                            )}
                          </div>
                        )}
                        {form.n2_manager && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">N+2</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{n2Name}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {detecting && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                      <Loader2 size={13} className="animate-spin shrink-0" />
                      Récupération des managers depuis la hiérarchie…
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button type="button"
                onClick={() => step === 1 ? onClose() : (setErrors([]), setTouched(false), setStep(1))}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition">
                {step === 1 ? "Annuler" : "Précédent"}
              </button>

              {step === 1 ? (
                <button type="button" onClick={goNext}
                  className="px-5 py-2 rounded-lg bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold flex items-center gap-2 transition">
                  Suivant <ChevronRight size={15} />
                </button>
              ) : (
                <button type="button" onClick={submit} disabled={loading}
                  className="px-5 py-2 rounded-lg bg-camublue-900 hover:bg-camublue-800 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50">
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" />Enregistrement…</>
                    : <><Check size={14} />{isEdit ? "Enregistrer" : "Créer l'employé"}</>}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
