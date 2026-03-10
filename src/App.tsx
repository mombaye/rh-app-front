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

function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
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

        {/* Toutes les autres pages protégées par la FirstLoginGuard */}
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
          path="/employees/internes"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <InterneEmployeesPage />
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees/interims"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <InterimEmployeesPage />
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
          element={<Navigate to="/attendance/normales" replace />}
        />

        <Route
          path="/attendance/normales"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <AttendanceNormalesPage />
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance/shifts"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <AttendanceShiftsPage />
              </FirstLoginGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaves"
          element={
            <ProtectedRoute>
              <FirstLoginGuard>
                <LeavePage />
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