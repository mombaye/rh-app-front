// src/components/leaves/HierarchyManagement.tsx
// Gestion de la hiérarchie de validation des congés

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, Users, Plus, Pencil, Trash2,
  Search, ChevronDown, ChevronUp, X, Check, AlertCircle,
  GitBranch, UserCheck, RefreshCw, Loader2,
  FolderTree, ArrowLeft, Eye, EyeOff, Settings2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Employee } from "@/types/employee";
import { patchEmployee } from "@/services/employeeService";
import { Department, DepartmentCreate, EmployeeHierarchy } from "@/types/leave";
import { departmentService, employeeHierarchyService } from "@/services/hierarchyService";
import { getEmployees } from "@/services/employeeService";

// ─── Sections ───────────────────────────────────────────────────────────────
type HierarchySection = "orgchart" | "employees" | "interimaires";

const SECTIONS: { id: HierarchySection; label: string; description: string; Icon: React.ElementType; color: string }[] = [
  { id: "orgchart",     label: "Organigramme",        description: "Visualisez et gérez la structure organisationnelle, les départements et leurs membres",                     Icon: GitBranch, color: "blue"    },
  { id: "employees",    label: "Hiérarchie Internes",  description: "Gérez les managers N+1/N+2 et la double validation pour chaque employé interne (CDI/CDD/Stage)",           Icon: Users,     color: "emerald" },
  { id: "interimaires", label: "Intérimaires",          description: "Consultez la hiérarchie et les managers assignés pour les employés intérimaires",                         Icon: UserCheck, color: "purple"  },
];

