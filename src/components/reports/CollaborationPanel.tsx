'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Share2, Users, Copy, Check, QrCode, Edit, Eye, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface CollaborationPanelProps {
  reportData: any;
  reportType: 'home' | 'inspecao';
  onDataRequest?: () => any;
  t: (key: string, params?: Record<string, string | number>) => string;
  mobile?: boolean;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function CollaborationPanel({
  reportData,
  reportType,
  onDataRequest,
  t,
  mobile = false,
  externalOpen,
  onExternalOpenChange,
}: CollaborationPanelProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [internalShowDialog, setInternalShowDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [permission, setPermission] = useState<'edit' | 'view'>('view');
  const [isCreating, setIsCreating] = useState(false);

  // Use external state if provided, otherwise use internal state
  const showDialog = externalOpen !== undefined ? externalOpen : internalShowDialog;
  const setShowDialog = onExternalOpenChange || setInternalShowDialog;

  // Handle external open changes
  useEffect(() => {
    if (externalOpen === true && !sessionUrl) {
      // Reset state when dialog opens externally
      setSessionUrl(null);
      setSessionId(null);
    }
  }, [externalOpen, sessionUrl]);

  const handleCreateSession = useCallback(async () => {
    if (!session) {
      alert('Faça login para compartilhar');
      return;
    }

    setIsCreating(true);
    const data = onDataRequest ? onDataRequest() : reportData;

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reportType,
          permission,
          data,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSessionUrl(result.shareLink);
        setSessionId(result.sessionId);
        
        // IMPORTANTE: Entrar automaticamente na sessão compartilhada
        // Isso ativa a sincronização em tempo real para o criador também
        localStorage.setItem('activeSharedSession', JSON.stringify({
          sessionId: result.sessionId,
          permission: 'edit', // Criador sempre tem permissão de edição
          creatorName: session?.user?.name || 'Você',
          reportType,
        }));
        
        // Disparar evento para notificar a página principal
        window.dispatchEvent(new CustomEvent('sharedSessionCreated', {
          detail: {
            sessionId: result.sessionId,
            permission: 'edit',
            creatorName: session?.user?.name || 'Você',
            reportType,
          }
        }));
        
        // Não recarregar a página - a sincronização vai ativar automaticamente
        // via evento customizado
      } else {
        alert(result.error || 'Erro ao criar sessão');
      }
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Erro ao criar sessão');
    } finally {
      setIsCreating(false);
    }
  }, [session, reportData, reportType, permission, onDataRequest]);

  const handleCopyLink = useCallback(() => {
    if (sessionUrl) {
      navigator.clipboard.writeText(sessionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [sessionUrl]);

  const handleShare = useCallback(async () => {
    setShowDialog(true);
  }, [setShowDialog]);

  return (
    <>
      {/* Share Button */}
      <Button
        size="icon"
        className={`rounded-full bg-orange-500 hover:bg-orange-600 ${mobile ? 'h-11 w-11' : ''}`}
        onClick={handleShare}
        disabled={isCreating}
        title={t('collaboration.share') || 'Compartilhar'}
      >
        {isCreating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Share2 className="h-5 w-5" />
        )}
      </Button>

      {/* Share Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              {t('collaboration.title') || 'Compartilhar Relatório'}
            </DialogTitle>
            <DialogDescription>
              {t('collaboration.description') || 'Escolha a permissão e compartilhe o link.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Permission Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Permissão de acesso:</Label>
              <RadioGroup 
                value={permission} 
                onValueChange={(v) => setPermission(v as 'edit' | 'view')}
                className="grid grid-cols-2 gap-3"
              >
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="view" id="view" />
                  <Label htmlFor="view" className="cursor-pointer flex items-center gap-2">
                    <Eye className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium">Visualizar</p>
                      <p className="text-xs text-gray-500">Apenas ver</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="edit" id="edit" />
                  <Label htmlFor="edit" className="cursor-pointer flex items-center gap-2">
                    <Edit className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="font-medium">Editar</p>
                      <p className="text-xs text-gray-500">Pode modificar</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Link */}
            {sessionUrl && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('collaboration.link') || 'Link'}</label>
                <div className="flex gap-2">
                  <Input value={sessionUrl} readOnly className="flex-1 text-sm" />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* QR Code placeholder */}
            <div className="border rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50">
              <QrCode className="h-16 w-16 text-gray-300 mb-2" />
              <p className="text-xs text-gray-500">{t('collaboration.scanQR') || 'Escaneie para acessar'}</p>
            </div>

            {/* Info */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <p className="font-medium mb-1">{t('collaboration.info') || 'Info:'}</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Link expira em 24 horas</li>
                <li>Requer login para acessar</li>
                <li>
                  {permission === 'edit' 
                    ? 'Usuários podem editar o relatório' 
                    : 'Usuários podem apenas visualizar'}
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="w-full sm:w-auto">
              {t('action.close') || 'Fechar'}
            </Button>
            {!sessionUrl && (
              <Button 
                className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto"
                onClick={handleCreateSession}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Gerar Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Indicador de status online/offline
export function OnlineStatusIndicator() {
  return (
    <Badge className="bg-green-500 text-white text-xs">
      Online
    </Badge>
  );
}

// Hook para controlar o diálogo de compartilhamento externamente
export function useShareDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const openDialog = useCallback(() => setIsOpen(true), []);
  const closeDialog = useCallback(() => setIsOpen(false), []);
  return { isOpen, setIsOpen, openDialog, closeDialog };
}
