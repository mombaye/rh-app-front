import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users2,
  BadgeDollarSign,
  // autres icones pour la suite...
} from "lucide-react";
import logo from "@/assets/images/camusat-logo.png";

const navItems = [
  { label: "Tableau de bord", path: "/", icon: <LayoutDashboard size={20} /> },
  { label: "Employés", path: "/employees", icon: <Users2 size={20} /> },
  { label: "Bulletins Salariés", path: "/payslip", icon: <BadgeDollarSign size={20} /> },
  // { label: "Justificatifs", path: "/justifs", icon: <FolderOpen size={20} /> },
  // etc...
];

export default function Sidebar() {
  const location = useLocation();
  return (
    <aside className="bg-white shadow-md w-64 min-h-screen hidden md:flex flex-col border-r">
      <div className="p-6 border-b">
        <img src={logo} alt="Camusat" className="h-10 mx-auto" />
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${
              location.pathname === item.path
                ? "bg-camublue-900 text-white"
                : "text-gray-700 hover:bg-camublue-900/10"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
