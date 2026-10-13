'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface CollaborationOptions {
  sessionId: string | null;
  userId: string;
  onRemoteUpdate?: (updates: any, userId: string) => void;
  onRemoteFieldUpdate?: (field: string, value: any, userId: string) => void;
  onUserJoined?: (userId: string, userCount: number) => void;
  onUserLeft?: (userId: string, userCount: number) => void;
  onSessionJoined?: (data: any, userCount: number) => void;
}

interface CollaborationState {
  isConnected: boolean;
  isConnecting: boolean;
  userCount: number;
  sessionId: string | null;
  error: string | null;
}

// Intervalo de polling (2 segundos)
const POLL_INTERVAL = 2000;

export function useCollaboration(options: CollaborationOptions) {
  const {
    sessionId,
    userId,
    onRemoteUpdate,
    onRemoteFieldUpdate,
    onUserJoined,
    onUserLeft,
    onSessionJoined,
  } = options;

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    isConnecting: false,
    userCount: 0,
    sessionId: null,
    error: null,
  });

  // Conectar usando polling HTTP
  const connect = useCallback(async (initialData?: any) => {
    if (!sessionId) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Entrar na sessão
      const response = await fetch('/api/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          sessionId,
          userId,
          initialData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          userCount: data.userCount,
          sessionId: data.sessionId,
        }));

        if (onSessionJoined) {
          onSessionJoined(data.data, data.userCount);
        }

        // Iniciar polling para atualizações
        pollingRef.current = setInterval(async () => {
          try {
            const pollResponse = await fetch('/api/collaboration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'poll',
                sessionId,
                userId,
                lastUpdate: lastUpdateRef.current,
              }),
            });

            const pollData = await pollResponse.json();

            if (pollData.success && pollData.updates) {
              lastUpdateRef.current = pollData.timestamp;

              // Processar atualizações
              pollData.updates.forEach((update: any) => {
                if (update.userId !== userId) {
                  if (update.type === 'full' && onRemoteUpdate) {
                    onRemoteUpdate(update.data, update.userId);
                  } else if (update.type === 'field' && onRemoteFieldUpdate) {
                    onRemoteFieldUpdate(update.field, update.value, update.userId);
                  }
                }
              });

              // Atualizar contagem de usuários
              if (pollData.userCount !== state.userCount) {
                setState(prev => ({ ...prev, userCount: pollData.userCount }));
              }
            }
          } catch (error) {
            console.error('Polling error:', error);
          }
        }, POLL_INTERVAL);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'Falha ao conectar',
      }));
      console.error('Connection error:', error);
    }
  }, [sessionId, userId, onRemoteUpdate, onRemoteFieldUpdate, onUserJoined, onUserLeft, onSessionJoined, state.userCount]);

  // Desconectar
  const disconnect = useCallback(async () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    try {
      await fetch('/api/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave',
          sessionId,
          userId,
        }),
      });
    } catch (error) {
      console.error('Leave error:', error);
    }

    setState({
      isConnected: false,
      isConnecting: false,
      userCount: 0,
      sessionId: null,
      error: null,
    });
  }, [sessionId, userId]);

  // Enviar atualização completa
  const sendUpdate = useCallback(async (updates: any) => {
    if (!sessionId || !state.isConnected) return;

    try {
      await fetch('/api/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          sessionId,
          userId,
          type: 'full',
          data: updates,
          timestamp: Date.now(),
        }),
      });
      lastUpdateRef.current = Date.now();
    } catch (error) {
      console.error('Send update error:', error);
    }
  }, [sessionId, userId, state.isConnected]);

  // Enviar atualização de campo específico
  const sendFieldUpdate = useCallback(async (field: string, value: any) => {
    if (!sessionId || !state.isConnected) return;

    try {
      await fetch('/api/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          sessionId,
          userId,
          type: 'field',
          field,
          value,
          timestamp: Date.now(),
        }),
      });
      lastUpdateRef.current = Date.now();
    } catch (error) {
      console.error('Send field update error:', error);
    }
  }, [sessionId, userId, state.isConnected]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    sendUpdate,
    sendFieldUpdate,
  };
}

// Hook para gerenciar sessões de colaboração
export function useCollaborationSession() {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createSession = useCallback(async (data: any): Promise<string | null> => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', data }),
      });

      const result = await response.json();

      if (result.success) {
        setShareLink(result.shareLink);
        return result.sessionId;
      }

      return null;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const getSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch('/api/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', sessionId }),
      });

      return await response.json();
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await fetch('/api/collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', sessionId }),
      });
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, []);

  return {
    shareLink,
    isCreating,
    createSession,
    getSession,
    deleteSession,
  };
}
