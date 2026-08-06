import EmployeeTicketsPage from "@/pages/employee/EmployeeTicketsPage";
import ManagerLayout from "@/layouts/ManagerLayout";

export default function ManagerTicketsPage() {
  return <EmployeeTicketsPage layout={ManagerLayout} />;
}
