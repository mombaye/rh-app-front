import { Card, CardContent } from "@/components/ui/card";
import { FaCheckCircle, FaTimesCircle, FaChartBar } from "react-icons/fa";
import dayjs from "dayjs";
import "dayjs/locale/fr";
dayjs.locale("fr");

export default function PayslipStatsCards({
  loading,
  total,
  sent,
  failed,
  lastSentAt,
  onOpen,
}: {
  loading: boolean;
  total: number;
  sent: number;
  failed: number;
  lastSentAt?: string | null;
  onOpen?: (kind: "all" | "sent" | "failed") => void;
}) {
  if (loading) return <div className="h-28 animate-pulse bg-gray-100 rounded-2xl my-2" />;

  const successRate = total ? Math.round((sent / total) * 100) : 0;

  const clickable = (kind: "all" | "sent" | "failed") =>
    onOpen ? { role: "button" as const, tabIndex: 0, onClick: () => onOpen(kind) } : {};

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <Card className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50" {...clickable("all")}>
        <FaChartBar size={32} className="text-camublue-900" />
        <CardContent className="p-0">
          <div className="text-xl font-bold">{total}</div>
          <div className="text-gray-600 text-sm">Bulletins envoyés</div>
        </CardContent>
      </Card>

      <Card className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50" {...clickable("sent")}>
        <FaCheckCircle size={32} className="text-green-600" />
        <CardContent className="p-0">
          <div className="text-xl font-bold">{sent}</div>
          <div className="text-gray-600 text-sm">Envois réussis</div>
        </CardContent>
      </Card>

      <Card className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50" {...clickable("failed")}>
        <FaTimesCircle size={32} className="text-red-600" />
        <CardContent className="p-0">
          <div className="text-xl font-bold">{failed}</div>
          <div className="text-gray-600 text-sm">Échecs</div>
        </CardContent>
      </Card>

      <Card className="flex flex-col gap-1 p-4">
        <span className="text-sm text-gray-500">Taux de réussite</span>
        <div className="text-2xl font-bold text-camublue-900">{successRate}%</div>

        <span className="text-sm text-gray-500 mt-2">Dernier envoi :</span>
        <div className="text-xs text-gray-600">
          {lastSentAt ? dayjs(lastSentAt).format("DD/MM/YYYY HH:mm") : "-"}
        </div>
      </Card>
    </div>
  );
}
