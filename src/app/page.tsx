"use client";

import { useEffect, useState, useCallback } from "react";

// Types
type StateType = "mg" | "go" | "pa" | "ba" | null;
type ModalType = "services" | "security" | null;

// PWA Install Event Type
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Lista de usuários autorizados (email: senha = 2026)
const AUTHORIZED_USERS = [
  'julio-s@zaminebrasil.com',
  'wallysson-s@zaminebrasil.com',
  'emerson-a@zaminebrasil.com',
  'jose-s@zaminebrasil.com',
  'charles-a@zaminebrasil.com',
  'rafaela-m@zaminebrasil.com',
  'jadson-r@zaminebrasil.com',
  'weslley-f@zaminebrasil.com',
  'higor-a@zaminebrasil.com',
  'marcos-b@zaminebrasil.com',
  'marcos-a@zaminebrasil.com',
  'marcelo-p@zaminebrasil.com',
  'warlen-s@zaminebrasil.com',
  'cicero-c@zaminebrasil.com',
  'tiago-c@zaminebrasil.com',
  'robson-m@zaminebrasil.com',
  'rodrigo-v@zaminebrasil.com',
  'marlon-m@zaminebrasil.com',
  'ranielly-s@zaminebrasil.com',
  'girlene-n@zaminebrasil.com',
  'max-r@zaminebrasil.com', // Max Henrique (desenvolvedor)
];

const DEFAULT_PASSWORD = '2026';
const ADMIN_EMAIL = 'max-r@zaminebrasil.com';

// Links externos
const COMERCIAL_URL = 'https://zaminebrasil.sharepoint.com/_layouts/15/sharepoint.aspx';
const OPORTUNIDADES_VENDA_URL = 'https://zaminebrasil.sharepoint.com/:u:/s/SERVIOS-LUNDIN/IQCftieI2euhSLNNxiO9NZJzASI3bPdRe1vVb1QV2RrHbCA?e=zOrOGd';
const LITERATURAS_TECNICAS_URL = 'https://zaminebrasil.sharepoint.com/:f:/s/SERVIOS-LUNDIN/IgC0u_WmXr-EQKr7KBf8HkJdASeXO_D2gOXspSIhUXjb_4s?e=hex2ds';

