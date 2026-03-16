import AdminLayout from "@/admin/layouts/AdminLayout";
import UsersTable from "@/admin/components/UsersTable";
import { Briefcase } from "lucide-react";

export default function AdminEmployeesPage() {
  return (
    <AdminLayout>
      <div className="space-y-5 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
            <Briefcase size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Comptes Employés</h1>
            <p className="text-xs text-gray-500">Gestion des comptes d'accès des employés</p>
          </div>
        </div>

        <UsersTable
          role="employee"
          roleLabel="Employé"
          roleParams={{ role: "employee" }}
          extraColumns={[
            {
              header: "Employé lié",
              render: (u) => (
                <span className="text-xs text-gray-600">{u.employee_name || "—"}</span>
              ),
            },
          ]}
        />
      </div>
    </AdminLayout>
  );
}
