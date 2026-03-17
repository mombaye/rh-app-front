import { Link, useLocation, useNavigate } from "react-router-dom";
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
  const location  = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const displayName = user?.employee_name || user?.username || user?.email;

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          {/* Logo */}
          <Link to="/employee/dashboard" className="shrink-0">
            <img src={logo} alt="Camusat" className="h-9 object-contain" />
          </Link>

          {/* Badge espace */}
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-camublue-900/10 text-camublue-900 text-xs font-semibold shrink-0">
            <UserCircle2 size={13} />
            Espace Employé
          </span>

          {/* Nav links – desktop */}
          <nav className="hidden md:flex items-center gap-1 flex-1 ml-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
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

          {/* Spacer on mobile */}
          <div className="flex-1 md:hidden" />

          {/* User + logout – desktop */}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900 transition shrink-0"
          >
            <UserCircle2 size={18} className="text-camublue-900" />
            <span className="max-w-[140px] truncate font-medium">{displayName}</span>
            <LogOut size={15} className="text-gray-400 ml-1" />
          </button>

          {/* Hamburger – mobile */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={22} className="text-camublue-900" /> : <Menu size={22} className="text-camublue-900" />}
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
