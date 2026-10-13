'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  ExternalLink, 
  Clock, 
  Eye, 
  Edit, 
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface SharedSessionItem {
  sessionId: string;
  creatorName: string;
  reportType: string;
  permission: string;
  createdAt: string;
  expiresAt: string;
}

export function SharedTab() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<SharedSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/share?action=list');
      const result = await response.json();

      if (result.success) {
        setSessions(result.sessions);
      } else {
        setError(result.error || 'Erro ao carregar');
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Erro ao carregar sessões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadSessions();
    }
  }, [session]);

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Tem certeza que deseja excluir este compartilhamento?')) return;

    try {
      await fetch(`/api/share?sessionId=${sessionId}`, { method: 'DELETE' });
      loadSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const handleOpen = (sessionId: string) => {
    window.open(`/share/${sessionId}`, '_blank');
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500">Faça login para ver relatórios compartilhados</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-red-300 mb-4" />
        <p className="text-gray-500 mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={loadSessions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Share2 className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500">Nenhum relatório compartilhado</p>
        <p className="text-sm text-gray-400 mt-1">
          Relatórios compartilhados aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {sessions.length} relatório(s) compartilhado(s)
        </p>
        <Button variant="ghost" size="sm" onClick={loadSessions}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.map((item) => (
          <Card key={item.sessionId} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      className={item.reportType === 'home' ? 'bg-orange-500' : 'bg-green-500'}
                    >
                      {item.reportType === 'home' ? 'Relatório' : 'Inspeção'}
                    </Badge>
                    <Badge 
                      variant="outline"
                      className={item.permission === 'edit' ? 'text-green-600 border-green-300' : 'text-blue-600 border-blue-300'}
                    >
                      {item.permission === 'edit' ? (
                        <><Edit className="h-3 w-3 mr-1" /> Editar</>
                      ) : (
                        <><Eye className="h-3 w-3 mr-1" /> Ver</>
                      )}
                    </Badge>
                  </div>
                  
                  <p className="font-medium text-sm mb-1">
                    Compartilhado por {item.creatorName}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expira: {new Date(item.expiresAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleOpen(item.sessionId)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(item.sessionId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
