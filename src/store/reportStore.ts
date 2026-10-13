import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InspectionData, PhotoData, AdditionalPart } from '@/types/report';
import { idbStorage } from '@/lib/idbStorage';

// Função auxiliar para fazer merge de fotos
function mergePhotos(localPhotos: PhotoData[], serverPhotos: PhotoData[]): PhotoData[] {
  if (!serverPhotos || serverPhotos.length === 0) return localPhotos;
  if (!localPhotos || localPhotos.length === 0) return serverPhotos;
  
  const merged: PhotoData[] = [];
  const maxLen = Math.max(localPhotos.length, serverPhotos.length);
  
  for (let i = 0; i < maxLen; i++) {
    const local = localPhotos[i];
    const server = serverPhotos[i];
    
    if (!local && server) {
      merged.push(server);
    } else if (local && !server) {
      merged.push(local);
    } else if (local && server) {
      // Merge campo por campo - servidor tem prioridade se tiver dados
      merged.push({
        id: server.id || local.id,
        description: server.description || local.description || '',
        pn: server.pn || local.pn || '',
        serialNumber: server.serialNumber || local.serialNumber || '',
        partName: server.partName || local.partName || '',
        quantity: server.quantity || local.quantity || '',
        criticality: server.criticality || local.criticality || '',
        imageData: server.imageData || local.imageData,
        secondaryImageData: server.secondaryImageData || local.secondaryImageData,
        editedImageData: server.editedImageData || local.editedImageData,
        embeddedPhotos: server.embeddedPhotos?.length ? server.embeddedPhotos : local.embeddedPhotos || [],
        hasAdditionalParts: server.hasAdditionalParts || local.hasAdditionalParts,
      });
    }
  }
  
  return merged;
}

interface ReportState {
  // Inspection Data
  inspection: InspectionData;
  
  // Photos
  photos: PhotoData[];
  photoCount: number;
  
  // Additional Parts
  additionalParts: AdditionalPart[];
  
  // Conclusion
  conclusion: string;
  
  // Translation
  translation: {
    sourceLang: string;
    targetLang: string;
    translations: Record<string, string>;
  } | null;
  
  // Timestamp da última edição local (feita pelo usuário)
  lastLocalEdit: number;
  
  // Timestamp da última vez que recebemos dados do servidor
  lastServerDataTime: number;
  
  // Actions
  updateInspection: (data: Partial<InspectionData>) => void;
  setPhotos: (photos: PhotoData[]) => void;
  addPhoto: () => void;
  removePhoto: (id: string) => void;
  updatePhoto: (id: string, data: Partial<PhotoData>) => void;
  movePhoto: (fromIndex: number, toIndex: number) => void;
  setPhotoCount: (count: number) => void;
  addAdditionalPart: (part: AdditionalPart) => void;
  addAdditionalPartsFromExcel: (parts: Omit<AdditionalPart, 'id'>[], parentPn: string) => void;
  removeAdditionalPart: (id: string) => void;
  updateAdditionalPart: (id: string, data: Partial<AdditionalPart>) => void;
  setAdditionalParts: (parts: AdditionalPart[]) => void;
  updateAdditionalPartsParentPn: (oldPn: string, newPn: string) => void;
  setConclusion: (text: string) => void;
  setTranslation: (translation: ReportState['translation']) => void;
  clearAll: () => void;
  
  // External data loading
  loadFromData: (data: { inspection?: Partial<InspectionData>; photos?: PhotoData[]; additionalParts?: AdditionalPart[]; conclusion?: string }) => void;
  mergeFromData: (data: { inspection?: Partial<InspectionData>; photos?: PhotoData[]; additionalParts?: AdditionalPart[]; conclusion?: string }, serverTimestamp?: number) => void;
  getAllData: () => { inspection: InspectionData; photos: PhotoData[]; conclusion: string };
  setLastLocalEdit: (timestamp: number) => void;
}

const initialInspection: InspectionData = {
  tag: '',
  modelo: '',
  sn: '',
  entrega: '',
  cliente: '',
  descricao: '',
  machineDown: '',
  data: '',
  dataFinal: '',
  osExecucao: '',
  inspetor: '',
  horimetro: '',
  machinePhoto: null,
  horimetroPhoto: null,
  serialPhoto: null,
  localPhoto: null,
};

