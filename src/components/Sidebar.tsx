// src/components/layout/Sidebar.tsx
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users2,
  BadgeDollarSign,
  Clock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  X,
  Menu,
  CalendarRange,
  UserCircle,
  FolderOpen,
  FileStack,
  FileBadge,
} from "lucide-react";
import logo from "@/assets/images/logo-camusat.png";
import { useAuth } from "@/contexts/useAuth";
import { useAlertes } from "@/contexts/AlertesContext";
import { useState, useEffect, useCallback } from "react";
import { leaveRequestService, exitAuthorizationService } from "@/services/leaveService";
import { getQuestionnaires } from "@/services/questionnaireService";

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  subItems?: { label: string; path: string; badge?: number; badgeRed?: boolean }[];
};

export default function Sidebar() {
  const location = useLocation();
  const { user, logout, availableRoles } = useAuth();
  const { totalCount, urgentsCount } = useAlertes();

  const isRhManager = availableRoles.includes("manager1") || availableRoles.includes("manager2");

  // ── Badge questionnaires complétés ───────────────────────────────────────
  const [questionnaireDoneCount, setQuestionnaireDoneCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { count } = await getQuestionnaires("complete");
        setQuestionnaireDoneCount(count);
      } catch { /* silencieux */ }
    };
    fetch();
    const id = setInterval(fetch, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Badge approbation RH ──────────────────────────────────────────────────
  const [approvalPendingCount, setApprovalPendingCount] = useState(0);

  const fetchApprovalPending = useCallback(async () => {
    if (!isRhManager || !user?.employee_id) return;
    try {
      const results = await Promise.allSettled([
        leaveRequestService.getAll({ manager_employee_id: user.employee_id, status: "PENDING"        } as any),
        leaveRequestService.getAll({ manager_employee_id: user.employee_id, status: "PENDING_SECOND" } as any),
        leaveRequestService.getAll({ status: "PENDING_RH" } as any),
        exitAuthorizationService.getAll({ manager_employee_id: user.employee_id, status: "PENDING" }),
      ]);
      const get = (r: PromiseSettledResult<any[]>): any[] => r.status === "fulfilled" ? r.value : [];
      const [pendingMgr, pendingSecond, pendingRh, exits] = results.map(get);
      const eid = user.employee_id;
      const count =
        pendingMgr.filter((r: any)  => r.employee?.id  !== eid).length +
        pendingSecond.filter((r: any) => r.employee?.id !== eid).length +
        pendingRh.length +
        exits.filter((r: any) => r.employee?.id !== eid).length;
      setApprovalPendingCount(count);
    } catch {
      // silencieux
    }
  }, [isRhManager, user?.employee_id]);

  useEffect(() => {
    fetchApprovalPending();
    // Rafraîchit toutes les 60 secondes
    const id = setInterval(fetchApprovalPending, 60_000);
    return () => clearInterval(id);
  }, [fetchApprovalPending]);
  // ──────────────────────────────────────────────────────────────────────────

  const navItems: NavItem[] = [
    {
      label: "Tableau de bord",
      path: "/dashboard",
      icon: <LayoutDashboard size={20} />,
    },
    {
      label: "Gestion Employés",
      path: "/employees",
      icon: <Users2 size={20} />,
      subItems: [
        { label: "Internes",              path: "/employees/internes"       },
        { label: "Intérimaires",          path: "/employees/interims"       },
        { label: "Alertes",               path: "/employees/alertes",  badge: totalCount },
        { label: "Questionnaires sortie", path: "/employees/questionnaires", badge: questionnaireDoneCount || undefined, badgeRed: true },
      ],
    },
    {
      label: "Gestion Congés",
      path: "/leaves",
      icon: <CalendarDays size={20} />,
      subItems: [
        { label: "Internes",         path: "/leaves/internes"      },
        { label: "Intérimaires",     path: "/leaves/interimaires"  },
        { label: "Hiérarchie",       path: "/leaves/hierarchie"    },
        { label: "Autorisations",    path: "/leaves/autorisations" },
        { label: "Anticipation",     path: "/leaves/anticipation"  },
        { label: "Migration Soldes", path: "/leaves/migration"     },
      ],
    },
    {
      label: "Gestion Pointages",
      path: "/attendance",
      icon: <Clock size={20} />,
      subItems: [
        { label: "Normales",       path: "/attendance/normales"       },
        { label: "Shifts",         path: "/attendance/shifts"         },
        { label: "Justifications", path: "/attendance/justifications" },
        { label: "Jours fériés",   path: "/attendance/feries"         },
      ],
    },
    {
      label: "Bulletins Salariés",
      path: "/payslip",
      icon: <BadgeDollarSign size={20} />,
    },
    {
      label: "Gestion Ressources",
      path: "/rh/documents",
      icon: <FileStack size={20} />,
    },
    {
      label: "Demandes Attestations",
      path: "/rh/attestations",
      icon: <FileBadge size={20} />,
    },
    {
      label: "Mon espace",
      path: "/rh/my",
      icon: <UserCircle size={20} />,
      subItems: [
        { label: "Mes Congés",    path: "/rh/my-leaves"    },
        { label: "Mes Bulletins", path: "/rh/my-payslips"  },
        { label: "Mon Dossier",   path: "/rh/my-dossier"   },
        { label: "Équipe en congé",      path: "/rh/my-service-leaves" },
        { label: "Mes Sorties",          path: "/rh/my-exits"          },
        { label: "Questionnaire sortie", path: "/rh/my-questionnaire"  },
        ...(isRhManager
          ? [
              { label: "Mes Pointages", path: "/rh/my-attendance" },
              { label: "Approbation",   path: "/rh/my-approvals",  badge: approvalPendingCount, badgeRed: true },
            ]
          : []),
      ],
    },
  ];

  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (item.subItems?.some((s) => location.pathname.startsWith(s.path))) {
        initial[item.path] = true;
      }
    });
    return initial;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleMenu = (path: string) => {
    setOpenMenus((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const isParentActive = (item: NavItem) =>
    item.subItems
      ? item.subItems.some((s) => location.pathname.startsWith(s.path))
      : location.pathname.startsWith(item.path);

  const NavLink = ({ item, onClose }: { item: NavItem; onClose?: () => void }) => {
    const hasChildren = !!item.subItems?.length;
    const isOpen = openMenus[item.path] ?? false;
    const parentActive = isParentActive(item);

    // Badge agrégé sur le parent (nombre d'alertes)
    const parentBadge = item.subItems?.reduce((sum, s) => sum + (s.badge ?? 0), 0) ?? 0;
    const parentBadgeRed = item.subItems?.some(s => s.badgeRed && (s.badge ?? 0) > 0) ?? false;

    if (hasChildren) {
      return (
        <div>
          <button
            onClick={() => toggleMenu(item.path)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 ${
              parentActive
                ? "bg-camublue-900/10 text-camublue-900"
                : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Badge sur le parent quand le menu est fermé */}
              {!isOpen && parentBadge > 0 && (
                <span className={`min-w-[20px] h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1.5 leading-none ${
                  parentBadgeRed || urgentsCount > 0 ? "bg-red-500" : "bg-amber-500"
                }`}>
                  {parentBadge}
                </span>
              )}
              {isOpen ? (
                <ChevronDown size={15} className="text-gray-400" />
              ) : (
                <ChevronRight size={15} className="text-gray-400" />
              )}
            </div>
          </button>

          {isOpen && (
            <div className="mt-1 ml-9 flex flex-col gap-0.5 border-l-2 border-camublue-900/20 pl-3">
              {item.subItems!.map((sub) => {
                const isActive = location.pathname.startsWith(sub.path);
                return (
                  <Link
                    key={sub.path}
                    to={sub.path}
                    onClick={onClose}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-camublue-900 text-white shadow-sm"
                        : "text-gray-600 hover:bg-camublue-900/10 hover:text-camublue-900"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-white" : "bg-gray-400"}`} />
                    <span className="flex-1 truncate">{sub.label}</span>
                    {/* Badge sur le sous-item */}
                    {(sub.badge ?? 0) > 0 && (
                      <span className={`min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1.5 leading-none ${
                        isActive
                          ? "bg-white/20 text-white"
                          : sub.badgeRed || urgentsCount > 0
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {sub.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={onClose}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-150 ${
          isActive
            ? "bg-camublue-900 text-white shadow-sm"
            : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
        }`}
      >
        <span className="shrink-0">{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const visibleNavItems = user?.is_planning_manager
    ? [{ label: "Planning Shifts", path: "/planning", icon: <CalendarRange size={20} /> }]
    : navItems;

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      {user?.is_planning_manager && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-camublue-900/10 text-camublue-900 text-xs font-semibold flex items-center gap-2">
          <CalendarRange size={14} />
          Gestionnaire de Planning
        </div>
      )}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {visibleNavItems.map((item) => (
          <NavLink key={item.path} item={item} onClose={onClose} />
        ))}
      </nav>
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
