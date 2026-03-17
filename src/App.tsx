import { Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "@/pages/WelcomePage";
import LoginPage from "@/pages/LoginPage";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminProtectedRoute from "@/components/admin/AdminProtectedRoute";
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
import EmployeeDashboardPage from "@/pages/employee/EmployeeDashboardPage";
import EmployeeLeavesPage from "@/pages/employee/EmployeeLeavesPage";
import EmployeePayslipPage from "@/pages/employee/EmployeePayslipPage";
import EmployeeDossierPage from "@/pages/employee/EmployeeDossierPage";
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

/** Redirige les employés (sans is_staff ni manager_level) vers /employee/* */
function RhOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && !user.is_staff && !user.is_global_admin && user.manager_level == null) {
    return <Navigate to="/employee/dashboard" replace />;
  }
  return <>{children}</>;
}

/** Redirige les comptes RH/admin vers /dashboard (pas l'espace employé) */
function EmployeeOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && (user.is_staff || user.is_global_admin || user.manager_level != null)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        {/* ── Admin Portal ───────────────────────────────── */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboardPage />
            </AdminProtectedRoute>
          }
        />

        {/* ── Welcome / Accueil ──────────────────────────── */}
        <Route path="/" element={<WelcomePage />} />

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

        {/* ── Espace Employé ─────────────────────────────── */}
        <Route
          path="/employee/dashboard"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <EmployeeOnlyRoute>
                  <EmployeeDashboardPage />
                </EmployeeOnlyRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/leaves"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <EmployeeOnlyRoute>
                  <EmployeeLeavesPage />
                </EmployeeOnlyRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/payslips"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <EmployeeOnlyRoute>
                  <EmployeePayslipPage />
                </EmployeeOnlyRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/dossier"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <EmployeeOnlyRoute>
                  <EmployeeDossierPage />
                </EmployeeOnlyRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        {/* ── Page dédiée au gestionnaire de planning ─────── */}
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

        {/* ── Espace RH / Manager ────────────────────────── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <NonPlanningRoute>
                  <RhOnlyRoute>
                    <DashboardPage />
                  </RhOnlyRoute>
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
                  <RhOnlyRoute>
                    <InterneEmployeesPage />
                  </RhOnlyRoute>
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
                  <RhOnlyRoute>
                    <InterimEmployeesPage />
                  </RhOnlyRoute>
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
                  <RhOnlyRoute>
                    <PayslipPage />
                  </RhOnlyRoute>
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
                  <RhOnlyRoute>
                    <AttendanceNormalesPage />
                  </RhOnlyRoute>
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
                  <RhOnlyRoute>
                    <AttendanceShiftsPage />
                  </RhOnlyRoute>
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
                  <RhOnlyRoute>
                    <LeavePage />
                  </RhOnlyRoute>
                </NonPlanningRoute>
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        {/* Redirection par défaut */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