const createInitialPhotos = (count: number): PhotoData[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `photo-init-${i}`,
    description: '',
    pn: '',
    serialNumber: '',
    partName: '',
    quantity: '',
    criticality: '',
    imageData: null,
    secondaryImageData: null,
    editedImageData: null,
    embeddedPhotos: [],
    hasAdditionalParts: false,
  }));
};

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      inspection: initialInspection,
      photos: createInitialPhotos(4),
      photoCount: 4,
      additionalParts: [],
      conclusion: '',
      translation: null,
      lastLocalEdit: 0,
      lastServerDataTime: 0,
      
      setLastLocalEdit: (timestamp) => set({ lastLocalEdit: timestamp }),
      
      updateInspection: (data) =>
        set((state) => ({
          inspection: { ...state.inspection, ...data },
          lastLocalEdit: Date.now(),
        })),
        
      setPhotos: (photos) => set({ photos, lastLocalEdit: Date.now() }),
      
      addPhoto: () =>
        set((state) => ({
          photos: [
            ...state.photos,
            {
              id: `photo-${Date.now()}`,
              description: '',
              pn: '',
              serialNumber: '',
              partName: '',
              quantity: '',
              criticality: '',
              imageData: null,
              secondaryImageData: null,
              editedImageData: null,
              embeddedPhotos: [],
              hasAdditionalParts: false,
            },
          ],
          photoCount: state.photoCount + 1,
          lastLocalEdit: Date.now(),
        })),
        
      removePhoto: (id) =>
        set((state) => ({
          photos: state.photos.filter((p) => p.id !== id),
          photoCount: state.photoCount - 1,
          lastLocalEdit: Date.now(),
        })),
        
      updatePhoto: (id, data) =>
        set((state) => ({
          photos: state.photos.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
          lastLocalEdit: Date.now(),
        })),
        
      movePhoto: (fromIndex, toIndex) =>
        set((state) => {
          const newPhotos = [...state.photos];
          const [movedPhoto] = newPhotos.splice(fromIndex, 1);
          newPhotos.splice(toIndex, 0, movedPhoto);
          return { photos: newPhotos, lastLocalEdit: Date.now() };
        }),
        
      setPhotoCount: (count) =>
        set((state) => {
          const currentPhotos = state.photos;
          const newPhotos = createInitialPhotos(count);
          
          // Preserve existing photo data
          for (let i = 0; i < Math.min(currentPhotos.length, count); i++) {
            newPhotos[i] = currentPhotos[i];
          }
          
          return { photos: newPhotos, photoCount: count, lastLocalEdit: Date.now() };
        }),
        
      addAdditionalPart: (part) =>
        set((state) => ({
          additionalParts: [...state.additionalParts, part],
          lastLocalEdit: Date.now(),
        })),
        
      addAdditionalPartsFromExcel: (parts, parentPn) =>
        set((state) => {
          const newParts: AdditionalPart[] = parts.map((part) => ({
            ...part,
            id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            parentPn: parentPn,
          }));
          return {
            additionalParts: [...state.additionalParts, ...newParts],
            lastLocalEdit: Date.now(),
          };
        }),
        
      removeAdditionalPart: (id) =>
        set((state) => ({
          additionalParts: state.additionalParts.filter((p) => p.id !== id),
          lastLocalEdit: Date.now(),
        })),
        
      updateAdditionalPart: (id, data) =>
        set((state) => ({
          additionalParts: state.additionalParts.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
          lastLocalEdit: Date.now(),
        })),
        
      setAdditionalParts: (parts) => set({ additionalParts: parts, lastLocalEdit: Date.now() }),
      
      updateAdditionalPartsParentPn: (oldPn, newPn) =>
        set((state) => ({
          additionalParts: state.additionalParts.map((p) =>
            p.parentPn === oldPn ? { ...p, parentPn: newPn } : p
          ),
          lastLocalEdit: Date.now(),
        })),
      
      setConclusion: (text) => set({ conclusion: text, lastLocalEdit: Date.now() }),
      
      setTranslation: (translation) => set({ translation }),
      
      // Load from external data (shared session) - substitui tudo
      loadFromData: (data: { inspection?: Partial<InspectionData>; photos?: PhotoData[]; additionalParts?: AdditionalPart[]; conclusion?: string }) =>
        set({
          inspection: data.inspection ? { ...initialInspection, ...data.inspection } : initialInspection,
          photos: data.photos || createInitialPhotos(4),
          additionalParts: data.additionalParts || [],
          conclusion: data.conclusion || '',
        }),
      
      // Merge inteligente - SÓ aceita dados do servidor se forem MAIS RECENTES que a edição local
      // Isso garante que a ÚLTIMA modificação sempre vença
      mergeFromData: (data: { inspection?: Partial<InspectionData>; photos?: PhotoData[]; additionalParts?: AdditionalPart[]; conclusion?: string }, serverTimestamp?: number) =>
        set((state) => {
          const serverTime = serverTimestamp || Date.now();
          const localEditTime = state.lastLocalEdit || 0;
          
          // REGRA CRÍTICA: Só aceitar dados do servidor se o timestamp for MAIS RECENTE que a edição local
          // Isso garante que a última modificação sempre vença
          if (serverTime <= localEditTime) {
            // Dados do servidor são mais antigos que a edição local - IGNORAR
            // Mas ainda atualizamos lastServerDataTime para evitar loops
            console.log('[Merge Inspecao] SKIPPED - server data is older. serverTime:', serverTime, 'localEditTime:', localEditTime);
            return { lastServerDataTime: serverTime };
          }
          
          const newInspection = { ...state.inspection };
          let hasChanges = false;
          
          // Merge campo por campo da inspeção - servidor tem prioridade pois é mais recente
          if (data.inspection) {
            Object.keys(data.inspection).forEach((key) => {
              const k = key as keyof InspectionData;
              const serverValue = data.inspection![k];
              
              // Se servidor tem valor, usa o do servidor
              if (serverValue !== null && serverValue !== undefined && serverValue !== '') {
                if ((newInspection as any)[k] !== serverValue) {
                  (newInspection as any)[k] = serverValue;
                  hasChanges = true;
                }
              }
            });
          }
          
          // Merge das fotos - servidor tem prioridade pois é mais recente
          let newPhotos = state.photos;
          if (data.photos) {
            newPhotos = mergePhotos(state.photos, data.photos);
            hasChanges = true;
          }
          
          // Merge das peças adicionais (subpeças) - servidor tem prioridade
          let newAdditionalParts = state.additionalParts;
          if (data.additionalParts && data.additionalParts.length > 0) {
            newAdditionalParts = data.additionalParts;
            hasChanges = true;
          }
          
          // Merge da conclusão - servidor tem prioridade pois é mais recente
          let newConclusion = state.conclusion;
          if (data.conclusion && data.conclusion.trim() !== '') {
            if (newConclusion !== data.conclusion) {
              newConclusion = data.conclusion;
              hasChanges = true;
            }
          }
          
          if (hasChanges) {
            console.log('[Merge Inspecao] Applied server changes, serverTime:', serverTime, '> localEditTime:', localEditTime);
          }
          
          return {
            inspection: newInspection,
            photos: newPhotos,
            additionalParts: newAdditionalParts,
            conclusion: newConclusion,
            lastServerDataTime: serverTime,
          };
        }),
      
      // Get all data for sharing
      getAllData: () => ({
        inspection: get().inspection,
        photos: get().photos,
        conclusion: get().conclusion,
      }),
      
      clearAll: () =>
        set({
          inspection: initialInspection,
          photos: createInitialPhotos(4),
          photoCount: 4,
          additionalParts: [],
          conclusion: '',
          translation: null,
          lastLocalEdit: 0,
        }),
    }),
    {
      name: 'report-storage',
      version: 4,
      storage: idbStorage,
      // v4: Full persistence using IndexedDB - no data stripping
      // Only persist data fields (exclude transient metadata)
      partialize: (state) => ({
        inspection: state.inspection,
        photos: state.photos,
        photoCount: state.photoCount,
        additionalParts: state.additionalParts,
        conclusion: state.conclusion,
        translation: state.translation,
      }),
      // Migration from older versions
      migrate: (persistedState: any, version: number) => {
        if (version < 4 && persistedState) {
          // Ensure embeddedPhotos and secondaryImageData are restored
          if (persistedState.photos) {
            persistedState.photos = persistedState.photos.map((photo: any) => ({
              ...photo,
              embeddedPhotos: photo.embeddedPhotos || [],
              secondaryImageData: photo.secondaryImageData || null,
              hasAdditionalParts: photo.hasAdditionalParts || false,
            }));
          }
        }
        return persistedState;
      },
    }
  )
);
