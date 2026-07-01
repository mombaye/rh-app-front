import { useAuth } from "@/contexts/useAuth";
import { Navigate, useLocation } from "react-router-dom";

// Bloque l'accès à la page si first_login === true (sauf sur /change-password)
export default function FirstLoginGuard({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user?.first_login && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}
