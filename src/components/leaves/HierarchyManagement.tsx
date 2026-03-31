// src/components/leaves/HierarchyManagement.tsx
// Gestion de la hiérarchie de validation des congés

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, Users, ShieldCheck, Plus, Pencil, Trash2,
  Search, ChevronDown, ChevronUp, X, Check, AlertCircle,
  GitBranch, UserCheck, Settings2, RefreshCw, Loader2,
  FolderTree,
} from "lucide-react";
import toast from "react-hot-toast";
import { Employee } from "@/types/employee";
import { patchEmployee } from "@/services/employeeService";
import { Department, DepartmentCreate, ApprovalRule, ApprovalRuleCreate, EmployeeHierarchy } from "@/types/leave";
import { departmentService, employeeHierarchyService, approvalRuleService } from "@/services/hierarchyService";
import { getEmployees } from "@/services/employeeService";

// ─── Tabs ───────────────────────────────────────────────────────────────────
type HierarchyTab = "orgchart" | "departments" | "employees" | "rules";

const TABS: { id: HierarchyTab; label: string; Icon: React.ElementType }[] = [
  { id: "orgchart",    label: "Organigramme",        Icon: GitBranch   },
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
  const [activeTab, setActiveTab] = useState<HierarchyTab>("orgchart");

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === id
                ? "border-blue-600 text-blue-700 bg-blue-50/50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {activeTab === "orgchart"    && <OrgChartTab />}
      {activeTab === "departments" && <DepartmentsTab />}
      {activeTab === "employees"   && <EmployeesHierarchyTab />}
      {activeTab === "rules"       && <ApprovalRulesTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Organigramme
// ─────────────────────────────────────────────────────────────────────────────
function OrgChartTab() {
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [employees,    setEmployees]    = useState<EmployeeHierarchy[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editingEmp,   setEditingEmp]   = useState<EmployeeHierarchy | null>(null);
  const [editForm,     setEditForm]     = useState<{
    n1_manager_id: number | null;
    n2_manager_id: number | null;
    requires_two_approvals: boolean;
    service: string;
  }>({ n1_manager_id: null, n2_manager_id: null, requires_two_approvals: false, service: "" });
  const [saving, setSaving] = useState(false);

  // Dept en cours d'édition (depuis l'orgchart)
  const [editingDept,   setEditingDept]   = useState<Department | null>(null);
  const [deptForm,      setDeptForm]      = useState<{
    name: string; code: string; description: string; parent_id: number | null; head_id: number | null; dg_validator_id: number | null;
  }>({ name: "", code: "", description: "", parent_id: null, head_id: null, dg_validator_id: null });
  const [savingDept, setSavingDept] = useState(false);

  // Assignation en masse des membres d'un département
  const [bulkDept,      setBulkDept]      = useState<Department | null>(null);
  const [bulkSelected,  setBulkSelected]  = useState<Set<number>>(new Set());
  const [bulkSearch,    setBulkSearch]    = useState("");
  const [bulkSaving,    setBulkSaving]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, hier, emps] = await Promise.all([
        departmentService.getAll(),
        employeeHierarchyService.getAll(),
        getEmployees({ status: "ACTIVE" }),
      ]);
      setDepartments(depts);
      setEmployees(hier);
      setAllEmployees(emps);
    } catch {
      toast.error("Impossible de charger l'organigramme.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Regrouper les employés par département (service = nom du département)
  const empsByDept = useMemo(() => {
    const map: Record<string, EmployeeHierarchy[]> = {};
    employees.forEach(emp => {
      const key = emp.service ?? "";
      if (!map[key]) map[key] = [];
      map[key].push(emp);
    });
    return map;
  }, [employees]);

  // Noms des DG validators (dédupliqués)
  const dgNames = useMemo(() =>
    [...new Set(departments.map(d => d.dg_validator_name).filter(Boolean))],
    [departments]
  );

  const openEditEmp = (emp: EmployeeHierarchy) => {
    setEditingEmp(emp);
    setEditForm({
      n1_manager_id: emp.n1_manager,
      n2_manager_id: emp.n2_manager,
      requires_two_approvals: emp.requires_two_approvals,
      service: emp.service ?? "",
    });
  };

  const handleSaveEmp = async () => {
    if (!editingEmp) return;
    setSaving(true);
    try {
      await employeeHierarchyService.update(editingEmp.id, {
        n1_manager_id: editForm.n1_manager_id,
        n2_manager_id: editForm.n2_manager_id,
        requires_two_approvals: editForm.requires_two_approvals,
      });
      // Mettre à jour le département (service) si changé
      if (editForm.service !== (editingEmp.service ?? "")) {
        await patchEmployee(editingEmp.id, { service: editForm.service || null });
      }
      toast.success("Hiérarchie mise à jour ✓");
      setEditingEmp(null);
      load();
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const openEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name:             dept.name,
      code:             dept.code,
      description:      dept.description,
      parent_id:        dept.parent,
      head_id:          dept.head,
      dg_validator_id:  dept.dg_validator,
    });
  };

  const handleSaveDept = async () => {
    if (!editingDept || !deptForm.name || !deptForm.code) {
      toast.error("Nom et code obligatoires.");
      return;
    }
    setSavingDept(true);
    try {
      await departmentService.update(editingDept.id, deptForm);
      toast.success("Département mis à jour ✓");
      setEditingDept(null);
      load();
    } catch {
      toast.error("Erreur lors de la mise à jour du département.");
    } finally {
      setSavingDept(false);
    }
  };

  // ── Assignation en masse ────────────────────────────────────────────────────
  const openBulkAssign = (dept: Department) => {
    setBulkDept(dept);
    setBulkSearch("");
    // Pré-cocher les employés déjà dans ce département
    const currentIds = new Set(
      employees.filter(e => e.service === dept.name).map(e => e.id)
    );
    setBulkSelected(currentIds);
  };

  const handleBulkSave = async () => {
    if (!bulkDept) return;
    setBulkSaving(true);
    try {
      const previousIds = new Set(
        employees.filter(e => e.service === bulkDept.name).map(e => e.id)
      );
      const toAdd    = [...bulkSelected].filter(id => !previousIds.has(id));
      const toRemove = [...previousIds].filter(id => !bulkSelected.has(id));

      await Promise.all([
        ...toAdd.map(id    => patchEmployee(id, { service: bulkDept.name })),
        ...toRemove.map(id => patchEmployee(id, { service: null })),
      ]);

      const changed = toAdd.length + toRemove.length;
      toast.success(`${changed} employé(s) mis à jour ✓`);
      setBulkDept(null);
      load();
    } catch {
      toast.error("Erreur lors de l'assignation en masse.");
    } finally {
      setBulkSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const unassigned = empsByDept[""] ?? [];
  const activeEmps = allEmployees.filter(e => e.status === "ACTIVE");

  return (
    <div className="space-y-6">

      {/* ── Légende ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100">
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-indigo-400 bg-indigo-100 inline-block" />Direction Générale</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-50 inline-block" />Département parent (N+2)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-teal-400 bg-teal-50 inline-block" />Sous-département (N+1)</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-emerald-400 bg-emerald-50 inline-block" />Département simple</div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-blue-300 bg-blue-50 inline-block" />Employés</div>
        <div className="flex items-center gap-1.5 ml-auto text-gray-400 italic">Cliquez sur un employé ou un département pour le modifier</div>
      </div>

      {/* ── Direction Générale ────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-0">
        <div className="bg-indigo-100 border-2 border-indigo-400 rounded-2xl px-10 py-4 text-center min-w-[240px]">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-1">Direction Générale</p>
          <p className="font-black text-indigo-900 text-base">PDG / DG / Directeur</p>
          {dgNames.length > 0 ? (
            <p className="text-sm text-indigo-600 mt-1">{dgNames.join(" · ")}</p>
          ) : (
            <p className="text-xs text-indigo-400 italic mt-1">Non défini</p>
          )}
        </div>

        {/* Connecteur vertical */}
        {departments.length > 0 && <div className="w-px h-8 bg-gray-300" />}
      </div>

      {/* ── Responsables de département ───────────────────────────────────────── */}
      {departments.length > 0 && (() => {
        // Séparer les départements racines (sans parent) des sous-départements
        const rootDepts = departments.filter(d => !d.parent);
        const childDeptMap: Record<number, typeof departments> = {};
        departments.forEach(d => {
          if (d.parent) {
            if (!childDeptMap[d.parent]) childDeptMap[d.parent] = [];
            childDeptMap[d.parent].push(d);
          }
        });

        return (
          <>
            <p className="text-center text-xs text-gray-400 italic -mt-4">Responsables de département</p>
            <div className="flex flex-wrap gap-6 justify-center">
              {rootDepts.map(dept => (
                <DeptColumn
                  key={dept.id}
                  dept={dept}
                  employees={empsByDept[dept.name] ?? []}
                  subDepartments={childDeptMap[dept.id] ?? []}
                  empsByDept={empsByDept}
                  onEditEmployee={openEditEmp}
                  onEditDept={openEditDept}
                  onBulkAssign={openBulkAssign}
                />
              ))}
            </div>

            {/* Sous-départements orphelins (parent supprimé) */}
            {departments.filter(d => d.parent && !departments.find(p => p.id === d.parent)).length > 0 && (
              <div className="flex flex-wrap gap-6 justify-center mt-4">
                {departments.filter(d => d.parent && !departments.find(p => p.id === d.parent)).map(dept => (
                  <DeptColumn
                    key={dept.id}
                    dept={dept}
                    employees={empsByDept[dept.name] ?? []}
                    subDepartments={[]}
                    empsByDept={empsByDept}
                    onEditEmployee={openEditEmp}
                    onEditDept={openEditDept}
                    onBulkAssign={openBulkAssign}
                  />
                ))}
              </div>
            )}
          </>
        );
      })()}

      {departments.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Building2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm italic">Aucun département configuré.</p>
          <p className="text-xs mt-1">Créez des départements dans l'onglet "Départements".</p>
        </div>
      )}

      {/* ── Employés sans département ─────────────────────────────────────────── */}
      {unassigned.length > 0 && (
        <div className="bg-amber-50 border border-dashed border-amber-300 rounded-2xl p-4">
          <p className="text-xs font-bold text-amber-700 mb-3 flex items-center gap-1.5">
            <AlertCircle size={13} /> {unassigned.length} employé(s) sans département assigné
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(emp => (
              <button
                key={emp.id}
                onClick={() => openEditEmp(emp)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs hover:border-blue-400 hover:bg-blue-50 transition"
              >
                <div className="w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                  {emp.full_name.slice(0, 2).toUpperCase()}
                </div>
                <span className="font-semibold text-gray-700">{emp.full_name}</span>
                <span className="text-gray-400">{emp.fonction ?? ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal : édition hiérarchie employé ────────────────────────────────── */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setEditingEmp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0">
                  {editingEmp.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-800">{editingEmp.full_name}</p>
                  <p className="text-xs text-gray-400">{editingEmp.matricule} · {editingEmp.fonction ?? "—"}</p>
                </div>
              </div>
              <button onClick={() => setEditingEmp(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                <X size={16} />
              </button>
            </div>
            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Département */}
              <FormField label="Département">
                <select
                  value={editForm.service}
                  onChange={e => setEditForm(f => ({ ...f, service: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">— Sans département</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </FormField>

              {/* N+1 */}
              <FormField label="Manager direct N+1">
                <EmployeeSelect
                  employees={activeEmps.filter(e => e.id !== editingEmp.id)}
                  value={editForm.n1_manager_id}
                  onChange={v => setEditForm(f => ({ ...f, n1_manager_id: v }))}
                  placeholder="Choisir le N+1..."
                />
              </FormField>

              {/* N+2 */}
              <FormField label="Manager N+2 (Direction)">
                <EmployeeSelect
                  employees={activeEmps.filter(e => e.id !== editingEmp.id)}
                  value={editForm.n2_manager_id}
                  onChange={v => setEditForm(f => ({
                    ...f,
                    n2_manager_id: v,
                    requires_two_approvals: v !== null ? true : f.requires_two_approvals,
                  }))}
                  placeholder="Choisir le N+2..."
                />
              </FormField>

              {/* Double validation */}
              <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                <input
                  type="checkbox"
                  checked={editForm.requires_two_approvals}
                  onChange={e => setEditForm(f => ({ ...f, requires_two_approvals: e.target.checked }))}
                  className="h-4 w-4 rounded accent-blue-600"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Double validation requise</p>
                  <p className="text-xs text-gray-400">N+1 et N+2 doivent tous deux approuver le congé</p>
                </div>
              </label>
            </div>
            {/* Footer */}
            <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setEditingEmp(null)}
                className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-100 font-medium transition">
                Annuler
              </button>
              <button onClick={handleSaveEmp} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-60 font-bold transition">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : édition département ────────────────────────────────────────── */}
      {editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setEditingDept(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Modifier le département</h3>
              <button onClick={() => setEditingDept(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Nom *">
                <input value={deptForm.name}
                  onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </FormField>
              <FormField label="Code *">
                <input value={deptForm.code}
                  onChange={e => setDeptForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </FormField>
              <FormField label="Département parent" className="sm:col-span-2">
                <select
                  value={deptForm.parent_id ?? ""}
                  onChange={e => setDeptForm(f => ({ ...f, parent_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">— Aucun (département racine)</option>
                  {departments
                    .filter(d => !editingDept || d.id !== editingDept.id)
                    .filter(d => !d.parent)
                    .map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))
                  }
                </select>
                {deptForm.parent_id && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <FolderTree size={11} />
                    Sous-département : son responsable = N+1, le responsable du parent = N+2
                  </p>
                )}
              </FormField>
              <FormField label={deptForm.parent_id ? "Responsable (N+1)" : "Responsable N+1"}>
                <EmployeeSelect employees={activeEmps} value={deptForm.head_id ?? null}
                  onChange={v => setDeptForm(f => ({ ...f, head_id: v }))}
                  placeholder="Chef de département..." />
              </FormField>
              {!deptForm.parent_id && (
                <FormField label="Validateur DG (N+2)">
                  <EmployeeSelect employees={activeEmps} value={deptForm.dg_validator_id ?? null}
                    onChange={v => setDeptForm(f => ({ ...f, dg_validator_id: v }))}
                    placeholder="Directeur général..." />
                </FormField>
              )}
              <FormField label="Description" className="sm:col-span-2">
                <textarea value={deptForm.description}
                  onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows={2} />
              </FormField>
            </div>
            <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setEditingDept(null)}
                className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-100 font-medium transition">
                Annuler
              </button>
              <button onClick={handleSaveDept} disabled={savingDept}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-bold transition">
                {savingDept ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : assignation en masse des membres ─────────────────────────── */}
      {bulkDept && (() => {
        const deptName = bulkDept.name.trim().toLowerCase();
        const deptCode = bulkDept.code.trim().toLowerCase();
        const q = bulkSearch.trim().toLowerCase();

        // Base : employés dont service ou projet correspond à ce département
        const deptEmps = allEmployees.filter(e => {
          if (e.status !== "ACTIVE") return false;
          const svc  = (e.service ?? "").toLowerCase();
          const proj = (e.projet  ?? "").toLowerCase();
          return svc === deptName || svc === deptCode || proj === deptName || proj === deptCode;
        });

        // Aussi inclure ceux déjà assignés dans l'organigramme (au cas où leur service diffère légèrement)
        const alreadyAssigned = employees.filter(e => e.service === bulkDept.name);
        const alreadyIds = new Set(alreadyAssigned.map(e => e.id));
        const extraEmps = allEmployees.filter(e => alreadyIds.has(e.id) && !deptEmps.find(d => d.id === e.id));
        const baseEmps = [...deptEmps, ...extraEmps];

        const visibleEmps = q
          ? baseEmps.filter(e =>
              `${e.nom} ${e.prenom}`.toLowerCase().includes(q) ||
              (e.matricule ?? "").toLowerCase().includes(q) ||
              (e.service ?? "").toLowerCase().includes(q)
            )
          : baseEmps;
        const allChecked  = visibleEmps.length > 0 && visibleEmps.every(e => bulkSelected.has(e.id));
        const someChecked = visibleEmps.some(e => bulkSelected.has(e.id));
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setBulkDept(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <h3 className="font-bold text-gray-800">Membres du département</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="font-semibold text-emerald-700">{bulkDept.name}</span>
                    {" · "}Cochez pour assigner, décochez pour retirer
                  </p>
                </div>
                <button onClick={() => setBulkDept(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                  <X size={16} />
                </button>
              </div>

              {/* Barre de recherche + Tout/Aucun */}
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 space-y-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={bulkSearch}
                    onChange={e => setBulkSearch(e.target.value)}
                    placeholder="Rechercher par nom, matricule, service..."
                    className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <label className="flex items-center gap-2 cursor-pointer select-none font-medium hover:text-gray-800 transition">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                      onChange={() => {
                        if (allChecked) {
                          setBulkSelected(prev => {
                            const next = new Set(prev);
                            visibleEmps.forEach(e => next.delete(e.id));
                            return next;
                          });
                        } else {
                          setBulkSelected(prev => {
                            const next = new Set(prev);
                            visibleEmps.forEach(e => next.add(e.id));
                            return next;
                          });
                        }
                      }}
                      className="accent-emerald-600 h-4 w-4"
                    />
                    {allChecked ? "Tout désélectionner" : "Tout sélectionner"}
                  </label>
                  <span className="font-semibold text-emerald-700">
                    {bulkSelected.size} sélectionné(s)
                  </span>
                </div>
              </div>

              {/* Liste scrollable */}
              <div className="overflow-y-auto flex-1 px-2 py-2">
                {visibleEmps.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 italic py-8">Aucun employé trouvé</p>
                ) : (
                  visibleEmps.map(emp => {
                    const checked = bulkSelected.has(emp.id);
                    const currentDept = employees.find(e => e.id === emp.id)?.service ?? "";
                    const isInOtherDept = currentDept && currentDept !== bulkDept.name;
                    return (
                      <label
                        key={emp.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition select-none ${
                          checked ? "bg-emerald-50 border border-emerald-200" : "hover:bg-gray-50 border border-transparent"
                        } mb-1`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setBulkSelected(prev => {
                            const next = new Set(prev);
                            checked ? next.delete(emp.id) : next.add(emp.id);
                            return next;
                          })}
                          className="accent-emerald-600 h-4 w-4 flex-shrink-0"
                        />
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-black flex-shrink-0">
                          {`${emp.nom} ${emp.prenom}`.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{emp.nom} {emp.prenom}</p>
                          <p className="text-xs text-gray-400 truncate">{emp.matricule} · {emp.fonction ?? "—"}</p>
                        </div>
                        {isInOtherDept && (
                          <span className="text-[10px] text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md flex-shrink-0">
                            {currentDept}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                <p className="text-xs text-gray-400">
                  Les employés en orange sont déjà dans un autre département.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setBulkDept(null)}
                    className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-100 font-medium transition">
                    Annuler
                  </button>
                  <button onClick={handleBulkSave} disabled={bulkSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-bold transition">
                    {bulkSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── DeptColumn : colonne département dans l'organigramme ─────────────────────
function DeptColumn({
  dept, employees, subDepartments, empsByDept, onEditEmployee, onEditDept, onBulkAssign,
}: {
  dept: Department;
  employees: EmployeeHierarchy[];
  subDepartments: Department[];
  empsByDept: Record<string, EmployeeHierarchy[]>;
  onEditEmployee: (emp: EmployeeHierarchy) => void;
  onEditDept: (dept: Department) => void;
  onBulkAssign: (dept: Department) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasSubDepts = subDepartments.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Connecteur depuis DG */}
      <div className="w-px h-8 bg-gray-300" />

      {/* Carte département */}
      <div className={`border-2 rounded-2xl min-w-[175px] max-w-[240px] overflow-hidden shadow-sm ${
        hasSubDepts ? "bg-amber-50 border-amber-400" : "bg-emerald-50 border-emerald-400"
      }`}>
        <button
          onClick={() => onEditDept(dept)}
          className={`w-full px-4 pt-3 pb-2 text-center transition ${
            hasSubDepts ? "hover:bg-amber-100" : "hover:bg-emerald-100"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className={`text-white text-[10px] font-black px-2 py-0.5 rounded-md tracking-wider ${
              hasSubDepts ? "bg-amber-600" : "bg-emerald-600"
            }`}>
              {dept.code}
            </span>
            {hasSubDepts && (
              <span className="text-[9px] text-amber-600 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md font-semibold">
                <FolderTree size={9} className="inline mr-0.5" />{subDepartments.length} sous-dept.
              </span>
            )}
          </div>
          <p className={`font-black text-sm mt-1.5 ${hasSubDepts ? "text-amber-900" : "text-emerald-900"}`}>{dept.name}</p>
          <p className={`text-xs mt-0.5 truncate max-w-full ${hasSubDepts ? "text-amber-700" : "text-emerald-700"}`}>
            {dept.head_name ? (
              <>
                {dept.head_name}
                {hasSubDepts && <span className="text-[10px] ml-1 opacity-70">(N+2)</span>}
              </>
            ) : (
              <span className={`italic ${hasSubDepts ? "text-amber-400" : "text-emerald-400"}`}>Sans responsable</span>
            )}
          </p>
          {dept.dg_validator_name && (
            <p className={`text-[10px] mt-0.5 ${hasSubDepts ? "text-amber-500" : "text-emerald-500"}`}>
              DG : {dept.dg_validator_name}
            </p>
          )}
        </button>

        {/* Bouton "Gérer les membres" + toggle */}
        <div className={`flex border-t ${hasSubDepts ? "border-amber-200" : "border-emerald-200"}`}>
          <button
            onClick={() => onBulkAssign(dept)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-semibold transition ${
              hasSubDepts
                ? "bg-amber-100 hover:bg-amber-600 hover:text-white text-amber-700"
                : "bg-emerald-100 hover:bg-emerald-600 hover:text-white text-emerald-700"
            }`}
            title="Assigner des employés en masse"
          >
            <UserCheck size={12} /> Membres
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className={`px-3 py-2 transition border-l ${
              hasSubDepts
                ? "bg-amber-100 hover:bg-amber-200 text-amber-600 border-amber-200"
                : "bg-emerald-100 hover:bg-emerald-200 text-emerald-600 border-emerald-200"
            }`}
            title={expanded ? "Replier" : "Déplier"}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Contenu étendu : sous-départements OU employés directs */}
      {expanded && (
        <>
          {/* Sous-départements */}
          {hasSubDepts ? (
            <>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex gap-4">
                {subDepartments.map((subDept, idx) => (
                  <div key={subDept.id} className="flex flex-col items-center">
                    {/* Connecteur horizontal entre sous-depts */}
                    <div className="flex items-start">
                      {idx === 0 && subDepartments.length > 1 && <div className="w-8" />}
                      <div className="w-px h-4 bg-gray-300" />
                      {idx === subDepartments.length - 1 && subDepartments.length > 1 && <div className="w-8" />}
                    </div>

                    {/* Carte sous-département */}
                    <SubDeptCard
                      dept={subDept}
                      employees={empsByDept[subDept.name] ?? []}
                      onEditEmployee={onEditEmployee}
                      onEditDept={onEditDept}
                      onBulkAssign={onBulkAssign}
                    />
                  </div>
                ))}
              </div>

              {/* Employés directs du département parent (s'il y en a) */}
              {employees.length > 0 && (
                <>
                  <div className="w-px h-4 bg-gray-300" />
                  <EmployeeList employees={employees} onEditEmployee={onEditEmployee} />
                </>
              )}
            </>
          ) : (
            <>
              <div className="w-px h-4 bg-gray-300" />
              <EmployeeList employees={employees} onEditEmployee={onEditEmployee} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── SubDeptCard : carte sous-département dans l'organigramme ──────────────────
function SubDeptCard({
  dept, employees, onEditEmployee, onEditDept, onBulkAssign,
}: {
  dept: Department;
  employees: EmployeeHierarchy[];
  onEditEmployee: (emp: EmployeeHierarchy) => void;
  onEditDept: (dept: Department) => void;
  onBulkAssign: (dept: Department) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="flex flex-col items-center">
      <div className="bg-teal-50 border-2 border-teal-400 rounded-2xl min-w-[160px] max-w-[200px] overflow-hidden shadow-sm">
        <button
          onClick={() => onEditDept(dept)}
          className="w-full px-3 pt-2.5 pb-1.5 text-center hover:bg-teal-100 transition"
        >
          <span className="bg-teal-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wider">
            {dept.code}
          </span>
          <p className="font-bold text-teal-900 text-xs mt-1">{dept.name}</p>
          <p className="text-[11px] text-teal-700 mt-0.5 truncate max-w-full">
            {dept.head_name ? (
              <>
                {dept.head_name}
                <span className="text-[9px] ml-1 opacity-70">(N+1)</span>
              </>
            ) : (
              <span className="italic text-teal-400">Sans responsable</span>
            )}
          </p>
        </button>
        <div className="flex border-t border-teal-200">
          <button
            onClick={() => onBulkAssign(dept)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-teal-100 hover:bg-teal-600 hover:text-white text-[10px] font-semibold text-teal-700 transition"
          >
            <UserCheck size={10} /> Membres
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="px-2 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-600 border-l border-teal-200 transition"
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div className="w-px h-3 bg-gray-300" />
          <EmployeeList employees={employees} onEditEmployee={onEditEmployee} compact />
        </>
      )}
    </div>
  );
}

// ── EmployeeList : liste d'employés dans l'organigramme ───────────────────────
function EmployeeList({
  employees, onEditEmployee, compact = false,
}: {
  employees: EmployeeHierarchy[];
  onEditEmployee: (emp: EmployeeHierarchy) => void;
  compact?: boolean;
}) {
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-2xl overflow-hidden ${
      compact ? "min-w-[160px] max-w-[200px]" : "min-w-[175px] max-w-[210px]"
    }`}>
      {employees.length === 0 ? (
        <p className={`text-gray-400 italic text-center px-3 ${compact ? "text-[10px] py-3" : "text-[11px] py-4"}`}>Aucun employé</p>
      ) : (
        <div className="divide-y divide-blue-100">
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => onEditEmployee(emp)}
              className={`w-full flex items-center gap-2 hover:bg-blue-100 transition text-left ${
                compact ? "px-2 py-2" : "px-3 py-2.5"
              }`}
            >
              <div className={`rounded-full bg-blue-600 text-white flex items-center justify-center font-black flex-shrink-0 ${
                compact ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]"
              }`}>
                {emp.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold text-gray-800 truncate ${compact ? "text-[11px]" : "text-xs"}`}>{emp.full_name}</p>
                <p className={`text-gray-400 truncate ${compact ? "text-[9px]" : "text-[10px]"}`}>{emp.fonction ?? "—"}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                {emp.n1_manager_name && (
                  <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 rounded">N+1</span>
                )}
                {emp.requires_two_approvals && (
                  <span className="text-[9px] text-orange-600 bg-orange-50 border border-orange-200 px-1 rounded">2✓</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
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
    name: "", code: "", description: "", parent_id: null, head_id: null, dg_validator_id: null,
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

  // ── Auto-détection des employés correspondants (nom OU code) ──────────────
  const autoMatch = useMemo(() => {
    if ((!form.name.trim() && !form.code.trim()) || editing) return [];
    const qName = form.name.trim().toLowerCase();
    const qCode = form.code.trim().toLowerCase();
    return employees.filter(e => {
      if (e.status !== "ACTIVE") return false;
      const svc  = (e.service ?? "").toLowerCase();
      const proj = (e.projet  ?? "").toLowerCase();
      return (
        (qName && (svc === qName || proj === qName)) ||
        (qCode && (svc === qCode || proj === qCode))
      );
    });
  }, [form.name, form.code, employees, editing]);

  // ── Manager suggéré : n1_manager le plus fréquent parmi les matchés ────────
  const suggestedHead = useMemo(() => {
    if (autoMatch.length === 0) return null;
    const freq: Record<number, number> = {};
    autoMatch.forEach(e => {
      if (e.n1_manager) freq[e.n1_manager] = (freq[e.n1_manager] ?? 0) + 1;
    });
    const topId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!topId) return null;
    return employees.find(e => e.id === Number(topId)) ?? null;
  }, [autoMatch, employees]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", description: "", parent_id: null, head_id: null, dg_validator_id: null });
    setShowForm(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setForm({
      name:           dept.name,
      code:           dept.code,
      description:    dept.description,
      parent_id:      dept.parent,
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
        // Assignation automatique des employés détectés
        if (autoMatch.length > 0) {
          await Promise.all(autoMatch.map(e => patchEmployee(e.id, { service: form.name })));
          toast.success(`Département créé · ${autoMatch.length} employé(s) assigné(s) automatiquement ✓`);
        } else {
          toast.success("Département créé.");
        }
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
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
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <FormField label="Département parent" className="sm:col-span-2">
                  <select
                    value={form.parent_id ?? ""}
                    onChange={e => setForm(f => ({ ...f, parent_id: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">— Aucun (département racine)</option>
                    {departments
                      .filter(d => !editing || d.id !== editing.id) // ne pas se lister soi-même
                      .filter(d => !d.parent) // seuls les depts racines peuvent être parents
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))
                    }
                  </select>
                  {form.parent_id && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <FolderTree size={11} />
                      Ce département sera un sous-département. Son responsable sera N+1, le responsable du parent sera N+2.
                    </p>
                  )}
                </FormField>
                <FormField label={form.parent_id ? "Responsable (N+1 du sous-département)" : "Responsable (chef de département)"}>
                  <EmployeeSelect
                    employees={activeEmployees}
                    value={form.head_id ?? null}
                    onChange={v => setForm(f => ({ ...f, head_id: v }))}
                    placeholder="Choisir le responsable..."
                  />
                </FormField>
                {!form.parent_id && (
                  <FormField label="Validateur DG (N+2)">
                    <EmployeeSelect
                      employees={activeEmployees}
                      value={form.dg_validator_id ?? null}
                      onChange={v => setForm(f => ({ ...f, dg_validator_id: v }))}
                      placeholder="Choisir le DG validateur..."
                    />
                  </FormField>
                )}
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

              {/* ── Preview auto-assignation (création seulement) ───────────── */}
              {!editing && (form.name.trim() || form.code.trim()) && (
                <div className={`rounded-xl border p-4 space-y-3 ${
                  autoMatch.length > 0 ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-center gap-2">
                    <Users size={14} className={autoMatch.length > 0 ? "text-emerald-600" : "text-gray-400"} />
                    <span className="text-xs font-semibold text-gray-700">Employés détectés automatiquement</span>
                  </div>

                  {autoMatch.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      Aucun employé avec <code className="bg-gray-100 px-1 rounded">service</code> ou <code className="bg-gray-100 px-1 rounded">projet</code> correspondant à{" "}
                      {form.name.trim() && <strong>"{form.name}"</strong>}
                      {form.name.trim() && form.code.trim() && <span className="text-gray-300"> / </span>}
                      {form.code.trim() && <strong>"{form.code}"</strong>}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-emerald-700 font-medium">
                        <strong>{autoMatch.length}</strong> employé(s) seront automatiquement assignés à ce département
                        {autoMatch.some(e => e.projet?.toLowerCase() === form.name.trim().toLowerCase()) && (
                          <span className="text-emerald-500"> (via service ou projet)</span>
                        )}
                      </p>

                      {/* Suggestion responsable */}
                      {suggestedHead && (
                        <div className="flex items-center justify-between bg-white border border-emerald-200 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-[11px] text-gray-500 font-medium">Responsable suggéré</p>
                            <p className="text-sm font-bold text-gray-800">
                              {suggestedHead.nom} {suggestedHead.prenom}
                            </p>
                            <p className="text-[10px] text-gray-400">{suggestedHead.matricule} · {suggestedHead.fonction ?? "—"}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, head_id: suggestedHead.id }))}
                            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                              form.head_id === suggestedHead.id
                                ? "bg-emerald-600 text-white"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                            }`}
                          >
                            {form.head_id === suggestedHead.id ? <Check size={11} /> : <UserCheck size={11} />}
                            {form.head_id === suggestedHead.id ? "Sélectionné" : "Utiliser"}
                          </button>
                        </div>
                      )}

                      {/* Aperçu des 4 premiers employés */}
                      <div className="flex flex-wrap gap-1.5">
                        {autoMatch.slice(0, 4).map(e => (
                          <span key={e.id} className="flex items-center gap-1 text-[11px] bg-white border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[8px] font-black">
                              {`${e.nom}${e.prenom}`.slice(0, 1).toUpperCase()}
                            </span>
                            {e.nom} {e.prenom}
                            {(e.projet ?? "").toLowerCase() === form.name.trim().toLowerCase() && (e.service ?? "").toLowerCase() !== form.name.trim().toLowerCase() && (
                              <span className="text-[9px] text-blue-500 italic">projet</span>
                            )}
                          </span>
                        ))}
                        {autoMatch.length > 4 && (
                          <span className="text-[11px] text-emerald-600 italic px-2 py-0.5">+{autoMatch.length - 4} autres</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
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
                {!editing && autoMatch.length > 0 ? `Créer & assigner ${autoMatch.length} employé(s)` : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      {departments.length === 0 ? (
        <EmptyState icon={Building2} message="Aucun département configuré. Commencez par en créer un." />
      ) : (() => {
        const rootDepts = departments.filter(d => !d.parent);
        const childMap: Record<number, Department[]> = {};
        departments.forEach(d => {
          if (d.parent) {
            if (!childMap[d.parent]) childMap[d.parent] = [];
            childMap[d.parent].push(d);
          }
        });

        const renderDeptCard = (dept: Department, isChild = false) => (
          <div key={dept.id} className={`bg-white border rounded-xl p-4 shadow-sm ${isChild ? "ml-6 border-l-4 border-l-teal-400" : ""}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    isChild ? "bg-teal-100 text-teal-700" : (childMap[dept.id]?.length ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")
                  }`}>
                    {dept.code}
                  </span>
                  <span className="font-semibold text-gray-800">{dept.name}</span>
                  {isChild && (
                    <span className="text-[10px] text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-md">
                      Sous-dept. de {dept.parent_name}
                    </span>
                  )}
                  {!isChild && (childMap[dept.id]?.length ?? 0) > 0 && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                      <FolderTree size={9} /> {childMap[dept.id].length} sous-dept.
                    </span>
                  )}
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
                <span className="text-xs text-gray-500">
                  {isChild ? "Responsable (N+1) :" : "Responsable :"}
                </span>
                <span className="font-medium">{dept.head_name ?? <span className="italic text-gray-400">Non défini</span>}</span>
              </div>
              {!isChild && (
                <div className="flex items-center gap-2 text-gray-600">
                  <ShieldCheck size={13} className="text-purple-500 flex-shrink-0" />
                  <span className="text-xs text-gray-500">Validateur DG :</span>
                  <span className="font-medium">{dept.dg_validator_name ?? <span className="italic text-gray-400">Non défini</span>}</span>
                </div>
              )}
              {isChild && dept.parent_name && (
                <div className="flex items-center gap-2 text-gray-600">
                  <ShieldCheck size={13} className="text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-gray-500">N+2 (resp. parent) :</span>
                  <span className="font-medium">
                    {departments.find(d => d.id === dept.parent)?.head_name ?? <span className="italic text-gray-400">Non défini</span>}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Users size={13} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs text-gray-500">{dept.employee_count} employé(s) actif(s)</span>
              </div>
            </div>
          </div>
        );

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rootDepts.map(dept => (
              <div key={dept.id} className="space-y-3">
                {renderDeptCard(dept)}
                {(childMap[dept.id] ?? []).map(child => renderDeptCard(child, true))}
              </div>
            ))}
            {/* Orphelins */}
            {departments
              .filter(d => d.parent && !departments.find(p => p.id === d.parent))
              .map(dept => (
                <div key={dept.id} className="space-y-3">
                  {renderDeptCard(dept, true)}
                </div>
              ))
            }
          </div>
        );
      })()}
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
