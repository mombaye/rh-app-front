// components/Sidebar.tsx
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users2,
  BadgeDollarSign,
  Menu,
  X,
  Clock,
} from "lucide-react";
import logo from "@/assets/images/camusat-logo.png";
import { useState } from "react";

const navItems = [
  { label: "Tableau de bord", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Employés", path: "/employees", icon: <Users2 size={20} /> },
  { label: "Bulletins Salariés", path: "/payslip", icon: <BadgeDollarSign size={20} /> },
  { label: "Pointages", path: "/attendance", icon: <Clock size={20} /> },
  // ... ajoute tes autres modules ici
];

export default function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean, setMobileOpen: (open: boolean) => void }) {
  const location = useLocation();

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="bg-white shadow-md w-64 min-h-screen hidden md:flex flex-col border-r">
        <div className="p-6 border-b">
          <img src={logo} alt="Camusat" className="h-10 mx-auto" />
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-150 ${
                location.pathname === item.path
                  ? "bg-camublue-900 text-white shadow"
                  : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Drawer mobile */}
      <div className={`fixed z-40 inset-0 bg-black/40 transition-opacity ${mobileOpen ? 'block md:hidden' : 'hidden'}`} onClick={() => setMobileOpen(false)} />
      <aside className={`fixed z-50 top-0 left-0 h-full w-64 bg-white shadow-md border-r transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden`}>
        <div className="flex items-center justify-between p-6 border-b">
          <img src={logo} alt="Camusat" className="h-10" />
          <button onClick={() => setMobileOpen(false)}>
            <X size={28} className="text-camublue-900" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-150 ${
                location.pathname === item.path
                  ? "bg-camublue-900 text-white shadow"
                  : "text-gray-700 hover:bg-camublue-900/10 hover:text-camublue-900"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
