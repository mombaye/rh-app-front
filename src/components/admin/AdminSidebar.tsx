import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  X,
  Menu,
  LogOut,
} from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import { useAdminAuth } from "@/contexts/useAdminAuth";
import { useState, useEffect } from "react";

const navItems = [
  {
    label: "Vue d'ensemble",
    path: "/admin/dashboard",
    icon: <LayoutDashboard size={20} />,
  },
  {
    label: "Comptes Employés",
    path: "/admin/dashboard?tab=employee",
    icon: <Users size={20} />,
  },
  {
    label: "Comptes RH",
    path: "/admin/dashboard?tab=rh",
    icon: <UserCheck size={20} />,
  },
  {
    label: "Managers",
    path: "/admin/dashboard?tab=manager",
    icon: <ShieldCheck size={20} />,
    subItems: [
      { label: "Tous", path: "/admin/dashboard?tab=manager" },
      { label: "Niveau 1", path: "/admin/dashboard?tab=manager&level=1" },
      { label: "Niveau 2", path: "/admin/dashboard?tab=manager&level=2" },
    ],
  },
];

export default function AdminSidebar() {
  const location = useLocation();
  const { adminUser, logout } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    "/admin/dashboard?tab=manager": true,
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleMenu = (path: string) =>
    setOpenMenus((prev) => ({ ...prev, [path]: !prev[path] }));

  const fullPath = location.pathname + location.search;
  // "Vue d'ensemble" has no ?tab param
  const overviewActive = location.pathname === "/admin/dashboard" && !location.search;

  const isActive = (path: string) => {
    if (path === "/admin/dashboard" && !path.includes("?")) return overviewActive;
    return fullPath === path;
  };

  const isParentActive = (item: (typeof navItems)[0]) => {
    if (item.subItems) {
      return item.subItems.some((s) => fullPath === s.path);
    }
    return isActive(item.path);
  };

  const NavContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const hasChildren = !!item.subItems?.length;
          const parentActive = isParentActive(item);
          const isOpen = openMenus[item.path] ?? false;

          if (hasChildren) {
            return (
              <div key={item.path}>
                <button
                  onClick={() => toggleMenu(item.path)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 ${
                    parentActive
                      ? "bg-camublue-900/10 text-camublue-900"
                      : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    {item.label}
                  </div>
                  {isOpen ? (
                    <ChevronDown size={15} className="shrink-0 text-gray-400" />
                  ) : (
                    <ChevronRight size={15} className="shrink-0 text-gray-400" />
                  )}
                </button>
                {isOpen && (
                  <div className="mt-1 ml-9 flex flex-col gap-0.5 border-l-2 border-camublue-900/20 pl-3">
                    {item.subItems!.map((sub) => (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        onClick={onClose}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                          isActive(sub.path)
                            ? "bg-camublue-900 text-white shadow-sm"
                            : "text-gray-600 hover:bg-camublue-900/10 hover:text-camublue-900"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isActive(sub.path) ? "bg-white" : "bg-gray-400"
                          }`}
                        />
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 ${
                active
                  ? "bg-camublue-900 text-white shadow-sm"
                  : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-200">
        <button
          className="flex items-center gap-3 px-4 py-2 rounded-lg w-full text-left text-gray-700 hover:bg-camublue-900/10 transition-all"
          onClick={() => setShowLogoutModal(true)}
        >
          <span className="font-medium text-sm truncate">
            {adminUser?.username}
          </span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-white shadow-md border"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} className="text-camublue-900" />
      </button>

      {/* Mobile overlay */}
      <div
        className={`fixed z-40 inset-0 bg-black/40 transition-opacity ${
          mobileOpen ? "block md:hidden" : "hidden"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Desktop sidebar */}
      <aside className="bg-white shadow-md w-64 min-h-screen hidden md:flex md:flex-col border-r">
        <div className="py-6 px-4 flex flex-col items-center gap-2">
          <img src={logo} alt="Camusat" className="w-full max-h-20 object-contain" />
          <div className="flex items-center gap-1.5 text-camublue-900 text-xs font-semibold">
            <ShieldCheck size={13} />
            Administration
          </div>
        </div>
        <NavContent />
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`fixed z-50 top-0 left-0 h-full w-64 bg-white shadow-md border-r transition-transform duration-300 flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:hidden`}
      >
        <div className="flex items-center justify-between py-6 px-4">
          <img src={logo} alt="Camusat" className="w-full max-h-16 object-contain" />
          <button onClick={() => setMobileOpen(false)}>
            <X size={28} className="text-camublue-900" />
          </button>
        </div>
        <NavContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Logout modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-80">
            <h3 className="text-lg font-semibold text-camublue-900 mb-4">Déconnexion</h3>
            <p className="mb-6 text-gray-700">Voulez-vous vraiment vous déconnecter ?</p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                onClick={() => setShowLogoutModal(false)}
              >
                Annuler
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-camublue-900 text-white hover:bg-camublue-900/90 transition"
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
