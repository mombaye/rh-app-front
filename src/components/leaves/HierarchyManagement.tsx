// src/components/leaves/HierarchyManagement.tsx
// Gestion de la hiérarchie de validation des congés

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Users, ShieldCheck, Plus, Pencil, Trash2,
  Search, ChevronDown, ChevronUp, X, Check, AlertCircle,
  GitBranch, UserCheck, Settings2, RefreshCw, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Employee } from "@/types/employee";
import { Department, DepartmentCreate, ApprovalRule, ApprovalRuleCreate, EmployeeHierarchy } from "@/types/leave";
import { departmentService, employeeHierarchyService, approvalRuleService } from "@/services/hierarchyService";
import { getEmployees } from "@/services/employeeService";

// ─── Tabs ───────────────────────────────────────────────────────────────────
type HierarchyTab = "departments" | "employees" | "rules";

const TABS: { id: HierarchyTab; label: string; Icon: React.ElementType }[] = [
  { id: "departments", label: "Départements",        Icon: Building2   },
  { id: "employees",   label: "Hiérarchie employés", Icon: Users       },
  { id: "rules",       label: "Règles d'approbation", Icon: ShieldCheck },
];

const RULE_TYPE_LABELS: Record<string, string> = {
  LONG_LEAVE: "Congé longue durée",
  LEAVE_TYPE: "Type de congé spécifique",
  DEPARTMENT: "Département spécifique",
};

