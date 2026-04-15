// src/pages/LeavesHierarchiePage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import HierarchyManagement from "@/components/leaves/HierarchyManagement";
import LeaveTypeManagement from "@/components/leaves/LeaveTypeManagement";

export default function LeavesHierarchiePage() {
  const navigate = useNavigate();
  const [showLeaveTypes, setShowLeaveTypes] = useState(false);
  const [leaveTypeTrigger, setLeaveTypeTrigger] = useState(0);

  const handleOpenLeaveTypes = () => {
    setLeaveTypeTrigger((t) => t + 1);
    setShowLeaveTypes(true);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <HierarchyManagement
          open={true}
          onClose={() => navigate("/leaves/internes")}
          inline={true}
          onLeaveTypes={handleOpenLeaveTypes}
        />
        {showLeaveTypes && (
          <LeaveTypeManagement
            open={showLeaveTypes}
            onClose={() => setShowLeaveTypes(false)}
            trigger={leaveTypeTrigger}
          />
        )}
      </div>
    </AppLayout>
  );
}
