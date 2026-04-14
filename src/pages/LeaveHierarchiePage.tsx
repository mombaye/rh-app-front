// src/pages/LeaveHierarchiePage.tsx
import AppLayout from "@/layouts/AppLayout";
import HierarchyManagement from "@/components/leaves/HierarchyManagement";

export default function LeaveHierarchiePage() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-full">
        <HierarchyManagement open={true} onClose={() => {}} mode="page" />
      </div>
    </AppLayout>
  );
}
