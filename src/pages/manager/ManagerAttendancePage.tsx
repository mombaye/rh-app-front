import EmployeeAttendancePage from "@/pages/employee/EmployeeAttendancePage";
import ManagerLayout from "@/layouts/ManagerLayout";

export default function ManagerAttendancePage() {
  return <EmployeeAttendancePage layout={ManagerLayout} />;
}
