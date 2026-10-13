'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useSharedReportStore } from '@/store/sharedReportStore';
import { useCollaboration } from '@/hooks/useCollaboration';
import { useTranslation } from '@/store/translationStore';
import { TAG_OPTIONS, MACHINE_DATA } from '@/lib/config';
import { DEFAULT_CATEGORIES } from '@/types/report';
import {
  Users, Wifi, WifiOff, ChevronDown, ChevronUp, Clock, Wrench, Package,
  ListTree, Circle, Camera, FileImage, Edit, X, Check, Image as ImageIcon,
  AlertCircle, Trash2, Plus, Download, Share2, ExternalLink, RefreshCw, Loader2,
  FileJson, Lock, ArrowDownToLine
} from 'lucide-react';
import { generateHomePowerPoint } from '@/lib/powerpoint';
import { useRouter } from 'next/navigation';

// Interface para sessão compartilhada
interface SharedSessionItem {
  sessionId: string;
  creatorId: string;
  creatorName: string;
  reportType: string;
  permission: string;
  createdAt: string;
  expiresAt: string;
}

// Gerar ID único
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function SharedContent() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const {
    sessionId,
    isSharedSession,
    userCount,
    lastSync,
    inspection,
    categories,
    conclusion,
    setSessionInfo,
    clearSession,
    setUserCount,
    setLastSync,
    updateInspection,
    setCategories,
    addPhotoToCategory,
    removePhotoFromCategory,
    updatePhotoInCategory,
    setConclusion,
    loadFromData,
    getAllData,
  } = useSharedReportStore();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Estado para lista de sessões compartilhadas
  const [sharedSessions, setSharedSessions] = useState<SharedSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Estado para o diálogo de retirar relatório
  const [showRetireDialog, setShowRetireDialog] = useState(false);
  const [retireSessionId, setRetireSessionId] = useState<string | null>(null);
  const [retirePassword, setRetirePassword] = useState('');
  const [retireError, setRetireError] = useState('');
  const [retireLoading, setRetireLoading] = useState(false);
  const [retireSuccess, setRetireSuccess] = useState(false);

  // User ID para identificação na sessão
  const [userId] = useState(() => `user-${generateId()}`);

  // Carregar sessões compartilhadas
  const loadSharedSessions = useCallback(async () => {
    if (!session) return;
    
    setLoadingSessions(true);
    try {
      const response = await fetch('/api/share?action=list', {
        credentials: 'include',
      });
      const result = await response.json();
      
      if (result.success) {
        setSharedSessions(result.sessions);
      }
    } catch (error) {
      console.error('Error loading shared sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, [session]);

  useEffect(() => {
    if (!isSharedSession) {
      loadSharedSessions();
    }
  }, [isSharedSession, loadSharedSessions]);

  // Hook de colaboração
  const {
    isConnected,
    connect,
    disconnect,
    sendUpdate,
    userCount: connectedUsers,
  } = useCollaboration({
    sessionId,
    userId,
    onRemoteUpdate: (updates) => {
      loadFromData(updates);
    },
    onSessionJoined: (data) => {
      if (data) {
        loadFromData(data);
      }
    },
  });

  // Conectar à sessão quando o componente montar
  useEffect(() => {
    if (sessionId && !isConnected) {
      // Inicializar categorias se vazias
      if (categories.length === 0) {
        setCategories(DEFAULT_CATEGORIES.map(cat => ({
          ...cat,
          photos: [],
        })));
      }

      connect(getAllData());
    }

    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [sessionId]);

  // Atualizar userCount quando mudar
  useEffect(() => {
    setUserCount(connectedUsers);
  }, [connectedUsers]);

  // Sincronizar mudanças
  const syncUpdate = useCallback((updates: any) => {
    if (isConnected) {
      sendUpdate(updates);
      setLastSync(Date.now());
    }
  }, [isConnected, sendUpdate]);

  // Handler para mudanças na inspeção
  const handleInspectionChange = useCallback((field: string, value: any) => {
    updateInspection({ [field]: value });
    syncUpdate({ ...getAllData(), inspection: { ...inspection, [field]: value } });
  }, [updateInspection, syncUpdate, inspection]);

  // Handler para TAG
  const handleTagChange = useCallback((tag: string) => {
    updateInspection({ tag });
    if (tag && MACHINE_DATA[tag]) {
      const machine = MACHINE_DATA[tag];
      const newInspection = {
        tag,
        modelo: machine.modelo,
        sn: machine.sn,
        entrega: machine.entrega,
        cliente: machine.cliente,
      };
      updateInspection(newInspection);
      syncUpdate({ ...getAllData(), inspection: { ...inspection, ...newInspection } });
    } else {
      syncUpdate({ ...getAllData(), inspection: { ...inspection, tag } });
    }
  }, [updateInspection, syncUpdate, inspection]);

  // Handler para conclusão
  const handleConclusionChange = useCallback((value: string) => {
    setConclusion(value);
    syncUpdate({ ...getAllData(), conclusion: value });
  }, [setConclusion, syncUpdate, conclusion]);

  // Sair da sessão
  const handleLeaveSession = useCallback(() => {
    if (confirm('Tem certeza que deseja sair da sessão compartilhada?')) {
      disconnect();
      clearSession();
    }
  }, [disconnect, clearSession]);

  // Gerar PowerPoint
  const handleGeneratePPT = useCallback(async () => {
    setIsLoading(true);
    try {
      await generateHomePowerPoint({
        inspection,
        categories,
        conclusion,
      });
    } catch (error) {
      console.error('Error generating PPT:', error);
    } finally {
      setIsLoading(false);
    }
  }, [inspection, categories, conclusion]);

  // Abrir sessão
  const handleOpenSession = (sessionId: string) => {
    router.push(`/share/${sessionId}`);
  };

  // Abrir diálogo de retirar
  const handleOpenRetireDialog = (sessionId: string) => {
    setRetireSessionId(sessionId);
    setRetirePassword('');
    setRetireError('');
    setRetireSuccess(false);
    setShowRetireDialog(true);
  };

  // Verificar senha e retirar relatório
  const handleRetireReport = async () => {
    if (!retireSessionId || !retirePassword.trim()) {
      setRetireError('Digite sua senha');
      return;
    }

    setRetireLoading(true);
    setRetireError('');

    try {
      // 1. Verificar senha do usuário logado
      const verifyResponse = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: session?.user?.email,
          currentPassword: retirePassword,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.valid) {
        setRetireError('Senha incorreta');
        setRetireLoading(false);
        return;
      }

      // 2. Buscar dados do relatório compartilhado
      const shareResponse = await fetch(`/api/share?sessionId=${retireSessionId}`, {
        credentials: 'include',
      });

      const shareResult = await shareResponse.json();

      if (!shareResult.success) {
        setRetireError('Erro ao buscar relatório');
        setRetireLoading(false);
        return;
      }

      const reportData = shareResult.session?.data;
      const tag = reportData?.inspection?.tag || 'relatorio';
      const dateStr = new Date().toISOString().split('T')[0];

      // 3. Preparar dados para download JSON
      const dataToExport = {
        exportedAt: new Date().toISOString(),
        retiredFrom: 'shared_session',
        sharedBy: shareResult.session?.creatorName,
        reportType: shareResult.session?.reportType,
        inspection: reportData?.inspection,
        categories: reportData?.categories,
        photos: reportData?.photos,
        conclusion: reportData?.conclusion,
      };

      // 4. Fazer download do JSON
      const jsonBlob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `relatorio_retirado_${tag}_${dateStr}.json`;
      jsonLink.click();
      URL.revokeObjectURL(jsonUrl);

      // 5. Fazer download do PowerPoint
      if (reportData?.inspection && reportData?.categories) {
        try {
          await generateHomePowerPoint({
            inspection: reportData.inspection,
            categories: reportData.categories,
            conclusion: reportData.conclusion || '',
          });
        } catch (pptError) {
          console.error('Error generating PowerPoint:', pptError);
        }
      }

      // 6. Deletar a sessão compartilhada
      const deleteResponse = await fetch(`/api/share?sessionId=${retireSessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const deleteResult = await deleteResponse.json();

      if (!deleteResult.success) {
        setRetireError('Erro ao remover compartilhamento');
        setRetireLoading(false);
        return;
      }

      // 7. Atualizar lista de sessões
      loadSharedSessions();

      // 8. Mostrar sucesso
      setRetireSuccess(true);
      setRetireLoading(false);

      // Fechar diálogo após 1.5 segundos
      setTimeout(() => {
        setShowRetireDialog(false);
        setRetireSessionId(null);
        setRetirePassword('');
        setRetireSuccess(false);
      }, 1500);

    } catch (error) {
      console.error('Error retiring report:', error);
      setRetireError('Erro ao retirar relatório');
      setRetireLoading(false);
    }
  };

  // Se não logado
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <Users className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Login Necessário</h2>
        <p className="text-gray-500 mb-4">
          Faça login para ver relatórios compartilhados.
        </p>
      </div>
    );
  }

  // Se não tem sessão ativa, mostrar lista de compartilhados
  if (!isSharedSession || !sessionId) {
    return (
      <>
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Share2 className="h-5 w-5 text-orange-500" />
              Relatórios Compartilhados
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Relatórios que foram compartilhados com você
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSharedSessions} disabled={loadingSessions}>
            {loadingSessions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {loadingSessions ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : sharedSessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Share2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum relatório compartilhado</p>
              <p className="text-sm text-gray-400 mt-1">
                Quando alguém compartilhar um relatório com você, ele aparecerá aqui
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sharedSessions.map((item) => (
              <Card key={item.sessionId} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                            <><ExternalLink className="h-3 w-3 mr-1" /> Ver</>
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

                    <div className="flex flex-col sm:flex-row gap-2">
                      {session?.user?.id === item.creatorId && (
                        <Button 
                          variant="outline"
                          size="sm"
                          className="border-green-500 text-green-600 hover:bg-green-50 h-9"
                          onClick={() => handleOpenRetireDialog(item.sessionId)}
                        >
                          <ArrowDownToLine className="h-4 w-4 mr-1" />
                          Retirar
                        </Button>
                      )}
                      <Button 
                        className="bg-orange-500 hover:bg-orange-600 h-9"
                        size="sm"
                        onClick={() => handleOpenSession(item.sessionId)}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Abrir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Diálogo de Retirar */}
      <Dialog open={showRetireDialog} onOpenChange={setShowRetireDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {retireSuccess ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  Relatório Retirado!
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5 text-orange-500" />
                  Retirar Relatório
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {retireSuccess 
                ? 'O download do relatório foi iniciado automaticamente.'
                : 'Digite sua senha para confirmar a retirada do relatório compartilhado.'
              }
            </DialogDescription>
          </DialogHeader>

          {!retireSuccess ? (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="retire-password">Sua Senha</Label>
                  <Input
                    id="retire-password"
                    type="password"
                    placeholder="Digite sua senha de login"
                    value={retirePassword}
                    onChange={(e) => setRetirePassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRetireReport()}
                    className="h-11"
                  />
                </div>

                {retireError && (
                  <div className="text-sm text-red-500 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {retireError}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <p><strong>O que acontece ao retirar:</strong></p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Download do relatório em JSON</li>
                    <li>Download do relatório em PowerPoint</li>
                    <li>O link de compartilhamento será desativado</li>
                    <li>O relatório sairá desta lista</li>
                  </ul>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRetireDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleRetireReport}
                  disabled={retireLoading || !retirePassword.trim()}
                >
                  {retireLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="h-4 w-4 mr-2" />
                  )}
                  Retirar Relatório
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-gray-600">Fechando automaticamente...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </>
    );
  }

  // Sessão ativa - mostrar editor colaborativo
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header da sessão */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-4 mb-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sessão Compartilhada
            </h2>
            <p className="text-white/80 text-sm mt-1">
              ID: {sessionId}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Status de conexão */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge className="bg-green-500 text-white">
                  <Wifi className="h-3 w-3 mr-1" />
                  Sincronizado
                </Badge>
              ) : (
                <Badge className="bg-yellow-500 text-white">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Conectando...
                </Badge>
              )}
            </div>
            {/* Usuários online */}
            <Badge className="bg-white/20 text-white">
              <Users className="h-3 w-3 mr-1" />
              {userCount} online
            </Badge>
            {/* Última sync */}
            {lastSync && (
              <span className="text-white/60 text-xs">
                Última sync: {new Date(lastSync).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          onClick={handleGeneratePPT}
          disabled={isLoading}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Download className="h-4 w-4 mr-2" />
          Baixar PowerPoint
        </Button>
        <Button
          variant="outline"
          onClick={handleLeaveSession}
          className="text-red-600 border-red-300 hover:bg-red-50"
        >
          <X className="h-4 w-4 mr-2" />
          Sair da Sessão
        </Button>
      </div>

      {/* Informações da Execução */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{t('report.technicalReport')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dados da Máquina */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('report.tag')}</Label>
              <select
                value={inspection.tag}
                onChange={(e) => handleTagChange(e.target.value)}
                className="w-full h-10 px-3 border rounded-md"
              >
                <option value="">{t('placeholder.tag')}</option>
                {TAG_OPTIONS.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('report.modelo')}</Label>
              <Input
                value={inspection.modelo}
                onChange={(e) => handleInspectionChange('modelo', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('report.sn')}</Label>
              <Input
                value={inspection.sn}
                onChange={(e) => handleInspectionChange('sn', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('report.cliente')}</Label>
              <Input
                value={inspection.cliente}
                onChange={(e) => handleInspectionChange('cliente', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('report.executionDate')}</Label>
              <Input
                type="date"
                value={inspection.dataExecucao}
                onChange={(e) => handleInspectionChange('dataExecucao', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('report.performers')}</Label>
              <Input
                value={inspection.executantes}
                onChange={(e) => handleInspectionChange('executantes', e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Descrição */}
          <div className="space-y-2">
            <Label>{t('report.descricao')}</Label>
            <Textarea
              value={inspection.descricao}
              onChange={(e) => handleInspectionChange('descricao', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Categorias de Fotos */}
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-semibold">{t('photos.title')}</h3>
        {categories.map((category) => (
          <Collapsible
            key={category.id}
            open={expandedCategories[category.id]}
            onOpenChange={() => setExpandedCategories(prev => ({
              ...prev,
              [category.id]: !prev[category.id]
            }))}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-orange-500">{category.photos.length}</Badge>
                      <CardTitle className="text-base">{t(`category.${category.id}`)}</CardTitle>
                    </div>
                    {expandedCategories[category.id] ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {category.photos.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      Nenhuma foto adicionada
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {category.photos.map((photo) => (
                        <div key={photo.id} className="border rounded-lg p-3">
                          {photo.imageData && (
                            <img
                              src={photo.imageData}
                              alt=""
                              className="w-full h-40 object-cover rounded mb-2"
                            />
                          )}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <Input
                              placeholder="PN"
                              value={photo.pn || ''}
                              onChange={(e) => {
                                updatePhotoInCategory(category.id, photo.id, { pn: e.target.value });
                                syncUpdate(getAllData());
                              }}
                            />
                            <Input
                              placeholder={t('photo.partNamePlaceholder')}
                              value={photo.partName || ''}
                              onChange={(e) => {
                                updatePhotoInCategory(category.id, photo.id, { partName: e.target.value });
                                syncUpdate(getAllData());
                              }}
                            />
                            <Input
                              placeholder={t('photo.quantityPlaceholder')}
                              value={photo.quantity || ''}
                              onChange={(e) => {
                                updatePhotoInCategory(category.id, photo.id, { quantity: e.target.value });
                                syncUpdate(getAllData());
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              onClick={() => {
                                removePhotoFromCategory(category.id, photo.id);
                                syncUpdate(getAllData());
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      {/* Conclusão */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('conclusion.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={conclusion}
            onChange={(e) => handleConclusionChange(e.target.value)}
            placeholder={t('conclusion.placeholder')}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Info sobre sincronização */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <AlertCircle className="h-4 w-4 inline mr-2" />
        Todas as alterações são sincronizadas automaticamente com outros usuários na sessão.
      </div>
    </div>
  );
}
