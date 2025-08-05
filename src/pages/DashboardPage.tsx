import AppLayout from "@/layouts/AppLayout";
import { motion } from "framer-motion";
import { FaRegLightbulb } from "react-icons/fa";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="bg-camublue-900 p-6 rounded-full shadow-lg mb-4">
            <FaRegLightbulb className="text-5xl text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-camublue-900 mb-2">
            Bientôt disponible&nbsp;!
          </h1>
          <p className="text-lg text-gray-500 text-center max-w-lg">
            Cette section du tableau de bord arrive très bientôt.<br />
            Revenez vite pour découvrir de nouvelles fonctionnalités RH.
          </p>
        </motion.div>
      </div>
    </AppLayout>
  );
}
