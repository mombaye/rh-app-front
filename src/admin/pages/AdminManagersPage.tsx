import { useState } from "react";
import AdminLayout from "@/admin/layouts/AdminLayout";
import UsersTable from "@/admin/components/UsersTable";
import { ShieldCheck } from "lucide-react";
import type { AdminUser } from "@/admin/services/adminService";

type LevelFilter = "manager" | "manager1" | "manager2";

export default function AdminManagersPage() {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("manager");

  const levelBadge = (u: AdminUser) => (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
        u.manager_level === 1
          ? "bg-purple-100 text-purple-700"
          : u.manager_level === 2
          ? "bg-indigo-100 text-indigo-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      {u.manager_level === 1 ? "Niveau 1" : u.manager_level === 2 ? "Niveau 2" : "—"}
    </span>
  );

  return (
    <AdminLayout>
      <div className="space-y-5 w-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Comptes Managers</h1>
              <p className="text-xs text-gray-500">Gestion des managers de Niveau 1 et Niveau 2</p>
            </div>
          </div>

          {/* Level filter tabs */}
          <div className="flex rounded-xl border overflow-hidden text-sm">
            {([
              { value: "manager", label: "Tous" },
              { value: "manager1", label: "Niveau 1" },
              { value: "manager2", label: "Niveau 2" },
            ] as { value: LevelFilter; label: string }[]).map((t) => (
              <button
                key={t.value}
                onClick={() => setLevelFilter(t.value)}
                className={`px-4 py-2 transition ${
                  levelFilter === t.value
                    ? "bg-camublue-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <UsersTable
          key={levelFilter}
          role="manager"
          roleLabel={levelFilter === "manager1" ? "Manager Niv.1" : levelFilter === "manager2" ? "Manager Niv.2" : "Manager"}
          roleParams={{ role: levelFilter }}
          extraColumns={[
            {
              header: "Niveau",
              render: levelBadge,
            },
          ]}
        />
      </div>
    </AdminLayout>
  );
}
