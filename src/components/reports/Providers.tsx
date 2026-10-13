'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // NextAuth do app de relatórios montado em /api/reports/auth (rota da plataforma /api/auth já existe)
  return <SessionProvider basePath="/api/reports/auth">{children}</SessionProvider>;
}