// ─── Component principal (Modal) ────────────────────────────────────────────
export default function HierarchyManagement({ open, onClose, inline, onLeaveTypes }: { open: boolean; onClose: () => void; inline?: boolean; onLeaveTypes?: () => void }) {
  const [activeSection, setActiveSection] = useState<HierarchySection | null>(null);

  if (!inline && !open) return null;

  const goBack = () => setActiveSection(null);
  const handleClose = () => { setActiveSection(null); onClose(); };

  return (
    <div
      className={inline ? "contents" : "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"}
      onClick={inline ? undefined : handleClose}
    >
      <div className={inline
        ? "flex flex-col w-full h-full bg-white overflow-hidden"
        : `bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col ${
            activeSection === "orgchart" ? "mx-2" : activeSection ? "max-w-5xl mx-4" : "max-w-lg mx-4"
          }`
      }
        style={inline ? undefined : {
          maxHeight: activeSection === "orgchart" ? "97vh" : "90vh",
          width: activeSection === "orgchart" ? "calc(100vw - 16px)" : undefined
        }}
        onClick={inline ? undefined : (e => e.stopPropagation())}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {activeSection && (
              <button onClick={goBack}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="font-black text-gray-900 text-lg">
                {activeSection ? SECTIONS.find(s => s.id === activeSection)?.label : "Hiérarchie"}
              </h2>
              {!activeSection && (
                <p className="text-xs text-gray-400 mt-0.5">Choisissez une section pour gérer la structure organisationnelle</p>
              )}
            </div>
          </div>
          {onLeaveTypes && (
            <button onClick={onLeaveTypes}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-camublue-300 text-sm font-semibold transition mr-1">
              <Settings2 size={15} />
              <span className="hidden sm:inline">Types de congés</span>
            </button>
          )}
          <button onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className={`overflow-y-auto flex-1 ${activeSection === "orgchart" ? "p-3" : "p-6"}`}>
          {!activeSection ? (
            /* ── Section Picker ──────────────────────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SECTIONS.map(({ id, label, description, Icon, color }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] hover:shadow-lg ${
                    color === "blue"    ? "border-blue-200 hover:border-blue-400 hover:bg-blue-50" :
                    color === "emerald" ? "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50" :
                                          "border-purple-200 hover:border-purple-400 hover:bg-purple-50"
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                    color === "blue"    ? "bg-blue-100 text-blue-600" :
                    color === "emerald" ? "bg-emerald-100 text-emerald-600" :
                                          "bg-purple-100 text-purple-600"
                  }`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="font-bold text-gray-800 text-base mb-2">{label}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
                </button>
              ))}
            </div>
          ) : (
            /* ── Active Section Content ──────────────────────────────────── */
            <>
              {activeSection === "orgchart"     && <OrgChartTab />}
              {activeSection === "employees"    && <EmployeesHierarchyTab filterContractTypes={["CDI","CDD","STAGE"]} />}
              {activeSection === "interimaires" && <EmployeesHierarchyTab filterContractTypes={["INTERIM"]} />}
            </>
          )}
        </div>
      </div>
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
  const [showEmployees, setShowEmployees] = useState(false);
  const [editingEmp,   setEditingEmp]   = useState<EmployeeHierarchy | null>(null);
  const [editForm,     setEditForm]     = useState<{
    n1_manager_id: number | null;
    n2_manager_id: number | null;
    requires_two_approvals: boolean;
    service: string;
  }>({ n1_manager_id: null, n2_manager_id: null, requires_two_approvals: false, service: "" });
  const [saving, setSaving] = useState(false);

  // Dept en cours d'édition (depuis l'orgchart) — null = création
  const [editingDept,   setEditingDept]   = useState<Department | null>(null);
  const [showDeptForm,  setShowDeptForm]  = useState(false);
  const [deptForm,      setDeptForm]      = useState<{
    name: string; code: string; description: string; parent_id: number | null; head_id: number | null; dg_validator_id: number | null;
  }>({ name: "", code: "", description: "", parent_id: null, head_id: null, dg_validator_id: null });
  const [savingDept, setSavingDept] = useState(false);
  const [deletingDept, setDeletingDept] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [zoom, setZoom] = useState(1.0);

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

  // Clé spéciale pour afficher les responsables de depts racines au niveau DG
  const DG_LEVEL_KEY = "__DG_LEVEL__";

  // Regrouper les employés par département selon la règle hiérarchique :
  // Un responsable de département appartient VISUELLEMENT au département PARENT, pas au sien.
  // Exemple : Manager NOC → affiché dans ESCO (parent de NOC)
  //           Manager ESCO → affiché au niveau Direction Générale
  const empsByDept = useMemo(() => {
    const headToVisualDept = new Map<number, string>();
    departments.forEach(d => {
      if (d.head) {
        if (d.parent) {
          const parentDept = departments.find(p => p.id === d.parent);
          headToVisualDept.set(d.head, parentDept?.name ?? "");
        } else {
          headToVisualDept.set(d.head, DG_LEVEL_KEY);
        }
      }
    });

    const map: Record<string, EmployeeHierarchy[]> = {};
    employees.forEach(emp => {
      const overrideKey = headToVisualDept.get(emp.id);
      const key = overrideKey !== undefined ? overrideKey : (emp.service ?? "");
      if (!map[key]) map[key] = [];
      map[key].push(emp);
    });
    return map;
  }, [employees, departments]);

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
      toast.success("Hiérarchie mise à jour — profils et congés synchronisés automatiquement ✓", { duration: 3500 });
      setEditingEmp(null);
      load();
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const openCreateDept = () => {
    setEditingDept(null);
    setDeptForm({ name: "", code: "", description: "", parent_id: null, head_id: null, dg_validator_id: null });
    setShowDeptForm(true);
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
    setShowDeptForm(true);
  };

  const handleSaveDept = async () => {
    if (!deptForm.name || !deptForm.code) {
      toast.error("Nom et code obligatoires.");
      return;
    }
    setSavingDept(true);
    try {
      if (editingDept) {
        const headChanged = editingDept.head !== deptForm.head_id;
        await departmentService.update(editingDept.id, deptForm);
        // Si le responsable a changé, forcer la synchronisation de tous les employés du département
        if (headChanged) {
          await employeeHierarchyService.syncAll();
          toast.success("Département mis à jour — managers des employés synchronisés ✓", { duration: 4000 });
        } else {
          toast.success("Département mis à jour ✓", { duration: 2500 });
        }
      } else {
        const created = await departmentService.create(deptForm);
        setShowDeptForm(false);
        setEditingDept(null);
        load();
        openBulkAssign(created);
        toast.success("Département créé — sélectionnez maintenant les membres ✓", { duration: 3500 });
        return;
      }
      setShowDeptForm(false);
      setEditingDept(null);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { name?: string[]; code?: string[] } } })?.response?.data;
      if (msg?.code) toast.error("Code déjà utilisé.");
      else toast.error("Erreur lors de la sauvegarde du département.");
    } finally {
      setSavingDept(false);
    }
  };

  const handleDeleteDept = async (id: number) => {
    setDeletingDept(id);
    try {
      await departmentService.delete(id);
      toast.success("Département supprimé ✓");
      load();
    } catch {
      toast.error("Impossible de supprimer ce département.");
    } finally {
      setDeletingDept(null);
    }
  };

  // ── Synchronisation hiérarchie → employés ──────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    const toastId = toast.loading("Synchronisation en cours — mise à jour des managers…");
    try {
      const result = await employeeHierarchyService.syncAll();
      toast.success(
        `Synchronisation terminée — ${result.employees_synced} employé(s) mis à jour`,
        { id: toastId, duration: 4000 }
      );
      load();
    } catch {
      toast.error("Erreur lors de la synchronisation.", { id: toastId });
    } finally {
      setSyncing(false);
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
      if (changed > 0) {
        // Synchroniser la hiérarchie pour que les managers soient auto-assignés aux nouveaux membres
        await employeeHierarchyService.syncAll();
        toast.success(`${changed} employé(s) mis à jour — managers synchronisés ✓`, { duration: 4000 });
      } else {
        toast.success("Aucun changement.");
      }
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
    <div className="space-y-4">

      {/* ── Toolbar : Actions + Toggle employés ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border-2 border-indigo-400 bg-indigo-100 inline-block" />DG</div>
          <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border-2 border-amber-400 bg-amber-50 inline-block" />Dept. parent</div>
          <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border-2 border-teal-400 bg-teal-50 inline-block" />Sous-dept.</div>
          <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border-2 border-emerald-400 bg-emerald-50 inline-block" />Dept. simple</div>
          {showEmployees && <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border-2 border-blue-300 bg-blue-50 inline-block" />Employés</div>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEmployees(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition ${
              showEmployees
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
            title={showEmployees ? "Masquer les employés" : "Afficher les employés"}
          >
            {showEmployees ? <Eye size={14} /> : <EyeOff size={14} />}
            {showEmployees ? "Employés visibles" : "Employés masqués"}
          </button>
          <button onClick={openCreateDept}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition">
            <Plus size={14} /> Nouveau département
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
            title="Synchroniser la hiérarchie vers les employés — met à jour les managers automatiquement"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {syncing ? "Sync…" : "Synchroniser"}
          </button>
          {/* Zoom controls */}
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <button onClick={() => setZoom(z => Math.max(+(z - 0.1).toFixed(1), 0.3))}
              className="px-2.5 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 transition" title="Dézoomer">−</button>
            <span className="px-2 text-xs font-semibold text-gray-600 min-w-[42px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(+(z + 0.1).toFixed(1), 2.0))}
              className="px-2.5 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 transition" title="Zoomer">+</button>
            <button onClick={() => setZoom(1.0)}
              className="px-2.5 py-2 text-xs text-gray-400 hover:bg-gray-100 transition border-l border-gray-200" title="Réinitialiser le zoom">↺</button>
          </div>
        </div>
      </div>

      {/* ── Org chart avec zoom/dézoom ──────────────────────────────────────────── */}
      <div className="overflow-auto rounded-xl border border-gray-100 bg-gray-50/30 p-2" style={{ minHeight: 240 }}>
        <div style={{ zoom: zoom, transition: "zoom 0.15s ease" }}>

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

        {/* Responsables de depts racines affichés au niveau DG */}
        {showEmployees && (empsByDept[DG_LEVEL_KEY] ?? []).length > 0 && (
          <>
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-indigo-400" />
              <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-indigo-400" />
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-2 py-1.5 min-w-[180px] max-w-[260px]">
              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1 px-1">Resp. principaux</p>
              {(empsByDept[DG_LEVEL_KEY] ?? []).map(emp => (
                <button key={emp.id} onClick={() => openEditEmp(emp)}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-indigo-100 transition text-left">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[8px] font-black flex-shrink-0">
                    {emp.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-indigo-900 truncate">{emp.full_name}</p>
                    <p className="text-[9px] text-indigo-500 truncate">{emp.fonction ?? "—"}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Connecteur vertical vers départements */}
        {departments.length > 0 && (
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-8 bg-indigo-400" />
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-indigo-400" />
          </div>
        )}
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
            <p className="text-center text-xs text-gray-400 italic -mt-4">Niveau Managers — validés directement par le DG</p>
            <div className="overflow-x-auto pb-2">
              <div className="flex justify-start min-w-max px-2">
                {rootDepts.map((dept, idx) => (
                  <DeptColumn
                    key={dept.id}
                    dept={dept}
                    employees={empsByDept[dept.name] ?? []}
                    subDepartments={childDeptMap[dept.id] ?? []}
                    empsByDept={empsByDept}
                    onEditEmployee={openEditEmp}
                    onEditDept={openEditDept}
                    onDeleteDept={handleDeleteDept}
                    deletingDept={deletingDept}
                    onBulkAssign={openBulkAssign}
                    showEmployees={showEmployees}
                    treePosition={{ isFirst: idx === 0, isLast: idx === rootDepts.length - 1, isOnly: rootDepts.length === 1 }}
                  />
                ))}
              </div>
            </div>

            {/* Sous-départements orphelins (parent supprimé) */}
            {departments.filter(d => d.parent && !departments.find(p => p.id === d.parent)).length > 0 && (
              <div className="overflow-x-auto pb-2 mt-4">
                <div className="flex gap-6 justify-start min-w-max px-2">
                  {departments.filter(d => d.parent && !departments.find(p => p.id === d.parent)).map(dept => (
                    <DeptColumn
                      key={dept.id}
                      dept={dept}
                      employees={empsByDept[dept.name] ?? []}
                      subDepartments={[]}
                      empsByDept={empsByDept}
                      onEditEmployee={openEditEmp}
                      onEditDept={openEditDept}
                      onDeleteDept={handleDeleteDept}
                      deletingDept={deletingDept}
                      onBulkAssign={openBulkAssign}
                      showEmployees={showEmployees}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {departments.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Building2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm italic">Aucun département configuré.</p>
          <button onClick={openCreateDept}
            className="mt-3 flex items-center gap-1.5 mx-auto px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition font-semibold">
            <Plus size={14} /> Créer un département
          </button>
        </div>
      )}

      {/* ── Employés sans département ─────────────────────────────────────────── */}
      {showEmployees && unassigned.length > 0 && (
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

        </div>{/* end zoom inner */}
      </div>{/* end zoom container */}

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
              <FormField label="Manager N+2 (sous-département uniquement)">
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
                <p className="text-[10px] text-gray-400 mt-1">
                  Requis uniquement pour les employés dans un sous-département (ex : BACK OFFICE, NOC).
                  Les employés directement sous un département racine (ex : Support IT) n'ont besoin que du N+1.
                </p>
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
                  <p className="text-xs text-gray-400">N+1 et N+2 doivent tous deux approuver — uniquement pour les sous-départements</p>
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

      {/* ── Modal : création/édition département ─────────────────────────────── */}
      {showDeptForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => { setShowDeptForm(false); setEditingDept(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{editingDept ? "Modifier le département" : "Nouveau département"}</h3>
              <button onClick={() => { setShowDeptForm(false); setEditingDept(null); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Nom *">
                <input value={deptForm.name}
                  onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="ex : Ressources Humaines" />
              </FormField>
              <FormField label="Code *">
                <input value={deptForm.code}
                  onChange={e => setDeptForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="ex : RH" />
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
                <EmployeeSelect
                  employees={activeEmps.filter(e =>
                    // Exclure les employés déjà responsables d'un AUTRE département
                    !departments.some(d => d.head === e.id && d.id !== (editingDept?.id ?? -1))
                  )}
                  value={deptForm.head_id ?? null}
                  onChange={v => setDeptForm(f => ({ ...f, head_id: v }))}
                  placeholder="Chef de département..." />
                {deptForm.head_id !== null && departments.some(d => d.head === deptForm.head_id && d.id !== (editingDept?.id ?? -1)) && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> Cet employé est déjà responsable d&apos;un autre département.
                  </p>
                )}
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
                  rows={2}
                  placeholder="Description optionnelle..." />
              </FormField>
            </div>
            <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => { setShowDeptForm(false); setEditingDept(null); }}
                className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-100 font-medium transition">
                Annuler
              </button>
              <button onClick={handleSaveDept} disabled={savingDept}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-60 font-bold transition">
                {savingDept ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editingDept ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : assignation en masse des membres ─────────────────────────── */}
      {bulkDept && (() => {
        const q = bulkSearch.trim().toLowerCase();

        // Tous les employés actifs — la RH sélectionne manuellement qui appartient au département
        const allActive = allEmployees.filter(e => e.status === "ACTIVE");

        const visibleEmps = q
          ? allActive.filter(e =>
              `${e.nom} ${e.prenom}`.toLowerCase().includes(q) ||
              (e.matricule ?? "").toLowerCase().includes(q) ||
              (e.service ?? "").toLowerCase().includes(q)
            )
          : allActive;
        const allChecked  = visibleEmps.length > 0 && visibleEmps.every(e => bulkSelected.has(e.id));
        const someChecked = visibleEmps.some(e => bulkSelected.has(e.id));

        // Employés sélectionnés avec leurs détails
        const selectedEmpsDetail = allActive.filter(e => bulkSelected.has(e.id));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setBulkDept(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <div>
                  <h3 className="font-bold text-gray-800">Membres du département</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="font-semibold text-emerald-700">{bulkDept.name}</span>
                    {" · "}Sélectionnés en haut, liste complète en bas
                  </p>
                </div>
                <button onClick={() => setBulkDept(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                  <X size={16} />
                </button>
              </div>

              {/* Employés sélectionnés (chips) */}
              {bulkSelected.size > 0 && (
              <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex flex-wrap gap-2">
                  {selectedEmpsDetail.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => setBulkSelected(prev => {
                        const next = new Set(prev);
                        next.delete(emp.id);
                        return next;
                      })}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-100 rounded-full border border-emerald-400 hover:bg-emerald-200 transition text-xs font-medium text-emerald-800"
                      title="Cliquer pour retirer"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-black">
                        {`${emp.nom} ${emp.prenom}`.slice(0, 2).toUpperCase()}
                      </div>
                      <span>{emp.nom} {emp.prenom}</span>
                      <X size={12} className="opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Barre de recherche + Tout/Aucun */}
              <div className="px-6 py-2 border-b border-gray-100 flex-shrink-0 space-y-2">
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
                </div>
              </div>

              {/* Liste scrollable */}
              <div className="overflow-y-auto flex-1 px-4 py-2">
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
  dept, employees, subDepartments, empsByDept, onEditEmployee, onEditDept, onDeleteDept, deletingDept, onBulkAssign, showEmployees, treePosition,
}: {
  dept: Department;
  employees: EmployeeHierarchy[];
  subDepartments: Department[];
  empsByDept: Record<string, EmployeeHierarchy[]>;
  onEditEmployee: (emp: EmployeeHierarchy) => void;
  onEditDept: (dept: Department) => void;
  onDeleteDept: (id: number) => void;
  deletingDept: number | null;
  onBulkAssign: (dept: Department) => void;
  showEmployees: boolean;
  treePosition?: { isFirst: boolean; isLast: boolean; isOnly: boolean };
}) {
  const [expanded, setExpanded] = useState(true);
  const hasSubDepts = subDepartments.length > 0;

  return (
    <div className="flex flex-col items-center relative px-4">
      {/* Barre horizontale en T reliant les départements frères */}
      {treePosition && !treePosition.isOnly && (
        <div className={`absolute top-0 h-0.5 bg-indigo-300 ${
          treePosition.isFirst ? "left-1/2 right-0" :
          treePosition.isLast  ? "left-0 right-1/2" :
          "inset-x-0"
        }`} />
      )}
      {/* Connecteur vertical + flèche vers le bas */}
      <div className="w-0.5 h-8 bg-indigo-400 relative z-10" />
      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-indigo-400" />

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
          <p className={`text-[10px] mt-1 ${hasSubDepts ? "text-amber-500" : "text-emerald-500"}`}>
            {hasSubDepts ? (
              <>
                <span className="font-semibold">{dept.employee_count}</span> employé(s) au total
                {(dept.children || []).length > 0 && (
                  <span className="opacity-70 ml-1">
                    ({(dept.children || []).reduce((sum, c) => sum + (c.employee_count || 0), 0)} dans sous-depts)
                  </span>
                )}
              </>
            ) : (
              <>{dept.employee_count} employé(s)</>
            )}
          </p>
        </button>

        {/* Boutons : Membres / Supprimer / Toggle */}
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
            onClick={() => onDeleteDept(dept.id)}
            disabled={deletingDept === dept.id}
            className={`px-2 py-2 transition border-l ${
              hasSubDepts
                ? "bg-amber-100 hover:bg-red-100 text-red-400 border-amber-200"
                : "bg-emerald-100 hover:bg-red-100 text-red-400 border-emerald-200"
            } disabled:opacity-50`}
            title="Supprimer le département"
          >
            {deletingDept === dept.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
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
              <div className="w-0.5 h-4 bg-amber-400" />
              <div className="flex">
                {subDepartments.map((subDept, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === subDepartments.length - 1;
                  const isOnly = subDepartments.length === 1;
                  return (
                    <div key={subDept.id} className="flex flex-col items-center px-3 relative">
                      {/* Barre horizontale en T entre sous-départements */}
                      {!isOnly && (
                        <div
                          className={`absolute top-0 h-0.5 bg-amber-400 ${
                            isFirst ? "left-1/2 right-0" :
                            isLast  ? "left-0 right-1/2" :
                            "inset-x-0"
                          }`}
                        />
                      )}
                      {/* Connecteur vertical + flèche */}
                      <div className="w-0.5 h-4 bg-amber-400 relative z-10" />
                      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-amber-400" />
                      {/* Carte sous-département */}
                      <SubDeptCard
                        dept={subDept}
                        employees={empsByDept[subDept.name] ?? []}
                        onEditEmployee={onEditEmployee}
                        onEditDept={onEditDept}
                        onDeleteDept={onDeleteDept}
                        deletingDept={deletingDept}
                        onBulkAssign={onBulkAssign}
                        showEmployees={showEmployees}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Employés directs du département parent (s'il y en a) */}
              {showEmployees && employees.length > 0 && (
                <>
                  <div className="flex flex-col items-center">
                    <div className="w-0.5 h-4 bg-emerald-400" />
                    <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-emerald-400" />
                  </div>
                  <EmployeeList employees={employees} onEditEmployee={onEditEmployee} />
                </>
              )}
            </>
          ) : (
            showEmployees && (
              <>
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-emerald-400" />
                  <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-emerald-400" />
                </div>
                <EmployeeList employees={employees} onEditEmployee={onEditEmployee} />
              </>
            )
          )}
        </>
      )}
    </div>
  );
}

// ── SubDeptCard : carte sous-département dans l'organigramme ──────────────────
function SubDeptCard({
  dept, employees, onEditEmployee, onEditDept, onDeleteDept, deletingDept, onBulkAssign, showEmployees,
}: {
  dept: Department;
  employees: EmployeeHierarchy[];
  onEditEmployee: (emp: EmployeeHierarchy) => void;
  onEditDept: (dept: Department) => void;
  onDeleteDept: (id: number) => void;
  deletingDept: number | null;
  onBulkAssign: (dept: Department) => void;
  showEmployees: boolean;
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
          <p className="text-[10px] text-teal-500 mt-0.5">{dept.employee_count} employé(s)</p>
        </button>
        <div className="flex border-t border-teal-200">
          <button
            onClick={() => onBulkAssign(dept)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-teal-100 hover:bg-teal-600 hover:text-white text-[10px] font-semibold text-teal-700 transition"
          >
            <UserCheck size={10} /> Membres
          </button>
          <button
            onClick={() => onDeleteDept(dept.id)}
            disabled={deletingDept === dept.id}
            className="px-2 py-1.5 bg-teal-100 hover:bg-red-100 text-red-400 border-l border-teal-200 transition disabled:opacity-50"
            title="Supprimer"
          >
            {deletingDept === dept.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="px-2 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-600 border-l border-teal-200 transition"
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
      </div>

      {expanded && showEmployees && (
        <>
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-3 bg-teal-400" />
            <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-teal-400" />
          </div>
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
// Onglet Hiérarchie employés
// ─────────────────────────────────────────────────────────────────────────────
function EmployeesHierarchyTab({ filterContractTypes }: { filterContractTypes?: string[] }) {
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
  const [syncing, setSyncing] = useState(false);

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

  // Filtrer par type de contrat si spécifié
  const displayEmployees = useMemo(() => {
    if (!filterContractTypes || filterContractTypes.length === 0) return employees;
    const validIds = new Set(
      allEmployees.filter(e => filterContractTypes.includes(e.type_contrat ?? "")).map(e => e.id)
    );
    return employees.filter(e => validIds.has(e.id));
  }, [employees, allEmployees, filterContractTypes]);

  const filtered = displayEmployees.filter(e => {
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
      toast.success("Hiérarchie mise à jour — profils et congés synchronisés automatiquement ✓", { duration: 3500 });
      setEditingId(null);
      load();
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const activeEmployees = allEmployees.filter(e => e.status === "ACTIVE");

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await employeeHierarchyService.syncAll();
      toast.success(`Synchronisation terminée : ${result.employees_synced} employés, ${result.users_checked} profils vérifiés ✓`, { duration: 4000 });
      load();
    } catch {
      toast.error("Erreur lors de la synchronisation.");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const isInterim = filterContractTypes?.includes("INTERIM");

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${isInterim ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          {isInterim
            ? <>Hiérarchie des <strong>intérimaires</strong>. Consultez et modifiez les managers N+1/N+2 assignés aux employés intérimaires.</>
            : <>La hiérarchie est le <strong>point d'entrée unique</strong>. Tout changement ici se répercute automatiquement sur les profils utilisateurs (rôle Manager), les champs employé (manager, email) et les validations de congés.</>
          }
        </span>
      </div>

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
        <button onClick={handleSyncAll} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition"
          title="Synchroniser toute la hiérarchie → employés → profils">
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {syncing ? "Sync…" : "Sync tout"}
        </button>
        <button onClick={load} className="p-2 border rounded-lg hover:bg-gray-50">
          <RefreshCw size={14} />
        </button>
      </div>

      <p className="text-sm text-gray-500">{filtered.length} / {displayEmployees.length} employé(s){filterContractTypes ? ` (${filterContractTypes.join(", ")})` : ""}</p>

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
