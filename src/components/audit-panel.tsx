'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/store/auth-store';

interface AuditItem {
  id: string;
  action: string;
  userEmail: string | null;
  userName: string | null;
  ip: string | null;
  details: string | null;
  severity?: string;
  createdAt: string;
}

interface PresenceUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  lastSeenAt: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login_success: { label: 'Login OK', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  login_failed: { label: 'Login falhou', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  user_locked: { label: 'Conta bloqueada', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  brute_force_blocked: { label: 'IP bloqueado', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  first_access_password_set: { label: 'Senha criada (1º acesso)', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  password_request: { label: 'Pedido de troca de senha', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  password_approved: { label: 'Senha aprovada', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  password_rejected: { label: 'Senha rejeitada', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  password_request_expired: { label: 'Pedido expirado', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  password_changed: { label: 'Senha alterada', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  user_unlocked: { label: 'Conta desbloqueada', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  registration_created: { label: 'Cadastro solicitado', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  registration_code_sent: { label: 'Código de cadastro enviado', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  registration_code_verified: { label: 'Email do cadastro verificado', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  registration_code_failed: { label: 'Código de cadastro incorreto', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  registration_approved: { label: 'Cadastro aprovado', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  registration_rejected: { label: 'Cadastro rejeitado', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  registration_denied: { label: 'Cadastro negado', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  registration_approve_denied: { label: 'Aprovação negada', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  twofactor_code_sent: { label: 'Código 2FA enviado', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  twofactor_code_failed: { label: '2FA incorreto', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  role_changed: { label: 'Cargo alterado', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  user_created: { label: 'Usuário criado', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  user_updated: { label: 'Usuário atualizado', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  user_deleted: { label: 'Usuário excluído', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  user_password_reset: { label: 'Senha resetada pelo admin', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  users_mass_password_reset: { label: 'Reset total de senhas', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  first_access_code_resent: { label: 'Código de 1º acesso reenviado', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  view_open: { label: 'Acessou tela', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  logout: { label: 'Logout', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  seed_exported: { label: 'Dados exportados', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  seed_imported: { label: 'Dados importados', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const PAGE_SIZE = 50;

/** Estilo da linha conforme severidade — eventos "estranhos" ficam à vista */
function severityRowStyle(severity?: string): string {
  if (severity === 'critical') {
    return 'bg-red-500/10 border-l-4 border-l-red-500 border border-red-500/50 shadow-lg shadow-red-900/30';
  }
  if (severity === 'warning') {
    return 'bg-amber-500/10 border-l-4 border-l-amber-500 border border-amber-500/40';
  }
  return 'bg-gray-800/70 border border-gray-700/60';
}

export default function AuditPanel({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [applied, setApplied] = useState({ action: '', email: '', suspicious: false });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Presença / online
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [recent, setRecent] = useState<PresenceUser[]>([]);
  const [showOnline, setShowOnline] = useState(true);

  const fetchLogs = useCallback(async (skip: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), skip: String(skip) });
      if (applied.action) params.set('action', applied.action);
      if (applied.email) params.set('email', applied.email);
      if (applied.suspicious) params.set('suspicious', '1');
      const res = await authFetch(`/api/admin/audit?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs((prev) => (append ? [...prev, ...data.logs] : data.logs));
        setHasMore(data.logs.length === PAGE_SIZE);
      } else {
        setError(data.error || 'Erro ao carregar logs.');
      }
    } catch {
      setError('Erro de conexão ao carregar logs.');
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [applied]);

  const fetchPresence = useCallback(async () => {
    try {
      const res = await authFetch('/api/presence');
      const data = await res.json();
      if (res.ok && data.success) {
        setOnline(data.online || []);
        setRecent(data.recent || []);
      }
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchLogs(0, false);
  }, [fetchLogs]);

  useEffect(() => {
    fetchPresence();
    const interval = setInterval(fetchPresence, 30_000);
    return () => clearInterval(interval);
  }, [fetchPresence]);

  const applyFilters = () => {
    setApplied({ action: actionFilter, email: emailFilter.trim(), suspicious: suspiciousOnly });
  };

  const toggleSuspicious = () => {
    const next = !suspiciousOnly;
    setSuspiciousOnly(next);
    setApplied({ action: actionFilter, email: emailFilter.trim(), suspicious: next });
  };

  const formatDate = (dateStr: string) => {
    // Horários gravados em UTC — exibe no horário do Brasil
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const minutesAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'agora';
    if (mins === 1) return 'há 1 min';
    return `há ${mins} min`;
  };

  const suspiciousCount = logs.filter((l) => l.severity === 'warning' || l.severity === 'critical').length;

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-orange-500/30 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="material-icons text-orange-500 text-2xl">history</span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Auditoria do Sistema</h2>
              <p className="text-gray-500 text-xs">Quem fez o quê e quando — horário de Brasília</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Quem está online */}
        <div className="px-4 sm:px-6 py-3 border-b border-gray-800 bg-gray-900/60">
          <button
            onClick={() => setShowOnline(!showOnline)}
            className="flex items-center gap-2 w-full text-left group"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${online.length > 0 ? 'bg-green-400 opacity-75 animate-ping' : 'bg-gray-600'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${online.length > 0 ? 'bg-green-500' : 'bg-gray-600'}`}></span>
            </span>
            <span className="text-sm font-semibold text-white">
              {online.length} {online.length === 1 ? 'usuário online' : 'usuários online'} agora
            </span>
            <span className="material-icons text-gray-500 text-base group-hover:text-gray-300 transition-colors">
              {showOnline ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {showOnline && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {online.length === 0 && recent.length === 0 && (
                <span className="text-gray-600 text-xs">Ninguém nas últimas horas.</span>
              )}
              {online.map((u) => (
                <span
                  key={u.id}
                  title={`${u.email} · ${u.role === 'admin' ? 'Administrador' : 'Usuário'}`}
                  className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-300 rounded-full pl-2 pr-2.5 py-0.5 text-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  {u.name || u.email}
                </span>
              ))}
              {recent.map((u) => (
                <span
                  key={u.id}
                  title={`${u.email} · visto ${minutesAgo(u.lastSeenAt)}`}
                  className="inline-flex items-center gap-1.5 bg-gray-800 border border-gray-700 text-gray-400 rounded-full pl-2 pr-2.5 py-0.5 text-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                  {u.name || u.email} · {minutesAgo(u.lastSeenAt)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-b border-gray-800">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500/60"
          >
            <option value="">Todos os eventos</option>
            {Object.entries(ACTION_LABELS).map(([value, info]) => (
              <option key={value} value={value}>{info.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filtrar por email..."
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-orange-500/60"
          />
          <button
            onClick={toggleSuspicious}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 border ${
              suspiciousOnly
                ? 'bg-red-500/20 border-red-500/50 text-red-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
            title="Mostrar apenas eventos suspeitos (falhas, bloqueios, ações críticas)"
          >
            <span className="material-icons text-sm">warning</span>
            Suspeitos
            {suspiciousCount > 0 && !suspiciousOnly && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {suspiciousCount}
              </span>
            )}
          </button>
          <button
            onClick={applyFilters}
            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            <span className="material-icons text-sm">search</span>
            Filtrar
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <span className="material-icons animate-spin text-orange-500 text-3xl">refresh</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400 text-sm">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10">
              <span className="material-icons text-gray-600 text-4xl mb-2">inbox</span>
              <p className="text-gray-500 text-sm">Nenhum evento encontrado com esses filtros.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const info = ACTION_LABELS[log.action] || {
                  label: log.action,
                  color: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
                };
                const isCritical = log.severity === 'critical';
                const isWarning = log.severity === 'warning';
                return (
                  <div
                    key={log.id}
                    className={`rounded-xl p-3 transition-colors ${severityRowStyle(log.severity)}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${info.color}`}>
                        {info.label}
                      </span>
                      {(isCritical || isWarning) && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isCritical
                              ? 'bg-red-500/25 text-red-300 border-red-500/60 animate-pulse'
                              : 'bg-amber-500/25 text-amber-300 border-amber-500/60'
                          }`}
                        >
                          <span className="material-icons text-[11px]">warning</span>
                          {isCritical ? 'CRÍTICO' : 'ATENÇÃO'}
                        </span>
                      )}
                      <span className="text-gray-400 text-xs">{formatDate(log.createdAt)}</span>
                    </div>
                    <p className={`text-sm font-medium break-all ${isCritical ? 'text-red-200' : isWarning ? 'text-amber-100' : 'text-white'}`}>
                      {log.userEmail || log.userName || '—'}
                    </p>
                    <div className="flex flex-wrap gap-x-3 text-[11px] text-gray-500 mt-0.5">
                      {log.ip && <span>IP: {log.ip}</span>}
                      {log.details && <span className="break-all">{log.details}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-gray-800 flex gap-2">
          {hasMore && (
            <button
              onClick={() => fetchLogs(logs.length, true)}
              disabled={loadingMore}
              className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loadingMore ? (
                <span className="material-icons animate-spin text-sm">refresh</span>
              ) : (
                <span className="material-icons text-sm">expand_more</span>
              )}
              Carregar mais
            </button>
          )}
          <button
            onClick={() => { fetchLogs(0, false); fetchPresence(); }}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-icons text-sm">refresh</span>
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
}
