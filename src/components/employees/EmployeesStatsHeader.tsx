import { Card } from "@/components/ui/card";
import { FaUsers, FaUserPlus, FaUserTie, FaUserCheck, FaUserTimes } from "react-icons/fa";
import { motion } from "framer-motion";

type ProfileFilter = "ALL" | "ACTIVE" | "EXITED";

const StatCard = ({
  icon,
  value,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <Card
    onClick={onClick}
    className={`flex flex-col justify-center gap-1 p-4 shadow transition-all ${
      onClick ? "cursor-pointer select-none" : ""
    } ${
      active
        ? "ring-2 ring-camublue-900 border-camublue-900 bg-camublue-900/5"
        : "hover:shadow-md"
    }`}
  >
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center shrink-0">{icon}</div>
      <span className="text-xl font-bold leading-none">{value}</span>
    </div>
    <div className="text-gray-600 text-sm flex items-center justify-between">
      <span>{label}</span>
      {active && (
        <span className="text-[10px] font-semibold text-camublue-900 bg-camublue-900/10 px-1.5 py-0.5 rounded-full">
          Filtré
        </span>
      )}
    </div>
  </Card>
);

export default function EmployeesStatsHeader({
  data,
  loading,
  profileFilter,
  onProfileFilterChange,
}: {
  data: any[];
  loading: boolean;
  profileFilter?: ProfileFilter;
  onProfileFilterChange?: (f: ProfileFilter) => void;
}) {
  if (loading)
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse bg-gray-100 rounded-2xl" />
        ))}
      </div>
    );

  const now = new Date();

  const total = data.length;

  const activeCount = data.filter(
    (e) => e.status === "ACTIVE" || e.is_active_employee === true
  ).length;

  const exitedCount = data.filter((e) => e.status === "EXITED").length;

  const managers = data.filter((e) =>
    (e.fonction || "").toLowerCase().includes("manager")
  ).length;

  const newThisMonth = data.filter((e) => {
    if (!e.date_embauche) return false;
    const d = new Date(e.date_embauche);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;

  const handleClick = (filter: ProfileFilter) => {
    if (!onProfileFilterChange) return;
    onProfileFilterChange(profileFilter === filter ? "ALL" : filter);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"
    >
      {/* Total effectif */}
      <StatCard
        icon={<FaUsers size={28} className="text-camublue-900" />}
        value={total}
        label="Effectif total"
      />

      {/* Actifs — cliquable pour filtrer */}
      <StatCard
        icon={<FaUserCheck size={28} className="text-emerald-500" />}
        value={activeCount}
        label="Actifs"
        active={profileFilter === "ACTIVE"}
        onClick={() => handleClick("ACTIVE")}
      />

      {/* Sortis — cliquable pour filtrer */}
      <StatCard
        icon={<FaUserTimes size={28} className="text-red-400" />}
        value={exitedCount}
        label="Sortis"
        active={profileFilter === "EXITED"}
        onClick={() => handleClick("EXITED")}
      />

      {/* Nouveaux ce mois */}
      <StatCard
        icon={<FaUserPlus size={28} className="text-green-500" />}
        value={newThisMonth}
        label="Nouveaux ce mois"
      />

      {/* Managers */}
      <StatCard
        icon={<FaUserTie size={28} className="text-indigo-500" />}
        value={managers}
        label="Managers"
      />
    </motion.div>
  );
}