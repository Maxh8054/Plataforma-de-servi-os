'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// ==================== TYPES ====================
interface ZabUser {
  id: number;
  nome: string;
  email: string;
  senha: string;
  nivel: string;
  pontos: number;
  conquistas: string[];
  role: string;
}

interface ZabDemanda {
  id: number;
  funcionarioId: number;
  nomeFuncionario: string;
  emailFuncionario: string;
  categoria: string;
  prioridade: string;
  complexidade: string;
  descricao: string;
  local: string;
  dataCriacao: string;
  dataLimite: string;
  status: string;
  isRotina: boolean;
  diasSemana: number[];
  tag: string | null;
  comentarios: string;
  comentarioGestor: string;
  dataConclusao: string | null;
  atribuidos: { id: number; nome: string; email: string }[];
  anexosCriacao: { name: string; data: string; type: string }[];
  anexosResolucao: { name: string; data: string; type: string }[];
  comentarioReprovacaoAtribuicao: string;
  nomeDemanda: string;
  dataAtualizacao: string | null;
  criadoPor: number | null;
  atualizadoPor: number | null;
  comentariosUsuarios: { id: number; nome: string; comentario: string; data: string }[];
}

interface ZabNote {
  id: number;
  titulo: string;
  conteudo: string;
  cor: string;
  dataCriacao: string;
  criadoPor: number;
  atribuidoA: number | null;
  audioData: string | null;
  atualizadoEm: string | null;
}

interface ZabFeedback {
  id: number;
  funcionarioId: number;
  gestorId: number;
  tipo: string;
  mensagem: string;
  dataCriacao: string;
}

interface Notification {
  id: number;
  text: string;
  read: boolean;
  priority: boolean;
  demandaId?: number;
  titulo?: string;
  tipo?: string;
}

// ==================== CONSTANTS ====================
const CATEGORIAS = [
  'Comercial/Negócio','Vendas','Pós-venda','Negociação','Proposta/Orçamento',
  'Follow-up','Fidelização','Gestão/Administrativo','Planejamento','Gestão de Projetos',
  'Alinhamento Interno','Tomada de Decisão','Auditoria','Compliance','Compras',
  'Técnico/Operacional','Manutenção','Implantação','Testes','Correção de Erros',
  'Monitoramento','Otimização','TI/Dados','Análise de Dados','Automação',
  'Integração de Sistemas','Infraestrutura','Segurança','Backup','Comunicação',
  'Apresentação','Treinamento','Documentação','Feedback','Atendimento','Outros'
];

const LOCAIS = ['Lundin', 'R&D', 'U&M'];

const MANAGER_MAP: Record<string, { nome: string; email: string }[]> = {
  'R&D': [{ nome: 'Emerson', email: 'emerson-a@zaminebrasil.com' }],
  'Lundin': [{ nome: 'Fabricio', email: 'fabricio-c@zaminebrasil.com' }],
  'U&M': [{ nome: 'Fabricio', email: 'fabricio-c@zaminebrasil.com' }],
};

