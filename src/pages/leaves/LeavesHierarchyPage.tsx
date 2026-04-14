// src/pages/leaves/LeavesHierarchyPage.tsx
import AppLayout from "@/layouts/AppLayout";
import HierarchyManagement from "@/components/leaves/HierarchyManagement";
import { GitBranch } from "lucide-react";

export default function LeavesHierarchyPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-full">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <GitBranch className="text-blue-600" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Hiérarchie</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Gestion de la structure organisationnelle et des managers
            </p>
          </div>
        </div>

        {/* Page-mode HierarchyManagement (no modal overlay) */}
        <HierarchyManagement open={true} onClose={() => {}} isPage={true} />
      </div>
    </AppLayout>
  );
}
