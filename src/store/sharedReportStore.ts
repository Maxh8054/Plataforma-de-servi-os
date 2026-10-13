import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PhotoCategory } from '@/types/report';

interface SharedInspection {
  tag: string;
  modelo: string;
  sn: string;
  entrega: string;
  cliente: string;
  descricao: string;
  machineDown: boolean;
  dataExecucao: string;
  dataFinal: string;
  os: string;
  executantes: string;
  horimetro: string;
  equipmentPhoto: string | null;
  horimetroPhoto: string | null;
  serialPhoto: string | null;
}

interface SharedReportState {
  // Metadata
  sessionId: string | null;
  sessionOwner: string | null;
  isSharedSession: boolean;
  userCount: number;
  lastSync: number | null;

  // Dados do relatório
  inspection: SharedInspection;
  categories: PhotoCategory[];
  conclusion: string;

  // Actions
  setSessionInfo: (sessionId: string, owner: string) => void;
  clearSession: () => void;
  setUserCount: (count: number) => void;
  setLastSync: (timestamp: number) => void;

  // Inspection actions
  updateInspection: (data: Partial<SharedInspection>) => void;

  // Categories actions
  setCategories: (categories: PhotoCategory[]) => void;
  addPhotoToCategory: (categoryId: string, photo: any) => void;
  removePhotoFromCategory: (categoryId: string, photoId: string) => void;
  updatePhotoInCategory: (categoryId: string, photoId: string, data: any) => void;

  // Conclusion
  setConclusion: (conclusion: string) => void;

  // Full data update (from sync)
  loadFromData: (data: any) => void;
  getAllData: () => any;
}

const DEFAULT_INSPECTION: SharedInspection = {
  tag: '',
  modelo: '',
  sn: '',
  entrega: '',
  cliente: '',
  descricao: '',
  machineDown: false,
  dataExecucao: new Date().toISOString().split('T')[0],
  dataFinal: '',
  os: '',
  executantes: '',
  horimetro: '',
  equipmentPhoto: null,
  horimetroPhoto: null,
  serialPhoto: null,
};

export const useSharedReportStore = create<SharedReportState>()(
  persist(
    (set, get) => ({
      // Initial state
      sessionId: null,
      sessionOwner: null,
      isSharedSession: false,
      userCount: 0,
      lastSync: null,
      inspection: DEFAULT_INSPECTION,
      categories: [],
      conclusion: '',

      // Session actions
      setSessionInfo: (sessionId, owner) => set({
        sessionId,
        sessionOwner: owner,
        isSharedSession: true,
      }),

      clearSession: () => set({
        sessionId: null,
        sessionOwner: null,
        isSharedSession: false,
        userCount: 0,
        lastSync: null,
        inspection: DEFAULT_INSPECTION,
        categories: [],
        conclusion: '',
      }),

      setUserCount: (count) => set({ userCount: count }),
      setLastSync: (timestamp) => set({ lastSync: timestamp }),

      // Inspection actions
      updateInspection: (data) => set((state) => ({
        inspection: { ...state.inspection, ...data },
      })),

      // Categories actions
      setCategories: (categories) => set({ categories }),

      addPhotoToCategory: (categoryId, photo) => set((state) => ({
        categories: state.categories.map(cat =>
          cat.id === categoryId
            ? { ...cat, photos: [...cat.photos, photo] }
            : cat
        ),
      })),

      removePhotoFromCategory: (categoryId, photoId) => set((state) => ({
        categories: state.categories.map(cat =>
          cat.id === categoryId
            ? { ...cat, photos: cat.photos.filter(p => p.id !== photoId) }
            : cat
        ),
      })),

      updatePhotoInCategory: (categoryId, photoId, data) => set((state) => ({
        categories: state.categories.map(cat =>
          cat.id === categoryId
            ? {
                ...cat,
                photos: cat.photos.map(p =>
                  p.id === photoId ? { ...p, ...data } : p
                ),
              }
            : cat
        ),
      })),

      // Conclusion
      setConclusion: (conclusion) => set({ conclusion }),

      // Full data update
      loadFromData: (data) => set({
        inspection: data.inspection || DEFAULT_INSPECTION,
        categories: data.categories || [],
        conclusion: data.conclusion || '',
      }),

      getAllData: () => ({
        inspection: get().inspection,
        categories: get().categories,
        conclusion: get().conclusion,
      }),
    }),
    {
      name: 'shared-report-storage',
      partialize: (state) => ({
        sessionId: state.sessionId,
        sessionOwner: state.sessionOwner,
        isSharedSession: state.isSharedSession,
      }),
    }
  )
);