// ─── Component principal ─────────────────────────────────────────────────────
export default function HierarchyManagement() {
  const [activeTab, setActiveTab] = useState<HierarchyTab>("departments");

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md transition-colors
              ${activeTab === id
                ? "border-b-2 border-blue-600 text-blue-700 bg-blue-50"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {activeTab === "departments" && <DepartmentsTab />}
      {activeTab === "employees"   && <EmployeesHierarchyTab />}
      {activeTab === "rules"       && <ApprovalRulesTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Départements
// ─────────────────────────────────────────────────────────────────────────────
function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<Department | null>(null);
  const [deleting,    setDeleting]    = useState<number | null>(null);

  const [form, setForm] = useState<DepartmentCreate>({
    name: "", code: "", description: "", head_id: null, dg_validator_id: null,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, emps] = await Promise.all([
        departmentService.getAll(),
        getEmployees({ status: "ACTIVE" }),
      ]);
      setDepartments(depts);
      setEmployees(emps);
    } catch {
      toast.error("Impossible de charger les départements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", description: "", head_id: null, dg_validator_id: null });
    setShowForm(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setForm({
      name:           dept.name,
      code:           dept.code,
      description:    dept.description,
      head_id:        dept.head,
      dg_validator_id: dept.dg_validator,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.error("Le nom et le code sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await departmentService.update(editing.id, form);
        toast.success("Département mis à jour.");
      } else {
        await departmentService.create(form);
        toast.success("Département créé.");
      }
      setShowForm(false);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { name?: string[]; code?: string[] } } })?.response?.data;
      if (msg?.name) toast.error("Nom déjà utilisé.");
      else if (msg?.code) toast.error("Code déjà utilisé.");
      else toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await departmentService.delete(id);
      toast.success("Département supprimé.");
      load();
    } catch {
      toast.error("Impossible de supprimer ce département.");
    } finally {
      setDeleting(null);
    }
  };

  const activeEmployees = employees.filter(e => e.status === "ACTIVE");

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{departments.length} département(s) configuré(s)</p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus size={15} /> Nouveau département
        </button>
      </div>

      {/* Modal Nouveau / Modifier département */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-base">
                {editing ? "Modifier le département" : "Nouveau département"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
              >
                <X size={16} />
              </button>
            </div>
            {/* Corps */}
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Nom *">
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="ex : Ressources Humaines"
                />
              </FormField>
              <FormField label="Code *">
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="ex : RH"
                />
              </FormField>
              <FormField label="Responsable (N+1 du chef)">
                <EmployeeSelect
                  employees={activeEmployees}
                  value={form.head_id ?? null}
                  onChange={v => setForm(f => ({ ...f, head_id: v }))}
                  placeholder="Choisir le responsable..."
                />
              </FormField>
              <FormField label="Validateur DG (N+2)">
                <EmployeeSelect
                  employees={activeEmployees}
                  value={form.dg_validator_id ?? null}
                  onChange={v => setForm(f => ({ ...f, dg_validator_id: v }))}
                  placeholder="Choisir le DG validateur..."
                />
              </FormField>
              <FormField label="Description" className="sm:col-span-2">
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows={2}
                  placeholder="Description optionnelle..."
                />
              </FormField>
            </div>
            {/* Footer */}
            <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-100 font-medium transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-60 font-semibold transition"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      {departments.length === 0 ? (
        <EmptyState icon={Building2} message="Aucun département configuré. Commencez par en créer un." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map(dept => (
            <div key={dept.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">
                      {dept.code}
                    </span>
                    <span className="font-semibold text-gray-800">{dept.name}</span>
                  </div>
                  {dept.description && (
                    <p className="text-xs text-gray-500 mt-1">{dept.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(dept)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(dept.id)}
                    disabled={deleting === dept.id}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 disabled:opacity-50"
                  >
                    {deleting === dept.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <UserCheck size={13} className="text-green-500 flex-shrink-0" />
                  <span className="text-xs text-gray-500">Responsable :</span>
                  <span className="font-medium">{dept.head_name ?? <span className="italic text-gray-400">Non défini</span>}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <ShieldCheck size={13} className="text-purple-500 flex-shrink-0" />
                  <span className="text-xs text-gray-500">Validateur DG :</span>
                  <span className="font-medium">{dept.dg_validator_name ?? <span className="italic text-gray-400">Non défini</span>}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={13} className="text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500">{dept.employee_count} employé(s) actif(s)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Hiérarchie employés
// ─────────────────────────────────────────────────────────────────────────────
function EmployeesHierarchyTab() {
  const [employees,   setEmployees]   = useState<EmployeeHierarchy[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterService, setFilterService] = useState("");
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [editForm,    setEditForm]    = useState<{
    n1_manager_id: number | null;
    n2_manager_id: number | null;
    requires_two_approvals: boolean;
  }>({ n1_manager_id: null, n2_manager_id: null, requires_two_approvals: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hier, emps] = await Promise.all([
        employeeHierarchyService.getAll(),
        getEmployees({ status: "ACTIVE" }),
      ]);
      setEmployees(hier);
      setAllEmployees(emps);
    } catch {
      toast.error("Impossible de charger la hiérarchie.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const services = [...new Set(employees.map(e => e.service).filter(Boolean))].sort() as string[];

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.full_name.toLowerCase().includes(q) || e.matricule.toLowerCase().includes(q);
    const matchService = !filterService || e.service === filterService;
    return matchSearch && matchService;
  });

  const openEdit = (emp: EmployeeHierarchy) => {
    setEditingId(emp.id);
    setEditForm({
      n1_manager_id: emp.n1_manager,
      n2_manager_id: emp.n2_manager,
      requires_two_approvals: emp.requires_two_approvals,
    });
  };

  const handleSave = async (empId: number) => {
    setSaving(true);
    try {
      await employeeHierarchyService.update(empId, editForm);
      toast.success("Hiérarchie mise à jour.");
      setEditingId(null);
      load();
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const activeEmployees = allEmployees.filter(e => e.status === "ACTIVE");

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un employé..."
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterService}
          onChange={e => setFilterService(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tous les services</option>
          {services.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50">
          <RefreshCw size={14} />
        </button>
      </div>

      <p className="text-sm text-gray-500">{filtered.length} employé(s)</p>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Employé</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Service</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Manager N+1</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Manager N+2</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Double valid.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                  Aucun employé trouvé.
                </td>
              </tr>
            ) : filtered.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50">
                {editingId === emp.id ? (
                  <>
                    <td className="px-4 py-3 font-medium">{emp.full_name}<br/><span className="text-xs text-gray-400">{emp.matricule}</span></td>
                    <td className="px-4 py-3 text-gray-500">{emp.service ?? "—"}</td>
                    <td className="px-4 py-3">
                      <EmployeeSelect
                        employees={activeEmployees.filter(e => e.id !== emp.id)}
                        value={editForm.n1_manager_id}
                        onChange={v => setEditForm(f => ({ ...f, n1_manager_id: v }))}
                        placeholder="Manager N+1..."
                        compact
                      />
                    </td>
                    <td className="px-4 py-3">
                      <EmployeeSelect
                        employees={activeEmployees.filter(e => e.id !== emp.id)}
                        value={editForm.n2_manager_id}
                        onChange={v => setEditForm(f => ({
                          ...f,
                          n2_manager_id: v,
                          requires_two_approvals: v !== null ? true : f.requires_two_approvals,
                        }))}
                        placeholder="Manager N+2..."
                        compact
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={editForm.requires_two_approvals}
                        onChange={e => setEditForm(f => ({ ...f, requires_two_approvals: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSave(emp.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-60"
                        >
                          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          Sauver
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 border text-xs rounded hover:bg-gray-50"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <span className="font-medium">{emp.full_name}</span>
                      <br />
                      <span className="text-xs text-gray-400">{emp.matricule}</span>
                      {(emp.manages_n1_count > 0 || emp.manages_n2_count > 0) && (
                        <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded">
                          Manager ({emp.manages_n1_count}N+1/{emp.manages_n2_count}N+2)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{emp.service ?? "—"}</td>
                    <td className="px-4 py-3">
                      {emp.n1_manager_name
                        ? <span className="text-green-700">{emp.n1_manager_name}</span>
                        : <span className="italic text-gray-400">Non défini</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {emp.n2_manager_name
                        ? <span className="text-purple-700">{emp.n2_manager_name}</span>
                        : <span className="italic text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {emp.requires_two_approvals
                        ? <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded">Oui</span>
                        : <span className="text-gray-400 text-xs">Non</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(emp)}
                        className="flex items-center gap-1 px-2 py-1 border text-xs rounded hover:bg-gray-50 text-gray-600"
                      >
                        <Pencil size={11} /> Modifier
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-800">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <span>
          <strong>N+1</strong> : approbateur direct (1er niveau). <strong>N+2</strong> : approbateur secondaire optionnel —
          si renseigné, la validation à 2 niveaux est automatiquement activée.
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Règles d'approbation
// ─────────────────────────────────────────────────────────────────────────────
function ApprovalRulesTab() {
  const [rules,      setRules]      = useState<ApprovalRule[]>([]);
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<ApprovalRule | null>(null);
  const [deleting,   setDeleting]   = useState<number | null>(null);
  const [saving,     setSaving]     = useState(false);

  const [form, setForm] = useState<ApprovalRuleCreate>({
    name: "", rule_type: "LONG_LEAVE", min_days: 15,
    required_approver_id: null, is_active: true, description: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, emps] = await Promise.all([
        approvalRuleService.getAll(),
        getEmployees({ status: "ACTIVE" }),
      ]);
      setRules(r);
      setEmployees(emps);
    } catch {
      toast.error("Impossible de charger les règles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", rule_type: "LONG_LEAVE", min_days: 15, required_approver_id: null, is_active: true, description: "" });
    setShowForm(true);
  };

  const openEdit = (rule: ApprovalRule) => {
    setEditing(rule);
    setForm({
      name:                rule.name,
      rule_type:           rule.rule_type,
      min_days:            rule.min_days,
      required_approver_id: rule.required_approver,
      is_active:           rule.is_active,
      description:         rule.description,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Le nom est obligatoire."); return; }
    setSaving(true);
    try {
      if (editing) {
        await approvalRuleService.update(editing.id, form);
        toast.success("Règle mise à jour.");
      } else {
        await approvalRuleService.create(form);
        toast.success("Règle créée.");
      }
      setShowForm(false);
      load();
    } catch {
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: ApprovalRule) => {
    try {
      await approvalRuleService.update(rule.id, { is_active: !rule.is_active });
      toast.success(rule.is_active ? "Règle désactivée." : "Règle activée.");
      load();
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await approvalRuleService.delete(id);
      toast.success("Règle supprimée.");
      load();
    } catch {
      toast.error("Impossible de supprimer cette règle.");
    } finally {
      setDeleting(null);
    }
  };

  const activeEmployees = employees.filter(e => e.status === "ACTIVE");

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-xs text-blue-800">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <span>
          Les règles d'approbation déclenchent automatiquement une validation supplémentaire lors de la création
          d'une demande de congé. Ex : tout congé de plus de 15 jours requiert une approbation du DG.
        </span>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{rules.length} règle(s) configurée(s)</p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus size={15} /> Nouvelle règle
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-blue-800 flex items-center gap-2">
            <Settings2 size={16} />
            {editing ? "Modifier la règle" : "Nouvelle règle d'approbation"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nom de la règle *">
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="ex : Congé longue durée → DG"
              />
            </FormField>
            <FormField label="Type de règle *">
              <select
                value={form.rule_type}
                onChange={e => setForm(f => ({ ...f, rule_type: e.target.value as ApprovalRuleCreate["rule_type"] }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="LONG_LEAVE">Congé longue durée (seuil de jours)</option>
                <option value="LEAVE_TYPE">Type de congé spécifique</option>
              </select>
            </FormField>

            {form.rule_type === "LONG_LEAVE" && (
              <FormField label="Durée minimale déclenchante (jours)">
                <input
                  type="number"
                  min={1}
                  value={form.min_days}
                  onChange={e => setForm(f => ({ ...f, min_days: parseInt(e.target.value) || 0 }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="ex : 15"
                />
              </FormField>
            )}

            <FormField label="Approbateur requis (ex : DG)">
              <EmployeeSelect
                employees={activeEmployees}
                value={form.required_approver_id ?? null}
                onChange={v => setForm(f => ({ ...f, required_approver_id: v }))}
                placeholder="Choisir l'approbateur supplémentaire..."
              />
            </FormField>

            <FormField label="Description" className="sm:col-span-2">
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={2}
                placeholder="Description de la règle..."
              />
            </FormField>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Règle active</label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Liste des règles */}
      {rules.length === 0 ? (
        <EmptyState icon={ShieldCheck} message="Aucune règle d'approbation configurée." />
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 ${
                !rule.is_active ? "opacity-60" : ""
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    rule.rule_type === "LONG_LEAVE" ? "bg-orange-100 text-orange-700"
                    : rule.rule_type === "LEAVE_TYPE" ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                  }`}>
                    {RULE_TYPE_LABELS[rule.rule_type]}
                  </span>
                  {!rule.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Désactivée</span>
                  )}
                  <span className="font-semibold text-gray-800">{rule.name}</span>
                </div>
                <div className="mt-1 text-sm text-gray-600 space-y-0.5">
                  {rule.rule_type === "LONG_LEAVE" && rule.min_days > 0 && (
                    <p>Déclenchée pour les congés de <strong>{rule.min_days}+ jours</strong></p>
                  )}
                  {rule.leave_type_label && (
                    <p>Type de congé : <strong>{rule.leave_type_label}</strong></p>
                  )}
                  {rule.required_approver_name && (
                    <p>Approbateur requis : <strong className="text-blue-700">{rule.required_approver_name}</strong></p>
                  )}
                  {rule.description && (
                    <p className="text-gray-400 text-xs">{rule.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleActive(rule)}
                  className={`px-2 py-1 text-xs rounded border ${
                    rule.is_active
                      ? "border-red-200 text-red-600 hover:bg-red-50"
                      : "border-green-200 text-green-600 hover:bg-green-50"
                  }`}
                >
                  {rule.is_active ? "Désactiver" : "Activer"}
                </button>
                <button
                  onClick={() => openEdit(rule)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  disabled={deleting === rule.id}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 disabled:opacity-50"
                >
                  {deleting === rule.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants utilitaires
// ─────────────────────────────────────────────────────────────────────────────
function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function EmployeeSelect({
  employees, value, onChange, placeholder, compact = false,
}: {
  employees: Employee[];
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
  compact?: boolean;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return !q || `${e.nom} ${e.prenom}`.toLowerCase().includes(q) || e.matricule.toLowerCase().includes(q);
  });

  const selected = employees.find(e => e.id === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between border rounded-lg px-3 text-sm text-left ${
          compact ? "py-1.5" : "py-2"
        } ${value ? "text-gray-800" : "text-gray-400"}`}
      >
        <span className="truncate">
          {selected ? `${selected.nom} ${selected.prenom}` : placeholder}
        </span>
        <ChevronDown size={14} className="flex-shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-60 overflow-auto">
          <div className="p-2 sticky top-0 bg-white border-b">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border rounded-lg pl-6 pr-2 py-1.5 text-xs"
                placeholder="Rechercher..."
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); setSearch(""); }}
            className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50 italic"
          >
            — Aucun
          </button>
          {filtered.map(e => (
            <button
              key={e.id}
              type="button"
              onClick={() => { onChange(e.id); setOpen(false); setSearch(""); }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center justify-between ${
                e.id === value ? "bg-blue-50 text-blue-700" : "text-gray-700"
              }`}
            >
              <span>{e.nom} {e.prenom}</span>
              <span className="text-xs text-gray-400 ml-2">{e.service ?? ""}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400 italic">Aucun résultat.</p>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <Loader2 size={24} className="animate-spin mr-2" />
      <span>Chargement...</span>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
      <Icon size={36} className="opacity-30" />
      <p className="text-sm italic">{message}</p>
    </div>
  );
}
