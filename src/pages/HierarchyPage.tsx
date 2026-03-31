import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Plus,
  Trash2,
  Edit,
  UserPlus,
  Network,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentTree,
  addMember,
  removeMember,
} from "@/services/hierarchyService";
import { getEmployees } from "@/services/employeeService";
import type {
  Department,
  DepartmentTree as DeptTree,
  TreeNode,
  MemberRole,
  HierarchyType,
} from "@/types/hierarchy";
import type { Employee } from "@/types/employee";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<MemberRole, string> = {
  CHEF: "bg-purple-50 text-purple-800 border-purple-200",
  RESPONSABLE: "bg-blue-50 text-blue-800 border-blue-200",
  SOUS_RESPONSABLE: "bg-teal-50 text-teal-800 border-teal-200",
  EMPLOYE: "bg-gray-50 text-gray-700 border-gray-200",
};

const ROLE_LABELS: Record<MemberRole, string> = {
  CHEF: "Chef de d\u00e9partement",
  RESPONSABLE: "Responsable",
  SOUS_RESPONSABLE: "Sous-responsable",
  EMPLOYE: "Employ\u00e9",
};

const HIERARCHY_TYPE_LABELS: Record<string, string> = {
  FLAT: "Structure plate",
  WITH_MANAGERS: "Avec responsables",
  FULL: "Hi\u00e9rarchie compl\u00e8te",
};

