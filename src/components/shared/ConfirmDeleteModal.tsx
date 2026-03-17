import { motion, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { ImSpinner2 } from "react-icons/im";

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
}

export default function ConfirmDeleteModal({
  open,
  title,
  message,
  onClose,
  onConfirm,
  loading = false,
  confirmLabel = "Supprimer",
}: ConfirmDeleteModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={() => !loading && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon + Titre */}
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">{title}</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">{message}</p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <ImSpinner2 className="animate-spin" size={14} />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {loading ? "Suppression…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
