import EmployeeAttestationsPage from "@/pages/employee/EmployeeAttestationsPage";
import ManagerLayout from "@/layouts/ManagerLayout";

export default function ManagerAttestationsPage() {
  return <EmployeeAttestationsPage layout={ManagerLayout} />;
}
