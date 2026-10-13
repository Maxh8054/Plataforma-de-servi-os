'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { TextareaWithSpellCheck } from '@/components/reports/TextareaWithSpellCheck';
import { 
  AlertCircle, 
  Loader2, 
  Users, 
  Edit, 
  Eye, 
  Clock,
  ArrowLeft,
  Save,
  Share2,
  Wifi,
  WifiOff,
  AlertTriangle,
  ExternalLink,
  Download,
  FileJson,
  FileText
} from 'lucide-react';
import { useTranslation } from '@/store/translationStore';
import { useHomeReportStore } from '@/store/homeReportStore';
import { useReportStore } from '@/store/reportStore';
import { generateHomePowerPoint, generatePowerPoint } from '@/lib/powerpoint';

interface SharedData {
  inspection?: any;
  categories?: any[];
  photos?: any[];
  conclusion?: string;
  reportType?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

interface SharedSession {
  sessionId: string;
  creatorName: string;
  reportType: string;
  permission: string;
  data: SharedData;
  expiresAt: string;
}

export default function SharedReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { data: session, status } = useSession();
  const { t } = useTranslation();
  const homeStore = useHomeReportStore();
  const inspecaoStore = useReportStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedSession, setSharedSession] = useState<SharedSession | null>(null);
  const [editedData, setEditedData] = useState<SharedData | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingPpt, setDownloadingPpt] = useState(false);

  // Timestamp da última edição LOCAL (feita pelo usuário nesta página)
  // Usado para evitar que dados antigos do servidor sobrescrevam edições locais
  const lastLocalEditRef = useRef<number>(0);

  // Carregar sessão compartilhada
  const loadSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/share?sessionId=${sessionId}`, {
        credentials: 'include',
      });
      const result = await response.json();

      if (result.success) {
        setSharedSession(result.session);
        setEditedData(result.session.data);
        setLastSync(new Date());
        setIsConnected(true);
      } else {
        setError(result.error || 'Sessão não encontrada');
      }
    } catch (err) {
      console.error('Error loading session:', err);
      setError('Erro ao carregar sessão');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Polling para sincronização (a cada 2 segundos para mais fluidez)
  useEffect(() => {
    if (!sharedSession) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/share?sessionId=${sessionId}`, {
          credentials: 'include',
        });
        const result = await response.json();

        if (result.success) {
          const serverData = result.session.data;
          
          // Sempre atualizar a sessão
          setSharedSession(result.session);
          
          // Só atualiza os dados editados se não estiver salvando
          if (!saving && serverData) {
            // REGRA CRÍTICA: Só aceitar dados do servidor se forem MAIS RECENTES que a edição local
            const serverTimestamp = serverData.lastModifiedAt 
              ? new Date(serverData.lastModifiedAt).getTime() 
              : Date.now();
            const localEditTime = lastLocalEditRef.current;
            
            if (serverTimestamp > localEditTime) {
              // Dados do servidor são mais recentes - aceitar
              console.log('[Share Page] Applied server data, serverTime:', serverTimestamp, '> localEditTime:', localEditTime);
              setEditedData(serverData);
            } else {
              // Dados do servidor são mais antigos - ignorar (manter edição local)
              console.log('[Share Page] SKIPPED server data, serverTime:', serverTimestamp, '<= localEditTime:', localEditTime);
            }
          }
          
          setLastSync(new Date());
          setIsConnected(true);
        }
      } catch (err) {
        console.error('Polling error:', err);
        setIsConnected(false);
      }
    }, 1500); // 1.5 segundos para ser mais responsivo

    return () => clearInterval(pollInterval);
  }, [sessionId, sharedSession, saving]);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId, loadSession]);

  // Salvar alterações
  const handleSave = async () => {
    if (!sharedSession || sharedSession.permission !== 'edit' || !editedData) return;

    setSaving(true);
    try {
      const now = Date.now();
      const response = await fetch('/api/share', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          sessionId, 
          data: {
            ...editedData,
            lastModifiedBy: session?.user?.name || 'Usuário',
            lastModifiedAt: new Date(now).toISOString(),
          }
        }),
      });
      setLastSync(new Date());
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Verificar se há dados significativos no relatório
  const hasSignificantData = (store: any) => {
    if (!store) return false;
    const data = store.getAllData ? store.getAllData() : store;
    if (data.inspection?.tag || data.inspection?.cliente || data.inspection?.descricao) return true;
    if (data.categories?.some((cat: any) => cat.photos?.some((p: any) => p.imageData))) return true;
    if (data.photos?.some((p: any) => p.imageData)) return true;
    if (data.conclusion) return true;
    return false;
  };

  // Verificar se o relatório compartilhado tem dados significativos
  const hasSharedData = (data: SharedData | null) => {
    if (!data) return false;
    if (data.inspection?.tag || data.inspection?.cliente || data.inspection?.descricao) return true;
    if (data.categories?.some((cat: any) => cat.photos?.some((p: any) => p.imageData))) return true;
    if (data.photos?.some((p: any) => p.imageData)) return true;
    if (data.conclusion) return true;
    return false;
  };

  // Download JSON do relatório ATUAL do usuário (backup antes de abrir compartilhado)
  const handleDownloadJson = async () => {
    setDownloadingJson(true);
    try {
      const homeData = homeStore.getAllData();
      const inspecaoData = inspecaoStore.getAllData();
      
      const dataToExport = {
        exportedAt: new Date().toISOString(),
        homeReport: hasSignificantData(homeStore) ? homeData : null,
        inspecaoReport: hasSignificantData(inspecaoStore) ? inspecaoData : null,
      };
      
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading JSON:', error);
    } finally {
      setDownloadingJson(false);
    }
  };

  // Download PowerPoint do relatório ATUAL do usuário (backup)
  const handleDownloadPpt = async () => {
    setDownloadingPpt(true);
    try {
      const homeData = homeStore.getAllData();
      const inspecaoData = inspecaoStore.getAllData();
      
      // Prioriza o relatório que tem dados
      if (hasSignificantData(homeStore)) {
        await generateHomePowerPoint({
          inspection: homeData.inspection,
          categories: homeData.categories,
          conclusion: homeData.conclusion,
        });
      } else if (hasSignificantData(inspecaoStore)) {
        // Para inspeção, usa o gerador padrão
        await generateHomePowerPoint({
          inspection: inspecaoData.inspection,
          categories: [],
          conclusion: inspecaoData.conclusion,
        });
      }
    } catch (error) {
      console.error('Error downloading PPT:', error);
    } finally {
      setDownloadingPpt(false);
    }
  };

  // Download JSON do relatório COMPARTILHADO
  const [downloadingSharedJson, setDownloadingSharedJson] = useState(false);
  const [downloadingSharedPpt, setDownloadingSharedPpt] = useState(false);

  const handleDownloadSharedJson = async () => {
    if (!editedData) return;
    setDownloadingSharedJson(true);
    try {
      const dataToExport = {
        exportedAt: new Date().toISOString(),
        sharedBy: sharedSession?.creatorName,
        reportType: sharedSession?.reportType,
        inspection: editedData.inspection,
        categories: editedData.categories,
        photos: editedData.photos,
        conclusion: editedData.conclusion,
      };
      
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const tag = editedData.inspection?.tag || 'relatorio';
      link.download = `relatorio_compartilhado_${tag}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading shared JSON:', error);
    } finally {
      setDownloadingSharedJson(false);
    }
  };

  // Download PowerPoint do relatório COMPARTILHADO
  const handleDownloadSharedPpt = async () => {
    if (!editedData) return;
    setDownloadingSharedPpt(true);
    try {
      const reportType = sharedSession?.reportType || 'home';
      
      if (reportType === 'home') {
        await generateHomePowerPoint({
          inspection: editedData.inspection || {},
          categories: editedData.categories || [],
          conclusion: editedData.conclusion || '',
        });
      } else {
        // Inspeção
        await generatePowerPoint({
          inspection: editedData.inspection || {},
          photos: editedData.photos || [],
          additionalParts: [],
          conclusion: editedData.conclusion || '',
        });
      }
    } catch (error) {
      console.error('Error downloading shared PPT:', error);
    } finally {
      setDownloadingSharedPpt(false);
    }
  };

  // Ir para o editor principal
  const handleOpenInEditor = () => {
    // Verificar se há dados significativos nos stores
    const hasHomeData = hasSignificantData(homeStore);
    const hasInspecaoData = hasSignificantData(inspecaoStore);
    
    if (hasHomeData || hasInspecaoData) {
      setShowConfirmDialog(true);
      return;
    }
    
    proceedToEditor();
  };

  const proceedToEditor = () => {
    if (!editedData) return;
    
    const reportType = sharedSession?.reportType || 'home';
    
    // Carregar dados no store correto
    if (reportType === 'home') {
      homeStore.loadFromData({
        inspection: editedData.inspection,
        categories: editedData.categories,
        conclusion: editedData.conclusion,
      });
    } else {
      inspecaoStore.loadFromData({
        inspection: editedData.inspection,
        photos: editedData.photos,
        additionalParts: editedData.additionalParts,
        conclusion: editedData.conclusion,
      });
    }
    
    // Flag para indicar que é uma sessão compartilhada
    localStorage.setItem('activeSharedSession', JSON.stringify({
      sessionId,
      permission: sharedSession?.permission,
      creatorName: sharedSession?.creatorName,
      reportType,
    }));
    
    // Flag para ir para a aba correta
    localStorage.setItem('openTabOnLoad', reportType);
    
    setShowConfirmDialog(false);
    router.push('/');
  };

  // Atualizar campo
  const updateField = (field: string, value: any) => {
    if (!editedData) return;
    const now = Date.now();
    lastLocalEditRef.current = now; // Registrar timestamp da edição local
    setEditedData({
      ...editedData,
      inspection: {
        ...editedData.inspection,
        [field]: value,
      },
      lastModifiedBy: session?.user?.name || 'Usuário',
      lastModifiedAt: new Date(now).toISOString(),
    });
  };

  const updateConclusion = (value: string) => {
    if (!editedData) return;
    const now = Date.now();
    lastLocalEditRef.current = now; // Registrar timestamp da edição local
    setEditedData({
      ...editedData,
      conclusion: value,
      lastModifiedBy: session?.user?.name || 'Usuário',
      lastModifiedAt: new Date(now).toISOString(),
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Carregando relatório compartilhado...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Users className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Necessário</h2>
            <p className="text-gray-600 mb-4">
              Faça login para acessar o relatório compartilhado.
            </p>
            <Button 
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => router.push('/')}
            >
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Erro</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button 
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => router.push('/')}
            >
              Ir para Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sharedSession || !editedData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          Carregando dados...
        </div>
      </div>
    );
  }

  const isEditor = sharedSession.permission === 'edit';
  const reportTypeLabel = sharedSession.reportType === 'home' ? 'Relatório de Falha' : 'Inspeção';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Mobile Layout */}
          <div className="md:hidden">
            <div className="flex items-center gap-2 mb-3">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => router.push('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-gray-900 flex items-center gap-2 truncate">
                  <Share2 className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <span className="truncate">Relatório Compartilhado</span>
                </h1>
                <p className="text-xs text-gray-500 truncate">
                  por {sharedSession.creatorName} • {reportTypeLabel}
                </p>
              </div>
            </div>
            
            {/* Status badges - linha separada no mobile */}
            <div className="flex items-center gap-2 flex-wrap">
              {isConnected ? (
                <Badge className="bg-green-500 text-xs">
                  <Wifi className="h-3 w-3 mr-1" />
                  Sincronizado
                </Badge>
              ) : (
                <Badge className="bg-yellow-500 text-xs">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Reconectando...
                </Badge>
              )}
              
              <Badge className={isEditor ? 'bg-blue-500 text-xs' : 'bg-gray-500 text-xs'}>
                {isEditor ? (
                  <><Edit className="h-3 w-3 mr-1" /> Editando</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" /> Visualizando</>
                )}
              </Badge>
              
              {lastSync && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {lastSync.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-orange-500" />
                  Relatório Compartilhado
                </h1>
                <p className="text-sm text-gray-500">
                  por {sharedSession.creatorName} • {reportTypeLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isConnected ? (
                <Badge className="bg-green-500">
                  <Wifi className="h-3 w-3 mr-1" />
                  Sincronizado
                </Badge>
              ) : (
                <Badge className="bg-yellow-500">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Reconectando...
                </Badge>
              )}
              
              <Badge className={isEditor ? 'bg-blue-500' : 'bg-gray-500'}>
                {isEditor ? (
                  <><Edit className="h-3 w-3 mr-1" /> Editando</>
                ) : (
                  <><Eye className="h-3 w-3 mr-1" /> Visualizando</>
                )}
              </Badge>
              
              {lastSync && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {lastSync.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-4 md:py-6">
        {/* Info de última modificação */}
        {editedData.lastModifiedBy && editedData.lastModifiedAt && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>
              Última modificação por <strong>{editedData.lastModifiedBy}</strong> em{' '}
              {new Date(editedData.lastModifiedAt).toLocaleString('pt-BR')}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button 
            className="bg-orange-500 hover:bg-orange-600 h-11 md:h-10"
            onClick={handleOpenInEditor}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir no Editor
          </Button>
          
          {isEditor && (
            <Button 
              variant="outline"
              onClick={handleSave}
              disabled={saving}
              className="h-11 md:h-10"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          )}
          
          {/* Botões de download do relatório compartilhado */}
          {hasSharedData(editedData) && (
            <>
              <Button 
                variant="outline"
                onClick={handleDownloadSharedJson}
                disabled={downloadingSharedJson}
                className="h-11 md:h-10 border-green-500 text-green-600 hover:bg-green-50"
              >
                {downloadingSharedJson ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileJson className="h-4 w-4 mr-2" />
                )}
                Baixar JSON
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleDownloadSharedPpt}
                disabled={downloadingSharedPpt}
                className="h-11 md:h-10 border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                {downloadingSharedPpt ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Baixar PowerPoint
              </Button>
            </>
          )}
        </div>

        {/* Report Data */}
        <div className="grid grid-cols-1 gap-4">
          {/* Info Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">TAG</p>
                  {isEditor ? (
                    <input
                      type="text"
                      value={editedData.inspection?.tag || ''}
                      onChange={(e) => updateField('tag', e.target.value)}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <p className="font-medium">{editedData.inspection?.tag || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500">Cliente</p>
                  {isEditor ? (
                    <input
                      type="text"
                      value={editedData.inspection?.cliente || ''}
                      onChange={(e) => updateField('cliente', e.target.value)}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <p className="font-medium">{editedData.inspection?.cliente || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500">Inspetor</p>
                  {isEditor ? (
                    <input
                      type="text"
                      value={editedData.inspection?.inspetor || ''}
                      onChange={(e) => updateField('inspetor', e.target.value)}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    <p className="font-medium">{editedData.inspection?.inspetor || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500">Expira em</p>
                  <p className="font-medium text-xs">
                    {new Date(sharedSession.expiresAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditor ? (
                <TextareaWithSpellCheck
                  value={editedData.inspection?.descricao || ''}
                  onChange={(value) => updateField('descricao', value)}
                  className="text-sm"
                  minHeight="min-h-[80px]"
                  placeholder="Descrição do problema..."
                  language="pt"
                  t={t}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm">{editedData.inspection?.descricao || 'Sem descrição'}</p>
              )}
            </CardContent>
          </Card>

          {/* Conclusion */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Conclusão</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditor ? (
                <TextareaWithSpellCheck
                  value={editedData.conclusion || ''}
                  onChange={updateConclusion}
                  className="text-sm"
                  minHeight="min-h-[100px]"
                  placeholder="Conclusão do relatório..."
                  language="pt"
                  t={t}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm">{editedData.conclusion || 'Sem conclusão'}</p>
              )}
            </CardContent>
          </Card>

          {/* Photos */}
          {editedData.categories && editedData.categories.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Categorias de Fotos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {editedData.categories.map((cat: any, index: number) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-orange-500">{cat.photos?.length || 0}</Badge>
                        <span className="font-medium text-sm">{cat.name || cat.id || `Categoria ${index + 1}`}</span>
                      </div>
                      {cat.photos && cat.photos.length > 0 && (
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                          {cat.photos.map((photo: any, pIndex: number) => (
                            <div key={pIndex} className="relative aspect-square rounded overflow-hidden bg-gray-100">
                              <img 
                                src={photo.imageData || photo.data} 
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              {photo.pn && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                                  {photo.pn}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Confirm Dialog with Download Options */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Relatório em Andamento
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 pt-2">
              Você já tem um relatório em andamento. Abrir o relatório compartilhado no editor irá substituir seu trabalho atual.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-500">
              Deseja fazer backup do seu relatório atual antes de continuar?
            </p>
            
            {/* Download buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                className="flex-1 h-11"
                onClick={handleDownloadJson}
                disabled={downloadingJson}
              >
                {downloadingJson ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileJson className="h-4 w-4 mr-2" />
                )}
                Baixar JSON
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 h-11"
                onClick={handleDownloadPpt}
                disabled={downloadingPpt}
              >
                {downloadingPpt ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Baixar PowerPoint
              </Button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
              <p><strong>Dica:</strong> O download do JSON permite restaurar seu relatório depois. O PowerPoint é uma versão estática para visualização.</p>
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto" onClick={proceedToEditor}>
              Abrir Relatório Compartilhado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
