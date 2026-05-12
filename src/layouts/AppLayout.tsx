// layouts/AppLayout.tsx
import Sidebar from "@/components/Sidebar";
import { AlertesProvider } from "@/contexts/AlertesContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlertesProvider>
      <div className="flex min-h-screen bg-camugray-100">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <main className="flex-1 pt-16 md:p-8">{children}</main>
        </div>
      </div>
    </AlertesProvider>
  );
}
