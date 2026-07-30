import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import AppLayout from "@/layouts/AppLayout";
import {
  ArrowLeft,
  CalendarDays,
  BadgeDollarSign,
  FolderOpen,
  Users,
  Clock,
  LogOut,
  Stethoscope,
  ClipboardList,
  CheckSquare,
} from "lucide-react";

type SpaceCard = {
  label: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  managerOnly?: boolean;
};

const cards: SpaceCard[] = [
  {
    label: "Demande de congé",
    description: "Soumettre et suivre vos demandes de congé",
    path: "/rh/my-leaves",
    icon: <CalendarDays size={28} />,
    color: "bg-blue-50 text-blue-600 border-blue-100",
  },
  {
    label: "Bulletins de salaires",
    description: "Consulter vos bulletins de paie",
    path: "/rh/my-payslips",
    icon: <BadgeDollarSign size={28} />,
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
  {
    label: "Mes Dossiers RH",
    description: "Accéder à vos documents et dossiers personnels",
    path: "/rh/my-dossier",
    icon: <FolderOpen size={28} />,
    color: "bg-amber-50 text-amber-600 border-amber-100",
  },
  {
    label: "Équipe en congés",
    description: "Voir les congés en cours dans votre équipe",
    path: "/rh/my-service-leaves",
    icon: <Users size={28} />,
    color: "bg-violet-50 text-violet-600 border-violet-100",
  },
  {
    label: "Mes Pointages",
    description: "Consulter votre historique de pointages",
    path: "/rh/my-attendance",
    icon: <Clock size={28} />,
    color: "bg-cyan-50 text-cyan-600 border-cyan-100",
  },
  {
    label: "Demande de sortie",
    description: "Soumettre une autorisation de sortie",
    path: "/rh/my-exits",
    icon: <LogOut size={28} />,
    color: "bg-orange-50 text-orange-600 border-orange-100",
  },
  {
    label: "Infirmerie",
    description: "Consulter vos visites médicales et soins",
    path: "/rh/my-infirmerie",
    icon: <Stethoscope size={28} />,
    color: "bg-rose-50 text-rose-600 border-rose-100",
  },
  {
    label: "Questionnaire sortie",
    description: "Compléter votre questionnaire de sortie",
    path: "/rh/my-questionnaire",
    icon: <ClipboardList size={28} />,
    color: "bg-teal-50 text-teal-600 border-teal-100",
  },
  {
    label: "Approbation",
    description: "Gérer les demandes en attente de votre validation",
    path: "/rh/my-approvals",
    icon: <CheckSquare size={28} />,
    color: "bg-indigo-50 text-indigo-600 border-indigo-100",
    managerOnly: true,
  },
];

export default function RhMySpacePage() {
  const navigate = useNavigate();
  const { availableRoles } = useAuth();
  const isRhManager =
    availableRoles.includes("manager1") || availableRoles.includes("manager2");

  const visibleCards = cards.filter((c) => !c.managerOnly || isRhManager);

  return (
    <AppLayout>
      <div className="flex flex-col h-full px-6 py-6 gap-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-camublue-900 transition-colors"
          >
            <ArrowLeft size={18} />
            Retour espace RH
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-xl font-bold text-gray-800">Mon espace employé</h1>
            <p className="text-sm text-gray-500">
              Accédez à vos fonctionnalités personnelles en tant qu'employé
            </p>
          </div>
        </div>

        {/* Séparateur visuel */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-camublue-900/20 to-transparent" />
          <span className="text-xs font-semibold text-camublue-900/60 uppercase tracking-wider">
            Mes fonctionnalités
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-camublue-900/20 to-transparent" />
        </div>

        {/* Grille de cartes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleCards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="group flex flex-col items-start gap-3 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-camublue-900/20 transition-all duration-200 text-left"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center border ${card.color} transition-transform duration-200 group-hover:scale-110`}
              >
                {card.icon}
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{card.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  {card.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
