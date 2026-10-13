'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { generatePowerPoint, generateHomePowerPoint } from '@/lib/powerpoint';
import { UserMenu } from '@/components/reports/UserMenu';
import { LoginPage } from '@/components/reports/LoginPage';
import { useStoresHydrated } from '@/hooks/useStoresHydrated';
import { usePersistedState } from '@/hooks/usePersistedState';
import { getSubPartsForPhoto, photoShouldBeInPartsTable, getDisplayPn, photoHasSubPartData } from '@/lib/partsUtils';
import { 
  generateAnalysisEmailBody, 
  generateConclusionEmailBody, 
  generateEmailSubject,
  openEmailClient,
  EMAIL_CONFIG 
} from '@/lib/emailUtils';
import { 
  exportPartsTableToExcelHome, 
  exportPartsTableToExcelInspecao,
  exportSubPartsToExcel
} from '@/lib/excelExport';
import { 
  Trash2, Plus, Download, Upload, Settings, 
  Camera, FileImage, Edit, X, Check,
  Image as ImageIcon, Clock, Wrench, Package, ListTree, Circle,
  ArrowUpRight, MousePointer, Home, ClipboardList, ChevronDown, ChevronUp, Globe, Mail, Maximize2,
  FileSpreadsheet, FileText, FileDown, Import, AlertTriangle, Menu, Loader2, Images, Square
} from 'lucide-react';
import { useReportStore } from '@/store/reportStore';
import { useHomeReportStore } from '@/store/homeReportStore';
import { useTranslationStore, useTranslation } from '@/store/translationStore';
import { TAG_OPTIONS, MACHINE_DATA } from '@/lib/config';
import type { PhotoData, AdditionalPart, EmbeddedPhoto, PhotoCategory, Criticality } from '@/types/report';
// History and finalize functionality removed

// Translation language constants
type Language = 'pt' | 'en' | 'ja' | 'zh';

const DEFAULT_CIRCLE_RADIUS = 80;

function sanitizeForFilename(text: string): string {
  return text
    .trim()
    .substring(0, 60)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    || 'export';
}

function generateReportId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  let id = 'ZS-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

const LANGUAGE_FLAGS: Record<Language, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
};

const LANGUAGE_NAMES: Record<Language, string> = {
  pt: 'Português',
  en: 'English',
  ja: '日本語',
  zh: '中文',
};

// Tipo para objetos do editor
interface EditorCircle {
  id: string;
  type: 'circle' | 'circleWithPhoto' | 'arrow' | 'rectangle';
  x: number;
  y: number;
  radius?: number;
  endX?: number;
  endY?: number;
  width?: number;
  height?: number;
  color: string;
  imageData?: string;
}

