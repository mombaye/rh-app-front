import EmployeeTopNav from "@/components/employee/EmployeeTopNav";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-camugray-100 flex flex-col">
      <EmployeeTopNav />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
