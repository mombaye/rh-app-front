import { useState, useEffect, useCallback } from "react";
import ManagerSidebar from "@/components/manager/ManagerSidebar";
import { useAuth } from "@/contexts/useAuth";
import { leaveRequestService, exitAuthorizationService } from "@/services/leaveService";
import { missionService } from "@/services/missionService";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPending = useCallback(async () => {
    if (!user?.employee_id) return;
    try {
      const results = await Promise.allSettled([
        leaveRequestService.getAll({ manager_employee_id: user.employee_id, status: "PENDING"        } as any),
        leaveRequestService.getAll({ manager_employee_id: user.employee_id, status: "PENDING_SECOND" } as any),
        exitAuthorizationService.getAll({ manager_employee_id: user.employee_id, status: "PENDING" }),
      ]);
      const get = (r: PromiseSettledResult<any[]>): any[] => r.status === "fulfilled" ? r.value : [];
      const [reqs, pending2, exits] = results.map(get);
      const eid = user.employee_id;
      const others  = reqs.filter((r: any)    => r.employee?.id !== eid);
      const others2 = pending2.filter((r: any) => r.employee?.id !== eid);
      setPendingCount(others.length + others2.length + exits.length);
    } catch {
      // silencieux
    }
  }, [user?.employee_id]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <ManagerSidebar pendingCount={pendingCount} />
      <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
    </div>
  );
}

