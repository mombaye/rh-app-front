import { useEffect, useState, useMemo } from "react";
import {
  X,
  ChevronDown,
  ChevronRight,
  Search,
  Users,
  RefreshCw,
  GitBranch,
  MapPin,
  Briefcase,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getHierarchy } from "@/services/leaveService";
import type { HierarchyNode } from "@/services/leaveService";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────

function countDescendants(node: HierarchyNode): number {
  return node.children.reduce(
    (acc, child) => acc + 1 + countDescendants(child),
    0
  );
}

function filterTree(
  nodes: HierarchyNode[],
  query: string
): HierarchyNode[] {
  if (!query.trim()) return nodes;
  const q = query.trim().toLowerCase();

  const matches = (n: HierarchyNode): boolean =>
    `${n.nom} ${n.prenom}`.toLowerCase().includes(q) ||
    (n.fonction || "").toLowerCase().includes(q) ||
    (n.service || "").toLowerCase().includes(q) ||
    (n.business_line || "").toLowerCase().includes(q);

  const walk = (node: HierarchyNode): HierarchyNode | null => {
    const filteredChildren = node.children
      .map(walk)
      .filter(Boolean) as HierarchyNode[];
    if (matches(node) || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };

  return nodes.map(walk).filter(Boolean) as HierarchyNode[];
}

// ── Tree Node ───────────────────────────────────────────

function TreeNode({
  node,
  depth,
  defaultExpanded,
}: {
  node: HierarchyNode;
  depth: number;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(
    defaultExpanded ?? depth < 2
  );
  const hasChildren = node.children.length > 0;
  const descendants = countDescendants(node);
  const isRoot = depth === 0;

  return (
    <div
      className={depth > 0 ? "ml-5 border-l-2 border-slate-200 pl-4" : ""}
    >
      {/* Node row */}
      <div
        className={`flex items-start gap-2 py-1.5 group ${
          hasChildren ? "cursor-pointer" : ""
        }`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand / collapse icon */}
        <div className="mt-2.5 shrink-0 w-4">
          {hasChildren ? (
            <span className="text-slate-400 group-hover:text-camublue-900 transition-colors">
              {expanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </span>
          ) : (
            <span className="block w-2 h-2 rounded-full bg-slate-300 mt-0.5 ml-1" />
          )}
        </div>

        {/* Card */}
        <div
          className={`flex-1 rounded-xl border px-3 py-2 shadow-sm hover:shadow-md transition-all ${
            isRoot
              ? "bg-camublue-900 text-white border-camublue-800"
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-semibold text-sm ${
                isRoot ? "text-white" : "text-camublue-900"
              }`}
            >
              {node.prenom} {node.nom}
            </span>

            {hasChildren && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                  isRoot
                    ? "bg-white/20 text-white"
                    : "bg-camublue-50 text-camublue-700"
                }`}
              >
                {descendants} subordonn\u00e9{descendants > 1 ? "s" : ""}
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

          {/* Service + localisation */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {node.service && (
              <span
                className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  isRoot
                    ? "bg-white/20 text-white"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {node.service}
              </span>
            )}
            {node.localisation && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] ${
                  isRoot ? "text-white/70" : "text-slate-400"
                }`}
              >
                <MapPin size={10} />
                {node.localisation}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                defaultExpanded={depth < 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────

export default function HierarchyModal({ open, onClose }: Props) {
  const [tree, setTree] = useState<HierarchyNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getHierarchy();
      setTree(data.tree);
      setTotal(data.total);
    } catch {
      toast.error("Erreur lors du chargement de la hi\u00e9rarchie");
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

  const filtered = useMemo(
    () => filterTree(tree, search),
    [tree, search]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-camublue-900 text-white p-2 rounded-lg">
              <GitBranch size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-camublue-900">
                Organigramme / Hi\u00e9rarchie
              </h2>
              <p className="text-sm text-slate-500">
                {total} employ\u00e9{total > 1 ? "s" : ""} actif
                {total > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-camublue-900 transition"
              title="Rafra\u00eechir"
            >
              <RefreshCw
                size={18}
                className={loading ? "animate-spin" : ""}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Rechercher un employ\u00e9, fonction, service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-camublue-900/20 focus:border-camublue-900 outline-none"
            />
          </div>
        </div>

        {/* Tree content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
              <RefreshCw size={18} className="animate-spin" />
              <span>Chargement de la hi\u00e9rarchie...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Users size={40} className="mb-3 opacity-30" />
              <p className="font-medium">Aucun r\u00e9sultat</p>
              {search && (
                <p className="text-sm mt-1">
                  Aucun employ\u00e9 correspondant \u00e0 \u00ab {search} \u00bb
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((node) => (
                <TreeNode key={node.id} node={node} depth={0} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Donn\u00e9es en temps r\u00e9el &mdash; la hi\u00e9rarchie s'adapte automatiquement
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition font-medium text-sm"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
