import EmployeeLayout from "@/layouts/EmployeeLayout";
import TeamPlanningBoard from "@/components/teamplanning/TeamPlanningBoard";

// Pour les profils sans espace manager qui ont accès au Team Planning (ex. vue complète)
export default function EmployeeTeamPlanningPage() {
  return (
    <EmployeeLayout>
      <TeamPlanningBoard />
    </EmployeeLayout>
  );
}
