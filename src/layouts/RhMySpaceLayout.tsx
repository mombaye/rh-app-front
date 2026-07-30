import { useNavigate } from "react-router-dom";
import RhMySpaceSidebar from "@/components/rh/RhMySpaceSidebar";
import { ArrowLeft } from "lucide-react";

export default function RhMySpaceLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-camugray-100">
      <RhMySpaceSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="fixed top-0 right-0 left-0 md:left-72 z-30 h-14 bg-white border-b border-gray-100 shadow-sm flex items-center justify-end px-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-camublue-900 border border-camublue-900/20 bg-camublue-900/5 hover:bg-camublue-900/10 transition-colors"
          >
            <ArrowLeft size={15} />
            Retour espace RH
          </button>
        </header>

        <main className="flex-1 pt-14 md:p-8 md:pt-20">{children}</main>
      </div>
    </div>
  );
}