const HIERARCHY_TYPE_COLORS: Record<string, string> = {
  FLAT: "bg-amber-100 text-amber-800",
  WITH_MANAGERS: "bg-blue-100 text-blue-800",
  FULL: "bg-green-100 text-green-800",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAllowedRoles(hierarchyType: string): MemberRole[] {
  if (hierarchyType === "FLAT") return ["CHEF", "EMPLOYE"];
  if (hierarchyType === "WITH_MANAGERS") return ["CHEF", "RESPONSABLE", "EMPLOYE"];
  return ["CHEF", "RESPONSABLE", "SOUS_RESPONSABLE", "EMPLOYE"];
}

function getChildRole(
  parentRole: MemberRole,
  allowedRoles: MemberRole[]
): MemberRole | null {
  if (parentRole === "CHEF")
    return allowedRoles.includes("RESPONSABLE") ? "RESPONSABLE" : "EMPLOYE";
  if (parentRole === "RESPONSABLE")
    return allowedRoles.includes("SOUS_RESPONSABLE") ? "SOUS_RESPONSABLE" : "EMPLOYE";
  if (parentRole === "SOUS_RESPONSABLE") return "EMPLOYE";
  return null;
}

function collectEmployeeIds(nodes: TreeNode[]): number[] {
  return nodes.flatMap((n) => [n.employee_id, ...collectEmployeeIds(n.children)]);
}

// ─── TreeNodeCard ─────────────────────────────────────────────────────────────

function TreeNodeCard({
  node,
  depth = 0,
  onRemove,
  onAddChild,
  allowedRoles,
}: {
  node: TreeNode;
  depth?: number;
  onRemove: (memberId: number) => void;
  onAddChild: (parentMemberId: number, role: MemberRole) => void;
  allowedRoles: MemberRole[];
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const childRole = getChildRole(node.role, allowedRoles);

  return (
    <div className={depth > 0 ? "ml-6 mt-2 relative" : "mt-2"}>
      {depth > 0 && (
        <>
          <span className="absolute left-[-12px] top-[18px] w-3 h-px bg-gray-300 block" />
          <span className="absolute left-[-12px] top-0 bottom-0 w-px bg-gray-200 block" />
        </>
      )}

      <div
        className={`flex items-start gap-2 p-3 rounded-xl border group transition-shadow hover:shadow-sm ${
          ROLE_COLORS[node.role]
        }`}
      >
        {/* expand toggle */}
        <div className="mt-0.5 w-4 shrink-0">
          {hasChildren && (
            <button onClick={() => setExpanded((v) => !v)} className="opacity-60 hover:opacity-100">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>

        {/* info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">
              {node.nom} {node.prenom}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full border font-medium opacity-80">
              {ROLE_LABELS[node.role]}
            </span>
          </div>
          <div className="text-xs opacity-60 mt-0.5">
            {node.fonction} &middot; {node.matricule}
          </div>
        </div>

        {/* actions (visible on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {childRole && node.role !== "EMPLOYE" && (
            <button
              onClick={() => onAddChild(node.id, childRole)}
              className="p-1.5 rounded-lg hover:bg-white/60"
              title={`Ajouter un ${ROLE_LABELS[childRole]}`}
            >
              <UserPlus size={13} />
            </button>
          )}
          <button
            onClick={() => onRemove(node.id)}
            className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"
            title="Retirer du d\u00e9partement"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* children */}
      {hasChildren && expanded && (
        <div className="relative">
          {node.children.map((child) => (
            <TreeNodeCard
              key={child.id}
              node={child}
              depth={depth + 1}
              onRemove={onRemove}
              onAddChild={onAddChild}
              allowedRoles={allowedRoles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HierarchyPage ────────────────────────────────────────────────────────────

export default function HierarchyPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<DeptTree | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);

  // Dept modal
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({
    nom: "",
    code: "",
    description: "",
    hierarchy_type: "FLAT" as HierarchyType,
  });

  // Member modal
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberForm, setMemberForm] = useState<{
    employee: string | number;
    role: MemberRole;
    parent: number | null;
  }>({
    employee: "",
    role: "CHEF",
    parent: null,
  });
  const [forcedRole, setForcedRole] = useState<MemberRole | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([getDepartments(), getEmployees({ status: "ACTIVE" })])
      .then(([depts, emps]) => {
        setDepartments(depts);
        setEmployees(emps);
      })
      .catch(() => toast.error("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  const loadTree = useCallback(async (deptId: number) => {
    setTreeLoading(true);
    try {
      const tree = await getDepartmentTree(deptId);
      setSelectedDept(tree);
    } catch {
      toast.error("Erreur de chargement de la hi\u00e9rarchie");
    } finally {
      setTreeLoading(false);
    }
  }, []);

  // ── Dept CRUD ─────────────────────────────────────────────────────────────

  const openCreateDept = () => {
    setEditingDept(null);
    setDeptForm({ nom: "", code: "", description: "", hierarchy_type: "FLAT" });
    setDeptModalOpen(true);
  };

  const openEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      nom: dept.nom,
      code: dept.code,
      description: dept.description,
      hierarchy_type: dept.hierarchy_type,
    });
    setDeptModalOpen(true);
  };

  const handleSaveDept = async () => {
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, deptForm);
        toast.success("D\u00e9partement modifi\u00e9");
      } else {
        await createDepartment(deptForm);
        toast.success("D\u00e9partement cr\u00e9\u00e9");
      }
      const depts = await getDepartments();
      setDepartments(depts);
      setDeptModalOpen(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.code?.[0] ||
        err?.response?.data?.nom?.[0] ||
        "Erreur lors de la sauvegarde";
      toast.error(msg);
    }
  };

  const handleDeleteDept = async (id: number) => {
    if (!confirm("Supprimer ce d\u00e9partement et tous ses membres ?")) return;
    try {
      await deleteDepartment(id);
      toast.success("D\u00e9partement supprim\u00e9");
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      if (selectedDept?.id === id) setSelectedDept(null);
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  // ── Member CRUD ───────────────────────────────────────────────────────────

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm("Retirer ce membre du d\u00e9partement ?")) return;
    try {
      await removeMember(memberId);
      toast.success("Membre retir\u00e9");
      if (selectedDept) loadTree(selectedDept.id);
    } catch {
      toast.error("Erreur lors du retrait");
    }
  };

  const handleAddChild = (parentMemberId: number, role: MemberRole) => {
    setForcedRole(role);
    setMemberForm({ employee: "", role, parent: parentMemberId });
    setMemberModalOpen(true);
  };

  const handleOpenAddRoot = () => {
    setForcedRole("CHEF");
    setMemberForm({ employee: "", role: "CHEF", parent: null });
    setMemberModalOpen(true);
  };

  const handleSaveMember = async () => {
    if (!selectedDept || !memberForm.employee) {
      toast.error("S\u00e9lectionnez un employ\u00e9");
      return;
    }
    try {
      await addMember({
        department: selectedDept.id,
        employee: Number(memberForm.employee),
        role: memberForm.role,
        parent: memberForm.parent,
      });
      toast.success("Membre ajout\u00e9");
      setMemberModalOpen(false);
      loadTree(selectedDept.id);
    } catch (err: any) {
      const msg =
        err?.response?.data?.non_field_errors?.[0] ||
        err?.response?.data?.employee?.[0] ||
        "Erreur lors de l'ajout";
      toast.error(msg);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const allowedRoles = selectedDept
    ? getAllowedRoles(selectedDept.hierarchy_type)
    : [];

  const assignedIds = new Set(
    selectedDept ? collectEmployeeIds(selectedDept.tree) : []
  );
  const availableEmployees = employees.filter((e) => !assignedIds.has(e.id));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-camublue-900 p-2.5 rounded-xl">
              <Network className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-camublue-900">Hi\u00e9rarchie</h1>
              <p className="text-sm text-gray-500">
                Structure organisationnelle de l'entreprise
              </p>
            </div>
          </div>
          <Button onClick={openCreateDept} className="gap-2">
            <Plus size={16} /> Nouveau d\u00e9partement
          </Button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Chargement...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Department list */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                D\u00e9partements ({departments.length})
              </p>

              {departments.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  Aucun d\u00e9partement.<br />Cliquez sur &laquo;&nbsp;Nouveau&nbsp;&raquo;.
                </div>
              )}

              {departments.map((dept) => (
                <div
                  key={dept.id}
                  onClick={() => loadTree(dept.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedDept?.id === dept.id
                      ? "border-camublue-900 bg-camublue-900/5 shadow"
                      : "border-gray-200 bg-white hover:border-camublue-900/40 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 size={15} className="text-camublue-900 shrink-0" />
                        <span className="font-semibold text-gray-800 text-sm truncate">
                          {dept.nom}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 ml-5">{dept.code}</div>
                      <div className="flex items-center gap-2 mt-2 ml-5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            HIERARCHY_TYPE_COLORS[dept.hierarchy_type]
                          }`}
                        >
                          {HIERARCHY_TYPE_LABELS[dept.hierarchy_type]}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Users size={10} /> {dept.members_count}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openEditDept(dept)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                        title="Modifier"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteDept(dept.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tree view */}
            <div className="md:col-span-2">
              {!selectedDept ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Network size={38} className="mb-3 opacity-20" />
                  S\u00e9lectionnez un d\u00e9partement pour voir sa hi\u00e9rarchie
                </div>
              ) : treeLoading ? (
                <div className="text-center text-gray-400 py-20">Chargement...</div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  {/* Tree header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-camublue-900">
                        {selectedDept.nom}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            HIERARCHY_TYPE_COLORS[selectedDept.hierarchy_type]
                          }`}
                        >
                          {selectedDept.hierarchy_type_display}
                        </span>
                        {selectedDept.description && (
                          <span className="text-xs text-gray-400">
                            {selectedDept.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={handleOpenAddRoot}
                    >
                      <UserPlus size={14} /> Ajouter
                    </Button>
                  </div>

                  {/* Role legend */}
                  <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-100">
                    {allowedRoles.map((role) => (
                      <span
                        key={role}
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          ROLE_COLORS[role]
                        }`}
                      >
                        {ROLE_LABELS[role]}
                      </span>
                    ))}
                  </div>

                  {/* Tree nodes */}
                  {selectedDept.tree.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      Aucun membre. Cliquez sur &laquo;&nbsp;Ajouter&nbsp;&raquo; pour commencer.
                    </div>
                  ) : (
                    <div>
                      {selectedDept.tree.map((node) => (
                        <TreeNodeCard
                          key={node.id}
                          node={node}
                          depth={0}
                          onRemove={handleRemoveMember}
                          onAddChild={handleAddChild}
                          allowedRoles={allowedRoles}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Department Modal ─────────────────────────────────────────────── */}
      <Dialog open={deptModalOpen} onOpenChange={setDeptModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept ? "Modifier le d\u00e9partement" : "Nouveau d\u00e9partement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={deptForm.nom}
                onChange={(e) => setDeptForm({ ...deptForm, nom: e.target.value })}
                placeholder="Ex\u00a0: D\u00e9partement Technique"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input
                value={deptForm.code}
                onChange={(e) =>
                  setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })
                }
                placeholder="Ex\u00a0: TECH"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optionnel)</Label>
              <Input
                value={deptForm.description}
                onChange={(e) =>
                  setDeptForm({ ...deptForm, description: e.target.value })
                }
                placeholder="Description du d\u00e9partement"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type de hi\u00e9rarchie</Label>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                value={deptForm.hierarchy_type}
                onChange={(e) =>
                  setDeptForm({
                    ...deptForm,
                    hierarchy_type: e.target.value as HierarchyType,
                  })
                }
              >
                <option value="FLAT">
                  Cas 1 \u2014 Structure plate (Chef \u2192 Employ\u00e9s)
                </option>
                <option value="WITH_MANAGERS">
                  Cas 2 \u2014 Avec responsables (Chef \u2192 Responsables \u2192 Employ\u00e9s)
                </option>
                <option value="FULL">
                  Cas 3 \u2014 Hi\u00e9rarchie compl\u00e8te (Chef \u2192 Responsable \u2192 Sous-resp. \u2192 Employ\u00e9s)
                </option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Chaque d\u00e9partement configure sa hi\u00e9rarchie ind\u00e9pendamment.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveDept}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Member Modal ─────────────────────────────────────────────── */}
      <Dialog open={memberModalOpen} onOpenChange={setMemberModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>R\u00f4le</Label>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                value={memberForm.role}
                disabled={!!forcedRole}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, role: e.target.value as MemberRole })
                }
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Employ\u00e9</Label>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                value={memberForm.employee}
                onChange={(e) =>
                  setMemberForm({ ...memberForm, employee: e.target.value })
                }
              >
                <option value="">S\u00e9lectionnez un employ\u00e9</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nom} {emp.prenom} ({emp.matricule})
                  </option>
                ))}
              </select>
              {availableEmployees.length === 0 && (
                <p className="text-xs text-amber-600">
                  Tous les employ\u00e9s actifs sont d\u00e9j\u00e0 assign\u00e9s \u00e0 ce d\u00e9partement.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveMember}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
