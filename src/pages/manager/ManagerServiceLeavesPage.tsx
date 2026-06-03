import EmployeeServiceLeavesPage from "@/pages/employee/EmployeeServiceLeavesPage";
import ManagerLayout from "@/layouts/ManagerLayout";

export default function ManagerServiceLeavesPage() {
  return <EmployeeServiceLeavesPage layout={ManagerLayout} />;
}
