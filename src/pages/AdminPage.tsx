import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, ShieldCheck, UserCog, BarChart2, LogOut, Search,
  Plus, Pencil, Trash2, KeyRound, Check, X, RefreshCw,
  ChevronDown, Eye, EyeOff, UserCheck, UserX, Briefcase,
} from "lucide-react";
import { useAuth } from "@/contexts/useAuth";
import { adminService, ROLE_LABELS } from "@/services/adminService";
import type { AdminUser, AdminStats, UserRole } from "@/services/adminService";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

type Tab = "dashboard" | "employees" | "rh" | "managers";

const ROLE_BADGE: Record<string, string> = {
  EMPLOYEE:   "bg-blue-50   text-blue-700   border-blue-200",
  HR:         "bg-violet-50 text-violet-700 border-violet-200",
  MANAGER_N1: "bg-amber-50  text-amber-700  border-amber-200",
  MANAGER_N2: "bg-orange-50 text-orange-700 border-orange-200",
  "":         "bg-slate-50  text-slate-500  border-slate-200",
};

// ── Composant principal ───────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab,      setTab]      = useState<Tab>("dashboard");
  const [stats,    setStats]    = useState<AdminStats | null>(null);
  const [users,    setUsers]    = useState<AdminUser[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState("");
  const [managerSub, setManagerSub] = useState<"MANAGER_N1" | "MANAGER_N2">("MANAGER_N1");

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editUser,   setEditUser]   = useState<AdminUser | null>(null);
  const [resetUser,  setResetUser]  = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  // Guard
  useEffect(() => {
    if (!user?.is_global_admin) navigate("/admin", { replace: true });
  }, [user, navigate]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try { setStats(await adminService.getStats()); } catch {}
  }, []);

  const loadUsers = useCallback(async (role?: string) => {
    setLoading(true);
    try { setUsers(await adminService.listUsers({ role, search: search.trim() || undefined })); }
    catch { toast.error("Erreur lors du chargement."); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (tab === "employees") loadUsers("EMPLOYEE");
    else if (tab === "rh")   loadUsers("HR");
    else if (tab === "managers") loadUsers(managerSub);
    else if (tab === "dashboard") loadStats();
  }, [tab, managerSub, loadUsers, loadStats]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      await adminService.deleteUser(deleteUser.id);
      toast.success("Compte supprimé.");
      setDeleteUser(null);
      if (tab === "employees") loadUsers("EMPLOYEE");
      else if (tab === "rh")   loadUsers("HR");
      else loadUsers(managerSub);
      loadStats();
    } catch { toast.error("Erreur lors de la suppression."); }
  };

  const activeTab = (t: Tab) =>
    tab === t
      ? "bg-camublue-900 text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100";

  const roleForTab = (): UserRole =>
    tab === "employees" ? "EMPLOYEE" :
    tab === "rh"        ? "HR"       : managerSub;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── Sidebar ── */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-100 flex flex-col shadow-sm">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-camublue-900 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-camublue-900 leading-tight">Administration</p>
              <p className="text-[10px] text-slate-400 truncate">Camusat Sénégal RH</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { key: "dashboard" as Tab, label: "Tableau de bord", icon: BarChart2 },
            { key: "employees" as Tab, label: "Comptes Employés", icon: Users },
            { key: "rh"        as Tab, label: "Comptes RH",       icon: Briefcase },
            { key: "managers"  as Tab, label: "Comptes Managers", icon: UserCog },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab(key)}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 mb-2">
            <div className="w-7 h-7 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 text-camublue-900" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{user?.username}</p>
              <p className="text-[10px] text-slate-400">Administrateur</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/admin"); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition font-medium"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 flex flex-col">

        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-camublue-900">
              {tab === "dashboard" ? "Tableau de bord"  :
               tab === "employees" ? "Gestion des comptes Employés" :
               tab === "rh"        ? "Gestion des comptes RH"       :
               "Gestion des comptes Managers"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Plateforme d'administration · Camusat</p>
          </div>
          {tab !== "dashboard" && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nouveau compte
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">

            {/* ════ DASHBOARD ════ */}
            {tab === "dashboard" && (
              <motion.div key="dashboard"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total comptes",  value: stats?.total,      icon: Users,      color: "text-blue-600",   bg: "bg-blue-50"   },
                    { label: "Actifs",          value: stats?.active,     icon: UserCheck,  color: "text-green-600",  bg: "bg-green-50"  },
                    { label: "Inactifs",        value: stats?.inactive,   icon: UserX,      color: "text-red-600",    bg: "bg-red-50"    },
                    { label: "Employés",        value: stats?.employees,  icon: Users,      color: "text-sky-600",    bg: "bg-sky-50"    },
                    { label: "RH",              value: stats?.hr,         icon: Briefcase,  color: "text-violet-600", bg: "bg-violet-50" },
                    { label: "Managers N1",     value: stats?.manager_n1, icon: UserCog,    color: "text-amber-600",  bg: "bg-amber-50"  },
                    { label: "Managers N2",     value: stats?.manager_n2, icon: UserCog,    color: "text-orange-600", bg: "bg-orange-50" },
                  ].map((s) => (
                    <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                        <s.icon className={`h-5 w-5 ${s.color}`} />
                      </div>
                      <div>
                        <p className={`text-xl font-bold ${s.color}`}>{s.value ?? "—"}</p>
                        <p className="text-xs text-slate-400 leading-tight">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { tab: "employees" as Tab, label: "Gérer les Employés",  icon: Users,     color: "border-blue-200   bg-blue-50   text-blue-700"   },
                    { tab: "rh"        as Tab, label: "Gérer les comptes RH", icon: Briefcase, color: "border-violet-200 bg-violet-50 text-violet-700" },
                    { tab: "managers"  as Tab, label: "Gérer les Managers",   icon: UserCog,   color: "border-amber-200  bg-amber-50  text-amber-700"  },
                  ].map(({ tab: t, label, icon: Icon, color }) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex items-center gap-3 px-5 py-4 rounded-2xl border-2 ${color} font-semibold text-sm transition hover:shadow-sm`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ════ USERS TABLE (employés / RH / managers) ════ */}
            {tab !== "dashboard" && (
              <motion.div key={tab}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Sub-tabs for managers */}
                {tab === "managers" && (
                  <div className="flex gap-2">
                    {(["MANAGER_N1", "MANAGER_N2"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setManagerSub(r)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
                          managerSub === r
                            ? "bg-camublue-900 text-white border-transparent"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                )}

                {/* Search bar */}
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); tab === "employees" ? loadUsers("EMPLOYEE") : tab === "rh" ? loadUsers("HR") : loadUsers(managerSub); }}}
                      placeholder="Rechercher par nom ou email…"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/20 focus:border-camublue-900/40 transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => tab === "employees" ? loadUsers("EMPLOYEE") : tab === "rh" ? loadUsers("HR") : loadUsers(managerSub)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </form>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <RefreshCw className="h-6 w-6 animate-spin text-camublue-900 opacity-40" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                      <Users className="h-8 w-8 opacity-30" />
                      <p className="text-sm">Aucun compte trouvé</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Utilisateur</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Rôle</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Statut</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Créé le</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {users.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-camublue-900">
                                      {u.username.slice(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-800">{u.username}</p>
                                    {u.employee_name && (
                                      <p className="text-[10px] text-slate-400">{u.employee_name}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-500">{u.email || "—"}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ROLE_BADGE[u.role] ?? ROLE_BADGE[""]}`}>
                                  {u.role_label || "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  u.is_active
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-red-50 text-red-600 border-red-200"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-green-500" : "bg-red-400"}`} />
                                  {u.is_active ? "Actif" : "Inactif"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(u.date_joined)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setEditUser(u)}
                                    title="Modifier"
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setResetUser(u)}
                                    title="Réinitialiser le mot de passe"
                                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 hover:text-amber-700 transition"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteUser(u)}
                                    title="Supprimer"
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!loading && users.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
                      {users.length} compte{users.length > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showCreate && (
          <UserFormModal
            mode="create"
            defaultRole={roleForTab()}
            onClose={() => setShowCreate(false)}
            onDone={() => {
              setShowCreate(false);
              tab === "employees" ? loadUsers("EMPLOYEE") : tab === "rh" ? loadUsers("HR") : loadUsers(managerSub);
              loadStats();
            }}
          />
        )}
        {editUser && (
          <UserFormModal
            mode="edit"
            user={editUser}
            defaultRole={roleForTab()}
            onClose={() => setEditUser(null)}
            onDone={() => {
              setEditUser(null);
              tab === "employees" ? loadUsers("EMPLOYEE") : tab === "rh" ? loadUsers("HR") : loadUsers(managerSub);
              loadStats();
            }}
          />
        )}
        {resetUser && (
          <ResetPasswordModal
            user={resetUser}
            onClose={() => setResetUser(null)}
          />
        )}
        {deleteUser && (
          <DeleteModal
            user={deleteUser}
            onClose={() => setDeleteUser(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Modal: créer / modifier un compte ─────────────────────────────────────────
function UserFormModal({
  mode, user, defaultRole, onClose, onDone,
}: {
  mode:        "create" | "edit";
  user?:       AdminUser;
  defaultRole: UserRole;
  onClose:     () => void;
  onDone:      () => void;
}) {
  const [username,   setUsername]   = useState(user?.username   ?? "");
  const [email,      setEmail]      = useState(user?.email      ?? "");
  const [password,   setPassword]   = useState("");
  const [showPwd,    setShowPwd]    = useState(false);
  const [role,       setRole]       = useState<UserRole>(user?.role ?? defaultRole);
  const [isActive,   setIsActive]   = useState(user?.is_active  ?? true);
  const [loading,    setLoading]    = useState(false);

  const ROLES: { value: UserRole; label: string }[] = [
    { value: "EMPLOYEE",   label: "Employé"          },
    { value: "HR",         label: "RH"               },
    { value: "MANAGER_N1", label: "Manager Niveau 1" },
    { value: "MANAGER_N2", label: "Manager Niveau 2" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "create") {
        await adminService.createUser({ username, email, password, role, is_active: isActive });
        toast.success("Compte créé avec succès.");
      } else {
        const data: any = { username, email, role, is_active: isActive };
        if (password) data.password = password;
        await adminService.updateUser(user!.id, data);
        toast.success("Compte mis à jour.");
      }
      onDone();
    } catch (err: any) {
      const msg = err?.response?.data
        ? Object.values(err.response.data).flat().join(" ")
        : "Erreur.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-base font-bold text-slate-800 mb-5">
        {mode === "create" ? "Nouveau compte" : "Modifier le compte"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Identifiant *">
          <input value={username} onChange={e => setUsername(e.target.value)} required
            className="input-base" placeholder="nom_utilisateur" />
        </Field>
        <Field label="Email">
          <input value={email} onChange={e => setEmail(e.target.value)} type="email"
            className="input-base" placeholder="email@camusat.com" />
        </Field>
        <Field label={mode === "create" ? "Mot de passe *" : "Nouveau mot de passe (laisser vide pour ne pas changer)"}>
          <div className="relative">
            <input
              value={password} onChange={e => setPassword(e.target.value)}
              type={showPwd ? "text" : "password"}
              required={mode === "create"}
              className="input-base pr-9"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPwd(p => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>
        <Field label="Rôle *">
          <div className="relative">
            <select value={role} onChange={e => setRole(e.target.value as UserRole)}
              className="input-base appearance-none pr-8">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </Field>
        <Field label="Statut">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setIsActive(a => !a)}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${isActive ? "bg-green-500" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-5" : ""}`} />
            </div>
            <span className={`text-sm font-medium ${isActive ? "text-green-700" : "text-slate-500"}`}>
              {isActive ? "Actif" : "Inactif"}
            </span>
          </label>
        </Field>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
            Annuler
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 rounded-xl bg-camublue-900 hover:bg-camublue-800 text-white py-2 text-sm font-semibold transition disabled:opacity-50">
            {loading ? "Enregistrement…" : mode === "create" ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Modal: réinitialiser le mot de passe ──────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("6 caractères minimum."); return; }
    setLoading(true);
    try {
      await adminService.resetPassword(user.id, password);
      toast.success("Mot de passe réinitialisé. L'utilisateur devra le changer à la prochaine connexion.");
      onClose();
    } catch { toast.error("Erreur lors de la réinitialisation."); }
    finally { setLoading(false); }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-2 mb-5">
        <KeyRound className="h-5 w-5 text-amber-500" />
        <h2 className="text-base font-bold text-slate-800">Réinitialiser le mot de passe</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Nouveau mot de passe pour <span className="font-semibold text-slate-700">{user.username}</span>.
        L'utilisateur sera invité à le changer à la prochaine connexion.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input value={password} onChange={e => setPassword(e.target.value)} required
            type={showPwd ? "text" : "password"} minLength={6}
            className="input-base pr-9" placeholder="Nouveau mot de passe (min. 6 car.)" />
          <button type="button" onClick={() => setShowPwd(p => !p)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
            Annuler
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white py-2 text-sm font-semibold transition disabled:opacity-50">
            {loading ? "En cours…" : "Réinitialiser"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Modal: confirmer la suppression ──────────────────────────────────────────
function DeleteModal({ user, onClose, onConfirm }: {
  user: AdminUser; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="h-5 w-5 text-red-500" />
        <h2 className="text-base font-bold text-slate-800">Supprimer le compte</h2>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        Êtes-vous sûr de vouloir supprimer le compte{" "}
        <span className="font-semibold text-slate-800">{user.username}</span> ?
        Cette action est <span className="text-red-600 font-semibold">irréversible</span>.
      </p>
      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
          Annuler
        </button>
        <button onClick={onConfirm}
          className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white py-2 text-sm font-semibold transition">
          Supprimer
        </button>
      </div>
    </ModalShell>
  );
}

// ── ModalShell ────────────────────────────────────────────────────────────────
function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10"
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0,  opacity: 1, scale: 1    }}
        exit={{    y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <X size={16} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
