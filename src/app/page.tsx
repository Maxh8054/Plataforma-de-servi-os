"use client";

import { useEffect, useState, useCallback } from "react";

// Types
type StateType = "mg" | "go" | "pa" | "ba" | null;
type ModalType = "services" | "security" | null;

// Comercial link
const COMERCIAL_URL = 'https://zaminebrasil.sharepoint.com/_layouts/15/sharepoint.aspx';

// Services Data - Exact copy from original
const servicesData: Record<string, {title: string; description: string; icon: string; url: string}[]> = {
  'mg': [
    { title: 'Segurança', description: 'Opções de segurança - Minas Gerais', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL },
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades em Minas Gerais', icon: 'trending_up', url: '/html/OportunidadeVendas.html' },
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
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades em Goiás', icon: 'trending_up', url: '/html/OportunidadeVendas.html' },
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
    { title: 'Oportunidades de Venda', description: 'Explore oportunidades no Pará', icon: 'trending_up', url: '/html/OportunidadeVendas.html' },
    { title: 'Criar Relatórios', description: 'Ferramenta para criação de relatórios', icon: 'create', url: 'https://z-services-ai.onrender.com/' },
    { title: 'Relatórios Técnicos', description: 'Acesse todos os relatórios técnicos', icon: 'description', url: '/html/SearchReportMinas.html' },
    { title: 'ZAB-Flow', description: 'Acesse o sistema ZAB-Flow', icon: 'account_tree', url: 'https://gestorza.onrender.com/' }
  ],
  'ba': [
    { title: 'Segurança', description: 'Opções de segurança - Bahia', icon: 'shield', url: '#' },
    { title: 'Comercial', description: 'Acesse o sistema comercial', icon: 'store', url: COMERCIAL_URL }
  ]
};

