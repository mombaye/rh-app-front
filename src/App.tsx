import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import EmployeesPage from "@/pages/EmployeesPage";
import PayslipPage from "@/pages/PayslipPage";
import ChangePasswordPage from "@/components/users/ChangePasswordPage";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "@/components/ProtectedRoute";
import FirstLoginGuard from "@/components/FirstLoginGuard";
import AttendancePage from "./pages/AttendancePage";
import HierarchyPage from "./pages/HierarchyPage";

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <DashboardPage />
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <EmployeesPage />
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/payslip"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <PayslipPage />
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <AttendancePage />
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hierarchy"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <HierarchyPage />
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default App;
