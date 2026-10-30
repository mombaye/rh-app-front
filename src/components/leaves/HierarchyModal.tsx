import { useEffect, useState, useMemo } from "react";
import {
  X,
  ChevronDown,
  ChevronRight,
  Search,
  Users,
  RefreshCw,
  GitBranch,
  Briefcase,
  MapPin,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { employeeHierarchyService } from "@/services/hierarchyService";
import type { EmployeeHierarchy } from "@/types/leave";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── Build tree from flat list (via n1_manager ID) ───────────────────────────
interface TreeNode extends EmployeeHierarchy {
  children: TreeNode[];
}

function buildTree(employees: EmployeeHierarchy[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  // 1) Create nodes
  for (const emp of employees) {
    map.set(emp.id, { ...emp, children: [] });
  }

  // 2) Assign children via n1_manager
  for (const emp of employees) {
    const node = map.get(emp.id)!;
    if (emp.n1_manager !== null && map.has(emp.n1_manager)) {
      map.get(emp.n1_manager)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 3) Sort each level alphabetically
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.full_name.localeCompare(b.full_name));
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

// ─── Filter tree while keeping parent path ────────────────────────────────────
function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) return nodes;
  const q = query.trim().toLowerCase();

  const matches = (n: TreeNode) =>
    n.full_name.toLowerCase().includes(q) ||
    (n.fonction ?? "").toLowerCase().includes(q) ||
    (n.service ?? "").toLowerCase().includes(q) ||
    n.matricule.toLowerCase().includes(q);

  const walk = (node: TreeNode): TreeNode | null => {
    const filteredChildren = node.children
      .map(walk)
      .filter(Boolean) as TreeNode[];
    if (matches(node) || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };

  return nodes.map(walk).filter(Boolean) as TreeNode[];
}

// ─── Single tree node card ────────────────────────────────────────────────────
function TreeNodeCard({
  node,
  depth,
  forceExpand,
}: {
  node: TreeNode;
  depth: number;
  forceExpand: boolean;
}) {
  const [expanded, setExpanded] = useState(
    forceExpand || depth < 2
  );
  const hasChildren = node.children.length > 0;
  const isRoot = depth === 0;

  // When search forces expansion, sync state
  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);

  return (
    <div className={depth > 0 ? "ml-5 border-l-2 border-slate-200 pl-4" : ""}>
      <div
        className={`flex items-start gap-2 py-1.5 group ${
          hasChildren ? "cursor-pointer select-none" : ""
        }`}
        onClick={() => hasChildren && setExpanded((v) => !v)}
      >
        {/* Expand icon */}
        <div className="mt-2.5 shrink-0 w-4">
          {hasChildren ? (
            <span className="text-slate-400 group-hover:text-camublue-900 transition-colors">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <span className="block w-2 h-2 rounded-full bg-slate-300 mt-1 ml-1" />
          )}
        </div>

        {/* Card */}
        <div
          className={`flex-1 rounded-xl border px-3 py-2 shadow-sm transition-all ${
            isRoot
              ? "bg-camublue-900 text-white border-camublue-800 hover:bg-camublue-800"
              : "bg-white border-slate-200 text-slate-800 hover:shadow-md"
          }`}
        >
          {/* Name + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-semibold text-sm ${
                isRoot ? "text-white" : "text-camublue-900"
              }`}
            >
              {node.full_name}
            </span>

            {node.manages_n1_count > 0 && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                  isRoot
                    ? "bg-white/20 text-white"
                    : "bg-camublue-50 text-camublue-700"
                }`}
              >
                {node.manages_n1_count} subordonné
                {node.manages_n1_count > 1 ? "s" : ""}
              </span>
            )}

            {node.requires_two_approvals && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isRoot
                    ? "bg-white/20 text-white"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                2 approbations
              </span>
            )}
          </div>

          {/* Fonction */}
          {node.fonction && (
            <div
              className={`flex items-center gap-1 text-xs mt-0.5 ${
                isRoot ? "text-white/80" : "text-slate-500"
              }`}
            >
              <Briefcase size={11} />
              {node.fonction}
            </div>
          )}

          {/* Service + matricule */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {node.service && (
              <span
                className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  isRoot ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"
                }`}
              >
                {node.service}
              </span>
            )}
            <span
              className={`text-[11px] font-mono ${
                isRoot ? "text-white/60" : "text-slate-400"
              }`}
            >
              {node.matricule}
            </span>
          </div>

          {/* N2 manager info */}
          {node.n2_manager_name && (
            <div
              className={`text-[11px] mt-1 ${
                isRoot ? "text-white/60" : "text-slate-400"
              }`}
            >
              N2 : {node.n2_manager_name}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {expanded && hasChildren && (
          <motion.div
            key="children"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            {node.children.map((child) => (
              <TreeNodeCard
                key={child.id}
                node={child}
                depth={depth + 1}
                forceExpand={forceExpand}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function HierarchyModal({ open, onClose }: Props) {
  const [employees, setEmployees] = useState<EmployeeHierarchy[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await employeeHierarchyService.getAll();
      setEmployees(data);
    } catch {
      toast.error("Erreur lors du chargement de la hiérarchie");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSearch("");
      load();
    }
  }, [open]);

  const tree = useMemo(() => buildTree(employees), [employees]);
  const filtered = useMemo(() => filterTree(tree, search), [tree, search]);
  const isFiltering = search.trim().length > 0;
  const total = employees.filter((e) => e.status === "ACTIVE").length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mb-8"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-camublue-900 text-white p-2 rounded-lg">
              <GitBranch size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-camublue-900">
                Organigramme / Hiérarchie
              </h2>
              <p className="text-sm text-slate-500">
                {total} employé{total > 1 ? "s" : ""} actif{total > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-camublue-900 transition"
              title="Rafraîchir"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Search ── */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Rechercher par nom, matricule, fonction ou service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-camublue-900/20 focus:border-camublue-900 outline-none"
            />
          </div>
        </div>

        {/* ── Tree ── */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
              <RefreshCw size={18} className="animate-spin" />
              <span>Chargement de la hiérarchie...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Users size={40} className="mb-3 opacity-30" />
              <p className="font-medium">
                {search ? "Aucun résultat" : "Aucune donnée disponible"}
              </p>
              {search && (
                <p className="text-sm mt-1">
                  Aucun employé correspondant à « {search} »
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((node) => (
                <TreeNodeCard
                  key={node.id}
                  node={node}
                  depth={0}
                  forceExpand={isFiltering}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Données en temps réel — la hiérarchie s’adapte automatiquement aux
            changements de managers
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700
                       hover:bg-slate-200 transition font-medium text-sm"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
