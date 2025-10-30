// components/employees/ReinstateEmployeeModal.tsx
import { useEffect, useState } from 'react';
import { ImSpinner2 } from 'react-icons/im';
import { Employee } from '@/types/employee';

export default function ReinstateEmployeeModal({
  open, onClose, employee, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  onConfirm: (payload: { date_reintegration?: string; update_date_embauche?: boolean }) => Promise<void>;
}) {
  const [dateReint, setDateReint] = useState('');
  const [updateHire, setUpdateHire] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setDateReint(new Date().toISOString().slice(0, 10));
      setUpdateHire(false);
    }
  }, [open]);

  if (!open || !employee) return null;

  const submit = async () => {
    setLoading(true);
    try {
      await onConfirm({ date_reintegration: dateReint, update_date_embauche: updateHire });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-800">Réintégrer l’employé</h3>
          <p className="text-sm text-slate-500"> {employee?.prenom} {employee?.nom} — {employee?.matricule}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Date de réintégration</label>
            <input type="date" value={dateReint} onChange={(e)=>setDateReint(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-camublue-900" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={updateHire} onChange={(e)=>setUpdateHire(e.target.checked)} />
            Remplacer la date d’embauche par la date de réintégration
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800">Annuler</button>
          <button onClick={submit} disabled={loading}
            className="px-4 py-2 rounded-md bg-camublue-900 hover:bg-camublue-800 text-white inline-flex items-center gap-2">
            {loading ? <ImSpinner2 className="animate-spin" /> : null}
            {loading ? 'Enregistrement...' : 'Réintégrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
