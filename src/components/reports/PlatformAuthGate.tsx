'use client';

import React, { useEffect, useRef, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2, CloudOff } from 'lucide-react';

/**
 * Substitui definitivamente o LoginPage do Z-Services AI.
 *
 * LOGIN ÚNICO: o Criar Relatórios agora usa exatamente o mesmo login da
 * plataforma Zamine. Este componente pega o token de sessão da plataforma
 * (localStorage 'zamine_token'), valida no servidor via NextAuth e autentica
 * o usuário automaticamente — sem pedir email/senha de novo.
 *
 * Estados:
 *  - Sem token da plataforma  → tela pedindo login na página inicial
 *  - Token inválido/expirado  → tela pedindo novo login na página inicial
 *  - Token válido             → signIn automático + onSuccess()
 */
export function PlatformAuthGate({ onSuccess }: { onSuccess: () => void }) {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<'no-session' | 'expired' | null>(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const authenticate = async () => {
      const platformToken = typeof window !== 'undefined' ? localStorage.getItem('zamine_token') : null;

      if (!platformToken) {
        setError('no-session');
        setChecking(false);
        return;
      }

      try {
        const result = await signIn('credentials', {
          zamineToken: platformToken,
          redirect: false,
        });

        if (result?.error) {
          // Token da plataforma inválido/expirado — limpa sessão antiga do NextAuth
          await signOut({ redirect: false }).catch(() => {});
          setError('expired');
          setChecking(false);
        } else {
          onSuccess();
        }
      } catch {
        setError('expired');
        setChecking(false);
      }
    };

    authenticate();
  }, [onSuccess]);

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
        <p className="text-white/70 text-sm">Autenticando com o login da plataforma...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
          <CloudOff className="h-7 w-7 text-orange-500" />
        </div>
        <h1 className="text-white text-xl font-semibold mb-2">
          {error === 'no-session' ? 'Faça login na plataforma' : 'Sessão expirada'}
        </h1>
        <p className="text-white/60 text-sm mb-6">
          {error === 'no-session'
            ? 'O Criar Relatórios usa o mesmo login da plataforma Zamine. Entre com a sua conta na página inicial para continuar.'
            : 'Seu acesso da plataforma expirou. Volte à página inicial e faça login novamente para continuar de onde parou.'}
        </p>
        <Button
          className="bg-orange-500 hover:bg-orange-600 text-white w-full min-h-[44px]"
          onClick={() => { window.location.href = '/'; }}
        >
          <LogIn className="h-4 w-4 mr-2" />
          Ir para o login da plataforma
        </Button>
      </div>
    </div>
  );
}

/**
 * Garante que a sessão do relatórios só exista SE o usuário estiver logado
 * na plataforma. Se o logout da plataforma acontecer em outra aba (token
 * removido do localStorage), derruba a sessão do NextAuth na próxima carga.
 */
export function RequirePlatformToken() {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && !localStorage.getItem('zamine_token')) {
      signOut({ redirect: false })
        .catch(() => {})
        .finally(() => window.location.reload());
    }
  }, [status]);

  return null;
}
