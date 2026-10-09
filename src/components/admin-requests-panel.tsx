'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/store/auth-store';

interface RequestItem {
  id: string;
  type: string;
  email: string;
  data: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminRequestsPanelProps {
  onClose: () => void;
}

export default function AdminRequestsPanel({ onClose }: AdminRequestsPanelProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Step-up: confirmação de senha para aprovar
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/requests?status=${activeTab}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject', password?: string) => {
    setProcessingId(requestId);
    setConfirmError('');
    try {
      const res = await authFetch('/api/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, adminPassword: password }),
      });
      const data = await res.json();
      if (data.success) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        setConfirmingId(null);
        setAdminPassword('');
      } else if (res.status === 401 && action === 'approve') {
        // precisa de confirmação de senha
        setConfirmingId(requestId);
        setConfirmError(data.error || 'Confirme sua senha para aprovar.');
      } else if (res.status === 403) {
        setConfirmError(data.error || 'Senha incorreta.');
      } else {
        setConfirmingId(null);
        setAdminPassword('');
        alert(data.error || 'Erro ao processar solicitação');
      }
    } catch (err) {
      console.error('Error processing request:', err);
      alert('Erro ao processar solicitação');
    }
    setProcessingId(null);
  };

  const parseData = (dataStr: string) => {
    try {
      return JSON.parse(dataStr);
    } catch {
      return { raw: dataStr };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-orange-500/30 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="material-icons text-orange-500 text-2xl">how_to_reg</span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Cadastros Solicitados</h2>
              <p className="text-gray-500 text-xs">Aprovar exige sua senha de administrador</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {(['pending', 'approved', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/10'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab === 'pending' ? 'Pendentes' : tab === 'approved' ? 'Aprovadas' : 'Rejeitadas'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="material-icons animate-spin text-orange-500 text-3xl">refresh</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-icons text-gray-600 text-4xl mb-2">inbox</span>
              <p className="text-gray-500">Nenhuma solicitação {activeTab === 'pending' ? 'pendente' : activeTab === 'approved' ? 'aprovada' : 'rejeitada'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const parsed = parseData(req.data);
                const isConfirming = confirmingId === req.id;
                return (
                  <div
                    key={req.id}
                    className="bg-gray-800 rounded-xl p-4 border border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-medium border bg-blue-500/20 text-blue-400 border-blue-500/30">
                          Cadastro
                        </span>
                        <span className="text-gray-400 text-xs">{formatDate(req.createdAt)}</span>
                      </div>
                      {activeTab === 'pending' && !isConfirming && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setConfirmingId(req.id);
                              setConfirmError('');
                              setAdminPassword('');
                            }}
                            disabled={processingId === req.id}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <span className="material-icons text-sm">check</span>
                            Aprovar
                          </button>
                          <button
                            onClick={() => handleAction(req.id, 'reject')}
                            disabled={processingId === req.id}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <span className="material-icons text-sm">close</span>
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-white font-medium text-sm mb-1">{req.email}</p>
                    <div className="text-gray-400 text-xs space-y-0.5">
                      {parsed.name && <p>Nome: {parsed.name}</p>}
                      {parsed.department && <p>Departamento: {parsed.department}</p>}
                      {parsed.raw && <p>{parsed.raw}</p>}
                    </div>

                    {isConfirming && activeTab === 'pending' && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-amber-400 text-xs mb-2 flex items-center gap-1">
                          <span className="material-icons text-sm">lock</span>
                          Digite SUA senha de admin para confirmar a aprovação
                        </p>
                        <input
                          type="password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="Sua senha de administrador"
                          autoFocus
                          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/60 mb-2"
                        />
                        {confirmError && (
                          <p className="text-red-400 text-xs mb-2">{confirmError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(req.id, 'approve', adminPassword)}
                            disabled={processingId === req.id || !adminPassword}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            {processingId === req.id ? (
                              <span className="material-icons animate-spin text-sm">refresh</span>
                            ) : (
                              <span className="material-icons text-sm">verified</span>
                            )}
                            Confirmar aprovação
                          </button>
                          <button
                            onClick={() => {
                              setConfirmingId(null);
                              setAdminPassword('');
                              setConfirmError('');
                            }}
                            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Refresh button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={fetchRequests}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-icons text-sm">refresh</span>
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
}
