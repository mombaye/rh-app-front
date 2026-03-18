import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type UserRole, dashboardForRole } from "@/contexts/useAuth";
import { UserRound, Users, ShieldCheck, Calendar, Check, ArrowLeftRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const ROLE_META: Record<UserRole, { label: string; description: string; Icon: React.ElementType; colorClass: string; bg: string }> = {
  employe:  { label: "Espace Employé",    description: "Congés, bulletins, pointages",  Icon: UserRound,   colorClass: "text-blue-600",        bg: "bg-blue-50"        },
  manager1: { label: "Espace Manager N1", description: "Validation des demandes",       Icon: Users,       colorClass: "text-purple-600",      bg: "bg-purple-50"      },
  manager2: { label: "Espace Manager N2", description: "Supervision multi-équipes",     Icon: Users,       colorClass: "text-violet-600",      bg: "bg-violet-50"      },
  rh:       { label: "Espace RH",         description: "Gestion des ressources humaines", Icon: ShieldCheck, colorClass: "text-[#003c71]",       bg: "bg-[#003c71]/8"    },
  planning: { label: "Espace Planning",   description: "Gestion des plannings",         Icon: Calendar,    colorClass: "text-green-600",       bg: "bg-green-50"       },
};

export default function RoleSwitcher() {
  const { activeRole, availableRoles, switchRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (availableRoles.length < 2 || !activeRole) return null;
  const current = ROLE_META[activeRole];
  if (!current) return null;

  const handleSwitch = (role: UserRole) => {
    setOpen(false);
    switchRole(role);
    // Un manager qui bascule en mode "Employé" reste dans l'interface Manager
    // (seul le bouton Approbations sera désactivé, pas besoin d'une 2e interface).
    if (role === "employe" && (availableRoles.includes("manager1") || availableRoles.includes("manager2"))) {
      navigate("/manager/dashboard");
    } else {
      navigate(dashboardForRole(role));
    }
  };

  return (
    <>
      {/* Bouton déclencheur */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-camublue-900/8 hover:bg-camublue-900/15 text-camublue-900 text-xs font-semibold transition border border-camublue-900/15 w-full"
        title="Changer d'espace"
      >
        <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
        <span className="flex-1 text-left truncate">{current.label}</span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
               onClick={() => setOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* En-tête */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#003c71]/10 flex items-center justify-center">
                    <ArrowLeftRight size={15} className="text-[#003c71]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Changer d'espace</p>
                    <p className="text-xs text-gray-400">Espace actif : {current.label}</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
                  <X size={16} />
                </button>
              </div>

              {/* Liste des espaces */}
              <div className="p-3 space-y-2">
                {availableRoles.map((role) => {
                  const meta = ROLE_META[role];
                  if (!meta) return null;
                  const isActive = role === activeRole;
                  return (
                    <button
                      key={role}
                      onClick={() => handleSwitch(role)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition ${
                        isActive
                          ? "bg-[#003c71]/8 border border-[#003c71]/20"
                          : "bg-gray-50 border border-transparent hover:border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <div className={`w-9 h-9 ${meta.bg} rounded-xl flex items-center justify-center shrink-0`}>
                        <meta.Icon className={`h-4.5 w-4.5 ${meta.colorClass}`} size={18} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isActive ? "text-[#003c71]" : "text-gray-800"}`}>
                          {meta.label}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{meta.description}</p>
                      </div>
                      {isActive && (
                        <div className="w-5 h-5 rounded-full bg-[#003c71] flex items-center justify-center shrink-0">
                          <Check size={11} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
