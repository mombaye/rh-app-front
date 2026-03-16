import AdminLayout from "@/admin/layouts/AdminLayout";
import UsersTable from "@/admin/components/UsersTable";
import { UserCog } from "lucide-react";

export default function AdminRHPage() {
  return (
    <AdminLayout>
      <div className="space-y-5 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <UserCog size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Comptes RH</h1>
            <p className="text-xs text-gray-500">Gestion des comptes du personnel RH</p>
          </div>
        </div>

        <UsersTable
          role="rh"
          roleLabel="RH"
          roleParams={{ role: "rh" }}
        />
      </div>
    </AdminLayout>
  );
}
