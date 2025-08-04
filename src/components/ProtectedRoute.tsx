import { useAuth } from "@/contexts/useAuth";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="text-center mt-16">Chargement…</div>;

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
