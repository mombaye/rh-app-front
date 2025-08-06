// components/Header.tsx
import { Menu } from "lucide-react";

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b shadow-sm h-16 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Menu mobile visible uniquement sur mobile */}
        <button className="md:hidden" onClick={onMenuClick}>
          <Menu size={28} className="text-camublue-900" />
        </button>
        <h1 className="text-lg font-semibold text-camublue-900 select-none">
          Bienvenue 👋
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <img
          src="https://ui-avatars.com/api/?name=Utilisateur&background=003c71&color=fff"
          alt="Avatar"
          className="h-10 w-10 rounded-full border shadow"
        />
      </div>
    </header>
  );
}
