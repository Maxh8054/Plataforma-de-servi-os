'use client';

import { useState, useEffect, useCallback } from 'react';

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
  adminEmail: string;
  onClose: () => void;
}

export default function AdminRequestsPanel({
  adminEmail,
  onClose,
}: AdminRequestsPanelProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/requests?adminEmail=${encodeURIComponent(adminEmail)}&status=${activeTab}`
      );
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
    setLoading(false);
  }, [adminEmail, activeTab]);

  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/requests?adminEmail=${encodeURIComponent(adminEmail)}&status=${activeTab}`
        );
        const data = await res.json();
        if (!cancelled && data.success) {
          setRequests(data.requests);
        }
      } catch (err) {
        console.error('Error fetching requests:', err);
      }
      if (!cancelled) setLoading(false);
    };
    doFetch();
    return () => { cancelled = true; };
  }, [adminEmail, activeTab]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    try {
      const res = await fetch('/api/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, adminEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      } else {
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

  const getTypeLabel = (type: string) => {
    if (type === 'registration') return 'Cadastro';
    if (type === 'password_change') return 'Troca de Senha';
    return type;
  };

  const getTypeColor = (type: string) => {
    if (type === 'registration') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (type === 'password_change') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div
        className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-orange-500/30 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="material-icons text-orange-500 text-2xl">admin_panel_settings</span>
            <h2 className="text-lg sm:text-xl font-bold text-white">Painel Administrativo</h2>
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
                return (
                  <div
                    key={req.id}
                    className="bg-gray-800 rounded-xl p-4 border border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(req.type)}`}>
                          {getTypeLabel(req.type)}
                        </span>
                        <span className="text-gray-400 text-xs">{formatDate(req.createdAt)}</span>
                      </div>
                      {activeTab === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(req.id, 'approve')}
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
                      {parsed.newPassword && <p>Nova senha: ••••••</p>}
                      {parsed.raw && <p>{parsed.raw}</p>}
                    </div>
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
