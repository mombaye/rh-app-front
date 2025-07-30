import { Card, CardContent } from "@/components/ui/card";
import { FaUsers, FaMale, FaFemale, FaUserPlus, FaChartBar, FaUserTie } from "react-icons/fa";
import { BarChart, Bar, XAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { motion } from "framer-motion";

const COLORS = ["#1d3557", "#f59e42", "#6bc4b4", "#8e44ad", "#c0392b"];

function getTop(arr, key, n = 3) {
  const counts = arr.reduce((acc, e) => {
    const val = e[key] || "Autre";
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ name: k, value: v }));
}

export default function EmployeesStatsHeader({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading)
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse bg-gray-100 rounded-2xl" />
        ))}
      </div>
    );

  // Stats globales
  const total = data.length;
  const men = data.filter((e) => e.sexe === "H").length;
  const women = data.filter((e) => e.sexe === "F").length;
  const managers = data.filter((e) =>
    (e.fonction || "").toLowerCase().includes("manager")
  ).length;

  // Nouveaux ce mois
  const now = new Date();
  const newThisMonth = data.filter((e) => {
    if (!e.date_embauche) return false;
    const d = new Date(e.date_embauche);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Ancienneté moyenne (en mois)
  const allMonths = data
    .map((e) => {
      if (!e.date_embauche) return null;
      const start = new Date(e.date_embauche);
      const months =
        (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth());
      return months >= 0 ? months : null;
    })
    .filter(Boolean);
  const avgTenure = allMonths.length
    ? (allMonths.reduce((a, b) => a + b, 0) / allMonths.length).toFixed(1)
    : "-";

  // Progress bar H/F
  const percentMen = total ? Math.round((men / total) * 100) : 0;
  const percentWomen = total ? Math.round((women / total) * 100) : 0;

  // Pie Chart
  const pieData = [
    { name: "Hommes", value: men },
    { name: "Femmes", value: women },
  ];

  // Top 3 Fonctions
  const topFonctions = getTop(data, "fonction", 3);

  // Trendline 6 derniers mois
  const monthlyTrend = Array(6)
    .fill(0)
    .map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const label = d.toLocaleString("fr-FR", { month: "short" });
      const count = data.filter((e) => {
        if (!e.date_embauche) return false;
        const ed = new Date(e.date_embauche);
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
      }).length;
      return { month: label, count };
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-4 mb-8"
    >
      {/* Cards principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4 p-4 shadow">
          <FaUsers size={30} className="text-camublue-900" />
          <CardContent>
            <div className="text-xl font-bold">{total}</div>
            <div className="text-gray-600 text-sm">Effectif</div>
          </CardContent>
        </Card>
        <Card className="flex items-center gap-4 p-4 shadow">
          <FaUserPlus size={30} className="text-green-500" />
          <CardContent>
            <div className="text-xl font-bold">{newThisMonth}</div>
            <div className="text-gray-600 text-sm">Nouveaux ce mois</div>
          </CardContent>
        </Card>
        <Card className="flex items-center gap-4 p-4 shadow">
          <FaUserTie size={30} className="text-indigo-500" />
          <CardContent>
            <div className="text-xl font-bold">{managers}</div>
            <div className="text-gray-600 text-sm">% Managers</div>
          </CardContent>
        </Card>
        <Card className="flex items-center gap-4 p-4 shadow">
          <FaChartBar size={30} className="text-orange-500" />
          <CardContent>
            <div className="text-xl font-bold">{avgTenure} mois</div>
            <div className="text-gray-600 text-sm">Ancienneté moyenne</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress-bar et chart */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* Pie chart H/F */}
        <div className="w-full md:w-1/4 flex flex-col items-center justify-center">
          <PieChart width={110} height={110}>
            <Pie
              data={pieData}
              cx={55}
              cy={55}
              innerRadius={32}
              outerRadius={50}
              fill="#8884d8"
              paddingAngle={2}
              dataKey="value"
              label
            >
              {pieData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
          <div className="flex justify-between w-32 text-xs mt-1">
            <span className="text-camublue-900">{percentMen}% H</span>
            <span className="text-pink-500">{percentWomen}% F</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex-1 w-full">
          <div className="h-3 w-full bg-gray-200 rounded-xl overflow-hidden">
            <div
              className="bg-camublue-900 h-full"
              style={{ width: `${percentMen}%` }}
            ></div>
            <div
              className="bg-pink-500 h-full"
              style={{ width: `${percentWomen}%`, marginLeft: `${percentMen}%` }}
            ></div>
          </div>
          <div className="text-xs flex justify-between mt-1">
            <span>{men} hommes</span>
            <span>{women} femmes</span>
          </div>
        </div>
        {/* Mini-barchart top fonctions */}
        <div className="w-full md:w-1/4">
          <div className="font-semibold text-sm mb-1 text-gray-700">Top Fonctions</div>
          <BarChart width={180} height={60} data={topFonctions}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <Bar dataKey="value" fill="#1d3557" radius={[6, 6, 0, 0]} />
          </BarChart>
        </div>
        {/* Trendline sur 6 mois */}
        <div className="w-full md:w-1/4">
          <div className="font-semibold text-sm mb-1 text-gray-700">Recrutements 6 derniers mois</div>
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={monthlyTrend}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <Bar dataKey="count" fill="#6bc4b4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
