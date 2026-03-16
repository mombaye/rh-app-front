import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import PayslipPage from "@/pages/PayslipPage";
import LeavePage from "@/pages/LeavePage";
import ChangePasswordPage from "@/components/users/ChangePasswordPage";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "@/components/ProtectedRoute";
import FirstLoginGuard from "@/components/FirstLoginGuard";
import InterimEmployeesPage from "@/pages/InterimEmployeesPage";
import InterneEmployeesPage from "./pages/InterneEmployeesPage";
import AttendanceNormalesPage from "@/pages/AttendanceNormalesPage";
import AttendanceShiftsPage from "@/pages/Attendanceshiftspage";
import PlanningPage from "@/pages/PlanningPage";
import { useAuth } from "@/contexts/useAuth";

/** Redirige les gestionnaires de planning vers /planning */
function PlanningManagerRedirect({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.is_planning_manager) {
    return <Navigate to="/planning" replace />;
  }
  return <>{children}</>;
}

/** Protège les routes accessibles uniquement aux non-planning-managers */
function NonPlanningRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.is_planning_manager) {
    return <Navigate to="/planning" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        {/* ── Main App ───────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />

        {/* Changement de mot de passe toujours accessible si first_login */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        {/* Page dédiée au gestionnaire de planning */}
        <Route
          path="/planning"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <PlanningPage />
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        {/* Toutes les autres pages protégées — redirigées vers /planning pour planning managers */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <NonPlanningRoute>
                  <DashboardPage />
                </NonPlanningRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees/internes"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <NonPlanningRoute>
                  <InterneEmployeesPage />
                </NonPlanningRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees/interims"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <NonPlanningRoute>
                  <InterimEmployeesPage />
                </NonPlanningRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/payslip"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <NonPlanningRoute>
                  <PayslipPage />
                </NonPlanningRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={<Navigate to="/attendance/normales" replace />}
        />

        <Route
          path="/attendance/normales"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <NonPlanningRoute>
                  <AttendanceNormalesPage />
                </NonPlanningRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance/shifts"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <NonPlanningRoute>
                  <AttendanceShiftsPage />
                </NonPlanningRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaves"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <NonPlanningRoute>
                  <LeavePage />
                </NonPlanningRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        {/* Redirection par défaut */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default App;
