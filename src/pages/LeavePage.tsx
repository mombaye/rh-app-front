// src/pages/LeavePage.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/layouts/AppLayout";
import LeaveRequestForm from "@/components/leaves/LeaveRequestForm";
import LeaveCalendar    from "@/components/leaves/LeaveCalendar";
import LeaveBalances    from "@/components/leaves/LeaveBalances";
import LeaveStats       from "@/components/leaves/LeaveStats";
import LeaveTypeManagement from "@/components/leaves/LeaveTypeManagement";
import LeaveRequestList from "@/components/leaves/LeaveRequestList";
import { ContractType } from "@/types/leave";
import {
  FiCalendar,
  FiList,
  FiBarChart2,
  FiSettings,
  FiPlus,
} from "react-icons/fi";
import { FaWallet } from "react-icons/fa";

type TabId = "requests" | "calendar" | "balances" | "stats" | "types";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "requests",  label: "Demandes",       icon: <FiList size={15} />        },
  { id: "calendar",  label: "Calendrier",     icon: <FiCalendar size={15} />    },
  { id: "balances",  label: "Soldes",         icon: <FaWallet size={14} />      },
  { id: "stats",     label: "Statistiques",   icon: <FiBarChart2 size={15} />   },
  { id: "types",     label: "Types de congés",icon: <FiSettings size={14} />    },
];

export default function LeavePage() {
  const [activeTab,   setActiveTab]   = useState<TabId>("requests");
  const [showForm,    setShowForm]    = useState(false);
  const [contractType, setContractType] = useState<ContractType>("INTERNE");
  const [refreshKey,  setRefreshKey]  = useState(0);

  const handleSuccess = () => {
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden gap-0 bg-gray-50">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-4 sm:px-6 md:px-8 pt-5 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-camublue-900">
                Congés & Absences
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Gestion complète des congés, soldes et absences
              </p>
            </div>

            <div className="flex items-center gap-2 pb-0.5">
              {/* Toggle contrat */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                {(["INTERNE", "INTERIM"] as ContractType[]).map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setContractType(ct)}
                    className={`px-3 py-1.5 transition ${
                      contractType === ct
                        ? "bg-camublue-900 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {ct === "INTERNE" ? "Internes" : "Intérimaires"}
                  </button>
                ))}
              </div>

              {/* Nouvelle demande */}
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                <FiPlus size={15} />
                Nouvelle demande
              </button>
            </div>
          </div>

          {/* ── Onglets ──────────────────────────────────────────────────── */}
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-camublue-900 text-camublue-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Contenu onglets ────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + contractType + refreshKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              {activeTab === "requests" && (
                <LeaveRequestList
                  contractType={contractType}
                  refreshKey={refreshKey}
                />
              )}

              {activeTab === "calendar" && (
                <LeaveCalendar contractType={contractType} />
              )}

              {activeTab === "balances" && (
                <LeaveBalances contractType={contractType} />
              )}

              {activeTab === "stats" && (
                <LeaveStats contractType={contractType} />
              )}

              {activeTab === "types" && (
                <LeaveTypeManagement />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Modal nouvelle demande ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <LeaveRequestForm
            contractType={contractType}
            onClose={() => setShowForm(false)}
            onSuccess={handleSuccess}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
