import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/layouts/AppLayout';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentTree,
  createNode,
  updateNode,
  deleteNode,
} from '@/services/hierarchyService';
import { getEmployees } from '@/services/employeeService';
import type { Employee } from '@/types/employee';
import type {
  Department,
  HierarchyNodeTree,
  HierarchyLevel,
  HierarchyConfigType,
} from '@/types/hierarchy';
import {
  HIERARCHY_CONFIG_LABELS,
  HIERARCHY_LEVEL_LABELS,
  CONFIG_LEVELS,
} from '@/types/hierarchy';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  Users,
  X,
  Network,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ---- Couleurs par niveau ----
const LEVEL_COLORS: Record<HierarchyLevel, string> = {
  CHEF_DEPT: 'bg-blue-100 border-blue-400 text-blue-900',
  RESPONSABLE: 'bg-teal-100 border-teal-400 text-teal-900',
  SOUS_RESPONSABLE: 'bg-red-100 border-red-300 text-red-900',
  EMPLOYE: 'bg-gray-100 border-gray-300 text-gray-800',
};

const LEVEL_DOT: Record<HierarchyLevel, string> = {
  CHEF_DEPT: 'bg-blue-500',
  RESPONSABLE: 'bg-teal-500',
  SOUS_RESPONSABLE: 'bg-red-400',
  EMPLOYE: 'bg-gray-400',
};

