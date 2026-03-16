import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/useAdminAuth";

export default function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-camugray-100">
        <div className="w-8 h-8 border-4 border-camublue-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
