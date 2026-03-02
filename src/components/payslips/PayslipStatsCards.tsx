import { FaCheckCircle, FaTimesCircle, FaChartBar, FaStar } from "react-icons/fa";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import "dayjs/locale/fr";
dayjs.locale("fr");

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "blue",
  delay = 0,
  onClick,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "green" | "amber" | "red";
  delay?: number;
  onClick?: () => void;
}) {
  const colors = {
    blue:  { icon: "bg-camublue-900 text-white", text: "text-camublue-900" },
    green: { icon: "bg-emerald-500 text-white",  text: "text-emerald-700"  },
    amber: { icon: "bg-amber-500 text-white",    text: "text-amber-700"    },
    red:   { icon: "bg-red-500 text-white",      text: "text-red-700"      },
  };
  const c = colors[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className={`text-2xl font-bold ${c.text} mb-0.5`}>{value}</div>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </motion.div>
  );
}

function StatCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm"
    >
      <div className="space-y-2 mt-1">
        <div className="h-10 w-10 bg-slate-100 rounded-xl animate-pulse mb-3" />
        <div className="h-7 w-20 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
      </div>
    </motion.div>
  );
}

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
  const successRate = total ? Math.round((sent / total) * 100) : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCardSkeleton delay={0.05} />
        <StatCardSkeleton delay={0.1} />
        <StatCardSkeleton delay={0.15} />
        <StatCardSkeleton delay={0.2} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        icon={FaChartBar}
        label="Bulletins générés"
        value={total}
        sub="Total sur la période"
        color="blue"
        delay={0.05}
        onClick={() => onOpen?.("all")}
      />
      <StatCard
        icon={FaCheckCircle}
        label="Envois réussis"
        value={sent}
        sub="Bulletins envoyés"
        color="green"
        delay={0.1}
        onClick={() => onOpen?.("sent")}
      />
      <StatCard
        icon={FaTimesCircle}
        label="Échecs"
        value={failed}
        sub="Envois échoués"
        color="red"
        delay={0.15}
        onClick={() => onOpen?.("failed")}
      />
      <StatCard
        icon={TrendingUp}
        label="Taux de réussite"
        value={`${successRate}%`}
        sub={lastSentAt ? `Dernier : ${dayjs(lastSentAt).format("DD/MM/YYYY HH:mm")}` : "Aucun envoi récent"}
        color={successRate >= 90 ? "green" : successRate >= 70 ? "amber" : "red"}
        delay={0.2}
      />
    </div>
  );
}