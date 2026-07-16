import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ChangePasswordPage from "@/components/users/ChangePasswordPage";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "@/components/ProtectedRoute";
import FirstLoginGuard from "@/components/FirstLoginGuard";
import AdminProtectedRoute from "@/components/admin/AdminProtectedRoute";
import { useAuth } from "@/contexts/useAuth";

// ── Pages chargées à la demande (code-splitting) ─────────────────────────────
// Chaque page est découpée dans son propre chunk JS, chargé uniquement
// lorsque l'utilisateur navigue vers la route correspondante.
// Cela réduit considérablement la taille du bundle initial et accélère
// le premier affichage de l'application.
const WelcomePage              = lazy(() => import("@/pages/WelcomePage"));
const LoginPage                = lazy(() => import("@/pages/LoginPage"));
const ForgotPasswordPage       = lazy(() => import("@/pages/ForgotPasswordPage"));
const AdminLoginPage           = lazy(() => import("@/pages/admin/AdminLoginPage"));
const AdminDashboardPage       = lazy(() => import("@/pages/admin/AdminDashboardPage"));
const DashboardPage            = lazy(() => import("@/pages/DashboardPage"));
const PayslipPage              = lazy(() => import("@/pages/PayslipPage"));
const LeavePage                = lazy(() => import("@/pages/LeavePage"));
const LeavesHierarchiePage     = lazy(() => import("@/pages/LeavesHierarchiePage"));
const LeavesMigrationPage      = lazy(() => import("@/pages/LeavesMigrationPage"));
const InterimEmployeesPage     = lazy(() => import("@/pages/InterimEmployeesPage"));
const InterneEmployeesPage     = lazy(() => import("@/pages/InterneEmployeesPage"));
const GlobalEmployeesPage      = lazy(() => import("@/pages/GlobalEmployeesPage"));
const AlertesEmployesPage      = lazy(() => import("@/pages/AlertesEmployesPage"));
const GestionQuestionnairesPage    = lazy(() => import("@/pages/GestionQuestionnairesPage"));
const EmployeesDisciplinaryPage    = lazy(() => import("@/pages/EmployeesDisciplinaryPage"));
const QuestionnaireSortiePage  = lazy(() => import("@/pages/QuestionnaireSortiePage"));
const AttendanceNormalesPage   = lazy(() => import("@/pages/AttendanceNormalesPage"));
const AttendanceShiftsPage     = lazy(() => import("@/pages/Attendanceshiftspage"));
const AttendanceJustificationsPage = lazy(() => import("@/pages/AttendanceJustificationsPage"));
const AttendanceFeriesPage     = lazy(() => import("@/pages/AttendanceFeriesPage"));
const PlanningPage             = lazy(() => import("@/pages/PlanningPage"));

// Espace Employé
const EmployeeMissionsPage          = lazy(() => import("@/pages/employee/EmployeeMissionsPage"));
const EmployeeInfirmeriePage        = lazy(() => import("@/pages/employee/EmployeeInfirmeriePage"));
const EmployeeDashboardPage         = lazy(() => import("@/pages/employee/EmployeeDashboardPage"));
const EmployeeLeavesPage            = lazy(() => import("@/pages/employee/EmployeeLeavesPage"));
const EmployeePayslipPage           = lazy(() => import("@/pages/employee/EmployeePayslipPage"));
const EmployeeDossierPage           = lazy(() => import("@/pages/employee/EmployeeDossierPage"));
const EmployeeAttendancePage        = lazy(() => import("@/pages/employee/EmployeeAttendancePage"));
const EmployeeDocumentsPage         = lazy(() => import("@/pages/employee/EmployeeDocumentsPage"));
const EmployeeExitAuthorizationPage = lazy(() => import("@/pages/employee/EmployeeExitAuthorizationPage"));
const EmployeeServiceLeavesPage     = lazy(() => import("@/pages/employee/EmployeeServiceLeavesPage"));
const EmployeeQuestionnairePage     = lazy(() => import("@/pages/employee/EmployeeQuestionnairePage"));
const EmployeeAttestationsPage      = lazy(() => import("@/pages/employee/EmployeeAttestationsPage"));