// ---- Composant nœud arbre (récursif) ----
function TreeNode({
  node,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: HierarchyNodeTree;
  onAddChild: (parentNode: HierarchyNodeTree) => void;
  onEdit: (node: HierarchyNodeTree) => void;
  onDelete: (node: HierarchyNodeTree) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const name = node.employee_nom
    ? `${node.employee_prenom} ${node.employee_nom}`
    : node.title || 'Poste vacant';

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium max-w-xs ${LEVEL_COLORS[node.level]}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${LEVEL_DOT[node.level]}`} />
        <div className="flex-1 min-w-0">
          <div className="truncate font-semibold">{name}</div>
          <div className="text-xs opacity-70">{node.level_display}</div>
          {node.employee_fonction && (
            <div className="text-xs opacity-60 truncate">{node.employee_fonction}</div>
          )}
        </div>
        <div className="flex gap-1 ml-2">
          <button
            title="Ajouter un subordonné"
            onClick={() => onAddChild(node)}
            className="p-1 rounded hover:bg-white/50 transition"
          >
            <Plus size={13} />
          </button>
          <button
            title="Modifier"
            onClick={() => onEdit(node)}
            className="p-1 rounded hover:bg-white/50 transition"
          >
            <Pencil size={13} />
          </button>
          <button
            title="Supprimer"
            onClick={() => onDelete(node)}
            className="p-1 rounded hover:bg-white/50 transition text-red-600"
          >
            <Trash2 size={13} />
          </button>
          {hasChildren && (
            <button
              title={open ? 'Réduire' : 'Développer'}
              onClick={() => setOpen(!open)}
              className="p-1 rounded hover:bg-white/50 transition"
            >
              <ChevronRight size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {open && hasChildren && (
        <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Modal département ----
function DepartmentModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Department>;
  onSave: (data: Partial<Department>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Department>>({
    name: '',
    code: '',
    description: '',
    hierarchy_config: 'FLAT',
    is_active: true,
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            {initial?.id ? 'Modifier le département' : 'Nouveau département'}
          </h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Nom *</label>
            <input
              required
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.name || ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Code *</label>
            <input
              required
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm uppercase"
              value={form.code || ''}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              rows={2}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Configuration hiérarchique *</label>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.hierarchy_config || 'FLAT'}
              onChange={e => setForm(f => ({ ...f, hierarchy_config: e.target.value as HierarchyConfigType }))}
            >
              {(Object.entries(HIERARCHY_CONFIG_LABELS) as [HierarchyConfigType, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active ?? true}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Actif</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm">Annuler</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-camublue-900 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Modal nœud ----
function NodeModal({
  departmentId,
  hierarchyConfig,
  parentNode,
  initial,
  employees,
  onSave,
  onClose,
}: {
  departmentId: number;
  hierarchyConfig: HierarchyConfigType;
  parentNode?: HierarchyNodeTree | null;
  initial?: HierarchyNodeTree | null;
  employees: Employee[];
  onSave: () => void;
  onClose: () => void;
}) {
  const availableLevels = CONFIG_LEVELS[hierarchyConfig];
  const [form, setForm] = useState({
    employee: initial?.employee ?? null as number | null,
    level: (initial?.level ?? availableLevels[0]) as HierarchyLevel,
    title: initial?.title ?? '',
    order: initial?.order ?? 0,
    parent: parentNode?.id ?? initial?.parent ?? null as number | null,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        department: departmentId,
        employee: form.employee || null,
        level: form.level,
        title: form.title,
        order: form.order,
        parent: form.parent,
        is_active: true,
      };
      if (initial?.id) {
        await updateNode(initial.id, payload);
      } else {
        await createNode(payload);
      }
      onSave();
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            {initial?.id ? 'Modifier le poste' : 'Ajouter un poste'}
          </h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {parentNode && (
          <div className="mb-4 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            Subordonné de : <strong>{parentNode.employee_nom ? `${parentNode.employee_prenom} ${parentNode.employee_nom}` : parentNode.level_display}</strong>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Niveau *</label>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.level}
              onChange={e => setForm(f => ({ ...f, level: e.target.value as HierarchyLevel }))}
            >
              {availableLevels.map(lvl => (
                <option key={lvl} value={lvl}>{HIERARCHY_LEVEL_LABELS[lvl]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Employé</label>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.employee ?? ''}
              onChange={e => setForm(f => ({ ...f, employee: e.target.value ? Number(e.target.value) : null }))}
            >
              <option value="">-- Poste vacant --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.prenom} {emp.nom} ({emp.matricule})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Titre personnalisé</label>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.title}
              placeholder="Ex: Responsable Terrain"
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Ordre d'affichage</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              value={form.order}
              onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm">Annuler</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-camublue-900 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Page principale ----
export default function HierarchyPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [tree, setTree] = useState<HierarchyNodeTree[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  // Modals state
  const [deptModal, setDeptModal] = useState<{ open: boolean; initial?: Partial<Department> }>({ open: false });
  const [nodeModal, setNodeModal] = useState<{
    open: boolean;
    parentNode?: HierarchyNodeTree;
    editNode?: HierarchyNodeTree;
  }>({ open: false });

  const loadDepartments = useCallback(async () => {
    try {
      const data = await getDepartments(false);
      setDepartments(data);
    } catch {
      toast.error('Erreur chargement départements');
    }
  }, []);

  const loadTree = useCallback(async (dept: Department) => {
    setLoadingTree(true);
    try {
      const data = await getDepartmentTree(dept.id);
      setTree(data.tree);
    } catch {
      toast.error('Erreur chargement arbre');
    } finally {
      setLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
    getEmployees({ status: 'ACTIVE' }).then(setEmployees);
  }, [loadDepartments]);

  useEffect(() => {
    if (selectedDept) loadTree(selectedDept);
  }, [selectedDept, loadTree]);

  const handleSaveDept = async (data: Partial<Department>) => {
    try {
      if (deptModal.initial?.id) {
        await updateDepartment(deptModal.initial.id, data);
        toast.success('Département mis à jour');
      } else {
        await createDepartment(data);
        toast.success('Département créé');
      }
      setDeptModal({ open: false });
      await loadDepartments();
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    if (!confirm(`Supprimer le département "${dept.name}" et toute sa hiérarchie ?`)) return;
    try {
      await deleteDepartment(dept.id);
      toast.success('Département supprimé');
      if (selectedDept?.id === dept.id) {
        setSelectedDept(null);
        setTree([]);
      }
      await loadDepartments();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDeleteNode = async (node: HierarchyNodeTree) => {
    if (!confirm('Supprimer ce poste et tous ses subordonnés ?')) return;
    try {
      await deleteNode(node.id);
      toast.success('Poste supprimé');
      if (selectedDept) await loadTree(selectedDept);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleNodeSaved = async () => {
    setNodeModal({ open: false });
    toast.success('Poste enregistré');
    if (selectedDept) await loadTree(selectedDept);
  };

  return (
    <AppLayout>
      <div className="flex gap-6 h-full">
        {/* ---- Panneau gauche : liste départements ---- */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <Building2 size={18} className="text-camublue-900" />
                Départements
              </h2>
              <button
                onClick={() => setDeptModal({ open: true })}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-camublue-900 text-white text-xs font-medium"
              >
                <Plus size={14} /> Nouveau
              </button>
            </div>

            <div className="space-y-2">
              {departments.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">Aucun département</p>
              )}
              {departments.map(dept => (
                <div
                  key={dept.id}
                  onClick={() => setSelectedDept(dept)}
                  className={`cursor-pointer rounded-xl p-3 border-2 transition-all ${
                    selectedDept?.id === dept.id
                      ? 'border-camublue-900 bg-camublue-900/5'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-800 truncate">{dept.name}</div>
                      <div className="text-xs text-gray-500">{dept.code}</div>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          dept.hierarchy_config === 'FLAT'
                            ? 'bg-blue-100 text-blue-700'
                            : dept.hierarchy_config === 'WITH_MANAGERS'
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {dept.hierarchy_config === 'FLAT' ? 'Cas 1' : dept.hierarchy_config === 'WITH_MANAGERS' ? 'Cas 2' : 'Cas 3'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <Users size={11} /> {dept.node_count} poste(s)
                        {!dept.is_active && <span className="ml-1 text-red-400">• Inactif</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-1">
                      <button
                        onClick={e => { e.stopPropagation(); setDeptModal({ open: true, initial: dept }); }}
                        className="p-1 rounded hover:bg-gray-100"
                      >
                        <Pencil size={13} className="text-gray-500" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteDept(dept); }}
                        className="p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Panneau droit : arbre hiérarchique ---- */}
        <div className="flex-1">
          {!selectedDept ? (
            <div className="bg-white rounded-2xl shadow-sm border h-full flex flex-col items-center justify-center text-gray-400">
              <Network size={48} className="mb-3 opacity-30" />
              <p className="text-sm">Sélectionnez un département pour afficher sa hiérarchie</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              {/* En-tête */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedDept.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {HIERARCHY_CONFIG_LABELS[selectedDept.hierarchy_config]}
                  </p>
                  {selectedDept.description && (
                    <p className="text-sm text-gray-400 mt-1">{selectedDept.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setNodeModal({ open: true })}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-camublue-900 text-white text-sm font-medium"
                >
                  <Plus size={16} /> Ajouter un poste
                </button>
              </div>

              {/* Légende */}
              <div className="flex flex-wrap gap-3 mb-6 p-3 bg-gray-50 rounded-xl">
                {CONFIG_LEVELS[selectedDept.hierarchy_config].map(lvl => (
                  <div key={lvl} className="flex items-center gap-2 text-xs">
                    <span className={`w-3 h-3 rounded-full ${LEVEL_DOT[lvl]}`} />
                    <span className="text-gray-600">{HIERARCHY_LEVEL_LABELS[lvl]}</span>
                  </div>
                ))}
              </div>

              {/* Arbre */}
              {loadingTree ? (
                <div className="text-center py-12 text-gray-400 text-sm">Chargement...</div>
              ) : tree.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Network size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucun poste configuré pour ce département.</p>
                  <button
                    onClick={() => setNodeModal({ open: true })}
                    className="mt-3 text-sm text-camublue-900 underline"
                  >
                    Ajouter le premier poste
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tree.map(node => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      onAddChild={parentNode => setNodeModal({ open: true, parentNode })}
                      onEdit={editNode => setNodeModal({ open: true, editNode })}
                      onDelete={handleDeleteNode}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Modals ---- */}
      {deptModal.open && (
        <DepartmentModal
          initial={deptModal.initial}
          onSave={handleSaveDept}
          onClose={() => setDeptModal({ open: false })}
        />
      )}

      {nodeModal.open && selectedDept && (
        <NodeModal
          departmentId={selectedDept.id}
          hierarchyConfig={selectedDept.hierarchy_config}
          parentNode={nodeModal.parentNode}
          initial={nodeModal.editNode}
          employees={employees}
          onSave={handleNodeSaved}
          onClose={() => setNodeModal({ open: false })}
        />
      )}
    </AppLayout>
  );
}
