import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  BadgeDollarSign,
  FolderOpen,
  UserCircle2,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import { useAuth } from "@/contexts/useAuth";
import { useState, useEffect } from "react";

const navItems = [
  { label: "Vue d'ensemble", path: "/employee/dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "Mes Congés",     path: "/employee/leaves",    icon: <CalendarDays size={18} /> },
  { label: "Mes Bulletins",  path: "/employee/payslips",  icon: <BadgeDollarSign size={18} /> },
  { label: "Mon Dossier",    path: "/employee/dossier",   icon: <FolderOpen size={18} /> },
];

export default function EmployeeTopNav() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const displayName = user?.employee_name || user?.username || user?.email;

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        {/* Desktop: 3-column grid — Logo | Nav centered | Logout right */}
        <div className="hidden md:grid grid-cols-3 items-center px-6 h-24">
          {/* Col 1 – Logo */}
          <div className="flex items-center">
            <Link to="/employee/dashboard">
              <img src={logo} alt="Camusat" className="h-16 object-contain" />
            </Link>
          </div>

          {/* Col 2 – Nav links centered */}
          <nav className="flex items-center justify-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-camublue-900 text-white shadow-sm"
                      : "text-gray-600 hover:bg-camublue-900/10 hover:text-camublue-900"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Col 3 – Logout right */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition"
            >
              <UserCircle2 size={18} className="text-camublue-900" />
              <span className="max-w-[140px] truncate font-medium">{displayName}</span>
              <LogOut size={15} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Mobile bar */}
        <div className="md:hidden flex items-center px-4 h-16">
          <Link to="/employee/dashboard">
            <img src={logo} alt="Camusat" className="h-10 object-contain" />
          </Link>
          <div className="flex-1" />
          <button
            className="p-2 rounded-lg hover:bg-gray-100 transition"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen
              ? <X size={22} className="text-camublue-900" />
              : <Menu size={22} className="text-camublue-900" />
            }
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1 shadow-lg">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-camublue-900 text-white"
                      : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => { setMobileOpen(false); setShowLogoutModal(true); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition"
              >
                <LogOut size={17} />
                <span className="truncate">{displayName}</span>
                <span className="ml-auto text-xs text-gray-400">Déconnexion</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Logout modal ─────────────────────────────────────────────────── */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-80">
            <h3 className="text-lg font-semibold text-camublue-900 mb-4">Déconnexion</h3>
            <p className="mb-6 text-gray-700">Voulez-vous vraiment vous déconnecter ?</p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-sm"
                onClick={() => setShowLogoutModal(false)}
              >
                Annuler
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 transition text-sm"
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
