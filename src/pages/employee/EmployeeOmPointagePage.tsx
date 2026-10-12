import EmployeeLayout from "@/layouts/EmployeeLayout";
import HsAstreinteBoard from "@/components/hsastreinte/HsAstreinteBoard";

// Pointage HS & Astreinte pour un responsable de saisie qui n'a pas l'espace manager
export default function EmployeeOmPointagePage() {
  return (
    <EmployeeLayout>
      <HsAstreinteBoard />
    </EmployeeLayout>
  );
}
