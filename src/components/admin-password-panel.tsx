'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Check,
  Ban,
  Unlock,
  Trash2,
  Shield,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/store/auth-store';

interface PendingRequest {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  createdAt: string;
}

interface ResolvedRequest {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string;
}

interface LockedUser {
  id: string;
  name: string | null;
  email: string;
  lockedUntil: string;
}

interface PanelData {
  pending: PendingRequest[];
  resolved: ResolvedRequest[];
  lockedUsers: LockedUser[];
}

interface Props {
  adminEmail: string;
  onClose: () => void;
}

export default function AdminPasswordPanel({ adminEmail, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved' | 'locked'>('pending');
  const [data, setData] = useState<PanelData>({ pending: [], resolved: [], lockedUsers: [] });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedResolved, setExpandedResolved] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await authFetch('/api/auth/password-requests');
        if (res.ok && !cancelled) {
          const json = await res.json();
          if (!cancelled) setData(json);
        } else if (!cancelled) {
          console.error('Password requests API returned:', res.status);
        }
      } catch (err) {
        console.error('Error fetching password requests:', err);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/auth/password-requests');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error('Password requests API returned:', res.status);
      }
    } catch (err) {
      console.error('Error fetching password requests:', err);
    }
    setLoading(false);
  }, []);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    try {
      const res = await authFetch('/api/auth/password-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        alert(json.error || 'Erro ao processar');
      }
    } catch {
      alert('Erro ao processar solicitação');
    }
    setProcessingId(null);
  };

  const handleUnlock = async (userId: string) => {
    try {
      const res = await authFetch('/api/auth/password-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', userId }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchData();
      } else {
        alert(json.error || 'Erro');
      }
    } catch {
      alert('Erro ao desbloquear');
    }
  };

  const handleDeleteOne = async (requestId: string) => {
    try {
      const res = await authFetch('/api/auth/password-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', requestId }),
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        alert(json.error || 'Erro');
      }
    } catch {
      alert('Erro');
    }
  };

  const handleDeleteResolved = async () => {
    if (!confirm('Limpar todo o histórico de solicitações resolvidas?')) return;
    try {
      const res = await authFetch('/api/auth/password-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteAll' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        alert(json.error || 'Erro');
      }
    } catch {
      alert('Erro');
    }
  };

  const handleDownloadSeed = async () => {
    setDownloading(true);
    try {
      const res = await authFetch('/api/auth/seed');
      if (!res.ok) {
        alert('Erro ao baixar seed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'seed-passwords.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao baixar seed');
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const pendingCount = data.pending.length;
  const lockedCount = data.lockedUsers.length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-zinc-900 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-zinc-700/50 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600/20 p-2 rounded-xl">
              <Shield className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Solicitações de Senha</h2>
              <p className="text-zinc-500 text-xs">Gerencie pedidos de troca de senha</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {(['pending', 'resolved', 'locked'] as const).map((tab) => {
            const count = tab === 'pending' ? pendingCount : tab === 'locked' ? lockedCount : 0;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 px-3 text-xs font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-orange-400'
                    : 'text-zinc-500 hover:text-zinc-400'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {tab === 'pending' ? 'Pendentes' : tab === 'resolved' ? 'Histórico' : 'Bloqueados'}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      tab === 'pending' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </span>
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-t" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
            </div>
          ) : activeTab === 'pending' && data.pending.length === 0 ? (
            <div className="text-center py-10">
              <Check className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Nenhuma solicitação pendente</p>
            </div>
          ) : activeTab === 'resolved' && data.resolved.length === 0 ? (
            <div className="text-center py-10">
              <Clock className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Nenhum histórico</p>
            </div>
          ) : activeTab === 'locked' && data.lockedUsers.length === 0 ? (
            <div className="text-center py-10">
              <Unlock className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Nenhum usuário bloqueado</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeTab === 'pending' && data.pending.map((req) => (
                <div key={req.id} className="bg-zinc-800/80 rounded-xl p-3.5 border border-zinc-700/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{req.userName || req.userEmail}</p>
                      <p className="text-zinc-500 text-xs truncate">{req.userEmail}</p>
                      <p className="text-zinc-600 text-[10px] mt-1">{formatDate(req.createdAt)}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAction(req.id, 'approve')}
                        disabled={processingId === req.id}
                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
                        title="Aprovar"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'reject')}
                        disabled={processingId === req.id}
                        className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
                        title="Rejeitar"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {activeTab === 'resolved' && data.resolved.slice(0, expandedResolved ? undefined : 5).map((req) => (
                <div key={req.id} className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-zinc-300 font-medium text-sm truncate">{req.userName || req.userEmail}</p>
                      <p className="text-zinc-500 text-xs truncate">{req.userEmail}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        req.status === 'approved'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}>
                        {req.status === 'approved' ? 'Aprovada' : 'Rejeitada'}
                      </span>
                      <button
                        onClick={() => handleDeleteOne(req.id)}
                        className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors"
                        title="Excluir este registro"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-zinc-600 text-[10px] mt-1">
                    {formatDate(req.createdAt)} · por {req.resolvedByName}
                  </p>
                </div>
              ))}
              {activeTab === 'locked' && data.lockedUsers.map((u) => (
                <div key={u.id} className="bg-zinc-800/80 rounded-xl p-3.5 border border-red-500/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{u.name || u.email}</p>
                      <p className="text-zinc-500 text-xs truncate">{u.email}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3 text-red-400" />
                        <p className="text-red-400/70 text-[10px]">Bloqueado até {formatDate(u.lockedUntil)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlock(u.id)}
                      className="bg-orange-600 hover:bg-orange-500 text-white p-2 rounded-lg transition-colors shrink-0"
                      title="Desbloquear"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 flex gap-2">
          <Button
            onClick={fetchData}
            variant="outline"
            className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Atualizar
          </Button>
          {activeTab === 'resolved' && data.resolved.length > 0 && (
            <Button
              onClick={handleDeleteResolved}
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-xs h-9"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Limpar
            </Button>
          )}
          <Button
            onClick={handleDownloadSeed}
            disabled={downloading}
            variant="outline"
            className="border-zinc-700 text-zinc-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 text-xs h-9"
            title="Baixar JSON seed de senhas"
          >
            <Download className={`w-3.5 h-3.5 mr-1.5 ${downloading ? 'animate-bounce' : ''}`} />
            {downloading ? 'Baixando...' : 'Seed'}
          </Button>
          {data.resolved.length > 5 && activeTab === 'resolved' && (
            <Button
              onClick={() => setExpandedResolved(!expandedResolved)}
              variant="ghost"
              className="text-zinc-500 hover:text-white text-xs h-9"
            >
              {expandedResolved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
