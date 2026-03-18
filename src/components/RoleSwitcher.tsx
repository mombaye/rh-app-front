import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type UserRole, dashboardForRole } from "@/contexts/useAuth";
import { ChevronDown, UserRound, Users, ShieldCheck, Calendar, Check, ArrowLeftRight } from "lucide-react";

const ROLE_META: Record<UserRole, { label: string; Icon: React.ElementType; colorClass: string }> = {
  employe:  { label: "Employé",    Icon: UserRound,   colorClass: "text-blue-600"     },
  manager1: { label: "Manager N1", Icon: Users,       colorClass: "text-purple-600"   },
  manager2: { label: "Manager N2", Icon: Users,       colorClass: "text-violet-600"   },
  rh:       { label: "Espace RH",  Icon: ShieldCheck, colorClass: "text-camublue-900" },
  planning: { label: "Planning",   Icon: Calendar,    colorClass: "text-green-600"    },
};

/** Shown only when the user has 2+ roles. Allows switching between spaces without logging out. */
export default function RoleSwitcher() {
  const { activeRole, availableRoles, switchRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (availableRoles.length < 2 || !activeRole) return null;

  const current = ROLE_META[activeRole];
  if (!current) return null;

  const handleSwitch = (role: UserRole) => {
    setOpen(false);
    switchRole(role);
    navigate(dashboardForRole(role));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-camublue-900/8 hover:bg-camublue-900/15 text-camublue-900 text-xs font-semibold transition border border-camublue-900/15"
        title="Changer d'espace"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span>{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100 mb-1">
            Changer d'espace
          </div>
          {availableRoles.map((role) => {
            const meta = ROLE_META[role];
            if (!meta) return null;
            const isActive = role === activeRole;
            return (
              <button
                key={role}
                onClick={() => handleSwitch(role)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${isActive ? "font-semibold bg-slate-50" : ""}`}
              >
                <meta.Icon className={`h-4 w-4 flex-shrink-0 ${meta.colorClass}`} strokeWidth={2} />
                <span className="flex-1 text-slate-700">{meta.label}</span>
                {isActive && <Check className="h-3.5 w-3.5 text-camublue-900" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
