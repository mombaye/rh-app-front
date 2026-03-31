import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/layouts/AppLayout';
import api from '@/api/axios';
import toast from 'react-hot-toast';
import {
  Plus,
  Building2,
  Users,
  Pencil,
  Trash2,
  X,
  GitBranch,
  UserCog,
} from 'lucide-react';
import type {
  Department,
  DepartmentMember,
  DepartmentTree,
  MemberRole,
} from '@/types/hierarchy';
import type { Employee } from '@/types/employee';

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<
  MemberRole,
  { label: string; color: string; bg: string; border: string }
> = {
  CHEF: {
    label: 'Chef de département',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  RESPONSABLE: {
    label: 'Responsable',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
  },
  SOUS_RESPONSABLE: {
    label: 'Sous-responsable',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  EMPLOYE: {
    label: 'Employé',
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
  },
};

const HIERARCHY_LABELS: Record<string, { label: string; badge: string }> = {
  FLAT: { label: 'Structure plate', badge: 'bg-blue-100 text-blue-700' },
  WITH_RESPONSABLES: {
    label: 'Avec responsables',
    badge: 'bg-teal-100 text-teal-700',
  },
  FULL: {
    label: 'Hiérarchie complète',
    badge: 'bg-purple-100 text-purple-700',
  },
};

// ── Helper ────────────────────────────────────────────────────────────────────
function flattenTree(nodes: DepartmentMember[]): DepartmentMember[] {
  const result: DepartmentMember[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.direct_reports?.length) {
      result.push(...flattenTree(node.direct_reports));
    }
  }
  return result;
}

// ── Tree node ─────────────────────────────────────────────────────────────────
function NodeCard({
  member,
  onEdit,
  onDelete,
}: {
  member: DepartmentMember;
  onEdit: (m: DepartmentMember) => void;
  onDelete: (id: number) => void;
}) {
  const cfg = ROLE_CONFIG[member.role];
  const emp = member.employee_detail;
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${cfg.bg} ${cfg.border} group min-w-[180px]`}
    >
      <div className="min-w-0">
        <p className={`font-semibold text-sm truncate ${cfg.color}`}>
          {emp.prenom} {emp.nom}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {emp.fonction} · {cfg.label}
        </p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
        <button
          onClick={() => onEdit(member)}
          className="p-1 rounded hover:bg-white/70 text-gray-400 hover:text-blue-600"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(member.id)}
          className="p-1 rounded hover:bg-white/70 text-gray-400 hover:text-red-600"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function TreeNode({
  member,
  onEdit,
  onDelete,
  depth = 0,
}: {
  member: DepartmentMember;
  onEdit: (m: DepartmentMember) => void;
  onDelete: (id: number) => void;
  depth?: number;
}) {
  const hasChildren =
    member.direct_reports && member.direct_reports.length > 0;

  return (
    <div className={depth > 0 ? 'ml-8 mt-3' : 'mt-3'}>
      {depth > 0 ? (
        <div className="flex items-start">
          <div className="w-6 border-l-2 border-b-2 border-gray-200 h-5 mr-2 mt-1 rounded-bl-sm shrink-0" />
          <NodeCard member={member} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ) : (
        <NodeCard member={member} onEdit={onEdit} onDelete={onDelete} />
      )}

      {hasChildren && (
        <div className={`${depth > 0 ? 'ml-14' : 'ml-8'} border-l-2 border-gray-200`}>
          {member.direct_reports.map((child) => (
            <TreeNode
              key={child.id}
              member={child}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Department modal ──────────────────────────────────────────────────────────
function DeptModal({
  dept,
  employees,
  onClose,
  onSaved,
}: {
  dept: Department | null;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nom: dept?.nom ?? '',
    code: dept?.code ?? '',
    description: dept?.description ?? '',
    hierarchy_type: dept?.hierarchy_type ?? 'FLAT',
    chef: dept?.chef ? String(dept.chef) : '',
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        nom: form.nom,
        code: form.code || null,
        description: form.description || null,
        hierarchy_type: form.hierarchy_type,
        chef: form.chef ? Number(form.chef) : null,
      };
      if (dept) {
        await api.patch(`/api/hierarchy/departments/${dept.id}/`, payload);
        toast.success('Département mis à jour');
      } else {
        await api.post('/api/hierarchy/departments/', payload);
        toast.success('Département créé');
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">
            {dept ? 'Modifier le département' : 'Nouveau département'}
          </h2>
          <button onClick={onClose}>
            <X size={20} className="text-gray-400 hover:text-gray-700" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom *
            </label>
            <input
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              value={form.nom}
              onChange={(e) => set('nom', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              placeholder="ex: DEPT-A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de hiérarchie *
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              value={form.hierarchy_type}
              onChange={(e) => set('hierarchy_type', e.target.value)}
            >
              <option value="FLAT">
                Structure plate — Chef → Employés directement
              </option>
              <option value="WITH_RESPONSABLES">
                Avec responsables — Chef → Responsables → Employés
              </option>
              <option value="FULL">
                Hiérarchie complète — Chef → Responsable → Sous-resp. → Employés
              </option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chef de département
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              value={form.chef}
              onChange={(e) => set('chef', e.target.value)}
            >
              <option value="">— Sélectionner un employé —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.nom} {emp.prenom} · {emp.fonction}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-camublue-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-camublue-900/90 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : dept ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Member modal ──────────────────────────────────────────────────────────────
function MemberModal({
  member,
  deptId,
  deptTree,
  employees,
  onClose,
  onSaved,
}: {
  member: DepartmentMember | null;
  deptId: number;
  deptTree: DepartmentTree | null;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    employee: member ? String(member.employee) : '',
    role: (member?.role ?? 'EMPLOYE') as MemberRole,
    parent: member?.parent ? String(member.parent) : '',
  });
  const [loading, setLoading] = useState(false);

  const flatMembers = deptTree ? flattenTree(deptTree.tree) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        department: deptId,
        employee: Number(form.employee),
        role: form.role,
        parent: form.parent ? Number(form.parent) : null,
      };
      if (member) {
        await api.patch(`/api/hierarchy/members/${member.id}/`, payload);
        toast.success('Membre mis à jour');
      } else {
        await api.post('/api/hierarchy/members/', payload);
        toast.success('Membre ajouté');
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">
            {member ? 'Modifier le membre' : 'Ajouter un membre'}
          </h2>
          <button onClick={onClose}>
            <X size={20} className="text-gray-400 hover:text-gray-700" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employé *
            </label>
            <select
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              value={form.employee}
              onChange={(e) => setForm({ ...form, employee: e.target.value })}
              disabled={!!member}
            >
              <option value="">— Sélectionner un employé —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.nom} {emp.prenom} · {emp.fonction}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rôle *
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as MemberRole })
              }
            >
              <option value="CHEF">Chef de département</option>
              <option value="RESPONSABLE">Responsable</option>
              <option value="SOUS_RESPONSABLE">Sous-responsable</option>
              <option value="EMPLOYE">Employé</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rattaché à (supérieur direct)
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
              value={form.parent}
              onChange={(e) => setForm({ ...form, parent: e.target.value })}
            >
              <option value="">— Aucun (niveau racine) —</option>
              {flatMembers
                .filter((m) => m.id !== member?.id)
                .map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.employee_detail.prenom} {m.employee_detail.nom} ·{' '}
                    {ROLE_CONFIG[m.role].label}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-camublue-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-camublue-900/90 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : member ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HierarchyPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [deptTree, setDeptTree] = useState<DepartmentTree | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<DepartmentMember | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get<Department[]>('/api/hierarchy/departments/');
      setDepartments(res.data);
    } catch {
      toast.error('Impossible de charger les départements');
    } finally {
      setLoadingDepts(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/api/employees/');
      const raw = res.data;
      const list: Employee[] = Array.isArray(raw)
        ? raw
        : (raw as { results?: Employee[] }).results ?? [];
      setEmployees(list.filter((e) => e.status === 'ACTIVE'));
    } catch {
      // silent
    }
  }, []);

  const fetchTree = useCallback(async (deptId: number) => {
    setLoadingTree(true);
    try {
      const res = await api.get<DepartmentTree>(
        `/api/hierarchy/departments/${deptId}/tree/`
      );
      setDeptTree(res.data);
    } catch {
      toast.error('Impossible de charger la hiérarchie');
    } finally {
      setLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, [fetchDepartments, fetchEmployees]);

  useEffect(() => {
    if (selectedDeptId) {
      fetchTree(selectedDeptId);
    } else {
      setDeptTree(null);
    }
  }, [selectedDeptId, fetchTree]);

  const selectedDept =
    departments.find((d) => d.id === selectedDeptId) ?? null;

  const handleDeleteDept = async (id: number) => {
    if (!confirm('Supprimer ce département ? Cette action est irréversible.')) return;
    try {
      await api.delete(`/api/hierarchy/departments/${id}/`);
      toast.success('Département supprimé');
      if (selectedDeptId === id) setSelectedDeptId(null);
      fetchDepartments();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDeleteMember = async (memberId: number) => {
    if (!confirm('Retirer ce membre de la hiérarchie ?')) return;
    try {
      await api.delete(`/api/hierarchy/members/${memberId}/`);
      toast.success('Membre retiré');
      if (selectedDeptId) fetchTree(selectedDeptId);
      fetchDepartments();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Hiérarchie de l'entreprise
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configurez la structure organisationnelle par département
            </p>
          </div>
          <button
            onClick={() => {
              setEditingDept(null);
              setShowDeptModal(true);
            }}
            className="flex items-center gap-2 bg-camublue-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-camublue-900/90 transition"
          >
            <Plus size={16} />
            Nouveau département
          </button>
        </div>

        {/* Direction Générale banner */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl px-6 py-4 flex items-center gap-4">
          <div className="bg-violet-100 rounded-xl p-3">
            <Building2 size={24} className="text-violet-600" />
          </div>
          <div>
            <h2 className="font-bold text-violet-900">Direction Générale</h2>
            <p className="text-sm text-violet-600">
              Pilotage stratégique · {departments.length} département(s)
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex gap-6 items-start">
          {/* Department list */}
          <div className="w-72 shrink-0 space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Départements
            </h3>

            {loadingDepts ? (
              <p className="text-sm text-gray-400">Chargement...</p>
            ) : departments.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                Aucun département
              </div>
            ) : (
              departments.map((dept) => {
                const hCfg =
                  HIERARCHY_LABELS[dept.hierarchy_type] ?? HIERARCHY_LABELS.FLAT;
                const isSelected = dept.id === selectedDeptId;
                return (
                  <div
                    key={dept.id}
                    onClick={() =>
                      setSelectedDeptId(
                        dept.id === selectedDeptId ? null : dept.id
                      )
                    }
                    className={`rounded-xl border p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-camublue-900 bg-camublue-900/5 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-camublue-900/40 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`font-semibold text-sm truncate ${
                              isSelected
                                ? 'text-camublue-900'
                                : 'text-gray-800'
                            }`}
                          >
                            {dept.nom}
                          </h4>
                          {dept.code && (
                            <span className="text-xs text-gray-400 font-mono shrink-0">
                              {dept.code}
                            </span>
                          )}
                        </div>
                        {dept.chef_detail && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            Chef : {dept.chef_detail.prenom}{' '}
                            {dept.chef_detail.nom}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              hCfg.badge
                            }`}
                          >
                            {hCfg.label}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Users size={11} />
                            {dept.members_count}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDept(dept);
                            setShowDeptModal(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDept(dept.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tree panel */}
          <div className="flex-1 min-w-0">
            {!selectedDeptId ? (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
                <GitBranch size={40} className="mb-3 opacity-40" />
                <p className="text-sm">
                  Sélectionnez un département pour voir sa hiérarchie
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                {/* Panel header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">
                      {selectedDept?.nom}
                    </h3>
                    {selectedDept?.description && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {selectedDept.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setEditingMember(null);
                      setShowMemberModal(true);
                    }}
                    className="flex items-center gap-2 border border-camublue-900 text-camublue-900 px-3 py-2 rounded-lg text-sm font-medium hover:bg-camublue-900/5 transition"
                  >
                    <UserCog size={14} />
                    Ajouter un membre
                  </button>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-6 p-3 bg-gray-50 rounded-xl">
                  {(Object.keys(ROLE_CONFIG) as MemberRole[]).map((role) => {
                    const cfg = ROLE_CONFIG[role];
                    return (
                      <div key={role} className="flex items-center gap-1.5">
                        <div
                          className={`w-3 h-3 rounded border ${cfg.bg} ${cfg.border}`}
                        />
                        <span className="text-xs text-gray-600">{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Tree */}
                {loadingTree ? (
                  <p className="text-sm text-gray-400">Chargement...</p>
                ) : deptTree && deptTree.tree.length > 0 ? (
                  <div>
                    {deptTree.tree.map((node) => (
                      <TreeNode
                        key={node.id}
                        member={node}
                        onEdit={(m) => {
                          setEditingMember(m);
                          setShowMemberModal(true);
                        }}
                        onDelete={handleDeleteMember}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Users size={40} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Aucun membre dans ce département</p>
                    <p className="text-xs mt-1">
                      Cliquez sur "Ajouter un membre" pour commencer
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDeptModal && (
        <DeptModal
          dept={editingDept}
          employees={employees}
          onClose={() => {
            setShowDeptModal(false);
            setEditingDept(null);
          }}
          onSaved={() => {
            fetchDepartments();
            if (selectedDeptId) fetchTree(selectedDeptId);
          }}
        />
      )}
      {showMemberModal && selectedDeptId && (
        <MemberModal
          member={editingMember}
          deptId={selectedDeptId}
          deptTree={deptTree}
          employees={employees}
          onClose={() => {
            setShowMemberModal(false);
            setEditingMember(null);
          }}
          onSaved={() => {
            if (selectedDeptId) fetchTree(selectedDeptId);
            fetchDepartments();
          }}
        />
      )}
    </AppLayout>
  );
}
