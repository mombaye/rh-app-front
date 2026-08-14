import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  BadgeDollarSign,
  FolderOpen,
  X,
  Menu,
  UserCircle2,
  Clock,
  FileStack,
  ClipboardCheck,
  ClipboardList,
  LogOut,
  Users,
  FileBadge,
  Plane,
  Stethoscope,
  BookUser,
  Ticket,
} from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import { useAuth } from "@/contexts/useAuth";
import { useState, useEffect } from "react";
import { leaveRequestService } from "@/services/leaveService";
import { LeaveRequest } from "@/types/leave";
import { getMonQuestionnaire } from "@/services/questionnaireService";

const baseNavItems = [
  {
    label: "Tableau de bord",
    path: "/employee/dashboard",
    icon: <LayoutDashboard size={20} />,
  },
  {
    label: "Mes Dossiers",
    path: "/employee/dossier",
    icon: <FolderOpen size={20} />,
  },
  {
    label: "Mes Pointages",
    path: "/employee/attendance",
    icon: <Clock size={20} />,
  },
  {
    label: "Bulletins de salaires",
    path: "/employee/payslips",
    icon: <BadgeDollarSign size={20} />,
  },
  {
    label: "Demande de congé",
    path: "/employee/leaves",
    icon: <CalendarDays size={20} />,
  },
  {
    label: "Demande de sortie",
    path: "/employee/exits",
    icon: <LogOut size={20} />,
  },
  {
    label: "Equipe de service",
    path: "/employee/service-leaves",
    icon: <Users size={20} />,
  },
  {
    label: "Demandes Attestation",
    path: "/employee/attestations",
    icon: <FileBadge size={20} />,
  },
  {
    label: "Demandes de mission",
    path: "/employee/missions",
    icon: <Plane size={20} />,
  },
  {
    label: "Infirmerie",
    path: "/employee/infirmerie",
    icon: <Stethoscope size={20} />,
  },
  {
    label: "Document RH",
    path: "/employee/documents",
    icon: <FileStack size={20} />,
  },
  {
    label: "Signalements",
    path: "/employee/tickets",
    icon: <Ticket size={20} />,
  },
];

type NavItem = (typeof baseNavItems)[0];

export default function EmployeeSidebar() {
  const location = useLocation();
  const { user, logout, availableRoles } = useAuth();

  const isManager =
    availableRoles.includes("manager1") || availableRoles.includes("manager2");

  const [hasQuestionnaire, setHasQuestionnaire] = useState(false);

  useEffect(() => {
    getMonQuestionnaire().then(res => {
      const active = res !== null && res.statut === "envoye";
      setHasQuestionnaire(active);
      if (!active) return;
      const id = setInterval(() => {
        getMonQuestionnaire()
          .then(r => setHasQuestionnaire(r !== null && r.statut === "envoye"))
          .catch(() => {});
      }, 300_000);
      return () => clearInterval(id);
    }).catch(() => {});
  }, []);

  // Compteur collègues en congé (badge "Equipe en congés")
  const [serviceLeaveCount, setServiceLeaveCount] = useState(0);

  useEffect(() => {
    const service = user?.employee_service;
    if (!service || !user?.employee_id) return;
    leaveRequestService.getAll({
      department:         service,
      status:             "APPROVED",
      active_or_upcoming: 1,
    } as any).then((data: LeaveRequest[]) => {
      const count = data.filter(r => r.employee.id !== user.employee_id).length;
      setServiceLeaveCount(count);
    }).catch(() => {});
  }, [user?.employee_service, user?.employee_id]);

  const isHse = user?.is_hse === true;

  const navItems: NavItem[] = [
    ...baseNavItems,
    ...(hasQuestionnaire
      ? [
          {
            label: "Questionnaire de sortie",
            path: "/employee/questionnaire",
            icon: <ClipboardList size={20} />,
          },
        ]
      : []),
    ...(isManager
      ? [
          {
            label: "Approbations",
            path: "/manager/approvals",
            icon: <ClipboardCheck size={20} />,
          },
        ]
      : []),
    ...(isHse
      ? [
          {
            label: "Gestion Passeports",
            path: "/hse/passeports",
            icon: <BookUser size={20} />,
          },
        ]
      : []),
  ];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const NavLink = ({ item, onClose }: { item: NavItem; onClose?: () => void }) => {
    const isActive   = location.pathname === item.path;
    const isService  = item.path === "/employee/service-leaves";
    const showBadge  = isService && serviceLeaveCount > 0;

    return (
      <Link
        to={item.path}
        onClick={onClose}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 relative ${
          isActive
            ? "bg-camublue-900 text-white shadow-sm"
            : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
        }`}
      >
        {item.icon}
        <span className="flex-1">{item.label}</span>
        {showBadge && (
          <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
            isActive ? "bg-white/25 text-white" : "bg-teal-500 text-white"
          }`}>
            {serviceLeaveCount > 99 ? "99+" : serviceLeaveCount}
          </span>
        )}
      </Link>
    );
  };

  const displayName = user?.employee_name || user?.username || user?.email;

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.path} item={item} onClose={onClose} />
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-gray-200">
        <button
          className="flex items-center gap-3 px-4 py-2 rounded-lg w-full text-left text-gray-700 hover:bg-camublue-900/10 transition-all"
          onClick={() => setShowLogoutModal(true)}
        >
          <UserCircle2 size={18} className="text-camublue-900 shrink-0" />
          <span className="font-medium text-sm truncate">{displayName}</span>
        </button>
      </div>
    </>
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
            <X size={28} className="text-camublue-900" />
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
