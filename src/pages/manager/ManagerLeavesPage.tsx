import EmployeeLeavesPage from "@/pages/employee/EmployeeLeavesPage";
import ManagerLayout from "@/layouts/ManagerLayout";

/**
 * Mes Congés — vue Manager
 * Identique à EmployeeLeavesPage + bouton "Approuver" sur ses propres demandes
 * (le manager valide lui-même ses propres congés).
 */
export default function ManagerLeavesPage() {
  return <EmployeeLeavesPage layout={ManagerLayout} canSelfApprove />;
}
