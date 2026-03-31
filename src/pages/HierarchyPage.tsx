import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  UserPlus,
  GitBranch,
  Crown,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentMembers,
  addMember,
  removeMember,
  getDepartmentOrgChart,
} from '@/services/hierarchyService';
import { getEmployees } from '@/services/employeeService';
import type {
  Department,
  DepartmentMember,
  HierarchyType,
  MemberRole,
  OrgChartNode,
  DepartmentOrgChart,
} from '@/types/hierarchy';
import { HIERARCHY_TYPE_LABELS, ROLE_LABELS, ROLE_COLORS } from '@/types/hierarchy';
import type { Employee } from '@/types/employee';

// ===================== Composants utilitaires =====================

function RoleIcon({ role }: { role: MemberRole }) {
  switch (role) {
    case 'CHEF':
      return <Crown size={16} />;
    case 'RESPONSABLE':
      return <Shield size={16} />;
    case 'SOUS_RESPONSABLE':
      return <ShieldCheck size={16} />;
    default:
      return <User size={16} />;
  }
}

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[role]}`}
    >
      <RoleIcon role={role} />
      {ROLE_LABELS[role]}
    </span>
  );
}

function HierarchyTypeBadge({ type }: { type: HierarchyType }) {
  const colors: Record<HierarchyType, string> = {
    FLAT: 'bg-yellow-100 text-yellow-800',
    WITH_RESPONSABLES: 'bg-blue-100 text-blue-800',
    COMPLETE: 'bg-purple-100 text-purple-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type]}`}>
      {HIERARCHY_TYPE_LABELS[type]}
    </span>
  );
}

// ===================== OrgChart Tree Node =====================

function OrgChartTreeNode({ node, depth = 0 }: { node: OrgChartNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />
        ) : (
          <span className="w-4" />
        )}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex flex-col">
            <span className="font-medium text-sm text-gray-900">{node.name}</span>
            <span className="text-xs text-gray-500">{node.fonction} - {node.matricule}</span>
          </div>
          <RoleBadge role={node.role} />
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <OrgChartTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== Modale Département =====================

