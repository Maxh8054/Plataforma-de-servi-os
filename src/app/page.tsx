"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";

// Types
type StateType = "mg" | "go" | "pa" | "ba" | "sc" | "ma" | null;
type ModalType = "services" | "security" | null;

// PWA Install Event Type
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Equipment Data Interface (from database)
interface Equipment {
  id: string;
  equipamento: string;
  modelo: string;
  cliente: string;
  size: string;
  local: string;
  empresa: string;
  ano: string;
  statusOperacao: string | null;
  motivoStandby: string | null;
  falhasCriticas: string | null;
}

interface EquipmentFilters {
  locais: string[];
  empresas: string[];
  clientes: string[];
  status: string[];
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
    { title: 'R&D', description: 'Serviços R&D - Minas Gerais', icon: 'business', url: '#rd' },
    { title: 'Araxá', description: 'Serviços Araxá - Minas Gerais', icon: 'location_city', url: '#araxa' },
    { title: 'Usiminas', description: 'Serviços Usiminas - Minas Gerais', icon: 'factory', url: '#usiminas' }
  ],
  'mg-rd': [
    { title: 'Segurança', description: 'Opções de segurança - R&D', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Equipamentos Hitachi Brasil', description: 'Lista de equipamentos Hitachi', icon: 'precision_manufacturing', url: '#equipamentos' },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades em R&D', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'Relatórios Técnicos', description: 'Indicadores de Relatórios Técnicos', icon: 'bar_chart', url: 'https://app.powerbi.com/links/2XMhgQQ8OX?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' },
    { title: 'KPI Performance', description: 'Indicadores de performance', icon: 'bar_chart', url: 'https://app.powerbi.com/links/pb7oNGBtl2?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' },
    { title: 'Books Mensais', description: 'Books Mensais - R&D', icon: 'book', url: '/html/bookMinas.html' },
    { title: 'Requisições', description: 'Sistema de requisições', icon: 'assignment', url: 'https://app.powerbi.com/links/VkvtykuiEY?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare&bookmarkGuid=1b4117a2-1cf9-44a8-97d5-e00b219dfec3' }
  ],
  'mg-araxa': [
    { title: 'Segurança', description: 'Opções de segurança - Araxá', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Equipamentos Hitachi Brasil', description: 'Lista de equipamentos Hitachi', icon: 'precision_manufacturing', url: '#equipamentos' },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades em Araxá', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' },
    { title: 'Books Mensais', description: 'Books Mensais - Araxá', icon: 'book', url: '/html/bookMinas.html' },
    { title: 'Requisições', description: 'Sistema de requisições', icon: 'assignment', url: 'https://app.powerbi.com/links/VkvtykuiEY?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare&bookmarkGuid=1b4117a2-1cf9-44a8-97d5-e00b219dfec3' }
  ],
  'mg-usiminas': [
    { title: 'Segurança', description: 'Opções de segurança - Usiminas', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Equipamentos Hitachi Brasil', description: 'Lista de equipamentos Hitachi', icon: 'precision_manufacturing', url: '#equipamentos' },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades em Usiminas', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' },
    { title: 'Books Mensais', description: 'Books Mensais - Usiminas', icon: 'book', url: '/html/bookMinas.html' },
    { title: 'Requisições', description: 'Sistema de requisições', icon: 'assignment', url: 'https://app.powerbi.com/links/VkvtykuiEY?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare&bookmarkGuid=1b4117a2-1cf9-44a8-97d5-e00b219dfec3' }
  ],
  'go': [
    { title: 'Segurança', description: 'Opções de segurança - Goiás', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Equipamentos Hitachi Brasil', description: 'Lista de equipamentos Hitachi', icon: 'precision_manufacturing', url: '#equipamentos' },
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
    { title: 'Equipamentos Hitachi Brasil', description: 'Lista de equipamentos Hitachi', icon: 'precision_manufacturing', url: '#equipamentos' },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades no Pará', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' }
  ],
  'ba': [
    { title: 'Segurança', description: 'Opções de segurança - Bahia', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Equipamentos Hitachi Brasil', description: 'Lista de equipamentos Hitachi', icon: 'precision_manufacturing', url: '#equipamentos' },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades na Bahia', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' }
  ],
  'sc': [
    { title: 'Segurança', description: 'Opções de segurança - Santa Catarina', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Equipamentos Hitachi Brasil', description: 'Lista de equipamentos Hitachi', icon: 'precision_manufacturing', url: '#equipamentos' },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades em Santa Catarina', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' }
  ],
  'ma': [
    { title: 'Segurança', description: 'Opções de segurança - Maranhão', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Equipamentos Hitachi Brasil', description: 'Lista de equipamentos Hitachi', icon: 'precision_manufacturing', url: '#equipamentos' },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades no Maranhão', icon: 'trending_up', url: OPORTUNIDADES_VENDA_URL },
    { title: 'Literaturas Técnicas', description: 'Documentos e literaturas técnicas', icon: 'menu_book', url: LITERATURAS_TECNICAS_URL },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' }
  ]
};

// Security Data
const securityData: Record<string, {title: string; description: string; icon: string; url: string}[]> = {
  'mg': [
    { title: 'R&D', description: 'Segurança - R&D', icon: 'business', url: '#rd-security' },
    { title: 'Araxá', description: 'Segurança - Araxá', icon: 'location_city', url: '#araxa-security' },
    { title: 'Usiminas', description: 'Segurança - Usiminas', icon: 'factory', url: '#usiminas-security' }
  ],
  'mg-rd': [
    { title: 'Auditoria de EPIs', description: 'Sistema de auditoria de EPIs', icon: 'verified', url: '/html/AuditoriaEPISMinas.html' },
    { title: 'Inspeções de Segurança', description: 'Registros de inspeções', icon: 'security', url: '/html/InspeçõesSegurança.html' },
    { title: 'KPI Segurança', description: 'Indicadores de segurança', icon: 'bar_chart', url: 'https://app.powerbi.com/links/7fUFPRWu3X?ctid=8394d100-2f96-4738-9e1c-00b5e663cb6f&pbi_source=linkShare' }
  ],
  'mg-araxa': [
    { title: 'Auditoria de EPIs', description: 'Sistema de auditoria de EPIs', icon: 'verified', url: '/html/AuditoriaEPISMinas.html' },
    { title: 'Inspeções de Segurança', description: 'Registros de inspeções', icon: 'security', url: '/html/InspeçõesSegurança.html' }
  ],
  'mg-usiminas': [
    { title: 'Auditoria de EPIs', description: 'Sistema de auditoria de EPIs', icon: 'verified', url: '/html/AuditoriaEPISMinas.html' },
    { title: 'Inspeções de Segurança', description: 'Registros de inspeções', icon: 'security', url: '/html/InspeçõesSegurança.html' }
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
  'ba': [
    { title: 'Auditoria de EPIs', description: 'Sistema de auditoria de EPIs', icon: 'verified', url: '#' },
    { title: 'Inspeções de Segurança', description: 'Registros de inspeções', icon: 'security', url: '#' }
  ],
  'sc': [
    { title: 'Auditoria de EPIs', description: 'Sistema de auditoria de EPIs', icon: 'verified', url: '#' },
    { title: 'Inspeções de Segurança', description: 'Registros de inspeções', icon: 'security', url: '#' }
  ],
  'ma': [
    { title: 'Auditoria de EPIs', description: 'Sistema de auditoria de EPIs', icon: 'verified', url: '#' },
    { title: 'Inspeções de Segurança', description: 'Registros de inspeções', icon: 'security', url: '#' }
  ]
};

const stateNames: Record<string, string> = {
  'mg': 'Minas Gerais',
  'go': 'Goiás',
  'pa': 'Pará',
  'ba': 'Bahia',
  'sc': 'Santa Catarina',
  'ma': 'Maranhão',
  'mg-rd': 'R&D',
  'mg-araxa': 'Araxá'
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
    // Use setTimeout to defer state updates (avoid lint error)
    const initTimer = setTimeout(() => {
      // Detectar iOS
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOS(isIOSDevice);

      // Detectar se é mobile (Android/iOS)
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice);
    }, 0);

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
      clearTimeout(initTimer);
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
  const [showSecurityContent, setShowSecurityContent] = useState(false);
  const [counter, setCounter] = useState({ mg: { days: 0, hours: 0, minutes: 0, seconds: 0 }, go: { days: 0, hours: 0, minutes: 0, seconds: 0 } });
  const [stateCounter, setStateCounter] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  
  // Equipment states
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [allEquipmentData, setAllEquipmentData] = useState<Equipment[]>([]);
  const [equipmentFilters, setEquipmentFilters] = useState<EquipmentFilters>({ locais: [], empresas: [], clientes: [], status: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocal, setFilterLocal] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [importData, setImportData] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  // Read modal state
  const [readModalContent, setReadModalContent] = useState<{ title: string; content: string } | null>(null);
  // Organogram modal state
  const [showOrganogramModal, setShowOrganogramModal] = useState(false);

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
    setIsLoading(false);
    setLoadingProgress(0);
    setSelectedState(null);
    setActiveModal(null);
    setModalState(null);
    setShowDeveloperModal(false);
    setShowSecurityContent(false);
  };

  // Equipment functions
  const fetchEquipment = useCallback(async () => {
    try {
      const response = await fetch('/api/equipment');
      const data = await response.json();
      setAllEquipmentData(data.equipment || []);
      setEquipmentFilters(data.filters || { locais: [], empresas: [], clientes: [], status: [] });
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  }, []);

  // Fetch equipment when modal opens
  const prevShowEquipmentModal = useRef(showEquipmentModal);
  useEffect(() => {
    if (showEquipmentModal && !prevShowEquipmentModal.current) {
      const timer = setTimeout(() => {
        fetchEquipment();
      }, 0);
      prevShowEquipmentModal.current = showEquipmentModal;
      return () => clearTimeout(timer);
    }
    prevShowEquipmentModal.current = showEquipmentModal;
  }, [showEquipmentModal, fetchEquipment]);

  // Filter data locally
  const filteredEquipment = useMemo(() => {
    return allEquipmentData.filter(item => {
      const matchesSearch = !searchTerm || 
        item.equipamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.local.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.statusOperacao?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesLocal = !filterLocal || item.local === filterLocal;
      const matchesEmpresa = !filterEmpresa || item.empresa === filterEmpresa;
      const matchesCliente = !filterCliente || item.cliente === filterCliente;
      const matchesStatus = !filterStatus || item.statusOperacao === filterStatus;
      return matchesSearch && matchesLocal && matchesEmpresa && matchesCliente && matchesStatus;
    });
  }, [allEquipmentData, searchTerm, filterLocal, filterEmpresa, filterCliente, filterStatus]);

  // Sorting function
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Apply sorting
  const sortedEquipment = useMemo(() => {
    return [...filteredEquipment].sort((a, b) => {
      if (!sortColumn) return 0;
      let aValue = '';
      let bValue = '';
      switch (sortColumn) {
        case 'equipamento': aValue = a.equipamento; bValue = b.equipamento; break;
        case 'modelo': aValue = a.modelo; bValue = b.modelo; break;
        case 'cliente': aValue = a.cliente; bValue = b.cliente; break;
        case 'local': aValue = a.local; bValue = b.local; break;
        case 'empresa': aValue = a.empresa; bValue = b.empresa; break;
        case 'ano': aValue = a.ano; bValue = b.ano; break;
        case 'status': aValue = a.statusOperacao || ''; bValue = b.statusOperacao || ''; break;
      }
      const comparison = aValue.localeCompare(bValue, 'pt-BR');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredEquipment, sortColumn, sortDirection]);

  // Import equipment
  const handleImportEquipment = async () => {
    if (!importData.trim()) {
      setImportMessage({ type: 'error', text: 'Por favor, cole os dados da planilha!' });
      return;
    }
    setImportLoading(true);
    setImportMessage(null);
    try {
      const lines = importData.trim().split('\n');
      const headers = lines[0].split('\t').map(h => h.trim().toLowerCase().replace(/\s+/g, ' '));
      const data = lines.slice(1).map(line => {
        const values = line.split('\t');
        const obj: Record<string, string> = {};
        headers.forEach((header, idx) => {
          // Mapeamento de campos com variações possíveis de nomes
          const fieldMap: Record<string, string> = {
            'equipamento': 'equipamento', 
            'modelo': 'modelo', 
            'cliente': 'cliente', 
            'size': 'size',
            'local': 'local', 
            'empresa': 'empresa', 
            'ano': 'ano',
            'status de operação': 'statusOperacao', 
            'motivo stand-by/hibernação': 'motivoStandby',
            'motivo stand-by / hibernação': 'motivoStandby',
            'motivo stand-by hibernação': 'motivoStandby',
            'falhas críticas na semana': 'falhasCriticas',
            'falhas críticas na semana': 'falhasCriticas',
            'falhas criticas na semana': 'falhasCriticas',
          };
          if (fieldMap[header]) obj[fieldMap[header]] = values[idx]?.trim() || '';
        });
        return obj;
      }).filter(obj => obj.equipamento);
      
      const response = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '2026', data })
      });
      const result = await response.json();
      if (response.ok) {
        setImportMessage({ type: 'success', text: `${result.count || data.length} equipamentos importados com sucesso!` });
        setImportData('');
        fetchEquipment();
      } else {
        setImportMessage({ type: 'error', text: result.error || 'Erro ao importar dados' });
      }
    } catch (error) {
      setImportMessage({ type: 'error', text: 'Erro ao processar dados' });
    }
    setImportLoading(false);
  };

  // Delete all equipment
  const handleDeleteAllEquipment = () => setShowDeleteModal(true);
  
  const confirmDeleteAll = async () => {
    if (deletePassword !== '2026') {
      setDeleteError('Senha incorreta!');
      return;
    }
    try {
      const response = await fetch('/api/equipment?password=2026', { method: 'DELETE' });
      if (response.ok) {
        setAllEquipmentData([]);
        setEquipmentFilters({ locais: [], empresas: [], clientes: [], status: [] });
        setShowDeleteModal(false);
        setDeletePassword('');
        setDeleteError('');
      } else {
        setDeleteError('Erro ao excluir dados');
      }
    } catch (error) {
      setDeleteError('Erro ao excluir dados');
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterLocal('');
    setFilterEmpresa('');
    setFilterCliente('');
    setFilterStatus('');
    setSortColumn(null);
    setSortDirection('asc');
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
    setShowSecurityContent(false); // Reset security view when opening modal
  };

  const closeModal = () => {
    setActiveModal(null);
    setShowSecurityContent(false);
  };

  const openSecurityContent = () => {
    setShowSecurityContent(true);
  };

  const backToServices = () => {
    setShowSecurityContent(false);
  };

  const currentData = showSecurityContent 
    ? securityData[modalState || ''] 
    : (activeModal === 'services' ? servicesData[modalState || ''] : securityData[modalState || '']);

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
        
        /* Mobile marker adjustments */
        @media (max-width: 640px) {
          .marker-mg { left: 74% !important; }
          .marker-go { left: 56% !important; }
          .marker-ba { left: 69% !important; }
          .marker-sc { left: 65% !important; }
        }
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
                <source src={`/videos/${selectedState === 'mg-mosaic' ? 'Mosaic' : selectedState === 'mg' ? 'Minas' : selectedState === 'go' ? 'Goiás' : selectedState === 'pa' ? 'Pará' : selectedState === 'ba' ? 'Bahia' : selectedState === 'sc' ? 'SantaCatarina' : 'Minas'}.mp4`} type="video/mp4" />
              </video>
            )}

            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-3 sm:p-5 bg-gradient-to-b from-black/80 to-transparent z-30 flex justify-between items-center">
              <img src="/images/zamine-logo.png" alt="Zamine" className="h-8 sm:h-10 w-auto object-contain" />
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-xs text-gray-400 hidden sm:block">{currentUser?.split('@')[0]}</span>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }} 
                  className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                >
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
                  className="absolute cursor-pointer group marker-mg"
                  style={{ top: '48%', left: '66%' }}
                  onClick={() => handleMarkerClick('mg')}
                >
                  <div className="relative">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-orange-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border border-white">
                      <span className="text-white font-bold text-[8px] sm:text-[10px]">MG</span>
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Minas Gerais
                    </div>
                  </div>
                </div>

                {/* GO Marker */}
                <div 
                  className="absolute cursor-pointer group marker-go"
                  style={{ top: '41%', left: '52%' }}
                  onClick={() => handleMarkerClick('go')}
                >
                  <div className="relative">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-orange-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border border-white">
                      <span className="text-white font-bold text-[8px] sm:text-[10px]">GO</span>
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Goiás
                    </div>
                  </div>
                </div>

                {/* PA Marker */}
                <div 
                  className="absolute cursor-pointer group"
                  style={{ top: '22%', left: '37%' }}
                  onClick={() => handleMarkerClick('pa')}
                >
                  <div className="relative">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-orange-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border border-white">
                      <span className="text-white font-bold text-[8px] sm:text-[10px]">PA</span>
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Pará
                    </div>
                  </div>
                </div>

                {/* BA Marker */}
                <div 
                  className="absolute cursor-pointer group marker-ba"
                  style={{ top: '25%', left: '65%' }}
                  onClick={() => handleMarkerClick('ba')}
                >
                  <div className="relative">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-orange-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border border-white">
                      <span className="text-white font-bold text-[8px] sm:text-[10px]">BA</span>
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Bahia
                    </div>
                  </div>
                </div>

                {/* SC Marker */}
                <div 
                  className="absolute cursor-pointer group marker-sc"
                  style={{ top: '78%', left: '57%' }}
                  onClick={() => handleMarkerClick('sc')}
                >
                  <div className="relative">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-orange-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border border-white">
                      <span className="text-white font-bold text-[8px] sm:text-[10px]">SC</span>
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Santa Catarina
                    </div>
                  </div>
                </div>

                {/* MA Marker */}
                <div 
                  className="absolute cursor-pointer group"
                  style={{ top: '20%', left: '59%' }}
                  onClick={() => handleMarkerClick('ma')}
                >
                  <div className="relative">
                    <div className="w-5 h-5 sm:w-7 sm:h-7 bg-orange-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border border-white">
                      <span className="text-white font-bold text-[8px] sm:text-[10px]">MA</span>
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      Maranhão
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* State Content - Click anywhere to go back */}
            {selectedState && (
              <div 
                className="absolute inset-0 z-20 flex flex-col cursor-pointer"
                onClick={resetToInitialState}
              >
                {/* Back Button */}
                <div className="absolute top-16 left-4 z-30" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={resetToInitialState}
                    className="bg-black/50 hover:bg-black/70 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <span className="material-icons">arrow_back</span>
                    Voltar
                  </button>
                </div>

                {/* State Title */}
                <div className="pt-20 sm:pt-24 px-4 text-center" style={{ animation: 'slideIn 0.5s ease-out' }} onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 drop-shadow-lg">{stateNames[selectedState] || 'Minas Gerais'}</h2>
                </div>

                {/* Action Button - Minimalist */}
                <div className="pt-4 sm:pt-6 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openModal('services', selectedState)}
                    className="text-white/80 hover:text-white px-6 py-3 sm:px-8 sm:py-4 transition-all flex flex-col items-center gap-1 group"
                  >
                    <span className="material-icons text-3xl sm:text-4xl group-hover:scale-110 transition-transform">business_center</span>
                    <span className="text-sm sm:text-base font-medium tracking-wide">Serviços</span>
                  </button>
                </div>

                {/* Counter - Bottom Left Corner */}
                {(selectedState === 'mg' || selectedState === 'go') && (
                  <div className="absolute bottom-16 left-4 z-30 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20" onClick={(e) => e.stopPropagation()}>
                    <div className="text-white/70 text-[10px] font-medium mb-0.5">DIAS SEM AFASTAMENTO</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl sm:text-2xl font-bold text-white">{stateCounter.days}</span>
                      <span className="text-white/70 text-xs">dias</span>
                      <span className="text-white/50 text-sm ml-1">{stateCounter.hours}:{String(stateCounter.minutes).padStart(2, '0')}:{String(stateCounter.seconds).padStart(2, '0')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Services/Security Modal */}
            {activeModal && modalState && (
              <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-4" onClick={closeModal}>
                <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ animation: 'fadeIn 0.3s ease-out' }}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      {(showSecurityContent || modalState?.startsWith('mg-')) && (
                        <button 
                          onClick={() => {
                            if (showSecurityContent) {
                              backToServices();
                            }
                            if (modalState?.startsWith('mg-')) {
                              setModalState('mg');
                              setShowSecurityContent(false);
                            }
                          }}
                          className="text-gray-400 hover:text-white flex items-center gap-1"
                        >
                          <span className="material-icons">arrow_back</span>
                        </button>
                      )}
                      <h3 className="text-xl sm:text-2xl font-bold text-orange-500">
                        {showSecurityContent ? 'Segurança' : 'Serviços'} - {stateNames[modalState] || 'Minas Gerais'}
                      </h3>
                    </div>
                    <button onClick={closeModal} className="text-gray-400 hover:text-white">
                      <span className="material-icons text-2xl">close</span>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {currentData?.map((item, index) => (
                      item.url === '#' ? (
                        <button
                          key={index}
                          onClick={openSecurityContent}
                          className="bg-gray-700 hover:bg-gray-600 rounded-xl p-4 flex items-center gap-3 transition-colors group text-left w-full"
                        >
                          <span className="material-icons text-orange-500 text-2xl">{item.icon}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-white group-hover:text-orange-400 transition-colors">{item.title}</p>
                            <p className="text-gray-400 text-xs">{item.description}</p>
                          </div>
                          <span className="material-icons text-gray-500 group-hover:text-orange-500 transition-colors">arrow_forward</span>
                        </button>
                      ) : item.url === '#rd' || item.url === '#araxa' || item.url === '#usiminas' ? (
                        <button
                          key={index}
                          onClick={() => {
                            const subCategory = item.url === '#rd' ? 'mg-rd' : item.url === '#araxa' ? 'mg-araxa' : 'mg-usiminas';
                            setModalState(subCategory);
                          }}
                          className="bg-gray-700 hover:bg-gray-600 rounded-xl p-4 flex items-center gap-3 transition-colors group text-left w-full"
                        >
                          <span className="material-icons text-orange-500 text-2xl">{item.icon}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-white group-hover:text-orange-400 transition-colors">{item.title}</p>
                            <p className="text-gray-400 text-xs">{item.description}</p>
                          </div>
                          <span className="material-icons text-gray-500 group-hover:text-orange-500 transition-colors">arrow_forward</span>
                        </button>
                      ) : item.url === '#rd-security' || item.url === '#araxa-security' || item.url === '#usiminas-security' ? (
                        <button
                          key={index}
                          onClick={() => {
                            const subCategory = item.url === '#rd-security' ? 'mg-rd' : item.url === '#araxa-security' ? 'mg-araxa' : 'mg-usiminas';
                            setModalState(subCategory);
                            setShowSecurityContent(true);
                          }}
                          className="bg-gray-700 hover:bg-gray-600 rounded-xl p-4 flex items-center gap-3 transition-colors group text-left w-full"
                        >
                          <span className="material-icons text-orange-500 text-2xl">{item.icon}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-white group-hover:text-orange-400 transition-colors">{item.title}</p>
                            <p className="text-gray-400 text-xs">{item.description}</p>
                          </div>
                          <span className="material-icons text-gray-500 group-hover:text-orange-500 transition-colors">arrow_forward</span>
                        </button>
                      ) : item.url === '#equipamentos' ? (
                        <button
                          key={index}
                          onClick={() => setShowEquipmentModal(true)}
                          className="bg-gray-700 hover:bg-gray-600 rounded-xl p-4 flex items-center gap-3 transition-colors group text-left w-full"
                        >
                          <span className="material-icons text-orange-500 text-2xl">{item.icon}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-white group-hover:text-orange-400 transition-colors">{item.title}</p>
                            <p className="text-gray-400 text-xs">{item.description}</p>
                          </div>
                          <span className="material-icons text-gray-500 group-hover:text-orange-500 transition-colors">arrow_forward</span>
                        </button>
                      ) : (
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
                      )
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="absolute bottom-0 left-0 w-full p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent z-20">
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-400">
                  © 2026 Zamine Brasil
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowOrganogramModal(true)}
                    className="text-xs text-white/60 hover:text-orange-500 transition-colors"
                  >
                    Organograma
                  </button>
                  <button 
                    onClick={() => setShowDeveloperModal(true)}
                    className="text-xs text-white/60 hover:text-white transition-colors"
                  >
                    Sobre
                  </button>
                </div>
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
      
      {/* Equipment Modal - Minimalist Orange Style */}
      {showEquipmentModal && (
        <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-50" onClick={() => setShowEquipmentModal(false)}>
          <div className="w-full h-full overflow-auto bg-zinc-950" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-20 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
              <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button 
                    onClick={() => setShowEquipmentModal(false)} 
                    className="flex items-center gap-1 text-zinc-400 hover:text-orange-500 transition-colors shrink-0"
                  >
                    <span className="material-icons text-xl">arrow_back</span>
                    <span className="text-sm font-medium hidden sm:inline">Voltar</span>
                  </button>
                  <div className="h-5 sm:h-6 w-px bg-zinc-800 shrink-0"></div>
                  <img src="/images/zamine-logo.png" alt="Zamine" className="h-7 sm:h-8 shrink-0" />
                  <div className="h-5 sm:h-6 w-px bg-zinc-800 shrink-0"></div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="material-icons text-lg sm:text-xl shrink-0 text-orange-500">precision_manufacturing</span>
                    <h3 className="text-base sm:text-xl font-bold truncate text-white">Equipamentos Hitachi Brasil</h3>
                  </div>
                </div>
                <button onClick={() => setShowEquipmentModal(false)} className="text-zinc-500 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors shrink-0">
                  <span className="material-icons">close</span>
                </button>
              </div>
              {/* Action Buttons - Mobile */}
              <div className="flex items-center gap-2 mt-3 sm:hidden">
                <button onClick={() => setShowImportModal(true)} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all bg-orange-500 text-white hover:bg-orange-600">
                  <span className="material-icons text-base">upload</span> Importar
                </button>
                <button onClick={clearAllFilters} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
                  <span className="material-icons text-base">filter_alt_off</span> Limpar Filtros
                </button>
                {allEquipmentData.length > 0 && (
                  <button onClick={handleDeleteAllEquipment} className="px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20">
                    <span className="material-icons text-base">delete</span>
                  </button>
                )}
              </div>
              {/* Action Buttons - Desktop */}
              <div className="hidden sm:flex items-center gap-2 absolute top-4 right-4 sm:right-6">
                <button onClick={clearAllFilters} className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-all border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
                  <span className="material-icons text-sm">filter_alt_off</span> <span>Limpar Filtros</span>
                </button>
                <button onClick={() => setShowImportModal(true)} className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-all bg-orange-500 text-white hover:bg-orange-600">
                  <span className="material-icons text-sm">upload</span> <span>Importar</span>
                </button>
                {allEquipmentData.length > 0 && (
                  <button onClick={handleDeleteAllEquipment} className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-all border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20">
                    <span className="material-icons text-sm">delete</span> <span>Excluir</span>
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
              {/* Dashboard Analytics */}
              {allEquipmentData.length > 0 && (
                <div className="mb-6">
                  {/* Status Cards - 100% Dynamic */}
                  {(() => {
                    // Contar todos os status dinamicamente
                    const statusCounts: Record<string, number> = {};
                    allEquipmentData.forEach(eq => {
                      const status = eq.statusOperacao?.trim() || 'Sem Status';
                      statusCounts[status] = (statusCounts[status] || 0) + 1;
                    });
                    const sortedStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
                    
                    // Paleta de cores para os status (expandida)
                    const colorPalette = [
                      { bg: 'bg-green-500/10', text: 'text-green-500', hex: '#22c55e', icon: 'check_circle' },
                      { bg: 'bg-yellow-500/10', text: 'text-yellow-500', hex: '#eab308', icon: 'build' },
                      { bg: 'bg-red-500/10', text: 'text-red-500', hex: '#ef4444', icon: 'pause_circle' },
                      { bg: 'bg-purple-500/10', text: 'text-purple-500', hex: '#a855f7', icon: 'remove_circle' },
                      { bg: 'bg-blue-500/10', text: 'text-blue-500', hex: '#3b82f6', icon: 'info' },
                      { bg: 'bg-orange-500/10', text: 'text-orange-500', hex: '#f97316', icon: 'warning' },
                      { bg: 'bg-pink-500/10', text: 'text-pink-500', hex: '#ec4899', icon: 'error' },
                      { bg: 'bg-cyan-500/10', text: 'text-cyan-500', hex: '#06b6d4', icon: 'help' },
                      { bg: 'bg-zinc-500/10', text: 'text-zinc-400', hex: '#71717a', icon: 'fiber_manual_record' },
                    ];
                    
                    // Mapear cores conhecidas para status específicos
                    const statusColorMap: Record<string, number> = {
                      'Operando': 0,
                      'Manutenção': 1,
                      'Stand-by': 2,
                      'Descomissionada': 3,
                      'Sem Status': 8,
                    };
                    
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-5">
                        {/* Total Card */}
                        <div className="rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 border border-zinc-700/50 hover:border-orange-500/30 transition-all">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="material-icons text-orange-500 text-base">precision_manufacturing</span>
                            <span className="text-[10px] text-zinc-500 uppercase">Total</span>
                          </div>
                          <p className="text-2xl font-bold text-white">{allEquipmentData.length}</p>
                        </div>
                        
                        {/* Dynamic Status Cards */}
                        {sortedStatus.map(([status, count], index) => {
                          const colorIndex = statusColorMap[status] ?? (index % colorPalette.length);
                          const color = colorPalette[colorIndex];
                          return (
                            <div key={status} className={`rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 border border-zinc-700/50 hover:border-zinc-600 transition-all`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`material-icons ${color.text} text-base`}>{color.icon}</span>
                                <span className="text-[10px] text-zinc-500 uppercase truncate" title={status}>{status}</span>
                              </div>
                              <p className="text-2xl font-bold text-white">{count}</p>
                              <p className={`text-[10px] ${color.text}`}>{Math.round((count / allEquipmentData.length) * 100)}%</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                    {/* Status Donut Chart - Dynamic */}
                    <div className="rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-4 border border-zinc-700/50">
                      <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                        <span className="material-icons text-orange-500 text-sm">pie_chart</span>
                        Status de Operação
                      </h4>
                      <div className="flex items-center gap-4">
                        {/* Donut Chart */}
                        <div className="relative w-28 h-28 flex-shrink-0">
                          <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#27272a" strokeWidth="3"></circle>
                            {(() => {
                              const total = allEquipmentData.length;
                              const statusCounts: Record<string, number> = {};
                              allEquipmentData.forEach(eq => {
                                const status = eq.statusOperacao?.trim() || 'Sem Status';
                                statusCounts[status] = (statusCounts[status] || 0) + 1;
                              });
                              
                              const colorPalette = ['#22c55e', '#eab308', '#ef4444', '#a855f7', '#3b82f6', '#f97316', '#ec4899', '#06b6d4', '#71717a'];
                              const statusColorMap: Record<string, number> = {
                                'Operando': 0, 'Manutenção': 1, 'Stand-by': 2, 'Descomissionada': 3, 'Sem Status': 8,
                              };
                              
                              let offset = 0;
                              return Object.entries(statusCounts).map(([status, count], index) => {
                                const pct = total > 0 ? (count / total) * 100 : 0;
                                const colorIndex = statusColorMap[status] ?? (index % colorPalette.length);
                                const color = colorPalette[colorIndex];
                                const currentOffset = offset;
                                offset += pct;
                                return (
                                  <circle 
                                    key={status}
                                    cx="18" cy="18" r="15.5" 
                                    fill="none" 
                                    stroke={color} 
                                    strokeWidth="3" 
                                    strokeDasharray={`${pct} ${100 - pct}`} 
                                    strokeDashoffset={-currentOffset} 
                                    strokeLinecap="round" 
                                    className="transition-all duration-1000"
                                  ></circle>
                                );
                              });
                            })()}
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <span className="text-xl font-bold text-white">{allEquipmentData.length}</span>
                              <span className="text-[10px] text-zinc-500 block">total</span>
                            </div>
                          </div>
                        </div>
                        {/* Legend - Dynamic */}
                        <div className="flex-1 space-y-1.5">
                          {(() => {
                            const statusCounts: Record<string, number> = {};
                            allEquipmentData.forEach(eq => {
                              const status = eq.statusOperacao?.trim() || 'Sem Status';
                              statusCounts[status] = (statusCounts[status] || 0) + 1;
                            });
                            
                            const colorPalette = ['bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-blue-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-zinc-500'];
                            const statusColorMap: Record<string, number> = {
                              'Operando': 0, 'Manutenção': 1, 'Stand-by': 2, 'Descomissionada': 3, 'Sem Status': 8,
                            };
                            
                            return Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count], index) => {
                              const colorIndex = statusColorMap[status] ?? (index % colorPalette.length);
                              return (
                                <div key={status} className="flex items-center justify-between p-1.5 rounded bg-zinc-800/50">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colorPalette[colorIndex]}`}></div>
                                    <span className="text-[11px] text-zinc-300 truncate">{status}</span>
                                  </div>
                                  <span className="text-[11px] font-semibold text-white flex-shrink-0">{count}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Location Bar Chart - Dynamic */}
                    <div className="rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-4 border border-zinc-700/50">
                      <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                        <span className="material-icons text-orange-500 text-sm">place</span>
                        Por Local
                      </h4>
                      <div className="space-y-1.5">
                        {(() => {
                          const locationCounts: Record<string, number> = {};
                          allEquipmentData.forEach(eq => {
                            if (eq.local?.trim()) {
                              const local = eq.local.trim();
                              locationCounts[local] = (locationCounts[local] || 0) + 1;
                            }
                          });
                          const sorted = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
                          const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
                          
                          return sorted.map(([local, count]) => (
                            <div key={local} className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400 w-16 truncate flex-shrink-0" title={local}>{local}</span>
                              <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-orange-600 to-orange-500 rounded transition-all duration-700 flex items-center justify-end pr-1.5"
                                  style={{ width: `${(count / maxCount) * 100}%` }}
                                >
                                  <span className="text-[9px] font-bold text-white">{count}</span>
                                </div>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Second Row - Client & Model */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Client Distribution */}
                    <div className="rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-4 border border-zinc-700/50">
                      <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                        <span className="material-icons text-orange-500 text-sm">business</span>
                        Por Cliente
                      </h4>
                      <div className="space-y-1.5">
                        {(() => {
                          const clientCounts: Record<string, number> = {};
                          allEquipmentData.forEach(eq => {
                            if (eq.cliente?.trim()) {
                              const cliente = eq.cliente.trim();
                              clientCounts[cliente] = (clientCounts[cliente] || 0) + 1;
                            }
                          });
                          const sorted = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]);
                          const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
                          
                          return sorted.map(([cliente, count]) => (
                            <div key={cliente} className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400 w-20 truncate flex-shrink-0" title={cliente}>{cliente}</span>
                              <div className="flex-1 h-3.5 bg-zinc-800 rounded overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-zinc-600 to-zinc-500 rounded transition-all duration-700"
                                  style={{ width: `${(count / maxCount) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] font-semibold text-white w-5 text-right flex-shrink-0">{count}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Model Distribution - Dynamic */}
                    <div className="rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-4 border border-zinc-700/50">
                      <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                        <span className="material-icons text-orange-500 text-sm">category</span>
                        Por Modelo
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(() => {
                          const modelCounts: Record<string, number> = {};
                          allEquipmentData.forEach(eq => {
                            if (eq.modelo?.trim()) {
                              const modelo = eq.modelo.trim();
                              modelCounts[modelo] = (modelCounts[modelo] || 0) + 1;
                            }
                          });
                          const sorted = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
                          
                          return sorted.map(([modelo, count]) => (
                            <div key={modelo} className="bg-zinc-800/50 rounded p-2 flex items-center justify-between gap-1">
                              <span className="text-[10px] text-zinc-300 truncate" title={modelo}>{modelo}</span>
                              <span className="text-[10px] font-bold text-orange-500 flex-shrink-0">{count}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-5 border-t border-zinc-800"></div>
                </div>
              )}

              {/* Search */}
              <div className="mb-4 relative">
                <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">search</span>
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <select value={filterLocal} onChange={(e) => setFilterLocal(e.target.value)} className="px-3 py-2.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-orange-500">
                  <option value="">Local</option>
                  {equipmentFilters.locais.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} className="px-3 py-2.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-orange-500">
                  <option value="">Empresa</option>
                  {equipmentFilters.empresas.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select value={filterCliente} onChange={(e) => setFilterCliente(e.target.value)} className="px-3 py-2.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-orange-500">
                  <option value="">Cliente</option>
                  {equipmentFilters.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-orange-500">
                  <option value="">Status</option>
                  {equipmentFilters.status.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Table */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="overflow-x-auto">
                  {sortedEquipment.length === 0 ? (
                    <div className="text-center py-12">
                      <span className="material-icons text-5xl mb-4 text-zinc-700">inventory_2</span>
                      <p className="text-zinc-500">Nenhum equipamento encontrado</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-zinc-950 border-b border-zinc-800">
                        <tr>
                          <th onClick={() => handleSort('equipamento')} className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-orange-500">Equipamento {sortColumn === 'equipamento' && <span className="text-orange-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                          <th onClick={() => handleSort('modelo')} className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-orange-500">Modelo {sortColumn === 'modelo' && <span className="text-orange-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                          <th onClick={() => handleSort('cliente')} className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-orange-500 hidden sm:table-cell">Cliente {sortColumn === 'cliente' && <span className="text-orange-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase hidden md:table-cell">Size</th>
                          <th onClick={() => handleSort('local')} className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-orange-500">Local {sortColumn === 'local' && <span className="text-orange-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                          <th onClick={() => handleSort('empresa')} className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-orange-500 hidden lg:table-cell">Empresa {sortColumn === 'empresa' && <span className="text-orange-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                          <th onClick={() => handleSort('ano')} className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-orange-500">Ano {sortColumn === 'ano' && <span className="text-orange-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                          <th onClick={() => handleSort('status')} className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase cursor-pointer hover:text-orange-500">Status {sortColumn === 'status' && <span className="text-orange-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>}</th>
                          <th className="px-2 py-2 text-center text-xs font-semibold text-zinc-400 uppercase"><span className="material-icons text-sm align-middle">visibility</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {sortedEquipment.map(eq => {
                          const hasInfo = (eq.motivoStandby && eq.motivoStandby.trim()) || (eq.falhasCriticas && eq.falhasCriticas.trim());
                          
                          // Cores dinâmicas para status
                          const statusColors: Record<string, string> = {
                            'Operando': 'bg-green-500/10 text-green-400',
                            'Manutenção': 'bg-yellow-500/10 text-yellow-400',
                            'Stand-by': 'bg-red-500/10 text-red-400',
                            'Descomissionada': 'bg-purple-500/10 text-purple-400',
                          };
                          const extraColors = [
                            'bg-blue-500/10 text-blue-400',
                            'bg-orange-500/10 text-orange-400',
                            'bg-pink-500/10 text-pink-400',
                            'bg-cyan-500/10 text-cyan-400',
                            'bg-zinc-500/10 text-zinc-400',
                          ];
                          
                          let statusColorClass = statusColors[eq.statusOperacao || ''];
                          if (!statusColorClass) {
                            // Cor dinâmica baseada no hash do status
                            const hash = (eq.statusOperacao || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                            statusColorClass = extraColors[hash % extraColors.length];
                          }
                          
                          return (
                            <tr key={eq.id} className="hover:bg-zinc-800/50 transition-colors">
                              <td className="px-3 py-2 text-sm font-medium text-orange-500">{eq.equipamento}</td>
                              <td className="px-3 py-2 text-sm text-white">{eq.modelo}</td>
                              <td className="px-3 py-2 text-sm text-zinc-400 hidden sm:table-cell">{eq.cliente}</td>
                              <td className="px-3 py-2 text-sm text-zinc-400 hidden md:table-cell">{eq.size}</td>
                              <td className="px-3 py-2 text-sm text-zinc-400">{eq.local}</td>
                              <td className="px-3 py-2 text-sm text-zinc-400 hidden lg:table-cell">{eq.empresa}</td>
                              <td className="px-3 py-2 text-sm text-zinc-500">{eq.ano}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColorClass || 'text-zinc-500'}`}>{eq.statusOperacao || '-'}</span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                {hasInfo && (
                                  <button 
                                    onClick={() => setReadModalContent({ 
                                      title: eq.equipamento, 
                                      content: [
                                        eq.motivoStandby ? `📋 Motivo Stand-by:\n${eq.motivoStandby}` : '', 
                                        eq.falhasCriticas ? `⚠️ Falhas Críticas:\n${eq.falhasCriticas}` : ''
                                      ].filter(Boolean).join('\n\n') 
                                    })} 
                                    className="text-orange-500 hover:text-orange-400 p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 transition-all"
                                    title="Ver detalhes"
                                  >
                                    <span className="material-icons text-lg">visibility</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="mt-4 text-zinc-500 text-sm">Mostrando {sortedEquipment.length} de {allEquipmentData.length} equipamentos</div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-[#1a1a1a] rounded-xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Importar Planilha</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-white"><span className="material-icons">close</span></button>
            </div>
            <div className="bg-[#0d0d0d] rounded-lg p-4 mb-4 text-sm text-gray-400">
              <p className="font-medium text-white mb-2">Como importar:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copie os dados da planilha (incluindo cabeçalho)</li>
                <li>Cole no campo abaixo</li>
                <li>Clique em Importar</li>
              </ol>
            </div>
            <textarea value={importData} onChange={(e) => setImportData(e.target.value)} placeholder="Cole os dados aqui..." rows={8} className="w-full px-4 py-3 rounded-lg bg-[#0d0d0d] border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 text-xs font-mono resize-none mb-4" />
            {importMessage && <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${importMessage.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}><span className="material-icons">{importMessage.type === 'success' ? 'check' : 'error'}</span>{importMessage.text}</div>}
            <div className="flex gap-3">
              <button onClick={() => setShowImportModal(false)} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium">Cancelar</button>
              <button onClick={handleImportEquipment} disabled={importLoading} className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                {importLoading ? <><span className="material-icons animate-spin">refresh</span> Importando...</> : <><span className="material-icons">upload</span> Importar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-[#1a1a1a] rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <span className="material-icons text-5xl text-red-400">warning</span>
              <h3 className="text-lg font-bold text-white mt-2">Excluir todos os equipamentos?</h3>
              <p className="text-gray-500 text-sm mt-2">Esta ação não pode ser desfeita.</p>
            </div>
            <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Digite a senha" className="w-full px-4 py-3 rounded-lg bg-[#0d0d0d] border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 mb-2" />
            {deleteError && <p className="text-red-400 text-sm text-center mb-4">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium">Cancelar</button>
              <button onClick={confirmDeleteAll} className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Read Modal */}
      {readModalContent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[80] p-4" onClick={() => setReadModalContent(null)}>
          <div className="bg-zinc-900 rounded-xl p-5 max-w-md w-full border border-zinc-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-orange-500">{readModalContent.title}</h3>
              <button onClick={() => setReadModalContent(null)} className="text-zinc-500 hover:text-white"><span className="material-icons">close</span></button>
            </div>
            <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800">
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{readModalContent.content}</p>
            </div>
            <button onClick={() => setReadModalContent(null)} className="w-full mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors">Fechar</button>
          </div>
        </div>
      )}

      {/* Organogram Modal */}
      {showOrganogramModal && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-[90] p-4" onClick={() => setShowOrganogramModal(false)}>
          <div className="w-full max-w-6xl h-[90vh] overflow-auto bg-black rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black px-4 sm:px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowOrganogramModal(false)}
                    className="text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <span className="material-icons">arrow_back</span>
                    <span className="text-sm">Voltar</span>
                  </button>
                  <div className="h-5 w-px bg-zinc-800"></div>
                  <img src="/images/zamine-logo.png" alt="Zamine" className="h-8" />
                </div>
                <button onClick={() => setShowOrganogramModal(false)} className="text-zinc-400 hover:text-white p-2">
                  <span className="material-icons">close</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-8">
              {/* Hierarquia Topo - Julio e Wallysson */}
              <div className="flex flex-col items-center mb-8">
                {/* Julio - Topo */}
                <div className="flex flex-col items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-orange-500">
                    <img src="/colaboradores/geral/julio-sanches.jpg" alt="Julio Sanches" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-white mt-1 text-center font-medium">Julio Sanches</p>
                  <p className="text-[10px] text-orange-500">Service Manager</p>
                </div>
                
                {/* Linha vertical */}
                <div className="w-0.5 h-6 bg-zinc-700"></div>
                
                {/* Wallysson - Segundo */}
                <div className="flex flex-col items-center mt-2">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-orange-500">
                    <img src="/colaboradores/geral/wallysson-santos.jpg" alt="Wallysson Santos" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-white mt-1 text-center font-medium">Wallysson Santos</p>
                  <p className="text-[10px] text-orange-500">Service Coordinator</p>
                </div>
              </div>

              {/* Linha horizontal conectando as 3 colunas */}
              <div className="hidden md:flex justify-center mb-2">
                <div className="w-2/3 h-0.5 bg-zinc-700"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CONSULTORES */}
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-bold text-orange-500 mb-6 tracking-wide">CONSULTORES</h3>
                  <div className="flex flex-col items-center gap-4">
                    {/* Cícero */}
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-zinc-700">
                        <span className="text-sm text-zinc-400 font-medium">CC</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Cícero Carvalho</p>
                      <p className="text-[10px] text-zinc-600">Consultor</p>
                    </div>
                    {/* Warlen */}
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-zinc-700">
                        <span className="text-sm text-zinc-400 font-medium">WS</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Warlen Santos</p>
                      <p className="text-[10px] text-zinc-600">Consultor</p>
                    </div>
                    {/* Emerson */}
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/geral/emerson-araujo.jpg" alt="Emerson Alexandre" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Emerson Alexandre</p>
                      <p className="text-[10px] text-zinc-600">Field Technical Specialist</p>
                    </div>
                  </div>
                </div>

                {/* LUNDIN */}
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-bold text-orange-500 mb-6 tracking-wide">LUNDIN</h3>
                  
                  {/* Girlene e Ranielly lado a lado */}
                  <div className="flex gap-8 mb-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/girlene-nogueira.jpg" alt="Girlene Nogueira" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Girlene Nogueira</p>
                      <p className="text-[10px] text-zinc-600">Safety Technician</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/ranielly-souza.jpg" alt="Ranielly Souza" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Ranielly Souza</p>
                      <p className="text-[10px] text-zinc-600">Administrative Assistant</p>
                    </div>
                  </div>

                  {/* Tiago e Hamilton frente a frente */}
                  <div className="flex gap-8 mb-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/tiago-carvalho.jpg" alt="Tiago Carvalho" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Tiago Carvalho</p>
                      <p className="text-[10px] text-zinc-600">Sales Department</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/hamilton-junior.jpg" alt="Hamilton Junior" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Hamilton Junior</p>
                      <p className="text-[10px] text-zinc-600">Specialist Technician</p>
                    </div>
                  </div>

                  {/* Marcos e Max frente a frente */}
                  <div className="flex gap-8 mb-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/max-rufino.jpg" alt="Max Rufino" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Max Rufino</p>
                      <p className="text-[10px] text-zinc-600">Service Assistant</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/marcos-rosa.jpg" alt="Marcos Rosa" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Marcos Rosa</p>
                      <p className="text-[10px] text-zinc-600">Warehouse Assistant</p>
                    </div>
                  </div>

                  {/* Barrinha laranja */}
                  <div className="w-48 h-1 bg-orange-500 rounded-full mb-4"></div>

                  {/* Técnicos */}
                  <div className="flex gap-3 flex-wrap justify-center">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/wessley-ferreira.jpg" alt="Wessley Ferreira" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Wessley Ferreira</p>
                      <p className="text-[10px] text-zinc-600">Mechanical Technician</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/marcos-paulo.jpg" alt="Marcos Paulo" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Marcos Paulo</p>
                      <p className="text-[10px] text-zinc-600">Mechanical Technician</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/marcelo-pereira.jpg" alt="Marcelo Gonçalves" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Marcelo Gonçalves</p>
                      <p className="text-[10px] text-zinc-600">Mechanical Technician</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/higor-araujo.jpg" alt="Higor Ataides" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Higor Ataides</p>
                      <p className="text-[10px] text-zinc-600">Mechanical Technician</p>
                    </div>
                  </div>
                </div>

                {/* CMD */}
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-bold text-orange-500 mb-6 tracking-wide">CMD</h3>
                  
                  {/* Jadson acima de Rafaela */}
                  <div className="flex flex-col items-center gap-4 mb-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/jadson-reis.jpg" alt="Jadson Romano" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Jadson Romano</p>
                      <p className="text-[10px] text-zinc-600">Technical Consultant</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/geral/rafaela-miranda.jpg" alt="Rafaela Martins" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Rafaela Martins</p>
                      <p className="text-[10px] text-zinc-600">Technical Analyst</p>
                    </div>
                  </div>

                  {/* Barrinha laranja */}
                  <div className="w-32 h-1 bg-orange-500 rounded-full mb-4"></div>

                  {/* Técnicos */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/go/charles-araujo.jpg" alt="Charles Andrade" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">Charles Andrade</p>
                      <p className="text-[10px] text-zinc-600">Mechanical Technician</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                        <img src="/colaboradores/geral/jose-souza.jpg" alt="José Carlos" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 text-center">José Carlos</p>
                      <p className="text-[10px] text-zinc-600">Mechanical Technician</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

