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
// Manager pages
import ManagerDashboardPage  from "@/pages/manager/ManagerDashboardPage";
import ManagerLeavesPage     from "@/pages/manager/ManagerLeavesPage";
import ManagerPayslipPage    from "@/pages/manager/ManagerPayslipPage";
import ManagerDossierPage    from "@/pages/manager/ManagerDossierPage";
import ManagerApprovalsPage  from "@/pages/manager/ManagerApprovalsPage";
import { useAuth } from "@/contexts/useAuth";

// ── Helpers de rôles ─────────────────────────────────────────────────────────
const isManager = (user: any) => user?.manager_level != null;
const isRH      = (user: any) => user?.is_staff || user?.is_global_admin;
const isPlanning = (user: any) => user?.is_planning_manager;

/** Redirige les gestionnaires de planning vers /planning */
function PlanningManagerRedirect({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (isPlanning(user)) return <Navigate to="/planning" replace />;
  return <>{children}</>;
}

function NonPlanningRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (isPlanning(user)) return <Navigate to="/planning" replace />;
  return <>{children}</>;
}

/** RH/admin uniquement → redirige les autres vers leur espace */
function RhOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (isManager(user) && !isRH(user)) return <Navigate to="/manager/dashboard" replace />;
  if (!isRH(user) && !isManager(user)) return <Navigate to="/employee/dashboard" replace />;
  return <>{children}</>;
}

/** Employé uniquement → redirige RH et managers */
function EmployeeOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (isRH(user))      return <Navigate to="/dashboard"          replace />;
  if (isManager(user)) return <Navigate to="/manager/dashboard"  replace />;
  return <>{children}</>;
}

/** Manager uniquement → redirige les autres */
function ManagerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (isRH(user))      return <Navigate to="/dashboard"          replace />;
  if (!isManager(user)) return <Navigate to="/employee/dashboard" replace />;
  return <>{children}</>;
}

// ── Wrapper pour les routes Manager avec guard ────────────────────────────────
function MgrRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <FirstLoginGuard>
        <NonPlanningRoute>
          <ManagerOnlyRoute>
            {children}
          </ManagerOnlyRoute>
        </NonPlanningRoute>
      </FirstLoginGuard>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        {/* ── Admin Portal ─────────────────────────────────────── */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboardPage />
            </AdminProtectedRoute>
          }
        />

        {/* ── Welcome / Accueil ────────────────────────────────── */}
        <Route path="/" element={<WelcomePage />} />

        {/* ── Auth ─────────────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        {/* ── Espace Employé ───────────────────────────────────── */}
        <Route path="/employee/dashboard" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeDashboardPage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/leaves" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeLeavesPage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/payslips" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeePayslipPage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/dossier" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeDossierPage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />

        {/* ── Espace Manager ───────────────────────────────────── */}
        <Route path="/manager/dashboard"  element={<MgrRoute><ManagerDashboardPage  /></MgrRoute>} />
        <Route path="/manager/leaves"     element={<MgrRoute><ManagerLeavesPage     /></MgrRoute>} />
        <Route path="/manager/payslips"   element={<MgrRoute><ManagerPayslipPage    /></MgrRoute>} />
        <Route path="/manager/dossier"    element={<MgrRoute><ManagerDossierPage    /></MgrRoute>} />
        <Route path="/manager/approvals"  element={<MgrRoute><ManagerApprovalsPage  /></MgrRoute>} />

        {/* ── Planning Manager ─────────────────────────────────── */}
        <Route path="/planning" element={
          <ProtectedRoute><FirstLoginGuard>
            <PlanningPage />
          </FirstLoginGuard></ProtectedRoute>
        } />

        {/* ── Espace RH ────────────────────────────────────────── */}
        <Route path="/dashboard" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <DashboardPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employees/internes" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <InterneEmployeesPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employees/interims" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <InterimEmployeesPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/payslip" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <PayslipPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/attendance" element={<Navigate to="/attendance/normales" replace />} />
        <Route path="/attendance/normales" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <AttendanceNormalesPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/attendance/shifts" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <AttendanceShiftsPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/leaves" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <LeavePage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
