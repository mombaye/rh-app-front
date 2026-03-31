// src/pages/LeavesPage.tsx
import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/layouts/AppLayout';
import {
  fetchDepartmentsFromEmployees,
  createDepartment,
  updateDepartment,
  fetchDepartmentTree,
  fetchRoles,
} from '@/services/leavesService';
import { getEmployees } from '@/services/employeeService';
import type {
  DepartmentFromEmployees,
  DepartmentHierarchyConfig,
  HierarchyTree,
  HierarchyNode,
  HierarchyType,
  HierarchyRole,
} from '@/types/leaves';
import {
  HIERARCHY_TYPE_LABELS,
  HIERARCHY_ROLE_LABELS,
  ROLES_FOR_TYPE,
} from '@/types/leaves';
import type { Employee } from '@/types/employee';

// ─── Color mapping per role ───────────────────────────────────────
const ROLE_COLORS: Record<HierarchyRole, string> = {
  DIRECTION:        'bg-purple-100 border-purple-300 text-purple-800',
  CHEF:             'bg-blue-100 border-blue-300 text-blue-800',
  RESPONSABLE:      'bg-teal-100 border-teal-300 text-teal-700',
  SOUS_RESPONSABLE: 'bg-red-100 border-red-200 text-red-700',
  EMPLOYE:          'bg-gray-100 border-gray-300 text-gray-700',
};

const TYPE_BADGE: Record<HierarchyType, string> = {
  FLAT:             'bg-blue-600 text-white',
  WITH_RESPONSABLE: 'bg-blue-700 text-white',
  FULL:             'bg-blue-800 text-white',
};

const TYPE_SHORT: Record<HierarchyType, string> = {
  FLAT:             'Cas 1',
  WITH_RESPONSABLE: 'Cas 2',
  FULL:             'Cas 3',
};

