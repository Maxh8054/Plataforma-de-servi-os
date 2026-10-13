import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InspectionData, CategoryPhoto, CategoryData, AdditionalPart, ReportCategory } from '@/types/report';
import { DEFAULT_CATEGORIES } from '@/types/report';

// Criar dados iniciais para cada categoria
const createInitialCategoryData = (categoryId: ReportCategory): CategoryData => ({
  id: categoryId,
  photos: [
    {
      id: `photo-${categoryId}-init-0`,
      categoryId,
      description: '',
      pn: '',
      serialNumber: '',
      partName: '',
      quantity: '',
      imageData: null,
      editedImageData: null,
      embeddedPhotos: [],
    },
    {
      id: `photo-${categoryId}-init-1`,
      categoryId,
      description: '',
      pn: '',
      serialNumber: '',
      partName: '',
      quantity: '',
      imageData: null,
      editedImageData: null,
      embeddedPhotos: [],
    },
  ],
  additionalParts: [],
  isCompleted: false,
  notes: '',
});

// Criar estado inicial de todas as categorias
const createInitialCategories = (): Record<ReportCategory, CategoryData> => {
  const categories: Record<ReportCategory, CategoryData> = {} as any;
  DEFAULT_CATEGORIES.forEach(cat => {
    categories[cat.id] = createInitialCategoryData(cat.id);
  });
  return categories;
};

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
};

interface ReportPageState {
  // Inspection Data (compartilhado entre as abas)
  inspection: InspectionData;
  
  // Categories Data (nova aba Relatório)
  categories: Record<ReportCategory, CategoryData>;
  
  // Current active tab
  activeTab: 'inspecao' | 'relatorio';
  
  // Expanded categories in Relatório
  expandedCategories: Record<ReportCategory, boolean>;
  
  // Actions
  setActiveTab: (tab: 'inspecao' | 'relatorio') => void;
  toggleCategory: (categoryId: ReportCategory) => void;
  expandCategory: (categoryId: ReportCategory) => void;
  
  updateInspection: (data: Partial<InspectionData>) => void;
  
  // Category actions
  addPhotoToCategory: (categoryId: ReportCategory) => void;
  removePhotoFromCategory: (categoryId: ReportCategory, photoId: string) => void;
  updateCategoryPhoto: (categoryId: ReportCategory, photoId: string, data: Partial<CategoryPhoto>) => void;
  completeCategory: (categoryId: ReportCategory) => void;
  uncompleteCategory: (categoryId: ReportCategory) => void;
  updateCategoryNotes: (categoryId: ReportCategory, notes: string) => void;
  
  // Additional parts per category
  addAdditionalPartToCategory: (categoryId: ReportCategory, part: AdditionalPart) => void;
  removeAdditionalPartFromCategory: (categoryId: ReportCategory, partId: string) => void;
  
  clearAll: () => void;
}

export const useReportPageStore = create<ReportPageState>()(
  persist(
    (set, get) => ({
      inspection: initialInspection,
      categories: createInitialCategories(),
      activeTab: 'inspecao',
      expandedCategories: {
        contexto: false,
        preparacao: false,
        desmontagem: false,
        diagnostico: false,
        execucao: false,
        montagem: false,
        testes: false,
        conclusao: false,
      },
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      toggleCategory: (categoryId) =>
        set((state) => ({
          expandedCategories: {
            ...state.expandedCategories,
            [categoryId]: !state.expandedCategories[categoryId],
          },
        })),
      
      expandCategory: (categoryId) =>
        set((state) => ({
          expandedCategories: {
            ...state.expandedCategories,
            [categoryId]: true,
          },
        })),
      
      updateInspection: (data) =>
        set((state) => ({
          inspection: { ...state.inspection, ...data },
        })),
      
      addPhotoToCategory: (categoryId) =>
        set((state) => ({
          categories: {
            ...state.categories,
            [categoryId]: {
              ...state.categories[categoryId],
              photos: [
                ...state.categories[categoryId].photos,
                {
                  id: `photo-${categoryId}-${Date.now()}`,
                  categoryId,
                  description: '',
                  pn: '',
                  serialNumber: '',
                  partName: '',
                  quantity: '',
                  imageData: null,
                  editedImageData: null,
                  embeddedPhotos: [],
                },
              ],
            },
          },
        })),
      
      removePhotoFromCategory: (categoryId, photoId) =>
        set((state) => ({
          categories: {
            ...state.categories,
            [categoryId]: {
              ...state.categories[categoryId],
              photos: state.categories[categoryId].photos.filter(p => p.id !== photoId),
            },
          },
        })),
      
      updateCategoryPhoto: (categoryId, photoId, data) =>
        set((state) => ({
          categories: {
            ...state.categories,
            [categoryId]: {
              ...state.categories[categoryId],
              photos: state.categories[categoryId].photos.map(p =>
                p.id === photoId ? { ...p, ...data } : p
              ),
            },
          },
        })),
      
      completeCategory: (categoryId) =>
        set((state) => ({
          categories: {
            ...state.categories,
            [categoryId]: {
              ...state.categories[categoryId],
              isCompleted: true,
            },
          },
        })),
      
      uncompleteCategory: (categoryId) =>
        set((state) => ({
          categories: {
            ...state.categories,
            [categoryId]: {
              ...state.categories[categoryId],
              isCompleted: false,
            },
          },
        })),
      
      updateCategoryNotes: (categoryId, notes) =>
        set((state) => ({
          categories: {
            ...state.categories,
            [categoryId]: {
              ...state.categories[categoryId],
              notes,
            },
          },
        })),
      
      addAdditionalPartToCategory: (categoryId, part) =>
        set((state) => ({
          categories: {
            ...state.categories,
            [categoryId]: {
              ...state.categories[categoryId],
              additionalParts: [...state.categories[categoryId].additionalParts, part],
            },
          },
        })),
      
      removeAdditionalPartFromCategory: (categoryId, partId) =>
        set((state) => ({
          categories: {
            ...state.categories,
            [categoryId]: {
              ...state.categories[categoryId],
              additionalParts: state.categories[categoryId].additionalParts.filter(p => p.id !== partId),
            },
          },
        })),
      
      clearAll: () =>
        set({
          inspection: initialInspection,
          categories: createInitialCategories(),
          expandedCategories: {
            contexto: false,
            preparacao: false,
            desmontagem: false,
            diagnostico: false,
            execucao: false,
            montagem: false,
            testes: false,
            conclusao: false,
          },
        }),
    }),
    {
      name: 'report-page-storage',
    }
  )
);
