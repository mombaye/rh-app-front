import { Link, useLocation } from "react-router-dom";
import {
  CalendarDays,
  BadgeDollarSign,
  FolderOpen,
  Users,
  Clock,
  LogOut,
  Stethoscope,
  ClipboardList,
  ClipboardCheck,
  FileStack,
  FileBadge,
  Plane,
  X,
  Menu,
  UserCircle2,
  FileText,
  Ticket,
} from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import { useAuth } from "@/contexts/useAuth";
import { useState, useEffect } from "react";
import { getMonQuestionnaire } from "@/services/questionnaireService";

const managerItem = {
  label: "Approbation",
  path: "/rh/my-approvals",
  icon: <ClipboardCheck size={18} />,
};

const baseNavItems = [
  { label: "Mes Dossiers RH",       path: "/rh/my-dossier",        icon: <FolderOpen size={18} /> },
  { label: "Mes Pointages",         path: "/rh/my-attendance",     icon: <Clock size={18} /> },
  { label: "Bulletins de salaires", path: "/rh/my-payslips",       icon: <BadgeDollarSign size={18} /> },
  { label: "Demande de congé",      path: "/rh/my-leaves",         icon: <CalendarDays size={18} /> },
  { label: "Demande de sortie",     path: "/rh/my-exits",          icon: <LogOut size={18} /> },
  { label: "Équipe en congés",      path: "/rh/my-service-leaves", icon: <Users size={18} /> },
  { label: "Demandes Attestations", path: "/rh/my-attestations",   icon: <FileBadge size={18} /> },
  { label: "Demandes de mission",   path: "/rh/my-missions",       icon: <Plane size={18} /> },
  { label: "Infirmerie",            path: "/rh/my-infirmerie",     icon: <Stethoscope size={18} /> },
  { label: "Document RH",           path: "/rh/my-documents",      icon: <FileStack size={18} /> },
  { label: "Contrats employés",     path: "/rh/contracts",         icon: <FileText size={18} /> },
  { label: "Signalements",          path: "/rh/tickets",           icon: <Ticket size={18} /> },
];

const questionnaireItem = {
  label: "Questionnaire sortie",
  path: "/rh/my-questionnaire",
  icon: <ClipboardList size={18} />,
};

type NavItemType = { label: string; path: string; icon: React.ReactNode };

export default function RhMySpaceSidebar() {
  const location = useLocation();
  const { user, logout, availableRoles } = useAuth();
  const isRhManager =
    availableRoles.includes("manager1") || availableRoles.includes("manager2");

  const [hasQuestionnaire, setHasQuestionnaire] = useState(false);

  useEffect(() => {
    const check = () => {
      getMonQuestionnaire()
        .then(res => setHasQuestionnaire(res.statut === "envoye"))
        .catch(() => {});
    };
    check();
    const id = setInterval(() => {
      if (!hasQuestionnaire) check();
    }, 30_000);
    return () => clearInterval(id);
  }, [hasQuestionnaire]);

  const navItems: NavItemType[] = [
    ...baseNavItems,
    ...(hasQuestionnaire ? [questionnaireItem] : []),
  ];

  const items: NavItemType[] = isRhManager
    ? [managerItem, ...navItems]
    : navItems;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const displayName = user?.employee_name || user?.username || user?.email;

  const NavLink = ({ item, onClose }: { item: NavItemType; onClose?: () => void }) => {
    const isActive = location.pathname.startsWith(item.path);
    return (
      <Link
        to={item.path}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-camublue-900 text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-100 hover:text-camublue-900"
        }`}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className="flex-1 leading-tight">{item.label}</span>
      </Link>
    );
  };

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Section label */}
      <div className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-100" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
            Mon espace
          </span>
          <div className="h-px flex-1 bg-gray-100" />
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {items.map((item, i) => (
          <div key={item.path}>
            {/* Séparateur visuel après Approbation */}
            {i === 1 && isRhManager && (
              <div className="my-2 mx-1 h-px bg-gray-100" />
            )}
            <NavLink item={item} onClose={onClose} />
          </div>
        ))}
      </nav>

      {/* Profil */}
      <div className="px-3 py-4 border-t border-gray-100 mt-auto">
        <button
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left text-gray-600 hover:bg-gray-100 transition-all group"
          onClick={() => setShowLogoutModal(true)}
        >
          <div className="w-7 h-7 rounded-full bg-camublue-900/10 flex items-center justify-center shrink-0">
            <UserCircle2 size={16} className="text-camublue-900" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700 truncate">{displayName}</p>
            <p className="text-[10px] text-gray-400">Mon compte</p>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-white shadow-md border"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} className="text-camublue-900" />
      </button>

      <div
        className={`fixed z-40 inset-0 bg-black/40 transition-opacity ${
          mobileOpen ? "block md:hidden" : "hidden"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Desktop */}
      <aside className="bg-white w-64 min-h-screen hidden md:flex md:flex-col border-r border-gray-100 shadow-sm">
        <div className="px-5 py-5 border-b border-gray-100">
          <img src={logo} alt="Camusat" className="w-full max-h-16 object-contain" />
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile */}
      <aside
        className={`fixed z-50 top-0 left-0 h-full w-64 bg-white border-r border-gray-100 shadow-md transition-transform duration-300 flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:hidden`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
          <img src={logo} alt="Camusat" className="w-full max-h-14 object-contain" />
          <button onClick={() => setMobileOpen(false)} className="shrink-0 ml-2">
            <X size={22} className="text-gray-400" />
          </button>
        </div>
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

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
