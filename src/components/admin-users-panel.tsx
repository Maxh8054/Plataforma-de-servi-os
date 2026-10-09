'use client';

/**
 * Painel Admin — Gestão de Usuários
 *
 * Travas de UI (além das travas da API):
 *  - Não permite desativar/rebaixar/excluir a própria conta
 *  - Não permite desativar/rebaixar/excluir o último admin ativo
 *  - Exclusão exige digitar o email do usuário + a senha do próprio admin (step-up)
 *  - Desativação pede confirmação explícita (derruba a sessão do usuário)
 *  - Todas as ações ficam registradas na auditoria (server-side)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch, useAuthStore } from '@/store/auth-store';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  department: string | null;
  isActive: boolean;
  isFirstAccess: boolean;
  createdAt: string;
  updatedAt: string;
}

type PanelMode = 'list' | 'create' | 'edit';

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors';
const primaryBtnCls =
  'bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors';
const secondaryBtnCls =
  'bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function AdminUsersPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<PanelMode>('list');

  // Identificação do próprio usuário (travas de UI) — já vem do auth-store
  const me = useAuthStore((s) => s.user);

  // ===== criar =====
  const [createForm, setCreateForm] = useState({
    email: '',
    name: '',
    department: '',
    role: 'user',
    password: '',
  });
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  // ===== editar =====
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: '', department: '', role: 'user', password: '' });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  // ===== exclusão (email + senha do admin) =====
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ===== desativação (confirmação inline) =====
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const res = await authFetch('/api/users');
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users as UserRow[]);
      } else {
        setListError(data.error || 'Erro ao carregar usuários.');
      }
    } catch {
      setListError('Erro de conexão ao carregar usuários.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const activeAdminCount = useMemo(
    () => users.filter((u) => u.role === 'admin' && u.isActive).length,
    [users]
  );
  const isLastAdmin = useCallback(
    (u: UserRow) => u.role === 'admin' && u.isActive && activeAdminCount === 1,
    [activeAdminCount]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 4000);
  }

  // ===== alternar ativo/inativo =====
  async function handleToggle(u: UserRow) {
    setToggleBusyId(u.id);
    setToggleError('');
    try {
      const res = await authFetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, updates: { isActive: !u.isActive } }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flash(u.isActive ? `Usuário ${u.email} desativado (sessão derrubada).` : `Usuário ${u.email} reativado.`);
        setConfirmDeactivateId(null);
        await fetchUsers();
      } else {
        setToggleError(data.error || 'Erro ao atualizar usuário.');
      }
    } catch {
      setToggleError('Erro de conexão ao atualizar usuário.');
    }
    setToggleBusyId(null);
  }

  // ===== criar =====
  async function handleCreate() {
    setCreateError('');
    const email = createForm.email.toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError('Informe um email válido.');
      return;
    }
    if (createForm.password.length < 8) {
      setCreateError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    setCreateBusy(true);
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: createForm.password,
          name: createForm.name.trim() || undefined,
          department: createForm.department.trim() || undefined,
          role: createForm.role,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flash(`Usuário ${email} criado.`);
        setCreateForm({ email: '', name: '', department: '', role: 'user', password: '' });
        setMode('list');
        await fetchUsers();
      } else {
        setCreateError(data.error || 'Erro ao criar usuário.');
      }
    } catch {
      setCreateError('Erro de conexão ao criar usuário.');
    }
    setCreateBusy(false);
  }

  // ===== editar =====
  function openEdit(u: UserRow) {
    setEditing(u);
    setEditForm({
      name: u.name ?? '',
      department: u.department ?? '',
      role: u.role === 'admin' ? 'admin' : 'user',
      password: '',
    });
    setEditError('');
    setMode('edit');
  }

  async function handleEditSave() {
    if (!editing) return;
    setEditError('');
    if (editForm.password && editForm.password.length < 8) {
      setEditError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    const updates: Record<string, unknown> = {
      name: editForm.name.trim() || null,
      department: editForm.department.trim() || null,
    };
    // função do próprio usuário não muda (trava de auto-rebaixamento)
    if (editing.id !== me?.id) {
      updates.role = editForm.role;
    }
    if (editForm.password) updates.password = editForm.password;

    setEditBusy(true);
    try {
      const res = await authFetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editing.id, updates }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flash(`Usuário ${editing.email} atualizado.`);
        setEditing(null);
        setMode('list');
        await fetchUsers();
      } else {
        setEditError(data.error || 'Erro ao atualizar usuário.');
      }
    } catch {
      setEditError('Erro de conexão ao atualizar usuário.');
    }
    setEditBusy(false);
  }

  // ===== excluir =====
  function openDelete(u: UserRow) {
    setDeleting(u);
    setDeleteEmail('');
    setDeletePassword('');
    setDeleteError('');
  }

  async function handleDelete() {
    if (!deleting) return;
    if (deleteEmail.trim().toLowerCase() !== deleting.email.toLowerCase()) {
      setDeleteError('Digite o email do usuário exatamente igual para confirmar.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Digite a sua senha de administrador.');
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await authFetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deleting.id, adminPassword: deletePassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flash(`Usuário ${deleting.email} excluído. Histórico de auditoria preservado.`);
        setDeleting(null);
        await fetchUsers();
      } else {
        setDeleteError(data.error || 'Erro ao excluir usuário.');
      }
    } catch {
      setDeleteError('Erro de conexão ao excluir usuário.');
    }
    setDeleteBusy(false);
  }

  const rowBlocked = (u: UserRow) => {
    if (me && u.id === me.id) return true; // própria conta
    if (isLastAdmin(u)) return true; // último admin ativo
    return false;
  };

  // ===== render =====
  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-orange-500/30 shadow-2xl flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="material-icons text-orange-500 text-2xl">manage_accounts</span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Usuários</h2>
              <p className="text-gray-500 text-xs">Criar, editar, desativar ou excluir contas — toda ação é auditada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar painel de usuários"
            className="text-gray-500 hover:text-white transition-colors p-1"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Aviso de sucesso / erro de ações */}
        {(notice || toggleError) && (
          <div className="px-4 sm:px-5 pt-3">
            {notice && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg px-3 py-2">
                {notice}
              </div>
            )}
            {toggleError && (
              <div className="mt-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
                {toggleError}
              </div>
            )}
          </div>
        )}

        {/* Modo LISTA */}
        {mode === 'list' && (
          <>
            <div className="p-4 sm:p-5 border-b border-gray-800 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-base">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, email ou setor…"
                  className={`${inputCls} pl-9`}
                  aria-label="Buscar usuários"
                />
              </div>
              <button onClick={() => { setMode('create'); setCreateError(''); }} className={primaryBtnCls}>
                <span className="material-icons text-sm align-middle mr-1">person_add</span>
                Novo usuário
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-5 space-y-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <span className="material-icons animate-spin text-orange-500 text-3xl">refresh</span>
                  <p className="text-gray-500 text-xs mt-3">Carregando usuários…</p>
                </div>
              ) : listError ? (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
                  {listError}
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">Nenhum usuário encontrado.</p>
              ) : (
                filtered.map((u) => {
                  const blocked = rowBlocked(u);
                  return (
                    <div key={u.id} className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-white text-sm font-medium truncate">{u.name || 'Sem nome'}</p>
                            {u.role === 'admin' ? (
                              <span className="text-[10px] uppercase tracking-wide bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5">admin</span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-wide bg-gray-700 text-gray-300 rounded-full px-2 py-0.5">usuário</span>
                            )}
                            {u.isActive ? (
                              <span className="text-[10px] uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">ativo</span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-wide bg-red-500/15 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">inativo</span>
                            )}
                            {me && u.id === me.id && (
                              <span className="text-[10px] uppercase tracking-wide bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded-full px-2 py-0.5">você</span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs mt-1 truncate">{u.email}{u.department ? ` · ${u.department}` : ''}</p>
                          <p className="text-gray-600 text-[11px] mt-0.5">Criado em {formatDate(u.createdAt)}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => openEdit(u)}
                            className="bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1"
                            title="Editar usuário"
                          >
                            <span className="material-icons text-sm">edit</span> Editar
                          </button>
                          {u.isActive ? (
                            <button
                              onClick={() => { setConfirmDeactivateId(confirmDeactivateId === u.id ? null : u.id); setToggleError(''); }}
                              disabled={blocked || toggleBusyId === u.id}
                              className="bg-yellow-600/80 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1"
                              title={blocked ? (me && u.id === me.id ? 'Você não pode desativar a própria conta' : 'Não é possível desativar o último admin ativo') : 'Desativar acesso'}
                            >
                              <span className="material-icons text-sm">block</span> Desativar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggle(u)}
                              disabled={toggleBusyId === u.id}
                              className="bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1"
                              title="Reativar acesso"
                            >
                              <span className="material-icons text-sm">check_circle</span> Reativar
                            </button>
                          )}
                          <button
                            onClick={() => openDelete(u)}
                            disabled={blocked}
                            className="bg-red-600/90 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1"
                            title={blocked ? (me && u.id === me.id ? 'Você não pode excluir a si mesmo' : 'Não é possível excluir o último admin ativo') : 'Excluir usuário'}
                          >
                            <span className="material-icons text-sm">delete</span> Excluir
                          </button>
                        </div>
                      </div>

                      {/* Confirmação inline de desativação */}
                      {confirmDeactivateId === u.id && (
                        <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                          <p className="text-yellow-300 text-xs">
                            Desativar remove o acesso <strong>imediatamente</strong> (inclusive sessão aberta). O histórico fica preservado e é reversível.
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleToggle(u)}
                              disabled={toggleBusyId === u.id}
                              className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                            >
                              {toggleBusyId === u.id ? 'Desativando…' : 'Confirmar desativação'}
                            </button>
                            <button
                              onClick={() => setConfirmDeactivateId(null)}
                              className={secondaryBtnCls}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Confirmação de exclusão (email + senha do admin) */}
                      {deleting?.id === u.id && (
                        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
                          <p className="text-red-300 text-xs">
                            <strong>Atenção:</strong> exclusão permanente. O histórico de auditoria do usuário é preservado (desvinculado).
                            Digite o email dele e a <strong>sua senha de admin</strong> para confirmar.
                          </p>
                          <input
                            type="email"
                            value={deleteEmail}
                            onChange={(e) => setDeleteEmail(e.target.value)}
                            placeholder={`Digite "${u.email}" para confirmar`}
                            className={inputCls}
                            autoComplete="off"
                          />
                          <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            placeholder="Sua senha de administrador"
                            className={inputCls}
                            autoComplete="current-password"
                          />
                          {deleteError && (
                            <p className="text-red-400 text-xs">{deleteError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={handleDelete}
                              disabled={deleteBusy}
                              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                            >
                              {deleteBusy ? 'Excluindo…' : 'Excluir definitivamente'}
                            </button>
                            <button onClick={() => setDeleting(null)} className={secondaryBtnCls}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Modo CRIAR */}
        {mode === 'create' && (
          <div className="overflow-y-auto p-4 sm:p-5 space-y-3">
            <button
              onClick={() => setMode('list')}
              className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
            >
              <span className="material-icons text-sm">arrow_back</span> Voltar para a lista
            </button>
            <h3 className="text-white text-sm font-semibold">Novo usuário</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="email@empresa.com"
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Nome</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Nome completo"
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Setor</label>
                <input
                  value={createForm.department}
                  onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                  placeholder="Ex.: Manutenção"
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Função</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className={inputCls}
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-gray-400 text-xs block mb-1">Senha temporária (mín. 8 caracteres) *</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Senha inicial do usuário"
                  className={inputCls}
                  autoComplete="off"
                />
                <p className="text-gray-600 text-[11px] mt-1">
                  Compartilhe por canal seguro. Recomende que o usuário troque a senha no primeiro acesso.
                </p>
              </div>
            </div>
            {createError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
                {createError}
              </div>
            )}
            <button onClick={handleCreate} disabled={createBusy} className={primaryBtnCls}>
              {createBusy ? 'Criando…' : 'Criar usuário'}
            </button>
          </div>
        )}

        {/* Modo EDITAR */}
        {mode === 'edit' && editing && (
          <div className="overflow-y-auto p-4 sm:p-5 space-y-3">
            <button
              onClick={() => { setMode('list'); setEditing(null); }}
              className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
            >
              <span className="material-icons text-sm">arrow_back</span> Voltar para a lista
            </button>
            <h3 className="text-white text-sm font-semibold">
              Editar: <span className="text-orange-400">{editing.email}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Nome</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Setor</label>
                <input
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className={inputCls}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Função</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  disabled={!!me && editing.id === me.id}
                  className={`${inputCls} disabled:opacity-50`}
                >
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
                {me && editing.id === me.id && (
                  <p className="text-gray-600 text-[11px] mt-1">Você não pode alterar a própria função.</p>
                )}
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Nova senha (opcional)</label>
                <input
                  type="text"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Deixe vazio para manter"
                  className={inputCls}
                  autoComplete="new-password"
                />
                <p className="text-gray-600 text-[11px] mt-1">Trocar a senha derruba as sessões abertas do usuário.</p>
              </div>
            </div>
            {editError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
                {editError}
              </div>
            )}
            <button onClick={handleEditSave} disabled={editBusy} className={primaryBtnCls}>
              {editBusy ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
