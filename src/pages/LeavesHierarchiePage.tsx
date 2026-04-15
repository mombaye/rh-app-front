// src/pages/LeavesHierarchiePage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, X, Plus } from "lucide-react";
import AppLayout from "@/layouts/AppLayout";
import HierarchyManagement from "@/components/leaves/HierarchyManagement";
import LeaveTypeManagement from "@/components/leaves/LeaveTypeManagement";

export default function LeavesHierarchiePage() {
  const navigate = useNavigate();
  const [showLeaveTypes, setShowLeaveTypes] = useState(false);
  const [triggerNew, setTriggerNew] = useState(0);

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <HierarchyManagement
          open={true}
          onClose={() => navigate("/leaves/internes")}
          inline={true}
          onLeaveTypes={() => setShowLeaveTypes(true)}
        />

        {/* ── Modal Types de congés ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showLeaveTypes && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
              onClick={() => setShowLeaveTypes(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-slate-50 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-6 pt-5 pb-4 bg-white rounded-t-3xl border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-camublue-900 text-white">
                      <Settings2 className="h-4 w-4" />
                    </div>
                    <h2 className="font-black text-slate-800 text-base">Types de congés</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTriggerNew((c) => c + 1)}
                      className="flex items-center gap-1.5 bg-camublue-900 hover:bg-camublue-800 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nouveau type
                    </button>
                    <button
                      onClick={() => setShowLeaveTypes(false)}
                      className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Contenu scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <LeaveTypeManagement triggerNew={triggerNew} />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
