import ManagerLayout from "@/layouts/ManagerLayout";
import HsAstreinteBoard from "@/components/hsastreinte/HsAstreinteBoard";

// Pointage HS & Astreinte — employés dont le manager remplit le pointage (répartition RH, sinon N+1)
export default function ManagerOmPointagePage() {
  return (
    <ManagerLayout>
      <HsAstreinteBoard />
    </ManagerLayout>
  );
}
