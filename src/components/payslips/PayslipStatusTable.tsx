// PayslipStatsCards.tsx (version “totaux”)
import { Card, CardContent } from "@/components/ui/card";
import { FaCheckCircle, FaTimesCircle, FaChartBar } from "react-icons/fa";

export default function PayslipStatsCards({
  total,
  sent,
  failed,
  loading,
  onOpen,
}: {
  total: number;
  sent: number;
  failed: number;
  loading: boolean;
  onOpen: (kind: "all" | "sent" | "failed") => void;
}) {
  if (loading) return <div className="h-28 animate-pulse bg-gray-100 rounded-2xl my-2" />;

  const rate = total ? Math.round((sent / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <Card className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50" onClick={() => onOpen("all")}>
        <FaChartBar size={32} className="text-camublue-900" />
        <CardContent>
          <div className="text-xl font-bold">{total}</div>
          <div className="text-gray-600 text-sm">Bulletins (période)</div>
        </CardContent>
      </Card>

      <Card className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50" onClick={() => onOpen("sent")}>
        <FaCheckCircle size={32} className="text-green-600" />
        <CardContent>
          <div className="text-xl font-bold">{sent}</div>
          <div className="text-gray-600 text-sm">Envois réussis</div>
        </CardContent>
      </Card>

      <Card className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50" onClick={() => onOpen("failed")}>
        <FaTimesCircle size={32} className="text-red-600" />
        <CardContent>
          <div className="text-xl font-bold">{failed}</div>
          <div className="text-gray-600 text-sm">Échecs</div>
        </CardContent>
      </Card>

      <Card className="flex flex-col gap-1 p-4">
        <span className="text-sm text-gray-500">Taux de réussite</span>
        <div className="text-2xl font-bold text-camublue-900">{rate}%</div>
      </Card>
    </div>
  );
}
