import { useEffect, useState } from "react";
import AdminLayout from "@/admin/layouts/AdminLayout";
import { getAdminStats, type AdminStats } from "@/admin/services/adminService";
import { Users, UserCog, ShieldCheck, CalendarRange, UserCheck, Briefcase, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const cards = stats
    ? [
        {
          label: "Total comptes",
          value: stats.total_users,
          icon: <Users size={22} />,
          color: "bg-blue-50 text-blue-700 border-blue-100",
          link: null,
        },
        {
          label: "Comptes Employés",
          value: stats.employee_accounts,
          icon: <Briefcase size={22} />,
          color: "bg-teal-50 text-teal-700 border-teal-100",
          link: "/admin/employees",
        },
        {
          label: "Comptes RH",
          value: stats.staff_users,
          icon: <UserCog size={22} />,
          color: "bg-orange-50 text-orange-700 border-orange-100",
          link: "/admin/rh",
        },
        {
          label: "Managers Niv. 1",
          value: stats.manager_n1,
          icon: <Star size={22} />,
          color: "bg-purple-50 text-purple-700 border-purple-100",
          link: "/admin/managers",
        },
        {
          label: "Managers Niv. 2",
          value: stats.manager_n2,
          icon: <ShieldCheck size={22} />,
          color: "bg-indigo-50 text-indigo-700 border-indigo-100",
          link: "/admin/managers",
        },
        {
          label: "Comptes actifs",
          value: stats.active_users,
          icon: <UserCheck size={22} />,
          color: "bg-green-50 text-green-700 border-green-100",
          link: null,
        },
      ]
    : [];

  const shortcuts = [
    { label: "Gérer les comptes Employés", path: "/admin/employees", icon: <Briefcase size={18} />, color: "bg-teal-600" },
    { label: "Gérer les comptes RH", path: "/admin/rh", icon: <UserCog size={18} />, color: "bg-orange-500" },
    { label: "Gérer les Managers", path: "/admin/managers", icon: <ShieldCheck size={18} />, color: "bg-purple-600" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8 w-full">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1">Vue d'ensemble des comptes utilisateurs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
              ))
            : cards.map((c) =>
                c.link ? (
                  <Link
                    key={c.label}
                    to={c.link}
                    className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 hover:shadow-md transition ${c.color.split(' ')[2]}`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.color.split(' ').slice(0,2).join(' ')}`}>
                      {c.icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-800">{c.value}</p>
                      <p className="text-xs text-gray-500">{c.label}</p>
                    </div>
                  </Link>
                ) : (
                  <div
                    key={c.label}
                    className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 ${c.color.split(' ')[2]}`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.color.split(' ').slice(0,2).join(' ')}`}>
                      {c.icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-800">{c.value}</p>
                      <p className="text-xs text-gray-500">{c.label}</p>
                    </div>
                  </div>
                )
              )}
        </div>

        {/* Shortcuts */}
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Accès rapide</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shortcuts.map((s) => (
              <Link
                key={s.path}
                to={s.path}
                className={`${s.color} text-white rounded-xl px-5 py-4 flex items-center gap-3 hover:opacity-90 transition shadow-sm`}
              >
                {s.icon}
                <span className="text-sm font-semibold">{s.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
