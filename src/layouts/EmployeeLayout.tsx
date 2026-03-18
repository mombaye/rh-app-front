import EmployeeSidebar from "@/components/employee/EmployeeSidebar";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-camugray-100">
      <EmployeeSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 pt-16 md:p-8">{children}</main>
      </div>
    </div>
  );
}