// Componente de Menu de Ações Mobile
function MobileActionMenu({
  onAddPhoto,
  onDataDialog,
  onExportDialog,
  onEmailDialog,
  onClearConfirm,
  reportData,
  reportType,
  t,
}: {
  onAddPhoto: () => void;
  onDataDialog: () => void;
  onExportDialog: () => void;
  onEmailDialog: () => void;
  onClearConfirm: () => void;
  reportData: unknown;
  reportType: 'home' | 'inspecao';
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef(10);

  useEffect(() => {
    if (isOpen) {
      // Reset countdown ref
      countdownRef.current = 10;
      
      timerRef.current = setInterval(() => {
        countdownRef.current -= 1;
        const newTime = countdownRef.current;
        setTimeLeft(newTime);
        
        if (newTime <= 0) {
          setIsOpen(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      }, 1000);
      
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className="md:hidden fixed bottom-4 right-4 z-50">
      {/* Menu expandido */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-black/95 backdrop-blur-sm rounded-2xl p-3 shadow-2xl border border-white/10 min-w-[200px]">
          <div className="text-xs text-white/60 mb-2 text-center">
            Fechando em {timeLeft}s
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button 
              size="icon" 
              className="rounded-full bg-green-600 hover:bg-green-700 h-12 w-12" 
              onClick={() => handleAction(onAddPhoto)}
              title={t('action.addPhoto')}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button 
              size="icon" 
              className="rounded-full bg-blue-600 hover:bg-blue-700 h-12 w-12" 
              onClick={() => handleAction(onDataDialog)}
              title={t('action.importExport')}
            >
              <FileDown className="h-5 w-5" />
            </Button>
            <Button 
              size="icon" 
              className="rounded-full bg-purple-600 hover:bg-purple-700 h-12 w-12" 
              onClick={() => handleAction(onExportDialog)}
              title={t('action.download')}
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button 
              size="icon" 
              className="rounded-full bg-orange-500 hover:bg-orange-600 h-12 w-12" 
              onClick={() => handleAction(onEmailDialog)}
              title="Email"
            >
              <Mail className="h-5 w-5" />
            </Button>
            <Button 
              size="icon" 
              className="rounded-full bg-red-600 hover:bg-red-700 h-12 w-12" 
              onClick={() => handleAction(onClearConfirm)}
              title={t('action.clear')}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Botão principal */}
      <Button
        className={`rounded-full h-14 w-14 shadow-lg ${isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>
    </div>
  );
}

// Componente para visualização em tela cheia
function FullScreenImageViewer({
  imageData,
  onClose,
  t,
}: {
  imageData: string;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `photo_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center touch-none">
      {/* Close button - larger for mobile */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10 h-12 w-12 md:h-10 md:w-10"
        onClick={onClose}
      >
        <X className="h-7 w-7 md:h-6 md:w-6" />
      </Button>
      
      {/* Download button - larger for mobile */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-20 md:right-16 text-white hover:bg-white/20 z-10 h-12 w-12 md:h-10 md:w-10"
        onClick={handleDownload}
      >
        <Download className="h-6 w-6 md:h-5 md:w-5" />
      </Button>
      
      {/* Image - pinch to zoom enabled via CSS */}
      <img
        src={imageData}
        alt="Fullscreen"
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: 'manipulation' }}
      />
      
      {/* Instructions */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-sm bg-black/50 px-4 py-2 rounded-full">
        {t('fullscreen.close')}: ESC ou toque no X
      </div>
    </div>
  );
}

// Componente de opções de foto reutilizável
function PhotoOptionsDialog({
  open,
  onOpenChange,
  hasImage,
  onUpload,
  onCamera,
  onPaste,
  onViewFullscreen,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasImage: boolean;
  onUpload: (file: File) => void;
  onCamera: () => void;
  onPaste: () => void;
  onViewFullscreen?: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{t('photoOptions.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {/* Ver em tela cheia - só aparece se já tem foto */}
          {hasImage && onViewFullscreen && (
            <Button 
              className="w-full justify-start h-12 md:h-10" 
              variant="outline"
              onClick={() => { onViewFullscreen(); onOpenChange(false); }}
            >
              <Maximize2 className="h-5 w-5 mr-3" />
              {t('photoOptions.viewFullscreen')}
            </Button>
          )}
          
          {/* Upload de arquivo */}
          <Button 
            className="w-full justify-start h-12 md:h-10" 
            variant="outline"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => { 
                const file = (e.target as HTMLInputElement).files?.[0]; 
                if (file) { 
                  onUpload(file); 
                  onOpenChange(false);
                } 
              };
              input.click();
            }}
          >
            <Upload className="h-5 w-5 mr-3" />
            {hasImage ? t('photoOptions.replacePhoto') : t('photoOptions.uploadFile')}
          </Button>
          
          {/* Abrir câmera */}
          <Button 
            className="w-full justify-start h-12 md:h-10" 
            variant="outline"
            onClick={() => { onCamera(); onOpenChange(false); }}
          >
            <Camera className="h-5 w-5 mr-3" />
            {t('photoOptions.openCamera')}
          </Button>
          
          {/* Colar da área de transferência */}
          <Button 
            className="w-full justify-start h-12 md:h-10" 
            variant="outline"
            onClick={() => { onPaste(); onOpenChange(false); }}
          >
            <ClipboardList className="h-5 w-5 mr-3" />
            {t('photoOptions.pasteClipboard')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente para a seção de peças adicionais
function AdditionalPartsSection({
  parentPn,
  photoId,
  additionalParts,
  onAddPart,
  onRemovePart,
  onUpdatePart,
  t,
}: {
  parentPn: string;
  photoId?: string;
  additionalParts: AdditionalPart[];
  onAddPart: (part: AdditionalPart) => void;
  onRemovePart: (id: string) => void;
  onUpdatePart?: (id: string, data: Partial<AdditionalPart>) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [newPn, setNewPn] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newPartName, setNewPartName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newCriticality, setNewCriticality] = useState<'Alta' | 'Média' | 'Baixa' | ''>('');
  const [showExcelPaste, setShowExcelPaste] = useState(false);
  const [excelPasteData, setExcelPasteData] = useState('');

  const photoAdditionalParts = additionalParts.filter(p =>
    photoId && p.photoId === photoId
  );

  const handleAddPart = () => {
    if (!newPn.trim() || !newPartName.trim() || !newQuantity.trim()) return;
    
    onAddPart({
      id: `add-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pn: newPn.trim(),
      serialNumber: newSerialNumber.trim(),
      partName: newPartName.trim(),
      quantity: newQuantity.trim(),
      criticality: newCriticality,
      parentPn: parentPn,
      photoId: photoId || undefined,
    });

    setNewPn('');
    setNewSerialNumber('');
    setNewPartName('');
    setNewQuantity('');
    setNewCriticality('');
  };

  // Processar dados do Excel colados
  const handlePasteExcel = () => {
    if (!excelPasteData.trim()) return;
    
    // Parse dos dados - formato: Part No.      Q'ty    Part name (tab ou espaços)
    const lines = excelPasteData.trim().split('\n');
    
    lines.forEach((line) => {
      // Divide por tab ou múltiplos espaços
      const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p);
      
      if (parts.length >= 3) {
        const pn = parts[0];
        const quantity = parts[1];
        const partName = parts.slice(2).join(' '); // Nome pode ter espaços
        
        onAddPart({
          id: `add-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          pn: pn,
          serialNumber: '',
          partName: partName,
          quantity: quantity,
          criticality: '',
          parentPn: parentPn,
          photoId: photoId || undefined,
        });
      }
    });
    
    setExcelPasteData('');
    setShowExcelPaste(false);
  };

  // Get badge color based on criticality
  const getCriticalityBadge = (criticality: string) => {
    switch (criticality) {
      case 'Alta':
        return <Badge className="bg-red-500 text-white text-xs h-5 px-2">{t('photo.criticalityHigh')}</Badge>;
      case 'Média':
        return <Badge className="bg-yellow-500 text-white text-xs h-5 px-2">{t('photo.criticalityMedium')}</Badge>;
      case 'Baixa':
        return <Badge className="bg-green-500 text-white text-xs h-5 px-2">{t('photo.criticalityLow')}</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="mt-3 p-3 bg-orange-50 rounded-lg border-2 border-orange-400 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-orange-800 font-bold flex items-center gap-2">
          <ListTree className="h-4 w-4" />
          {t('subparts.partsOf', { pn: parentPn || '...' })}
        </Label>
        <div className="flex items-center gap-1">
          {photoAdditionalParts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-green-600 hover:text-green-800"
              onClick={() => exportSubPartsToExcel(photoAdditionalParts, parentPn)}
            >
              <FileSpreadsheet className="h-3 w-3 mr-1" /> Baixar Excel
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-orange-600 hover:text-orange-800"
            onClick={() => setShowExcelPaste(!showExcelPaste)}
          >
            {showExcelPaste ? 'Manual' : 'Colar Excel'}
          </Button>
        </div>
      </div>
      
      {/* Excel Paste Mode */}
      {showExcelPaste && (
        <div className="space-y-2">
          <p className="text-xs text-orange-700">
            Cole os dados do Excel no formato: Part No. | Q'ty | Part name (uma linha por peça)
          </p>
          <Textarea
            className="min-h-[80px] text-sm"
            placeholder="4244836&#9;4&#9;BUCHA&#10;4244837&#9;2&#9;ANEL"
            value={excelPasteData}
            onChange={(e) => setExcelPasteData(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handlePasteExcel}
              disabled={!excelPasteData.trim()}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setExcelPasteData(''); setShowExcelPaste(false); }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
      
      {/* Manual Mode */}
      {!showExcelPaste && (
        <>
      
      {photoAdditionalParts.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {photoAdditionalParts.map((part) => (
            <div key={part.id} className="flex items-center gap-2 bg-white p-2 rounded border text-sm">
              <span className="text-orange-600 font-mono font-bold">└─</span>
              <span className="font-semibold text-gray-700">{part.pn}</span>
              {part.serialNumber && (
                <span className="text-gray-500">({part.serialNumber})</span>
              )}
              <span className="text-gray-600 flex-1 truncate">{part.partName}</span>
              <Badge variant="secondary" className="text-xs h-5 px-2">{t('photo.quantity')}: {part.quantity}</Badge>
              {getCriticalityBadge(part.criticality)}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0" onClick={() => onRemovePart(part.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Mobile layout - stacked */}
      <div className="md:hidden space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input className="h-11 text-base" placeholder="PN" value={newPn} onChange={(e) => setNewPn(e.target.value)} />
          <Input className="h-11 text-base" placeholder={t('photo.serialPlaceholder')} value={newSerialNumber} onChange={(e) => setNewSerialNumber(e.target.value)} />
        </div>
        <Input className="h-11 text-base" placeholder={t('photo.partNamePlaceholder')} value={newPartName} onChange={(e) => setNewPartName(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input className="h-11 text-base" placeholder={t('photo.quantityPlaceholder')} type="number" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} />
          <Select value={newCriticality} onValueChange={(v) => setNewCriticality(v as 'Alta' | 'Média' | 'Baixa' | '')}>
            <SelectTrigger className="h-11 text-base">
              <SelectValue placeholder={t('photo.criticality')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Alta">{t('photo.criticalityHigh')}</SelectItem>
              <SelectItem value="Média">{t('photo.criticalityMedium')}</SelectItem>
              <SelectItem value="Baixa">{t('photo.criticalityLow')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="lg" className="w-full h-12 bg-orange-500 hover:bg-orange-600" onClick={handleAddPart} disabled={!newPn.trim() || !newPartName.trim() || !newQuantity.trim()}>
          <Plus className="h-5 w-5 mr-2" /> {t('action.add')}
        </Button>
      </div>

      {/* Desktop layout - inline grid */}
      <div className="hidden md:grid grid-cols-12 gap-2">
        <Input className="h-8 text-sm col-span-2" placeholder="PN" value={newPn} onChange={(e) => setNewPn(e.target.value)} />
        <Input className="h-8 text-sm col-span-2" placeholder={t('photo.serialPlaceholder')} value={newSerialNumber} onChange={(e) => setNewSerialNumber(e.target.value)} />
        <Input className="h-8 text-sm col-span-2" placeholder={t('photo.partNamePlaceholder')} value={newPartName} onChange={(e) => setNewPartName(e.target.value)} />
        <Input className="h-8 text-sm col-span-2" placeholder={t('photo.quantityPlaceholder')} type="number" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} />
        <Select value={newCriticality} onValueChange={(v) => setNewCriticality(v as 'Alta' | 'Média' | 'Baixa' | '')}>
          <SelectTrigger className="h-8 text-xs col-span-2">
            <SelectValue placeholder={t('photo.criticality')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Alta">{t('photo.criticalityHigh')}</SelectItem>
            <SelectItem value="Média">{t('photo.criticalityMedium')}</SelectItem>
            <SelectItem value="Baixa">{t('photo.criticalityLow')}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="icon" className="h-8 w-8 bg-orange-500 hover:bg-orange-600 col-span-2" onClick={handleAddPart} disabled={!newPn.trim() || !newPartName.trim() || !newQuantity.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
        </>
      )}
    </div>
  );
}

// Tipo para modo de edição de foto
type PhotoEditMode = 'primary' | 'secondary' | 'dual';

// Editor de Foto
function PhotoEditor({
  photo,
  editMode = 'primary',
  onSave,
  onClose,
  t,
}: {
  photo: PhotoData;
  editMode?: PhotoEditMode;
  onSave: (data: Partial<PhotoData>) => void;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  
  const [objects, setObjects] = useState<EditorCircle[]>(() => {
    return (photo.embeddedPhotos || []).map(ep => ({
      id: ep.id,
      type: 'circleWithPhoto' as const,
      x: ep.circleX,
      y: ep.circleY,
      radius: ep.circleRadius,
      color: '#f97316',
      imageData: ep.imageData,
    }));
  });
  
  const [currentTool, setCurrentTool] = useState<'select' | 'circle' | 'circlePhoto' | 'arrow' | 'rectangle'>('select');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentColor, setCurrentColor] = useState('#f97316');
  const [circleRadius, setCircleRadius] = useState(80);
  const [showAddPhotoDialog, setShowAddPhotoDialog] = useState(false);
  const [pendingPhotoCircle, setPendingPhotoCircle] = useState<EditorCircle | null>(null);
  const [isDrawingArrow, setIsDrawingArrow] = useState(false);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);
  const [arrowPreview, setArrowPreview] = useState<{ x: number; y: number } | null>(null);
  const [isDrawingCircle, setIsDrawingCircle] = useState(false);
  const [circleStart, setCircleStart] = useState<{ x: number; y: number } | null>(null);
  const [circlePreview, setCirclePreview] = useState<{ x: number; y: number; radius: number } | null>(null);
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [rectPreview, setRectPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [rotation, setRotation] = useState(0);

  // Determinar qual imagem editar baseado no modo
  const getActiveImageSrc = () => {
    if (editMode === 'secondary') {
      return photo.secondaryImageData;
    }
    if (editMode === 'dual' && photo.imageData && photo.secondaryImageData) {
      // Criar imagem combinada lado a lado
      return null; // Será tratado separadamente
    }
    return photo.editedImageData || photo.imageData;
  };
  
  const imageSrc = getActiveImageSrc();
  const [dualCanvasSize, setDualCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0, scale: 1 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = Math.min(container.clientWidth - 32, 900);
    const containerHeight = 500;

    // Modo duplo: carregar ambas as imagens lado a lado
    if (editMode === 'dual' && photo.imageData && photo.secondaryImageData) {
      const img1 = new window.Image();
      const img2 = new window.Image();
      
      let loaded = 0;
      const checkLoaded = () => {
        loaded++;
        if (loaded === 2) {
          // Calcular dimensões para ambas as imagens lado a lado
          const halfWidth = containerWidth / 2 - 10;
          const scale1 = Math.min(halfWidth / img1.width, containerHeight / img1.height);
          const scale2 = Math.min(halfWidth / img2.width, containerHeight / img2.height);
          const scale = Math.min(scale1, scale2);
          
          const totalWidth = (img1.width + img2.width) * scale + 10;
          const totalHeight = Math.max(img1.height, img2.height) * scale;
          
          setCanvasSize({ width: totalWidth, height: totalHeight, scale });
          setDualCanvasSize({ width: img1.width * scale, height: img1.height * scale });
          
          // Criar imagem combinada temporária
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img1.width + img2.width;
          tempCanvas.height = Math.max(img1.height, img2.height);
          const ctx = tempCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img1, 0, 0);
            ctx.drawImage(img2, img1.width, 0);
          }
          
          const combinedImg = new window.Image();
          combinedImg.onload = () => {
            imgRef.current = combinedImg;
          };
          combinedImg.src = tempCanvas.toDataURL('image/png');
        }
      };
      
      img1.onload = checkLoaded;
      img2.onload = checkLoaded;
      img1.src = photo.imageData;
      img2.src = photo.secondaryImageData;
      return;
    }

    // Modo normal (primário ou secundário)
    if (!imageSrc) return;
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      let imgWidth = img.width;
      let imgHeight = img.height;
      // Swap dimensions for 90/270 degree rotation
      if (rotation === 90 || rotation === 270) {
        [imgWidth, imgHeight] = [imgHeight, imgWidth];
      }
      const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
      setCanvasSize({ width: imgWidth * scale, height: imgHeight * scale, scale });
    };
    img.src = imageSrc;
  }, [imageSrc, editMode, photo.imageData, photo.secondaryImageData, rotation]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imageSrc) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, scale } = canvasSize;
    canvas.width = width;
    canvas.height = height;
    ctx.save();
    if (rotation > 0) {
      ctx.translate(width / 2, height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);
    }
    ctx.drawImage(img, 0, 0, width, height);
    ctx.restore();

    objects.forEach((obj) => {
      const isSelected = obj.id === selectedObjectId;
      
      if (obj.type === 'circle' || obj.type === 'circleWithPhoto') {
        const x = obj.x * scale;
        const y = obj.y * scale;
        const radius = (obj.radius || 50) * scale;

        if (obj.type === 'circleWithPhoto' && obj.imageData) {
          const embeddedImg = new window.Image();
          embeddedImg.onload = () => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(embeddedImg, x - radius + 2, y - radius + 2, (radius - 2) * 2, (radius - 2) * 2);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = isSelected ? 4 : 3;
            ctx.stroke();
          };
          embeddedImg.src = obj.imageData;
        } else {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = obj.color;
          ctx.lineWidth = isSelected ? 4 : 3;
          ctx.stroke();
        }
      }
      
      if (obj.type === 'arrow') {
        const startX = obj.x * scale;
        const startY = obj.y * scale;
        const endX = (obj.endX || obj.x + 50) * scale;
        const endY = (obj.endY || obj.y + 50) * scale;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = isSelected ? 4 : 3;
        ctx.stroke();

        const angle = Math.atan2(endY - startY, endX - startX);
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 15 * Math.cos(angle - Math.PI / 6), endY - 15 * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 15 * Math.cos(angle + Math.PI / 6), endY - 15 * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    });

    // Rectangle objects
    objects.forEach((obj) => {
      if (obj.type === 'rectangle') {
        const isSelected = obj.id === selectedObjectId;
        const rx = obj.x * scale;
        const ry = obj.y * scale;
        const rw = (obj.width || 100) * scale;
        const rh = (obj.height || 80) * scale;
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = isSelected ? 4 : 3;
        ctx.strokeRect(rx, ry, rw, rh);
      }
    });

    if (isDrawingArrow && arrowStart && arrowPreview) {
      ctx.beginPath();
      ctx.moveTo(arrowStart.x * scale, arrowStart.y * scale);
      ctx.lineTo(arrowPreview.x * scale, arrowPreview.y * scale);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Circle drag preview
    if (isDrawingCircle && circleStart && circlePreview) {
      ctx.beginPath();
      ctx.arc(circlePreview.x * scale, circlePreview.y * scale, circlePreview.radius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Rectangle drag preview
    if (isDrawingRect && rectStart && rectPreview) {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(rectPreview.x * scale, rectPreview.y * scale, rectPreview.w * scale, rectPreview.h * scale);
      ctx.setLineDash([]);
    }
  }, [imageSrc, canvasSize, objects, selectedObjectId, isDrawingArrow, arrowStart, arrowPreview, currentColor, rotation, isDrawingCircle, circleStart, circlePreview, isDrawingRect, rectStart, rectPreview]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const getMousePos = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / canvasSize.scale, y: (e.clientY - rect.top) / canvasSize.scale };
  };

  // Touch position helper for mobile
  const getTouchPos = (e: React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return { x: (touch.clientX - rect.left) / canvasSize.scale, y: (touch.clientY - rect.top) / canvasSize.scale };
  };

  const findObjectAtPosition = (x: number, y: number): EditorCircle | null => {
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj.type === 'circle' || obj.type === 'circleWithPhoto') {
        const dist = Math.sqrt((x - obj.x) ** 2 + (y - obj.y) ** 2);
        if (dist <= (obj.radius || 50)) return obj;
      }
      if (obj.type === 'arrow') {
        const lineLength = Math.sqrt((obj.endX! - obj.x) ** 2 + (obj.endY! - obj.y) ** 2);
        const d1 = Math.sqrt((x - obj.x) ** 2 + (y - obj.y) ** 2);
        const d2 = Math.sqrt((x - obj.endX!) ** 2 + (y - obj.endY!) ** 2);
        if (d1 + d2 <= lineLength + 15) return obj;
      }
      if (obj.type === 'rectangle') {
        const rx = Math.min(obj.x, obj.x + (obj.width || 100));
        const ry = Math.min(obj.y, obj.y + (obj.height || 80));
        const rw = Math.abs(obj.width || 100);
        const rh = Math.abs(obj.height || 80);
        if (x >= rx - 10 && x <= rx + rw + 10 && y >= ry - 10 && y <= ry + rh + 10) return obj;
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (currentTool === 'select') {
      const obj = findObjectAtPosition(pos.x, pos.y);
      if (obj) {
        setSelectedObjectId(obj.id);
        setIsDragging(true);
        setDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y });
      } else {
        setSelectedObjectId(null);
      }
    } else if (currentTool === 'circle') {
      setIsDrawingCircle(true);
      setCircleStart(pos);
      setCirclePreview({ x: pos.x, y: pos.y, radius: 5 });
    } else if (currentTool === 'circlePhoto') {
      setPendingPhotoCircle({ id: `cp-${Date.now()}`, type: 'circleWithPhoto', x: pos.x, y: pos.y, radius: circleRadius, color: currentColor });
      setShowAddPhotoDialog(true);
    } else if (currentTool === 'arrow') {
      setIsDrawingArrow(true);
      setArrowStart(pos);
      setArrowPreview(pos);
    } else if (currentTool === 'rectangle') {
      setIsDrawingRect(true);
      setRectStart(pos);
      setRectPreview({ x: pos.x, y: pos.y, w: 1, h: 1 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (isDragging && selectedObjectId) {
      setObjects(prev => prev.map(obj => {
        if (obj.id !== selectedObjectId) return obj;
        const newX = pos.x - dragOffset.x;
        const newY = pos.y - dragOffset.y;
        if (obj.type === 'arrow') {
          const dx = obj.endX! - obj.x;
          const dy = obj.endY! - obj.y;
          return { ...obj, x: newX, y: newY, endX: newX + dx, endY: newY + dy };
        }
        if (obj.type === 'rectangle') {
          return { ...obj, x: newX, y: newY };
        }
        return { ...obj, x: newX, y: newY };
      }));
    }
    if (isDrawingArrow) setArrowPreview(pos);
    if (isDrawingCircle && circleStart) {
      const dist = Math.sqrt((pos.x - circleStart.x) ** 2 + (pos.y - circleStart.y) ** 2);
      setCirclePreview({ x: circleStart.x, y: circleStart.y, radius: dist });
    }
    if (isDrawingRect && rectStart) {
      setRectPreview({ x: rectStart.x, y: rectStart.y, w: pos.x - rectStart.x, h: pos.y - rectStart.y });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (isDragging) setIsDragging(false);
    if (isDrawingCircle && circleStart && currentTool === 'circle') {
      const dist = Math.sqrt((pos.x - circleStart.x) ** 2 + (pos.y - circleStart.y) ** 2);
      const finalRadius = dist > 10 ? dist : circleRadius;
      const newCircle: EditorCircle = { id: `circle-${Date.now()}`, type: 'circle', x: circleStart.x, y: circleStart.y, radius: finalRadius, color: currentColor };
      setObjects(prev => [...prev, newCircle]);
      setSelectedObjectId(newCircle.id);
      setIsDrawingCircle(false);
      setCircleStart(null);
      setCirclePreview(null);
      setCurrentTool('select');
    }
    if (isDrawingRect && rectStart && currentTool === 'rectangle') {
      const w = pos.x - rectStart.x;
      const h = pos.y - rectStart.y;
      if (Math.abs(w) > 10 && Math.abs(h) > 10) {
        const newRect: EditorCircle = { id: `rect-${Date.now()}`, type: 'rectangle', x: rectStart.x, y: rectStart.y, width: w, height: h, color: currentColor };
        setObjects(prev => [...prev, newRect]);
        setSelectedObjectId(newRect.id);
      }
      setIsDrawingRect(false);
      setRectStart(null);
      setRectPreview(null);
      setCurrentTool('select');
    }
    if (isDrawingArrow && arrowStart && currentTool === 'arrow') {
      const distance = Math.sqrt((pos.x - arrowStart.x) ** 2 + (pos.y - arrowStart.y) ** 2);
      if (distance > 10) {
        const newArrow: EditorCircle = { id: `arrow-${Date.now()}`, type: 'arrow', x: arrowStart.x, y: arrowStart.y, endX: pos.x, endY: pos.y, color: currentColor };
        setObjects(prev => [...prev, newArrow]);
        setSelectedObjectId(newArrow.id);
      }
      setIsDrawingArrow(false);
      setArrowStart(null);
      setArrowPreview(null);
      setCurrentTool('select');
    }
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const pos = getTouchPos(e);
    if (currentTool === 'select') {
      const obj = findObjectAtPosition(pos.x, pos.y);
      if (obj) {
        setSelectedObjectId(obj.id);
        setIsDragging(true);
        setDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y });
      } else {
        setSelectedObjectId(null);
      }
    } else if (currentTool === 'circle') {
      setIsDrawingCircle(true);
      setCircleStart(pos);
      setCirclePreview({ x: pos.x, y: pos.y, radius: 5 });
    } else if (currentTool === 'circlePhoto') {
      setPendingPhotoCircle({ id: `cp-${Date.now()}`, type: 'circleWithPhoto', x: pos.x, y: pos.y, radius: circleRadius, color: currentColor });
      setShowAddPhotoDialog(true);
    } else if (currentTool === 'arrow') {
      setIsDrawingArrow(true);
      setArrowStart(pos);
      setArrowPreview(pos);
    } else if (currentTool === 'rectangle') {
      setIsDrawingRect(true);
      setRectStart(pos);
      setRectPreview({ x: pos.x, y: pos.y, w: 1, h: 1 });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const pos = getTouchPos(e);
    if (isDragging && selectedObjectId) {
      setObjects(prev => prev.map(obj => {
        if (obj.id !== selectedObjectId) return obj;
        const newX = pos.x - dragOffset.x;
        const newY = pos.y - dragOffset.y;
        if (obj.type === 'arrow') {
          const dx = obj.endX! - obj.x;
          const dy = obj.endY! - obj.y;
          return { ...obj, x: newX, y: newY, endX: newX + dx, endY: newY + dy };
        }
        if (obj.type === 'rectangle') {
          return { ...obj, x: newX, y: newY };
        }
        return { ...obj, x: newX, y: newY };
      }));
    }
    if (isDrawingArrow) setArrowPreview(pos);
    if (isDrawingCircle && circleStart) {
      const dist = Math.sqrt((pos.x - circleStart.x) ** 2 + (pos.y - circleStart.y) ** 2);
      setCirclePreview({ x: circleStart.x, y: circleStart.y, radius: dist });
    }
    if (isDrawingRect && rectStart) {
      setRectPreview({ x: rectStart.x, y: rectStart.y, w: pos.x - rectStart.x, h: pos.y - rectStart.y });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isDragging) setIsDragging(false);
    if (isDrawingCircle && circleStart && currentTool === 'circle') {
      const pos = circlePreview || circleStart;
      const dist = Math.sqrt((pos.x - circleStart.x) ** 2 + (pos.y - circleStart.y) ** 2);
      const finalRadius = dist > 10 ? dist : circleRadius;
      const newCircle: EditorCircle = { id: `circle-${Date.now()}`, type: 'circle', x: circleStart.x, y: circleStart.y, radius: finalRadius, color: currentColor };
      setObjects(prev => [...prev, newCircle]);
      setSelectedObjectId(newCircle.id);
      setIsDrawingCircle(false);
      setCircleStart(null);
      setCirclePreview(null);
      setCurrentTool('select');
    }
    if (isDrawingRect && rectStart && currentTool === 'rectangle') {
      const preview = rectPreview || { x: rectStart.x, y: rectStart.y, w: 0, h: 0 };
      if (Math.abs(preview.w) > 10 && Math.abs(preview.h) > 10) {
        const newRect: EditorCircle = { id: `rect-${Date.now()}`, type: 'rectangle', x: rectStart.x, y: rectStart.y, width: preview.w, height: preview.h, color: currentColor };
        setObjects(prev => [...prev, newRect]);
        setSelectedObjectId(newRect.id);
      }
      setIsDrawingRect(false);
      setRectStart(null);
      setRectPreview(null);
      setCurrentTool('select');
    }
    if (isDrawingArrow && arrowStart && currentTool === 'arrow') {
      const pos = arrowPreview || arrowStart;
      const distance = Math.sqrt((pos.x - arrowStart.x) ** 2 + (pos.y - arrowStart.y) ** 2);
      if (distance > 10) {
        const newArrow: EditorCircle = { id: `arrow-${Date.now()}`, type: 'arrow', x: arrowStart.x, y: arrowStart.y, endX: pos.x, endY: pos.y, color: currentColor };
        setObjects(prev => [...prev, newArrow]);
        setSelectedObjectId(newArrow.id);
      }
      setIsDrawingArrow(false);
      setArrowStart(null);
      setArrowPreview(null);
      setCurrentTool('select');
    }
  };

  const handleAddPhotoToCircle = (file: File) => {
    if (!pendingPhotoCircle) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setObjects(prev => [...prev, { ...pendingPhotoCircle, imageData }]);
      setPendingPhotoCircle(null);
      setShowAddPhotoDialog(false);
      setCurrentTool('select');
    };
    reader.readAsDataURL(file);
  };

  const deleteSelected = () => {
    if (selectedObjectId) {
      setObjects(prev => prev.filter(obj => obj.id !== selectedObjectId));
      setSelectedObjectId(null);
    }
  };

  const resizeSelected = (delta: number) => {
    if (selectedObjectId) {
      setObjects(prev => prev.map(obj => {
        if (obj.id !== selectedObjectId) return obj;
        if (obj.type === 'rectangle') {
          return { ...obj, width: Math.max(20, (obj.width || 100) + delta * 1.5), height: Math.max(20, (obj.height || 80) + delta * 1.5) };
        }
        if (!obj.radius) return obj;
        return { ...obj, radius: Math.max(20, Math.min(200, obj.radius + delta)) };
      }));
    }
  };

  const handleSave = () => {
    const embeddedPhotos: EmbeddedPhoto[] = objects.filter(obj => obj.type === 'circleWithPhoto' && obj.imageData).map(obj => ({ id: obj.id, circleX: obj.x, circleY: obj.y, circleRadius: obj.radius || 50, imageData: obj.imageData! }));
    
    // Exportar canvas como imagem editada
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        const canvasData = canvas.toDataURL('image/png');
        if (editMode === 'secondary') {
          onSave({ embeddedPhotos, secondaryImageData: canvasData });
        } else {
          onSave({ embeddedPhotos, editedImageData: canvasData });
        }
      } catch (error) {
        console.error('Error exporting canvas:', error);
        onSave({ embeddedPhotos });
      }
    } else {
      onSave({ embeddedPhotos });
    }
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId && !showAddPhotoDialog) { e.preventDefault(); deleteSelected(); }
      if (e.key === 'Escape') { setSelectedObjectId(null); setCurrentTool('select'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, showAddPhotoDialog]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-3 md:p-4 border-b">
          <h3 className="text-base md:text-lg font-semibold flex items-center gap-2"><Edit className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />Editor de Foto</h3>
          <Button variant="ghost" size="icon" className="h-10 w-10 md:h-8 md:w-8" onClick={onClose}><X className="h-5 w-5 md:h-4 md:w-4" /></Button>
        </div>
        
        {/* Mobile Tools - Horizontal scroll */}
        <div className="md:hidden flex items-center gap-2 p-2 border-b bg-gray-50 overflow-x-auto">
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant={currentTool === 'select' ? "default" : "outline"} size="sm" className={`h-10 w-10 p-0 ${currentTool === 'select' ? "bg-orange-500 hover:bg-orange-600" : ""}`} onClick={() => setCurrentTool('select')}><MousePointer className="h-5 w-5" /></Button>
            <Button variant={currentTool === 'circle' ? "default" : "outline"} size="sm" className={`h-10 w-10 p-0 ${currentTool === 'circle' ? "bg-orange-500 hover:bg-orange-600" : ""}`} onClick={() => setCurrentTool('circle')}><Circle className="h-5 w-5" /></Button>
            <Button variant={currentTool === 'circlePhoto' ? "default" : "outline"} size="sm" className={`h-10 w-10 p-0 ${currentTool === 'circlePhoto' ? "bg-orange-500 hover:bg-orange-600" : ""}`} onClick={() => setCurrentTool('circlePhoto')}><div className="relative"><Circle className="h-5 w-5" /><Camera className="h-3 w-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div></Button>
            <Button variant={currentTool === 'arrow' ? "default" : "outline"} size="sm" className={`h-10 w-10 p-0 ${currentTool === 'arrow' ? "bg-orange-500 hover:bg-orange-600" : ""}`} onClick={() => setCurrentTool('arrow')}><ArrowUpRight className="h-5 w-5" /></Button>
            <Button variant={currentTool === 'rectangle' ? "default" : "outline"} size="sm" className={`h-10 w-10 p-0 ${currentTool === 'rectangle' ? "bg-orange-500 hover:bg-orange-600" : ""}`} onClick={() => setCurrentTool('rectangle')}><Square className="h-5 w-5" /></Button>
            <Button variant="outline" size="sm" className="h-10 w-10 p-0" onClick={() => setRotation((rotation + 90) % 360)} title="Girar 90°">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            </Button>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#ffffff', '#000000'].map(color => (
              <button key={color} className={`w-8 h-8 rounded border-2 ${currentColor === color ? 'border-orange-500' : 'border-gray-300'}`} style={{ backgroundColor: color }} onClick={() => setCurrentColor(color)} />
            ))}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2 border-l pl-2">
            <input
              type="range"
              min="20"
              max="200"
              value={circleRadius}
              onChange={(e) => setCircleRadius(Number(e.target.value))}
              className="w-20 h-2 accent-orange-500"
            />
            <span className="text-xs text-gray-600">{circleRadius}</span>
          </div>
          {selectedObjectId && (
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <Button variant="outline" size="sm" className="h-10 w-10 p-0" onClick={() => resizeSelected(-10)}>-</Button>
              <Button variant="outline" size="sm" className="h-10 w-10 p-0" onClick={() => resizeSelected(10)}>+</Button>
              <Button variant="destructive" size="sm" className="h-10 w-10 p-0" onClick={deleteSelected}><Trash2 className="h-5 w-5" /></Button>
            </div>
          )}
        </div>

        {/* Desktop Tools */}
        <div className="hidden md:flex items-center gap-2 p-3 border-b bg-gray-50 flex-wrap">
          <div className="flex items-center gap-1 border-r pr-3">
            <Button variant={currentTool === 'select' ? "default" : "outline"} size="sm" className={currentTool === 'select' ? "bg-orange-500 hover:bg-orange-600" : ""} onClick={() => setCurrentTool('select')}><MousePointer className="h-4 w-4" /></Button>
            <Button variant={currentTool === 'circle' ? "default" : "outline"} size="sm" className={currentTool === 'circle' ? "bg-orange-500 hover:bg-orange-600" : ""} onClick={() => setCurrentTool('circle')}><Circle className="h-4 w-4" /></Button>
            <Button variant={currentTool === 'circlePhoto' ? "default" : "outline"} size="sm" className={currentTool === 'circlePhoto' ? "bg-orange-500 hover:bg-orange-600" : ""} onClick={() => setCurrentTool('circlePhoto')}><div className="relative"><Circle className="h-4 w-4" /><Camera className="h-2.5 w-2.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div></Button>
            <Button variant={currentTool === 'arrow' ? "default" : "outline"} size="sm" className={currentTool === 'arrow' ? "bg-orange-500 hover:bg-orange-600" : ""} onClick={() => setCurrentTool('arrow')}><ArrowUpRight className="h-4 w-4" /></Button>
            <Button variant={currentTool === 'rectangle' ? "default" : "outline"} size="sm" className={currentTool === 'rectangle' ? "bg-orange-500 hover:bg-orange-600" : ""} onClick={() => setCurrentTool('rectangle')}><Square className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setRotation((rotation + 90) % 360)} title="Girar 90°">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              <span className="ml-1 text-xs">Girar</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500">Cor:</Label>
            {['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#ffffff', '#000000'].map(color => (
              <button key={color} className={`w-6 h-6 rounded border-2 ${currentColor === color ? 'border-orange-500' : 'border-gray-300'}`} style={{ backgroundColor: color }} onClick={() => setCurrentColor(color)} />
            ))}
          </div>
          <div className="flex items-center gap-2 border-l pl-3">
            <Label className="text-xs text-gray-500">Tamanho:</Label>
            <input
              type="range"
              min="20"
              max="200"
              value={circleRadius}
              onChange={(e) => setCircleRadius(Number(e.target.value))}
              className="w-24 h-2 accent-orange-500"
            />
            <span className="text-xs text-gray-600 w-8">{circleRadius}px</span>
          </div>
          {selectedObjectId && (
            <div className="flex items-center gap-2 border-l pl-3">
              <Button variant="outline" size="sm" onClick={() => resizeSelected(-10)}>-</Button>
              <Button variant="outline" size="sm" onClick={() => resizeSelected(10)}>+</Button>
              <Button variant="destructive" size="sm" onClick={deleteSelected}><Trash2 className="h-4 w-4" /></Button>
            </div>
          )}
          <div className="ml-auto text-xs text-gray-500">
            {currentTool === 'select' && 'Clique para selecionar, arraste para mover'}
            {currentTool === 'circle' && 'Clique e arraste para desenhar círculo'}
            {currentTool === 'circlePhoto' && 'Clique para adicionar círculo com foto'}
            {currentTool === 'arrow' && 'Clique e arraste para desenhar seta'}
            {currentTool === 'rectangle' && 'Clique e arraste para desenhar retângulo'}
          </div>
        </div>

        {/* Mobile instructions */}
        {selectedObjectId && (
          <div className="md:hidden text-center text-xs text-orange-600 py-2 bg-orange-50">
            Objeto selecionado • Use os botões + e - para redimensionar
          </div>
        )}
        
        <div ref={containerRef} className="flex-1 overflow-auto p-2 md:p-4 flex justify-center bg-gray-100">
          {imageSrc ? (
            <canvas 
              ref={canvasRef} 
              className="border rounded shadow-lg cursor-crosshair touch-none max-w-full" 
              onMouseDown={handleMouseDown} 
              onMouseMove={handleMouseMove} 
              onMouseUp={handleMouseUp} 
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ width: canvasSize.width, height: canvasSize.height }} 
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">Nenhuma foto para editar</div>
          )}
        </div>
        
        <div className="flex justify-between items-center gap-2 p-3 md:p-4 border-t bg-white">
          <p className="text-xs text-gray-500 hidden md:block">Delete para remover • Esc para cancelar</p>
          <p className="text-xs text-gray-500 md:hidden">Toque no objeto para selecionar</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="min-h-[44px] h-11 px-6">Cancelar</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 min-h-[44px] h-11 px-6" onClick={handleSave}><Check className="h-5 w-5 mr-2" />Salvar</Button>
          </div>
        </div>
      </div>
      <Dialog open={showAddPhotoDialog} onOpenChange={(open) => { setShowAddPhotoDialog(open); if (!open) { setPendingPhotoCircle(null); setCurrentTool('select'); } }}>
        <DialogContent className="max-w-[90vw]">
          <DialogHeader><DialogTitle>Adicionar Foto ao Círculo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Escolha uma foto:</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) handleAddPhotoToCircle(file); };
                input.click();
              }}><Upload className="h-5 w-5 mr-2" />Upload</Button>
              <Button variant="outline" className="flex-1 h-12" onClick={async () => {
                try {
                  const items = await navigator.clipboard.read();
                  for (const item of items) { for (const type of item.types) { if (type.startsWith('image/')) { const blob = await item.getType(type); handleAddPhotoToCircle(blob as File); } } }
                } catch (err) { console.error('Failed to paste:', err); }
              }}><Camera className="h-5 w-5 mr-2" />Colar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Função para gerar imagem preta com número de série
function generateSerialNumberImage(serialNumber: string | undefined): string | null {
  if (!serialNumber || serialNumber.trim() === '') return null;
  
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return null;
  
  // Fundo preto
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Texto branco
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Desenhar o número de série
  ctx.fillText(serialNumber.trim(), canvas.width / 2, canvas.height / 2);
  
  return canvas.toDataURL('image/png');
}

// Componente para foto de identificação
function IdentificationPhoto({
  label,
  imageData,
  onUpload,
  onRemove,
  caption,
  t,
}: {
  label: string;
  imageData: string | null;
  onUpload: (data: string) => void;
  onRemove: () => void;
  caption?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { onUpload(e.target?.result as string); };
    reader.readAsDataURL(file);
  };

  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      console.error('Erro ao abrir câmera:', err);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const handleCapturePhoto = () => {
    const video = document.getElementById('camera-video-identification') as HTMLVideoElement;
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/png');
      onUpload(imageData);
    }
    
    // Stop camera
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const handleCloseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (e) => { onUpload(e.target?.result as string); };
            reader.readAsDataURL(blob);
          }
        }
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="p-2 bg-orange-500 text-white text-center font-semibold text-sm">{label}</div>
        <div 
          className="relative h-28 md:h-32 bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors active:bg-gray-300" 
          onClick={() => setShowOptions(true)}
        >
          {imageData ? (
            <>
              <img src={imageData} alt={label} className="absolute inset-0 w-full h-full object-cover" />
              <Button 
                size="icon" 
                className="absolute top-1 right-1 rounded-full bg-red-600 hover:bg-red-700 h-8 w-8 md:h-6 md:w-6" 
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
              >
                <X className="h-4 w-4 md:h-3 md:w-3" />
              </Button>
            </>
          ) : (
            <div className="text-center text-gray-400">
              <Camera className="h-8 w-8 mx-auto mb-1" />
              <p className="text-xs">{t('photos.clickToAdd')}</p>
            </div>
          )}
        </div>
        {caption && <div className="p-2 bg-gray-50 text-center text-xs text-gray-600 min-h-[32px]">{caption}</div>}
      </Card>

      {/* Photo Options Dialog */}
      <PhotoOptionsDialog
        open={showOptions}
        onOpenChange={setShowOptions}
        hasImage={!!imageData}
        onUpload={handleFileUpload}
        onCamera={handleOpenCamera}
        onPaste={handlePaste}
        onViewFullscreen={() => setShowFullscreen(true)}
        t={t}
      />

      {/* Fullscreen Viewer */}
      {showFullscreen && imageData && (
        <FullScreenImageViewer
          imageData={imageData}
          onClose={() => setShowFullscreen(false)}
          t={t}
        />
      )}

      {/* Camera Dialog */}
      {showCamera && cameraStream && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <div className="flex justify-between items-center p-3 md:p-4 bg-black/50">
            <span className="text-white font-semibold text-sm md:text-base">{label}</span>
            <Button variant="ghost" size="icon" className="text-white h-10 w-10" onClick={handleCloseCamera}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex-1 relative">
            <video
              id="camera-video-identification"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              ref={(video) => {
                if (video && cameraStream) {
                  video.srcObject = cameraStream;
                }
              }}
            />
          </div>
          <div className="p-4 md:p-6 flex justify-center bg-black/50">
            <Button 
              size="lg"
              className="rounded-full h-16 w-16 md:h-14 md:w-14 bg-white text-black hover:bg-gray-200"
              onClick={handleCapturePhoto}
            >
              <Camera className="h-8 w-8 md:h-7 md:w-7" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// ABA HOME - Com Categorias
// ============================================
function HomeContent({ reportId, onRegenerateId }: { reportId: string; onRegenerateId: () => void }) {
  const {
    inspection,
    categories,
    conclusion,
    updateInspection,
    setCategories,
    addPhotoToCategory,
    removePhotoFromCategory,
    updatePhotoInCategory,
    movePhotoInCategory,
    addAdditionalPartToCategory,
    removeAdditionalPartFromCategory,
    updateAdditionalPartsParentPn,
    setConclusion,
    clearAll,
  } = useHomeReportStore();
  
  const { language, t } = useTranslation();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [showPhotoOptions, setShowPhotoOptions] = useState<{ categoryId: string; photoId: string } | null>(null);
  const [showAdditionalParts, setShowAdditionalParts] = usePersistedState<Record<string, boolean>>('home-subparts-open', {});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<{ categoryId: string; photo: PhotoData; editMode: 'primary' | 'secondary' | 'dual' } | null>(null);
  const [showMovePhotoDialog, setShowMovePhotoDialog] = useState<{ categoryId: string; photoId: string; currentIndex: number } | null>(null);
  const [movePhotoToIndex, setMovePhotoToIndex] = useState(0);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<{ categoryId: string; photoId: string } | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0, status: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);
  // Função para traduzir todos os textos dinâmicos - HomeContent
  const handleTranslateAllHome = async (targetLang: Language) => {
    setShowTranslateDialog(true);
    setIsTranslating(true);
    
    try {
      // Coletar todos os textos para traduzir
      const textItems: { id: string; text: string; type: string }[] = [];
      
      // Textos da inspeção
      if (inspection.descricao?.trim()) {
        textItems.push({ id: 'inspection.descricao', text: inspection.descricao, type: 'inspection' });
      }
      if (inspection.osExecucao?.trim()) {
        textItems.push({ id: 'inspection.osExecucao', text: inspection.osExecucao, type: 'inspection' });
      }
      if (inspection.inspetor?.trim()) {
        textItems.push({ id: 'inspection.inspetor', text: inspection.inspetor, type: 'inspection' });
      }
      if (inspection.cliente?.trim()) {
        textItems.push({ id: 'inspection.cliente', text: inspection.cliente, type: 'inspection' });
      }
      
      // Textos das categorias e fotos
      categories.forEach((category) => {
        category.photos.forEach((photo) => {
          if (photo.description?.trim()) {
            textItems.push({ id: `photo.${category.id}.${photo.id}.description`, text: photo.description, type: 'photo' });
          }
          if (photo.partName?.trim()) {
            textItems.push({ id: `photo.${category.id}.${photo.id}.partName`, text: photo.partName, type: 'photo' });
          }
        });
        
        // Peças adicionais
        category.additionalParts?.forEach((part) => {
          if (part.partName?.trim()) {
            textItems.push({ id: `part.${category.id}.${part.id}.partName`, text: part.partName, type: 'part' });
          }
        });
      });
      
      // Conclusão
      if (conclusion?.trim()) {
        textItems.push({ id: 'conclusion', text: conclusion, type: 'conclusion' });
      }
      
      const total = textItems.length;
      setTranslateProgress({ current: 0, total, status: `Encontrados ${total} textos para traduzir` });
      
      if (total === 0) {
        alert('Nenhum texto encontrado para traduzir!');
        setShowTranslateDialog(false);
        setIsTranslating(false);
        return;
      }
      
      // Enviar todos os textos para tradução
      setTranslateProgress({ current: 0, total, status: 'Enviando para API de tradução...' });
      
      const response = await fetch('/api/translate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: textItems.map(item => item.text),
          targetLanguage: targetLang,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro na API: ${response.status}`);
      }
      
      const data = await response.json();
      const translations: string[] = data.translations || [];
      
      setTranslateProgress({ current: total, total, status: 'Aplicando traduções...' });
      
      // Aplicar traduções de volta
      for (let i = 0; i < textItems.length; i++) {
        const item = textItems[i];
        const translation = translations[i] || item.text;
        
        if (item.id === 'inspection.descricao') {
          updateInspection({ descricao: translation });
        } else if (item.id === 'inspection.osExecucao') {
          updateInspection({ osExecucao: translation });
        } else if (item.id === 'inspection.inspetor') {
          updateInspection({ inspetor: translation });
        } else if (item.id === 'inspection.cliente') {
          updateInspection({ cliente: translation });
        } else if (item.id === 'conclusion') {
          setConclusion(translation);
        } else if (item.id.startsWith('photo.')) {
          const [, categoryId, photoId, field] = item.id.split('.');
          if (field === 'description') {
            updatePhotoInCategory(categoryId, photoId, { description: translation });
          } else if (field === 'partName') {
            updatePhotoInCategory(categoryId, photoId, { partName: translation });
          }
        } else if (item.id.startsWith('part.')) {
          const [, categoryId, partId] = item.id.split('.');
          const category = categories.find(c => c.id === categoryId);
          if (category) {
            const partIndex = category.additionalParts?.findIndex(p => p.id === partId) ?? -1;
            if (partIndex !== -1 && category.additionalParts) {
              const updatedParts = [...category.additionalParts];
              updatedParts[partIndex] = { ...updatedParts[partIndex], partName: translation };
              // Update via store if available, otherwise skip
            }
          }
        }
      }
      
      setTranslateProgress({ current: total, total, status: 'Tradução concluída!' });
      
      setTimeout(() => {
        setShowTranslateDialog(false);
        alert(`✅ Tradução concluída!\n\n${total} textos traduzidos para ${LANGUAGE_NAMES[targetLang]}`);
      }, 500);
      
    } catch (error) {
      console.error('Erro ao traduzir:', error);
      alert('Erro ao traduzir o conteúdo: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      setShowTranslateDialog(false);
    }
    setIsTranslating(false);
  };

  // Função para abrir o diálogo de tradução
  const handleTranslateContentHome = () => {
    setShowTranslateDialog(true);
  };

  const handleTagChange = (tag: string) => {
    updateInspection({ tag });
    if (tag && MACHINE_DATA[tag]) {
      const machine = MACHINE_DATA[tag];
      updateInspection({ modelo: machine.modelo, sn: machine.sn, entrega: machine.entrega, cliente: machine.cliente });
    }
  };

  const handlePhotoUpload = (categoryId: string, photoId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { updatePhotoInCategory(categoryId, photoId, { imageData: e.target?.result as string, editedImageData: null }); };
    reader.readAsDataURL(file);
    setShowPhotoOptions(null);
  };

  const handlePaste = useCallback(async (categoryId: string, photoId: string) => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (e) => { updatePhotoInCategory(categoryId, photoId, { imageData: e.target?.result as string, editedImageData: null }); };
            reader.readAsDataURL(blob);
          }
        }
      }
    } catch (err) { console.error('Failed to paste:', err); }
    setShowPhotoOptions(null);
  }, [updatePhotoInCategory]);

  // Camera functions
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      console.error('Erro ao abrir câmera:', err);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCameraTarget(null);
  };

  const capturePhoto = () => {
    const video = document.getElementById('camera-video-home') as HTMLVideoElement;
    if (!video || !cameraTarget) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/png');
      updatePhotoInCategory(cameraTarget.categoryId, cameraTarget.photoId, { imageData, editedImageData: null });
    }
    
    closeCamera();
    setShowPhotoOptions(null);
  };

  // Ctrl+V listener removido - colar foto apenas pelo botão "Colar da área de transferência"

  const handleClearReport = () => { clearAll(); setShowClearConfirm(false); onRegenerateId(); };

  const handleExport = () => {
    // Export ALL data including photos (base64), categories, inspection, conclusion
    const data = { 
      version: '1.0',
      exportDate: new Date().toISOString(),
      inspection, 
      categories, 
      conclusion 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatorio_${sanitizeForFilename(inspection.descricao || inspection.tag)}_${reportId}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Check if there's existing data that might conflict
    const hasExistingData = inspection.tag || inspection.cliente || categories.some(cat => 
      cat.photos.some(p => p.imageData || p.pn || p.description || p.partName) || 
      cat.additionalParts.length > 0
    ) || conclusion;
    if (hasExistingData) {
      if (!confirm('Já existe um relatório em andamento. Deseja substituí-lo pelo arquivo importado? Os dados atuais serão perdidos.')) {
        e.target.value = '';
        return;
      }
      // Clear existing data before importing to prevent conflicts
      clearAll();
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        // Import inspection data
        if (data.inspection) {
          Object.keys(data.inspection).forEach(key => {
            updateInspection({ [key]: data.inspection[key] });
          });
        }
        // Import categories with all photos and additional parts
        if (data.categories && Array.isArray(data.categories)) {
          // Fix sub-part associations: set photoId on sub-parts
          data.categories.forEach((cat: any) => {
            if (cat.additionalParts && cat.additionalParts.length > 0) {
              cat.additionalParts.forEach((ap: any) => {
                if (ap.parentPn) {
                  const match = cat.photos.find((p: any) => p.pn === ap.parentPn);
                  if (match) ap.photoId = match.id;
                }
              });
            }
          });

          setCategories(data.categories);
          // Auto-expand sub-parts sections for photos that have them
          const expandMap: Record<string, boolean> = {};
          data.categories.forEach((cat: any) => {
            if (cat.additionalParts && cat.additionalParts.length > 0) {
              cat.photos.forEach((photo: any) => {
                const hasSub = photoHasSubPartData(photo, cat.additionalParts);
                if (hasSub) expandMap[`${cat.id}-${photo.id}`] = true;
              });
            }
          });
          if (Object.keys(expandMap).length > 0) {
            setShowAdditionalParts(prev => ({ ...prev, ...expandMap }));
          }
        }
        // Import conclusion
        if (data.conclusion !== undefined) setConclusion(data.conclusion);
      } catch (err) { 
        console.error('Failed to import:', err);
        alert('Erro ao importar arquivo. Verifique se o arquivo é válido.');
      }
      // Reset input to allow re-importing same file
      e.target.value = '';
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo.');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Função para mover foto para posição específica
  const handleMovePhotoToPosition = () => {
    if (movePhotoFromIndex === null) return;
    if (movePhotoFromIndex === movePhotoToIndex) {
      setShowMovePhotoDialog(false);
      setMovePhotoFromIndex(null);
      return;
    }
    
    movePhoto(movePhotoFromIndex, movePhotoToIndex);
    setShowMovePhotoDialog(false);
    setMovePhotoFromIndex(null);
  };

  const handleGeneratePPT = async () => {
    setIsLoading(true);
    try {
      // Translate dynamic texts if not in Portuguese
      if (language !== 'pt') {
        const { translateDynamic, translateDynamicBatch } = useTranslationStore.getState();
        
        // Translate all inspection text fields
        const translatedInspection = { ...inspection };
        if (inspection.descricao) {
          translatedInspection.descricao = await translateDynamic(inspection.descricao);
        }
        if (inspection.osExecucao) {
          translatedInspection.osExecucao = await translateDynamic(inspection.osExecucao);
        }
        if (inspection.inspetor) {
          translatedInspection.inspetor = await translateDynamic(inspection.inspetor);
        }
        if (inspection.cliente) {
          translatedInspection.cliente = await translateDynamic(inspection.cliente);
        }
        
        // Translate all category photos
        const translatedCategories = await Promise.all(categories.map(async (category) => {
          const translatedPhotos = await Promise.all(category.photos.map(async (photo) => {
            const translatedPhoto = { ...photo };
            if (photo.description) {
              translatedPhoto.description = await translateDynamic(photo.description);
            }
            if (photo.partName) {
              translatedPhoto.partName = await translateDynamic(photo.partName);
            }
            return translatedPhoto;
          }));
          
          const translatedAdditionalParts = await Promise.all(category.additionalParts.map(async (part) => {
            const translatedPart = { ...part };
            if (part.partName) {
              translatedPart.partName = await translateDynamic(part.partName);
            }
            return translatedPart;
          }));
          
          return {
            ...category,
            photos: translatedPhotos,
            additionalParts: translatedAdditionalParts,
          };
        }));
        
        // Translate conclusion
        const translatedConclusion = conclusion ? await translateDynamic(conclusion) : conclusion;
        
        await generateHomePowerPoint({ 
          inspection: translatedInspection, 
          categories: translatedCategories, 
          conclusion: translatedConclusion,
          language,
          reportId
        });
        // Auto-download Excel parts table
        exportPartsTableToExcelHome(translatedInspection, translatedCategories, reportId);
      } else {
        await generateHomePowerPoint({ inspection, categories, conclusion, language: 'pt', reportId });
        // Auto-download Excel parts table
        exportPartsTableToExcelHome(inspection, categories, reportId);
      }
    } catch (error) { 
      console.error('Error generating PowerPoint:', error); 
    }
    setIsLoading(false);
  };

  // Email handlers
  const handleSendAnalysisEmail = () => {
    const subject = generateEmailSubject(inspection, 'analysis', reportId);
    const body = generateAnalysisEmailBody(inspection, [], [], categories, reportId);
    openEmailClient({
      to: EMAIL_CONFIG.analysisRecipients,
      cc: EMAIL_CONFIG.analysisCc,
      subject,
      body,
    });
    setShowEmailDialog(false);
  };

  const handleSendConclusionEmail = () => {
    const subject = generateEmailSubject(inspection, 'conclusion', reportId);
    const body = generateConclusionEmailBody(inspection, conclusion, [], [], categories, reportId);
    openEmailClient({
      to: EMAIL_CONFIG.conclusionRecipients,
      cc: EMAIL_CONFIG.conclusionCc,
      subject,
      body,
    });
    setShowEmailDialog(false);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  return (
    <>
      {/* Action Buttons - Responsivo */}
      <div className="fixed top-20 right-4 md:flex flex-col gap-2 z-40 hidden">
        <Button size="icon" className="rounded-full bg-red-600 hover:bg-red-700" onClick={() => setShowClearConfirm(true)} title={t('action.clear')}><Trash2 className="h-5 w-5" /></Button>
        
        {/* Botão de Traduzir */}
        <Button 
          size="icon" 
          className="rounded-full bg-cyan-600 hover:bg-cyan-700" 
          onClick={handleTranslateContentHome} 
          disabled={isTranslating}
          title={t('action.translate')}
        >
          {isTranslating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Globe className="h-5 w-5" />}
        </Button>
        
        {/* Botão de Dados (Importar/Exportar JSON) */}
        <Button size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700" onClick={() => setShowDataDialog(true)} title={t('action.importExport')}><FileDown className="h-5 w-5" /></Button>
        
        {/* Botão de Exportar (PDF/RDO) */}
        <Button size="icon" className="rounded-full bg-purple-600 hover:bg-purple-700" onClick={() => setShowExportDialog(true)} title={t('action.download')}><Download className="h-5 w-5" /></Button>
        
        <Button size="icon" className="rounded-full bg-orange-500 hover:bg-orange-600" onClick={() => setShowEmailDialog(true)} title="Enviar Email"><Mail className="h-5 w-5" /></Button>
      </div>
      
      {/* Mobile Action Bar - Botão flutuante */}
      <MobileActionMenu
        onAddPhoto={() => addPhotoToCategory(categories[0]?.id || '')}
        onDataDialog={() => setShowDataDialog(true)}
        onExportDialog={() => setShowExportDialog(true)}
        onEmailDialog={() => setShowEmailDialog(true)}
        onClearConfirm={() => setShowClearConfirm(true)}
        reportData={{ inspection, categories, conclusion }}
        reportType="home"
        t={t}
      />
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImport} className="hidden" />
      <input ref={fileImportRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      {/* Export Dialog - PDF/RDO */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-orange-500" />
              {t('action.download')}
            </DialogTitle>
            <DialogDescription>{t('action.downloadDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={() => { handleGeneratePPT(); setShowExportDialog(false); }}
              disabled={isLoading}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <FileImage className="h-5 w-5 md:h-4 md:w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">{t('rdo.powerpoint')}</p>
                  <p className="text-xs text-gray-500">{t('action.pptDesc')}</p>
                </div>
              </div>
            </Button>
            
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={() => { alert('🚧 Relatório RDO está em construção. Em breve estará disponível!'); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-400">{t('rdo.executive')} 🚧</p>
                  <p className="text-xs text-gray-400">Em construção...</p>
                </div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>{t('action.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Dialog - Import/Export JSON */}
      <Dialog open={showDataDialog} onOpenChange={setShowDataDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <FileDown className="h-5 w-5 text-blue-500" />
              {t('action.importExport')}
            </DialogTitle>
            <DialogDescription>{t('action.importExportDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={() => { handleExport(); setShowDataDialog(false); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Download className="h-5 w-5 md:h-4 md:w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{t('action.exportJson')}</p>
                  <p className="text-xs text-gray-500">{t('action.exportJsonDesc')}</p>
                </div>
              </div>
            </Button>
            
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={() => { fileImportRef.current?.click(); setShowDataDialog(false); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-5 w-5 md:h-4 md:w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{t('action.importJson')}</p>
                  <p className="text-xs text-gray-500">{t('action.importJsonDesc')}</p>
                </div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDataDialog(false)}>{t('action.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Options Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Enviar Email</DialogTitle>
            <DialogDescription>Selecione o tipo de email que deseja enviar:</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={handleSendAnalysisEmail}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 md:h-4 md:w-4 text-amber-600" />
                </div>
                <div>
                  <div className="font-semibold">Análise</div>
                  <div className="text-xs text-gray-500">Envia para Wallysson, Emerson e Jadson</div>
                </div>
              </div>
            </Button>
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={handleSendConclusionEmail}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 md:h-4 md:w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold">Concluído</div>
                  <div className="text-xs text-gray-500">Envia para todos os destinatários</div>
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cover Page */}
      <section className="p-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader><CardTitle className="text-2xl font-bold">{t('report.technicalReport')}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* Machine Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5 text-orange-500" />{t('report.executionInfo')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('report.tag')}</Label><Input list="tag-options-home" value={inspection.tag} onChange={(e) => handleTagChange(e.target.value)} placeholder={t('placeholder.tag')} /><datalist id="tag-options-home">{TAG_OPTIONS.map(tag => (<option key={tag} value={tag} />))}</datalist></div>
                <div className="space-y-2"><Label>{t('report.modelo')}</Label><Input value={inspection.modelo} onChange={(e) => updateInspection({ modelo: e.target.value })} placeholder={t('placeholder.modelo')} /></div>
                <div className="space-y-2"><Label>{t('report.sn')}</Label><Input value={inspection.sn} onChange={(e) => updateInspection({ sn: e.target.value })} placeholder={t('placeholder.sn')} /></div>
                <div className="space-y-2"><Label>{t('report.entrega')}</Label><Input value={inspection.entrega} onChange={(e) => updateInspection({ entrega: e.target.value })} placeholder={t('placeholder.entrega')} /></div>
                <div className="space-y-2"><Label>{t('report.cliente')}</Label><Input value={inspection.cliente} onChange={(e) => updateInspection({ cliente: e.target.value })} placeholder={t('placeholder.cliente')} /></div>
                <div className="space-y-2"><Label>{t('report.descricao')}</Label><Input value={inspection.descricao} onChange={(e) => updateInspection({ descricao: e.target.value })} placeholder={t('placeholder.descricao')} /></div>
                <div className="space-y-2"><Label>{t('report.machineDown')}</Label><Select value={inspection.machineDown} onValueChange={(value) => updateInspection({ machineDown: value as 'Yes' | 'No' })}><SelectTrigger><SelectValue placeholder={t('select.selectOption')} /></SelectTrigger><SelectContent><SelectItem value="No">{t('select.no')}</SelectItem><SelectItem value="Yes">{t('select.yes')}</SelectItem></SelectContent></Select></div>
              </div>
            </div>

            <Separator />

            {/* Fotos de Identificação da Máquina */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Camera className="h-5 w-5 text-orange-500" />{t('machine.identification')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <IdentificationPhoto label={t('machine.equipmentPhoto')} imageData={inspection.machinePhoto} onUpload={(data) => updateInspection({ machinePhoto: data })} onRemove={() => updateInspection({ machinePhoto: null })} caption={inspection.tag || t('machine.equipmentTag')} t={t} />
                <IdentificationPhoto label={t('machine.hourMeterPhoto')} imageData={inspection.horimetroPhoto} onUpload={(data) => updateInspection({ horimetroPhoto: data })} onRemove={() => updateInspection({ horimetroPhoto: null })} caption={`${t('report.hourMeter')}: ${inspection.horimetro || '-'}`} t={t} />
                <IdentificationPhoto label={t('machine.serialPhoto')} imageData={inspection.serialPhoto || generateSerialNumberImage(inspection.sn)} onUpload={(data) => updateInspection({ serialPhoto: data })} onRemove={() => updateInspection({ serialPhoto: null })} caption={`${t('machine.serialNumber')}: ${inspection.sn || '-'}`} t={t} />
                <IdentificationPhoto label={t('machine.localPhoto')} imageData={inspection.localPhoto} onUpload={(data) => updateInspection({ localPhoto: data })} onRemove={() => updateInspection({ localPhoto: null })} t={t} />
              </div>
            </div>

            <Separator />

            {/* Execution Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Clock className="h-5 w-5 text-orange-500" />{t('report.reportData')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('report.executionDate')}</Label><Input type="date" value={inspection.data} onChange={(e) => updateInspection({ data: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t('report.endDateOptional')}</Label><Input type="date" value={inspection.dataFinal} onChange={(e) => updateInspection({ dataFinal: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t('report.workOrderOptional')}</Label><Input value={inspection.osExecucao} onChange={(e) => updateInspection({ osExecucao: e.target.value })} placeholder={t('placeholder.os')} /></div>
                <div className="space-y-2"><Label>{t('report.performers')}</Label><Input value={inspection.inspetor} onChange={(e) => updateInspection({ inspetor: e.target.value })} placeholder={t('placeholder.inspector')} /></div>
                <div className="space-y-2"><Label>{t('report.hourMeter')}</Label><Input value={inspection.horimetro} onChange={(e) => updateInspection({ horimetro: e.target.value })} placeholder={t('placeholder.hourmeter')} /></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Categorized Photos Section */}
      <section className="p-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
            <Camera className="h-6 w-6 text-orange-500" />
            {t('photos.title')}
          </h2>

          {/* Categories */}
          <div className="space-y-4">
            {categories.map((category, catIndex) => (
              <Collapsible key={category.id} open={expandedCategories[category.id] ?? false} onOpenChange={() => toggleCategory(category.id)}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
                            {catIndex + 1}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{t(`category.${category.id}`, { defaultValue: category.title })}</CardTitle>
                            <p className="text-sm text-gray-500">{t(`category.${category.id}Desc`, { defaultValue: category.description })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{t('photos.photoCount', { count: category.photos.filter(p => p.imageData).length })}</Badge>
                          {expandedCategories[category.id] ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {category.photos.map((photo, index) => (
                          <Card key={photo.id} className="overflow-hidden group border-2 border-gray-200">
                            <div className="p-3 bg-black/5 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-600">{t('photos.photo')} {index + 1}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {category.photos.length > 1 && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500 hover:text-blue-700" onClick={() => { setShowMovePhotoDialog({ categoryId: category.id, photoId: photo.id, currentIndex: index }); setMovePhotoToIndex(index); }} title="Mover para outra posição"><ArrowUpRight className="h-3.5 w-3.5" /></Button>
                                  )}
                                  {category.photos.length > 2 && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => removePhotoFromCategory(category.id, photo.id)} title={t('action.remove')}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Label className="text-xs font-semibold text-orange-600 whitespace-nowrap">{t('photo.pn')}:</Label>
                                <Input className="h-7 text-xs flex-1 min-w-0" value={photo.pn} onChange={(e) => {
                                  const oldPn = photo.pn;
                                  const newPn = e.target.value;
                                  updatePhotoInCategory(category.id, photo.id, { pn: newPn });
                                  // Update parentPn of subparts when PN changes
                                  if (oldPn !== newPn) {
                                    updateAdditionalPartsParentPn(category.id, oldPn, newPn);
                                  }
                                }} placeholder={t('photo.pnPlaceholder')} />
                                <Label className="text-xs whitespace-nowrap">{t('photo.serial')}:</Label>
                                <Input className="h-7 text-xs w-24" value={photo.serialNumber || ''} onChange={(e) => updatePhotoInCategory(category.id, photo.id, { serialNumber: e.target.value })} placeholder={t('photo.serialPlaceholder')} />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">{t('photo.partName')}:</Label>
                                <Input className="h-7 text-xs flex-1" value={photo.partName} onChange={(e) => updatePhotoInCategory(category.id, photo.id, { partName: e.target.value })} placeholder={t('photo.partNamePlaceholder')} />
                                <Label className="text-xs">{t('photo.quantity')}:</Label>
                                <Input className="h-7 text-xs w-16" type="number" value={photo.quantity} onChange={(e) => updatePhotoInCategory(category.id, photo.id, { quantity: e.target.value })} placeholder={t('photo.quantityPlaceholder')} />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs">{t('photo.criticality')}:</Label>
                                <Select value={photo.criticality || ''} onValueChange={(v) => updatePhotoInCategory(category.id, photo.id, { criticality: v as Criticality })}>
                                  <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue placeholder={t('select.selectOption')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Alta">{t('photo.criticalityHigh')}</SelectItem>
                                    <SelectItem value="Média">{t('photo.criticalityMedium')}</SelectItem>
                                    <SelectItem value="Baixa">{t('photo.criticalityLow')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-amber-100 rounded-lg border-2 border-amber-400">
                                <Checkbox id={`subparts-home-${category.id}-${photo.id}`} checked={showAdditionalParts[`${category.id}-${photo.id}`] || photoHasSubPartData(photo, category.additionalParts)} onCheckedChange={(checked) => setShowAdditionalParts(prev => ({ ...prev, [`${category.id}-${photo.id}`]: !!checked }))} className="border-amber-600 data-[state=checked]:bg-amber-500" />
                                <Label htmlFor={`subparts-home-${category.id}-${photo.id}`} className="text-sm font-bold text-amber-800 cursor-pointer flex items-center gap-1"><ListTree className="h-4 w-4" /> {t('subparts.title')}</Label>
                              </div>
                              {(showAdditionalParts[`${category.id}-${photo.id}`] || photoHasSubPartData(photo, category.additionalParts)) && (
                                <AdditionalPartsSection parentPn={photo.pn} photoId={photo.id} additionalParts={category.additionalParts} onAddPart={(part) => addAdditionalPartToCategory(category.id, part)} onRemovePart={(id) => removeAdditionalPartFromCategory(category.id, id)} t={t} />
                              )}
                            </div>
                            <div className="relative h-60 bg-gray-200 flex items-center justify-center gap-1 cursor-pointer hover:bg-gray-300 transition-colors">
                              {/* Primeira foto */}
                              <div className="flex-1 h-full relative" onClick={() => { setShowPhotoOptions({ categoryId: category.id, photoId: photo.id }); }}>
                                {photo.imageData ? (
                                  <img src={photo.editedImageData || photo.imageData} alt={`${t('photos.photo')} ${index + 1}`} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="text-center text-gray-500 h-full flex flex-col items-center justify-center">
                                    <Camera className="h-10 w-10 mx-auto mb-1" />
                                    <p className="text-xs">Foto 1</p>
                                  </div>
                                )}
                                {photo.imageData && (
                                  <div className="absolute top-1 right-1 flex gap-1">
                                    <Button size="icon" className="rounded-full bg-orange-500 hover:bg-orange-600 h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingPhoto({ categoryId: category.id, photo, editMode: 'primary' }); }} title={t('action.edit')}><Edit className="h-3 w-3" /></Button>
                                    <Button size="icon" className="rounded-full bg-red-600 hover:bg-red-700 h-6 w-6" onClick={(e) => { e.stopPropagation(); updatePhotoInCategory(category.id, photo.id, { imageData: null, editedImageData: null }); }} title={t('action.remove')}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                )}
                              </div>
                              
                              {/* Segunda foto (opcional) */}
                              {photo.secondaryImageData && (
                                <>
                                  <div className="w-px h-full bg-gray-300" />
                                  <div className="flex-1 h-full relative" onClick={(e) => { e.stopPropagation(); }}>
                                    <img src={photo.secondaryImageData} alt={`Foto 2`} className="w-full h-full object-cover" />
                                    <div className="absolute top-1 right-1 flex gap-1">
                                      <Button size="icon" className="rounded-full bg-orange-500 hover:bg-orange-600 h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingPhoto({ categoryId: category.id, photo, editMode: 'secondary' }); }} title={t('action.edit')}><Edit className="h-3 w-3" /></Button>
                                      <Button size="icon" className="rounded-full bg-red-600 hover:bg-red-700 h-6 w-6" onClick={(e) => { e.stopPropagation(); updatePhotoInCategory(category.id, photo.id, { secondaryImageData: null }); }} title="Remover segunda foto"><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                  </div>
                                </>
                              )}
                              
                              {/* Botão para adicionar segunda foto */}
                              {photo.imageData && !photo.secondaryImageData && (
                                <div className="absolute bottom-1 right-1 flex gap-1">
                                  <Button 
                                    size="sm" 
                                    className="rounded bg-orange-500 hover:bg-orange-600 h-6 text-xs px-2"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'image/*';
                                      input.onchange = (ev) => {
                                        const file = (ev.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                            updatePhotoInCategory(category.id, photo.id, { secondaryImageData: event.target?.result as string });
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      };
                                      input.click();
                                    }}
                                  >
                                    + Foto
                                  </Button>
                                </div>
                              )}
                              
                              {/* Botão de edição dupla quando tem duas fotos */}
                              {photo.imageData && photo.secondaryImageData && (
                                <div className="absolute bottom-1 right-1">
                                  <Button 
                                    size="sm" 
                                    className="rounded bg-purple-500 hover:bg-purple-600 h-6 text-xs px-2"
                                    onClick={(e) => { e.stopPropagation(); setEditingPhoto({ categoryId: category.id, photo, editMode: 'dual' }); }}
                                    title="Editar ambas as fotos junto"
                                  >
                                    <Images className="h-3 w-3 mr-1" />
                                    Duplo
                                  </Button>
                                </div>
                              )}
                              
                              {photo.embeddedPhotos && photo.embeddedPhotos.length > 0 && (
                                <div className="absolute bottom-1 left-1"><Badge className="bg-orange-500 text-white text-xs"><Circle className="h-3 w-3 mr-1" />{photo.embeddedPhotos.length}</Badge></div>
                              )}
                            </div>
                            <div className="p-2">
                              <Textarea
                                className="h-14 text-sm"
                                placeholder={t('photo.descriptionPlaceholder')}
                                value={photo.description}
                                onChange={(e) => updatePhotoInCategory(category.id, photo.id, { description: e.target.value })}
                              />
                            </div>
                          </Card>
                        ))}
                      </div>
                      <Button variant="outline" className="mt-4 w-full" onClick={() => addPhotoToCategory(category.id)}>
                        <Plus className="h-4 w-4 mr-2" />{t('photos.addPhoto')}
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>

          {/* Parts Table - All parts from all categories */}
          {(() => {
            const tablePhotos = categories.flatMap(cat => 
              cat.photos.filter(p => photoShouldBeInPartsTable(p, cat.additionalParts))
                .map(photo => ({ photo, catAddParts: cat.additionalParts }))
            );
            const partsCount = tablePhotos.length;
            const subPartsCount = tablePhotos.reduce((sum, { photo, catAddParts }) => sum + getSubPartsForPhoto(photo, catAddParts).length, 0);
            return (
              <Card className="mt-8">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-orange-500" />{t('partsTable.title')}</CardTitle>
                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 font-normal">
                      {t('partsTable.partsCount', { parts: partsCount, subparts: subPartsCount })}
                    </Badge>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 h-10"
                    onClick={() => exportPartsTableToExcelHome(inspection, categories, reportId)}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {t('partsTable.exportExcel')}
                  </Button>
                </CardHeader>
                <CardContent>
                  {/* Mobile scroll hint */}
                  <p className="md:hidden text-xs text-gray-500 mb-2 flex items-center gap-1">
                    ← {t('table.swipe')} →
                  </p>
                  <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <table className="w-full min-w-[600px]">
                      <thead><tr className="bg-black text-white"><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.pnSerial')}</th><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.partName')}</th><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.qty')}</th><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.criticality')}</th><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.type')}</th></tr></thead>
                      <tbody>
                        {categories.flatMap(cat => cat.photos.filter(p => photoShouldBeInPartsTable(p, cat.additionalParts)).map(photo => ({ photo, categoryId: cat.id, catAddParts: cat.additionalParts }))).map(({ photo, categoryId, catAddParts }) => (
                          <React.Fragment key={photo.id}>
                            <tr className="border-b hover:bg-orange-50">
                              <td className="p-2 md:p-3 font-semibold text-sm">{getDisplayPn(photo, catAddParts)}{photo.serialNumber && <span className="text-gray-500 font-normal ml-1">({photo.serialNumber})</span>}</td>
                              <td className="p-2 md:p-3 text-sm">{photo.partName || '-'}</td>
                              <td className="p-2 md:p-3 text-sm">{photo.quantity || '-'}</td>
                              <td className="p-2 md:p-3">
                                {photo.criticality === 'Alta' && <Badge className="bg-red-500 text-white text-xs">Alta</Badge>}
                                {photo.criticality === 'Média' && <Badge className="bg-yellow-500 text-white text-xs">Média</Badge>}
                                {photo.criticality === 'Baixa' && <Badge className="bg-green-500 text-white text-xs">Baixa</Badge>}
                                {!photo.criticality && '-'}
                              </td>
                              <td className="p-2 md:p-3"><Badge variant="outline" className="text-xs">{t('partsTable.main')}</Badge></td>
                            </tr>
                            {getSubPartsForPhoto(photo, catAddParts).map((subPart) => (
                              <tr key={subPart.id} className="border-b bg-orange-50/50 hover:bg-orange-100/50">
                                <td className="p-2 md:p-3 pl-6 text-orange-700 text-sm"><span className="mr-1">└─</span>{subPart.pn}{subPart.serialNumber && <span className="text-gray-500 ml-1">({subPart.serialNumber})</span>}</td>
                                <td className="p-2 md:p-3 text-gray-600 italic text-sm">{subPart.partName}</td>
                                <td className="p-2 md:p-3 text-sm">{subPart.quantity}</td>
                                <td className="p-2 md:p-3">
                                  {subPart.criticality === 'Alta' && <Badge className="bg-red-500 text-white text-xs">Alta</Badge>}
                                  {subPart.criticality === 'Média' && <Badge className="bg-yellow-500 text-white text-xs">Média</Badge>}
                                  {subPart.criticality === 'Baixa' && <Badge className="bg-green-500 text-white text-xs">Baixa</Badge>}
                                  {!subPart.criticality && '-'}
                                </td>
                                <td className="p-2 md:p-3"><Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">{t('partsTable.subpart')}</Badge></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Conclusion */}
          <Card className="mt-8">
            <CardHeader><CardTitle className="flex items-center gap-2"><Check className="h-5 w-5 text-orange-500" />{t('conclusion.title')}</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                className="min-h-32"
                placeholder={t('conclusion.placeholder')}
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Botão Limpar */}
          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full h-12 border-red-500 text-red-500 hover:bg-red-50"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              {t('action.clear')}
            </Button>
          </div>
        </div>
      </section>

      {/* Photo Options Dialog - Home */}
      {showPhotoOptions && (
        <PhotoOptionsDialog
          open={!!showPhotoOptions}
          onOpenChange={(open) => !open && setShowPhotoOptions(null)}
          hasImage={!!categories.find(c => c.id === showPhotoOptions?.categoryId)?.photos.find(p => p.id === showPhotoOptions?.photoId)?.imageData}
          onUpload={(file) => {
            if (showPhotoOptions) {
              handlePhotoUpload(showPhotoOptions.categoryId, showPhotoOptions.photoId, file);
            }
          }}
          onCamera={() => {
            if (showPhotoOptions) {
              setCameraTarget(showPhotoOptions);
              openCamera();
            }
          }}
          onPaste={() => {
            if (showPhotoOptions) {
              handlePaste(showPhotoOptions.categoryId, showPhotoOptions.photoId);
            }
          }}
          onViewFullscreen={() => {
            if (showPhotoOptions) {
              const photo = categories.find(c => c.id === showPhotoOptions.categoryId)?.photos.find(p => p.id === showPhotoOptions.photoId);
              if (photo?.imageData) {
                setFullscreenImage(photo.editedImageData || photo.imageData);
              }
            }
          }}
          t={t}
        />
      )}

      {/* Fullscreen Viewer - Home */}
      {fullscreenImage && (
        <FullScreenImageViewer
          imageData={fullscreenImage}
          onClose={() => setFullscreenImage(null)}
          t={t}
        />
      )}

      {/* Camera Dialog - Home */}
      {showCamera && cameraStream && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <div className="flex justify-between items-center p-3 md:p-4 bg-black/50">
            <span className="text-white font-semibold text-sm md:text-base">{t('photoOptions.openCamera')}</span>
            <Button variant="ghost" size="icon" className="text-white h-10 w-10" onClick={closeCamera}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex-1 relative">
            <video
              id="camera-video-home"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              ref={(video) => {
                if (video && cameraStream) {
                  video.srcObject = cameraStream;
                }
              }}
            />
            {/* Botão de capturar sobre o vídeo */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
              <Button 
                size="lg"
                className="rounded-full h-16 w-16 md:h-14 md:w-14 bg-white text-black hover:bg-gray-200 shadow-lg"
                onClick={capturePhoto}
              >
                <Camera className="h-8 w-8 md:h-7 md:w-7" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Translate Dialog - HomeContent */}
      <Dialog open={showTranslateDialog} onOpenChange={setShowTranslateDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-cyan-500" />
              {t('action.translate')}
            </DialogTitle>
            <DialogDescription>Traduzir todos os textos do relatório</DialogDescription>
          </DialogHeader>
          
          {isTranslating ? (
            <div className="py-8 space-y-4 text-center">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-cyan-600">
                    {translateProgress.total > 0 ? Math.round((translateProgress.current / translateProgress.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-gray-700">{translateProgress.status}</p>
                {translateProgress.total > 0 && (
                  <p className="text-sm text-gray-500">
                    {translateProgress.current} / {translateProgress.total} textos
                  </p>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${translateProgress.total > 0 ? (translateProgress.current / translateProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-4">
              <p className="text-sm text-gray-600 mb-4">Selecione o idioma de destino:</p>
              <div className="grid grid-cols-2 gap-2">
                {(['pt', 'en', 'ja', 'zh'] as Language[]).map((lang) => (
                  <Button
                    key={lang}
                    variant="outline"
                    className="h-16 flex flex-col items-center justify-center gap-1"
                    onClick={() => handleTranslateAllHome(lang)}
                  >
                    <span className="text-2xl">{LANGUAGE_FLAGS[lang]}</span>
                    <span className="text-xs font-medium">{LANGUAGE_NAMES[lang]}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {!isTranslating && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTranslateDialog(false)}>
                {t('action.cancel')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Clear Confirm Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-[90vw] md:max-w-lg">
          <DialogHeader><DialogTitle>{t('clearConfirm.title')}</DialogTitle><DialogDescription>{t('clearConfirm.description')}</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)} className="w-full sm:w-auto h-11">{t('action.cancel')}</Button>
            <Button variant="destructive" onClick={handleClearReport} className="w-full sm:w-auto h-11">{t('action.clear')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Photo Dialog */}
      <Dialog open={!!showMovePhotoDialog} onOpenChange={(open) => { if (!open) setShowMovePhotoDialog(null); }}>
        <DialogContent className="max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-blue-500" />
              Mover Foto
            </DialogTitle>
            <DialogDescription>
              {showMovePhotoDialog && `Mover foto ${showMovePhotoDialog.currentIndex + 1} para outra posição dentro da categoria`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Posição de destino:</Label>
              <Select value={String(movePhotoToIndex)} onValueChange={(v) => setMovePhotoToIndex(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {showMovePhotoDialog && categories.find(c => c.id === showMovePhotoDialog.categoryId)?.photos.map((_, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      Posição {idx + 1} {idx === showMovePhotoDialog.currentIndex ? '(atual)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowMovePhotoDialog(null)}>
                {t('action.cancel')}
              </Button>
              <Button 
                className="flex-1 bg-blue-500 hover:bg-blue-600" 
                onClick={() => {
                  if (showMovePhotoDialog) {
                    movePhotoInCategory(showMovePhotoDialog.categoryId, showMovePhotoDialog.currentIndex, movePhotoToIndex);
                    setShowMovePhotoDialog(null);
                  }
                }}
                disabled={showMovePhotoDialog && movePhotoToIndex === showMovePhotoDialog.currentIndex}
              >
                Mover
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Editor */}
      {editingPhoto && (
        <PhotoEditor photo={editingPhoto.photo} editMode={editingPhoto.editMode} onSave={(data) => { updatePhotoInCategory(editingPhoto.categoryId, editingPhoto.photo.id, data); setEditingPhoto(null); }} onClose={() => setEditingPhoto(null)} t={t} />
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-64"><CardContent className="p-6 text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div><p className="text-sm text-gray-600">{t('loading.generatingPPT')}</p></CardContent></Card>
        </div>
      )}
    </>
  );
}

// ============================================
// ABA INSPEÇÃO - Sem Categorias (formato original)
// ============================================
function InspecaoContent({ reportId, onRegenerateId }: { reportId: string; onRegenerateId: () => void }) {
  const {
    inspection,
    photos,
    additionalParts,
    conclusion,
    updateInspection,
    setPhotos,
    addPhoto,
    removePhoto,
    updatePhoto,
    movePhoto,
    addAdditionalPart,
    removeAdditionalPart,
    setAdditionalParts,
    updateAdditionalPartsParentPn,
    setConclusion,
    clearAll,
  } = useReportStore();
  
  const { language, t } = useTranslation();

  const [showPhotoOptions, setShowPhotoOptions] = useState<string | null>(null);
  const [showAdditionalParts, setShowAdditionalParts] = usePersistedState<Record<string, boolean>>('insp-subparts-open', {});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<{ photo: PhotoData; editMode: 'primary' | 'secondary' | 'dual' } | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTargetId, setCameraTargetId] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0, status: '' });
  const [showMovePhotoDialog, setShowMovePhotoDialog] = useState(false);
  const [movePhotoFromIndex, setMovePhotoFromIndex] = useState<number | null>(null);
  const [movePhotoToIndex, setMovePhotoToIndex] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);
  const handleTagChange = (tag: string) => {
    updateInspection({ tag });
    if (tag && MACHINE_DATA[tag]) {
      const machine = MACHINE_DATA[tag];
      updateInspection({ modelo: machine.modelo, sn: machine.sn, entrega: machine.entrega, cliente: machine.cliente });
    }
  };

  const handlePhotoUpload = (photoId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { updatePhoto(photoId, { imageData: e.target?.result as string, editedImageData: null }); };
    reader.readAsDataURL(file);
    setShowPhotoOptions(null);
  };

  const handlePaste = useCallback(async (photoId: string) => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) { for (const type of item.types) { if (type.startsWith('image/')) { const blob = await item.getType(type); const reader = new FileReader(); reader.onload = (e) => { updatePhoto(photoId, { imageData: e.target?.result as string, editedImageData: null }); }; reader.readAsDataURL(blob); } } }
    } catch (err) { console.error('Failed to paste:', err); }
    setShowPhotoOptions(null);
  }, [updatePhoto]);

  // Camera functions for InspecaoContent
  const openCameraInsp = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      console.error('Erro ao abrir câmera:', err);
      alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const closeCameraInsp = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCameraTargetId(null);
  };

  const capturePhotoInsp = () => {
    const video = document.getElementById('camera-video-insp') as HTMLVideoElement;
    if (!video || !cameraTargetId) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/png');
      updatePhoto(cameraTargetId, { imageData, editedImageData: null });
    }
    
    closeCameraInsp();
    setShowPhotoOptions(null);
  };

  // Ctrl+V listener removido - colar foto apenas pelo botão "Colar da área de transferência"

  const handleClearReport = () => { clearAll(); setShowClearConfirm(false); onRegenerateId(); };

  const handleExport = () => {
    // Export ALL data including photos (base64), inspection, photos, additionalParts, conclusion
    const data = { 
      version: '1.0',
      exportDate: new Date().toISOString(),
      inspection, 
      photos, 
      additionalParts, 
      conclusion 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inspecao_${sanitizeForFilename(inspection.descricao || inspection.tag)}_${reportId}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Check if there's existing data that might conflict
    const hasExistingData = inspection.tag || inspection.cliente || photos.some(p => 
      p.imageData || p.pn || p.description || p.partName
    ) || additionalParts.length > 0 || conclusion;
    if (hasExistingData) {
      if (!confirm('Já existe um relatório em andamento. Deseja substituí-lo pelo arquivo importado? Os dados atuais serão perdidos.')) {
        e.target.value = '';
        return;
      }
      // Clear existing data before importing to prevent conflicts
      clearAll();
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        // Import inspection data
        if (data.inspection) {
          Object.keys(data.inspection).forEach(key => {
            updateInspection({ [key]: data.inspection[key] });
          });
        }
        // Import photos with all data including imageData
        if (data.photos && Array.isArray(data.photos)) {
          // Fix sub-part associations: set photoId on sub-parts
          if (data.additionalParts && Array.isArray(data.additionalParts)) {
            const importedPhotos = data.photos || [];
            data.additionalParts.forEach((ap: any) => {
              if (ap.parentPn) {
                const match = importedPhotos.find((p: any) => p.pn === ap.parentPn);
                if (match) ap.photoId = match.id;
              }
            });
          }
          setPhotos(data.photos);
        }
        // Import additional parts
        if (data.additionalParts && Array.isArray(data.additionalParts)) {
          setAdditionalParts(data.additionalParts);
          // Auto-expand sub-parts sections for photos that have them
          const importedPhotos = data.photos || photos;
          const expandMap: Record<string, boolean> = {};
          importedPhotos.forEach((photo: any) => {
            const hasSub = photoHasSubPartData(photo, data.additionalParts);
            if (hasSub) expandMap[photo.id] = true;
          });
          if (Object.keys(expandMap).length > 0) {
            setShowAdditionalParts(prev => ({ ...prev, ...expandMap }));
          }
        }
        // Import conclusion
        if (data.conclusion !== undefined) setConclusion(data.conclusion);
      } catch (err) { 
        console.error('Failed to import:', err);
        alert('Erro ao importar arquivo. Verifique se o arquivo é válido.');
      }
      // Reset input to allow re-importing same file
      e.target.value = '';
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo.');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Função para traduzir todos os textos dinâmicos
  const handleTranslateAll = async (targetLang: Language) => {
    setShowTranslateDialog(true);
    setIsTranslating(true);
    
    try {
      // Coletar todos os textos para traduzir
      const textItems: { id: string; text: string; type: string }[] = [];
      
      // Textos da inspeção
      if (inspection.descricao?.trim()) {
        textItems.push({ id: 'inspection.descricao', text: inspection.descricao, type: 'inspection' });
      }
      if (inspection.osExecucao?.trim()) {
        textItems.push({ id: 'inspection.osExecucao', text: inspection.osExecucao, type: 'inspection' });
      }
      if (inspection.inspetor?.trim()) {
        textItems.push({ id: 'inspection.inspetor', text: inspection.inspetor, type: 'inspection' });
      }
      if (inspection.cliente?.trim()) {
        textItems.push({ id: 'inspection.cliente', text: inspection.cliente, type: 'inspection' });
      }
      
      // Textos das fotos
      photos.forEach((photo, idx) => {
        if (photo.description?.trim()) {
          textItems.push({ id: `photo.${photo.id}.description`, text: photo.description, type: 'photo' });
        }
        if (photo.partName?.trim()) {
          textItems.push({ id: `photo.${photo.id}.partName`, text: photo.partName, type: 'photo' });
        }
      });
      
      // Textos das peças adicionais
      additionalParts.forEach((part) => {
        if (part.partName?.trim()) {
          textItems.push({ id: `part.${part.id}.partName`, text: part.partName, type: 'part' });
        }
      });
      
      // Conclusão
      if (conclusion?.trim()) {
        textItems.push({ id: 'conclusion', text: conclusion, type: 'conclusion' });
      }
      
      const total = textItems.length;
      setTranslateProgress({ current: 0, total, status: `Encontrados ${total} textos para traduzir` });
      
      if (total === 0) {
        alert('Nenhum texto encontrado para traduzir!');
        setShowTranslateDialog(false);
        setIsTranslating(false);
        return;
      }
      
      // Enviar todos os textos para tradução
      setTranslateProgress({ current: 0, total, status: 'Enviando para API de tradução...' });
      
      const response = await fetch('/api/translate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: textItems.map(item => item.text),
          targetLanguage: targetLang,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro na API: ${response.status}`);
      }
      
      const data = await response.json();
      const translations: string[] = data.translations || [];
      
      setTranslateProgress({ current: total, total, status: 'Aplicando traduções...' });
      
      // Aplicar traduções de volta
      for (let i = 0; i < textItems.length; i++) {
        const item = textItems[i];
        const translation = translations[i] || item.text;
        
        if (item.id === 'inspection.descricao') {
          updateInspection({ descricao: translation });
        } else if (item.id === 'inspection.osExecucao') {
          updateInspection({ osExecucao: translation });
        } else if (item.id === 'inspection.inspetor') {
          updateInspection({ inspetor: translation });
        } else if (item.id === 'inspection.cliente') {
          updateInspection({ cliente: translation });
        } else if (item.id === 'conclusion') {
          setConclusion(translation);
        } else if (item.id.startsWith('photo.')) {
          const [, photoId, field] = item.id.split('.');
          if (field === 'description') {
            updatePhoto(photoId, { description: translation });
          } else if (field === 'partName') {
            updatePhoto(photoId, { partName: translation });
          }
        } else if (item.id.startsWith('part.')) {
          const [, partId] = item.id.split('.');
          const partIndex = additionalParts.findIndex(p => p.id === partId);
          if (partIndex !== -1) {
            const updatedParts = [...additionalParts];
            updatedParts[partIndex] = { ...updatedParts[partIndex], partName: translation };
            setAdditionalParts(updatedParts);
          }
        }
      }
      
      setTranslateProgress({ current: total, total, status: 'Tradução concluída!' });
      
      setTimeout(() => {
        setShowTranslateDialog(false);
        alert(`✅ Tradução concluída!\n\n${total} textos traduzidos para ${LANGUAGE_NAMES[targetLang]}`);
      }, 500);
      
    } catch (error) {
      console.error('Erro ao traduzir:', error);
      alert('Erro ao traduzir o conteúdo: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
      setShowTranslateDialog(false);
    }
    setIsTranslating(false);
  };

  // Função para abrir o diálogo de tradução
  const handleTranslateContent = () => {
    setShowTranslateDialog(true);
  };

  // Função para mover foto para posição específica
  const handleMovePhotoToPosition = () => {
    if (movePhotoFromIndex === null) return;
    if (movePhotoFromIndex === movePhotoToIndex) {
      setShowMovePhotoDialog(false);
      setMovePhotoFromIndex(null);
      return;
    }
    
    movePhoto(movePhotoFromIndex, movePhotoToIndex);
    setShowMovePhotoDialog(false);
    setMovePhotoFromIndex(null);
  };

  const handleGeneratePPT = async () => {
    setIsLoading(true);
    try {
      // Translate dynamic texts if not in Portuguese
      if (language !== 'pt') {
        const { translateDynamic } = useTranslationStore.getState();
        
        // Translate all inspection text fields
        const translatedInspection = { ...inspection };
        if (inspection.descricao) {
          translatedInspection.descricao = await translateDynamic(inspection.descricao);
        }
        if (inspection.osExecucao) {
          translatedInspection.osExecucao = await translateDynamic(inspection.osExecucao);
        }
        if (inspection.inspetor) {
          translatedInspection.inspetor = await translateDynamic(inspection.inspetor);
        }
        if (inspection.cliente) {
          translatedInspection.cliente = await translateDynamic(inspection.cliente);
        }
        
        // Translate all photos
        const translatedPhotos = await Promise.all(photos.map(async (photo) => {
          const translatedPhoto = { ...photo };
          if (photo.description) {
            translatedPhoto.description = await translateDynamic(photo.description);
          }
          if (photo.partName) {
            translatedPhoto.partName = await translateDynamic(photo.partName);
          }
          return translatedPhoto;
        }));
        
        // Translate additional parts
        const translatedAdditionalParts = await Promise.all(additionalParts.map(async (part) => {
          const translatedPart = { ...part };
          if (part.partName) {
            translatedPart.partName = await translateDynamic(part.partName);
          }
          return translatedPart;
        }));
        
        // Translate conclusion
        const translatedConclusion = conclusion ? await translateDynamic(conclusion) : conclusion;
        
        await generatePowerPoint({ 
          inspection: translatedInspection, 
          photos: translatedPhotos, 
          additionalParts: translatedAdditionalParts, 
          conclusion: translatedConclusion,
          language,
          reportId
        });
        // Auto-download Excel parts table
        exportPartsTableToExcelInspecao(translatedInspection, translatedPhotos, translatedAdditionalParts, reportId);
      } else {
        await generatePowerPoint({ inspection, photos, additionalParts, conclusion, language: 'pt', reportId });
        // Auto-download Excel parts table
        exportPartsTableToExcelInspecao(inspection, photos, additionalParts, reportId);
      }
    } catch (error) { 
      console.error('Error generating PowerPoint:', error); 
    }
    setIsLoading(false);
  };

  // Email handlers
  const handleSendAnalysisEmail = () => {
    const subject = generateEmailSubject(inspection, 'analysis', reportId);
    const body = generateAnalysisEmailBody(inspection, photos, additionalParts, undefined, reportId);
    openEmailClient({
      to: EMAIL_CONFIG.analysisRecipients,
      cc: EMAIL_CONFIG.analysisCc,
      subject,
      body,
    });
    setShowEmailDialog(false);
  };

  const handleSendConclusionEmail = () => {
    const subject = generateEmailSubject(inspection, 'conclusion', reportId);
    const body = generateConclusionEmailBody(inspection, conclusion, photos, additionalParts, undefined, reportId);
    openEmailClient({
      to: EMAIL_CONFIG.conclusionRecipients,
      cc: EMAIL_CONFIG.conclusionCc,
      subject,
      body,
    });
    setShowEmailDialog(false);
  };

  return (
    <>
      {/* Action Buttons - Responsivo */}
      <div className="fixed top-20 right-4 md:flex flex-col gap-2 z-40 hidden">
        <Button size="icon" className="rounded-full bg-green-600 hover:bg-green-700" onClick={() => addPhoto()} title={t('action.addPhoto')}><Plus className="h-5 w-5" /></Button>
        <Button size="icon" className="rounded-full bg-red-600 hover:bg-red-700" onClick={() => setShowClearConfirm(true)} title={t('action.clear')}><Trash2 className="h-5 w-5" /></Button>
        
        {/* Botão de Traduzir */}
        <Button 
          size="icon" 
          className={`rounded-full ${language === 'pt' ? 'bg-gray-400' : 'bg-cyan-600 hover:bg-cyan-700'}`} 
          onClick={handleTranslateContent} 
          disabled={isTranslating}
          title={language === 'pt' ? 'Conteúdo em Português' : t('action.translate')}
        >
          {isTranslating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Globe className="h-5 w-5" />}
        </Button>
        
        {/* Botão de Dados (Importar/Exportar JSON) */}
        <Button size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700" onClick={() => setShowDataDialog(true)} title={t('action.importExport')}><FileDown className="h-5 w-5" /></Button>
        
        {/* Botão de Exportar (PDF/RDO) */}
        <Button size="icon" className="rounded-full bg-purple-600 hover:bg-purple-700" onClick={() => setShowExportDialog(true)} title={t('action.download')}><Download className="h-5 w-5" /></Button>
        
        <Button size="icon" className="rounded-full bg-orange-500 hover:bg-orange-600" onClick={() => setShowEmailDialog(true)} title="Enviar Email"><Mail className="h-5 w-5" /></Button>
      </div>
      
      {/* Mobile Action Bar - Botão flutuante */}
      <MobileActionMenu
        onAddPhoto={() => addPhoto()}
        onDataDialog={() => setShowDataDialog(true)}
        onExportDialog={() => setShowExportDialog(true)}
        onEmailDialog={() => setShowEmailDialog(true)}
        onClearConfirm={() => setShowClearConfirm(true)}
        reportData={{ inspection, photos, additionalParts, conclusion }}
        reportType="inspecao"
        t={t}
      />
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImport} className="hidden" />
      <input ref={fileImportRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      {/* Export Dialog - PDF/RDO */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-orange-500" />
              {t('action.download')}
            </DialogTitle>
            <DialogDescription>{t('action.downloadDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={() => { handleGeneratePPT(); setShowExportDialog(false); }}
              disabled={isLoading}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <FileImage className="h-5 w-5 md:h-4 md:w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">{t('rdo.powerpoint')}</p>
                  <p className="text-xs text-gray-500">{t('action.pptDesc')}</p>
                </div>
              </div>
            </Button>
            
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={() => { alert('🚧 Relatório RDO está em construção. Em breve estará disponível!'); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-400">{t('rdo.executive')} 🚧</p>
                  <p className="text-xs text-gray-400">Em construção...</p>
                </div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>{t('action.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Dialog - Import/Export JSON */}
      <Dialog open={showDataDialog} onOpenChange={setShowDataDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <FileDown className="h-5 w-5 text-blue-500" />
              {t('action.importExport')}
            </DialogTitle>
            <DialogDescription>{t('action.importExportDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={() => { handleExport(); setShowDataDialog(false); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Download className="h-5 w-5 md:h-4 md:w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{t('action.exportJson')}</p>
                  <p className="text-xs text-gray-500">{t('action.exportJsonDesc')}</p>
                </div>
              </div>
            </Button>
            
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={() => { fileImportRef.current?.click(); setShowDataDialog(false); }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-5 w-5 md:h-4 md:w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{t('action.importJson')}</p>
                  <p className="text-xs text-gray-500">{t('action.importJsonDesc')}</p>
                </div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDataDialog(false)}>{t('action.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Options Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Enviar Email</DialogTitle>
            <DialogDescription>Selecione o tipo de email que deseja enviar:</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={handleSendAnalysisEmail}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 md:h-4 md:w-4 text-amber-600" />
                </div>
                <div>
                  <div className="font-semibold">Análise</div>
                  <div className="text-xs text-gray-500">Envia para Wallysson, Emerson e Jadson</div>
                </div>
              </div>
            </Button>
            <Button 
              className="w-full justify-start h-16 md:h-14 text-left" 
              variant="outline"
              onClick={handleSendConclusionEmail}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 md:h-4 md:w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold">Concluído</div>
                  <div className="text-xs text-gray-500">Envia para todos os destinatários</div>
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Translate Dialog - InspecaoContent */}
      <Dialog open={showTranslateDialog} onOpenChange={setShowTranslateDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-cyan-500" />
              {t('action.translate')}
            </DialogTitle>
            <DialogDescription>Traduzir todos os textos do relatório</DialogDescription>
          </DialogHeader>
          
          {isTranslating ? (
            <div className="py-8 space-y-4 text-center">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-cyan-600">
                    {translateProgress.total > 0 ? Math.round((translateProgress.current / translateProgress.total) * 100) : 0}%
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-gray-700">{translateProgress.status}</p>
                {translateProgress.total > 0 && (
                  <p className="text-sm text-gray-500">
                    {translateProgress.current} / {translateProgress.total} textos
                  </p>
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${translateProgress.total > 0 ? (translateProgress.current / translateProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-4">
              <p className="text-sm text-gray-600 mb-4">Selecione o idioma de destino:</p>
              <div className="grid grid-cols-3 gap-2">
                {(['pt', 'en', 'ja', 'zh'] as Language[]).map((lang) => (
                  <Button
                    key={lang}
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-1"
                    onClick={() => handleTranslateAll(lang)}
                  >
                    <span className="text-2xl">{LANGUAGE_FLAGS[lang]}</span>
                    <span className="text-xs font-medium">{LANGUAGE_NAMES[lang]}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {!isTranslating && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTranslateDialog(false)}>
                {t('action.cancel')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Move Photo Dialog */}
      <Dialog open={showMovePhotoDialog} onOpenChange={(open) => { setShowMovePhotoDialog(open); if (!open) setMovePhotoFromIndex(null); }}>
        <DialogContent className="max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-orange-500" />
              Mover Foto
            </DialogTitle>
            <DialogDescription>
              {movePhotoFromIndex !== null ? `Mover foto ${movePhotoFromIndex + 1} para:` : 'Selecione a posição de destino'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Posição de destino:</Label>
              <Select value={String(movePhotoToIndex)} onValueChange={(v) => setMovePhotoToIndex(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {photos.map((_, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      Posição {idx + 1} {idx === movePhotoFromIndex ? '(atual)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowMovePhotoDialog(false); setMovePhotoFromIndex(null); }}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={handleMovePhotoToPosition}>
                Mover
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cover Page */}
      <section className="p-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader><CardTitle className="text-2xl font-bold">{t('report.technicalReport')}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Package className="h-5 w-5 text-orange-500" />{t('report.executionInfo')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('report.tag')}</Label><Input list="tag-options-insp" value={inspection.tag} onChange={(e) => handleTagChange(e.target.value)} placeholder={t('placeholder.tag')} /><datalist id="tag-options-insp">{TAG_OPTIONS.map(tag => (<option key={tag} value={tag} />))}</datalist></div>
                <div className="space-y-2"><Label>{t('report.modelo')}</Label><Input value={inspection.modelo} onChange={(e) => updateInspection({ modelo: e.target.value })} placeholder={t('placeholder.modelo')} /></div>
                <div className="space-y-2"><Label>{t('report.sn')}</Label><Input value={inspection.sn} onChange={(e) => updateInspection({ sn: e.target.value })} placeholder={t('placeholder.sn')} /></div>
                <div className="space-y-2"><Label>{t('report.entrega')}</Label><Input value={inspection.entrega} onChange={(e) => updateInspection({ entrega: e.target.value })} placeholder={t('placeholder.entrega')} /></div>
                <div className="space-y-2"><Label>{t('report.cliente')}</Label><Input value={inspection.cliente} onChange={(e) => updateInspection({ cliente: e.target.value })} placeholder={t('placeholder.cliente')} /></div>
                <div className="space-y-2"><Label>{t('report.descricao')}</Label><Input value={inspection.descricao} onChange={(e) => updateInspection({ descricao: e.target.value })} placeholder={t('placeholder.descricao')} /></div>
                <div className="space-y-2"><Label>{t('report.machineDown')}</Label><Select value={inspection.machineDown} onValueChange={(value) => updateInspection({ machineDown: value as 'Yes' | 'No' })}><SelectTrigger><SelectValue placeholder={t('select.selectOption')} /></SelectTrigger><SelectContent><SelectItem value="No">{t('select.no')}</SelectItem><SelectItem value="Yes">{t('select.yes')}</SelectItem></SelectContent></Select></div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Camera className="h-5 w-5 text-orange-500" />{t('machine.identification')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <IdentificationPhoto label={t('machine.equipmentPhoto')} imageData={inspection.machinePhoto} onUpload={(data) => updateInspection({ machinePhoto: data })} onRemove={() => updateInspection({ machinePhoto: null })} caption={inspection.tag || t('machine.equipmentTag')} t={t} />
                <IdentificationPhoto label={t('machine.hourMeterPhoto')} imageData={inspection.horimetroPhoto} onUpload={(data) => updateInspection({ horimetroPhoto: data })} onRemove={() => updateInspection({ horimetroPhoto: null })} caption={`${t('report.hourMeter')}: ${inspection.horimetro || '-'}`} t={t} />
                <IdentificationPhoto label={t('machine.serialPhoto')} imageData={inspection.serialPhoto || generateSerialNumberImage(inspection.sn)} onUpload={(data) => updateInspection({ serialPhoto: data })} onRemove={() => updateInspection({ serialPhoto: null })} caption={`${t('machine.serialNumber')}: ${inspection.sn || '-'}`} t={t} />
                <IdentificationPhoto label={t('machine.localPhoto')} imageData={inspection.localPhoto} onUpload={(data) => updateInspection({ localPhoto: data })} onRemove={() => updateInspection({ localPhoto: null })} t={t} />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Clock className="h-5 w-5 text-orange-500" />{t('report.reportData')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>{t('report.executionDate')}</Label><Input type="date" value={inspection.data} onChange={(e) => updateInspection({ data: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t('report.endDateOptional')}</Label><Input type="date" value={inspection.dataFinal} onChange={(e) => updateInspection({ dataFinal: e.target.value })} /></div>
                <div className="space-y-2"><Label>{t('report.workOrderOptional')}</Label><Input value={inspection.osExecucao} onChange={(e) => updateInspection({ osExecucao: e.target.value })} placeholder={t('placeholder.os')} /></div>
                <div className="space-y-2"><Label>{t('report.performers')}</Label><Input value={inspection.inspetor} onChange={(e) => updateInspection({ inspetor: e.target.value })} placeholder={t('placeholder.inspector')} /></div>
                <div className="space-y-2"><Label>{t('report.hourMeter')}</Label><Input value={inspection.horimetro} onChange={(e) => updateInspection({ horimetro: e.target.value })} placeholder={t('placeholder.hourmeter')} /></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Photos Section */}
      <section className="p-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><Camera className="h-6 w-6 text-orange-500" />{t('photos.title')} ({photos.length} {t('photos.photoCount', { count: photos.length })})</h2>
            <Button onClick={() => addPhoto()} className="bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4 mr-2" />{t('photos.addPhoto')}</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {photos.map((photo, index) => (
              <Card key={photo.id} className="overflow-hidden group">
                <div className="p-3 bg-black/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-gray-600">{t('photos.photo')} {index + 1}</span>
                      {/* Botão de mover */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => { setMovePhotoFromIndex(index); setMovePhotoToIndex(index); setShowMovePhotoDialog(true); }}
                        title="Mover para outra posição"
                      >
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        Mover
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePhoto(photo.id)} title={t('action.remove')}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-xs font-semibold text-orange-600 whitespace-nowrap">{t('photo.pn')}:</Label>
                    <Input className="h-7 text-xs flex-1 min-w-0" value={photo.pn} onChange={(e) => {
                      const oldPn = photo.pn;
                      const newPn = e.target.value;
                      updatePhoto(photo.id, { pn: newPn });
                      // Update parentPn of subparts when PN changes
                      if (oldPn !== newPn) {
                        updateAdditionalPartsParentPn(oldPn, newPn);
                      }
                    }} placeholder={t('photo.pnPlaceholder')} />
                    <Label className="text-xs whitespace-nowrap">{t('photo.serial')}:</Label>
                    <Input className="h-7 text-xs w-24" value={photo.serialNumber || ''} onChange={(e) => updatePhoto(photo.id, { serialNumber: e.target.value })} placeholder={t('photo.serialPlaceholder')} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">{t('photo.partName')}:</Label>
                    <Input className="h-7 text-xs flex-1" value={photo.partName} onChange={(e) => updatePhoto(photo.id, { partName: e.target.value })} placeholder={t('photo.partNamePlaceholder')} />
                    <Label className="text-xs">{t('photo.quantity')}:</Label>
                    <Input className="h-7 text-xs w-24" type="number" value={photo.quantity} onChange={(e) => updatePhoto(photo.id, { quantity: e.target.value })} placeholder={t('photo.quantityPlaceholder')} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">{t('photo.criticality')}:</Label>
                    <Select value={photo.criticality || ''} onValueChange={(v) => updatePhoto(photo.id, { criticality: v as Criticality })}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder={t('select.selectOption')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alta">{t('photo.criticalityHigh')}</SelectItem>
                        <SelectItem value="Média">{t('photo.criticalityMedium')}</SelectItem>
                        <SelectItem value="Baixa">{t('photo.criticalityLow')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-amber-100 rounded-lg border-2 border-amber-400">
                    <Checkbox id={`subparts-insp-${photo.id}`} checked={showAdditionalParts[photo.id] || photoHasSubPartData(photo, additionalParts)} onCheckedChange={(checked) => setShowAdditionalParts(prev => ({ ...prev, [photo.id]: !!checked }))} className="border-amber-600 data-[state=checked]:bg-amber-500" />
                    <Label htmlFor={`subparts-insp-${photo.id}`} className="text-sm font-bold text-amber-800 cursor-pointer flex items-center gap-1"><ListTree className="h-4 w-4" /> {t('subparts.title')}</Label>
                  </div>
                  {(showAdditionalParts[photo.id] || photoHasSubPartData(photo, additionalParts)) && (
                    <AdditionalPartsSection parentPn={photo.pn} photoId={photo.id} additionalParts={additionalParts} onAddPart={(part) => addAdditionalPart(part)} onRemovePart={(id) => removeAdditionalPart(id)} t={t} />
                  )}
                </div>
                {/* Área de foto(s) - 1 ou 2 lado a lado */}
                <div className="relative h-72 bg-gray-200 flex items-center justify-center gap-1 cursor-pointer hover:bg-gray-300 transition-colors">
                  {/* Primeira foto */}
                  <div className="flex-1 h-full relative" onClick={() => { setShowPhotoOptions(photo.id); }}>
                    {photo.imageData ? (
                      <img src={photo.editedImageData || photo.imageData} alt={`${t('photos.photo')} ${index + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-gray-500 h-full flex flex-col items-center justify-center">
                        <Camera className="h-10 w-10 mx-auto mb-1" />
                        <p className="text-xs">Foto 1</p>
                      </div>
                    )}
                    {photo.imageData && (
                      <div className="absolute top-1 right-1 flex gap-1">
                        <Button size="icon" className="rounded-full bg-orange-500 hover:bg-orange-600 h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingPhoto({ photo, editMode: 'primary' }); }} title={t('action.edit')}><Edit className="h-3 w-3" /></Button>
                        <Button size="icon" className="rounded-full bg-red-600 hover:bg-red-700 h-6 w-6" onClick={(e) => { e.stopPropagation(); updatePhoto(photo.id, { imageData: null, editedImageData: null }); }} title={t('action.remove')}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Segunda foto (opcional) */}
                  {photo.secondaryImageData && (
                    <>
                      <div className="w-px h-full bg-gray-300" />
                      <div className="flex-1 h-full relative" onClick={(e) => { e.stopPropagation(); /* abrir opções para segunda foto */ }}>
                        <img src={photo.secondaryImageData} alt={`Foto 2`} className="w-full h-full object-cover" />
                        <div className="absolute top-1 right-1 flex gap-1">
                          <Button size="icon" className="rounded-full bg-orange-500 hover:bg-orange-600 h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditingPhoto({ photo, editMode: 'secondary' }); }} title={t('action.edit')}><Edit className="h-3 w-3" /></Button>
                          <Button size="icon" className="rounded-full bg-red-600 hover:bg-red-700 h-6 w-6" onClick={(e) => { e.stopPropagation(); updatePhoto(photo.id, { secondaryImageData: null }); }} title="Remover segunda foto"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Botão para adicionar segunda foto */}
                  {photo.imageData && !photo.secondaryImageData && (
                    <div className="absolute bottom-1 right-1 flex gap-1">
                      <Button 
                        size="sm" 
                        className="rounded bg-orange-500 hover:bg-orange-600 h-6 text-xs px-2"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (ev) => {
                            const file = (ev.target as HTMLInputElement).files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                updatePhoto(photo.id, { secondaryImageData: event.target?.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                      >
                        + Foto
                      </Button>
                      <Button 
                        size="sm" 
                        className="rounded bg-purple-500 hover:bg-purple-600 h-6 text-xs px-2"
                        onClick={(e) => { e.stopPropagation(); setEditingPhoto({ photo, editMode: 'dual' }); }}
                        title="Editar ambas as fotos junto"
                      >
                        <Images className="h-3 w-3 mr-1" />
                        Duplo
                      </Button>
                    </div>
                  )}
                  
                  {/* Botão de edição dupla quando tem duas fotos */}
                  {photo.imageData && photo.secondaryImageData && (
                    <div className="absolute bottom-1 right-1">
                      <Button 
                        size="sm" 
                        className="rounded bg-purple-500 hover:bg-purple-600 h-6 text-xs px-2"
                        onClick={(e) => { e.stopPropagation(); setEditingPhoto({ photo, editMode: 'dual' }); }}
                        title="Editar ambas as fotos junto"
                      >
                        <Images className="h-3 w-3 mr-1" />
                        Duplo
                      </Button>
                    </div>
                  )}
                  
                  {photo.embeddedPhotos && photo.embeddedPhotos.length > 0 && (
                    <div className="absolute bottom-1 left-1"><Badge className="bg-orange-500 text-white text-xs"><Circle className="h-3 w-3 mr-1" />{photo.embeddedPhotos.length}</Badge></div>
                  )}
                </div>
                <div className="p-2">
                  <Textarea
                    className="h-16 text-sm"
                    placeholder={t('photo.descriptionPlaceholder')}
                    value={photo.description}
                    onChange={(e) => updatePhoto(photo.id, { description: e.target.value })}
                  />
                </div>
              </Card>
            ))}
          </div>

          {(() => {
            const tablePhotos = photos.filter(p => photoShouldBeInPartsTable(p, additionalParts));
            const partsCount = tablePhotos.length;
            const subPartsCount = tablePhotos.reduce((sum, photo) => sum + getSubPartsForPhoto(photo, additionalParts).length, 0);
            return (
          <Card className="mt-8">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-orange-500" />{t('partsTable.title')}</CardTitle>
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 font-normal">
                  {t('partsTable.partsCount', { parts: partsCount, subparts: subPartsCount })}
                </Badge>
              </div>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700 h-10"
                onClick={() => exportPartsTableToExcelInspecao(inspection, photos, additionalParts, reportId)}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t('partsTable.exportExcel')}
              </Button>
            </CardHeader>
            <CardContent>
              {/* Mobile scroll hint */}
              <p className="md:hidden text-xs text-gray-500 mb-2 flex items-center gap-1">
                ← {t('table.swipe')} →
              </p>
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full min-w-[600px]">
                  <thead><tr className="bg-black text-white"><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.pnSerial')}</th><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.partName')}</th><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.qty')}</th><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.criticality')}</th><th className="p-2 md:p-3 text-left text-sm">{t('partsTable.type')}</th></tr></thead>
                  <tbody>
                    {photos.filter(p => photoShouldBeInPartsTable(p, additionalParts)).map((photo) => (
                      <React.Fragment key={photo.id}>
                        <tr className="border-b hover:bg-orange-50">
                          <td className="p-2 md:p-3 font-semibold text-sm">{getDisplayPn(photo, additionalParts)}{photo.serialNumber && <span className="text-gray-500 font-normal ml-1">({photo.serialNumber})</span>}</td>
                          <td className="p-2 md:p-3 text-sm">{photo.partName || '-'}</td>
                          <td className="p-2 md:p-3 text-sm">{photo.quantity || '-'}</td>
                          <td className="p-2 md:p-3">
                            {photo.criticality === 'Alta' && <Badge className="bg-red-500 text-white text-xs">Alta</Badge>}
                            {photo.criticality === 'Média' && <Badge className="bg-yellow-500 text-white text-xs">Média</Badge>}
                            {photo.criticality === 'Baixa' && <Badge className="bg-green-500 text-white text-xs">Baixa</Badge>}
                            {!photo.criticality && '-'}
                          </td>
                          <td className="p-2 md:p-3"><Badge variant="outline" className="text-xs">{t('partsTable.main')}</Badge></td>
                        </tr>
                        {getSubPartsForPhoto(photo, additionalParts).map((subPart) => (
                          <tr key={subPart.id} className="border-b bg-orange-50/50 hover:bg-orange-100/50">
                            <td className="p-2 md:p-3 pl-6 text-orange-700 text-sm"><span className="mr-1">└─</span>{subPart.pn}{subPart.serialNumber && <span className="text-gray-500 ml-1">({subPart.serialNumber})</span>}</td>
                            <td className="p-2 md:p-3 text-gray-600 italic text-sm">{subPart.partName}</td>
                            <td className="p-2 md:p-3 text-sm">{subPart.quantity}</td>
                            <td className="p-2 md:p-3">
                              {subPart.criticality === 'Alta' && <Badge className="bg-red-500 text-white text-xs">Alta</Badge>}
                              {subPart.criticality === 'Média' && <Badge className="bg-yellow-500 text-white text-xs">Média</Badge>}
                              {subPart.criticality === 'Baixa' && <Badge className="bg-green-500 text-white text-xs">Baixa</Badge>}
                              {!subPart.criticality && '-'}
                            </td>
                            <td className="p-2 md:p-3"><Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">{t('partsTable.subpart')}</Badge></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
            );
          })()}

          <Card className="mt-8">
            <CardHeader><CardTitle className="flex items-center gap-2"><Check className="h-5 w-5 text-orange-500" />{t('conclusion.title')}</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                className="min-h-32"
                placeholder={t('conclusion.placeholder')}
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Botão Limpar */}
          <div className="mt-6">
            <Button
              variant="outline"
              className="w-full h-12 border-red-500 text-red-500 hover:bg-red-50"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              {t('action.clear')}
            </Button>
          </div>
        </div>
      </section>

      {/* Photo Options Dialog - Inspecao */}
      {showPhotoOptions && (
        <PhotoOptionsDialog
          open={!!showPhotoOptions}
          onOpenChange={(open) => !open && setShowPhotoOptions(null)}
          hasImage={!!photos.find(p => p.id === showPhotoOptions)?.imageData}
          onUpload={(file) => {
            if (showPhotoOptions) {
              handlePhotoUpload(showPhotoOptions, file);
            }
          }}
          onCamera={() => {
            if (showPhotoOptions) {
              setCameraTargetId(showPhotoOptions);
              openCameraInsp();
            }
          }}
          onPaste={() => {
            if (showPhotoOptions) {
              handlePaste(showPhotoOptions);
            }
          }}
          onViewFullscreen={() => {
            if (showPhotoOptions) {
              const photo = photos.find(p => p.id === showPhotoOptions);
              if (photo?.imageData) {
                setFullscreenImage(photo.editedImageData || photo.imageData);
              }
            }
          }}
          t={t}
        />
      )}

      {/* Fullscreen Viewer - Inspecao */}
      {fullscreenImage && (
        <FullScreenImageViewer
          imageData={fullscreenImage}
          onClose={() => setFullscreenImage(null)}
          t={t}
        />
      )}

      {/* Camera Dialog - Inspecao */}
      {showCamera && cameraStream && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <div className="flex justify-between items-center p-3 md:p-4 bg-black/50">
            <span className="text-white font-semibold text-sm md:text-base">{t('photoOptions.openCamera')}</span>
            <Button variant="ghost" size="icon" className="text-white h-10 w-10" onClick={closeCameraInsp}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex-1 relative">
            <video
              id="camera-video-insp"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              ref={(video) => {
                if (video && cameraStream) {
                  video.srcObject = cameraStream;
                }
              }}
            />
            {/* Botão de capturar sobre o vídeo */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
              <Button 
                size="lg"
                className="rounded-full h-16 w-16 md:h-14 md:w-14 bg-white text-black hover:bg-gray-200 shadow-lg"
                onClick={capturePhotoInsp}
              >
                <Camera className="h-8 w-8 md:h-7 md:w-7" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-[90vw] md:max-w-lg">
          <DialogHeader><DialogTitle>{t('clearConfirm.title')}</DialogTitle><DialogDescription>{t('clearConfirm.description')}</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)} className="w-full sm:w-auto h-11">{t('action.cancel')}</Button>
            <Button variant="destructive" onClick={handleClearReport} className="w-full sm:w-auto h-11">{t('action.clear')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingPhoto && <PhotoEditor photo={editingPhoto.photo} editMode={editingPhoto.editMode} onSave={(data) => { updatePhoto(editingPhoto.photo.id, data); setEditingPhoto(null); }} onClose={() => setEditingPhoto(null)} t={t} />}

      {isLoading && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><Card className="w-64"><CardContent className="p-6 text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div><p className="text-sm text-gray-600">{t('loading.generatingPPT')}</p></CardContent></Card></div>}
    </>
  );
}

// ============================================
// PÁGINA PRINCIPAL
// ============================================
export default function TechnicalReportPage() {
  const { data: session, status } = useSession();
  const hydrated = useStoresHydrated();
  const [activeTab, setActiveTab] = useState<'home' | 'inspecao'>(() => {
    // Check for openTabOnLoad on initial render
    if (typeof window !== 'undefined') {
      const openTabOnLoad = localStorage.getItem('openTabOnLoad');
      if (openTabOnLoad) {
        localStorage.removeItem('openTabOnLoad');
        if (openTabOnLoad === 'home' || openTabOnLoad === 'inspecao') {
          return openTabOnLoad;
        }
      }
    }
    return 'home';
  });
  const { language, setLanguage, t } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [reportId, setReportId] = useState(() => generateReportId());
  
  const languages: Language[] = ['pt', 'en', 'ja', 'zh'];

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-orange-500 animate-pulse text-xl">Carregando...</div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (status === 'unauthenticated' || !session) {
    return <LoginPage onSuccess={() => window.location.reload()} />;
  }

  // Wait for stores to hydrate from IndexedDB before rendering
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-orange-500 animate-pulse text-xl">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Header */}
      <header className="bg-black text-white p-3 flex justify-between items-center md:hidden sticky top-0 z-50">
        <button 
          onClick={() => setShowMobileMenu(true)}
          className="p-2 rounded-lg hover:bg-white/10"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-orange-500" />
          <span className="font-bold text-sm">{t('app.title')}</span>
          <Badge variant="outline" className="border-orange-500/50 text-orange-400 text-xs ml-1">{reportId}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <UserMenu
            currentReportType={activeTab}
          />
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-black/50 z-[60] md:hidden" onClick={() => setShowMobileMenu(false)}>
          <div 
            className="bg-black text-white w-72 h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Settings className="h-6 w-6 text-orange-500" />
                <span className="font-bold text-lg">{t('app.title')}</span>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 rounded-lg hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="p-4 space-y-2 flex-1">
              <button 
                onClick={() => { setActiveTab('home'); setShowMobileMenu(false); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[48px] ${activeTab === 'home' ? 'text-white bg-orange-500/20 border-l-4 border-orange-500' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
              >
                <Home className="h-5 w-5" /><span className="font-medium">{t('tab.home')}</span>
              </button>
              <button 
                onClick={() => { setActiveTab('inspecao'); setShowMobileMenu(false); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[48px] ${activeTab === 'inspecao' ? 'text-white bg-orange-500/20 border-l-4 border-orange-500' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
              >
                <ClipboardList className="h-5 w-5" /><span className="font-medium">{t('tab.inspecao')}</span>
              </button>
            </nav>
            
            {/* Language Selector Mobile */}
            <div className="p-4 border-t border-white/10">
              <Label className="text-xs text-gray-400 mb-2 block">{t('select.selectOption')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { setLanguage(lang); setShowLangMenu(false); }}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${language === lang ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                  >
                    <span>{LANGUAGE_FLAGS[lang]}</span>
                    <span className="text-sm">{LANGUAGE_NAMES[lang]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Layout */}
      <div className="hidden md:flex">
        {/* Sidebar Desktop */}
        <aside className="w-64 bg-black text-white flex flex-col fixed h-full z-50">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-orange-500" />
              <span className="font-bold text-lg">{t('app.title')}</span>
            </div>
          </div>
          <nav className="p-4 space-y-2 flex-1">
            <button onClick={() => setActiveTab('home')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${activeTab === 'home' ? 'text-white bg-orange-500/20 border-l-4 border-orange-500' : 'text-white/80 hover:text-white hover:bg-white/5'}`}>
              <Home className="h-5 w-5" /><span>{t('tab.home')}</span>
            </button>
            <button onClick={() => setActiveTab('inspecao')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${activeTab === 'inspecao' ? 'text-white bg-orange-500/20 border-l-4 border-orange-500' : 'text-white/80 hover:text-white hover:bg-white/5'}`}>
              <ClipboardList className="h-5 w-5" /><span>{t('tab.inspecao')}</span>
            </button>
          </nav>
          
          {/* Language Selector Desktop */}
          <div className="p-4 border-t border-white/10">
            <div className="relative">
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors min-h-[44px]"
              >
                <Globe className="h-5 w-5 text-orange-500" />
                <span className="flex-1 text-left">{LANGUAGE_FLAGS[language]} {LANGUAGE_NAMES[language]}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
              </button>
              {showLangMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 rounded-lg shadow-lg overflow-hidden border border-white/10">
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { setLanguage(lang); setShowLangMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 transition-colors min-h-[44px] ${language === lang ? 'bg-orange-500/20 text-orange-400' : ''}`}
                    >
                      <span>{LANGUAGE_FLAGS[lang]}</span>
                      <span>{LANGUAGE_NAMES[lang]}</span>
                      {language === lang && <Check className="h-4 w-4 ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Desktop */}
        <main className="ml-64 flex-1 min-h-screen">
          {/* Header Desktop */}
          <header className="bg-black text-white p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-8 w-8 text-orange-500" />
              <span className="font-bold text-xl">{t('app.title')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{LANGUAGE_FLAGS[language]} {LANGUAGE_NAMES[language]}</span>
              <Badge className="bg-orange-500 hover:bg-orange-600 px-4 py-2 text-sm">{activeTab === 'home' ? t('tab.home') : t('tab.inspecao')}</Badge>
              <Badge variant="outline" className="border-orange-500/50 text-orange-400 text-xs">{reportId}</Badge>
              <UserMenu
                currentReportType={activeTab}
              />
            </div>
          </header>

          {/* Content Desktop */}
          {activeTab === 'home' && <HomeContent reportId={reportId} onRegenerateId={() => setReportId(generateReportId())} />}
          {activeTab === 'inspecao' && <InspecaoContent reportId={reportId} onRegenerateId={() => setReportId(generateReportId())} />}

          {/* Footer Desktop */}
          <footer className="bg-black text-white p-4 text-center text-sm">
            <p>{t('footer.copyright')}</p>
          </footer>
        </main>
      </div>

      {/* Mobile Content */}
      <main className="md:hidden min-h-screen">
        {activeTab === 'home' && <HomeContent reportId={reportId} />}
        {activeTab === 'inspecao' && <InspecaoContent reportId={reportId} />}
      </main>
    </div>
  );
}