// Security Data - Exact copy from original
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

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedState, setSelectedState] = useState<StateType>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalState, setModalState] = useState<StateType>(null);
  const [showDeveloperModal, setShowDeveloperModal] = useState(false);
  const [counter, setCounter] = useState({ mg: { days: 0, hours: 0, minutes: 0, seconds: 0 }, go: { days: 0, hours: 0, minutes: 0, seconds: 0 } });
  const [stateCounter, setStateCounter] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Loading animation
  useEffect(() => {
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
  }, []);

  // Counter calculations
  useEffect(() => {
    const updateCounters = () => {
      const now = new Date();
      
      // MG Counter (from 2024-07-11)
      const mgStart = new Date('2024-07-11');
      const mgDiff = now.getTime() - mgStart.getTime();
      const mgDays = Math.floor(mgDiff / (1000 * 60 * 60 * 24));
      const mgHours = Math.floor((mgDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mgMinutes = Math.floor((mgDiff % (1000 * 60 * 60)) / (1000 * 60));
      const mgSeconds = Math.floor((mgDiff % (1000 * 60)) / 1000);
      
      // GO Counter (from 2022-08-01)
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

      // State counter for selected state
      if (selectedState === 'mg' || selectedState === 'mg-mosaic') {
        setStateCounter({ days: mgDays, hours: mgHours, minutes: mgMinutes, seconds: mgSeconds });
      } else if (selectedState === 'go') {
        setStateCounter({ days: goDays, hours: goHours, minutes: goMinutes, seconds: goSeconds });
      }
    };

    updateCounters();
    const interval = setInterval(updateCounters, 1000);
    return () => clearInterval(interval);
  }, [selectedState]);

  const handleMarkerClick = (state: StateType) => {
    setSelectedState(state);
  };

  const resetToInitialState = useCallback(() => {
    setSelectedState(null);
    setActiveModal(null);
    setModalState(null);
  }, []);

  const openModal = (type: ModalType, state: StateType) => {
    setActiveModal(type);
    setModalState(state);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const handleItemClick = (item: {title: string; url: string}, type: ModalType, state: StateType) => {
    if (type === 'services' && item.title === 'Segurança') {
      closeModal();
      setTimeout(() => openModal('security', state), 300);
    } else if (item.url !== '#') {
      window.open(item.url, '_blank');
    }
  };

  const currentData = activeModal === 'services' ? servicesData[modalState || ''] : securityData[modalState || ''];

  // Loading Screen
  if (isLoading) {
    return (
      <>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <style jsx global>{`
          @keyframes loading {
            0% { width: 0%; }
            100% { width: 100%; }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.5; }
          }
        `}</style>
        <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col z-[9999]">
          <div className="flex flex-grow h-full">
            <div 
              className="flex-1 relative overflow-hidden bg-cover bg-center"
              style={{ backgroundImage: "url('https://sfile.chatglm.cn/images-ppt/2c65e9f35b39.jpg')" }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-black/70"></div>
            </div>
            <div 
              className="flex-1 relative overflow-hidden bg-cover bg-center"
              style={{ backgroundImage: "url('https://sfile.chatglm.cn/images-ppt/149e36ab0f04.jpg')" }}
            >
              <div className="absolute inset-0 bg-gradient-to-l from-blue-600/20 to-black/70"></div>
            </div>
          </div>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-full bg-gradient-to-b from-transparent via-orange-500 to-transparent z-[5]"></div>

          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
            <img src="/images/zamine-logo.png" alt="ZAMINE" className="h-14 sm:h-16 md:h-20 w-auto object-contain" style={{ filter: 'drop-shadow(0 0 10px rgba(255,102,0,0.7))' }} />
          </div>

          <div className="absolute top-3 left-3 text-lg font-bold text-orange-500 z-10">
            HITACHI
          </div>

          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-[80%] max-w-[800px] z-10">
            <div className="h-3 bg-white/20 rounded-full overflow-visible relative">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full relative transition-all duration-100"
                style={{ width: `${loadingProgress}%` }}
              >
                <div 
                  className="absolute -top-20 -right-20 w-44 h-44 bg-contain bg-no-repeat bg-center"
                  style={{ backgroundImage: "url('https://sfile.chatglm.cn/images-ppt/939ddf9ede7b.png')" }}
                ></div>
              </div>
            </div>
            <div className="text-center mt-5 text-xl font-semibold text-orange-400 uppercase tracking-wider">
              CARREGANDO SISTEMA
            </div>
            <div className="flex justify-center mt-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div 
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-orange-500"
                  style={{ animation: 'pulse 1.5s infinite ease-in-out', animationDelay: `${i * 0.3}s` }}
                ></div>
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
        @keyframes slideIn {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        body { font-family: 'Source Sans Pro', sans-serif; overflow: hidden; }
      `}</style>

      <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
        {/* Background Image */}
        <div 
          className="fixed inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/Fundo.jpg')" }}
        ></div>

        {/* Fullscreen Map */}
        <div className="fixed inset-0 z-10 flex flex-col">
          <div className="flex-grow relative w-full h-full">
            {/* Main Map Video */}
            <video 
              autoPlay 
              muted 
              loop
              playsInline
              className="w-full h-full object-cover pointer-events-none"
              style={{ pointerEvents: 'none' }}
            >
              <source src="/videos/Mapa.mp4" type="video/mp4" />
            </video>

            {/* State Video Overlay */}
            {selectedState && (
              <video 
                autoPlay 
                muted 
                loop 
                playsInline
                className="absolute inset-0 w-full h-full object-cover z-15 transition-opacity duration-1000 pointer-events-none"
                style={{ opacity: 1, pointerEvents: 'none' }}
              >
                <source src={`/videos/${selectedState === 'mg-mosaic' ? 'Mosaic' : selectedState === 'mg' ? 'Minas' : selectedState === 'go' ? 'Goiás' : selectedState === 'pa' ? 'Pará' : 'Bahia'}.mp4`} type="video/mp4" />
              </video>
            )}

            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-3 sm:p-5 bg-gradient-to-b from-black/80 to-transparent z-20 flex justify-between items-center">
              <img src="/images/zamine-logo.png" alt="Zamine" className="h-8 sm:h-10 w-auto object-contain" />
              <div className="flex items-center gap-2 sm:gap-4">
                <button 
                  onClick={() => setShowDeveloperModal(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors"
                >
                  Sobre
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 w-full p-3 sm:p-5 bg-gradient-to-t from-black/80 to-transparent z-20 text-center">
              <p className="text-xs sm:text-sm text-gray-300">Clique nos marcadores para explorar as operações</p>
            </div>

            {/* Markers - Touch friendly para mobile */}
            {/* MG - Mosaic */}
            <div
              className={`absolute cursor-pointer z-30 transition-all duration-300 touch-manipulation ${selectedState === 'mg-mosaic' ? 'scale-125 opacity-100' : selectedState ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95'}`}
              style={{ top: '45%', left: '60%' }}
              onClick={() => handleMarkerClick('mg-mosaic')}
            >
              <div className="flex flex-col items-center p-2">
                <span className="text-white text-[10px] sm:text-xs font-bold mb-1 text-center">MG</span>
                <span className="text-orange-500 text-[10px] sm:text-xs mb-1 text-center">Mosaic</span>
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-lg transition-all ${selectedState === 'mg-mosaic' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
              </div>
            </div>

            {/* MG - R&D */}
            <div
              className={`absolute cursor-pointer z-30 transition-all duration-300 touch-manipulation ${selectedState === 'mg' ? 'scale-125 opacity-100' : selectedState ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95'}`}
              style={{ top: '40%', left: '63%' }}
              onClick={() => handleMarkerClick('mg')}
            >
              <div className="flex flex-col items-center p-2">
                <span className="text-white text-[10px] sm:text-xs font-bold mb-1 text-center">MG</span>
                <span className="text-orange-500 text-[10px] sm:text-xs mb-1 text-center">R&D</span>
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-lg transition-all ${selectedState === 'mg' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
              </div>
            </div>

            {/* GO - Lundin */}
            <div
              className={`absolute cursor-pointer z-30 transition-all duration-300 touch-manipulation ${selectedState === 'go' ? 'scale-125 opacity-100' : selectedState ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95'}`}
              style={{ top: '35%', left: '52%' }}
              onClick={() => handleMarkerClick('go')}
            >
              <div className="flex flex-col items-center p-2">
                <span className="text-white text-[10px] sm:text-xs font-bold mb-1 text-center">GO</span>
                <span className="text-orange-500 text-[10px] sm:text-xs mb-1 text-center">Lundin</span>
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-lg transition-all ${selectedState === 'go' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
              </div>
            </div>

            {/* PA - U&M */}
            <div
              className={`absolute cursor-pointer z-30 transition-all duration-300 touch-manipulation ${selectedState === 'pa' ? 'scale-125 opacity-100' : selectedState ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95'}`}
              style={{ top: '15%', left: '48%' }}
              onClick={() => handleMarkerClick('pa')}
            >
              <div className="flex flex-col items-center p-2">
                <span className="text-white text-[10px] sm:text-xs font-bold mb-1 text-center">PA</span>
                <span className="text-orange-500 text-[10px] sm:text-xs mb-1 text-center">U&M</span>
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-lg transition-all ${selectedState === 'pa' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
              </div>
            </div>

            {/* BA - Atlantic Nickel */}
            <div
              className={`absolute cursor-pointer z-30 transition-all duration-300 touch-manipulation ${selectedState === 'ba' ? 'scale-125 opacity-100' : selectedState ? 'opacity-0 pointer-events-none' : 'hover:scale-110 active:scale-95'}`}
              style={{ top: '20%', left: '59%' }}
              onClick={() => handleMarkerClick('ba')}
            >
              <div className="flex flex-col items-center p-2">
                <span className="text-white text-[10px] sm:text-xs font-bold mb-1 text-center">BA</span>
                <span className="text-orange-500 text-[10px] sm:text-xs mb-1 text-center">Atlantic Nickel</span>
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-lg transition-all ${selectedState === 'ba' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
              </div>
            </div>

            {/* State Cards Overlay */}
            {selectedState && (
              <div 
                className="absolute inset-0 z-40 flex flex-col justify-start p-3 sm:p-5 pointer-events-auto cursor-pointer"
                style={{ animation: 'fadeIn 0.5s ease forwards' }}
                onClick={resetToInitialState}
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); resetToInitialState(); }}
                  className="absolute top-3 right-3 sm:top-5 sm:right-5 bg-black/70 border-none rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer transition-all hover:bg-orange-500/70 hover:rotate-90 z-50 pointer-events-auto"
                >
                  <span className="material-icons text-white text-lg sm:text-xl">close</span>
                </button>

                <div 
                  className="flex justify-center max-w-5xl mx-auto pointer-events-auto mt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-black/80 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-orange-500/30 cursor-default mx-2">
                    <h3 className="text-base sm:text-lg font-semibold text-orange-500 mb-3 sm:mb-4 text-center">
                      {selectedState === 'mg-mosaic' ? 'Minas Gerais - Mosaic' : selectedState === 'mg' ? 'Minas Gerais - R&D' : stateNames[selectedState || '']}
                    </h3>
                    <div className="flex gap-3 sm:gap-4">
                      <div 
                        onClick={(e) => { e.stopPropagation(); openModal('services', selectedState === 'mg-mosaic' ? 'mg' : selectedState); }}
                        className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 sm:p-4 flex flex-col items-center min-w-[100px] sm:min-w-[120px] cursor-pointer hover:bg-orange-500/30 active:scale-95 hover:scale-105 transition-all"
                      >
                        <span className="material-icons text-orange-500 text-xl sm:text-2xl mb-1">settings</span>
                        <span className="text-xs sm:text-sm text-white">Serviços</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Counter */}
                {(selectedState === 'mg' || selectedState === 'mg-mosaic' || selectedState === 'go') && (
                  <div 
                    className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 bg-black/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 pointer-events-auto cursor-default mx-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-xs sm:text-base font-semibold text-orange-500 mb-1">
                      Operando em {selectedState === 'go' ? 'Goiás' : 'Minas'} sem acidentes há:
                    </h3>
                    <div className="text-xs sm:text-sm text-white">
                      <span className="font-mono">{stateCounter.days}</span> dias{" "}
                      <span className="font-mono">{stateCounter.hours}</span>h{" "}
                      <span className="font-mono">{stateCounter.minutes}</span>m{" "}
                      <span className="font-mono">{stateCounter.seconds}</span>s
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Services Modal */}
        {activeModal && (
          <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-3 sm:p-0">
            <div 
              className="bg-[#1a1a1a] rounded-2xl w-full sm:w-[90%] max-w-[600px] max-h-[90vh] sm:max-h-[80vh] overflow-y-auto shadow-2xl"
              style={{ animation: 'slideIn 0.3s ease forwards' }}
            >
              <div className="p-3 sm:p-5 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-[#1a1a1a] z-10">
                <h2 className="text-lg sm:text-2xl font-semibold text-orange-500 flex items-center gap-2">
                  <span className="material-icons text-2xl sm:text-3xl">{activeModal === 'services' ? 'settings' : 'shield'}</span>
                  <span className="hidden sm:inline">{activeModal === 'services' ? 'Serviços' : 'Segurança'} - {modalState ? stateNames[modalState] : ''}</span>
                  <span className="sm:hidden">{activeModal === 'services' ? 'Serviços' : 'Segurança'}</span>
                </h2>
                <button 
                  onClick={closeModal}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white hover:bg-orange-500/20 hover:text-orange-500 hover:rotate-90 transition-all"
                >
                  <span className="material-icons text-2xl sm:text-3xl">close</span>
                </button>
              </div>
              <div className="p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {currentData && currentData.length > 0 ? (
                  currentData.map((item, i) => (
                    <a 
                      key={i}
                      href={item.url === '#' ? '#' : item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (item.title === 'Segurança') {
                          e.preventDefault();
                          closeModal();
                          setTimeout(() => openModal('security', modalState), 300);
                        }
                      }}
                      className="bg-white/5 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-orange-500/20 active:scale-98 hover:-translate-y-1 transition-all no-underline text-inherit"
                      style={{ animation: `slideIn 0.3s ease forwards`, animationDelay: `${(i + 1) * 0.1}s` }}
                    >
                      <span className="material-icons text-orange-500 text-xl sm:text-2xl flex-shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm sm:text-base">{item.title}</div>
                        <div className="text-xs sm:text-sm text-gray-400 truncate">{item.description}</div>
                      </div>
                      <span className="material-icons text-orange-500 text-lg sm:text-xl flex-shrink-0">arrow_forward</span>
                    </a>
                  ))
                ) : (
                  <div className="col-span-2 text-center p-6 sm:p-8 text-gray-400 italic text-sm sm:text-base">
                    Nenhum serviço disponível para esta região.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
      </div>
    </>
  );
}
