import AppLayout from "@/layouts/AppLayout";
import HsAstreinteBoard from "@/components/hsastreinte/HsAstreinteBoard";

// Pointage HS & Astreinte (ex « Pointage O&M ») — vue RH : tous les employés
export default function RhOmPointagePage() {
  return (
    <AppLayout>
      <HsAstreinteBoard />
    </AppLayout>
  );
}
