import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import { useAuth } from "@/contexts/useAuth";
import { JSX } from "react";
import "./index.css";
import EmployeesPage from "./pages/EmployeesPage";
import { Toaster } from "react-hot-toast"; // ✅ Ajout du toaster
import PayslipPage from "./pages/PayslipPage";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="text-center mt-16">Chargement…</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Router>
      {/* ✅ Toaster visible sur toutes les pages */}
      <Toaster position="top-right" reverseOrder={false} />

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payslip"
          element={
            <ProtectedRoute>
              <PayslipPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
