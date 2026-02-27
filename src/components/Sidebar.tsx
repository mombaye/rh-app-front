import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users2,
  BadgeDollarSign,
  Clock,
  X,
  LogOut,
} from "lucide-react";
import logo from "@/assets/images/logo-camusat.jpg";
import { useAuth } from "@/contexts/useAuth";
import { useState } from "react";

const navItems = [
  { label: "Tableau de bord", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Employés", path: "/employees", icon: <Users2 size={20} /> },
  { label: "Bulletins Salariés", path: "/payslip", icon: <BadgeDollarSign size={20} /> },
  { label: "Pointages", path: "/attendance", icon: <Clock size={20} /> },
];

export default function Sidebar({
  mobileOpen,
  setMobileOpen,
}) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="bg-white shadow-md w-64 min-h-screen hidden md:flex md:flex-col border-r">
        <div className="py-6 px-4 border-b-4 border-camublue-900 flex justify-center items-center">
          <img src={logo} alt="Camusat" className="w-full max-h-24 object-contain" />
        </div>
        <nav className="flex-1 px-4 py-6 space-y-3">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 ${
                location.pathname === item.path
                  ? "bg-camublue-900 text-white shadow-sm"
                  : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        {/* Section utilisateur */}
        <div className="px-4 py-4 border-t border-gray-200">
          <button
            className="flex items-center gap-3 px-4 py-2 rounded-lg w-full text-left text-gray-700 hover:bg-camublue-900/10 transition-all"
            onClick={() => setShowLogoutModal(true)}
          >
            <span className="font-medium text-sm truncate">
              {user?.username || user?.email}
            </span>
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      <div
        className={`fixed z-40 inset-0 bg-black/40 transition-opacity ${
          mobileOpen ? "block md:hidden" : "hidden"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Drawer mobile */}
      <aside
        className={`fixed z-50 top-0 left-0 h-full w-64 bg-white shadow-md border-r transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:hidden`}
      >
        <div className="flex items-center justify-between py-6 px-4 border-b-4 border-camublue-900">
          <img src={logo} alt="Camusat" className="w-full max-h-20 object-contain" />
          <button onClick={() => setMobileOpen(false)}>
            <X size={28} className="text-camublue-900" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-3">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 ${
                location.pathname === item.path
                  ? "bg-camublue-900 text-white shadow-sm"
                  : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        {/* Section utilisateur mobile */}
        <div className="px-4 py-4 border-t border-gray-200">
          <button
            className="flex items-center gap-3 px-4 py-2 rounded-lg w-full text-left text-gray-700 hover:bg-camublue-900/10 transition-all"
            onClick={() => setShowLogoutModal(true)}
          >
            <span className="font-medium text-sm truncate">
              {user?.username || user?.email}
            </span>
          </button>
        </div>
      </aside>

      {/* Modal de confirmation de déconnexion */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-80">
            <h3 className="text-lg font-semibold text-camublue-900 mb-4">
              Déconnexion
            </h3>
            <p className="mb-6 text-gray-700">
              Voulez-vous vraiment vous déconnecter ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                onClick={() => setShowLogoutModal(false)}
              >
                Annuler
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-800 transition"
                onClick={logout}
              >
                Déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
