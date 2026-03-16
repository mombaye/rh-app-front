import { useEffect, useState, useCallback } from "react";
import { useAdminAuth } from "@/contexts/useAdminAuth";
import {
  getAdminStats,
  getAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
  resetAdminPassword,
  toggleAdminActive,
  type AdminUser,
  type AdminStats,
} from "@/services/adminService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";
import {
  Users,
  UserCheck,
  ShieldCheck,
  LogOut,
  Search,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
} from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "employee" | "rh" | "manager";
type ManagerFilter = "all" | "manager1" | "manager2";

type UserForm = {
  username: string;
  email: string;
  password: string;
  role: "employee" | "rh" | "manager1" | "manager2";
  is_active: boolean;
};

const EMPTY_FORM: UserForm = {
  username: "",
  email: "",
  password: "",
  role: "employee",
  is_active: true,
};

function roleLabel(user: AdminUser): string {
  if (user.is_staff) return "RH";
  if (user.manager_level === 1) return "Manager N1";
  if (user.manager_level === 2) return "Manager N2";
  return "Employé";
}

function formToPayload(form: UserForm) {
  const base: Record<string, unknown> = {
    username: form.username,
    email: form.email,
    is_staff: form.role === "rh",
    is_planning_manager: false,
    manager_level: form.role === "manager1" ? 1 : form.role === "manager2" ? 2 : null,
    is_active: form.is_active,
  };
  if (form.password) base.password = form.password;
  return base;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="shadow-sm border-0">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-camublue-900">
            {value ?? "—"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── User Modal (Create / Edit) ───────────────────────────────────────────────

function UserModal({
  mode,
  user,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  user: AdminUser | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<UserForm>(() => {
    if (mode === "edit" && user) {
      return {
        username: user.username,
        email: user.email,
        password: "",
        role: user.is_staff
          ? "rh"
          : user.manager_level === 1
          ? "manager1"
          : user.manager_level === 2
          ? "manager2"
          : "employee",
        is_active: user.is_active,
      };
    }
    return EMPTY_FORM;
  });
  const [loading, setLoading] = useState(false);

  const setField = <K extends keyof UserForm>(k: K, v: UserForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "create" && !form.password) {
      toast.error("Le mot de passe est requis à la création.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "create") {
        await createAdminAccount(formToPayload(form) as any);
        toast.success("Compte créé avec succès.");
      } else if (user) {
        await updateAdminAccount(user.id, formToPayload(form) as any);
        toast.success("Compte mis à jour.");
      }
      onSave();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data
          ? Object.values(err.response.data).flat().join(" ")
          : "Erreur lors de l'enregistrement.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-camublue-900 mb-5">
          {mode === "create" ? "Créer un compte" : "Modifier le compte"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Nom d'utilisateur
            </label>
            <Input
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              required
              placeholder="ex: jdupont"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              required
              placeholder="ex: j.dupont@camusat.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Mot de passe {mode === "edit" && <span className="text-gray-400">(laisser vide pour ne pas changer)</span>}
            </label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              required={mode === "create"}
              placeholder={mode === "create" ? "Mot de passe" : "Nouveau mot de passe"}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Rôle</label>
            <div className="relative">
              <select
                value={form.role}
                onChange={(e) => setField("role", e.target.value as UserForm["role"])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-camublue-900"
              >
                <option value="employee">Employé</option>
                <option value="rh">Compte RH</option>
                <option value="manager1">Manager Niveau 1</option>
                <option value="manager2">Manager Niveau 2</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>
          {mode === "edit" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setField("is_active", e.target.checked)}
                className="accent-camublue-900 w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Compte actif</span>
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 text-sm transition disabled:opacity-60"
            >
              {loading ? "Enregistrement..." : mode === "create" ? "Créer" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser;
  onClose: () => void;
  onSave: () => void;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      await resetAdminPassword(user.id, password);
      toast.success("Mot de passe réinitialisé.");
      onSave();
      onClose();
    } catch {
      toast.error("Erreur lors de la réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-camublue-900 mb-1">Réinitialiser le mot de passe</h2>
        <p className="text-sm text-gray-500 mb-5">
          Compte : <span className="font-medium text-gray-700">{user.username}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Nouveau mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 text-sm transition disabled:opacity-60"
            >
              {loading ? "..." : "Réinitialiser"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  user,
  onClose,
  onConfirm,
}: {
  user: AdminUser;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteAdminAccount(user.id);
      toast.success("Compte supprimé.");
      onConfirm();
      onClose();
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-camublue-900 mb-2">Supprimer le compte</h2>
        <p className="text-sm text-gray-600 mb-6">
          Voulez-vous vraiment supprimer le compte{" "}
          <span className="font-semibold text-gray-800">{user.username}</span> ? Cette action est
          irréversible.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm transition disabled:opacity-60"
          >
            {loading ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Table ───────────────────────────────────────────────────────────────

function UserTable({
  users,
  tab,
  onEdit,
  onResetPwd,
  onDelete,
  onToggle,
}: {
  users: AdminUser[];
  tab: Tab;
  onEdit: (u: AdminUser) => void;
  onResetPwd: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
  onToggle: (u: AdminUser) => void;
}) {
  if (users.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        Aucun compte trouvé.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-4 py-3 font-semibold text-gray-500">Utilisateur</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-500">Email</th>
            {tab === "employee" && (
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Employé lié</th>
            )}
            {tab === "manager" && (
              <th className="text-left px-4 py-3 font-semibold text-gray-500">Niveau</th>
            )}
            <th className="text-left px-4 py-3 font-semibold text-gray-500">Statut</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.id}
              className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
              <td className="px-4 py-3 text-gray-600">{u.email || "—"}</td>
              {tab === "employee" && (
                <td className="px-4 py-3 text-gray-600">{u.employee_name || "—"}</td>
              )}
              {tab === "manager" && (
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      u.manager_level === 1
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    Niveau {u.manager_level}
                  </span>
                </td>
              )}
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    u.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {u.is_active ? "Actif" : "Inactif"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onToggle(u)}
                    title={u.is_active ? "Désactiver" : "Activer"}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
                  >
                    {u.is_active ? (
                      <ToggleRight size={18} className="text-green-600" />
                    ) : (
                      <ToggleLeft size={18} className="text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => onEdit(u)}
                    title="Modifier"
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => onResetPwd(u)}
                    title="Réinitialiser le mot de passe"
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(u)}
                    title="Supprimer"
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { adminUser, logout } = useAdminAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("employee");
  const [managerFilter, setManagerFilter] = useState<ManagerFilter>("all");
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  // Fetch stats once
  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => toast.error("Erreur lors du chargement des statistiques."));
  }, []);

  // Fetch users when tab/filter/search changes
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      let role: "employee" | "rh" | "manager" | "manager1" | "manager2" | undefined;
      if (activeTab === "employee") role = "employee";
      else if (activeTab === "rh") role = "rh";
      else if (activeTab === "manager") {
        if (managerFilter === "manager1") role = "manager1";
        else if (managerFilter === "manager2") role = "manager2";
        else role = "manager";
      }
      const data = await getAdminAccounts({ role, search: search || undefined });
      setUsers(data);
    } catch {
      toast.error("Erreur lors du chargement des utilisateurs.");
    } finally {
      setLoadingUsers(false);
    }
  }, [activeTab, managerFilter, search]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchUsers, search]);

  const handleToggle = async (u: AdminUser) => {
    try {
      await toggleAdminActive(u.id);
      toast.success(`Compte ${u.is_active ? "désactivé" : "activé"}.`);
      fetchUsers();
    } catch {
      toast.error("Erreur lors du changement de statut.");
    }
  };

  const tabBtn = (tab: Tab, label: string) => (
    <button
      onClick={() => {
        setActiveTab(tab);
        setSearch("");
        setManagerFilter("all");
      }}
      className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
        activeTab === tab
          ? "bg-camublue-900 text-white shadow-sm"
          : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );

  const filterBtn = (f: ManagerFilter, label: string) => (
    <button
      onClick={() => setManagerFilter(f)}
      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
        managerFilter === f
          ? "bg-camublue-900/10 text-camublue-900 border border-camublue-900/20"
          : "text-gray-500 hover:bg-gray-100 border border-transparent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-camugray-100">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Camusat" className="h-10 object-contain" />
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex items-center gap-2 text-camublue-900">
            <ShieldCheck size={18} />
            <span className="font-bold text-base">Administration</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Connecté : <span className="font-medium text-gray-700">{adminUser?.username}</span>
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Comptes Employés"
            value={stats?.employee_accounts}
            icon={<Users size={20} className="text-blue-600" />}
            color="bg-blue-50"
          />
          <StatCard
            label="Comptes RH"
            value={stats?.staff_users}
            icon={<UserCheck size={20} className="text-emerald-600" />}
            color="bg-emerald-50"
          />
          <StatCard
            label="Managers Niveau 1"
            value={stats?.manager_n1}
            icon={<ShieldCheck size={20} className="text-violet-600" />}
            color="bg-violet-50"
          />
          <StatCard
            label="Managers Niveau 2"
            value={stats?.manager_n2}
            icon={<ShieldCheck size={20} className="text-amber-600" />}
            color="bg-amber-50"
          />
        </div>

        {/* Main card */}
        <Card className="shadow-sm border-0">
          <CardContent className="p-0">
            {/* Tabs */}
            <div className="px-6 pt-5 pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {tabBtn("employee", "Employés")}
                {tabBtn("rh", "Comptes RH")}
                {tabBtn("manager", "Managers")}
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Manager sub-filter */}
              {activeTab === "manager" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium mr-1">Niveau :</span>
                  {filterBtn("all", "Tous")}
                  {filterBtn("manager1", "Niveau 1")}
                  {filterBtn("manager2", "Niveau 2")}
                </div>
              )}

              {/* Search + Add */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un utilisateur..."
                    className="pl-9 bg-gray-50"
                  />
                </div>
                <Button
                  onClick={() => setShowCreate(true)}
                  className="bg-camublue-900 text-white hover:bg-camublue-900/90 gap-2"
                >
                  <Plus size={16} />
                  Ajouter
                </Button>
              </div>

              {/* Count */}
              <p className="text-xs text-gray-400">
                {loadingUsers ? "Chargement..." : `${users.length} compte(s) trouvé(s)`}
              </p>

              {/* Table */}
              {loadingUsers ? (
                <div className="py-16 flex justify-center">
                  <div className="w-8 h-8 border-4 border-camublue-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <UserTable
                  users={users}
                  tab={activeTab}
                  onEdit={setEditUser}
                  onResetPwd={setResetUser}
                  onDelete={setDeleteUser}
                  onToggle={handleToggle}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {showCreate && (
        <UserModal
          mode="create"
          user={null}
          onClose={() => setShowCreate(false)}
          onSave={fetchUsers}
        />
      )}
      {editUser && (
        <UserModal
          mode="edit"
          user={editUser}
          onClose={() => setEditUser(null)}
          onSave={fetchUsers}
        />
      )}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSave={fetchUsers}
        />
      )}
      {deleteUser && (
        <ConfirmDeleteModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={fetchUsers}
        />
      )}
    </div>
  );
}
