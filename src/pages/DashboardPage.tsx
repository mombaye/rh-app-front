import AppLayout from "@/layouts/AppLayout";
import { motion } from "framer-motion";
import { FaUserFriends, FaUsersCog, FaChartLine, FaClock } from "react-icons/fa";

export default function DashboardPage() {
  const kpis = [
    {
      label: "Employés actifs",
      value: 120,
      icon: <FaUserFriends className="text-white text-2xl" />,
      color: "bg-camublue-900",
    },
    {
      label: "Contrats à renouveler",
      value: 5,
      icon: <FaClock className="text-white text-2xl" />,
      color: "bg-yellow-500",
    },
    {
      label: "Taux de féminisation",
      value: "38%",
      icon: <FaUsersCog className="text-white text-2xl" />,
      color: "bg-pink-500",
    },
    {
      label: "Projets actifs",
      value: 12,
      icon: <FaChartLine className="text-white text-2xl" />,
      color: "bg-green-500",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl font-bold text-camublue-900"
        >
          Tableau de bord RH
        </motion.h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index, duration: 0.4 }}
              className={`rounded-2xl shadow-md p-5 text-white flex items-center justify-between ${kpi.color}`}
            >
              <div>
                <p className="text-sm font-light">{kpi.label}</p>
                <h2 className="text-2xl font-bold">{kpi.value}</h2>
              </div>
              <div className="ml-4">{kpi.icon}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
