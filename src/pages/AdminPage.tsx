import { useEffect, useState } from "react";
import AppLayout from "@/layouts/AppLayout";
import { useAuth } from "@/contexts/useAuth";
import { Navigate } from "react-router-dom";
import { getAdminStats, getAdminUsers } from "@/services/userService";
import { Users, ShieldCheck, UserCog, CalendarRange, UserCheck, Search, RefreshCw } from "lucide-react";

type AdminStats = {
  total_users: number;
  admin_users: number;
  staff_users: number;
  planning_managers: number;
  active_users: number;
};

type UserItem = {
  id: number;
  username: string;
  email: string;
  is_global_admin: boolean;
  is_planning_manager: boolean;
  first_login: boolean;
  country?: { id: number; name: string; code: string } | null;
};

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!user?.is_global_admin && !user?.is_staff) {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchData = async (searchTerm = "") => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, usersData] = await Promise.all([
        getAdminStats(),
        getAdminUsers(searchTerm ? { search: searchTerm } : undefined),
      ]);
      setStats(statsData);
      setUsers(Array.isArray(usersData) ? usersData : usersData.results ?? []);
    } catch {
      setError("Erreur lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(search);
  };

  const statCards = stats
    ? [
        { label: "Total utilisateurs", value: stats.total_users, icon: <Users size={22} />, color: "bg-blue-50 text-blue-700" },
        { label: "Administrateurs", value: stats.admin_users, icon: <ShieldCheck size={22} />, color: "bg-purple-50 text-purple-700" },
        { label: "Staff", value: stats.staff_users, icon: <UserCog size={22} />, color: "bg-orange-50 text-orange-700" },
        { label: "Gest. planning", value: stats.planning_managers, icon: <CalendarRange size={22} />, color: "bg-green-50 text-green-700" },
        { label: "Actifs", value: stats.active_users, icon: <UserCheck size={22} />, color: "bg-teal-50 text-teal-700" },
      ]
    : [];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-camublue-900">Administration des utilisateurs</h1>
          <button
            onClick={() => fetchData(search)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-camublue-900 text-white text-sm hover:bg-camublue-800 transition"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              ))
            : statCards.map((card) => (
                <div
                  key={card.label}
                  className="bg-white rounded-xl shadow-sm border p-4 flex flex-col gap-2"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                    {card.icon}
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                  <p className="text-xs text-gray-500">{card.label}</p>
                </div>
              ))}
        </div>

        {/* Users table */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b flex items-center gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-camublue-900/30"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-camublue-900 text-white rounded-lg text-sm hover:bg-camublue-800 transition"
              >
                Rechercher
              </button>
            </form>
            <span className="text-sm text-gray-500 ml-auto">{users.length} utilisateur(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Utilisateur</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Pays</th>
                  <th className="px-4 py-3 text-center">Admin</th>
                  <th className="px-4 py-3 text-center">Planning</th>
                  <th className="px-4 py-3 text-center">1er login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{u.username}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{u.country?.name || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            u.is_global_admin
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {u.is_global_admin ? "Oui" : "Non"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            u.is_planning_manager
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {u.is_planning_manager ? "Oui" : "Non"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            u.first_login
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {u.first_login ? "Oui" : "Non"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
