import { useAuth } from "@/contexts/useAuth";
import { LogOut } from "lucide-react";

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between h-16 px-4 shadow-sm bg-white border-b border-gray-200 z-10">
      <button
        className="md:hidden mr-2"
        onClick={onMenuClick}
        aria-label="Ouvrir la navigation"
      >
        {/* Burger menu */}
        <svg className="h-7 w-7 text-camublue-900" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
      <h1 className="text-lg font-semibold text-camublue-900 select-none">
          Bienvenue 👋
        </h1>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        {user && (
          <>
            {/* Affiche prénom nom si dispo, sinon username */}
            <span className="font-medium text-camublue-900">
              {user.username
                ? `${user.username}`
                : user.username || user.email}
            </span>
            <button
              className="ml-3 rounded-xl bg-gray-100 hover:bg-camublue-900 hover:text-white transition flex items-center gap-2 px-3 py-1 shadow-sm"
              onClick={logout}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
