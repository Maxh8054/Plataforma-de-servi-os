"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function UpdateScreen() {
  const handleUpdate = () => {
    // Clear service worker cache and reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.unregister());
      });
    }
    // Force full page reload (bypass cache)
    window.location.href = '/?v=' + Date.now();
  };

  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center px-4">
      <div className="text-center max-w-sm space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-blue-500/15 flex items-center justify-center border border-blue-500/20">
          <RefreshCw className="w-10 h-10 text-blue-400 animate-spin" style={{ animationDuration: '2s' }} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Atualizacao Disponivel</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Uma nova versao do sistema foi lancada. Atualize para ter acesso as ultimas funcionalidades e correcoes.
          </p>
        </div>

        <Button
          onClick={handleUpdate}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold h-12 text-base transition-all rounded-xl shadow-lg shadow-blue-600/30"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          Atualizar Agora
        </Button>

        <p className="text-white/30 text-xs">
          Seu trabalho nao sera perdido apos a atualizacao.
        </p>
      </div>
    </div>
  );
}