const DEFAULT_USERS = [
  { id: 1, nome: 'Ranielly Miranda De Souza', email: 'ranielly-s@zaminebrasil.com', senha: '123456', nivel: 'Senior', role: 'funcionario' },
  { id: 2, nome: 'Girlene da Silva Nogueira', email: 'girlene-n@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 3, nome: 'Rafaela Cristine da Silva Martins', email: 'rafaela-m@zaminebrasil.com', senha: '123456', nivel: 'Senior', role: 'funcionario' },
  { id: 5, nome: 'Marcos Antônio Lino Rosa', email: 'marcos-a@zaminebrasil.com', senha: '123456', nivel: 'Junior', role: 'funcionario' },
  { id: 6, nome: 'Marcos Paulo Moraes Borges', email: 'marcos-b@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 7, nome: 'Marcelo Goncalves de Paula', email: 'marcelo-p@zaminebrasil.com', senha: '123456', nivel: 'Senior', role: 'funcionario' },
  { id: 8, nome: 'Higor Ataides Macedo', email: 'higor-a@zaminebrasil.com', senha: '123456', nivel: 'Junior', role: 'funcionario' },
  { id: 9, nome: 'Weslley Ferreira de Siqueira', email: 'weslley-f@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 11, nome: 'Charles de Andrade', email: 'charles-a@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 12, nome: 'Jose Carlos Rodrigues de Santana', email: 'jose-s@zaminebrasil.com', senha: '123456', nivel: 'Junior', role: 'funcionario' },
  { id: 13, nome: 'Max Henrique Araujo', email: 'max-r@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 14, nome: 'Emerson Luiz Alexandre', email: 'emerson-a@zaminebrasil.com', senha: 'admin123', nivel: 'Senior', role: 'gestor' },
  { id: 15, nome: 'Warlen Eduardo Pereira Silva', email: 'warlen-s@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 16, nome: 'Cicero de Sousa Costa', email: 'cicero-c@zaminebrasil.com', senha: '123456', nivel: 'Senior', role: 'funcionario' },
  { id: 17, nome: 'Guilherme Rodrigues Gonçalves', email: 'guilherme-r@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 99, nome: 'Gestor do Sistema', email: 'gestor@zaminebrasil.com', senha: 'admin123', nivel: 'Administrador', role: 'gestor' },
  { id: 100, nome: 'Fabricio Cezar de Almeida', email: 'fabricio-c@zaminebrasil.com', senha: 'admin123', nivel: 'Coordenador', role: 'gestor'},
  { id: 101, nome: 'Julio Cesar Sanches', email: 'julio-s@zaminebrasil.com', senha: 'admin123', nivel: 'Gerente', role: 'gestor' },
];

const STATUS_LABELS: Record<string, string> = {
  'pendente': 'Pendente',
  'atribuida_pendente_aceitacao': 'Atribuída',
  'reprovada_pelo_atribuido': 'Reprovada (Atribuído)',
  'finalizado_pendente_aprovacao': 'Aguardando Aprovação',
  'aprovada': 'Aprovada',
  'reprovada': 'Reprovada',
  'entregue_atraso': 'Entregue com Atraso',
};

const STATUS_COLORS: Record<string, string> = {
  'pendente': '#f39c12',
  'atribuida_pendente_aceitacao': '#3498db',
  'reprovada_pelo_atribuido': '#f39c12',
  'finalizado_pendente_aprovacao': '#2c3e50',
  'aprovada': '#27ae60',
  'reprovada': '#e74c3c',
  'atrasado': '#e74c3c',
  'entregue_atraso': '#e67e22',
  'rotina': '#9b59b6',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Importante': '#e74c3c',
  'Média': '#f39c12',
  'Relevante': '#27ae60',
};

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const NOTE_COLORS = [
  { value: '#3498db', label: 'Azul' },
  { value: '#27ae60', label: 'Verde' },
  { value: '#e74c3c', label: 'Vermelho' },
  { value: '#f1c40f', label: 'Amarelo' },
  { value: '#9b59b6', label: 'Roxo' },
];

// ==================== HELPERS ====================
function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch { return dateStr; }
}

function formatDateTimeBR(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return dateStr; }
}

function isOverdue(demanda: ZabDemanda): boolean {
  if (!demanda.dataLimite) return false;
  if (demanda.status === 'aprovada' || demanda.status === 'reprovada') return false;
  // Timer stops when sent to analysis - no longer counts as running overdue
  if (demanda.status === 'finalizado_pendente_aprovacao') return false;
  return new Date(demanda.dataLimite) < new Date();
}

// Check if a demanda was delivered late (submitted after deadline)
function wasDeliveredLate(demanda: ZabDemanda): boolean {
  if (!demanda.dataLimite || !demanda.dataConclusao) return false;
  if (demanda.status !== 'finalizado_pendente_aprovacao' && demanda.status !== 'aprovada' && demanda.status !== 'reprovada') return false;
  return new Date(demanda.dataConclusao) > new Date(demanda.dataLimite);
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getDisplayStatus(demanda: ZabDemanda): string {
  if (isOverdue(demanda) && demanda.status !== 'aprovada' && demanda.status !== 'reprovada' && demanda.status !== 'finalizado_pendente_aprovacao') return 'atrasado';
  // Show 'entregue_atraso' for demandas submitted after deadline
  if (wasDeliveredLate(demanda) && demanda.status === 'finalizado_pendente_aprovacao') return 'entregue_atraso';
  return demanda.status;
}

// ==================== EMAIL HELPER ====================
const openEmail = (to: string, subject: string, body: string) => {
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, '_blank');
};

// ==================== API ====================
const fetchApi = async (path: string, options?: RequestInit) => {
  const res = await fetch(`/api/zab-flow${path}`, options);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
};

// ==================== COMPONENT ====================
export default function ZabFlowModal({ onClose }: { onClose: () => void }) {
  // Auth
  const [currentUser, setCurrentUser] = useState<ZabUser | null>(null);
  const [loginUserId, setLoginUserId] = useState<number>(0);
  const [loginSenha, setLoginSenha] = useState('');
  const [loginError, setLoginError] = useState('');
  const [viewType, setViewType] = useState<'geral' | 'proprio'>('proprio');

  // Data
  const [usuarios, setUsuarios] = useState<ZabUser[]>(DEFAULT_USERS as ZabUser[]);
  const [demandas, setDemandas] = useState<ZabDemanda[]>([]);
  const [notes, setNotes] = useState<ZabNote[]>([]);
  const [feedbacks, setFeedbacks] = useState<ZabFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState(true);
  const [seeded, setSeeded] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // Dashboard filters
  const [dashFilterEmployee, setDashFilterEmployee] = useState('');
  const [dashFilterPeriod, setDashFilterPeriod] = useState(0); // 0 = Todos
  const [dashFilterCategory, setDashFilterCategory] = useState('');
  const [dashFilterPriority, setDashFilterPriority] = useState('');

  // Demand form
  const [formNomeDemanda, setFormNomeDemanda] = useState('');
  const [formCategoria, setFormCategoria] = useState('');
  const [formPrioridade, setFormPrioridade] = useState('Média');
  const [formComplexidade, setFormComplexidade] = useState('Médio');
  const [formLocal, setFormLocal] = useState('Lundin');
  const [formDescricao, setFormDescricao] = useState('');
  const [formDataLimite, setFormDataLimite] = useState('');
  const [formIsRotina, setFormIsRotina] = useState(false);
  const [formDiasSemana, setFormDiasSemana] = useState<number[]>([]);
  const [formAtribuidos, setFormAtribuidos] = useState<{ id: number; nome: string; email: string }[]>([]);
  const [formAnexos, setFormAnexos] = useState<{ name: string; data: string; type: string }[]>([]);
  const [formAtribuidoSearch, setFormAtribuidoSearch] = useState('');
  const [formCategoriaSearch, setFormCategoriaSearch] = useState('');

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResolucaoModal, setShowResolucaoModal] = useState(false);
  const [showReprovacaoModal, setShowReprovacaoModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Selected demanda
  const [selectedDemanda, setSelectedDemanda] = useState<ZabDemanda | null>(null);

  // Modal forms
  const [resolucaoComment, setResolucaoComment] = useState('');
  const [resolucaoAnexos, setResolucaoAnexos] = useState<{ name: string; data: string; type: string }[]>([]);
  const [reprovacaoReason, setReprovacaoReason] = useState('');
  const [reprovacaoExtendDays, setReprovacaoExtendDays] = useState(0);
  const [reassignUserId, setReassignUserId] = useState(0);
  const [extendDays, setExtendDays] = useState(1);
  const [extendReason, setExtendReason] = useState('');
  const [commentText, setCommentText] = useState('');

  // Edit form
  const [editForm, setEditForm] = useState({
    nomeDemanda: '', categoria: '', prioridade: 'Média', complexidade: 'Médio',
    local: 'Lundin', descricao: '', isRotina: false, diasSemana: [] as number[],
    atribuidos: [] as { id: number; nome: string; email: string }[],
  });

  // Notes
  const [noteForm, setNoteForm] = useState({ titulo: '', conteudo: '', cor: '#3498db', atribuidoA: 0 });
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

  // Tab filters
  const [pendenteFilter, setPendenteFilter] = useState({ employee: '', status: '', local: '', date: '' });
  const [minhasFilter, setMinhasFilter] = useState({ status: '', date: '' });
  const [analiseFilter, setAnaliseFilter] = useState({ employee: '', date: '' });
  const [atrasadasFilter, setAtrasadasFilter] = useState({ employee: '', priority: '' });
  const [concluidasFilter, setConcluidasFilter] = useState({ employee: '', date: '' });
  const [selectedAtrasadas, setSelectedAtrasadas] = useState<number[]>([]);
  const [rankingPeriod, setRankingPeriod] = useState(30);
  const [notesFilter, setNotesFilter] = useState({ month: '', year: '' });
  const [mapFilter, setMapFilter] = useState({ status: '', employee: '', local: '' });
  const [mapSort, setMapSort] = useState('priority');
  const [cobrancaFilter, setCobrancaFilter] = useState({ employee: '', priority: '' });

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificacaoPermissao, setNotificacaoPermissao] = useState(false);

  // Success/error messages
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Import state
  const [importProgress, setImportProgress] = useState('');

  // ==================== EFFECTS ====================
  useEffect(() => {
    const init = async () => {
      try {
        await fetchApi('/seed', { method: 'POST' });
        setSeeded(true);
      } catch { /* already seeded */ }
      try {
        const users = await fetchApi('/usuarios');
        setUsuarios(users);
      } catch { /* use defaults */ }
      setServerStatus(true);
    };
    init();
  }, []);

  const loadDemandas = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (currentUser.role === 'funcionario') {
        params.funcionarioId = String(currentUser.id);
      }
      const data = await fetchApi(`/demandas?${new URLSearchParams(params)}`);
      setDemandas(data);
      setServerStatus(true);
    } catch {
      setServerStatus(false);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) loadDemandas();
  }, [currentUser, loadDemandas]);

  useEffect(() => {
    if (!currentUser) return;
    const loadNotes = async () => {
      try {
        const data = await fetchApi(`/anotacoes?criadoPor=${currentUser.id}`);
        setNotes(data);
      } catch { /* ignore */ }
    };
    loadNotes();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const loadFeedbacks = async () => {
      try {
        const data = await fetchApi('/feedbacks');
        setFeedbacks(data);
      } catch { /* ignore */ }
    };
    loadFeedbacks();
  }, [currentUser]);

  // Load notifications from DB on login
  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await fetchApi(`/notificacoes?usuarioId=${currentUser.id}`);
      const mapped = data.map((n: { id: number; titulo: string; mensagem: string; tipo: string; lida: boolean; demandaId: number | null }) => ({
        id: n.id,
        text: n.mensagem,
        read: n.lida,
        priority: n.tipo === 'danger' || n.tipo === 'cobranca',
        demandaId: n.demandaId || undefined,
        titulo: n.titulo,
        tipo: n.tipo,
      }));
      setNotifications(mapped);
    } catch { /* ignore */ }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) loadNotifications();
  }, [currentUser, loadNotifications]);

  // Generate notifications based on demandas changes
  useEffect(() => {
    if (!currentUser) return;
    const assigned = demandas.filter(d =>
      d.status === 'atribuida_pendente_aceitacao' &&
      d.atribuidos.some(a => a.id === currentUser.id)
    );
    // For assigned demandas, create notifications if not already existing
    assigned.forEach(d => {
      const existing = notifications.find(n => n.demandaId === d.id && n.tipo === 'atribuicao');
      if (!existing) {
        // Create notification via API
        fetchApi('/notificacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuarioId: d.id !== currentUser.id ? currentUser.id : d.funcionarioId,
            titulo: 'Nova Atribuição',
            mensagem: `Você foi atribuído a: ${d.nomeDemanda || d.tag}`,
            tipo: 'atribuicao',
            demandaId: d.id,
          }),
        }).catch(() => {});
      }
    });
  }, [currentUser, demandas, notifications]);

  // Request browser notification permission
  useEffect(() => {
    if (currentUser && 'Notification' in window && Notification.permission === 'default') {
      // We'll request on first interaction instead of immediately
    }
    if ('Notification' in window) {
      setNotificacaoPermissao(Notification.permission === 'granted');
    }
  }, [currentUser]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser, loadNotifications]);

  // Server status check
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await fetchApi('/usuarios');
        setServerStatus(true);
      } catch { setServerStatus(false); }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ==================== COMPUTED DATA ====================
  const isGestor = currentUser?.role === 'gestor';

  const filteredDemandas = useMemo(() => {
    let result = [...demandas];
    if (currentUser && (currentUser.role === 'funcionario' || viewType === 'proprio')) {
      result = result.filter(d =>
        d.funcionarioId === currentUser.id ||
        d.atribuidos.some(a => a.id === currentUser.id) ||
        d.criadoPor === currentUser.id
      );
    }
    return result;
  }, [demandas, currentUser, viewType]);

  const stats = useMemo(() => {
    let filtered = [...filteredDemandas];
    if (dashFilterPeriod > 0) {
      const now = new Date();
      const periodStart = new Date(now.getTime() - dashFilterPeriod * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(d => new Date(d.dataCriacao) >= periodStart);
    }
    if (dashFilterEmployee) filtered = filtered.filter(d => d.funcionarioId === Number(dashFilterEmployee));
    if (dashFilterCategory) filtered = filtered.filter(d => d.categoria === dashFilterCategory);
    if (dashFilterPriority) filtered = filtered.filter(d => d.prioridade === dashFilterPriority);

    return {
      total: filtered.length,
      emAndamento: filtered.filter(d => d.status === 'pendente' || d.status === 'atribuida_pendente_aceitacao').length,
      atrasadas: filtered.filter(d => isOverdue(d) || wasDeliveredLate(d)).length,
      concluidas: filtered.filter(d => d.status === 'aprovada').length,
      rotina: filtered.filter(d => d.isRotina).length,
      emAnalise: filtered.filter(d => d.status === 'finalizado_pendente_aprovacao').length,
    };
  }, [filteredDemandas, dashFilterPeriod, dashFilterEmployee, dashFilterCategory, dashFilterPriority]);

  const chartData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    filteredDemandas.forEach(d => {
      const s = getDisplayStatus(d);
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    return {
      labels: Object.keys(statusCounts).map(s => STATUS_LABELS[s] || s),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: Object.keys(statusCounts).map(s => STATUS_COLORS[s] || '#999'),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };
  }, [filteredDemandas]);

  const upcomingDeadlines = useMemo(() => {
    return filteredDemandas
      .filter(d => d.status !== 'aprovada' && d.status !== 'reprovada' && d.dataLimite)
      .map(d => ({ ...d, daysLeft: daysUntil(d.dataLimite) }))
      .filter(d => d.daysLeft >= -1 && d.daysLeft <= 3)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 10);
  }, [filteredDemandas]);

  // ==================== HANDLERS ====================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUserId) { setLoginError('Selecione um usuário'); return; }
    if (!loginSenha) { setLoginError('Digite a senha'); return; }
    setLoading(true);
    try {
      const user = await fetchApi('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: usuarios.find(u => u.id === loginUserId)?.email, senha: loginSenha }),
      });
      setCurrentUser(user);
      const session = { ...user, senha: undefined };
      sessionStorage.setItem('zab_session', JSON.stringify(session));
    } catch {
      setLoginError('Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('zab_session');
    setActiveTab('dashboard');
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const sendBrowserNotification = (titulo: string, mensagem: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(titulo, {
        body: mensagem,
        icon: '/icons/icon-192.png',
        tag: `zab-${Date.now()}`,
      });
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificacaoPermissao(permission === 'granted');
      if (permission === 'granted') {
        showToast('Notificações ativadas!');
      }
    }
  };

  const createNotification = async (usuarioId: number, titulo: string, mensagem: string, tipo: string, demandaId?: number) => {
    try {
      await fetchApi('/notificacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId, titulo, mensagem, tipo, demandaId }),
      });
      // Refresh notifications
      loadNotifications();
    } catch { /* ignore */ }
  };

  const handleCreateDemanda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!formNomeDemanda || !formCategoria || !formDescricao || !formDataLimite) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    setLoading(true);
    try {
      await fetchApi('/demandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionarioId: currentUser.id,
          nomeFuncionario: currentUser.nome,
          emailFuncionario: currentUser.email,
          nomeDemanda: formNomeDemanda,
          categoria: formCategoria,
          prioridade: formPrioridade,
          complexidade: formComplexidade,
          descricao: formDescricao,
          local: formLocal,
          dataLimite: formDataLimite,
          isRotina: formIsRotina,
          diasSemana: formDiasSemana,
          atribuidos: formAtribuidos,
          anexosCriacao: formAnexos,
          criadoPor: currentUser.id,
        }),
      });
      showToast('Demanda criada com sucesso!');
      setFormNomeDemanda(''); setFormCategoria(''); setFormDescricao('');
      setFormDataLimite(''); setFormIsRotina(false); setFormDiasSemana([]);
      setFormAtribuidos([]); setFormAnexos([]);
      loadDemandas();
      setActiveTab('minhas');

      // Notify assigned users about new demanda
      if (formAtribuidos.length > 0) {
        for (const a of formAtribuidos) {
          await createNotification(a.id, 'Nova Demanda Atribuída', `Você foi atribuído a: ${formNomeDemanda}`, 'atribuicao');
          // Email assigned funcionario about new demanda
          openEmail(a.email, `Nova Demanda: ${formNomeDemanda}`, `Olá ${a.nome},\n\nUma nova demanda foi criada e atribuída a você: ${formNomeDemanda}\nCategoria: ${formCategoria}\nPrioridade: ${formPrioridade}\nPrazo: ${formatDateBR(formDataLimite)}\n\nAtt.,\n${currentUser.nome}`);
        }
        // Notify gestores
        const gestores = usuarios.filter(u => u.role === 'gestor' && u.id !== currentUser.id);
        for (const g of gestores) {
          await createNotification(g.id, 'Nova Demanda Criada', `${currentUser.nome} criou: ${formNomeDemanda}`, 'info');
        }
      }
    } catch {
      showToast('Erro ao criar demanda', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (demandaId: number, newStatus: string, extra?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { status: newStatus, atualizadoPor: currentUser?.id };
      if (newStatus === 'aprovada') body.dataConclusao = new Date().toISOString();
      if (newStatus === 'finalizado_pendente_aprovacao') {
        body.dataConclusao = new Date().toISOString(); // Record when submitted for analysis
        body.comentarios = extra?.comentarios || '';
        body.anexosResolucao = extra?.anexosResolucao || [];
      }
      if (newStatus === 'reprovada') {
        body.comentarioGestor = extra?.reason || '';
        if (extra?.extendDays) {
          const newDate = new Date();
          newDate.setDate(newDate.getDate() + Number(extra.extendDays));
          body.dataLimite = newDate.toISOString();
        }
      }
      if (newStatus === 'reprovada_pelo_atribuido') {
        body.comentarioReprovacaoAtribuicao = extra?.reason || '';
      }
      await fetchApi(`/demandas/${demandaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      showToast('Status atualizado!');
      closeAllModals();
      loadDemandas();

      // Create notifications for status changes
      if (selectedDemanda && currentUser) {
        const d = selectedDemanda;
        if (newStatus === 'finalizado_pendente_aprovacao') {
          // Notify all gestores
          const gestores = usuarios.filter(u => u.role === 'gestor');
          for (const g of gestores) {
            await createNotification(g.id, 'Demanda Finalizada', `${d.nomeDemanda || d.tag} foi finalizada por ${currentUser.nome} e aguarda aprovação`, 'info', d.id);
          }
          sendBrowserNotification('Demanda Finalizada', `${d.nomeDemanda || d.tag} aguarda aprovação`);
          // Email gestor about finalized demanda
          const managers = MANAGER_MAP[d.local] || [];
          if (managers.length > 0) {
            openEmail(managers[0].email, `Demanda Finalizada: ${d.nomeDemanda || d.tag}`, `Olá ${managers[0].nome},\n\nA demanda "${d.nomeDemanda || d.tag}" foi finalizada por ${currentUser.nome} e aguarda aprovação.\nPrazo: ${formatDateBR(d.dataLimite)}\n\nAtt.,\nSistema ZAB-Flow`);
          }
        } else if (newStatus === 'aprovada') {
          await createNotification(d.funcionarioId, 'Demanda Aprovada!', `${d.nomeDemanda || d.tag} foi aprovada!`, 'success', d.id);
          sendBrowserNotification('Demanda Aprovada!', `${d.nomeDemanda || d.tag} foi aprovada`);
          // Email funcionario about approved demanda
          openEmail(d.emailFuncionario, `Demanda Aprovada: ${d.nomeDemanda || d.tag}`, `Olá ${d.nomeFuncionario},\n\nA demanda "${d.nomeDemanda || d.tag}" foi aprovada!\n\nParabéns pelo trabalho.\n\nAtt.,\n${currentUser.nome}`);
        } else if (newStatus === 'reprovada') {
          await createNotification(d.funcionarioId, 'Demanda Reprovada', `${d.nomeDemanda || d.tag} foi reprovada. Motivo: ${extra?.reason || 'Não informado'}`, 'danger', d.id);
          sendBrowserNotification('Demanda Reprovada', `${d.nomeDemanda || d.tag} foi reprovada`);
          // Email funcionario about refused demanda
          openEmail(d.emailFuncionario, `Demanda Reprovada: ${d.nomeDemanda || d.tag}`, `Olá ${d.nomeFuncionario},\n\nA demanda "${d.nomeDemanda || d.tag}" foi reprovada.\nMotivo: ${extra?.reason || 'Não informado'}\n\nAtt.,\n${currentUser.nome}`);
        } else if (newStatus === 'atribuida_pendente_aceitacao') {
          // Notify assigned users
          for (const a of d.atribuidos) {
            await createNotification(a.id, 'Nova Atribuição', `Você foi atribuído a: ${d.nomeDemanda || d.tag}`, 'atribuicao', d.id);
            // Email assigned person
            openEmail(a.email, `Atribuição de Demanda: ${d.nomeDemanda || d.tag}`, `Olá ${a.nome},\n\nVocê foi atribuído à demanda "${d.nomeDemanda || d.tag}".\nCategoria: ${d.categoria}\nPrioridade: ${d.prioridade}\nPrazo: ${formatDateBR(d.dataLimite)}\n\nAtt.,\n${currentUser.nome}`);
          }
        }
      }
    } catch {
      showToast('Erro ao atualizar', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDemanda = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta demanda?')) return;
    setLoading(true);
    try {
      await fetchApi(`/demandas/${id}`, { method: 'DELETE' });
      showToast('Demanda excluída');
      closeAllModals();
      loadDemandas();
    } catch {
      showToast('Erro ao excluir', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExtendDeadline = async () => {
    if (!selectedDemanda || !extendReason) return;
    setLoading(true);
    try {
      // Calculate new date from current deadline + extendDays
      const currentDate = new Date(selectedDemanda.dataLimite);
      currentDate.setDate(currentDate.getDate() + extendDays);
      const novaDataLimite = currentDate.toISOString();
      await fetchApi(`/demandas/${selectedDemanda.id}/extend-deadline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novaDataLimite, motivo: extendReason, usuarioId: currentUser?.id }),
      });
      showToast('Prazo estendido!');
      closeAllModals();
      loadDemandas();
      // Email gestor about deadline extension
      if (selectedDemanda && currentUser) {
        const managers = MANAGER_MAP[selectedDemanda.local] || [];
        if (managers.length > 0) {
          openEmail(managers[0].email, `Prazo Estendido: ${selectedDemanda.nomeDemanda || selectedDemanda.tag}`, `Olá ${managers[0].nome},\n\nO prazo da demanda "${selectedDemanda.nomeDemanda || selectedDemanda.tag}" foi estendido por ${extendDays} dia(s).\nNovo prazo: ${formatDateBR(novaDataLimite)}\nMotivo: ${extendReason}\n\nAtt.,\n${currentUser.nome}`);
        }
      }
    } catch {
      showToast('Erro ao estender prazo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedDemanda || !reassignUserId) return;
    const targetUser = usuarios.find(u => u.id === reassignUserId);
    if (!targetUser) return;
    setLoading(true);
    try {
      await fetchApi(`/demandas/${selectedDemanda.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novoFuncionarioId: targetUser.id, novoNome: targetUser.nome, novoEmail: targetUser.email, usuarioId: currentUser?.id }),
      });
      showToast('Demanda reatribuída!');
      closeAllModals();
      loadDemandas();
    } catch {
      showToast('Erro ao reatribuir', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedDemanda || !commentText || !currentUser) return;
    const newComment = { id: Date.now(), nome: currentUser.nome, comentario: commentText, data: new Date().toISOString() };
    const updated = [...(selectedDemanda.comentariosUsuarios || []), newComment];
    await fetchApi(`/demandas/${selectedDemanda.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comentariosUsuarios: updated }),
    });
    showToast('Comentário adicionado!');
    setShowCommentModal(false);
    setCommentText('');
    loadDemandas();
  };

  const handleSaveNote = async () => {
    if (!currentUser || !noteForm.titulo || !noteForm.conteudo) return;
    try {
      if (editingNoteId) {
        await fetchApi(`/anotacoes/${editingNoteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteForm),
        });
      } else {
        await fetchApi('/anotacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...noteForm, criadoPor: currentUser.id }),
        });
      }
      showToast(editingNoteId ? 'Nota atualizada!' : 'Nota criada!');
      setShowNoteModal(false);
      setNoteForm({ titulo: '', conteudo: '', cor: '#3498db', atribuidoA: 0 });
      setEditingNoteId(null);
      const data = await fetchApi(`/anotacoes?criadoPor=${currentUser.id}`);
      setNotes(data);
    } catch {
      showToast('Erro ao salvar nota', 'error');
    }
  };

  const handleDeleteNote = async (id: number) => {
    if (!confirm('Excluir esta nota?')) return;
    try {
      await fetchApi(`/anotacoes/${id}`, { method: 'DELETE' });
      showToast('Nota excluída');
      if (currentUser) {
        const data = await fetchApi(`/anotacoes?criadoPor=${currentUser.id}`);
        setNotes(data);
      }
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<{ name: string; data: string; type: string }[]>>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setter(prev => [...prev, { name: file.name, data: reader.result as string, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(demandas, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `demandas_${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Tag', 'Nome', 'Categoria', 'Prioridade', 'Complexidade', 'Local', 'Status', 'Colaborador', 'Data Criação', 'Data Limite', 'Descrição'];
    const rows = demandas.map(d => [d.tag, d.nomeDemanda, d.categoria, d.prioridade, d.complexidade, d.local, STATUS_LABELS[d.status] || d.status, d.nomeFuncionario, formatDateBR(d.dataCriacao), formatDateBR(d.dataLimite), `"${d.descricao.replace(/"/g, '""')}"`]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `demandas_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportProgress('Lendo arquivo...');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        const items = Array.isArray(data) ? data : data.demandas || [];
        setImportProgress(`Importando ${items.length} demandas...`);
        await fetchApi('/demandas/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demandas: items }),
        });
        setImportProgress(`${items.length} demandas importadas!`);
        showToast(`${items.length} demandas importadas!`);
        loadDemandas();
        setTimeout(() => setImportProgress(''), 3000);
      } catch {
        setImportProgress('Erro na importação');
        showToast('Erro na importação', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleBackup = async () => {
    try {
      const data = await fetchApi('/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `backup_zabflow_${new Date().toISOString().split('T')[0]}.json`; a.click();
      URL.revokeObjectURL(url);
      showToast('Backup realizado!');
    } catch {
      showToast('Erro no backup', 'error');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        await fetchApi('/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        showToast('Dados restaurados!');
        loadDemandas();
      } catch {
        showToast('Erro na restauração', 'error');
      }
    };
    reader.readAsText(file);
  };

  const closeAllModals = () => {
    setShowDetailModal(false);
    setShowEditModal(false);
    setShowResolucaoModal(false);
    setShowReprovacaoModal(false);
    setShowReassignModal(false);
    setShowExtendModal(false);
    setShowCommentModal(false);
    setSelectedDemanda(null);
    setResolucaoComment('');
    setResolucaoAnexos([]);
    setReprovacaoReason('');
    setReprovacaoExtendDays(0);
    setReassignUserId(0);
    setExtendDays(1);
    setExtendReason('');
    setCommentText('');
  };

  const openDetail = (d: ZabDemanda) => {
    setSelectedDemanda(d);
    setShowDetailModal(true);
  };

  const openEdit = (d: ZabDemanda) => {
    setSelectedDemanda(d);
    setEditForm({
      nomeDemanda: d.nomeDemanda, categoria: d.categoria, prioridade: d.prioridade,
      complexidade: d.complexidade, local: d.local, descricao: d.descricao,
      isRotina: d.isRotina, diasSemana: d.diasSemana, atribuidos: d.atribuidos,
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!selectedDemanda) return;
    setLoading(true);
    try {
      await fetchApi(`/demandas/${selectedDemanda.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, atualizadoPor: currentUser?.id }),
      });
      showToast('Demanda atualizada!');
      closeAllModals();
      loadDemandas();
    } catch {
      showToast('Erro ao atualizar', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendCobrancaEmail = (d: ZabDemanda) => {
    const managers = MANAGER_MAP[d.local] || [];
    const cc = managers.map(m => m.email).join(',');
    const subject = encodeURIComponent(`Cobrança - ${d.nomeDemanda || d.tag}`);
    const body = encodeURIComponent(`Olá ${d.nomeFuncionario},\n\nA demanda "${d.nomeDemanda || d.tag}" está em atraso.\nPrazo: ${formatDateBR(d.dataLimite)}\nCategoria: ${d.categoria}\nPrioridade: ${d.prioridade}\n\nAtt.,\n${currentUser?.nome}`);
    window.location.href = `mailto:${d.emailFuncionario}?cc=${cc}&subject=${subject}&body=${body}`;
  };

  const sendCombinedCobrancaEmail = (group: { funcionarioId: number; nome: string; email: string; demandas: ZabDemanda[] }) => {
    const managers = MANAGER_MAP[group.demandas[0]?.local || ''] || [];
    const cc = managers.map(m => m.email).join(',');
    const subjects = group.demandas.map(d => d.nomeDemanda || d.tag).join(', ');
    const subject = encodeURIComponent(`Cobrança - ${subjects}`);
    const items = group.demandas.map(d =>
      `- "${d.nomeDemanda || d.tag}" | Prazo: ${formatDateBR(d.dataLimite)} | Categoria: ${d.categoria} | Prioridade: ${d.prioridade}`
    ).join('\n');
    const body = encodeURIComponent(`Olá ${group.nome},\n\nAs seguintes demandas estão em atraso:\n\n${items}\n\nAtt.,\n${currentUser?.nome}`);
    window.location.href = `mailto:${group.email}?cc=${cc}&subject=${subject}&body=${body}`;
  };

  const sendBulkCobranca = () => {
    const overdue = filteredDemandas.filter(d => isOverdue(d) && d.status !== 'aprovada' && d.status !== 'reprovada');
    // Group by collaborator and send one email per collaborator
    const groups = overdue.reduce((acc, d) => {
      const existing = acc.find(g => g.funcionarioId === d.funcionarioId);
      if (existing) existing.demandas.push(d);
      else acc.push({ funcionarioId: d.funcionarioId, nome: d.nomeFuncionario, email: d.emailFuncionario, demandas: [d] });
      return acc;
    }, [] as { funcionarioId: number; nome: string; email: string; demandas: ZabDemanda[] }[]);
    groups.forEach(group => sendCombinedCobrancaEmail(group));
  };

  // ==================== DEMANDA TABLE ROW ====================
  const renderDemandaRow = (d: ZabDemanda, actions: React.ReactNode) => {
    const displayStatus = getDisplayStatus(d);
    const statusColor = STATUS_COLORS[displayStatus] || '#999';
    const priorityColor = PRIORITY_COLORS[d.prioridade] || '#999';
    return (
      <tr key={d.id} style={{ borderBottom: '1px solid #e0e6ed', borderLeft: `4px solid ${statusColor}`, cursor: 'pointer' }}
        onClick={() => openDetail(d)}>
        <td style={{ padding: '10px 8px', fontSize: '0.85rem', color: '#3498db', fontWeight: 600 }}>{d.tag}</td>
        <td style={{ padding: '10px 8px', fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{d.nomeDemanda}</td>
        <td style={{ padding: '10px 8px', fontSize: '0.8rem' }}>{d.categoria}</td>
        <td style={{ padding: '10px 8px' }}><span style={{ background: priorityColor, color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem' }}>{d.prioridade}</span></td>
        <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{d.nomeFuncionario}</td>
        <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{d.local}</td>
        <td style={{ padding: '10px 8px' }}><span style={{ background: statusColor, color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem' }}>{STATUS_LABELS[displayStatus] || displayStatus}</span></td>
        <td style={{ padding: '10px 8px', fontSize: '0.8rem' }}>{formatDateBR(d.dataCriacao)}</td>
        <td style={{ padding: '10px 8px', fontSize: '0.8rem', color: isOverdue(d) ? '#e74c3c' : 'inherit' }}>{formatDateBR(d.dataLimite)}</td>
        <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>{actions}</td>
      </tr>
    );
  };

  // ==================== STYLES ====================
  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 100, background: '#f0f2f5', overflowY: 'auto' as const, fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: '#2c3e50' },
    header: { background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 10, position: 'sticky' as const, top: 0, zIndex: 50 },
    tabNav: { display: 'flex', gap: 0, background: '#fff', borderBottom: '2px solid #e0e6ed', overflowX: 'auto' as const, padding: '0 10px' },
    tab: (active: boolean) => ({ padding: '12px 16px', cursor: 'pointer', borderBottom: active ? '3px solid #3498db' : '3px solid transparent', color: active ? '#3498db' : '#666', fontWeight: active ? 600 : 400, fontSize: '0.85rem', whiteSpace: 'nowrap' as const, transition: 'all 0.2s' }),
    card: { background: '#fff', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 20, marginBottom: 20 },
    statCard: (color: string) => ({ background: '#fff', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 20, borderTop: `4px solid ${color}`, cursor: 'pointer', transition: 'transform 0.2s' }),
    input: { width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', fontSize: '0.9rem', color: '#2c3e50', background: '#fff' },
    select: { padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: '0.85rem', color: '#2c3e50', background: '#fff', cursor: 'pointer' },
    btn: (bg: string) => ({ padding: '8px 16px', borderRadius: 6, border: 'none', background: bg, color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 6 }),
    btnOutline: { padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', color: '#2c3e50', cursor: 'pointer', fontSize: '0.85rem' },
    table: { width: '100%', borderCollapse: 'collapse' as const },
    th: { padding: '12px 8px', background: '#f8f9fa', textAlign: 'left' as const, fontSize: '0.8rem', fontWeight: 600, color: '#666', borderBottom: '2px solid #e0e6ed' },
    modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
    modal: { background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', padding: 24, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' as const },
    badge: (bg: string) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }),
    label: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#2c3e50', marginBottom: 4 },
  };

  // ==================== LOGIN SCREEN ====================
  if (!currentUser) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <div style={{ background: '#fff', borderRadius: 16, padding: 30, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src="/images/zamine-logo.png" alt="Zamine" style={{ height: 60, marginBottom: 12 }} />
            <h2 style={{ margin: '0 0 4px', color: '#2c3e50', fontSize: '1.5rem' }}>Portal do Gestor</h2>
            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Sistema Corporativo ZAB-Flow</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={S.label}>Usuário</label>
              <select value={loginUserId} onChange={e => setLoginUserId(Number(e.target.value))} style={{ ...S.select, width: '100%', padding: '10px 14px' }}>
                <option value={0}>Selecione o usuário</option>
                {usuarios.sort((a, b) => a.nome.localeCompare(b.nome)).map(u => (
                  <option key={u.id} value={u.id}>{u.nome} {u.role === 'gestor' ? '⭐' : ''}</option>
                ))}
              </select>
            </div>

            {loginUserId && usuarios.find(u => u.id === loginUserId)?.role === 'gestor' && (
              <div>
                <label style={{ ...S.label, color: '#2c3e50' }}>Visualização</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem', color: '#2c3e50' }}>
                    <input type="radio" name="viewType" checked={viewType === 'geral'} onChange={() => setViewType('geral')} /> Visão Geral
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem', color: '#2c3e50' }}>
                    <input type="radio" name="viewType" checked={viewType === 'proprio'} onChange={() => setViewType('proprio')} /> Próprio
                  </label>
                </div>
              </div>
            )}

            <div>
              <label style={S.label}>Senha</label>
              <input type="password" value={loginSenha} onChange={e => setLoginSenha(e.target.value)} placeholder="Digite sua senha" style={S.input} />
            </div>

            {loginError && <div style={{ background: '#ffeaea', color: '#e74c3c', padding: '8px 12px', borderRadius: 6, fontSize: '0.85rem' }}><i className="fas fa-exclamation-circle"></i> {loginError}</div>}

            <button type="submit" disabled={loading} style={{ ...S.btn('#3498db'), width: '100%', padding: '12px', fontSize: '1rem', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
              {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sign-in-alt"></i>} Entrar
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#3498db' }}>
              <a href={`mailto:max-r@zaminebrasil.com?subject=${encodeURIComponent('Esqueci minha senha - ZAB-Flow')}`} style={{ color: '#3498db', textDecoration: 'none' }}>Esqueceu a senha?</a>
              <a href={`mailto:max-r@zaminebrasil.com?subject=${encodeURIComponent('Novo cadastro - ZAB-Flow')}`} style={{ color: '#3498db', textDecoration: 'none' }}>Novo usuário</a>
            </div>
          </form>
        </div>

        <button onClick={onClose} style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.9rem' }}>
          <i className="fas fa-arrow-left"></i> Voltar
        </button>
      </div>
    );
  }

  // ==================== MAIN APP ====================
  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: 'fa-tachometer-alt', show: true },
    { key: 'nova', label: 'Nova Demanda', icon: 'fa-plus-circle', show: true },
    { key: 'pendentes', label: 'Pendentes', icon: 'fa-clock', show: isGestor },
    { key: 'minhas', label: 'Minhas Demandas', icon: 'fa-tasks', show: true },
    { key: 'analise', label: 'Análise', icon: 'fa-search', show: true },
    { key: 'atrasadas', label: 'Atrasadas', icon: 'fa-exclamation-triangle', show: true },
    { key: 'concluidas', label: 'Concluídas', icon: 'fa-check-circle', show: true },
    { key: 'mapa', label: 'Mapa Mental', icon: 'fa-project-diagram', show: true },
    { key: 'anotacoes', label: 'Anotações', icon: 'fa-sticky-note', show: true },
    { key: 'ranking', label: 'Ranking', icon: 'fa-trophy', show: isGestor },
    { key: 'cobranca', label: 'Cobrança', icon: 'fa-envelope', show: isGestor },
    { key: 'exportar', label: 'Exportar/Importar', icon: 'fa-file-export', show: isGestor },
  ];

  return (
    <div style={S.overlay}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      {/* SERVER STATUS */}
      <div style={{ position: 'fixed', top: 10, left: 10, zIndex: 60, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.9)', padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: serverStatus ? '#27ae60' : '#e74c3c' }} />
        <span style={{ color: serverStatus ? '#27ae60' : '#e74c3c' }}>{serverStatus ? 'Servidor conectado' : 'Servidor desconectado'}</span>
      </div>

      {/* HEADER */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/images/zamine-logo.png" alt="Zamine" style={{ height: 32 }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Portal do Gestor Corporativo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
          {isGestor && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', borderRadius: 6, overflow: 'hidden' }}>
              <button onClick={() => setViewType('geral')} style={{ padding: '6px 12px', background: viewType === 'geral' ? 'rgba(255,255,255,0.3)' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Visão Geral</button>
              <button onClick={() => setViewType('proprio')} style={{ padding: '6px 12px', background: viewType === 'proprio' ? 'rgba(255,255,255,0.3)' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Próprio</button>
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifications(!showNotifications)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', position: 'relative', fontSize: '1.1rem' }}>
              <i className="fas fa-bell"></i>
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -6, background: '#e74c3c', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{notifications.filter(n => !n.read).length}</span>
              )}
            </button>
            {showNotifications && (
              <div style={{ position: 'absolute', right: 0, top: '100%', background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', width: 340, maxHeight: 450, overflowY: 'auto', zIndex: 100 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#2c3e50' }}>Notificações</strong>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {!notificacaoPermissao && (
                      <button onClick={requestNotificationPermission} style={{ border: 'none', background: '#3498db', color: '#fff', cursor: 'pointer', fontSize: '0.7rem', padding: '3px 8px', borderRadius: 4 }} title="Ativar notificações do navegador">
                        <i className="fas fa-bell"></i> Ativar
                      </button>
                    )}
                    <button onClick={async () => {
                      if (currentUser) {
                        try { await fetchApi('/notificacoes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuarioId: currentUser.id, markAllRead: true }) }); } catch {}
                        loadNotifications();
                      }
                    }} style={{ border: 'none', background: 'transparent', color: '#3498db', cursor: 'pointer', fontSize: '0.75rem' }}>Marcar lidas</button>
                  </div>
                </div>
                {notifications.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: '0.85rem' }}><i className="fas fa-bell-slash"></i> Nenhuma notificação</div> :
                  notifications.map(n => {
                    const tipoIcon: Record<string, string> = { info: 'fa-info-circle', success: 'fa-check-circle', danger: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', atribuicao: 'fa-user-plus', aprovacao: 'fa-thumbs-up', reprovacao: 'fa-thumbs-down', cobranca: 'fa-envelope' };
                    const tipoColor: Record<string, string> = { info: '#3498db', success: '#27ae60', danger: '#e74c3c', warning: '#f39c12', atribuicao: '#9b59b6', aprovacao: '#27ae60', reprovacao: '#e74c3c', cobranca: '#e74c3c' };
                    return (
                      <div key={n.id} onClick={async () => {
                        if (!n.read && currentUser) {
                          try { await fetchApi(`/notificacoes/${n.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lida: true }) }); } catch {}
                          loadNotifications();
                        }
                        const d = demandas.find(dm => dm.id === n.demandaId);
                        if (d) openDetail(d);
                        setShowNotifications(false);
                      }} style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: n.read ? 'transparent' : '#f0f7ff', fontSize: '0.85rem', transition: 'background 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <i className={`fas ${tipoIcon[n.tipo || ''] || 'fa-bell'}`} style={{ color: tipoColor[n.tipo || ''] || '#999', marginTop: 2 }}></i>
                          <div style={{ flex: 1 }}>
                            {n.titulo && <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#2c3e50', marginBottom: 2 }}>{n.titulo}</div>}
                            <div style={{ color: '#555', fontSize: '0.8rem' }}>{n.text}</div>
                          </div>
                          {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3498db', marginTop: 4, flexShrink: 0 }}></div>}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 20, fontSize: '0.85rem' }}>
            {isGestor ? '⭐' : '👤'} {currentUser.nome}
          </span>
          <button onClick={handleLogout} style={{ ...S.btn('#e74c3c'), padding: '6px 12px' }}><i className="fas fa-sign-out-alt"></i> Sair</button>
        </div>
      </div>

      {/* TAB NAV */}
      <div style={S.tabNav}>
        <button onClick={onClose} style={{ ...S.tab(false), color: '#e74c3c', marginRight: 8 }}><i className="fas fa-arrow-left"></i></button>
        {tabs.filter(t => t.show).map(t => (
          <div key={t.key} onClick={() => setActiveTab(t.key)} style={S.tab(activeTab === t.key)}>
            <i className={`fas ${t.icon}`}></i> {t.label}
          </div>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>

        {/* ===== DASHBOARD ===== */}
        {activeTab === 'dashboard' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Total de Demandas', count: stats.total, color: '#3498db', icon: 'fa-list-check' },
                { label: 'Em Andamento', count: stats.emAndamento, color: '#f39c12', icon: 'fa-spinner' },
                { label: 'Em Análise', count: stats.emAnalise, color: '#2c3e50', icon: 'fa-search' },
                { label: 'Atrasadas', count: stats.atrasadas, color: '#e74c3c', icon: 'fa-exclamation-triangle' },
                { label: 'Concluídas', count: stats.concluidas, color: '#27ae60', icon: 'fa-check-circle' },
                { label: 'Tarefas de Rotina', count: stats.rotina, color: '#9b59b6', icon: 'fa-sync' },
              ].map((card, i) => (
                <div key={i} style={S.statCard(card.color)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '2rem', fontWeight: 700, color: card.color }}>{card.count}</div>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>{card.label}</div>
                    </div>
                    <i className={`fas ${card.icon}`} style={{ fontSize: '2rem', color: card.color, opacity: 0.3 }}></i>
                  </div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ ...S.card, display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
              <div>
                <label style={{ ...S.label, marginBottom: 4 }}>Colaborador</label>
                <select value={dashFilterEmployee} onChange={e => setDashFilterEmployee(e.target.value)} style={S.select}>
                  <option value="">Todos</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...S.label, marginBottom: 4 }}>Período</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 7, 30, 90, 365].map(p => (
                    <button key={p} onClick={() => setDashFilterPeriod(p)} style={{ ...S.btn(dashFilterPeriod === p ? '#3498db' : '#ecf0f1'), color: dashFilterPeriod === p ? '#fff' : '#2c3e50', padding: '6px 12px' }}>{p === 0 ? 'Todos' : `${p}d`}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ ...S.label, marginBottom: 4 }}>Categoria</label>
                <select value={dashFilterCategory} onChange={e => setDashFilterCategory(e.target.value)} style={S.select}>
                  <option value="">Todas</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...S.label, marginBottom: 4 }}>Prioridade</label>
                <select value={dashFilterPriority} onChange={e => setDashFilterPriority(e.target.value)} style={S.select}>
                  <option value="">Todas</option>
                  <option value="Importante">Importante</option>
                  <option value="Média">Média</option>
                  <option value="Relevante">Relevante</option>
                </select>
              </div>
            </div>

            {/* Chart */}
            <div style={{ ...S.card, display: 'flex', gap: 20, flexWrap: 'wrap' as const }}>
              <div style={{ flex: '1 1 300px', minWidth: 250 }}>
                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: '1rem' }}><i className="fas fa-chart-pie"></i> Distribuição por Status</h3>
                <Pie data={chartData} options={{ plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: true }} />
              </div>
              <div style={{ flex: '1 1 300px' }}>
                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: '1rem' }}><i className="fas fa-clock"></i> Lembretes de Prazo</h3>
                {upcomingDeadlines.length === 0 ? (
                  <p style={{ color: '#999', fontSize: '0.85rem' }}>Nenhum prazo próximo</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {upcomingDeadlines.map(d => (
                      <div key={d.id} onClick={() => openDetail(d)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: d.daysLeft <= 0 ? '#ffeaea' : d.daysLeft === 1 ? '#fff3e0' : '#fff8e1', borderRadius: 8, cursor: 'pointer', borderLeft: `3px solid ${d.daysLeft <= 0 ? '#e74c3c' : d.daysLeft === 1 ? '#f39c12' : '#3498db'}` }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{d.nomeDemanda || d.tag}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>{d.nomeFuncionario} • {d.local}</div>
                        </div>
                        <span style={{ ...S.badge(d.daysLeft <= 0 ? '#e74c3c' : d.daysLeft === 1 ? '#f39c12' : '#3498db') }}>
                          {d.daysLeft <= 0 ? 'Vencido!' : d.daysLeft === 1 ? 'Vence amanhã' : `${d.daysLeft} dias`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== NOVA DEMANDA ===== */}
        {activeTab === 'nova' && (
          <div style={S.card}>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}><i className="fas fa-plus-circle" style={{ color: '#3498db' }}></i> Nova Demanda</h3>
            <form onSubmit={handleCreateDemanda} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Nome da Demanda *</label>
                <input value={formNomeDemanda} onChange={e => setFormNomeDemanda(e.target.value)} placeholder="Ex: Manutenção preventiva escavadeira" style={S.input} required minLength={3} />
              </div>
              <div>
                <label style={S.label}>Categoria *</label>
                <input value={formCategoriaSearch} onChange={e => setFormCategoriaSearch(e.target.value)} placeholder="Buscar categoria..." style={{ ...S.input, marginBottom: 4 }} />
                <select value={formCategoria} onChange={e => { setFormCategoria(e.target.value); setFormCategoriaSearch(e.target.value); }} style={S.select} required size={5}>
                  {CATEGORIAS.filter(c => !formCategoriaSearch || c.toLowerCase().includes(formCategoriaSearch.toLowerCase())).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Prioridade *</label>
                <select value={formPrioridade} onChange={e => setFormPrioridade(e.target.value)} style={{ ...S.select, width: '100%', padding: '10px 14px' }} required>
                  <option value="Importante">Importante</option>
                  <option value="Média">Média</option>
                  <option value="Relevante">Relevante</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Complexidade *</label>
                <select value={formComplexidade} onChange={e => setFormComplexidade(e.target.value)} style={{ ...S.select, width: '100%', padding: '10px 14px' }} required>
                  <option value="Fácil">Fácil</option>
                  <option value="Médio">Médio</option>
                  <option value="Difícil">Difícil</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Local *</label>
                <select value={formLocal} onChange={e => setFormLocal(e.target.value)} style={{ ...S.select, width: '100%', padding: '10px 14px' }} required>
                  {LOCAIS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Data Limite *</label>
                <input type="date" value={formDataLimite} onChange={e => setFormDataLimite(e.target.value)} style={S.input} required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Atribuir a</label>
                <input value={formAtribuidoSearch} onChange={e => setFormAtribuidoSearch(e.target.value)} placeholder="Buscar colaborador..." style={{ ...S.input, marginBottom: 6 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, maxHeight: 120, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
                  {usuarios.filter(u => u.role === 'funcionario' || u.role === 'gestor')
                    .filter(u => !formAtribuidoSearch || u.nome.toLowerCase().includes(formAtribuidoSearch.toLowerCase()))
                    .map(u => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={formAtribuidos.some(a => a.id === u.id)} onChange={e => {
                          if (e.target.checked) setFormAtribuidos(prev => [...prev, { id: u.id, nome: u.nome, email: u.email }]);
                          else setFormAtribuidos(prev => prev.filter(a => a.id !== u.id));
                        }} />
                        {u.nome} {u.role === 'gestor' ? '⭐' : ''}
                      </label>
                    ))}
                </div>
                {formAtribuidos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginTop: 6 }}>
                    {formAtribuidos.map(a => (
                      <span key={a.id} style={{ ...S.badge('#3498db'), cursor: 'pointer' }} onClick={() => setFormAtribuidos(prev => prev.filter(x => x.id !== a.id))}>
                        {a.nome} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Descrição *</label>
                <textarea value={formDescricao} onChange={e => setFormDescricao(e.target.value)} placeholder="Descreva a demanda..." style={{ ...S.input, minHeight: 100, resize: 'vertical' as const }} required />
              </div>
              <div>
                <label style={S.label}>Anexos</label>
                <input type="file" multiple onChange={e => handleFileUpload(e, setFormAnexos)} style={{ ...S.input, padding: 8 }} />
                {formAnexos.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', marginTop: 4 }}>
                    <i className="fas fa-paperclip"></i> {a.name}
                    <button type="button" onClick={() => setFormAnexos(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: '#e74c3c', cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#2c3e50', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={formIsRotina} onChange={e => setFormIsRotina(e.target.checked)} /> Tarefa de Rotina
                </label>
                {formIsRotina && (
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: 8 }}>
                    {DAY_NAMES.map((day, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={formDiasSemana.includes(i)} onChange={e => {
                          if (e.target.checked) setFormDiasSemana(prev => [...prev, i]);
                          else setFormDiasSemana(prev => prev.filter(d => d !== i));
                        }} /> {day}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button type="submit" disabled={loading} style={{ ...S.btn('#27ae60'), padding: '12px 24px', fontSize: '1rem' }}>
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>} Criar Demanda
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===== PENDENTES COLABORADORES ===== */}
        {activeTab === 'pendentes' && isGestor && (
          <div style={S.card}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}><i className="fas fa-clock" style={{ color: '#f39c12' }}></i> Demandas Pendentes - Colaboradores</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 16 }}>
              <select value={pendenteFilter.employee} onChange={e => setPendenteFilter(p => ({ ...p, employee: e.target.value }))} style={S.select}>
                <option value="">Todos Colaboradores</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <select value={pendenteFilter.status} onChange={e => setPendenteFilter(p => ({ ...p, status: e.target.value }))} style={S.select}>
                <option value="">Todos Status</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={pendenteFilter.local} onChange={e => setPendenteFilter(p => ({ ...p, local: e.target.value }))} style={S.select}>
                <option value="">Todos Locais</option>
                {LOCAIS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ overflowX: 'auto' as const }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Tag', 'Nome', 'Categoria', 'Prioridade', 'Colaborador', 'Local', 'Status', 'Criado', 'Prazo', 'Ações'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDemandas
                    .filter(d => d.status !== 'aprovada' && d.status !== 'reprovada')
                    .filter(d => !pendenteFilter.employee || d.funcionarioId === Number(pendenteFilter.employee))
                    .filter(d => !pendenteFilter.status || d.status === pendenteFilter.status)
                    .filter(d => !pendenteFilter.local || d.local === pendenteFilter.local)
                    .map(d => renderDemandaRow(d, (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); openEdit(d); }} style={{ ...S.btn('#3498db'), padding: '4px 8px', fontSize: '0.75rem' }}><i className="fas fa-edit"></i></button>
                        <button onClick={e => { e.stopPropagation(); setSelectedDemanda(d); setShowExtendModal(true); }} style={{ ...S.btn('#f39c12'), padding: '4px 8px', fontSize: '0.75rem' }}><i className="fas fa-clock"></i></button>
                        <button onClick={e => { e.stopPropagation(); setSelectedDemanda(d); setShowReassignModal(true); }} style={{ ...S.btn('#9b59b6'), padding: '4px 8px', fontSize: '0.75rem' }}><i className="fas fa-exchange-alt"></i></button>
                      </div>
                    )))}
                </tbody>
              </table>
              {filteredDemandas.filter(d => d.status !== 'aprovada' && d.status !== 'reprovada').length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhuma demanda pendente</p>
              )}
            </div>
          </div>
        )}

        {/* ===== MINHAS DEMANDAS ===== */}
        {activeTab === 'minhas' && (
          <div style={S.card}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}><i className="fas fa-tasks" style={{ color: '#3498db' }}></i> Minhas Demandas</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <select value={minhasFilter.status} onChange={e => setMinhasFilter(f => ({ ...f, status: e.target.value }))} style={S.select}>
                <option value="">Todos Status</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{ overflowX: 'auto' as const }}>
              <table style={S.table}>
                <thead><tr>{['Tag', 'Nome', 'Categoria', 'Prioridade', 'Colaborador', 'Local', 'Status', 'Criado', 'Prazo', 'Ações'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredDemandas
                    .filter(d => d.status !== 'aprovada' && d.status !== 'reprovada')
                    .filter(d => !minhasFilter.status || d.status === minhasFilter.status)
                    .map(d => renderDemandaRow(d, (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {d.status === 'pendente' && (
                          <button onClick={e => { e.stopPropagation(); setSelectedDemanda(d); setShowResolucaoModal(true); }} style={{ ...S.btn('#27ae60'), padding: '4px 8px', fontSize: '0.75rem' }} title="Finalizar"><i className="fas fa-check"></i></button>
                        )}
                        {d.status === 'atribuida_pendente_aceitacao' && (
                          <>
                            <button onClick={e => { e.stopPropagation(); handleUpdateStatus(d.id, 'pendente', { comentarios: 'Aceito pelo atribuído' }); }} style={{ ...S.btn('#27ae60'), padding: '4px 8px', fontSize: '0.75rem' }} title="Aceitar"><i className="fas fa-thumbs-up"></i></button>
                            <button onClick={e => { e.stopPropagation(); setSelectedDemanda(d); setShowReprovacaoModal(true); }} style={{ ...S.btn('#e74c3c'), padding: '4px 8px', fontSize: '0.75rem' }} title="Recusar"><i className="fas fa-thumbs-down"></i></button>
                          </>
                        )}
                        <button onClick={e => { e.stopPropagation(); setSelectedDemanda(d); setShowCommentModal(true); }} style={{ ...S.btn('#3498db'), padding: '4px 8px', fontSize: '0.75rem' }} title="Comentar"><i className="fas fa-comment"></i></button>
                      </div>
                    )))}
                </tbody>
              </table>
              {filteredDemandas.filter(d => d.status !== 'aprovada' && d.status !== 'reprovada').length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhuma demanda encontrada</p>
              )}
            </div>
          </div>
        )}

        {/* ===== ANÁLISE ===== */}
        {activeTab === 'analise' && (
          <div style={S.card}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}><i className="fas fa-search" style={{ color: '#2c3e50' }}></i> Análise - Aguardando Aprovação</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <select value={analiseFilter.employee} onChange={e => setAnaliseFilter(f => ({ ...f, employee: e.target.value }))} style={S.select}>
                <option value="">Todos Colaboradores</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div style={{ overflowX: 'auto' as const }}>
              <table style={S.table}>
                <thead><tr>{['Tag', 'Nome', 'Categoria', 'Prioridade', 'Colaborador', 'Local', 'Status', 'Criado', 'Prazo', 'Ações'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredDemandas
                    .filter(d => d.status === 'finalizado_pendente_aprovacao')
                    .filter(d => !analiseFilter.employee || d.funcionarioId === Number(analiseFilter.employee))
                    .map(d => renderDemandaRow(d, (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); handleUpdateStatus(d.id, 'aprovada'); }} style={{ ...S.btn('#27ae60'), padding: '4px 8px', fontSize: '0.75rem' }} title="Aprovar"><i className="fas fa-check"></i></button>
                        <button onClick={e => { e.stopPropagation(); setSelectedDemanda(d); setShowReprovacaoModal(true); }} style={{ ...S.btn('#e74c3c'), padding: '4px 8px', fontSize: '0.75rem' }} title="Reprovar"><i className="fas fa-times"></i></button>
                      </div>
                    )))}
                </tbody>
              </table>
              {filteredDemandas.filter(d => d.status === 'finalizado_pendente_aprovacao').length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhuma demanda aguardando aprovação</p>
              )}
            </div>
          </div>
        )}

        {/* ===== ATRASADAS ===== */}
        {activeTab === 'atrasadas' && (
          <div style={S.card}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}><i className="fas fa-exclamation-triangle" style={{ color: '#e74c3c' }}></i> Demandas Atrasadas</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
              <select value={atrasadasFilter.employee} onChange={e => setAtrasadasFilter(f => ({ ...f, employee: e.target.value }))} style={S.select}>
                <option value="">Todos Colaboradores</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <select value={atrasadasFilter.priority} onChange={e => setAtrasadasFilter(f => ({ ...f, priority: e.target.value }))} style={S.select}>
                <option value="">Todas Prioridades</option>
                <option value="Importante">Importante</option>
                <option value="Média">Média</option>
                <option value="Relevante">Relevante</option>
              </select>
              {selectedAtrasadas.length > 0 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { const d = demandas.find(x => x.id === selectedAtrasadas[0]); if (d) { setSelectedDemanda(d); setShowReassignModal(true); } }} style={{ ...S.btn('#9b59b6'), fontSize: '0.8rem' }}><i className="fas fa-exchange-alt"></i> Reatribuir ({selectedAtrasadas.length})</button>
                  <button onClick={() => { const d = demandas.find(x => x.id === selectedAtrasadas[0]); if (d) { setSelectedDemanda(d); setShowExtendModal(true); } }} style={{ ...S.btn('#f39c12'), fontSize: '0.8rem' }}><i className="fas fa-clock"></i> Estender ({selectedAtrasadas.length})</button>
                </div>
              )}
            </div>
            <div style={{ overflowX: 'auto' as const }}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}><input type="checkbox" onChange={e => {
                    const overdue = filteredDemandas.filter(d => isOverdue(d));
                    setSelectedAtrasadas(e.target.checked ? overdue.map(d => d.id) : []);
                  }} /></th>
                  {['Tag', 'Nome', 'Categoria', 'Prioridade', 'Colaborador', 'Local', 'Status', 'Prazo', 'Ações'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredDemandas
                    .filter(d => isOverdue(d))
                    .filter(d => !atrasadasFilter.employee || d.funcionarioId === Number(atrasadasFilter.employee))
                    .filter(d => !atrasadasFilter.priority || d.prioridade === atrasadasFilter.priority)
                    .map(d => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #e0e6ed', borderLeft: '4px solid #e74c3c', background: selectedAtrasadas.includes(d.id) ? '#fff5f5' : 'transparent' }}>
                        <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedAtrasadas.includes(d.id)} onChange={e => {
                            if (e.target.checked) setSelectedAtrasadas(prev => [...prev, d.id]);
                            else setSelectedAtrasadas(prev => prev.filter(x => x !== d.id));
                          }} />
                        </td>
                        <td style={{ padding: '10px 8px', color: '#3498db', fontWeight: 600, fontSize: '0.85rem' }}>{d.tag}</td>
                        <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{d.nomeDemanda}</td>
                        <td style={{ padding: '10px 8px', fontSize: '0.8rem' }}>{d.categoria}</td>
                        <td style={{ padding: '10px 8px' }}><span style={{ ...S.badge(PRIORITY_COLORS[d.prioridade] || '#999') }}>{d.prioridade}</span></td>
                        <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{d.nomeFuncionario}</td>
                        <td style={{ padding: '10px 8px', fontSize: '0.85rem' }}>{d.local}</td>
                        <td style={{ padding: '10px 8px' }}><span style={{ ...S.badge('#e74c3c') }}>Atrasado</span></td>
                        <td style={{ padding: '10px 8px', fontSize: '0.8rem', color: '#e74c3c' }}>{formatDateBR(d.dataLimite)}</td>
                        <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openDetail(d)} style={{ ...S.btn('#3498db'), padding: '4px 8px', fontSize: '0.75rem' }}><i className="fas fa-eye"></i></button>
                            <button onClick={() => { setSelectedDemanda(d); setShowExtendModal(true); }} style={{ ...S.btn('#f39c12'), padding: '4px 8px', fontSize: '0.75rem' }}><i className="fas fa-clock"></i></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {filteredDemandas.filter(d => isOverdue(d)).length === 0 && (
                <p style={{ textAlign: 'center', color: '#27ae60', padding: 20 }}><i className="fas fa-check-circle"></i> Nenhuma demanda atrasada!</p>
              )}
            </div>
          </div>
        )}

        {/* ===== CONCLUÍDAS ===== */}
        {activeTab === 'concluidas' && (
          <div style={S.card}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}><i className="fas fa-check-circle" style={{ color: '#27ae60' }}></i> Demandas Concluídas</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <select value={concluidasFilter.employee} onChange={e => setConcluidasFilter(f => ({ ...f, employee: e.target.value }))} style={S.select}>
                <option value="">Todos Colaboradores</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <button onClick={handleExportJSON} style={S.btnOutline}><i className="fas fa-download"></i> Exportar</button>
            </div>
            <div style={{ overflowX: 'auto' as const }}>
              <table style={S.table}>
                <thead><tr>{['Tag', 'Nome', 'Categoria', 'Prioridade', 'Colaborador', 'Local', 'Status', 'Concluído', 'Prazo', 'Ações'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredDemandas
                    .filter(d => d.status === 'aprovada' || d.status === 'reprovada')
                    .filter(d => !concluidasFilter.employee || d.funcionarioId === Number(concluidasFilter.employee))
                    .map(d => renderDemandaRow(d, (
                      <button onClick={e => { e.stopPropagation(); openDetail(d); }} style={{ ...S.btn('#3498db'), padding: '4px 8px', fontSize: '0.75rem' }}><i className="fas fa-eye"></i></button>
                    )))}
                </tbody>
              </table>
              {filteredDemandas.filter(d => d.status === 'aprovada' || d.status === 'reprovada').length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>Nenhuma demanda concluída</p>
              )}
            </div>
          </div>
        )}

        {/* ===== MAPA MENTAL ===== */}
        {activeTab === 'mapa' && (
          <div style={S.card}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}><i className="fas fa-project-diagram" style={{ color: '#9b59b6' }}></i> Mapa Mental</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
              <select value={mapFilter.status} onChange={e => setMapFilter(f => ({ ...f, status: e.target.value }))} style={S.select}>
                <option value="">Todos Status</option>
                <option value="atrasado">Atrasados</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={mapFilter.employee} onChange={e => setMapFilter(f => ({ ...f, employee: e.target.value }))} style={S.select}>
                <option value="">Todos Colaboradores</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
              <select value={mapFilter.local} onChange={e => setMapFilter(f => ({ ...f, local: e.target.value }))} style={S.select}>
                <option value="">Todos Locais</option>
                {LOCAIS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={mapSort} onChange={e => setMapSort(e.target.value)} style={S.select}>
                <option value="priority">Prioridade</option>
                <option value="deadline">Prazo</option>
                <option value="category">Categoria</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 12 }}>
              {filteredDemandas
                .filter(d => d.status !== 'aprovada' && d.status !== 'reprovada')
                .filter(d => {
                  if (!mapFilter.status) return true;
                  if (mapFilter.status === 'atrasado') return isOverdue(d);
                  return d.status === mapFilter.status;
                })
                .filter(d => !mapFilter.employee || d.funcionarioId === Number(mapFilter.employee))
                .filter(d => !mapFilter.local || d.local === mapFilter.local)
                .sort((a, b) => {
                  if (mapSort === 'priority') {
                    const order: Record<string, number> = { 'Importante': 0, 'Média': 1, 'Relevante': 2 };
                    return (order[a.prioridade] || 3) - (order[b.prioridade] || 3);
                  }
                  if (mapSort === 'deadline') return new Date(a.dataLimite).getTime() - new Date(b.dataLimite).getTime();
                  return a.categoria.localeCompare(b.categoria);
                })
                .map(d => {
                  const displayStatus = getDisplayStatus(d);
                  const statusColor = STATUS_COLORS[displayStatus] || '#999';
                  return (
                    <div key={d.id} onClick={() => openDetail(d)} style={{
                      width: 220, padding: 12, borderRadius: 8, borderLeft: `4px solid ${statusColor}`,
                      background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
                      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#3498db', fontWeight: 600, marginBottom: 4 }}>{d.tag}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{d.nomeDemanda}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ ...S.badge(statusColor), fontSize: '0.65rem' }}>{STATUS_LABELS[displayStatus] || displayStatus}</span>
                        <span style={{ fontSize: '0.7rem', color: '#999' }}>{d.nomeFuncionario.split(' ')[0]}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: isOverdue(d) ? '#e74c3c' : '#666', marginTop: 4 }}>
                        <i className="fas fa-calendar"></i> {formatDateBR(d.dataLimite)}
                      </div>
                    </div>
                  );
                })}
            </div>
            {filteredDemandas.filter(d => d.status !== 'aprovada' && d.status !== 'reprovada').length === 0 && (
              <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Nenhuma demanda para exibir no mapa</p>
            )}
          </div>
        )}

        {/* ===== ANOTAÇÕES ===== */}
        {activeTab === 'anotacoes' && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const, gap: 10 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-sticky-note" style={{ color: '#f1c40f' }}></i> Anotações</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={notesFilter.month} onChange={e => setNotesFilter(f => ({ ...f, month: e.target.value }))} style={S.select}>
                  <option value="">Todos Meses</option>
                  {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]}</option>)}
                </select>
                <button onClick={() => { setNoteForm({ titulo: '', conteudo: '', cor: '#3498db', atribuidoA: 0 }); setEditingNoteId(null); setShowNoteModal(true); }} style={S.btn('#27ae60')}><i className="fas fa-plus"></i> Nova Nota</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
              {notes
                .filter(n => !notesFilter.month || new Date(n.dataCriacao).getMonth() === Number(notesFilter.month))
                .map(n => (
                  <div key={n.id} style={{ background: '#fff', borderRadius: 8, borderTop: `4px solid ${n.cor}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#2c3e50' }}>{n.titulo}</h4>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setNoteForm({ titulo: n.titulo, conteudo: n.conteudo, cor: n.cor, atribuidoA: n.atribuidoA || 0 }); setEditingNoteId(n.id); setShowNoteModal(true); }} style={{ border: 'none', background: 'transparent', color: '#3498db', cursor: 'pointer', fontSize: '0.85rem' }}><i className="fas fa-edit"></i></button>
                        <button onClick={() => handleDeleteNote(n.id)} style={{ border: 'none', background: 'transparent', color: '#e74c3c', cursor: 'pointer', fontSize: '0.85rem' }}><i className="fas fa-trash"></i></button>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.conteudo}</p>
                    {n.atribuidoA && (
                      <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#999' }}>
                        <i className="fas fa-user"></i> Atribuído a: {usuarios.find(u => u.id === n.atribuidoA)?.nome || 'Desconhecido'}
                      </div>
                    )}
                    <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#bbb' }}>{formatDateTimeBR(n.dataCriacao)}</div>
                  </div>
                ))}
            </div>
            {notes.length === 0 && <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Nenhuma anotação</p>}
          </div>
        )}

        {/* ===== RANKING ===== */}
        {activeTab === 'ranking' && isGestor && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-trophy" style={{ color: '#f1c40f' }}></i> Ranking de Performance</h3>
              <select value={rankingPeriod} onChange={e => setRankingPeriod(Number(e.target.value))} style={S.select}>
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
                <option value={90}>90 dias</option>
                <option value={365}>365 dias</option>
              </select>
            </div>
            <table style={S.table}>
              <thead><tr>
                {['#', 'Colaborador', 'Concluídas', 'Em Andamento', 'Atrasadas', 'Entregue Atraso'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {usuarios
                  .filter(u => u.role === 'funcionario')
                  .map(u => {
                    const userDemands = demandas.filter(d => d.funcionarioId === u.id);
                    const concluidas = userDemands.filter(d => d.status === 'aprovada').length;
                    const emAndamento = userDemands.filter(d => d.status === 'pendente' || d.status === 'atribuida_pendente_aceitacao').length;
                    const atrasadas = userDemands.filter(d => isOverdue(d)).length;
                    const entregueAtraso = userDemands.filter(d => wasDeliveredLate(d)).length;
                    return { ...u, concluidas, emAndamento, atrasadas, entregueAtraso };
                  })
                  .sort((a, b) => b.concluidas !== a.concluidas ? b.concluidas - a.concluidas : a.atrasadas - b.atrasadas)
                  .map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #e0e6ed', background: i === 0 ? '#fff9e6' : 'transparent' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 700, color: i === 0 ? '#f1c40f' : i === 1 ? '#bdc3c7' : i === 2 ? '#cd7f32' : '#666' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{u.nome}</td>
                      <td style={{ padding: '10px 8px', color: '#27ae60' }}>{u.concluidas}</td>
                      <td style={{ padding: '10px 8px', color: '#f39c12' }}>{u.emAndamento}</td>
                      <td style={{ padding: '10px 8px', color: '#e74c3c' }}>{u.atrasadas}</td>
                      <td style={{ padding: '10px 8px', color: '#e67e22' }}>{u.entregueAtraso}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== COBRANÇA ===== */}
        {activeTab === 'cobranca' && isGestor && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const, gap: 10 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-envelope" style={{ color: '#e74c3c' }}></i> Cobrança</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={cobrancaFilter.employee} onChange={e => setCobrancaFilter(f => ({ ...f, employee: e.target.value }))} style={S.select}>
                  <option value="">Todos Colaboradores</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <button onClick={sendBulkCobranca} style={S.btn('#e74c3c')}><i className="fas fa-paper-plane"></i> Enviar Todas</button>
              </div>
            </div>
            {filteredDemandas
              .filter(d => isOverdue(d) && d.status !== 'aprovada' && d.status !== 'reprovada')
              .filter(d => !cobrancaFilter.employee || d.funcionarioId === Number(cobrancaFilter.employee))
              .reduce((acc, d) => {
                const existing = acc.find(g => g.funcionarioId === d.funcionarioId);
                if (existing) existing.demandas.push(d);
                else acc.push({ funcionarioId: d.funcionarioId, nome: d.nomeFuncionario, email: d.emailFuncionario, demandas: [d] });
                return acc;
              }, [] as { funcionarioId: number; nome: string; email: string; demandas: ZabDemanda[] }[])
              .map(group => (
                <div key={group.funcionarioId} style={{ marginBottom: 16, padding: 14, background: '#fff5f5', borderRadius: 8, borderLeft: '4px solid #e74c3c' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong>{group.nome}</strong>
                    <button onClick={() => sendCombinedCobrancaEmail(group)} style={{ ...S.btn('#e74c3c'), fontSize: '0.8rem' }}><i className="fas fa-envelope"></i> Enviar Email</button>
                  </div>
                  {group.demandas.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #ffe0e0', fontSize: '0.85rem' }}>
                      <span>{d.nomeDemanda || d.tag}</span>
                      <span style={{ color: '#e74c3c' }}>Venceu: {formatDateBR(d.dataLimite)}</span>
                    </div>
                  ))}
                </div>
              ))}
            {filteredDemandas.filter(d => isOverdue(d) && d.status !== 'aprovada' && d.status !== 'reprovada').length === 0 && (
              <p style={{ textAlign: 'center', color: '#27ae60', padding: 40 }}><i className="fas fa-check-circle"></i> Nenhuma demanda em atraso!</p>
            )}
          </div>
        )}

        {/* ===== EXPORTAR/IMPORTAR ===== */}
        {activeTab === 'exportar' && isGestor && (
          <div style={S.card}>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}><i className="fas fa-file-export" style={{ color: '#3498db' }}></i> Exportar / Importar</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
              <div style={{ padding: 20, background: '#f8f9fa', borderRadius: 8, textAlign: 'center' }}>
                <i className="fas fa-file-code" style={{ fontSize: '2rem', color: '#3498db', marginBottom: 10 }}></i>
                <h4 style={{ margin: '0 0 8px' }}>Exportar JSON</h4>
                <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 12px' }}>Baixar todas as demandas em formato JSON</p>
                <button onClick={handleExportJSON} style={S.btn('#3498db')}><i className="fas fa-download"></i> Exportar</button>
              </div>
              <div style={{ padding: 20, background: '#f8f9fa', borderRadius: 8, textAlign: 'center' }}>
                <i className="fas fa-file-csv" style={{ fontSize: '2rem', color: '#27ae60', marginBottom: 10 }}></i>
                <h4 style={{ margin: '0 0 8px' }}>Exportar CSV</h4>
                <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 12px' }}>Baixar todas as demandas em formato CSV</p>
                <button onClick={handleExportCSV} style={S.btn('#27ae60')}><i className="fas fa-download"></i> Exportar</button>
              </div>
              <div style={{ padding: 20, background: '#f8f9fa', borderRadius: 8, textAlign: 'center' }}>
                <i className="fas fa-file-import" style={{ fontSize: '2rem', color: '#f39c12', marginBottom: 10 }}></i>
                <h4 style={{ margin: '0 0 8px' }}>Importar JSON</h4>
                <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 12px' }}>Importar demandas de um arquivo JSON</p>
                <input type="file" accept=".json" onChange={handleImportJSON} style={{ fontSize: '0.85rem' }} />
                {importProgress && <p style={{ fontSize: '0.8rem', color: '#3498db', marginTop: 8 }}>{importProgress}</p>}
              </div>
              <div style={{ padding: 20, background: '#f8f9fa', borderRadius: 8, textAlign: 'center' }}>
                <i className="fas fa-database" style={{ fontSize: '2rem', color: '#9b59b6', marginBottom: 10 }}></i>
                <h4 style={{ margin: '0 0 8px' }}>Backup / Restaurar</h4>
                <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 12px' }}>Backup completo do servidor</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={handleBackup} style={S.btn('#9b59b6')}><i className="fas fa-download"></i> Backup</button>
                  <label style={{ ...S.btn('#2c3e50'), cursor: 'pointer' }}><i className="fas fa-upload"></i> Restaurar<input type="file" accept=".json" onChange={handleRestore} style={{ display: 'none' }} /></label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== MODALS ==================== */}

      {/* DETAIL MODAL */}
      {showDetailModal && selectedDemanda && (
        <div style={S.modalOverlay} onClick={() => setShowDetailModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-info-circle" style={{ color: '#3498db' }}></i> Detalhes da Demanda</h3>
              <button onClick={() => setShowDetailModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...S.badge(STATUS_COLORS[getDisplayStatus(selectedDemanda)] || '#999'), fontSize: '0.8rem' }}>{STATUS_LABELS[getDisplayStatus(selectedDemanda)]}</span>
                <span style={{ ...S.badge(PRIORITY_COLORS[selectedDemanda.prioridade] || '#999'), fontSize: '0.8rem' }}>{selectedDemanda.prioridade}</span>
              </div>
              <div><strong>Tag:</strong> {selectedDemanda.tag}</div>
              <div><strong>Nome:</strong> {selectedDemanda.nomeDemanda}</div>
              <div><strong>Categoria:</strong> {selectedDemanda.categoria}</div>
              <div><strong>Complexidade:</strong> {selectedDemanda.complexidade}</div>
              <div><strong>Local:</strong> {selectedDemanda.local}</div>
              <div><strong>Colaborador:</strong> {selectedDemanda.nomeFuncionario}</div>
              <div><strong>Criado em:</strong> {formatDateTimeBR(selectedDemanda.dataCriacao)}</div>
              <div><strong>Prazo:</strong> <span style={{ color: isOverdue(selectedDemanda) ? '#e74c3c' : 'inherit' }}>{formatDateBR(selectedDemanda.dataLimite)}</span></div>
              {selectedDemanda.dataConclusao && <div><strong>Concluído em:</strong> {formatDateTimeBR(selectedDemanda.dataConclusao)}</div>}
              {selectedDemanda.isRotina && <div><strong>Rotina:</strong> {selectedDemanda.diasSemana.map(d => DAY_NAMES[d]).join(', ')}</div>}
              <div><strong>Descrição:</strong><p style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, whiteSpace: 'pre-wrap', marginTop: 4 }}>{selectedDemanda.descricao}</p></div>
              {selectedDemanda.atribuidos.length > 0 && (
                <div><strong>Atribuídos a:</strong> {selectedDemanda.atribuidos.map(a => a.nome).join(', ')}</div>
              )}
              {selectedDemanda.comentarioGestor && <div><strong>Comentário do Gestor:</strong><p style={{ background: '#fff3e0', padding: 12, borderRadius: 6, marginTop: 4 }}>{selectedDemanda.comentarioGestor}</p></div>}
              {selectedDemanda.comentarioReprovacaoAtribuicao && <div><strong>Motivo da Recusa:</strong><p style={{ background: '#ffeaea', padding: 12, borderRadius: 6, marginTop: 4 }}>{selectedDemanda.comentarioReprovacaoAtribuicao}</p></div>}
              {selectedDemanda.anexosCriacao.length > 0 && (
                <div><strong>Anexos:</strong>{selectedDemanda.anexosCriacao.map((a, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', marginTop: 4 }}><i className="fas fa-paperclip"></i> <a href={a.data} download={a.name} style={{ color: '#3498db' }}>{a.name}</a></div>
                ))}</div>
              )}
              {selectedDemanda.anexosResolucao.length > 0 && (
                <div><strong>Anexos da Resolução:</strong>{selectedDemanda.anexosResolucao.map((a, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', marginTop: 4 }}><i className="fas fa-paperclip"></i> <a href={a.data} download={a.name} style={{ color: '#27ae60' }}>{a.name}</a></div>
                ))}</div>
              )}
              {selectedDemanda.comentariosUsuarios.length > 0 && (
                <div>
                  <strong>Comentários:</strong>
                  <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                    {selectedDemanda.comentariosUsuarios.map((c, i) => (
                      <div key={i} style={{ background: '#f8f9fa', padding: 8, borderRadius: 6, marginBottom: 4, fontSize: '0.85rem' }}>
                        <strong>{c.nome}</strong> <span style={{ color: '#999', fontSize: '0.75rem' }}>{formatDateTimeBR(c.data)}</span>
                        <p style={{ margin: '4px 0 0' }}>{c.comentario}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
              {isGestor && (
                <>
                  <button onClick={() => { setShowDetailModal(false); openEdit(selectedDemanda); }} style={S.btn('#3498db')}><i className="fas fa-edit"></i> Editar</button>
                  <button onClick={() => { setShowDetailModal(false); setSelectedDemanda(selectedDemanda); setShowReassignModal(true); }} style={S.btn('#9b59b6')}><i className="fas fa-exchange-alt"></i> Reatribuir</button>
                  <button onClick={() => { setShowDetailModal(false); setSelectedDemanda(selectedDemanda); setShowExtendModal(true); }} style={S.btn('#f39c12')}><i className="fas fa-clock"></i> Estender</button>
                </>
              )}
              <button onClick={() => { setShowDetailModal(false); setSelectedDemanda(selectedDemanda); setShowCommentModal(true); }} style={S.btn('#3498db')}><i className="fas fa-comment"></i> Comentar</button>
              <button onClick={() => { if (confirm('Excluir?')) { handleDeleteDemanda(selectedDemanda.id); } }} style={S.btn('#e74c3c')}><i className="fas fa-trash"></i> Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedDemanda && (
        <div style={S.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-edit" style={{ color: '#3498db' }}></i> Editar Demanda</h3>
              <button onClick={() => setShowEditModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={S.label}>Nome</label><input value={editForm.nomeDemanda} onChange={e => setEditForm(f => ({ ...f, nomeDemanda: e.target.value }))} style={S.input} /></div>
              <div><label style={S.label}>Categoria</label><select value={editForm.categoria} onChange={e => setEditForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...S.select, width: '100%', padding: '10px 14px' }}>{CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={S.label}>Prioridade</label><select value={editForm.prioridade} onChange={e => setEditForm(f => ({ ...f, prioridade: e.target.value }))} style={{ ...S.select, width: '100%', padding: '10px 14px' }}><option>Importante</option><option>Média</option><option>Relevante</option></select></div>
                <div><label style={S.label}>Complexidade</label><select value={editForm.complexidade} onChange={e => setEditForm(f => ({ ...f, complexidade: e.target.value }))} style={{ ...S.select, width: '100%', padding: '10px 14px' }}><option>Fácil</option><option>Médio</option><option>Difícil</option></select></div>
              </div>
              <div><label style={S.label}>Local</label><select value={editForm.local} onChange={e => setEditForm(f => ({ ...f, local: e.target.value }))} style={{ ...S.select, width: '100%', padding: '10px 14px' }}>{LOCAIS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
              <div><label style={S.label}>Descrição</label><textarea value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} style={{ ...S.input, minHeight: 80 }} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><input type="checkbox" checked={editForm.isRotina} onChange={e => setEditForm(f => ({ ...f, isRotina: e.target.checked }))} /> Rotina</label>
              {editForm.isRotina && (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                  {DAY_NAMES.map((day, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}><input type="checkbox" checked={editForm.diasSemana.includes(i)} onChange={e => { if (e.target.checked) setEditForm(f => ({ ...f, diasSemana: [...f.diasSemana, i] })); else setEditForm(f => ({ ...f, diasSemana: f.diasSemana.filter(d => d !== i) })); }} /> {day}</label>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEditModal(false)} style={S.btnOutline}>Cancelar</button>
              <button onClick={handleEditSave} style={S.btn('#27ae60')}><i className="fas fa-save"></i> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUÇÃO MODAL */}
      {showResolucaoModal && selectedDemanda && (
        <div style={S.modalOverlay} onClick={() => setShowResolucaoModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-check-circle" style={{ color: '#27ae60' }}></i> Finalizar Demanda</h3>
              <button onClick={() => setShowResolucaoModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={S.label}>Comentários</label><textarea value={resolucaoComment} onChange={e => setResolucaoComment(e.target.value)} placeholder="Descreva a resolução..." style={{ ...S.input, minHeight: 80 }} /></div>
              <div><label style={S.label}>Anexos da Resolução</label><input type="file" multiple onChange={e => handleFileUpload(e, setResolucaoAnexos)} style={S.input} /></div>
              {resolucaoAnexos.map((a, i) => <div key={i} style={{ fontSize: '0.8rem' }}><i className="fas fa-paperclip"></i> {a.name}</div>)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResolucaoModal(false)} style={S.btnOutline}>Cancelar</button>
              <button onClick={() => handleUpdateStatus(selectedDemanda.id, 'finalizado_pendente_aprovacao', { comentarios: resolucaoComment, anexosResolucao: resolucaoAnexos })} style={S.btn('#27ae60')}><i className="fas fa-check"></i> Finalizar</button>
            </div>
          </div>
        </div>
      )}

      {/* REPROVAÇÃO MODAL */}
      {showReprovacaoModal && selectedDemanda && (
        <div style={S.modalOverlay} onClick={() => setShowReprovacaoModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-times-circle" style={{ color: '#e74c3c' }}></i> Reprovar Demanda</h3>
              <button onClick={() => setShowReprovacaoModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={S.label}>Motivo</label><textarea value={reprovacaoReason} onChange={e => setReprovacaoReason(e.target.value)} placeholder="Explique o motivo da reprovação..." style={{ ...S.input, minHeight: 80 }} required /></div>
              <div><label style={S.label}>Estender prazo (dias)</label><input type="number" min={0} value={reprovacaoExtendDays} onChange={e => setReprovacaoExtendDays(Number(e.target.value))} style={S.input} /><span style={{ fontSize: '0.75rem', color: '#999' }}>Deixe 0 para não estender</span></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReprovacaoModal(false)} style={S.btnOutline}>Cancelar</button>
              <button onClick={() => handleUpdateStatus(selectedDemanda.id, 'reprovada', { reason: reprovacaoReason, extendDays: reprovacaoExtendDays })} style={S.btn('#e74c3c')}><i className="fas fa-times"></i> Reprovar</button>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGN MODAL */}
      {showReassignModal && selectedDemanda && (
        <div style={S.modalOverlay} onClick={() => setShowReassignModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-exchange-alt" style={{ color: '#9b59b6' }}></i> Reatribuir Demanda</h3>
              <button onClick={() => setShowReassignModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>×</button>
            </div>
            <div><label style={S.label}>Novo Responsável</label>
              <select value={reassignUserId} onChange={e => setReassignUserId(Number(e.target.value))} style={{ ...S.select, width: '100%', padding: '10px 14px' }}>
                <option value={0}>Selecione...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.nivel})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReassignModal(false)} style={S.btnOutline}>Cancelar</button>
              <button onClick={handleReassign} style={S.btn('#9b59b6')}><i className="fas fa-exchange-alt"></i> Reatribuir</button>
            </div>
          </div>
        </div>
      )}

      {/* EXTEND DEADLINE MODAL */}
      {showExtendModal && selectedDemanda && (
        <div style={S.modalOverlay} onClick={() => setShowExtendModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-clock" style={{ color: '#f39c12' }}></i> Estender Prazo</h3>
              <button onClick={() => setShowExtendModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={S.label}>Dias a adicionar</label><input type="number" min={1} value={extendDays} onChange={e => setExtendDays(Number(e.target.value))} style={S.input} /></div>
              <div><label style={S.label}>Motivo</label><textarea value={extendReason} onChange={e => setExtendReason(e.target.value)} placeholder="Motivo da extensão..." style={{ ...S.input, minHeight: 60 }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowExtendModal(false)} style={S.btnOutline}>Cancelar</button>
              <button onClick={handleExtendDeadline} style={S.btn('#f39c12')}><i className="fas fa-clock"></i> Estender</button>
            </div>
          </div>
        </div>
      )}

      {/* COMMENT MODAL */}
      {showCommentModal && selectedDemanda && (
        <div style={S.modalOverlay} onClick={() => setShowCommentModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-comment" style={{ color: '#3498db' }}></i> Adicionar Comentário</h3>
              <button onClick={() => setShowCommentModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>×</button>
            </div>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Seu comentário..." style={{ ...S.input, minHeight: 100 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCommentModal(false)} style={S.btnOutline}>Cancelar</button>
              <button onClick={handleAddComment} style={S.btn('#3498db')}><i className="fas fa-paper-plane"></i> Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* NOTE MODAL */}
      {showNoteModal && (
        <div style={S.modalOverlay} onClick={() => setShowNoteModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-sticky-note" style={{ color: '#f1c40f' }}></i> {editingNoteId ? 'Editar' : 'Nova'} Anotação</h3>
              <button onClick={() => setShowNoteModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={S.label}>Título</label><input value={noteForm.titulo} onChange={e => setNoteForm(f => ({ ...f, titulo: e.target.value }))} style={S.input} /></div>
              <div><label style={S.label}>Conteúdo</label><textarea value={noteForm.conteudo} onChange={e => setNoteForm(f => ({ ...f, conteudo: e.target.value }))} style={{ ...S.input, minHeight: 100 }} /></div>
              <div><label style={S.label}>Cor</label><div style={{ display: 'flex', gap: 8 }}>{NOTE_COLORS.map(c => (
                <button key={c.value} onClick={() => setNoteForm(f => ({ ...f, cor: c.value }))} style={{ width: 32, height: 32, borderRadius: '50%', background: c.value, border: noteForm.cor === c.value ? '3px solid #2c3e50' : '2px solid #ddd', cursor: 'pointer' }} title={c.label} />
              ))}</div></div>
              <div><label style={S.label}>Atribuir a</label><select value={noteForm.atribuidoA} onChange={e => setNoteForm(f => ({ ...f, atribuidoA: Number(e.target.value) }))} style={{ ...S.select, width: '100%', padding: '10px 14px' }}><option value={0}>Ninguém</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNoteModal(false)} style={S.btnOutline}>Cancelar</button>
              <button onClick={handleSaveNote} style={S.btn('#27ae60')}><i className="fas fa-save"></i> Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BUTTON */}
      {activeTab !== 'nova' && (
        <button onClick={() => setActiveTab('nova')} style={{
          position: 'fixed', bottom: 24, right: 24, width: 56, height: 56,
          borderRadius: '50%', background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
          color: '#fff', border: 'none', fontSize: '1.5rem', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} title="Nova Demanda"><i className="fas fa-plus"></i></button>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#27ae60' : '#e74c3c', color: '#fff',
          padding: '12px 24px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 300, fontSize: '0.9rem', fontWeight: 600,
        }}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i> {toast.message}
        </div>
      )}
    </div>
  );
}
