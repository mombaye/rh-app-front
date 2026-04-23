import { useAuth } from "@/contexts/useAuth";
import ManagerLayout from "@/layouts/ManagerLayout";
import ExitAuthorizationPanel from "@/components/leaves/ExitAuthorizationPanel";

export default function ManagerExitAuthorizationPage() {
  const { user } = useAuth();
  const employeeId = user?.employee_id;

  return (
    <ManagerLayout>
      <div className="px-4 md:px-6 pb-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#003c71]">Mes Sorties</h1>
          <p className="text-gray-500 text-sm mt-0.5">Gérez vos demandes d'autorisation de sortie</p>
        </div>
        {employeeId ? (
          <ExitAuthorizationPanel
            employeeId={employeeId}
            canCreate
            showEmployeeName={false}
            canReview={false}
            hideHeader
          />
        ) : (
          <div className="text-center py-16 text-gray-400 text-sm">
            Compte non lié à un dossier employé.
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
