import { useState } from "react";
import { Search, Plus, Pencil, Trash2, RefreshCw, KeyRound, ToggleLeft, ToggleRight } from "lucide-react";
import {
  getUsers, deleteUser, resetUserPassword, toggleUserActive,
  type AdminUser, type UserListParams,
} from "@/admin/services/adminService";
import UserFormModal from "./UserFormModal";

type Role = "employee" | "rh" | "manager";

type Props = {
  role: Role;
  roleLabel: string;
  roleParams: UserListParams;
  extraColumns?: { header: string; render: (u: AdminUser) => React.ReactNode }[];
};

export default function UsersTable({ role, roleLabel, roleParams, extraColumns = [] }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; user?: AdminUser } | null>(null);
  const [resetModal, setResetModal] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const load = async (s = search) => {
    setLoading(true);
    try {
      const params: UserListParams = { ...roleParams };
      if (s) params.search = s;
      if (activeFilter === "active") params.is_active = true;
      if (activeFilter === "inactive") params.is_active = false;
      const data = await getUsers(params);
      setUsers(data);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  // Load on first render
  if (!loaded && !loading) load();

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(deleteConfirm.id);
    try { await deleteUser(deleteConfirm.id); await load(); } finally {
      setActionLoading(null); setDeleteConfirm(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword) return;
    setActionLoading(resetModal.id);
    try { await resetUserPassword(resetModal.id, newPassword); } finally {
      setActionLoading(null); setResetModal(null); setNewPassword("");
    }
  };

  const handleToggle = async (u: AdminUser) => {
    setActionLoading(u.id);
    try { await toggleUserActive(u.id); await load(); } finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0 max-w-sm">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-gray-50"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-camublue-900 text-white rounded-xl text-sm hover:bg-camublue-900/90 transition">
            Chercher
          </button>
        </form>

        {/* Status filter */}
        <div className="flex rounded-xl border overflow-hidden text-sm">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setActiveFilter(f); setTimeout(() => load(), 0); }}
              className={`px-3 py-2 transition ${activeFilter === f ? "bg-camublue-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              {f === "all" ? "Tous" : f === "active" ? "Actifs" : "Inactifs"}
            </button>
          ))}
        </div>

        <button onClick={() => load()} className="p-2.5 border rounded-xl hover:bg-gray-50 text-gray-600 transition">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>

        <button
          onClick={() => setModal({ mode: "create" })}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-camublue-900 text-white rounded-xl text-sm font-medium hover:bg-camublue-900/90 transition"
        >
          <Plus size={16} />
          Nouveau compte {roleLabel}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Comptes {roleLabel}</span>
          <span className="text-xs text-gray-400">{users.length} compte(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Utilisateur</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Pays</th>
                {extraColumns.map((c) => (
                  <th key={c.header} className="px-4 py-3 text-center">{c.header}</th>
                ))}
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 + extraColumns.length }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5 + extraColumns.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Aucun compte {roleLabel} trouvé.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50 transition ${!u.is_active ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{u.username}</div>
                      {u.employee_name && <div className="text-xs text-gray-400">{u.employee_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{u.country?.name || "—"}</td>
                    {extraColumns.map((c) => (
                      <td key={c.header} className="px-4 py-3 text-center">{c.render(u)}</td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {u.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Toggle active */}
                        <button
                          onClick={() => handleToggle(u)}
                          disabled={actionLoading === u.id}
                          title={u.is_active ? "Désactiver" : "Activer"}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
                        >
                          {u.is_active ? <ToggleRight size={17} className="text-green-600" /> : <ToggleLeft size={17} className="text-gray-400" />}
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => setModal({ mode: "edit", user: u })}
                          title="Modifier"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                        >
                          <Pencil size={15} />
                        </button>
                        {/* Reset password */}
                        <button
                          onClick={() => setResetModal(u)}
                          title="Réinitialiser mot de passe"
                          className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-500 transition"
                        >
                          <KeyRound size={15} />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirm(u)}
                          title="Supprimer"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <UserFormModal
          mode={modal.mode}
          role={role}
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {/* Reset password modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-1">Réinitialiser le mot de passe</h3>
            <p className="text-xs text-gray-500 mb-4">Compte : <strong>{resetModal.username}</strong></p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30 bg-gray-50 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setResetModal(null); setNewPassword(""); }} className="px-4 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 transition">
                Annuler
              </button>
              <button
                onClick={handleResetPassword}
                disabled={!newPassword || actionLoading !== null}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600 transition disabled:opacity-60"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-2">Supprimer le compte</h3>
            <p className="text-sm text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer <strong>{deleteConfirm.username}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 transition">
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading !== null}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition disabled:opacity-60"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