function DepartmentFormModal({
  department,
  onClose,
  onSave,
}: {
  department: Department | null;
  onClose: () => void;
  onSave: (data: { name: string; description: string; hierarchy_type: HierarchyType }) => void;
}) {
  const [name, setName] = useState(department?.name || '');
  const [description, setDescription] = useState(department?.description || '');
  const [hierarchyType, setHierarchyType] = useState<HierarchyType>(
    department?.hierarchy_type || 'FLAT'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Le nom du d\u00e9partement est requis.');
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), hierarchy_type: hierarchyType });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          {department ? 'Modifier le d\u00e9partement' : 'Nouveau d\u00e9partement'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: D\u00e9partement Technique"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Description optionnelle..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de hi\u00e9rarchie
            </label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(HIERARCHY_TYPE_LABELS) as HierarchyType[]).map((ht) => (
                <label
                  key={ht}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    hierarchyType === ht
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="hierarchy_type"
                    value={ht}
                    checked={hierarchyType === ht}
                    onChange={() => setHierarchyType(ht)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">{HIERARCHY_TYPE_LABELS[ht]}</div>
                    <div className="text-xs text-gray-500">
                      {ht === 'FLAT' && 'Chef g\u00e8re directement les employ\u00e9s. Id\u00e9al petites \u00e9quipes (2-6 pers.).'}
                      {ht === 'WITH_RESPONSABLES' &&
                        'Chef \u2192 2 \u00e0 4 Responsables \u2192 Employ\u00e9s. \u00c9quipes de taille moyenne.'}
                      {ht === 'COMPLETE' &&
                        'Chef \u2192 Responsable \u2192 2 \u00e0 3 Sous-resp. \u2192 Employ\u00e9s. Grandes \u00e9quipes.'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">{department ? 'Modifier' : 'Cr\u00e9er'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================== Modale Ajout Membre =====================

function AddMemberModal({
  department,
  employees,
  existingMembers,
  onClose,
  onSave,
}: {
  department: Department;
  employees: Employee[];
  existingMembers: DepartmentMember[];
  onClose: () => void;
  onSave: (data: { employee: number; role: MemberRole; reports_to: number | null }) => void;
}) {
  const [selectedEmployee, setSelectedEmployee] = useState<number | ''>('');
  const [role, setRole] = useState<MemberRole>('EMPLOYE');
  const [reportsTo, setReportsTo] = useState<number | ''>('');
  const [search, setSearch] = useState('');

  const existingIds = new Set(existingMembers.map((m) => m.employee));
  const availableEmployees = employees.filter(
    (e) => !existingIds.has(e.id) && e.status === 'ACTIVE'
  );

  const filteredEmployees = availableEmployees.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.nom.toLowerCase().includes(q) ||
      e.prenom.toLowerCase().includes(q) ||
      e.matricule.toLowerCase().includes(q)
    );
  });

  const allowedRoles = getAllowedRoles(department.hierarchy_type);

  const superiors = existingMembers.filter((m) => {
    if (role === 'EMPLOYE') return m.role !== 'EMPLOYE';
    if (role === 'SOUS_RESPONSABLE') return m.role === 'RESPONSABLE' || m.role === 'CHEF';
    if (role === 'RESPONSABLE') return m.role === 'CHEF';
    return false;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      toast.error('S\u00e9lectionnez un employ\u00e9.');
      return;
    }
    onSave({
      employee: selectedEmployee as number,
      role,
      reports_to: reportsTo ? (reportsTo as number) : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          Ajouter un membre - {department.name}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employ\u00e9</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
              placeholder="Rechercher par nom, pr\u00e9nom ou matricule..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto border rounded-lg">
              {filteredEmployees.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">Aucun employ\u00e9 disponible</div>
              ) : (
                filteredEmployees.slice(0, 50).map((emp) => (
                  <div
                    key={emp.id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm ${
                      selectedEmployee === emp.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                    onClick={() => setSelectedEmployee(emp.id)}
                  >
                    <span className="font-medium">{emp.nom} {emp.prenom}</span>
                    <span className="text-gray-400 text-xs">{emp.matricule}</span>
                    <span className="text-gray-400 text-xs ml-auto">{emp.fonction}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">R\u00f4le</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as MemberRole);
                setReportsTo('');
              }}
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {superiors.length > 0 && role !== 'CHEF' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sup\u00e9rieur hi\u00e9rarchique
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={reportsTo}
                onChange={(e) => setReportsTo(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- Aucun (rattach\u00e9 au chef) --</option>
                {superiors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.employee_name} ({s.role_display})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">
              <UserPlus size={16} className="mr-1" />
              Ajouter
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getAllowedRoles(hierarchyType: HierarchyType): MemberRole[] {
  switch (hierarchyType) {
    case 'FLAT':
      return ['CHEF', 'EMPLOYE'];
    case 'WITH_RESPONSABLES':
      return ['CHEF', 'RESPONSABLE', 'EMPLOYE'];
    case 'COMPLETE':
      return ['CHEF', 'RESPONSABLE', 'SOUS_RESPONSABLE', 'EMPLOYE'];
  }
}

// ===================== Page Principale =====================

export default function HierarchyPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  // Détail département
  const [expandedDeptId, setExpandedDeptId] = useState<number | null>(null);
  const [deptMembers, setDeptMembers] = useState<DepartmentMember[]>([]);
  const [deptOrgChart, setDeptOrgChart] = useState<DepartmentOrgChart | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [depts, emps] = await Promise.all([
        getDepartments(),
        getEmployees({ status: 'ACTIVE' }),
      ]);
      setDepartments(depts);
      setEmployees(emps);
    } catch {
      toast.error('Erreur lors du chargement des donn\u00e9es.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDeptDetails(deptId: number) {
    setLoadingMembers(true);
    try {
      const [members, orgChart] = await Promise.all([
        getDepartmentMembers(deptId),
        getDepartmentOrgChart(deptId),
      ]);
      setDeptMembers(members);
      setDeptOrgChart(orgChart);
    } catch {
      toast.error('Erreur lors du chargement des membres.');
    } finally {
      setLoadingMembers(false);
    }
  }

  function handleExpandDept(dept: Department) {
    if (expandedDeptId === dept.id) {
      setExpandedDeptId(null);
      setDeptMembers([]);
      setDeptOrgChart(null);
    } else {
      setExpandedDeptId(dept.id);
      setSelectedDept(dept);
      loadDeptDetails(dept.id);
    }
  }

  async function handleSaveDepartment(data: {
    name: string;
    description: string;
    hierarchy_type: HierarchyType;
  }) {
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, data);
        toast.success('D\u00e9partement modifi\u00e9.');
      } else {
        await createDepartment(data);
        toast.success('D\u00e9partement cr\u00e9\u00e9.');
      }
      setShowDeptModal(false);
      setEditingDept(null);
      loadData();
    } catch {
      toast.error('Erreur lors de la sauvegarde.');
    }
  }

  async function handleDeleteDept(dept: Department) {
    if (!confirm(`Supprimer le d\u00e9partement "${dept.name}" ?`)) return;
    try {
      await deleteDepartment(dept.id);
      toast.success('D\u00e9partement supprim\u00e9.');
      if (expandedDeptId === dept.id) {
        setExpandedDeptId(null);
      }
      loadData();
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  }

  async function handleAddMember(data: {
    employee: number;
    role: MemberRole;
    reports_to: number | null;
  }) {
    if (!selectedDept) return;
    try {
      await addMember({
        department: selectedDept.id,
        ...data,
      });
      toast.success('Membre ajout\u00e9.');
      setShowMemberModal(false);
      loadDeptDetails(selectedDept.id);
      loadData();
    } catch {
      toast.error("Erreur lors de l'ajout du membre.");
    }
  }

  async function handleRemoveMember(member: DepartmentMember) {
    if (!confirm(`Retirer ${member.employee_name} du d\u00e9partement ?`)) return;
    try {
      await removeMember(member.id);
      toast.success('Membre retir\u00e9.');
      if (selectedDept) loadDeptDetails(selectedDept.id);
      loadData();
    } catch {
      toast.error('Erreur lors du retrait.');
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <GitBranch size={28} className="text-blue-600" />
              Hi\u00e9rarchie de l'entreprise
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configurez la structure organisationnelle par d\u00e9partement
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingDept(null);
              setShowDeptModal(true);
            }}
          >
            <Plus size={16} className="mr-1" />
            Nouveau d\u00e9partement
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3">
            <div className="bg-blue-100 p-2.5 rounded-lg">
              <Building2 size={22} className="text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{departments.length}</div>
              <div className="text-sm text-gray-500">D\u00e9partements</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3">
            <div className="bg-green-100 p-2.5 rounded-lg">
              <Users size={22} className="text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {departments.reduce((sum, d) => sum + d.members_count, 0)}
              </div>
              <div className="text-sm text-gray-500">Membres assign\u00e9s</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3">
            <div className="bg-purple-100 p-2.5 rounded-lg">
              <Crown size={22} className="text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {departments.filter((d) => d.chef).length}
              </div>
              <div className="text-sm text-gray-500">Chefs assign\u00e9s</div>
            </div>
          </div>
        </div>

        {/* Liste des d\u00e9partements */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">Aucun d\u00e9partement</h3>
            <p className="text-sm text-gray-400 mt-1">
              Commencez par cr\u00e9er votre premier d\u00e9partement
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {departments.map((dept) => (
              <div key={dept.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* Ligne d\u00e9partement */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleExpandDept(dept)}
                >
                  {expandedDeptId === dept.id ? (
                    <ChevronDown size={20} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={20} className="text-gray-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                      <HierarchyTypeBadge type={dept.hierarchy_type} />
                    </div>
                    {dept.description && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{dept.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {dept.chef && (
                      <span className="flex items-center gap-1">
                        <Crown size={14} className="text-yellow-500" />
                        {dept.chef.nom} {dept.chef.prenom}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {dept.members_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      onClick={() => {
                        setEditingDept(dept);
                        setShowDeptModal(true);
                      }}
                      title="Modifier"
                    >
                      <Edit2 size={16} className="text-gray-400" />
                    </button>
                    <button
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      onClick={() => handleDeleteDept(dept)}
                      title="Supprimer"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>

                {/* D\u00e9tail d\u00e9partement */}
                {expandedDeptId === dept.id && (
                  <div className="border-t bg-gray-50 p-4">
                    {loadingMembers ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <button
                              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                                viewMode === 'list'
                                  ? 'bg-white shadow-sm border text-gray-900'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                              onClick={() => setViewMode('list')}
                            >
                              Liste
                            </button>
                            <button
                              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                                viewMode === 'tree'
                                  ? 'bg-white shadow-sm border text-gray-900'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                              onClick={() => setViewMode('tree')}
                            >
                              Organigramme
                            </button>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedDept(dept);
                              setShowMemberModal(true);
                            }}
                          >
                            <UserPlus size={14} className="mr-1" />
                            Ajouter un membre
                          </Button>
                        </div>

                        {viewMode === 'list' ? (
                          deptMembers.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">
                              Aucun membre dans ce d\u00e9partement
                            </div>
                          ) : (
                            <div className="bg-white rounded-lg border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-2.5 text-left font-medium text-gray-600">Employ\u00e9</th>
                                    <th className="px-4 py-2.5 text-left font-medium text-gray-600">Matricule</th>
                                    <th className="px-4 py-2.5 text-left font-medium text-gray-600">Fonction</th>
                                    <th className="px-4 py-2.5 text-left font-medium text-gray-600">R\u00f4le</th>
                                    <th className="px-4 py-2.5 text-left font-medium text-gray-600">Sup\u00e9rieur</th>
                                    <th className="px-4 py-2.5 text-center font-medium text-gray-600">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {deptMembers.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50">
                                      <td className="px-4 py-2.5 font-medium">{m.employee_name}</td>
                                      <td className="px-4 py-2.5 text-gray-500">{m.employee_matricule}</td>
                                      <td className="px-4 py-2.5 text-gray-500">{m.employee_fonction}</td>
                                      <td className="px-4 py-2.5">
                                        <RoleBadge role={m.role} />
                                      </td>
                                      <td className="px-4 py-2.5 text-gray-500">
                                        {m.reports_to_name || '\u2014'}
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        <button
                                          className="p-1 hover:bg-red-50 rounded transition-colors"
                                          onClick={() => handleRemoveMember(m)}
                                          title="Retirer du d\u00e9partement"
                                        >
                                          <Trash2 size={14} className="text-red-400" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        ) : (
                          <div className="bg-white rounded-lg border p-4">
                            {deptOrgChart && deptOrgChart.tree.length > 0 ? (
                              deptOrgChart.tree.map((node) => (
                                <OrgChartTreeNode key={node.id} node={node} />
                              ))
                            ) : (
                              <div className="text-center py-8 text-gray-400 text-sm">
                                Aucune donn\u00e9e pour l'organigramme
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modales */}
        {showDeptModal && (
          <DepartmentFormModal
            department={editingDept}
            onClose={() => {
              setShowDeptModal(false);
              setEditingDept(null);
            }}
            onSave={handleSaveDepartment}
          />
        )}

        {showMemberModal && selectedDept && (
          <AddMemberModal
            department={selectedDept}
            employees={employees}
            existingMembers={deptMembers}
            onClose={() => setShowMemberModal(false)}
            onSave={handleAddMember}
          />
        )}
      </div>
    </AppLayout>
  );
}
