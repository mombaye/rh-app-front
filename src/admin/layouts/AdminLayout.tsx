import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, UserCog, ChevronRight, LogOut, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/admin/contexts/AdminAuthContext";
import logo from "@/assets/images/logo-camusat.png";
import { useState } from "react";

const navItems = [
  { label: "Tableau de bord", path: "/admin/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Comptes Employés", path: "/admin/employees", icon: <Users size={20} /> },
  { label: "Comptes RH", path: "/admin/rh", icon: <UserCog size={20} /> },
  { label: "Comptes Managers", path: "/admin/managers", icon: <ShieldCheck size={20} /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { admin, logout } = useAdminAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-white border-r shadow-sm flex flex-col">
        <div className="py-5 px-4 border-b flex flex-col items-center gap-2">
          <img src={logo} alt="Camusat" className="w-full max-h-16 object-contain" />
          <span className="text-xs font-semibold text-camublue-900 bg-camublue-900/10 px-3 py-1 rounded-full">
            Plateforme Admin
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-camublue-900 text-white shadow-sm"
                    : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight size={14} />}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-3 px-4 py-2 rounded-lg w-full text-left text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium truncate">{admin?.username}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm text-gray-500">Plateforme d'administration</h2>
            <p className="text-xs text-gray-400">{navItems.find(n => n.path === location.pathname)?.label}</p>
          </div>
          <span className="text-xs text-gray-400">Connecté : <strong>{admin?.username}</strong></span>
        </header>
        <main className="flex-1 p-6 lg:p-8 w-full">{children}</main>
      </div>

      {/* Logout modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-80">
            <h3 className="text-lg font-semibold text-camublue-900 mb-2">Déconnexion</h3>
            <p className="mb-6 text-gray-600 text-sm">Voulez-vous vraiment vous déconnecter ?</p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition"
                onClick={() => setShowLogoutModal(false)}
              >
                Annuler
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition"
                onClick={logout}
              >
                Déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
