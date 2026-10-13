import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InspectionData, PhotoData, AdditionalPart, PhotoCategory } from '@/types/report';
import { DEFAULT_CATEGORIES } from '@/types/report';
import { idbStorage } from '@/lib/idbStorage';

// Versão do storage - incrementar quando mudar a estrutura das categorias
const STORAGE_VERSION = 5;

// Criar fotos iniciais para uma categoria (2 fotos por padrão)
const createInitialCategoryPhotos = (categoryId: string): PhotoData[] => {
  return Array.from({ length: 2 }, (_, i) => ({
    id: `photo-${categoryId}-init-${i}`,
    description: '',
    pn: '',
    serialNumber: '',
    partName: '',
    quantity: '',
    criticality: '',
    imageData: null,
    editedImageData: null,
    embeddedPhotos: [],
    hasAdditionalParts: false,
  }));
};

// Criar categorias iniciais
const createInitialCategories = (): PhotoCategory[] => {
  return DEFAULT_CATEGORIES.map(cat => ({
    ...cat,
    photos: createInitialCategoryPhotos(cat.id),
    additionalParts: [],
  }));
};

// IDs válidos de categorias
const VALID_CATEGORY_IDS = DEFAULT_CATEGORIES.map(c => c.id);

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
        editedImageData: server.editedImageData || local.editedImageData,
        embeddedPhotos: server.embeddedPhotos?.length ? server.embeddedPhotos : local.embeddedPhotos || [],
        hasAdditionalParts: server.hasAdditionalParts || local.hasAdditionalParts,
      });
    }
  }
  
  return merged;
}

// Função auxiliar para fazer merge de categorias
function mergeCategories(localCats: PhotoCategory[], serverCats: PhotoCategory[]): PhotoCategory[] {
  if (!serverCats || serverCats.length === 0) return localCats;
  if (!localCats || localCats.length === 0) return serverCats;
  
  return serverCats.map(serverCat => {
    const localCat = localCats.find(c => c.id === serverCat.id);
    if (!localCat) return serverCat;
    
    return {
      ...serverCat,
      photos: mergePhotos(localCat.photos, serverCat.photos),
      additionalParts: serverCat.additionalParts?.length ? serverCat.additionalParts : localCat.additionalParts || [],
    };
  });
}

interface HomeReportState {
  // Inspection Data
  inspection: InspectionData;
  
  // Categories with photos
  categories: PhotoCategory[];
  
  // Conclusion
  conclusion: string;
  
  // Timestamp da última edição local (feita pelo usuário)
  lastLocalEdit: number;
  
  // Timestamp da última vez que recebemos dados do servidor
  lastServerDataTime: number;
  
  // Actions
  updateInspection: (data: Partial<InspectionData>) => void;
  
  // Category actions
  setCategories: (categories: PhotoCategory[]) => void;
  addPhotoToCategory: (categoryId: string) => void;
  removePhotoFromCategory: (categoryId: string, photoId: string) => void;
  updatePhotoInCategory: (categoryId: string, photoId: string, data: Partial<PhotoData>) => void;
  movePhotoInCategory: (categoryId: string, fromIndex: number, toIndex: number) => void;
  
  // Additional parts for categories
  addAdditionalPartToCategory: (categoryId: string, part: AdditionalPart) => void;
  removeAdditionalPartFromCategory: (categoryId: string, partId: string) => void;
  updateAdditionalPartsParentPn: (categoryId: string, oldPn: string, newPn: string) => void;
  
  setConclusion: (text: string) => void;
  clearAll: () => void;
  
