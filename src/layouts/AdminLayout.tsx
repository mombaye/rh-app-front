import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-camugray-100">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 pt-16 md:p-8">{children}</main>
      </div>
    </div>
  );
}
