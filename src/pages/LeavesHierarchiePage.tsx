// src/pages/LeavesHierarchiePage.tsx
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import HierarchyManagement from "@/components/leaves/HierarchyManagement";

export default function LeavesHierarchiePage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <HierarchyManagement
          open={true}
          onClose={() => navigate("/leaves/internes")}
          inline={true}
        />
      </div>
    </AppLayout>
  );
}
