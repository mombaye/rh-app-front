import { Card, CardContent } from "@/components/ui/card";
import { FaCheckCircle, FaTimesCircle, FaChartBar } from "react-icons/fa";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import dayjs from "dayjs";
import "dayjs/locale/fr"; // pour le formatage français
dayjs.locale("fr");

export default function PayslipStatsCards({
  data,
  loading,
}: {
  data: any[];
  loading: boolean;
}) {
  if (loading) return <div className="h-28 animate-pulse bg-gray-100 rounded-2xl my-2" />;

  const total = data.length;
  const success = data.filter((d) => d.status === "sent").length;
  const failed = data.filter((d) => d.status === "failed").length;
  const successRate = total ? Math.round((success / total) * 100) : 0;

  // Stat mensuelle avec dayjs pour éviter tout bug "Invalid Date"
  const activity = data.reduce((acc, d) => {
    const dateStr = d.date_envoi || d.sent_at;
    if (!dateStr) return acc;
    const key = dayjs(dateStr).format("MMM YYYY"); // ex: "juil. 2025"
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const activityData = Object.entries(activity)
    .map(([key, val]) => ({ month: key, count: val }))
    .sort(
      (a, b) =>
        dayjs("01 " + a.month, "DD MMM YYYY").valueOf() -
        dayjs("01 " + b.month, "DD MMM YYYY").valueOf()
    );

  // Dernier envoi, bien trié avec dayjs
  const lastSent = data
    .filter((d) => d.status === "sent" && d.date_envoi)
    .sort(
      (a, b) =>
        dayjs(b.date_envoi).valueOf() - dayjs(a.date_envoi).valueOf()
    )[0]?.date_envoi;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <Card className="flex items-center gap-4 p-4">
        <FaChartBar size={32} className="text-camublue-900" />
        <CardContent>
          <div className="text-xl font-bold">{total}</div>
          <div className="text-gray-600 text-sm">Bulletins envoyés</div>
        </CardContent>
      </Card>
      <Card className="flex items-center gap-4 p-4">
        <FaCheckCircle size={32} className="text-green-600" />
        <CardContent>
          <div className="text-xl font-bold">{success}</div>
          <div className="text-gray-600 text-sm">Envois réussis</div>
        </CardContent>
      </Card>
      <Card className="flex items-center gap-4 p-4">
        <FaTimesCircle size={32} className="text-red-600" />
        <CardContent>
          <div className="text-xl font-bold">{failed}</div>
          <div className="text-gray-600 text-sm">Échecs</div>
        </CardContent>
      </Card>
      <Card className="flex flex-col gap-1 p-4">
        <span className="text-sm text-gray-500">Taux de réussite</span>
        <div className="text-2xl font-bold text-camublue-900">{successRate}%</div>
        <span className="text-sm text-gray-500">Dernier envoi :</span>
        <div className="text-xs text-gray-600">
          {lastSent ? dayjs(lastSent).format("DD/MM/YYYY HH:mm") : "-"}
        </div>
      </Card>
      {/* Bar Chart sur toute la largeur 
      <div className="col-span-1 sm:col-span-4 mt-2 h-32 bg-white rounded-2xl shadow flex items-center">
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={activityData}>
            <XAxis dataKey="month" />
            <Tooltip />
            <Bar dataKey="count" />
          </BarChart>
        </ResponsiveContainer>
      </div>*/}
    </div>
  );
}
