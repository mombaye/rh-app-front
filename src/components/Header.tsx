import { Menu } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 bg-white border-b shadow-sm h-16 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <Menu className="md:hidden text-camublue-900" />
        <h1 className="text-lg font-semibold text-camublue-900">
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