  // External data loading
  loadFromData: (data: { inspection?: Partial<InspectionData>; categories?: PhotoCategory[]; conclusion?: string }) => void;
  mergeFromData: (data: { inspection?: Partial<InspectionData>; categories?: PhotoCategory[]; conclusion?: string }, serverTimestamp?: number) => void;
  getAllData: () => { inspection: InspectionData; categories: PhotoCategory[]; conclusion: string };
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

export const useHomeReportStore = create<HomeReportState>()(
  persist(
    (set, get) => ({
      inspection: initialInspection,
      categories: createInitialCategories(),
      conclusion: '',
      lastLocalEdit: 0,
      lastServerDataTime: 0,
      
      setLastLocalEdit: (timestamp) => set({ lastLocalEdit: timestamp }),
      
      updateInspection: (data) =>
        set((state) => ({
          inspection: { ...state.inspection, ...data },
          lastLocalEdit: Date.now(),
        })),
      
      setCategories: (categories) => set({ categories, lastLocalEdit: Date.now() }),
      
      addPhotoToCategory: (categoryId) =>
        set((state) => ({
          categories: state.categories.map(cat => {
            if (cat.id !== categoryId) return cat;
            return {
              ...cat,
              photos: [
                ...cat.photos,
                {
                  id: `photo-${categoryId}-${Date.now()}`,
                  description: '',
                  pn: '',
                  serialNumber: '',
                  partName: '',
                  quantity: '',
                  criticality: '',
                  imageData: null,
                  editedImageData: null,
                  embeddedPhotos: [],
                  hasAdditionalParts: false,
                },
              ],
            };
          }),
          lastLocalEdit: Date.now(),
        })),
      
      removePhotoFromCategory: (categoryId, photoId) =>
        set((state) => ({
          categories: state.categories.map(cat => {
            if (cat.id !== categoryId) return cat;
            return {
              ...cat,
              photos: cat.photos.filter(p => p.id !== photoId),
            };
          }),
          lastLocalEdit: Date.now(),
        })),
      
      updatePhotoInCategory: (categoryId, photoId, data) =>
        set((state) => ({
          categories: state.categories.map(cat => {
            if (cat.id !== categoryId) return cat;
            return {
              ...cat,
              photos: cat.photos.map(p =>
                p.id === photoId ? { ...p, ...data } : p
              ),
            };
          }),
          lastLocalEdit: Date.now(),
        })),
      
      movePhotoInCategory: (categoryId, fromIndex, toIndex) =>
        set((state) => ({
          categories: state.categories.map(cat => {
            if (cat.id !== categoryId) return cat;
            const newPhotos = [...cat.photos];
            const [movedPhoto] = newPhotos.splice(fromIndex, 1);
            newPhotos.splice(toIndex, 0, movedPhoto);
            return {
              ...cat,
              photos: newPhotos,
            };
          }),
          lastLocalEdit: Date.now(),
        })),
      
      addAdditionalPartToCategory: (categoryId, part) =>
        set((state) => ({
          categories: state.categories.map(cat => {
            if (cat.id !== categoryId) return cat;
            return {
              ...cat,
              additionalParts: [...cat.additionalParts, part],
            };
          }),
          lastLocalEdit: Date.now(),
        })),
      
      removeAdditionalPartFromCategory: (categoryId, partId) =>
        set((state) => ({
          categories: state.categories.map(cat => {
            if (cat.id !== categoryId) return cat;
            return {
              ...cat,
              additionalParts: cat.additionalParts.filter(p => p.id !== partId),
            };
          }),
          lastLocalEdit: Date.now(),
        })),
      
      updateAdditionalPartsParentPn: (categoryId, oldPn, newPn) =>
        set((state) => ({
          categories: state.categories.map(cat => {
            if (cat.id !== categoryId) return cat;
            return {
              ...cat,
              additionalParts: cat.additionalParts.map(p =>
                p.parentPn === oldPn ? { ...p, parentPn: newPn } : p
              ),
            };
          }),
          lastLocalEdit: Date.now(),
        })),
      
      setConclusion: (text) => set({ conclusion: text, lastLocalEdit: Date.now() }),
      
      // Load from external data (shared session) - substitui tudo
      loadFromData: (data: { inspection?: Partial<InspectionData>; categories?: PhotoCategory[]; conclusion?: string }) =>
        set({
          inspection: data.inspection ? { ...initialInspection, ...data.inspection } : initialInspection,
          categories: data.categories || createInitialCategories(),
          conclusion: data.conclusion || '',
        }),
      
      // Merge inteligente - SÓ aceita dados do servidor se forem MAIS RECENTES que a edição local
      // Isso garante que a ÚLTIMA modificação sempre vença
      mergeFromData: (data: { inspection?: Partial<InspectionData>; categories?: PhotoCategory[]; conclusion?: string }, serverTimestamp?: number) =>
        set((state) => {
          const serverTime = serverTimestamp || Date.now();
          const localEditTime = state.lastLocalEdit || 0;
          
          // REGRA CRÍTICA: Só aceitar dados do servidor se o timestamp for MAIS RECENTE que a edição local
          // Isso garante que a última modificação sempre vença
          if (serverTime <= localEditTime) {
            // Dados do servidor são mais antigos que a edição local - IGNORAR
            // Mas ainda atualizamos lastServerDataTime para evitar loops
            console.log('[Merge Home] SKIPPED - server data is older. serverTime:', serverTime, 'localEditTime:', localEditTime);
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
          
          // Merge das categorias - sempre faz merge das fotos
          let newCategories = state.categories;
          if (data.categories) {
            newCategories = mergeCategories(state.categories, data.categories);
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
            console.log('[Merge Home] Applied server changes, serverTime:', serverTime, '> localEditTime:', localEditTime);
          }
          
          return {
            inspection: newInspection,
            categories: newCategories,
            conclusion: newConclusion,
            lastServerDataTime: serverTime,
          };
        }),
      
      // Get all data for sharing
      getAllData: () => ({
        inspection: get().inspection,
        categories: get().categories,
        conclusion: get().conclusion,
      }),
      
      clearAll: () =>
        set({
          inspection: initialInspection,
          categories: createInitialCategories(),
          conclusion: '',
          lastLocalEdit: 0,
        }),
    }),
    {
      name: 'home-report-storage',
      version: STORAGE_VERSION,
      storage: idbStorage,
      // v5: Full persistence using IndexedDB - no data stripping
      migrate: (persistedState: any, version: number) => {
        if (version < STORAGE_VERSION && persistedState) {
          if (persistedState.categories) {
            persistedState.categories = persistedState.categories.filter(
              (cat: PhotoCategory) => VALID_CATEGORY_IDS.includes(cat.id)
            );
          }
        }
        return persistedState;
      },
      // Only persist these fields (exclude transient metadata)
      partialize: (state) => ({
        inspection: state.inspection,
        categories: state.categories,
        conclusion: state.conclusion,
      }),
    }
  )
);
