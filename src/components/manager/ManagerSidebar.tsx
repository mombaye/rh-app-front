import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, BadgeDollarSign,
  FolderOpen, ClipboardCheck, X, Menu, UserCircle2, FileStack, LogOut, Users, FileBadge, Clock,
} from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import { useAuth } from "@/contexts/useAuth";
import { useState, useEffect } from "react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

interface ManagerSidebarProps {
  pendingCount?: number;
}

export default function ManagerSidebar({ pendingCount = 0 }: ManagerSidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const navItems: NavItem[] = [
    { label: "Tableau de bord",      path: "/manager/dashboard",    icon: <LayoutDashboard size={20} />                                                    },
    { label: "Approbations",         path: "/manager/approvals",    icon: <ClipboardCheck size={20} />, badge: pendingCount > 0 ? pendingCount : undefined },
    { label: "Équipe en congé",      path: "/manager/team-leaves",  icon: <Users size={20} />                                                                  },
    { label: "Mon Dossier",          path: "/manager/dossier",      icon: <FolderOpen size={20} />                                                         },
    { label: "Mes Bulletins",        path: "/manager/payslips",     icon: <BadgeDollarSign size={20} />                                                    },
    { label: "Mes Pointages",        path: "/manager/attendance",   icon: <Clock size={20} />                                                              },
    { label: "Mes Congés",           path: "/manager/leaves",       icon: <CalendarDays size={20} />                                                       },
    { label: "Mes Sorties",          path: "/manager/exits",        icon: <LogOut size={20} />                                                             },
    { label: "Demandes Attestation", path: "/manager/attestations", icon: <FileBadge size={20} />                                                          },
    { label: "Documents RH",         path: "/manager/documents",    icon: <FileStack size={20} />                                                          },
  ];

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const displayName = user?.employee_name || user?.username || user?.email;

  const NavLink = ({ item, onClose }: { item: NavItem; onClose?: () => void }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={onClose}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 relative ${
          isActive
            ? "bg-[#003c71] text-white shadow-sm"
            : "text-gray-700 hover:bg-[#003c71]/10 hover:text-[#003c71]"
        }`}
      >
        {item.icon}
        <span className="flex-1">{item.label}</span>
        {item.badge != null && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </Link>
    );
  };

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map(item => (
          <NavLink key={item.path} item={item} onClose={onClose} />
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-200">
        <button
          className="flex items-center gap-3 px-4 py-2 rounded-lg w-full text-left text-gray-700 hover:bg-[#003c71]/10 transition-all"
          onClick={() => setShowLogoutModal(true)}
        >
          <UserCircle2 size={18} className="text-[#003c71] shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{displayName}</p>
            <p className="text-[10px] text-gray-400">
              {user?.manager_level ? `Manager Niveau ${user.manager_level}` : "Manager"}
            </p>
          </div>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Bouton burger mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-white shadow-md border"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} className="text-[#003c71]" />
      </button>

      {/* Overlay mobile */}
      <div
        className={`fixed z-40 inset-0 bg-black/40 transition-opacity ${
          mobileOpen ? "block md:hidden" : "hidden"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar Desktop */}
      <aside className="bg-white shadow-md w-72 min-h-screen hidden md:flex md:flex-col border-r">
        <div className="py-6 px-4 flex justify-center items-center">
          <img src={logo} alt="Camusat" className="w-full max-h-24 object-contain" />
        </div>
        <SidebarContent />
      </aside>

      {/* Sidebar Mobile */}
      <aside
        className={`fixed z-50 top-0 left-0 h-full w-72 bg-white shadow-md border-r transition-transform duration-300 flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:hidden`}
      >
        <div className="flex items-center justify-between py-6 px-4">
          <img src={logo} alt="Camusat" className="w-full max-h-20 object-contain" />
          <button onClick={() => setMobileOpen(false)}>
            <X size={28} className="text-[#003c71]" />
          </button>
        </div>
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Modal déconnexion */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-80">
            <h3 className="text-lg font-semibold text-[#003c71] mb-4">Déconnexion</h3>
            <p className="mb-6 text-gray-700">Voulez-vous vraiment vous déconnecter ?</p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                onClick={() => setShowLogoutModal(false)}
              >
                Annuler
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-[#003c71] text-white hover:bg-[#003c71]/90 transition"
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
