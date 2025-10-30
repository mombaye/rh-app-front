import { useState, useEffect } from 'react';
import { ImSpinner2 } from 'react-icons/im';
import { Employee } from '@/types/employee';

type Props = {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  onConfirm: (payload: { date_sortie: string; motif_sortie?: string }) => Promise<void>;
};

export default function ExitEmployeeModal({ open, onClose, employee, onConfirm }: Props) {
  const [dateSortie, setDateSortie] = useState('');
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setDateSortie(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD today
      setMotif('');
    }
  }, [open]);

  if (!open || !employee) return null;

  const handleSubmit = async () => {
    if (!dateSortie) return;
    setLoading(true);
    try {
      await onConfirm({ date_sortie: dateSortie, motif_sortie: motif || undefined });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-slate-800">Marquer la sortie</h3>
          <p className="text-sm text-slate-500">Employé : {employee.prenom} {employee.nom} — {employee.matricule}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Date de sortie</label>
            <input
              type="date"
              value={dateSortie}
              onChange={(e) => setDateSortie(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-camublue-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Motif (optionnel)</label>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-camublue-900"
              placeholder="Fin de mission, rupture période d’essai, démission, autre…"
            />
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            L’employé ne sera pas supprimé de la base. Son statut passera à <b>Sorti</b>.
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !dateSortie}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white inline-flex items-center gap-2"
          >
            {loading ? <ImSpinner2 className="animate-spin" /> : null}
            {loading ? 'Enregistrement...' : 'Confirmer la sortie'}
          </button>
        </div>
      </div>
    </div>
  );
}