// Espace Manager
const ManagerDashboardPage          = lazy(() => import("@/pages/manager/ManagerDashboardPage"));
const ManagerLeavesPage              = lazy(() => import("@/pages/manager/ManagerLeavesPage"));
const ManagerExitAuthorizationPage  = lazy(() => import("@/pages/manager/ManagerExitAuthorizationPage"));
const ManagerPayslipPage      = lazy(() => import("@/pages/manager/ManagerPayslipPage"));
const ManagerDossierPage      = lazy(() => import("@/pages/manager/ManagerDossierPage"));
const ManagerApprovalsPage    = lazy(() => import("@/pages/manager/ManagerApprovalsPage"));
const ManagerDocumentsPage    = lazy(() => import("@/pages/manager/ManagerDocumentsPage"));
const ManagerTeamLeavesPage   = lazy(() => import("@/pages/manager/ManagerTeamLeavesPage"));
const ManagerAttestationsPage = lazy(() => import("@/pages/manager/ManagerAttestationsPage"));
const ManagerAttendancePage   = lazy(() => import("@/pages/manager/ManagerAttendancePage"));

// Espace RH — espace employé
const RhLeavesPage              = lazy(() => import("@/pages/rh/RhLeavesPage"));
const RhPayslipPage             = lazy(() => import("@/pages/rh/RhPayslipPage"));
const RhDossierPage             = lazy(() => import("@/pages/rh/RhDossierPage"));
const RhAttendancePage          = lazy(() => import("@/pages/rh/RhAttendancePage"));
const RhApprovalsPage           = lazy(() => import("@/pages/rh/RhApprovalsPage"));
const RhDocumentsPage           = lazy(() => import("@/pages/rh/RhDocumentsPage"));
const RhExitAuthorizationPage   = lazy(() => import("@/pages/rh/RhExitAuthorizationPage"));
const RhMyExitAuthorizationPage = lazy(() => import("@/pages/rh/RhMyExitAuthorizationPage"));
const RhQuestionnairePage       = lazy(() => import("@/pages/rh/RhQuestionnairePage"));
const RhServiceLeavesPage       = lazy(() => import("@/pages/rh/RhServiceLeavesPage"));
const RhAnticipationPage        = lazy(() => import("@/pages/rh/RhAnticipationPage"));
const RhAttestationsPage        = lazy(() => import("@/pages/rh/RhAttestationsPage"));
const RhMissionsPage            = lazy(() => import("@/pages/rh/RhMissionsPage"));

// HSE
const PassportManagementPage    = lazy(() => import("@/pages/hse/PassportManagementPage"));
const PassportViewPage          = lazy(() => import("@/pages/hse/PassportViewPage"));

// ── Fallback de chargement ────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="h-10 w-10 border-4 border-camublue-900/20 border-t-camublue-900 rounded-full animate-spin" />
    </div>
  );
}

// ── Helpers de rôles basés sur activeRole ────────────────────────────────────

function NonPlanningRoute({ children }: { children: React.ReactNode }) {
  const { activeRole } = useAuth();
  if (activeRole === "planning") return <Navigate to="/planning" replace />;
  return <>{children}</>;
}

/** RH uniquement → redirige si activeRole n'est pas "rh" */
function RhOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, activeRole } = useAuth();
  if (!user) return null;
  if (activeRole === "rh") return <>{children}</>;
  if (activeRole === "manager1" || activeRole === "manager2") return <Navigate to="/manager/dashboard" replace />;
  return <Navigate to="/employee/dashboard" replace />;
}

/** Employé uniquement → redirige si activeRole n'est pas "employe" */
function EmployeeOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, activeRole } = useAuth();
  if (!user) return null;
  if (activeRole === "employe") return <>{children}</>;
  if (activeRole === "rh") return <Navigate to="/dashboard" replace />;
  if (activeRole === "manager1" || activeRole === "manager2") return <Navigate to="/manager/dashboard" replace />;
  return <Navigate to="/employee/dashboard" replace />;
}

/** Accessible uniquement au responsable HSE (user.is_hse === true) */
function HseOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.is_hse) return <>{children}</>;
  return <Navigate to="/dashboard" replace />;
}

