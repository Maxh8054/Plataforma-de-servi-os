'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Users, Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface SessionData {
  inspection: any;
  categories: any[];
  conclusion?: string;
}

export default function ReportPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { data: session, status } = useSession();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const loadSession = async () => {
    console.log(`[Report Page] Loading session ${sessionId}...`);
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', sessionId }),
      });

      const result = await response.json();
      console.log('[Report Page] Session result:', result);

      if (result.success) {
        setSessionData(result.data);
        setUserCount(result.userCount || 1);
        setLoading(false);
      } else {
        setError(result.error || 'Sessão não encontrada ou expirada');
        setLoading(false);
      }
    } catch (err) {
      console.error('[Report Page] Error loading session:', err);
      setError('Erro ao carregar sessão');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      // Use a flag to avoid setState on unmounted component
      let isMounted = true;
      
      const fetchSession = async () => {
        console.log(`[Report Page] Loading session ${sessionId}...`);
        
        try {
          const response = await fetch('/api/collaboration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', sessionId }),
          });

          const result = await response.json();
          console.log('[Report Page] Session result:', result);

          if (isMounted) {
            if (result.success) {
              setSessionData(result.data);
              setUserCount(result.userCount || 1);
            } else {
              setError(result.error || 'Sessão não encontrada ou expirada');
            }
            setLoading(false);
          }
        } catch (err) {
          console.error('[Report Page] Error loading session:', err);
          if (isMounted) {
            setError('Erro ao carregar sessão');
            setLoading(false);
          }
        }
      };
      
      fetchSession();
      
      return () => {
        isMounted = false;
      };
    }
  }, [sessionId]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    loadSession();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Carregando sessão...</p>
          <p className="text-sm text-gray-400 mt-2">ID: {sessionId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sessão Não Encontrada</h2>
            <p className="text-gray-600 mb-2">{error}</p>
            <p className="text-sm text-gray-500 mb-4">
              O link pode ter expirado ou a sessão não existe mais.
            </p>
            <p className="text-xs text-gray-400 mb-4 font-mono">
              ID: {sessionId}
            </p>
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline"
                onClick={handleRetry}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button 
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => window.location.href = '/'}
              >
                Ir para Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">
              Colaboração em Tempo Real
            </h1>
            <Badge className="bg-green-500 text-white">
              <Wifi className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium">
              {userCount} usuário(s) online
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {sessionData ? (
          <div className="space-y-4">
            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  Sessão Compartilhada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">ID da Sessão:</p>
                    <p className="font-mono">{sessionId}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status:</p>
                    <p className="font-medium text-green-600">Ativa</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Data Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Dados do Relatório</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm max-h-96">
                  {JSON.stringify(sessionData, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => window.location.href = '/'}
              >
                Abrir no Editor
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              Aguardando dados da sessão...
              <Button 
                variant="link" 
                onClick={handleRetry}
                className="ml-2"
              >
                Atualizar
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