// Services Data
const servicesData: Record<string, {title: string; description: string; icon: string; url: string}[]> = {
  'mg': [
    { title: 'Segurança', description: 'Opções de segurança - Minas Gerais', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades em Minas Gerais', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'Relatórios Técnicos', description: 'Indicadores de Relatórios Técnicos', icon: 'bar_chart', url: 'https://app.powerbi.com/links/2XMhgQQ8OX?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' },
    { title: 'KPI Performance', description: 'Indicadores de performance', icon: 'bar_chart', url: 'https://app.powerbi.com/links/pb7oNGBtl2?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' },
    { title: 'Books Mensais', description: 'Books Mensais - Minas Gerais', icon: 'book', url: '/html/bookMinas.html' },
    { title: 'Requisições', description: 'Sistema de requisições', icon: 'assignment', url: 'https://app.powerbi.com/links/VkvtykuiEY?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare&bookmarkGuid=1b4117a2-1cf9-44a8-97d5-e00b219dfec3' }
  ],
  'go': [
    { title: 'Segurança', description: 'Opções de segurança - Goiás', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades em Goiás', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'Relatórios Técnicos', description: 'Indicadores de Relatórios Técnicos', icon: 'bar_chart', url: 'https://app.powerbi.com/links/sZd7OFBV_z?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' },
    { title: 'KPI Performance', description: 'Indicadores de performance', icon: 'bar_chart', url: 'https://app.powerbi.com/links/aIKzcce3Nx?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' },
    { title: 'Books Mensais', description: 'Books Mensais - Goiás', icon: 'book', url: '/html/Book.html' },
    { title: 'Requisições', description: 'Sistema de requisições', icon: 'assignment', url: 'https://app.powerbi.com/links/5eRqDNFl5n?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' },
    { title: 'Escala de Turno', description: 'Gerenciamento de escalas', icon: 'schedule', url: 'https://escala-tz6j.onrender.com/' },
    { title: 'Relatório diário', description: 'Relatórios diários de operação', icon: 'description', url: '/html/Relatoriodiario.html' }
  ],
  'pa': [
    { title: 'Segurança', description: 'Opções de segurança - Pará', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades no Pará', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'Relatórios Técnicos', description: 'Acesse todos os relatórios técnicos', icon: 'description', url: '/html/SearchReportMinas.html' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' }
  ],
  'ba': [
    { title: 'Segurança', description: 'Opções de segurança - Bahia', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL }
  ]
};

// Security Data
const securityData: Record<string, {title: string; description: string; icon: string; url: string}[]> = {
  'mg': [
    { title: 'Auditoria de EPIs', description: 'Sistema de auditoria de EPIs', icon: 'verified', url: '/html/AuditoriaEPISMinas.html' },
    { title: 'Inspeções de Segurança', description: 'Registros de inspeções', icon: 'security', url: '/html/InspeçõesSegurança.html' },
    { title: 'KPI Segurança', description: 'Indicadores de segurança', icon: 'bar_chart', url: 'https://app.powerbi.com/links/7fUFPRWu3X?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' }
  ],
  'go': [
    { title: 'Auditoria de EPIs', description: 'Sistema de auditoria de EPIs', icon: 'verified', url: '/html/AuditoriaEPIS.html' },
    { title: 'Inspeções de Segurança', description: 'Registros de inspeções', icon: 'security', url: '/html/InspeçõesSegurança.html' },
    { title: 'KPI Segurança', description: 'Indicadores de segurança', icon: 'bar_chart', url: 'https://app.powerbi.com/links/PHZoCHceXg?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' },
    { title: 'Campanhas de Segurança', description: 'Campanhas internas', icon: 'campaign', url: '/html/Campanhas.html' }
  ],
  'pa': [
    { title: 'Auditoria de EPIs', description: 'Sistema de auditoria de EPIs', icon: 'verified', url: '#' },
    { title: 'Inspeções de Segurança', description: 'Registros de inspeções', icon: 'security', url: '#' }
  ],
  'ba': []
};

const stateNames: Record<string, string> = {
  'mg': 'Minas Gerais',
  'go': 'Goiás',
  'pa': 'Pará',
  'ba': 'Bahia'
};

// Login Component
function LoginScreen({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCurrentPassword, setForgotCurrentPassword] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  // Register states
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerDepartment, setRegisterDepartment] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);
  // PWA Install
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [showPostInstallModal, setShowPostInstallModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showInstallCard, setShowInstallCard] = useState(true);

  // PWA Install prompt
  useEffect(() => {
    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Detectar se é mobile (Android/iOS)
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado:', registration.scope);
        })
        .catch((error) => {
          console.log('Erro ao registrar Service Worker:', error);
        });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    
    // Detectar se já está instalado
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Detectar quando foi instalado
    window.addEventListener('appinstalled', () => {
      setInstallSuccess(true);
      setInstallPrompt(null);
    });
    
    // Ocultar card após 5 segundos
    const timer = setTimeout(() => {
      setShowInstallCard(false);
    }, 5000);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallApp = async () => {
    if (isIOS) {
      // iPhone/iPad - mostra contato WhatsApp
      setShowIOSModal(true);
    } else if (installPrompt) {
      // Edge/Chrome/Android - abre popup nativo
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setInstallPrompt(null);
        setInstallSuccess(true);
        // Se for PC, mostra opções pós-instalação
        if (!isMobile) {
          setShowPostInstallModal(true);
        }
      }
    } else if (isMobile) {
      // Android sem prompt nativo (já instalou antes) - mostra instruções
      setShowAndroidModal(true);
    } else {
      // PC sem prompt nativo - mostra instruções
      setShowPostInstallModal(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!AUTHORIZED_USERS.includes(email.toLowerCase())) {
      setError('Email não autorizado. Entre em contato com o administrador.');
      return;
    }

    if (password !== DEFAULT_PASSWORD) {
      setError('Senha incorreta.');
      return;
    }

    localStorage.setItem('zamine_user', email);
    onLogin(email);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!AUTHORIZED_USERS.includes(forgotEmail.toLowerCase())) {
      setError('Email não encontrado no sistema.');
      return;
    }

    if (forgotCurrentPassword !== DEFAULT_PASSWORD) {
      setError('Senha atual incorreta.');
      return;
    }

    if (!forgotNewPassword || forgotNewPassword.length < 4) {
      setError('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }

    // Abre email para o Max Henrique
    const subject = encodeURIComponent('Solicitação de Troca de Senha - Plataforma Zamine');
    const body = encodeURIComponent(`Olá Max,

Gostaria de solicitar a troca de senha para o email: ${forgotEmail}

Nova senha desejada: ${forgotNewPassword}

Obrigado(a).`);
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
    
    setForgotSuccess(true);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!registerEmail || !registerEmail.includes('@')) {
      setError('Digite um email válido.');
      return;
    }

    if (!registerPassword || registerPassword.length < 4) {
      setError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    if (!registerDepartment) {
      setError('Selecione um departamento.');
      return;
    }

    // Abre email para o Max Henrique com solicitação de cadastro
    const subject = encodeURIComponent('Solicitação de Cadastro - Plataforma Zamine');
    const body = encodeURIComponent(`Olá Max,

Gostaria de solicitar cadastro na plataforma Zamine.

Dados do cadastro:
- Email: ${registerEmail}
- Senha desejada: ${registerPassword}
- Departamento: ${registerDepartment}

Obrigado(a).`);
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
    
    setRegisterSuccess(true);
  };

  if (showRegister) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-orange-500/30">
          <button 
            onClick={() => { setShowRegister(false); setError(''); setRegisterSuccess(false); setRegisterEmail(''); setRegisterPassword(''); setRegisterDepartment(''); }}
            className="flex items-center text-orange-500 hover:text-orange-400 mb-4 transition-colors"
          >
            <span className="material-icons mr-1">arrow_back</span>
            Voltar
          </button>

          <div className="text-center mb-6">
            <img src="/images/zamine-logo.png" alt="Zamine" className="h-16 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">Solicitar Cadastro</h2>
            <p className="text-gray-400 text-sm mt-2">Preencha os dados abaixo para solicitar acesso à plataforma</p>
          </div>

          {registerSuccess ? (
            <div className="text-center">
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-4">
                <span className="material-icons text-green-500 text-4xl mb-2">check_circle</span>
                <p className="text-green-400 font-semibold">Solicitação enviada!</p>
                <p className="text-gray-400 text-sm mt-2">Um email será aberto para você confirmar a solicitação de cadastro para o administrador.</p>
              </div>
              <button 
                onClick={() => { setShowRegister(false); setRegisterSuccess(false); setRegisterEmail(''); setRegisterPassword(''); setRegisterDepartment(''); }}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Voltar ao Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  placeholder="seu.email@zaminebrasil.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Senha desejada</label>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  placeholder="Digite a senha desejada"
                  required
                  minLength={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Departamento</label>
                <select
                  value={registerDepartment}
                  onChange={(e) => setRegisterDepartment(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-orange-500"
                  required
                >
                  <option value="">Selecione o departamento</option>
                  <option value="Serviços">Serviços</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Segurança">Segurança</option>
                  <option value="RH">RH</option>
                  <option value="TI">TI</option>
                  <option value="Comercial">Comercial</option>
                  <option value="Financeiro">Financeiro</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                  <span className="material-icons">error</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons">person_add</span>
                Solicitar Cadastro
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-orange-500/30">
          <button 
            onClick={() => { setShowForgotPassword(false); setError(''); setForgotSuccess(false); setForgotEmail(''); setForgotCurrentPassword(''); setForgotNewPassword(''); }}
            className="flex items-center text-orange-500 hover:text-orange-400 mb-4 transition-colors"
          >
            <span className="material-icons mr-1">arrow_back</span>
            Voltar
          </button>

          <div className="text-center mb-6">
            <img src="/images/zamine-logo.png" alt="Zamine" className="h-16 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">Trocar Senha</h2>
            <p className="text-gray-400 text-sm mt-2">Preencha os campos abaixo para solicitar a troca de senha</p>
          </div>

          {forgotSuccess ? (
            <div className="text-center">
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 mb-4">
                <span className="material-icons text-green-500 text-4xl mb-2">check_circle</span>
                <p className="text-green-400 font-semibold">Solicitação enviada!</p>
                <p className="text-gray-400 text-sm mt-2">Um email será aberto para você confirmar a solicitação de troca de senha para o administrador.</p>
              </div>
              <button 
                onClick={() => { setShowForgotPassword(false); setForgotSuccess(false); setForgotEmail(''); setForgotCurrentPassword(''); setForgotNewPassword(''); }}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Voltar ao Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email cadastrado</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  placeholder="seu.email@zaminebrasil.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Senha atual</label>
                <input
                  type="password"
                  value={forgotCurrentPassword}
                  onChange={(e) => setForgotCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  placeholder="Digite sua senha atual"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nova senha desejada</label>
                <input
                  type="password"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  placeholder="Digite a nova senha"
                  required
                  minLength={4}
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                  <span className="material-icons">error</span>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons">email</span>
                Solicitar Troca de Senha
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-orange-500/30">
        <div className="text-center mb-6">
          <img src="/images/zamine-logo.png" alt="Zamine" className="h-16 mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-white">Bem-vindo</h2>
          <p className="text-gray-400 text-sm mt-2">Faça login para acessar a plataforma</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
              placeholder="seu.email@zaminebrasil.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
              placeholder="••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
              <span className="material-icons">error</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-icons">login</span>
            Entrar
          </button>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => { setShowForgotPassword(true); setError(''); }}
              className="flex-1 text-orange-500 hover:text-orange-400 text-sm transition-colors"
            >
              Esqueceu a senha?
            </button>
            <span className="hidden sm:block text-gray-600">|</span>
            <button
              type="button"
              onClick={() => { setShowRegister(true); setError(''); }}
              className="flex-1 text-orange-500 hover:text-orange-400 text-sm transition-colors"
            >
              Cadastrar
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-xs">
            © 2026 Zamine Brasil - Todos os direitos reservados
          </p>
        </div>
      </div>

      {/* Botão flutuante de instalação - SEMPRE VISÍVEL */}
      {!installSuccess && (
        <div className="fixed bottom-6 right-6 z-50">
          {/* Card expandido - aparece por 5 segundos ou quando clicado no botão */}
          {showInstallCard ? (
            <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-xl p-4 shadow-2xl border border-green-400/50 max-w-[280px] transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="material-icons text-white text-2xl">{isIOS ? 'phone_iphone' : isMobile ? 'smartphone' : 'desktop_windows'}</span>
                  <p className="text-white font-semibold text-sm">
                    {isIOS ? 'Instalar no iPhone/iPad' : isMobile ? 'Instalar no Celular' : 'Instalar no PC'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowInstallCard(false)}
                  className="text-white/70 hover:text-white"
                >
                  <span className="material-icons text-lg">close</span>
                </button>
              </div>
              <p className="text-green-100 text-xs mb-3">
                {isIOS ? 'Clique para receber ajuda.' : isMobile ? 'Adicione um atalho na tela inicial.' : 'Acesse rapidamente pelo seu computador.'}
              </p>
              <button
                onClick={handleInstallApp}
                className="w-full bg-white text-green-600 py-2 px-4 rounded-lg font-semibold text-sm hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons text-lg">{isIOS ? 'contact_support' : 'install_desktop'}</span>
                {isIOS ? 'Falar no WhatsApp' : 'Instalar Agora'}
              </button>
            </div>
          ) : (
            /* Botão menor - aparece após o card ocultar */
            <button
              onClick={() => setShowInstallCard(true)}
              className="bg-gradient-to-r from-green-600 to-green-500 rounded-full p-3 shadow-2xl border border-green-400/50 hover:scale-110 transition-transform"
              title="Instalar aplicativo"
            >
              <span className="material-icons text-white text-2xl">{isIOS ? 'phone_iphone' : 'install_desktop'}</span>
            </button>
          )}
        </div>
      )}

      {/* Modal pós-instalação - APENAS para PC */}
      {showPostInstallModal && !isMobile && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setShowPostInstallModal(false)}>
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-green-500/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-icons text-green-500 text-3xl">check_circle</span>
              <h3 className="text-xl font-bold text-white">Instalação Concluída!</h3>
            </div>
            
            <p className="text-gray-300 text-sm mb-4">
              A plataforma foi instalada com sucesso! Agora você pode configurar o acesso rápido:
            </p>
            
            <div className="space-y-3 text-sm">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="font-semibold text-white mb-3">Opções disponíveis no Edge/Chrome:</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 w-4 h-4 text-green-600 rounded accent-green-500" checked disabled style={{opacity: 1}} />
                    <div>
                      <p className="text-white font-medium">📌 Fixar na barra de tarefas</p>
                      <p className="text-gray-400 text-xs">Acesse com um clique direto da barra</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 w-4 h-4 text-green-600 rounded accent-green-500" checked disabled style={{opacity: 1}} />
                    <div>
                      <p className="text-white font-medium">🏠 Fixar no menu Iniciar</p>
                      <p className="text-gray-400 text-xs">Apareça no menu iniciar do Windows</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 w-4 h-4 text-green-600 rounded accent-green-500" checked disabled style={{opacity: 1}} />
                    <div>
                      <p className="text-white font-medium">🖥️ Criar atalho na área de trabalho</p>
                      <p className="text-gray-400 text-xs">Ícone na área de trabalho</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-400 text-xs">
                  💡 <strong>Como fazer:</strong> Clique com o botão direito no ícone do app instalado e escolha as opções desejadas.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowPostInstallModal(false)}
              className="w-full mt-5 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Entendi!
            </button>
          </div>
        </div>
      )}

      {/* Modal para iOS - Contato WhatsApp */}
      {showIOSModal && isIOS && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setShowIOSModal(false)}>
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-orange-500/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-icons text-orange-500 text-3xl">phone_iphone</span>
              <h3 className="text-xl font-bold text-white">Instalar no iPhone/iPad</h3>
            </div>
            
            <div className="space-y-4 text-gray-300 text-sm">
              <p className="text-gray-300">
                Para instalar no iPhone/iPad, entre em contato com o desenvolvedor que ele te ajuda:
              </p>
              
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-white font-semibold mb-2">Max Henrique</p>
                <p className="text-gray-400 text-sm mb-3">Desenvolvedor da Plataforma</p>
                <a
                  href="https://wa.me/5562982093453?text=Olá! Preciso de ajuda para instalar a plataforma Zamine no meu iPhone/iPad."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Abrir WhatsApp
                </a>
              </div>
              
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
                <p className="text-orange-400 text-xs">📱 (62) 98209-3453</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full mt-5 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal para Android - Instruções manuais */}
      {showAndroidModal && isMobile && !isIOS && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setShowAndroidModal(false)}>
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-green-500/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-icons text-green-500 text-3xl">smartphone</span>
              <h3 className="text-xl font-bold text-white">Instalar no Celular</h3>
            </div>
            
            <div className="space-y-4 text-gray-300 text-sm">
              <p className="text-gray-300">
                Para adicionar o atalho na tela inicial:
              </p>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <ol className="list-decimal list-inside space-y-3">
                  <li>
                    Toque no <strong className="text-white">menu do navegador</strong> (⋮ três pontinhos)
                  </li>
                  <li>
                    Toque em <strong className="text-green-400">"Adicionar à tela inicial"</strong>
                  </li>
                  <li>
                    Confirme tocando em <strong className="text-green-400">"Adicionar"</strong>
                  </li>
                </ol>
              </div>
              
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <p className="text-green-400 text-xs">💡 Pronto! O ícone aparecerá na sua tela inicial.</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowAndroidModal(false)}
              className="w-full mt-5 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              Entendi!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Main App Component
export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedState, setSelectedState] = useState<StateType>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalState, setModalState] = useState<StateType>(null);
  const [showDeveloperModal, setShowDeveloperModal] = useState(false);
  const [counter, setCounter] = useState({ mg: { days: 0, hours: 0, minutes: 0, seconds: 0 }, go: { days: 0, hours: 0, minutes: 0, seconds: 0 } });
  const [stateCounter, setStateCounter] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  // PWA Install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    (installPrompt as BeforeInstallPromptEvent).prompt();
    const result = await (installPrompt as BeforeInstallPromptEvent).userChoice;
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Mount effect - runs once on client
  useEffect(() => {
    // Use setTimeout to defer state updates
    const timer = setTimeout(() => {
      setMounted(true);
      const savedUser = localStorage.getItem('zamine_user');
      if (savedUser && AUTHORIZED_USERS.includes(savedUser.toLowerCase())) {
        setCurrentUser(savedUser);
        setIsAuthenticated(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (email: string) => {
    localStorage.setItem('zamine_user', email);
    setCurrentUser(email);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('zamine_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsLoading(true);
    setLoadingProgress(0);
  };

  // Loading animation
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const startTime = Date.now();
    const duration = 8000;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setLoadingProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => setIsLoading(false), 1000);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Counter calculations
  useEffect(() => {
    const updateCounters = () => {
      const now = new Date();
      
      const mgStart = new Date('2024-07-11');
      const mgDiff = now.getTime() - mgStart.getTime();
      const mgDays = Math.floor(mgDiff / (1000 * 60 * 60 * 24));
      const mgHours = Math.floor((mgDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mgMinutes = Math.floor((mgDiff % (1000 * 60 * 60)) / (1000 * 60));
      const mgSeconds = Math.floor((mgDiff % (1000 * 60)) / 1000);
      
      const goStart = new Date('2022-08-01');
      const goDiff = now.getTime() - goStart.getTime();
      const goDays = Math.floor(goDiff / (1000 * 60 * 60 * 24));
      const goHours = Math.floor((goDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const goMinutes = Math.floor((goDiff % (1000 * 60 * 60)) / (1000 * 60));
      const goSeconds = Math.floor((goDiff % (1000 * 60)) / 1000);
      
      setCounter({
        mg: { days: mgDays, hours: mgHours, minutes: mgMinutes, seconds: mgSeconds },
        go: { days: goDays, hours: goHours, minutes: goMinutes, seconds: goSeconds }
      });

      if (selectedState === 'mg' || selectedState === 'mg-mosaic') {
        setStateCounter({ days: mgDays, hours: mgHours, minutes: mgMinutes, seconds: mgSeconds });
      } else if (selectedState === 'go') {
        setStateCounter({ days: goDays, hours: goHours, minutes: goMinutes, seconds: goSeconds });
      }
    };

    updateCounters();
    const interval = setInterval(updateCounters, 1000);
    return () => clearInterval(interval);
  }, [selectedState, isAuthenticated]);

  const handleMarkerClick = (state: StateType) => setSelectedState(state);

  const resetToInitialState = useCallback(() => {
    setSelectedState(null);
    setActiveModal(null);
    setModalState(null);
  }, []);

  const openModal = (type: ModalType, state: StateType) => {
    setActiveModal(type);
    setModalState(state);
  };

  const closeModal = () => setActiveModal(null);

  const currentData = activeModal === 'services' ? servicesData[modalState || ''] : securityData[modalState || ''];

  // Show loading while mounting on client
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Loading Screen
  if (isLoading) {
    return (
      <>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <style jsx global>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.5; }
          }
        `}</style>
        <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col z-[9999]">
          <div className="flex flex-grow h-full">
            <div className="flex-1 relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('https://sfile.chatglm.cn/images-ppt/2c65e9f35b39.jpg')" }}>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-black/70"></div>
            </div>
            <div className="flex-1 relative overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('https://sfile.chatglm.cn/images-ppt/149e36ab0f04.jpg')" }}>
              <div className="absolute inset-0 bg-gradient-to-l from-blue-600/20 to-black/70"></div>
            </div>
          </div>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-full bg-gradient-to-b from-transparent via-orange-500 to-transparent z-[5]"></div>

          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
            <img src="/images/zamine-logo.png" alt="ZAMINE" className="h-14 sm:h-16 md:h-20 w-auto object-contain" style={{ filter: 'drop-shadow(0 0 10px rgba(255,102,0,0.7))' }} />
          </div>

          <div className="absolute top-3 left-3 text-lg font-bold text-orange-500 z-10">HITACHI</div>

          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-[80%] max-w-[800px] z-10">
            <div className="h-3 bg-white/20 rounded-full overflow-visible relative">
              <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full relative transition-all duration-100" style={{ width: `${loadingProgress}%` }}>
                <div className="absolute -top-20 -right-20 w-44 h-44 bg-contain bg-no-repeat bg-center" style={{ backgroundImage: "url('https://sfile.chatglm.cn/images-ppt/939ddf9ede7b.png')" }}></div>
              </div>
            </div>
            <div className="text-center mt-5 text-xl font-semibold text-orange-400 uppercase tracking-wider">CARREGANDO SISTEMA</div>
            <div className="flex justify-center mt-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-orange-500" style={{ animation: 'pulse 1.5s infinite ease-in-out', animationDelay: `${i * 0.3}s` }}></div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Main Application
  return (
    <>
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap" rel="stylesheet" />
      
      <style jsx global>{`
        @keyframes slideIn { from { transform: translateY(-30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        body { font-family: 'Source Sans Pro', sans-serif; overflow: hidden; }
      `}</style>

      <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
        <div className="fixed inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: "url('/images/Fundo.jpg')" }}></div>

        <div className="fixed inset-0 z-10 flex flex-col">
          <div className="flex-grow relative w-full h-full">
            <video autoPlay muted loop playsInline className="w-full h-full object-cover pointer-events-none" style={{ pointerEvents: 'none' }}>
              <source src="/videos/Mapa.mp4" type="video/mp4" />
            </video>

            {selectedState && (
              <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-15 transition-opacity duration-1000 pointer-events-none" style={{ opacity: 1, pointerEvents: 'none' }}>
                <source src={`/videos/${selectedState === 'mg-mosaic' ? 'Mosaic' : selectedState === 'mg' ? 'Minas' : selectedState === 'go' ? 'Goiás' : selectedState === 'pa' ? 'Pará' : 'Bahia'}.mp4`} type="video/mp4" />
              </video>
            )}

            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-3 sm:p-5 bg-gradient-to-b from-black/80 to-transparent z-20 flex justify-between items-center">
              <img src="/images/zamine-logo.png" alt="Zamine" className="h-8 sm:h-10 w-auto object-contain" />
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-xs text-gray-400 hidden sm:block">{currentUser?.split('@')[0]}</span>
                {installPrompt && (
                  <button onClick={handleInstallApp} className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1">
                    <span className="material-icons text-sm">install_desktop</span>
                    <span className="hidden sm:inline">Instalar</span>
                  </button>
                )}
                <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1">
                  <span className="material-icons text-sm">logout</span>
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>

            {/* State Markers */}
            {!selectedState && (
              <div className="absolute inset-0 z-20">
                {/* MG Marker */}
                <div 
                  className="absolute cursor-pointer group"
                  style={{ top: '55%', left: '58%' }}
                  onClick={() => handleMarkerClick('mg')}
                >
                  <div className="relative">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-orange-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <span className="text-white font-bold text-xs sm:text-sm">MG</span>
                    </div>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Minas Gerais
                    </div>
                  </div>
                </div>

                {/* GO Marker */}
                <div 
                  className="absolute cursor-pointer group"
                  style={{ top: '52%', left: '48%' }}
                  onClick={() => handleMarkerClick('go')}
                >
                  <div className="relative">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <span className="text-white font-bold text-xs sm:text-sm">GO</span>
                    </div>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Goiás
                    </div>
                  </div>
                </div>

                {/* PA Marker */}
                <div 
                  className="absolute cursor-pointer group"
                  style={{ top: '25%', left: '55%' }}
                  onClick={() => handleMarkerClick('pa')}
                >
                  <div className="relative">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <span className="text-white font-bold text-xs sm:text-sm">PA</span>
                    </div>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Pará
                    </div>
                  </div>
                </div>

                {/* BA Marker */}
                <div 
                  className="absolute cursor-pointer group"
                  style={{ top: '60%', left: '52%' }}
                  onClick={() => handleMarkerClick('ba')}
                >
                  <div className="relative">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <span className="text-white font-bold text-xs sm:text-sm">BA</span>
                    </div>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Bahia
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* State Content */}
            {selectedState && (
              <div className="absolute inset-0 z-20 flex flex-col">
                {/* Back Button */}
                <div className="absolute top-16 left-4 z-30">
                  <button 
                    onClick={resetToInitialState}
                    className="bg-black/50 hover:bg-black/70 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <span className="material-icons">arrow_back</span>
                    Voltar
                  </button>
                </div>

                {/* State Title and Counter */}
                <div className="pt-24 sm:pt-32 px-4 text-center" style={{ animation: 'slideIn 0.5s ease-out' }}>
                  <h2 className="text-2xl sm:text-4xl font-bold text-orange-500 mb-2">{stateNames[selectedState] || 'Minas Gerais'}</h2>
                  {(selectedState === 'mg' || selectedState === 'go') && (
                    <div className="text-gray-300 text-sm sm:text-base">
                      <span className="font-semibold">Dias sem afastamento: </span>
                      <span className="text-green-400 font-bold">{stateCounter.days}</span> dias, 
                      <span className="text-green-400 font-bold"> {stateCounter.hours}</span>h 
                      <span className="text-green-400 font-bold">{stateCounter.minutes}</span>m 
                      <span className="text-green-400 font-bold">{stateCounter.seconds}</span>s
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex-1 flex items-center justify-center gap-4 sm:gap-8 px-4">
                  <button
                    onClick={() => openModal('services', selectedState)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 sm:px-8 sm:py-6 rounded-xl font-semibold text-base sm:text-lg transition-all transform hover:scale-105 shadow-lg flex flex-col items-center gap-2"
                  >
                    <span className="material-icons text-2xl sm:text-3xl">business_center</span>
                    Serviços
                  </button>
                  <button
                    onClick={() => openModal('security', selectedState)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 sm:px-8 sm:py-6 rounded-xl font-semibold text-base sm:text-lg transition-all transform hover:scale-105 shadow-lg flex flex-col items-center gap-2"
                  >
                    <span className="material-icons text-2xl sm:text-3xl">security</span>
                    Segurança
                  </button>
                </div>
              </div>
            )}

            {/* Services/Security Modal */}
            {activeModal && modalState && (
              <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-4" onClick={closeModal}>
                <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ animation: 'fadeIn 0.3s ease-out' }}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl sm:text-2xl font-bold text-orange-500">
                      {activeModal === 'services' ? 'Serviços' : 'Segurança'} - {stateNames[modalState]}
                    </h3>
                    <button onClick={closeModal} className="text-gray-400 hover:text-white">
                      <span className="material-icons text-2xl">close</span>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {currentData?.map((item, index) => (
                      <a
                        key={index}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gray-700 hover:bg-gray-600 rounded-xl p-4 flex items-center gap-3 transition-colors group"
                      >
                        <span className="material-icons text-orange-500 text-2xl">{item.icon}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-white group-hover:text-orange-400 transition-colors">{item.title}</p>
                          <p className="text-gray-400 text-xs">{item.description}</p>
                        </div>
                        <span className="material-icons text-gray-500 group-hover:text-orange-500 transition-colors">open_in_new</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="absolute bottom-0 left-0 w-full p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent z-20">
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-400">
                  © 2026 Zamine Brasil - Todos os direitos reservados
                </div>
                <button 
                  onClick={() => setShowDeveloperModal(true)}
                  className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
                >
                  Desenvolvedor
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Developer Modal */}
      {showDeveloperModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-md p-3 sm:p-0">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 max-w-md w-full mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-orange-500">Sobre o Desenvolvedor</h3>
              <button onClick={() => setShowDeveloperModal(false)} className="text-gray-400 hover:text-white p-1">
                <span className="material-icons text-2xl">close</span>
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                <img src="/images/Desenvolvedor.jpeg" alt="Foto do Desenvolvedor" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-orange-500 flex-shrink-0" />
                <div className="text-center sm:text-left">
                  <p className="text-gray-300 text-sm sm:text-base">Este sistema foi desenvolvido por <span className="text-orange-500 font-semibold">Max Henrique</span>, Assistente de Serviços da <img src="/images/zamine-logo.png" alt="Zamine" className="inline-block h-5 sm:h-6 w-auto align-middle mx-1" />.</p>
                  <p className="text-gray-300 text-sm sm:text-base mt-2 hidden sm:block">Foram utilizadas as tecnologias Python, JSON, JavaScript e HTML em todo o processo de desenvolvimento.</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm sm:text-base">O objetivo do sistema é proporcionar uma visualização mais eficiente dos indicadores disponíveis no CMD em Minas Gerais e na Lundin Mining em Goiás, unindo organização e facilidade de acesso às informações.</p>
              <div className="bg-gray-700 p-3 sm:p-4 rounded-lg">
                <h4 className="text-orange-500 font-semibold mb-2 text-sm sm:text-base">Contato para melhorias ou reporte de bugs</h4>
                <div className="flex items-center gap-2 mt-2 sm:mt-3">
                  <span className="material-icons text-orange-500 text-lg sm:text-xl">mail</span>
                  <a href="mailto:Max-r@zaminebrasil.com" className="text-orange-500 hover:underline text-sm sm:text-base">Max-r@zaminebrasil.com</a>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-3">
                  <span className="material-icons text-orange-500 text-lg sm:text-xl">phone</span>
                  <a href="https://wa.me/5562982093453" target="_blank" className="text-orange-500 hover:underline text-sm sm:text-base">(62) 98209-3453</a>
                </div>
              </div>
              <div className="mt-4 sm:mt-6 flex justify-center sm:justify-start">
                <button 
                  onClick={() => window.location.href = 'mailto:Max-r@zaminebrasil.com?subject=Feedback%20sobre%20o%20sistema&body=Enquanto%20navegava,%20vi%20algo%20que%20gostaria%20de%20reportar'}
                  className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 active:scale-95 transition-all text-sm sm:text-base"
                >
                  <span className="material-icons mr-2 text-lg sm:text-xl">mail</span> Enviar Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
