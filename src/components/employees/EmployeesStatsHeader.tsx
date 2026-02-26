import { Card, CardContent } from "@/components/ui/card";
import { FaUsers, FaUserPlus, FaChartBar, FaUserTie } from "react-icons/fa";
import { motion } from "framer-motion";

const StatCard = ({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) => (
  <Card className="flex flex-col justify-center gap-1 p-4 shadow">
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center shrink-0">{icon}</div>
      <span className="text-xl font-bold leading-none">{value}</span>
    </div>
    <div className="text-gray-600 text-sm">{label}</div>
  </Card>
);

export default function EmployeesStatsHeader({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading)
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse bg-gray-100 rounded-2xl" />
        ))}
      </div>
    );

  const total = data.length;

  const managers = data.filter((e) =>
    (e.fonction || "").toLowerCase().includes("manager")
  ).length;

  const now = new Date();
  const newThisMonth = data.filter((e) => {
    if (!e.date_embauche) return false;
    const d = new Date(e.date_embauche);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const allMonths = data
    .map((e) => {
      if (!e.date_embauche) return null;
      const start = new Date(e.date_embauche);
      const months =
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth());
      return months >= 0 ? months : null;
    })
    .filter(Boolean) as number[];

  const avgTenure = allMonths.length
    ? (allMonths.reduce((a, b) => a + b, 0) / allMonths.length).toFixed(1)
    : "-";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
    >
      <StatCard
        icon={<FaUsers size={28} className="text-camublue-900" />}
        value={total}
        label="Effectif"
      />
      <StatCard
        icon={<FaUserPlus size={28} className="text-green-500" />}
        value={newThisMonth}
        label="Nouveaux ce mois"
      />
      <StatCard
        icon={<FaUserTie size={28} className="text-indigo-500" />}
        value={managers}
        label="% Managers"
      />
      <StatCard
        icon={<FaChartBar size={28} className="text-orange-500" />}
        value={`${avgTenure} mois`}
        label="Ancienneté moyenne"
      />
    </motion.div>
  );
}