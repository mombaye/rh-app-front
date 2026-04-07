import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Users, X, AlertCircle } from 'lucide-react';
import {
  getManagerRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  LeaveRequest,
} from '../services/leaveService';

export default function ManagerApprovalsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: number | null }>({
    open: false,
    requestId: null,
  });
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getManagerRequests();
      setRequests(data);
    } catch {
      setError('Erreur lors du chargement des demandes de congé');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      setProcessing(id);
      setError(null);
      const updated = await approveLeaveRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setSuccess('Demande approuvée avec succès');
    } catch {
      setError("Erreur lors de l'approbation");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.requestId || !rejectReason.trim()) return;
    try {
      setProcessing(rejectModal.requestId);
      setError(null);
      const updated = await rejectLeaveRequest(rejectModal.requestId, rejectReason);
      setRequests((prev) => prev.map((r) => (r.id === rejectModal.requestId ? updated : r)));
      setSuccess('Demande rejetée');
      setRejectModal({ open: false, requestId: null });
      setRejectReason('');
    } catch {
      setError('Erreur lors du rejet');
    } finally {
      setProcessing(null);
    }
  };

  const statusConfig = {
    PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    APPROVED: { label: 'Approuvé', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    REJECTED: { label: 'Rejeté', color: 'bg-red-100 text-red-700', icon: XCircle },
    CANCELLED: { label: 'Annulé', color: 'bg-gray-100 text-gray-600', icon: X },
  };

  const filtered = filter === 'ALL' ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approbation des Congés</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gérez les demandes de congé de votre équipe
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-sm">
            <AlertCircle size={16} />
            {pendingCount} demande{pendingCount > 1 ? 's' : ''} en attente
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex justify-between">
          {error}
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X size={16} /></button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === 'ALL' ? 'Toutes' : statusConfig[s as keyof typeof statusConfig]?.label}
            {s === 'PENDING' && pendingCount > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-40" />
          <p>Aucune demande de congé</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Employé</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Période</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Jours</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((req) => {
                const sc = statusConfig[req.status as keyof typeof statusConfig];
                const Icon = sc?.icon ?? Clock;
                return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{req.employee_name}</p>
                      <p className="text-xs text-gray-400">{req.employee_matricule}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.leave_type_name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span>
                        {new Date(req.start_date).toLocaleDateString('fr-FR')}
                      </span>
                      <span className="mx-1 text-gray-400">→</span>
                      <span>
                        {new Date(req.end_date).toLocaleDateString('fr-FR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.days}j</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sc?.color}`}>
                        <Icon size={12} />
                        {sc?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {req.status === 'PENDING' && (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={processing === req.id}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-60"
                          >
                            <CheckCircle size={12} />
                            Approuver
                          </button>
                          <button
                            onClick={() => setRejectModal({ open: true, requestId: req.id })}
                            disabled={processing === req.id}
                            className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600 disabled:opacity-60"
                          >
                            <XCircle size={12} />
                            Rejeter
                          </button>
                        </div>
                      )}
                      {req.status === 'REJECTED' && req.reject_reason && (
                        <p className="text-xs text-gray-400 italic max-w-xs truncate" title={req.reject_reason}>
                          {req.reject_reason}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Motif du rejet</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 mb-4"
              rows={3}
              placeholder="Expliquez la raison du rejet..."
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRejectModal({ open: false, requestId: null }); setRejectReason(''); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || processing !== null}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-60"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