// ─── Tree node component ──────────────────────────────────────────
function TreeNode({ node }: { node: HierarchyNode }) {
  const colorClass = ROLE_COLORS[node.role] ?? ROLE_COLORS.EMPLOYE;
  return (
    <div className="flex flex-col items-center">
      <div
        className={`rounded-xl border-2 px-4 py-2 text-center min-w-[110px] shadow-sm ${colorClass}`}
      >
        <div className="font-semibold text-sm leading-tight">{node.full_name}</div>
        <div className="text-xs opacity-70 mt-0.5">{node.role_label}</div>
      </div>
      {node.children.length > 0 && (
        <>
          <div className="w-px h-5 bg-gray-300" />
          <div className="flex gap-4 items-start">
            {node.children.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center">
                {node.children.length > 1 && (
                  <div
                    className={`h-px bg-gray-300 ${
                      i === 0 ? 'w-1/2 self-end' :
                      i === node.children.length - 1 ? 'w-1/2 self-start' :
                      'w-full'
                    }`}
                  />
                )}
                <div className="w-px h-5 bg-gray-300" />
                <TreeNode node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Hierarchy tree visualisation ────────────────────────────────
function HierarchyTreeView({ tree }: { tree: HierarchyTree }) {
  return (
    <div className="overflow-auto">
      {/* Direction Générale header */}
      <div className="flex flex-col items-center mb-6">
        <div className="rounded-xl border-2 bg-purple-100 border-purple-300 text-purple-800 px-6 py-3 text-center shadow">
          <div className="font-bold">Direction Générale</div>
          <div className="text-xs opacity-70">Pilotage stratégique</div>
        </div>
        <div className="w-px h-6 bg-gray-300" />
        {/* Dept chef box */}
        <div className="relative">
          <div className={`rounded-xl border-2 px-5 py-3 text-center shadow ${ROLE_COLORS.CHEF}`}>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">
              {tree.hierarchy_label}
            </div>
            <div className="font-bold text-base">{tree.department_name}</div>
            {tree.chef && (
              <div className="text-xs mt-1 opacity-80">{tree.chef.full_name}</div>
            )}
          </div>
        </div>
      </div>

      {/* Tree nodes */}
      {tree.nodes.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          Aucun membre configuré dans ce département.
        </div>
      ) : (
        <div className="flex gap-8 justify-center flex-wrap">
          {tree.nodes.map((node) => (
            <TreeNode key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────
function Legend() {
  const items: { role: HierarchyRole; label: string }[] = [
    { role: 'DIRECTION',        label: 'Direction Générale' },
    { role: 'CHEF',             label: 'Chef de département' },
    { role: 'RESPONSABLE',      label: 'Responsable' },
    { role: 'SOUS_RESPONSABLE', label: 'Sous-responsable' },
    { role: 'EMPLOYE',          label: 'Employé' },
  ];
  return (
    <div className="border rounded-xl p-4 bg-white mt-4">
      <div className="font-semibold text-sm mb-3 text-center">Légende</div>
      <div className="flex flex-wrap gap-3 justify-center">
        {items.map(({ role, label }) => (
          <div key={role} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded border-2 ${ROLE_COLORS[role].split(' ')[0]} ${ROLE_COLORS[role].split(' ')[1]}`} />
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Config modal ─────────────────────────────────────────────────
interface ConfigModalProps {
  dept: DepartmentFromEmployees;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}

function ConfigModal({ dept, employees, onClose, onSaved }: ConfigModalProps) {
  const existing = dept.config;
  const [hierarchyType, setHierarchyType] = useState<HierarchyType>(
    existing?.hierarchy_type ?? 'FLAT'
  );
  const [chefId, setChefId] = useState<number | null>(existing?.chef?.id ?? null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        department_name: dept.department_name,
        hierarchy_type: hierarchyType,
        chef_id: chefId,
      };
      if (existing) {
        await updateDepartment(existing.id, payload);
      } else {
        await createDepartment(payload);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const deptEmployees = employees.filter(
    (e) => e.service === dept.department_name && e.status === 'ACTIVE'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="font-bold text-lg mb-1">Configuration — {dept.department_name}</h2>
        <p className="text-sm text-gray-500 mb-5">Choisissez la structure hiérarchique de ce département.</p>

        {/* Hierarchy type */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Type de hiérarchie</label>
          <div className="grid grid-cols-3 gap-2">
            {(['FLAT', 'WITH_RESPONSABLE', 'FULL'] as HierarchyType[]).map((t) => (
              <button
                key={t}
                onClick={() => setHierarchyType(t)}
                className={`rounded-xl border-2 p-3 text-center text-xs font-semibold transition-all ${
                  hierarchyType === t
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                <div className="font-bold mb-1">{TYPE_SHORT[t]}</div>
                <div className="opacity-75 leading-tight">
                  {t === 'FLAT' && 'Chef → Employés'}
                  {t === 'WITH_RESPONSABLE' && 'Chef → Resp. → Emp.'}
                  {t === 'FULL' && 'Chef → Resp. → Sous-resp. → Emp.'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Roles included */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Niveaux inclus</label>
          <div className="flex flex-wrap gap-2">
            {ROLES_FOR_TYPE[hierarchyType].map((role) => (
              <span
                key={role}
                className={`text-xs px-3 py-1 rounded-full border font-medium ${ROLE_COLORS[role]}`}
              >
                {HIERARCHY_ROLE_LABELS[role]}
              </span>
            ))}
          </div>
        </div>

        {/* Chef selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Chef de département</label>
          <select
            className="w-full border rounded-xl px-3 py-2 text-sm"
            value={chefId ?? ''}
            onChange={(e) => setChefId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Non défini —</option>
            {deptEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom} {e.prenom} ({e.matricule})
              </option>
            ))}
          </select>
          {deptEmployees.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">Aucun employé actif dans ce département.</p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm border text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────
export default function LeavesPage() {
  const [departments, setDepartments] = useState<DepartmentFromEmployees[]>([]);
  const [selectedDept, setSelectedDept] = useState<DepartmentFromEmployees | null>(null);
  const [tree, setTree] = useState<HierarchyTree | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [configTarget, setConfigTarget] = useState<DepartmentFromEmployees | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, emps] = await Promise.all([
        fetchDepartmentsFromEmployees(),
        getEmployees({ status: 'ACTIVE' }),
      ]);
      setDepartments(depts);
      setEmployees(emps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDepartments(); }, [loadDepartments]);

  async function handleSelectDept(dept: DepartmentFromEmployees) {
    setSelectedDept(dept);
    setTree(null);
    if (dept.config) {
      setTreeLoading(true);
      try {
        const t = await fetchDepartmentTree(dept.config.id);
        setTree(t);
      } finally {
        setTreeLoading(false);
      }
    }
  }

  const configuredCount = departments.filter((d) => d.configured).length;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Hiérarchie des congés</h1>
          <p className="text-gray-500 text-sm mt-1">
            Configurez la structure d'approbation des congés par département.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{departments.length}</div>
            <div className="text-sm text-gray-500">Départements</div>
          </div>
          <div className="bg-white rounded-2xl border p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">{configuredCount}</div>
            <div className="text-sm text-gray-500">Configurés</div>
          </div>
          <div className="bg-white rounded-2xl border p-4 shadow-sm">
            <div className="text-2xl font-bold text-orange-500">{departments.length - configuredCount}</div>
            <div className="text-sm text-gray-500">Non configurés</div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Left — department list */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <span className="font-semibold text-sm text-gray-700">Départements</span>
              </div>
              {loading ? (
                <div className="p-6 text-center text-gray-400 text-sm">Chargement...</div>
              ) : departments.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">Aucun département trouvé.</div>
              ) : (
                <ul className="divide-y max-h-[600px] overflow-y-auto">
                  {departments.map((dept) => (
                    <li
                      key={dept.department_name}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                        selectedDept?.department_name === dept.department_name ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleSelectDept(dept)}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-800 truncate">
                          {dept.department_name}
                        </div>
                        {dept.config ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              TYPE_BADGE[dept.config.hierarchy_type]
                            }`}>
                              {TYPE_SHORT[dept.config.hierarchy_type]}
                            </span>
                            <span className="text-xs text-gray-400">
                              {dept.config.members_count} membres
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-orange-500">Non configuré</span>
                        )}
                      </div>
                      <button
                        className="ml-2 text-xs text-blue-600 hover:underline flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); setConfigTarget(dept); }}
                      >
                        {dept.configured ? 'Modifier' : 'Configurer'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right — tree view */}
          <div className="flex-1 min-w-0">
            {!selectedDept ? (
              <div className="bg-white rounded-2xl border shadow-sm flex items-center justify-center h-64">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">🏢</div>
                  <div className="text-sm">Sélectionnez un département pour visualiser sa hiérarchie.</div>
                </div>
              </div>
            ) : !selectedDept.config ? (
              <div className="bg-white rounded-2xl border shadow-sm p-8">
                <div className="text-center">
                  <div className="text-3xl mb-3">⚙️</div>
                  <div className="font-semibold text-gray-700 mb-2">
                    {selectedDept.department_name} n'est pas encore configuré.
                  </div>
                  <p className="text-sm text-gray-500 mb-5">
                    Définissez le type de hiérarchie (Cas 1, 2 ou 3) pour ce département.
                  </p>
                  <button
                    onClick={() => setConfigTarget(selectedDept)}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold text-sm hover:bg-blue-700"
                  >
                    Configurer ce département
                  </button>
                </div>

                {/* Rules reminder */}
                <div className="mt-8 border rounded-xl p-5 bg-gray-50 text-sm">
                  <div className="font-semibold mb-3">Règles de configuration</div>
                  <div className="space-y-2">
                    {([
                      { type: 'FLAT',             desc: 'Chef gère directement les employés. Idéal petites équipes (2–6 pers.).' },
                      { type: 'WITH_RESPONSABLE', desc: 'Chef → 2 à 4 Responsables → Employés. Équipes de taille moyenne.' },
                      { type: 'FULL',             desc: 'Chef → Responsable → 2 à 3 Sous-resp. → Employés. Grandes équipes.' },
                    ] as { type: HierarchyType; desc: string }[]).map(({ type, desc }) => (
                      <div key={type} className="flex items-start gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold mt-0.5 ${TYPE_BADGE[type]}`}>
                          {TYPE_SHORT[type]}
                        </span>
                        <span className="text-gray-600">{desc}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-gray-500 space-y-1">
                    <div>• Chaque département configure sa hiérarchie indépendamment.</div>
                    <div>• Les niveaux Responsable et Sous-responsable sont optionnels.</div>
                    <div>• Un Responsable peut avoir des Sous-responsables ou gérer directement des employés.</div>
                  </div>
                </div>
              </div>
            ) : treeLoading ? (
              <div className="bg-white rounded-2xl border shadow-sm flex items-center justify-center h-64">
                <div className="text-gray-400 text-sm">Chargement de l'arbre...</div>
              </div>
            ) : tree ? (
              <div className="bg-white rounded-2xl border shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-bold text-lg text-gray-800">{tree.department_name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        TYPE_BADGE[tree.hierarchy_type]
                      }`}>
                        {TYPE_SHORT[tree.hierarchy_type]}
                      </span>
                      <span className="text-xs text-gray-500">{tree.hierarchy_label}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfigTarget(selectedDept)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Modifier la configuration
                  </button>
                </div>
                <HierarchyTreeView tree={tree} />
                <Legend />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Config modal */}
      {configTarget && (
        <ConfigModal
          dept={configTarget}
          employees={employees}
          onClose={() => setConfigTarget(null)}
          onSaved={() => {
            loadDepartments();
            if (selectedDept?.department_name === configTarget.department_name) {
              // Refresh tree after saving
              setSelectedDept(null);
            }
          }}
        />
      )}
    </AppLayout>
  );
}