/** Accessible si l'utilisateur a au moins un rôle manager (même en mode Employé). */
function ManagerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, activeRole, availableRoles } = useAuth();
  if (!user) return null;
  if (activeRole === "manager1" || activeRole === "manager2") return <>{children}</>;
  // Un manager en mode Employé reste dans l'interface Manager
  if (activeRole === "employe" && (availableRoles.includes("manager1") || availableRoles.includes("manager2")))
    return <>{children}</>;
  if (activeRole === "rh") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/employee/dashboard" replace />;
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
      <Suspense fallback={<PageLoader />}>
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
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
        <Route path="/employee/attendance" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeAttendancePage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/documents" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeDocumentsPage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/attestations" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeAttestationsPage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/exits" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeExitAuthorizationPage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/service-leaves" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeServiceLeavesPage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/questionnaire" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeQuestionnairePage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/missions" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeMissionsPage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employee/infirmerie" element={
          <ProtectedRoute><FirstLoginGuard><EmployeeOnlyRoute>
            <EmployeeInfirmeriePage />
          </EmployeeOnlyRoute></FirstLoginGuard></ProtectedRoute>
        } />

        {/* ── Espace Manager ───────────────────────────────────── */}
        <Route path="/manager/dashboard"  element={<MgrRoute><ManagerDashboardPage         /></MgrRoute>} />
        <Route path="/manager/leaves"      element={<MgrRoute><ManagerLeavesPage            /></MgrRoute>} />
        <Route path="/manager/attendance"  element={<MgrRoute><ManagerAttendancePage         /></MgrRoute>} />
        <Route path="/manager/exits"      element={<MgrRoute><ManagerExitAuthorizationPage /></MgrRoute>} />
        <Route path="/manager/payslips"   element={<MgrRoute><ManagerPayslipPage           /></MgrRoute>} />
        <Route path="/manager/dossier"    element={<MgrRoute><ManagerDossierPage           /></MgrRoute>} />
        <Route path="/manager/approvals"   element={<MgrRoute><ManagerApprovalsPage         /></MgrRoute>} />
        <Route path="/manager/documents"    element={<MgrRoute><ManagerDocumentsPage          /></MgrRoute>} />
        <Route path="/manager/attestations" element={<MgrRoute><ManagerAttestationsPage       /></MgrRoute>} />
        <Route path="/manager/team-leaves" element={<MgrRoute><ManagerTeamLeavesPage        /></MgrRoute>} />

        {/* ── Planning Manager ─────────────────────────────────── */}
        <Route path="/planning" element={
          <ProtectedRoute><FirstLoginGuard>
            <PlanningPage />
          </FirstLoginGuard></ProtectedRoute>
        } />

        {/* ── Espace RH — espace employé ───────────────────────── */}
        <Route path="/rh/my-leaves"      element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhLeavesPage     /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/my-payslips"    element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhPayslipPage    /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/my-dossier"     element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhDossierPage    /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/my-attendance"  element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhAttendancePage /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/my-approvals"   element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhApprovalsPage  /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/my-exits"        element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhMyExitAuthorizationPage /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/my-questionnaire"  element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhQuestionnairePage        /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/my-service-leaves" element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhServiceLeavesPage        /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/documents"      element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhDocumentsPage      /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/attestations"   element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhAttestationsPage   /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />
        <Route path="/rh/missions"        element={<ProtectedRoute><FirstLoginGuard><RhOnlyRoute><RhMissionsPage         /></RhOnlyRoute></FirstLoginGuard></ProtectedRoute>} />

        {/* ── Espace RH ────────────────────────────────────────── */}
        <Route path="/dashboard" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <DashboardPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employees/global" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <GlobalEmployeesPage />
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
        <Route path="/employees/alertes" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <AlertesEmployesPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employees/questionnaires" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <GestionQuestionnairesPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/employees/disciplinaire" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <EmployeesDisciplinaryPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />

        {/* ── Questionnaire de sortie public (sans auth) ───────── */}
        <Route path="/questionnaire-sortie/:token" element={<QuestionnaireSortiePage />} />

        {/* ── Passeport sécurité public (scan QR — sans auth) ──── */}
        <Route path="/passeports/:slug/view" element={<PassportViewPage />} />
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
        <Route path="/attendance/feries" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <AttendanceFeriesPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/attendance/justifications" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <AttendanceJustificationsPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />

        {/* ── Congés et Absences (3 sous-routes) ───────────────── */}
        <Route path="/leaves" element={<Navigate to="/leaves/internes" replace />} />
        <Route path="/leaves/internes" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <LeavePage contractFilter="INTERNE" />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/leaves/interimaires" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <LeavePage contractFilter="INTERIM" />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/leaves/hierarchie" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <LeavesHierarchiePage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/leaves/autorisations" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <RhExitAuthorizationPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/leaves/anticipation" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <RhAnticipationPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />
        <Route path="/leaves/migration" element={
          <ProtectedRoute><FirstLoginGuard><NonPlanningRoute><RhOnlyRoute>
            <LeavesMigrationPage />
          </RhOnlyRoute></NonPlanningRoute></FirstLoginGuard></ProtectedRoute>
        } />

        {/* ── Espace HSE ───────────────────────────────────────── */}
        <Route path="/hse/passeports" element={
          <ProtectedRoute><FirstLoginGuard>
            <HseOnlyRoute>
              <PassportManagementPage />
            </HseOnlyRoute>
          </FirstLoginGuard></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}

export default App;
